import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { priceCart, supplierParts } from '../src/pricing.js';

const catalog = JSON.parse(readFileSync(new URL('../data/products.json', import.meta.url)));

test('two singles get 10% off and free shipping', () => {
  const t = priceCart(catalog, { 'sleep-headphones': 1, 'mini-massage-gun': 1 });
  assert.equal(t.subtotal, 10498);
  assert.equal(t.discount, 1050);
  assert.equal(t.shipping, 0);
  assert.equal(t.total, 9448);
});

test('three singles get 15% off', () => {
  const t = priceCart(catalog, { 'white-noise': 3 });
  assert.equal(t.discount, Math.round(8997 * 0.15));
});

test('bundles are not discounted again and small orders pay shipping', () => {
  assert.equal(priceCart(catalog, { 'deep-sleep-kit': 1 }).discount, 0);
  const t = priceCart(catalog, { 'ice-roller': 1 });
  assert.equal(t.shipping, 599);
  assert.equal(t.total, 1999 + 599);
});

test('unknown items and bad quantities are ignored', () => {
  const t = priceCart(catalog, { hack: 5, 'ice-roller': -2, 'sunset-lamp': 'abc' });
  assert.equal(t.lines.length, 0);
});

test('bundles expand into supplier products', () => {
  const t = priceCart(catalog, { 'deep-sleep-kit': 1, 'sleep-headphones': 1 });
  const parts = supplierParts(catalog, t.lines);
  assert.equal(parts.find((p) => p.product === 'sleep-headphones').qty, 2);
  assert.equal(parts.length, 3);
});
