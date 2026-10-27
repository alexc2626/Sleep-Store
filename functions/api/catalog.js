// GET /api/catalog  The live catalog the storefront uses, including CJ photos.
import { getCatalog } from '../_lib/catalog.js';

export async function onRequestGet({ env }) {
  return new Response(JSON.stringify(await getCatalog(env)), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' },
  });
}
