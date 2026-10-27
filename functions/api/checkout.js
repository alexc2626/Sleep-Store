// POST /api/checkout  { cart: { itemId: qty } }  ->  { url } of a Stripe Checkout page.
// Prices always come from data/products.json on the server, never from the browser.
import { priceCart, supplierParts } from '../../src/pricing.js';
import { stripe } from '../_lib/stripe.js';
import { createOrder, newOrderId, updateOrder } from '../_lib/db.js';
import { catalog, json, siteUrl } from '../_lib/util.js';

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Send the cart as JSON.' }, 400);
  }
  const priced = priceCart(catalog, body.cart);
  if (!priced.lines.length) return json({ error: 'Your cart is empty.' }, 400);

  const id = newOrderId();
  const parts = supplierParts(catalog, priced.lines);
  await createOrder(env.DB, {
    id,
    items: priced.lines.map(({ id, name, qty, unit, kind }) => ({ id, name, qty, unit, kind })),
    parts,
    subtotal: priced.subtotal,
    discount: priced.discount,
    shipping: priced.shipping,
    total: priced.total,
    currency: catalog.currency,
  });

  const site = siteUrl(env, request);
  const imageFor = (line) => {
    const p = catalog.products.find((x) => x.id === line.parts[0].product);
    const img = p?.images?.[0];
    return img && img.startsWith('http') ? img : undefined;
  };

  const params = {
    mode: 'payment',
    client_reference_id: id,
    metadata: { order_id: id },
    payment_intent_data: { metadata: { order_id: id } },
    success_url: `${site}/success?order=${id}`,
    cancel_url: `${site}/?cancelled=1`,
    shipping_address_collection: { allowed_countries: (env.SHIP_COUNTRIES || 'US').split(',').map((s) => s.trim()) },
    phone_number_collection: { enabled: true },
    billing_address_collection: 'auto',
    allow_promotion_codes: priced.discount ? undefined : true,
    line_items: priced.lines.map((l) => ({
      quantity: l.qty,
      price_data: {
        currency: catalog.currency,
        unit_amount: l.unit,
        product_data: { name: l.name, images: imageFor(l) ? [imageFor(l)] : undefined },
      },
    })),
    shipping_options: [
      {
        shipping_rate_data: {
          type: 'fixed_amount',
          display_name: priced.shipping ? 'Standard tracked shipping' : 'Free tracked shipping',
          fixed_amount: { amount: priced.shipping, currency: catalog.currency },
          delivery_estimate: { minimum: { unit: 'business_day', value: 3 }, maximum: { unit: 'business_day', value: 8 } },
        },
      },
    ],
  };

  if (priced.discount) {
    const coupon = await stripe(env, 'POST', 'coupons', {
      amount_off: priced.discount,
      currency: catalog.currency,
      duration: 'once',
      max_redemptions: 1,
      name: `Multi-buy ${Math.round(priced.discountRate * 100)}% off`,
    });
    params.discounts = [{ coupon: coupon.id }];
  }

  const session = await stripe(env, 'POST', 'checkout/sessions', params);
  await updateOrder(env.DB, id, { stripe_session: session.id });
  return json({ url: session.url, order: id });
}
