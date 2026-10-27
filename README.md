# Driftwell store

A complete online store you own, with no monthly platform fee.

- **Storefront**: static pages built from `data/products.json` (home, one page per product, bundles, policies, order tracking).
- **Checkout**: Stripe Checkout (card, Apple Pay, Google Pay). Stripe charges per sale only, no subscription.
- **Orders**: saved in a Cloudflare D1 database (free tier).
- **CJ sync**: the admin button "Sync products from CJ" pulls photos, variant ids and real costs into the live store, no command line needed.
- **Fulfilment**: paid orders are sent to CJdropshipping through its free API (optional auto mode). Items without a CJ variant are listed in the admin page to order by hand.
- **Tracking**: one click in the admin page pulls tracking numbers from CJ and emails customers.
- **Admin**: `/admin` shows orders, revenue, estimated profit and subscriber emails.
- **Hosting**: a Cloudflare Worker with static assets (free). `worker/index.js` routes `/api/*` to the handlers in `functions/api/` and serves `public/` for everything else.

## Commands

```
npm install                 # once
npm run import:cj           # pull photos, variant ids and costs from CJ (needs CJ_API_KEY)
npm run build               # rebuild public/ after editing data/*.json
npm test                    # pricing tests
npm run deploy              # build and publish the Cloudflare Worker
```

Full step-by-step setup is in the Driftwell setup guide doc shared in the project.

## Editing products

Edit `data/products.json`: name, price, cost, bullets, `images` (a list of image URLs), and the `supplier` block. Then `npm run build`.

## Testing locally without real accounts

`test/e2e/` has a mock Stripe/CJ/email server and an end-to-end script (33 checks) used to verify checkout, webhooks, CJ ordering, tracking and the admin API.
