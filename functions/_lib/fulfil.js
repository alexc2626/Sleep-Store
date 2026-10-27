// Turns a paid order into supplier orders. Parts with a CJ variant id are sent
// to CJ automatically; anything else is listed for you to order by hand.
import { cjToken, cjCreateOrder, cjOrderDetail } from './cj.js';
import { updateOrder, getOrder } from './db.js';
import { getCatalog } from './catalog.js';
import { sendEmail, escapeHtml, siteUrl } from './util.js';

export async function fulfilOrder(env, orderId) {
  const order = await getOrder(env.DB, orderId);
  if (!order) throw new Error('Order not found');
  if (order.status !== 'paid') return { skipped: `status is ${order.status}` };
  // Use the latest supplier details, so orders placed before a CJ sync still auto-order.
  const catalog = await getCatalog(env);
  order.parts = order.parts.map((p) => ({ ...p, supplier: catalog.products.find((x) => x.id === p.product)?.supplier || p.supplier }));
  const cjParts = order.parts.filter((p) => p.supplier?.cjVid);
  const manual = order.parts.filter((p) => !p.supplier?.cjVid);
  const result = { cj: null, manual: manual.map((p) => ({ name: p.name, qty: p.qty, url: p.supplier?.url })) };
  if (cjParts.length && env.CJ_API_KEY) {
    const token = await cjToken(env);
    const res = await cjCreateOrder(env, token, order, cjParts);
    result.cj = { orderId: res.orderId, status: res.orderStatus };
    await updateOrder(env.DB, orderId, {
      cj_order_id: res.orderId,
      status: manual.length ? 'paid' : 'sent_to_supplier',
      notes: manual.length ? `Sent CJ items. Order by hand: ${manual.map((m) => `${m.qty} x ${m.name}`).join(', ')}` : order.notes,
    });
  }
  return result;
}

// Checks CJ for tracking numbers and emails the customer once an order ships.
export async function syncTracking(env, request, orders) {
  const token = await cjToken(env);
  const updated = [];
  for (const o of orders) {
    if (!o.cj_order_id || o.tracking_number) continue;
    const d = await cjOrderDetail(env, token, o.cj_order_id);
    if (d?.trackNumber) {
      const url = d.trackingUrl || `https://t.17track.net/en#nums=${encodeURIComponent(d.trackNumber)}`;
      await updateOrder(env.DB, o.id, { tracking_number: d.trackNumber, tracking_url: url, status: 'shipped', shipped_at: new Date().toISOString() });
      await emailShipped(env, request, o, d.trackNumber, url);
      updated.push(o.id);
    }
    await new Promise((r) => setTimeout(r, 1100)); // CJ allows 1 call per second
  }
  return updated;
}

export async function emailShipped(env, request, o, number, url) {
  return sendEmail(env, {
    to: o.email,
    subject: `Your Driftwell order ${o.id} is on its way`,
    html: `<p>Hi ${escapeHtml(o.name?.split(' ')[0] || 'there')},</p><p>Good news, your order has shipped.</p><p>Tracking number: <b>${escapeHtml(number)}</b><br><a href="${escapeHtml(url)}">Track your parcel</a></p><p>You can also check it any time at ${escapeHtml(siteUrl(env, request))}/track</p><p>Sleep well,<br>Driftwell</p>`,
  });
}
