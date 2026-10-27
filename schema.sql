CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL,            -- pending, paid, sent_to_supplier, shipped, refunded, cancelled
  email TEXT,
  name TEXT,
  phone TEXT,
  address_json TEXT,
  items_json TEXT NOT NULL,        -- what the customer bought (products, bundles, add-ons)
  parts_json TEXT NOT NULL,        -- what the supplier must ship (bundles expanded)
  subtotal INTEGER NOT NULL,       -- all money in cents
  discount INTEGER NOT NULL,
  shipping INTEGER NOT NULL,
  total INTEGER NOT NULL,
  currency TEXT NOT NULL,
  stripe_session TEXT,
  payment_intent TEXT,
  cj_order_id TEXT,
  tracking_number TEXT,
  tracking_url TEXT,
  notes TEXT,
  paid_at TEXT,
  shipped_at TEXT
);
CREATE INDEX IF NOT EXISTS orders_status ON orders (status, created_at);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS subscribers (
  email TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);
