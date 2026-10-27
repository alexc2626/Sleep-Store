// Admin API, protected by ADMIN_PASSWORD.
//   GET  /api/admin/orders?status=paid
//   POST /api/admin/fulfil         { id }
//   POST /api/admin/update         { id, status?, tracking_number?, tracking_url?, notes? }
//   POST /api/admin/sync-tracking
//   GET  /api/admin/stats
//   GET  /api/admin/subscribers
//   POST /api/admin/cj-sync        pull photos, variants and costs from CJ
import { listOrders, updateOrder, getOrder } from '../../_lib/db.js';
import { fulfilOrder, syncTracking, emailShipped } from '../../_lib/fulfil.js';
import { isAdmin, json } from '../../_lib/util.js';
import { getCatalog, syncFromCj } from '../../_lib/catalog.js';

const STATUSES = ['pending', 'paid', 'sent_to_supplier', 'shipped', 'refunded', 'cancelled'];

export async function onRequest({ request, env, params }) {
  if (!isAdmin(request, env)) return json({ error: 'Wrong password' }, 401);
  const action = params.action;
  try {
    if (request.method === 'GET' && action === 'orders') {
      const status = new URL(request.url).searchParams.get('status') || undefined;
      return json({ orders: await listOrders(env.DB, { status }) });
    }
    if (request.method === 'GET' && action === 'stats') {
      const catalog = await getCatalog(env);
      const orders = await listOrders(env.DB, { limit: 1000 });
      const costOf = (o) => o.parts.reduce((s, p) => s + Math.round((catalog.products.find((x) => x.id === p.product)?.cost || 0) * 100) * p.qty, 0);
      const live = orders.filter((o) => !['refunded', 'cancelled'].includes(o.status));
      const revenue = live.reduce((s, o) => s + o.total, 0);
      const cost = live.reduce((s, o) => s + costOf(o), 0);
      const fees = live.reduce((s, o) => s + Math.round(o.total * 0.029 + 30), 0);
      return json({ orders: live.length, revenue, estSupplierCost: cost, estStripeFees: fees, estGrossProfit: revenue - cost - fees, toShip: orders.filter((o) => o.status === 'paid').length });
    }
    if (request.method === 'GET' && action === 'subscribers') {
      const { results } = await env.DB.prepare('SELECT email, created_at FROM subscribers ORDER BY created_at DESC').all();
      return json({ subscribers: results });
    }
    if (request.method !== 'POST') return json({ error: 'Not found' }, 404);
    const body = ['sync-tracking', 'cj-sync'].includes(action) ? {} : await request.json();
    if (action === 'cj-sync') return json({ products: await syncFromCj(env) });
    if (action === 'fulfil') return json(await fulfilOrder(env, body.id));
    if (action === 'update') {
      const existing = await getOrder(env.DB, body.id);
      if (!existing) return json({ error: 'Order not found' }, 404);
      if (body.status && !STATUSES.includes(body.status)) return json({ error: 'Unknown status' }, 400);
      const fields = {};
      for (const k of ['status', 'tracking_number', 'tracking_url', 'notes']) if (body[k] !== undefined) fields[k] = body[k];
      if (body.tracking_number && !body.tracking_url) fields.tracking_url = `https://t.17track.net/en#nums=${encodeURIComponent(body.tracking_number)}`;
      if (body.status === 'shipped') fields.shipped_at = new Date().toISOString();
      await updateOrder(env.DB, body.id, fields);
      if (fields.tracking_number && fields.tracking_number !== existing.tracking_number) {
        await emailShipped(env, request, existing, fields.tracking_number, fields.tracking_url);
      }
      return json({ ok: true });
    }
    if (action === 'sync-tracking') {
      const open = (await listOrders(env.DB, { status: 'sent_to_supplier' })).concat(await listOrders(env.DB, { status: 'paid' }));
      return json({ updated: await syncTracking(env, request, open) });
    }
    return json({ error: 'Not found' }, 404);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
