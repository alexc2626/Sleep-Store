import { readFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';
const B = 'http://127.0.0.1:8788';
const log = () => JSON.parse(readFileSync(process.argv[2], 'utf8'));
let pass = 0, fail = 0;
const check = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : ' ' + extra)); };
const post = (p, b, h = {}) => fetch(B + p, { method: 'POST', headers: { 'Content-Type': 'application/json', ...h }, body: typeof b === 'string' ? b : JSON.stringify(b) });

// 0. CJ sync fills photos and variants
const A0 = { Authorization: 'Bearer correct-horse-battery' };
let r0 = await post('/api/admin/cj-sync', {}, A0);
let d0 = await r0.json();
check('cj-sync ran', r0.ok && d0.products.filter((p) => p.ok).length === 6, JSON.stringify(d0).slice(0, 400));
d0 = await (await fetch(B + '/api/catalog')).json();
const hp = d0.products.find((p) => p.id === 'sleep-headphones');
check('catalog has CJ photos + vid', hp.images.length === 3 && hp.supplier.cjVid === 'VID-0557AB39-FB4F-42B0-A354-5A26203AEA26' && hp.cost === 9.5, JSON.stringify(hp));

// 1. checkout: 2 singles (34.99 + 69.99 = 104.98, 10% off = 10.50) + tampered price ignored + bogus id dropped
let r = await post('/api/checkout', { cart: { 'sleep-headphones': 1, 'mini-massage-gun': 1, 'fake-item': 3 }, price: 0.01 });
let d = await r.json();
check('checkout returns Stripe url', r.ok && d.url === 'http://localhost:9999/pay/cs_test_1', JSON.stringify(d));
const order = d.order;
const sess = log().find((x) => x.url.startsWith('/v1/checkout/sessions'));
const body = decodeURIComponent(sess.body);
check('line item prices come from server', body.includes('line_items[0][price_data][unit_amount]=3499') && body.includes('line_items[1][price_data][unit_amount]=6999'));
check('bogus item dropped', !body.includes('fake'));
const coupon = log().find((x) => x.url.startsWith('/v1/coupons'));
check('multi-buy coupon is 10% = 1050 cents', coupon && decodeURIComponent(coupon.body).includes('amount_off=1050'), coupon?.body);
check('free shipping over $50', body.includes('[fixed_amount][amount]=0'));
check('order id in metadata', body.includes('metadata[order_id]=' + order));
check('Stripe auth header', sess.headers.authorization === 'Bearer sk_test_fake');

// small order: shipping charged, no coupon, promo codes allowed
r = await post('/api/checkout', { cart: { 'ice-roller': 1 } });
const s2 = decodeURIComponent(log().filter((x) => x.url.startsWith('/v1/checkout/sessions')).pop().body);
check('flat shipping 599 under $50', s2.includes('[fixed_amount][amount]=599'));
check('promo codes allowed when no multi-buy', s2.includes('allow_promotion_codes=true'));
r = await post('/api/checkout', { cart: {} });
check('empty cart rejected', r.status === 400);

// 2. webhook bad signature
const evt = JSON.stringify({ type: 'checkout.session.completed', data: { object: { id: 'cs_test_1', payment_status: 'paid', amount_total: 9448, metadata: { order_id: order }, client_reference_id: order, payment_intent: 'pi_1', customer_details: { email: 'jane@example.com', phone: '+15551234567', name: 'Jane Doe' }, collected_information: { shipping_details: { name: 'Jane Doe', address: { line1: '1 Main St', line2: '', city: 'Austin', state: 'TX', postal_code: '78701', country: 'US' } } } } } });
r = await post('/api/stripe-webhook', evt, { 'Stripe-Signature': 't=1,v1=deadbeef' });
check('webhook rejects bad signature', r.status === 400);
const t = Math.floor(Date.now() / 1000);
const sig = createHmac('sha256', 'whsec_testsecret').update(`${t}.${evt}`).digest('hex');
r = await post('/api/stripe-webhook', evt, { 'Stripe-Signature': `t=${t},v1=${sig}` });
check('webhook accepts valid signature', r.ok, await r.text());
await new Promise((res) => setTimeout(res, 2500));
const cjOrder = log().find((x) => x.url.includes('createOrderV2'));
const cjBody = cjOrder && JSON.parse(cjOrder.body);
check('order auto-sent to CJ', !!cjOrder);
check('CJ gets token header', cjOrder?.headers['cj-access-token'] === 'cjtok');
check('CJ order has right variants', cjBody && cjBody.products.map((p) => p.vid).sort().join() === 'VID-0557AB39-FB4F-42B0-A354-5A26203AEA26,VID-1463778127867154432', JSON.stringify(cjBody?.products));
check('CJ picks cheapest method under 10 days', cjBody?.logisticName === 'USPS+', cjBody?.logisticName);
check('CJ gets address', cjBody?.shippingCity === 'Austin' && cjBody?.shippingZip === '78701' && cjBody?.shippingCustomerName === 'Jane Doe');
check('CJ create-only payType 3', cjBody?.payType === 3);
const emails = log().filter((x) => x.url === '/emails').map((x) => JSON.parse(x.body));
check('confirmation email sent to customer', emails.some((e) => e.to === 'jane@example.com' && e.subject.includes(order)));
check('owner notified', emails.some((e) => e.to === 'owner@example.com'));
r = await post('/api/stripe-webhook', evt, { 'Stripe-Signature': `t=${t},v1=${sig}` });
await new Promise((res) => setTimeout(res, 500));
check('duplicate webhook does not reorder', log().filter((x) => x.url.includes('createOrderV2')).length === 1);

// 3. tracking page API
r = await fetch(`${B}/api/track?order=${order}&email=wrong@example.com`);
check('track rejects wrong email', r.status === 404);
r = await fetch(`${B}/api/track?order=${order.toLowerCase()}&email=JANE@example.com`);
d = await r.json();
check('track works with right email', r.ok && d.status === 'sent_to_supplier', JSON.stringify(d));

// 4. admin
const A = { Authorization: 'Bearer correct-horse-battery' };
r = await fetch(B + '/api/admin/orders', { headers: { Authorization: 'Bearer nope' } });
check('admin rejects wrong password', r.status === 401);
r = await fetch(B + '/api/admin/orders', { headers: A });
d = await r.json();
check('admin lists paid order only', d.orders.length === 1 && d.orders[0].id === order && d.orders[0].cj_order_id === 'CJ123456', JSON.stringify(d).slice(0, 300));
r = await fetch(B + '/api/admin/stats', { headers: A });
d = await r.json();
check('stats revenue = 9448', d.revenue === 9448 && d.estSupplierCost === 1900, JSON.stringify(d));
r = await post('/api/admin/sync-tracking', {}, A);
d = await r.json();
check('tracking synced from CJ', d.updated?.[0] === order, JSON.stringify(d));
r = await fetch(`${B}/api/track?order=${order}&email=jane@example.com`);
d = await r.json();
check('customer sees tracking number', d.tracking_number === '9400111899223' && d.status === 'shipped');
check('shipping email sent', log().filter((x) => x.url === '/emails').map((x) => JSON.parse(x.body)).some((e) => e.subject.includes('on its way')));
r = await post('/api/admin/update', { id: order, status: 'bogus' }, A);
check('admin rejects unknown status', r.status === 400);
r = await post('/api/subscribe', { email: 'fan@example.com' });
r = await fetch(B + '/api/admin/subscribers', { headers: A });
d = await r.json();
check('subscriber saved', d.subscribers?.some((s) => s.email === 'fan@example.com'));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
