// POST /api/stripe-webhook  (add this URL in Stripe > Developers > Webhooks)
// Events: checkout.session.completed, checkout.session.async_payment_succeeded, charge.refunded
import { verifyWebhook } from '../_lib/stripe.js';
import { getOrder, updateOrder, markPaid } from '../_lib/db.js';
import { fulfilOrder } from '../_lib/fulfil.js';
import { json, sendEmail, escapeHtml, siteUrl } from '../_lib/util.js';
import { money } from '../../src/pricing.js';

export async function onRequestPost({ request, env, waitUntil }) {
  const raw = await request.text();
  const ok = await verifyWebhook(env.STRIPE_WEBHOOK_SECRET, raw, request.headers.get('Stripe-Signature'));
  if (!ok) return json({ error: 'Bad signature' }, 400);
  const event = JSON.parse(raw);
  const obj = event.data?.object || {};

  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    const orderId = obj.metadata?.order_id || obj.client_reference_id;
    const order = orderId && (await getOrder(env.DB, orderId));
    if (!order) return json({ received: true, note: 'unknown order' });
    if (obj.payment_status !== 'paid') return json({ received: true, note: 'awaiting payment' });
    const ship = obj.collected_information?.shipping_details || obj.shipping_details || {};
    const cust = obj.customer_details || {};
    const first = await markPaid(env.DB, orderId, {
      email: cust.email,
      phone: cust.phone,
      name: ship.name || cust.name,
      address_json: JSON.stringify(ship.address || cust.address || {}),
      payment_intent: obj.payment_intent,
    });
    if (!first) return json({ received: true, note: 'already handled' });

    const work = (async () => {
      const fresh = await getOrder(env.DB, orderId);
      await sendEmail(env, {
        to: fresh.email,
        subject: `Order ${orderId} confirmed`,
        html: `<p>Thanks ${escapeHtml(fresh.name?.split(' ')[0] || '')}, your order is confirmed.</p><ul>${fresh.items
          .map((i) => `<li>${i.qty} x ${escapeHtml(i.name)}</li>`)
          .join('')}</ul><p>Total paid: ${money(obj.amount_total ?? fresh.total)}</p><p>We will email tracking as soon as it ships (usually 1 to 3 business days). Track any time at ${escapeHtml(
          siteUrl(env, request)
        )}/track with order number <b>${orderId}</b>.</p>`,
      });
      if (env.AUTO_FULFIL === 'true') {
        try {
          await fulfilOrder(env, orderId);
        } catch (e) {
          await updateOrder(env.DB, orderId, { notes: 'Auto-send to supplier failed: ' + e.message });
        }
      }
      if (env.OWNER_EMAIL) {
        await sendEmail(env, { to: env.OWNER_EMAIL, subject: `New order ${orderId} (${money(obj.amount_total ?? fresh.total)})`, html: `<p>Open your admin page to review it.</p>` });
      }
    })();
    waitUntil ? waitUntil(work) : await work;
    return json({ received: true });
  }

  if (event.type === 'charge.refunded') {
    const orderId = obj.metadata?.order_id;
    if (orderId) await updateOrder(env.DB, orderId, { status: 'refunded' });
  }
  return json({ received: true });
}
