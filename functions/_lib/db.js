// Order storage on Cloudflare D1 (free tier). Schema lives in schema.sql.

export function newOrderId() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return 'DW-' + [...bytes].map((b) => alphabet[b % alphabet.length]).join('');
}

export async function createOrder(db, o) {
  await db
    .prepare(
      `INSERT INTO orders (id, created_at, status, items_json, parts_json, subtotal, discount, shipping, total, currency)
       VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(o.id, new Date().toISOString(), JSON.stringify(o.items), JSON.stringify(o.parts), o.subtotal, o.discount, o.shipping, o.total, o.currency)
    .run();
}

export async function getOrder(db, id) {
  const row = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first();
  return row ? hydrate(row) : null;
}

export async function listOrders(db, { status, limit = 100 } = {}) {
  const q = status
    ? db.prepare('SELECT * FROM orders WHERE status = ? ORDER BY created_at DESC LIMIT ?').bind(status, limit)
    : db.prepare("SELECT * FROM orders WHERE status != 'pending' ORDER BY created_at DESC LIMIT ?").bind(limit);
  const { results } = await q.all();
  return results.map(hydrate);
}

const COLUMNS = ['status', 'email', 'name', 'phone', 'address_json', 'stripe_session', 'payment_intent', 'cj_order_id', 'tracking_number', 'tracking_url', 'notes', 'paid_at', 'shipped_at'];

export async function updateOrder(db, id, fields) {
  const keys = Object.keys(fields).filter((k) => COLUMNS.includes(k));
  if (!keys.length) return;
  const sql = `UPDATE orders SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`;
  await db.prepare(sql).bind(...keys.map((k) => fields[k]), id).run();
}

// Flips a pending order to paid exactly once, even if Stripe retries the webhook.
export async function markPaid(db, id, fields) {
  const res = await db
    .prepare("UPDATE orders SET status = 'paid', paid_at = ?, email = ?, phone = ?, name = ?, address_json = ?, payment_intent = ? WHERE id = ? AND status = 'pending'")
    .bind(new Date().toISOString(), fields.email ?? null, fields.phone ?? null, fields.name ?? null, fields.address_json, fields.payment_intent ?? null, id)
    .run();
  return res.meta.changes === 1;
}

export async function getSetting(db, key) {
  const row = await db.prepare('SELECT value FROM settings WHERE key = ?').bind(key).first();
  return row ? row.value : null;
}

export async function setSetting(db, key, value) {
  await db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(key, value).run();
}

function hydrate(row) {
  return {
    ...row,
    items: JSON.parse(row.items_json || '[]'),
    parts: JSON.parse(row.parts_json || '[]'),
    address: row.address_json ? JSON.parse(row.address_json) : null,
  };
}
