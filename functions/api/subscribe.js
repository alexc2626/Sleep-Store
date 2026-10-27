// POST /api/subscribe { email }  Stores newsletter signups. Export them from the admin page.
import { json } from '../_lib/util.js';

export async function onRequestPost({ request, env }) {
  const { email } = await request.json().catch(() => ({}));
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) return json({ error: 'Enter a valid email.' }, 400);
  await env.DB.prepare('INSERT OR IGNORE INTO subscribers (email, created_at) VALUES (?, ?)').bind(email.toLowerCase(), new Date().toISOString()).run();
  return json({ ok: true });
}
