import catalog from '../../data/products.json';
export { catalog };

export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export function siteUrl(env, request) {
  return (env.SITE_URL || new URL(request.url).origin).replace(/\/$/, '');
}

// Admin endpoints need "Authorization: Bearer <ADMIN_PASSWORD>".
export function isAdmin(request, env) {
  const given = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const want = env.ADMIN_PASSWORD || '';
  if (!want || want.length < 12 || given.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}

// Optional emails through Resend (free up to 3,000 a month). Skipped when no key is set.
export async function sendEmail(env, { to, subject, html }) {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM || !to) return { skipped: true };
  const res = await fetch(`${env.RESEND_API_BASE || 'https://api.resend.com'}/emails`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.EMAIL_FROM, to, subject, html, reply_to: env.SUPPORT_EMAIL || undefined }),
  });
  return { ok: res.ok };
}

export const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
