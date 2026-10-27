// The live catalog: data/products.json plus anything synced from CJ
// (photos, variant ids, real costs), which is stored in the database.
import base from '../../data/products.json';
import { getSetting, setSetting } from './db.js';
import { cjToken, cjProduct } from './cj.js';

export async function getCatalog(env) {
  let overrides = {};
  try {
    overrides = JSON.parse((await getSetting(env.DB, 'cj_overrides')) || '{}');
  } catch {
    overrides = {};
  }
  return {
    ...base,
    products: base.products.map((p) => {
      const o = overrides[p.id];
      if (!o) return p;
      return {
        ...p,
        images: p.images?.length ? p.images : o.images || [],
        cost: o.cost || p.cost,
        supplier: { ...p.supplier, cjVid: p.supplier.cjVid || o.vid || '', cjVariant: o.variant || '' },
      };
    }),
  };
}

// Pulls photos, the default variant and its cost from CJ for every product with a cjPid.
export async function syncFromCj(env) {
  const token = await cjToken(env);
  const overrides = JSON.parse((await getSetting(env.DB, 'cj_overrides')) || '{}');
  const report = [];
  for (const p of base.products) {
    const pid = p.supplier?.cjPid;
    if (!pid) {
      report.push({ id: p.id, name: p.name, ok: false, note: 'No CJ product yet, order by hand' });
      continue;
    }
    try {
      await new Promise((r) => setTimeout(r, 1100)); // CJ allows 1 call per second
      const d = await cjProduct(env, token, pid);
      const set = Array.isArray(d.productImageSet) ? d.productImageSet : String(d.productImageSet || '').split(',');
      const images = [...new Set([d.bigImage, ...set].filter((u) => typeof u === 'string' && u.startsWith('http')))].slice(0, 8);
      const v = (d.variants || [])[0] || {};
      const cost = Number(v.variantSellPrice || d.sellPrice) || p.cost;
      overrides[p.id] = { images, vid: v.vid || '', variant: v.variantKey || v.variantNameEn || '', cost };
      report.push({ id: p.id, name: p.name, ok: true, photos: images.length, cost, margin: Math.round((1 - cost / p.price) * 100) });
    } catch (e) {
      report.push({ id: p.id, name: p.name, ok: false, note: e.message });
    }
  }
  await setSetting(env.DB, 'cj_overrides', JSON.stringify(overrides));
  return report;
}
