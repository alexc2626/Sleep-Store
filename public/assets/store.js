import { priceCart, lookup, money } from './pricing.js';
import { ICONS } from './icons.js';

const $ = (id) => document.getElementById(id);
const catalog = await fetch('/catalog.json').then((r) => r.json());
const KEY = 'driftwell-cart';

let cart = {};
try {
  cart = JSON.parse(localStorage.getItem(KEY) || '{}');
} catch {
  cart = {};
}
const save = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify(cart));
  } catch {}
};

function visualFor(id) {
  const item = lookup(catalog, id);
  const p = catalog.products.find((x) => x.id === item?.parts[0].product);
  if (!p) return { cat: 'sleep', html: '' };
  return { cat: p.cat, html: p.images?.length ? `<img src="${p.images[0]}" alt="">` : ICONS[p.icon] };
}

function render() {
  const t = priceCart(catalog, cart);
  $('cartCount').textContent = t.itemCount;
  $('sub').textContent = money(t.subtotal);
  $('disc').textContent = t.discount ? '-' + money(t.discount) : money(0);
  $('ship').textContent = t.shipping ? money(t.shipping) : 'Free';
  $('total').textContent = money(t.total);
  const threshold = catalog.freeShippingThreshold * 100;
  $('shipFill').style.width = Math.min(100, ((threshold - t.toFreeShipping) / threshold) * 100) + '%';
  $('shipMsg').textContent = t.toFreeShipping === 0 ? 'You unlocked free shipping' : `Add ${money(t.toFreeShipping)} more for free shipping`;
  $('upsell').hidden = t.itemCount === 0 || cart['addon-ice-roller'] || cart['ice-roller'];
  $('checkout').disabled = t.itemCount === 0;
  $('lines').innerHTML = t.lines.length
    ? t.lines
        .map((l) => {
          const v = visualFor(l.id);
          return `<div class="line"><div class="mini g-${v.cat}">${v.html}</div>
      <div><div class="name">${l.name}</div><div class="qty"><button data-dec="${l.id}" aria-label="Remove one">−</button>${l.qty}<button data-inc="${l.id}" aria-label="Add one">+</button></div></div>
      <div class="price">${money(l.total)}</div></div>`;
        })
        .join('')
    : '<p class="empty">Your cart is empty. Start with the sleep headphones, our most loved pick.</p>';
}

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (t.hidden = true), 1800);
}
const openCart = (v) => {
  $('drawer').hidden = !v;
  $('scrim').hidden = !v;
};

function add(id) {
  if (!lookup(catalog, id)) return;
  cart[id] = (cart[id] || 0) + 1;
  save();
  render();
  toast(lookup(catalog, id).name + ' added');
}

function setFilter(v) {
  document.querySelectorAll('#filters button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.f === v));
  document.querySelectorAll('#grid .card').forEach((c) => (c.hidden = v !== 'all' && c.dataset.cat !== v));
}

document.addEventListener('click', (e) => {
  const a = e.target.closest('[data-add]');
  if (a) return add(a.dataset.add);
  const inc = e.target.closest('[data-inc]');
  if (inc) {
    cart[inc.dataset.inc]++;
    save();
    return render();
  }
  const dec = e.target.closest('[data-dec]');
  if (dec) {
    const id = dec.dataset.dec;
    if (--cart[id] <= 0) delete cart[id];
    save();
    return render();
  }
  const f = e.target.closest('[data-f]');
  if (f) return setFilter(f.dataset.f);
  const img = e.target.closest('[data-img]');
  if (img) {
    $('mainImg').innerHTML = `<img src="${img.dataset.img}" alt="">`;
    document.querySelectorAll('[data-img]').forEach((b) => b.setAttribute('aria-current', b === img));
  }
});
$('openCart').onclick = () => openCart(true);
$('closeCart').onclick = () => openCart(false);
$('scrim').onclick = () => openCart(false);
$('addUpsell').onclick = () => add('addon-ice-roller');
document.addEventListener('keydown', (e) => e.key === 'Escape' && openCart(false));

$('checkout').onclick = async () => {
  const btn = $('checkout');
  btn.disabled = true;
  btn.textContent = 'Opening secure checkout...';
  try {
    const res = await fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cart }) });
    const data = await res.json();
    if (!res.ok || !data.url) throw new Error(data.error || 'Checkout is unavailable right now.');
    location.href = data.url;
  } catch (err) {
    $('checkoutNote').textContent = err.message + ' Please try again in a minute.';
    btn.disabled = false;
    btn.textContent = 'Secure checkout';
  }
};

const signup = $('signup');
if (signup) {
  signup.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await fetch('/api/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: $('email').value }) });
    } catch {}
    $('signupOk').hidden = false;
    signup.hidden = true;
  });
}

const params = new URLSearchParams(location.search);
if (params.get('c') && $('filters')) setFilter(params.get('c'));
if (params.get('cancelled')) toast('Checkout cancelled. Your cart is saved.');
if (location.pathname.startsWith('/success')) {
  cart = {};
  save();
}
render();
