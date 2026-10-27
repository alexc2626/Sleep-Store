// Minimal Stripe client using fetch, so no SDK or build step is needed.

function encode(obj, prefix, out = []) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === 'object') encode(v, key, out);
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`);
  }
  return out.join('&');
}

export async function stripe(env, method, path, params) {
  const res = await fetch(`${env.STRIPE_API_BASE || 'https://api.stripe.com'}/v1/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params ? encode(params) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Stripe ${path}: ${data.error?.message || res.status}`);
  return data;
}

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

export async function sign(secret, payload) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload)));
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Verifies the Stripe-Signature header. Rejects events older than 5 minutes.
export async function verifyWebhook(secret, rawBody, header, now = Date.now()) {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(',').map((kv) => kv.split('=')).map(([k, ...v]) => [k, v.join('=')]));
  const t = Number(parts.t);
  if (!t || Math.abs(now / 1000 - t) > 300) return false;
  const expected = await sign(secret, `${t}.${rawBody}`);
  const given = header.split(',').filter((p) => p.startsWith('v1=')).map((p) => p.slice(3));
  return given.some((g) => safeEqual(g, expected));
}
