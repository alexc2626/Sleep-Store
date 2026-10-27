import http from 'node:http';
import { writeFileSync } from 'node:fs';
const log = [];
http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    log.push({ method: req.method, url: req.url, body, headers: req.headers });
    writeFileSync(process.argv[2], JSON.stringify(log, null, 1));
    const send = (o) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    const u = req.url;
    if (u.startsWith('/v1/coupons')) return send({ id: 'coupon_test_1' });
    if (u.startsWith('/v1/checkout/sessions')) return send({ id: 'cs_test_1', url: 'http://localhost:9999/pay/cs_test_1' });
    if (u.startsWith('/pay/')) { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end('<h1>Mock Stripe Checkout</h1>'); }
    if (u.includes('/authentication/getAccessToken')) return send({ code: 200, result: true, data: { accessToken: 'cjtok', refreshToken: 'cjref', accessTokenExpiryDate: new Date(Date.now() + 150 * 864e5).toISOString() } });
    if (u.includes('/logistic/freightCalculate')) return send({ code: 200, result: true, data: [{ logisticName: 'USPS+', logisticPrice: 4.1, logisticAging: '3-6' }, { logisticName: 'Slowboat', logisticPrice: 1.2, logisticAging: '15-30' }, { logisticName: 'UPS', logisticPrice: 9, logisticAging: '2-4' }] });
    if (u.includes('/shopping/order/createOrderV2')) return send({ code: 200, result: true, data: { orderId: 'CJ123456', orderStatus: 'CREATED' } });
    if (u.includes('/shopping/order/getOrderDetail')) return send({ code: 200, result: true, data: { orderId: 'CJ123456', trackNumber: '9400111899223', trackingUrl: null, orderStatus: 'SHIPPED' } });
    if (u.includes('/product/query')) { const pid = new URL(u, 'http://x').searchParams.get('pid'); return send({ code: 200, result: true, data: { bigImage: `https://img.example/${pid}/main.jpg`, productImageSet: [`https://img.example/${pid}/2.jpg`, `https://img.example/${pid}/3.jpg`], sellPrice: 10, variants: [{ vid: 'VID-' + pid, variantKey: 'Black', variantSellPrice: 9.5 }] } }); }
    if (u.startsWith('/emails')) return send({ id: 'email_1' });
    res.writeHead(404); res.end('{}');
  });
}).listen(9999, () => console.log('mock on 9999'));
