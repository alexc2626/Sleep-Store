// Pulls product photos, the variant id (needed for auto-ordering) and the real
// supplier cost from CJ for every product that has a cjPid in data/products.json.
//
//   CJ_API_KEY=your_key node scripts/cj-import.mjs
//
// Optional: pick a specific variant with  CJ_VARIANT_<product-id>=<variantKey text>,
// for example CJ_VARIANT_silk_pillowcase=Black  (dashes in the id become underscores).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const file = join(root, 'data/products.json');
const catalog = JSON.parse(readFileSync(file, 'utf8'));
const BASE = 'https://developers.cjdropshipping.com/api2.0/v1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!process.env.CJ_API_KEY) {
  console.error('Set CJ_API_KEY first. Find it in CJ: Authorization > API > API Key.');
  process.exit(1);
}

async function cj(method, path, { body, query, token } = {}) {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(query || {})) url.searchParams.set(k, v);
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json', ...(token ? { 'CJ-Access-Token': token } : {}) }, body: body && JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok || data.result === false) throw new Error(`${path}: ${data.message || res.status}`);
  return data.data;
}

const { accessToken } = await cj('POST', '/authentication/getAccessToken', { body: { apiKey: process.env.CJ_API_KEY } });
await sleep(1100);

for (const p of catalog.products) {
  const pid = p.supplier?.cjPid;
  if (!pid) {
    console.log(`- ${p.name}: no CJ product id, skipped (add one, or keep ordering it by hand)`);
    continue;
  }
  try {
    const d = await cj('GET', '/product/query', { query: { pid }, token: accessToken });
    const images = [...new Set([d.bigImage, ...(Array.isArray(d.productImageSet) ? d.productImageSet : String(d.productImageSet || '').split(','))].filter((u) => u && u.startsWith('http')))];
    const wanted = process.env['CJ_VARIANT_' + p.id.replace(/-/g, '_')];
    const variants = d.variants || [];
    const v = (wanted && variants.find((x) => String(x.variantKey || x.variantNameEn || '').toLowerCase().includes(wanted.toLowerCase()))) || variants[0];
    p.images = images.slice(0, 8);
    if (v) {
      p.supplier.cjVid = v.vid;
      p.supplier.cjVariant = v.variantKey || v.variantNameEn || '';
      if (v.variantImage && !p.images.includes(v.variantImage)) p.images.unshift(v.variantImage);
      const cost = Number(v.variantSellPrice || d.sellPrice);
      if (cost) p.cost = cost;
    }
    const margin = p.cost ? Math.round((1 - p.cost / p.price) * 100) : null;
    console.log(`+ ${p.name}: ${p.images.length} photos, variant ${p.supplier.cjVariant || 'default'}, cost $${p.cost} (product margin ${margin}%, before shipping)`);
    if (margin !== null && margin < 55) console.log(`  ! margin is thin, consider raising the price or picking another listing`);
  } catch (e) {
    console.log(`x ${p.name}: ${e.message}`);
  }
  await sleep(1100);
}

writeFileSync(file, JSON.stringify(catalog, null, 2) + '\n');
console.log('\nSaved data/products.json. Now run: node scripts/build.mjs');
