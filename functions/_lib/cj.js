// CJdropshipping API client (free with a CJ account, API key from
// CJ dashboard > Authorization > API). Docs:
// https://developers.cjdropshipping.com/en/api/api2/api/shopping.html
import { getSetting, setSetting } from './db.js';

const BASE = 'https://developers.cjdropshipping.com/api2.0/v1';
const base = (env) => (env.CJ_API_BASE || BASE);

async function call(env, method, path, { body, query, token } = {}) {
  const url = new URL(base(env) + path);
  for (const [k, v] of Object.entries(query || {})) url.searchParams.set(k, v);
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { 'CJ-Access-Token': token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.result === false || (data.code && data.code !== 200)) {
    throw new Error(`CJ ${path}: ${data.message || res.status}`);
  }
  return data.data;
}

// Tokens last about 180 days. Cached in D1 so we stay under CJ's 1 call/second limit.
export async function cjToken(env) {
  const cached = await getSetting(env.DB, 'cj_token');
  if (cached) {
    const t = JSON.parse(cached);
    if (new Date(t.accessTokenExpiryDate).getTime() - Date.now() > 86400000) return t.accessToken;
    try {
      const fresh = await call(env, 'POST', '/authentication/refreshAccessToken', { body: { refreshToken: t.refreshToken } });
      await setSetting(env.DB, 'cj_token', JSON.stringify(fresh));
      return fresh.accessToken;
    } catch {
      /* fall through to a new token */
    }
  }
  if (!env.CJ_API_KEY) throw new Error('CJ_API_KEY is not set');
  const fresh = await call(env, 'POST', '/authentication/getAccessToken', { body: { apiKey: env.CJ_API_KEY } });
  await setSetting(env.DB, 'cj_token', JSON.stringify(fresh));
  return fresh.accessToken;
}

export async function cjProduct(env, token, pid) {
  return call(env, 'GET', '/product/query', { query: { pid }, token });
}

// Picks the cheapest shipping method that arrives within maxDays, or the cheapest overall.
export async function cjPickLogistic(env, token, { from, to, zip, products }) {
  const list = await call(env, 'POST', '/logistic/freightCalculate', {
    token,
    body: { startCountryCode: from, endCountryCode: to, zip, products: products.map((p) => ({ vid: p.vid, quantity: p.quantity })) },
  });
  if (!Array.isArray(list) || !list.length) return env.CJ_LOGISTIC_NAME || null;
  const maxDays = Number(env.CJ_MAX_SHIPPING_DAYS || 10);
  const slowest = (aging) => Number(String(aging || '').split('-').pop()) || 99;
  const fast = list.filter((l) => slowest(l.logisticAging) <= maxDays);
  const pool = fast.length ? fast : list;
  pool.sort((a, b) => Number(a.logisticPrice) - Number(b.logisticPrice));
  return pool[0].logisticName;
}

// Sends one order to CJ. payType 3 = create only (you review and pay in CJ),
// payType 2 = pay automatically from your CJ wallet balance.
export async function cjCreateOrder(env, token, order, cjParts) {
  const a = order.address;
  const products = cjParts.map((p) => ({ vid: p.supplier.cjVid, quantity: p.qty, storeLineItemId: `${order.id}-${p.product}` }));
  const from = env.CJ_FROM_COUNTRY || 'US';
  let logisticName = env.CJ_LOGISTIC_NAME;
  try {
    logisticName = (await cjPickLogistic(env, token, { from, to: a.country, zip: a.postal_code, products })) || logisticName;
  } catch {
    /* keep the configured default */
  }
  if (!logisticName) throw new Error('No CJ shipping method available. Set CJ_LOGISTIC_NAME.');
  return call(env, 'POST', '/shopping/order/createOrderV2', {
    token,
    body: {
      orderNumber: order.id,
      shippingCountryCode: a.country,
      shippingCountry: a.country,
      shippingProvince: a.state || a.city,
      shippingCity: a.city,
      shippingZip: a.postal_code,
      shippingAddress: a.line1,
      shippingAddress2: a.line2 || '',
      shippingCustomerName: order.name,
      shippingPhone: order.phone || '',
      email: order.email || '',
      logisticName,
      fromCountryCode: from,
      payType: Number(env.CJ_PAY_TYPE || 3),
      remark: 'Driftwell order ' + order.id,
      products,
    },
  });
}

export async function cjOrderDetail(env, token, orderId) {
  return call(env, 'GET', '/shopping/order/getOrderDetail', { query: { orderId }, token });
}
