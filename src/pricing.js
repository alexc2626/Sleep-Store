// Shared pricing rules. The browser uses this to show totals and the server
// uses the same code to charge, so the two can never disagree. All money is
// handled in whole cents.

export const cents = (dollars) => Math.round(dollars * 100);

export function lookup(catalog, id) {
  const p = catalog.products.find((x) => x.id === id);
  if (p) return { id, kind: 'product', name: p.name, unit: cents(p.price), parts: [{ product: p.id, qty: 1 }] };
  const b = catalog.bundles.find((x) => x.id === id);
  if (b) return { id, kind: 'bundle', name: b.name, unit: cents(b.price), parts: b.items.map((pid) => ({ product: pid, qty: 1 })) };
  const a = (catalog.addons || []).find((x) => x.id === id);
  if (a) return { id, kind: 'addon', name: a.name, unit: cents(a.price), parts: [{ product: a.product, qty: 1 }] };
  return null;
}

// cart: { [itemId]: quantity }. Unknown ids and bad quantities are dropped.
export function priceCart(catalog, cart) {
  const lines = [];
  for (const [id, rawQty] of Object.entries(cart || {})) {
    const qty = Math.floor(Number(rawQty));
    if (!Number.isFinite(qty) || qty <= 0) continue;
    const item = lookup(catalog, id);
    if (!item) continue;
    lines.push({ ...item, qty: Math.min(qty, 20), total: item.unit * Math.min(qty, 20) });
  }
  const subtotal = lines.reduce((s, l) => s + l.total, 0);
  // Multi-buy discount applies to single products only, not bundles or add-ons.
  const singles = lines.filter((l) => l.kind === 'product');
  const singleCount = singles.reduce((s, l) => s + l.qty, 0);
  const singleTotal = singles.reduce((s, l) => s + l.total, 0);
  const tier = [...catalog.multiBuy].sort((a, b) => b.minItems - a.minItems).find((t) => singleCount >= t.minItems);
  const discount = tier ? Math.round(singleTotal * tier.rate) : 0;
  const afterDiscount = subtotal - discount;
  const shipping = afterDiscount === 0 || afterDiscount >= cents(catalog.freeShippingThreshold) ? 0 : cents(catalog.flatShipping);
  return {
    lines,
    subtotal,
    discount,
    discountRate: tier ? tier.rate : 0,
    shipping,
    total: afterDiscount + shipping,
    toFreeShipping: Math.max(0, cents(catalog.freeShippingThreshold) - afterDiscount),
    itemCount: lines.reduce((s, l) => s + l.qty, 0),
  };
}

// Expands priced lines into supplier products with quantities, for fulfilment.
export function supplierParts(catalog, lines) {
  const totals = {};
  for (const l of lines) for (const part of l.parts) totals[part.product] = (totals[part.product] || 0) + part.qty * l.qty;
  return Object.entries(totals).map(([product, qty]) => {
    const p = catalog.products.find((x) => x.id === product);
    return { product, name: p.name, qty, supplier: p.supplier };
  });
}

export const money = (c) => '$' + (c / 100).toFixed(2);
