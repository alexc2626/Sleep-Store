// Cloudflare Worker entry. Static pages in public/ are served as assets;
// anything under /api/ is routed to the handlers in functions/api/.
import * as checkout from '../functions/api/checkout.js';
import * as webhook from '../functions/api/stripe-webhook.js';
import * as track from '../functions/api/track.js';
import * as catalog from '../functions/api/catalog.js';
import * as subscribe from '../functions/api/subscribe.js';
import * as admin from '../functions/api/admin/[action].js';

const routes = {
  '/api/checkout': checkout,
  '/api/stripe-webhook': webhook,
  '/api/track': track,
  '/api/catalog': catalog,
  '/api/subscribe': subscribe,
};

function pick(mod, method) {
  const name = 'onRequest' + method.charAt(0) + method.slice(1).toLowerCase();
  return mod[name] || mod.onRequest;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const context = { request, env, params: {}, waitUntil: ctx.waitUntil.bind(ctx) };
    let mod = routes[url.pathname.replace(/\/$/, '')];
    const adminMatch = url.pathname.match(/^\/api\/admin\/([a-z-]+)$/);
    if (adminMatch) {
      mod = admin;
      context.params.action = adminMatch[1];
    }
    if (mod) {
      const handler = pick(mod, request.method);
      if (!handler) return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
      try {
        return await handler(context);
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
    }
    if (url.pathname.startsWith('/api/')) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    return env.ASSETS.fetch(request);
  },
};
