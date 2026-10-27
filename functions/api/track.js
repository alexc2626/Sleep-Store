// GET /api/track?order=DW-XXXXXX&email=you@example.com
import { getOrder } from '../_lib/db.js';
import { json } from '../_lib/util.js';

const LABELS = {
  pending: 'Waiting for payment',
  paid: 'Order received, preparing to ship',
  sent_to_supplier: 'Being packed at our warehouse',
  shipped: 'Shipped',
  refunded: 'Refunded',
  cancelled: 'Cancelled',
};

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const id = (url.searchParams.get('order') || '').trim().toUpperCase();
  const email = (url.searchParams.get('email') || '').trim().toLowerCase();
  const order = id && (await getOrder(env.DB, id));
  // Same answer for a wrong id or wrong email, so order numbers cannot be probed.
  if (!order || !order.email || order.email.toLowerCase() !== email) {
    return json({ error: 'We could not find that order. Check the order number and email from your confirmation.' }, 404);
  }
  return json({
    id: order.id,
    status: order.status,
    label: LABELS[order.status] || order.status,
    items: order.items.map((i) => ({ name: i.name, qty: i.qty })),
    tracking_number: order.tracking_number,
    tracking_url: order.tracking_url,
    created_at: order.created_at,
  });
}
