// Builds the static storefront into public/ from data/*.json and src/.
// Run: node scripts/build.mjs
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ICONS } from '../src/icons.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const catalog = JSON.parse(readFileSync(join(root, 'data/products.json'), 'utf8'));
const site = JSON.parse(readFileSync(join(root, 'data/site.json'), 'utf8'));
const out = join(root, 'public');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const money = (d) => '$' + Number(d).toFixed(2);
const catLabel = { sleep: 'Sleep', recover: 'Recover', glow: 'Glow', unwind: 'Unwind' };
const byId = Object.fromEntries(catalog.products.map((p) => [p.id, p]));

for (const dir of ['p', 'assets']) rmSync(join(out, dir), { recursive: true, force: true });
mkdirSync(join(out, 'p'), { recursive: true });
mkdirSync(join(out, 'assets'), { recursive: true });

const visual = (p, cls = 'thumb') =>
  p.images?.length
    ? `<div class="${cls} g-${p.cat}"><img src="${esc(p.images[0])}" alt="${esc(p.name)}" loading="lazy"></div>`
    : `<div class="${cls} g-${p.cat}">${ICONS[p.icon]}</div>`;

function layout({ title, description, body, path = '/', image, scripts = ['/assets/store.js'] }) {
  const ogImage = image || (catalog.products.find((p) => p.images?.length)?.images[0] ?? '');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(site.url + path)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="website">
${ogImage ? `<meta property="og:image" content="${esc(ogImage)}">` : ''}
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" fill="#1d2342"/><circle cx="20" cy="13" r="10" fill="#f0ad55"/><circle cx="24" cy="10" r="9" fill="#1d2342"/></svg>')}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Figtree:wght@400;500;600;700&display=swap">
<link rel="stylesheet" href="/assets/store.css">
</head>
<body>
<div class="announce">${esc(site.announcement)}</div>
<header class="top">
  <div class="wrap">
    <a class="logo" href="/"><span class="moon"></span>${esc(site.name)}</a>
    <nav class="cats" aria-label="Shop by category">
      ${Object.entries(catLabel).map(([k, v]) => `<a href="/?c=${k}#shop">${v}</a>`).join('\n      ')}
      <a href="/#bundles">Bundles</a>
      <a href="/track">Track order</a>
    </nav>
    <button class="cart-btn" id="openCart" aria-label="Open cart">Cart <b id="cartCount">0</b></button>
  </div>
</header>
<main>
${body}
</main>
<footer>
  <div class="wrap">
    <div><a class="logo" href="/"><span class="moon"></span>${esc(site.name)}</a><p style="margin-top:10px;max-width:32ch">Tools for slower evenings and deeper sleep. Ships from ${esc(site.shipsFrom)}.</p><p style="margin-top:10px">${esc(site.supportEmail)}</p></div>
    <div><h4>Shop</h4><ul>${Object.entries(catLabel).map(([k, v]) => `<li><a href="/?c=${k}#shop">${v}</a></li>`).join('')}<li><a href="/#bundles">Bundles</a></li></ul></div>
    <div><h4>Help</h4><ul><li><a href="/shipping">Shipping</a></li><li><a href="/returns">${site.returnsDays} night returns</a></li><li><a href="/track">Track order</a></li><li><a href="/contact">Contact</a></li></ul></div>
    <div><h4>Legal</h4><ul><li><a href="/privacy">Privacy</a></li><li><a href="/terms">Terms</a></li></ul></div>
  </div>
</footer>
<div class="scrim" id="scrim" hidden></div>
<aside class="drawer" id="drawer" hidden aria-label="Cart">
  <header><h2>Your cart</h2><button class="x" id="closeCart" aria-label="Close cart">×</button></header>
  <div class="ship-bar"><span id="shipMsg"></span><div class="track"><div class="fill" id="shipFill"></div></div></div>
  <div class="lines" id="lines"></div>
  <div class="upsell" id="upsell" hidden><span>Add a <b>facial ice roller</b> for $14.99 (save $5)</span><button id="addUpsell">Add</button></div>
  <div class="totals">
    <div><span>Subtotal</span><span id="sub">$0.00</span></div>
    <div><span>Multi-buy discount</span><span id="disc">$0.00</span></div>
    <div><span>Shipping</span><span id="ship">$0.00</span></div>
    <div class="grand"><span>Total</span><span id="total">$0.00</span></div>
  </div>
  <button class="btn checkout" id="checkout">Secure checkout</button>
  <p class="note" id="checkoutNote">Buy 2 items, save 10%. Buy 3 or more, save 15%. Pay with card, Apple Pay or Google Pay.</p>
</aside>
<div class="toast" id="toast" hidden></div>
${scripts.map((s) => `<script type="module" src="${s}"></script>`).join('\n')}
</body>
</html>
`;
}

const card = (p) => `
      <article class="card" data-cat="${p.cat}">
        <a class="cardlink" href="/p/${p.id}">
          <div style="position:relative">${visual(p)}${p.badge ? `<span class="badge" style="position:absolute;top:12px;left:12px">${esc(p.badge)}</span>` : ''}</div>
          <div class="meta"><span class="cat">${catLabel[p.cat]}</span></div>
          <div class="meta"><h3>${esc(p.name)}</h3><span class="price">${money(p.price)}</span></div>
          <p class="desc">${esc(p.short)}</p>
        </a>
        <button class="add" data-add="${p.id}">Add to cart</button>
      </article>`;

const bundleCard = (b, i) => {
  const full = b.items.reduce((s, id) => s + byId[id].price, 0);
  return `
      <article class="bundle ${i === 0 ? 'best' : ''}">
        ${b.flag ? `<span class="flag">${esc(b.flag)}</span>` : ''}
        <h3>${esc(b.name)}</h3>
        <ul>${b.items.map((id) => `<li><a href="/p/${id}">${esc(byId[id].name)}</a></li>`).join('')}</ul>
        <div class="meta"><span class="price" style="font-size:1.3rem">${money(b.price)}<s>${money(full)}</s></span></div>
        <span class="save">You save ${money(full - b.price)} compared with buying separately</span>
        <button class="btn" data-add="${b.id}">Add kit to cart</button>
      </article>`;
};

// Home page
writeFileSync(
  join(out, 'index.html'),
  layout({
    title: `${site.name} | Sleep, recovery and wind-down essentials`,
    description: 'Sleep headphones, sunrise alarms, massage tools and red light skincare, picked to work together for a calmer evening and deeper sleep.',
    body: `
<div class="hero" id="top">
  <div class="wrap">
    <div>
      <p class="eyebrow" style="color:#ffd59a">${esc(site.tagline)}</p>
      <h1>Your best night<br>starts at <em>9:30 pm</em></h1>
      <p class="lede">Calm-making tools for sleep, recovery and skin, picked to work together so your evening finally feels like yours.</p>
      <div class="ctas">
        <a class="btn btn-glow" href="#shop">Shop the collection</a>
        <a class="btn btn-ghost" href="#bundles">Build a night kit and save</a>
      </div>
      <div class="proof">
        <div><strong>${site.returnsDays} nights</strong>to try it, easy returns</div>
        <div><strong>Free shipping</strong>on orders over $${catalog.freeShippingThreshold}</div>
        <div><strong>Secure checkout</strong>card, Apple Pay, Google Pay</div>
      </div>
    </div>
    <div class="lamp" aria-hidden="true">
      <div class="ring"></div><div class="orb"></div>
      <div class="tag t1"><b>Sunset lamp</b>warm golden glow</div>
      <div class="tag t2"><b>Sleep headphones</b>made for side sleepers</div>
    </div>
  </div>
</div>

<section class="ritual">
  <div class="wrap">
    <div class="sec-head">
      <div><p class="eyebrow">The Driftwell ritual</p><h2>Four steps, one hour, a calmer night</h2></div>
      <p>Screens off is not enough. This routine lowers light, loosens muscles and quiets noise in the order your body winds down.</p>
    </div>
    <ol>
      <li><span class="time">9:30 pm</span><h3>Dim the room</h3><p>Swap overhead light for a warm sunset glow and a slow flame diffuser.</p><a href="/?c=unwind#shop">Shop Unwind</a></li>
      <li><span class="time">9:45 pm</span><h3>Release the day</h3><p>Ten minutes on the acupressure mat or the neck massager eases desk tension.</p><a href="/?c=recover#shop">Shop Recover</a></li>
      <li><span class="time">10:00 pm</span><h3>Care for skin</h3><p>Red light mask while you read, then an ice roller to cool and depuff.</p><a href="/?c=glow#shop">Shop Glow</a></li>
      <li><span class="time">10:30 pm</span><h3>Drift off</h3><p>Soft sleep headphones, white noise and silk on your pillow. Lights out.</p><a href="/?c=sleep#shop">Shop Sleep</a></li>
    </ol>
  </div>
</section>

<section class="shop" id="shop">
  <div class="wrap">
    <div class="sec-head">
      <div><p class="eyebrow">Shop</p><h2>Everything for the night shift</h2></div>
      <div class="filters" role="group" aria-label="Filter products" id="filters">
        <button aria-pressed="true" data-f="all">All</button>
        ${Object.entries(catLabel).map(([k, v]) => `<button aria-pressed="false" data-f="${k}">${v}</button>`).join('\n        ')}
      </div>
    </div>
    <div class="grid" id="grid">${catalog.products.map(card).join('')}
    </div>
  </div>
</section>

<section class="bundles" id="bundles">
  <div class="wrap">
    <div class="sec-head">
      <div><p class="eyebrow">Night kits</p><h2>Bundle it and save</h2></div>
      <p>Every kit ships together. Perfect for the person on your list who is always tired.</p>
    </div>
    <div class="grid">${catalog.bundles.map(bundleCard).join('')}
    </div>
  </div>
</section>

<section style="padding-top:0">
  <div class="wrap" style="display:grid;gap:56px">
    <div class="trust-row">
      <div><b>Free shipping over $${catalog.freeShippingThreshold}</b><span>Tracked delivery in ${esc(site.deliveryDays)}</span></div>
      <div><b>${site.returnsDays} night trial</b><span>Not for you? Send it back</span></div>
      <div><b>Secure payments</b><span>Processed by Stripe</span></div>
      <div><b>Real support</b><span>${esc(site.supportEmail)}</span></div>
    </div>
    <div class="faq-grid">
      <div>
        <p class="eyebrow">Questions</p><h2 style="margin-bottom:12px">Good to know</h2>
        <details><summary>How fast will my order arrive?</summary><p>Orders ship within 1 to 3 business days and arrive in ${esc(site.deliveryDays)}. You get a tracking number by email and can check it on our <a href="/track">tracking page</a>.</p></details>
        <details><summary>Will it arrive before Christmas?</summary><p>Order by ${esc(site.christmasCutoff)} for standard delivery before 25 December.</p></details>
        <details><summary>What if it is not for me?</summary><p>You have ${site.returnsDays} nights to try it. See our <a href="/returns">returns policy</a>.</p></details>
        <details><summary>Is the red light mask safe?</summary><p>It is a cosmetic skincare device using LED light. Follow the included instructions and do not use it if you are light sensitive or pregnant. It is not a medical device and does not treat any condition.</p></details>
      </div>
      <div class="signup">
        <p class="eyebrow" style="color:#ffd59a">The 7 night reset</p>
        <h2>Get 10% off your first order</h2>
        <p>Join the list for sleep tips, new arrivals and your welcome code.</p>
        <form id="signup"><label for="email" hidden>Email</label><input id="email" name="email" type="email" required placeholder="you@example.com"><button class="btn btn-glow" type="submit">Send my code</button></form>
        <p class="ok" id="signupOk" hidden>You are in. Use code WELCOME10 at checkout.</p>
      </div>
    </div>
  </div>
</section>`,
  })
);

// Product pages (one per product, for ads and search)
for (const p of catalog.products) {
  const kits = catalog.bundles.filter((b) => b.items.includes(p.id));
  const imgs = p.images?.length ? p.images : [];
  const body = `
<div class="wrap">
  <div class="pdp">
    <div>
      <div class="main-img g-${p.cat}" id="mainImg">${imgs.length ? `<img src="${esc(imgs[0])}" alt="${esc(p.name)}">` : ICONS[p.icon]}</div>
      ${imgs.length > 1 ? `<div class="thumbs">${imgs.map((src, i) => `<button data-img="${esc(src)}" aria-current="${i === 0}" aria-label="Photo ${i + 1}"><img src="${esc(src)}" alt="" loading="lazy"></button>`).join('')}</div>` : ''}
    </div>
    <div class="buy">
      <p class="eyebrow">${catLabel[p.cat]}</p>
      <h1>${esc(p.name)}</h1>
      <span class="price">${money(p.price)}</span>
      <p>${esc(p.short)}</p>
      <ul class="bullets">${p.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>
      <button class="btn" data-add="${p.id}">Add to cart</button>
      <p class="ship-note">Free tracked shipping over $${catalog.freeShippingThreshold}. Arrives in ${esc(site.deliveryDays)}. ${site.returnsDays} night returns.</p>
      ${kits
        .map((b) => {
          const full = b.items.reduce((s, id) => s + byId[id].price, 0);
          return `<div class="pair"><b>Save ${money(full - b.price)} with the ${esc(b.name)}</b><span class="desc">${b.items.map((id) => esc(byId[id].name)).join(', ')}</span><button class="add" data-add="${b.id}">Add kit for ${money(b.price)}</button></div>`;
        })
        .join('')}
    </div>
  </div>
</div>
<section class="shop"><div class="wrap"><div class="sec-head"><h2>Pairs well with</h2></div><div class="grid">${catalog.products
    .filter((x) => x.id !== p.id && (x.cat === p.cat || kits.some((k) => k.items.includes(x.id))))
    .slice(0, 4)
    .map(card)
    .join('')}</div></div></section>`;
  writeFileSync(join(out, 'p', `${p.id}.html`), layout({ title: `${p.name} | ${site.name}`, description: p.short, body, path: `/p/${p.id}`, image: imgs[0] }));
}

// Simple content pages
const pages = {
  'success.html': ['Thank you for your order', `<p>Your order <b id="orderId"></b> is confirmed. A receipt is on its way to your email.</p><p>We ship within 1 to 3 business days and email your tracking number as soon as it leaves the warehouse.</p><p><a class="btn btn-glow" href="/">Keep shopping</a> <a href="/track">Track your order</a></p>`, ['/assets/store.js', '/assets/success.js']],
  'track.html': ['Track your order', `<p>Enter the order number from your confirmation email (it starts with DW-) and the email you used at checkout.</p><form id="trackForm" class="panel"><div class="field"><label for="tOrder">Order number</label><input id="tOrder" required placeholder="DW-ABC123"></div><div class="field"><label for="tEmail">Email</label><input id="tEmail" type="email" required></div><button class="btn btn-glow" type="submit">Find my order</button></form><div id="trackResult"></div>`, ['/assets/store.js', '/assets/track.js']],
  'shipping.html': ['Shipping', `<p>We ship to the United States from ${esc(site.shipsFrom)}.</p><h2>Timing</h2><p>Orders are processed in 1 to 3 business days. Delivery takes ${esc(site.deliveryDays)} after that. Some items ship from overseas partners and may take longer; the expected time is shown before you pay.</p><h2>Cost</h2><p>Free tracked shipping on orders over $${catalog.freeShippingThreshold}. Otherwise a flat ${money(catalog.flatShipping)}.</p><h2>Tracking</h2><p>We email a tracking number as soon as your order ships. You can also use our <a href="/track">tracking page</a>.</p><h2>Holidays</h2><p>Order by ${esc(site.christmasCutoff)} for standard delivery before Christmas.</p>`],
  'returns.html': [`${site.returnsDays} night returns`, `<p>If you are not happy, contact us within ${site.returnsDays} days of delivery at ${esc(site.supportEmail)} with your order number.</p><h2>How it works</h2><ol><li>Email us and we will send return instructions.</li><li>Send the item back unused or gently used, with all parts.</li><li>We refund to your original payment method within 5 business days of receiving it.</li></ol><h2>Damaged or faulty</h2><p>If anything arrives damaged or stops working, email a photo and we will replace or refund it at no cost.</p><h2>Hygiene items</h2><p>For hygiene reasons, opened pillowcases and face masks can be returned only if faulty.</p>`],
  'contact.html': ['Contact us', `<p>Email <b>${esc(site.supportEmail)}</b> and we will reply within one business day.</p><p>Please include your order number (it starts with DW-) if you have one.</p>`],
  'privacy.html': ['Privacy policy', `<p>Last updated ${new Date().toISOString().slice(0, 10)}.</p><h2>What we collect</h2><p>When you order, we collect your name, email, phone number and shipping address so we can deliver your order. Payments are processed by Stripe; we never see or store your full card number.</p><h2>Who we share it with</h2><p>We share your shipping details only with our fulfilment partners so they can pack and ship your order, and with email providers to send order updates.</p><h2>Marketing</h2><p>If you join our list we email tips and offers. Every email has an unsubscribe link.</p><h2>Your rights</h2><p>Email ${esc(site.supportEmail)} to see, correct or delete your data.</p><h2>Cookies</h2><p>We store your cart in your browser so it is there when you come back. We do not use advertising cookies unless you add tracking pixels later and update this policy.</p>`],
  'terms.html': ['Terms of service', `<p>By ordering from ${esc(site.name)} you agree to these terms.</p><h2>Orders</h2><p>All prices are in US dollars. We may cancel an order and refund you in full if an item is unavailable or a price was listed in error.</p><h2>Products</h2><p>Our products are for general wellness and relaxation. They are not medical devices and are not intended to diagnose, treat, cure or prevent any disease. Follow the included instructions.</p><h2>Liability</h2><p>To the extent allowed by law, our liability is limited to the amount you paid for the product.</p><h2>Contact</h2><p>${esc(site.supportEmail)}</p>`],
};
for (const [file, [title, html, scripts]] of Object.entries(pages)) {
  writeFileSync(join(out, file), layout({ title: `${title} | ${site.name}`, description: title, body: `<div class="wrap"><div class="page"><h1>${esc(title)}</h1>${html}</div></div>`, path: '/' + file.replace('.html', ''), scripts }));
}

// Assets
writeFileSync(join(out, 'catalog.json'), JSON.stringify(catalog));
copyFileSync(join(root, 'src/store.css'), join(out, 'assets/store.css'));
for (const f of ['pricing.js', 'icons.js', 'store.js', 'success.js', 'track.js', 'admin.js']) copyFileSync(join(root, 'src', f), join(out, 'assets', f));
writeFileSync(join(out, 'robots.txt'), `User-agent: *\nDisallow: /admin\nSitemap: ${site.url}/sitemap.xml\n`);
writeFileSync(
  join(out, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${['/', ...catalog.products.map((p) => `/p/${p.id}`), '/shipping', '/returns']
    .map((u) => `  <url><loc>${site.url}${u}</loc></url>`)
    .join('\n')}\n</urlset>\n`
);
if (!existsSync(join(out, 'admin.html'))) console.warn('public/admin.html is missing');
const missing = catalog.products.filter((p) => !p.images?.length).map((p) => p.id);
console.log(`Built ${catalog.products.length} product pages.` + (missing.length ? ` ${missing.length} products still use illustrations (run scripts/cj-import.mjs or add image URLs).` : ''));
