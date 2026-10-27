import { money } from './pricing.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
let password = sessionStorage.getItem('dw-admin') || '';

async function api(path, body) {
  const res = await fetch('/api/admin/' + path, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: 'Bearer ' + password, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (res.status === 401) {
    sessionStorage.removeItem('dw-admin');
    showLogin('Wrong password.');
    throw new Error('Wrong password');
  }
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function showLogin(err) {
  $('login').hidden = false;
  $('app').hidden = true;
  $('loginErr').hidden = !err;
  $('loginErr').textContent = err || '';
}

const say = (m) => ($('msg').textContent = m);

function address(a) {
  if (!a) return '';
  return [a.line1, a.line2, `${a.city || ''} ${a.state || ''} ${a.postal_code || ''}`, a.country].filter(Boolean).map(esc).join('<br>');
}

async function load() {
  const [stats, list] = await Promise.all([api('stats'), api('orders' + ($('filter').value ? '?status=' + $('filter').value : ''))]);
  $('stats').innerHTML = [
    ['Orders', stats.orders],
    ['Revenue', money(stats.revenue)],
    ['Supplier cost (est.)', money(stats.estSupplierCost)],
    ['Stripe fees (est.)', money(stats.estStripeFees)],
    ['Gross profit before ads', money(stats.estGrossProfit)],
    ['Waiting to ship', stats.toShip],
  ]
    .map(([k, v]) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`)
    .join('');
  $('rows').innerHTML = list.orders.length
    ? list.orders
        .map(
          (o) => `<tr>
      <td><b>${esc(o.id)}</b><div class="small">${new Date(o.created_at).toLocaleString()}</div></td>
      <td>${esc(o.name)}<div class="small">${esc(o.email)}<br>${esc(o.phone)}</div><div class="small">${address(o.address)}</div></td>
      <td>${o.items.map((i) => `${i.qty} x ${esc(i.name)}`).join('<br>')}</td>
      <td class="num">${money(o.total)}</td>
      <td><span class="pill ${esc(o.status)}">${esc(o.status.replace(/_/g, ' '))}</span>${o.tracking_number ? `<div class="small"><a href="${esc(o.tracking_url)}" target="_blank" rel="noopener">${esc(o.tracking_number)}</a></div>` : ''}${o.notes ? `<div class="small">${esc(o.notes)}</div>` : ''}</td>
      <td>${o.parts
        .map((p) => `${p.qty} x ${p.supplier?.url ? `<a href="${esc(p.supplier.url)}" target="_blank" rel="noopener">${esc(p.name)}</a>` : esc(p.name)}${p.supplier?.cjVid ? ' <span class="small">(CJ auto)</span>' : ' <span class="small">(order by hand)</span>'}`)
        .join('<br>')}${o.cj_order_id ? `<div class="small">CJ order ${esc(o.cj_order_id)}</div>` : ''}</td>
      <td>
        ${o.status === 'paid' ? `<button data-act="fulfil" data-id="${esc(o.id)}">Send to CJ</button><br>` : ''}
        <button data-act="track" data-id="${esc(o.id)}">Add tracking</button><br>
        ${o.status !== 'shipped' ? `<button data-act="shipped" data-id="${esc(o.id)}">Mark shipped</button><br>` : ''}
        <button data-act="note" data-id="${esc(o.id)}">Note</button>
      </td>
    </tr>`
        )
        .join('')
    : '<tr><td colspan="7" class="small">No orders yet. They appear here the moment a customer pays.</td></tr>';
}

$('login').addEventListener('submit', async (e) => {
  e.preventDefault();
  password = $('pw').value;
  try {
    await api('stats');
    sessionStorage.setItem('dw-admin', password);
    $('login').hidden = true;
    $('app').hidden = false;
    load();
  } catch {}
});

$('refresh').onclick = () => load().then(() => say('Updated.'));
$('filter').onchange = load;
$('sync').onclick = async () => {
  say('Checking CJ, this takes about a second per order...');
  try {
    const r = await api('sync-tracking', {});
    say(r.updated.length ? `Added tracking to ${r.updated.length} orders and emailed customers.` : 'No new tracking numbers yet.');
    load();
  } catch (e) {
    say(e.message);
  }
};
$('cjSync').onclick = async () => {
  say('Pulling photos and costs from CJ, about 15 seconds...');
  try {
    const { products } = await api('cj-sync', {});
    const ok = products.filter((p) => p.ok);
    const thin = ok.filter((p) => p.margin < 55).map((p) => `${p.name} (${p.margin}%)`);
    say(`Synced ${ok.length} products from CJ.` + (thin.length ? ` Thin margins: ${thin.join(', ')}.` : '') + ` ${products.length - ok.length} still ordered by hand.`);
  } catch (e) {
    say(e.message);
  }
};
$('exportSubs').onclick = async () => {
  const { subscribers } = await api('subscribers');
  const text = subscribers.map((s) => s.email).join('\n');
  try {
    await navigator.clipboard.writeText(text);
    say(`Copied ${subscribers.length} emails.`);
  } catch {
    say(`${subscribers.length} subscribers: ${text.replace(/\n/g, ', ')}`);
  }
};

// Inline row editor instead of prompt() dialogs.
document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const id = b.dataset.id;
  try {
    if (b.dataset.act === 'fulfil') {
      say('Sending to CJ...');
      const r = await api('fulfil', { id });
      say((r.cj ? `CJ order ${r.cj.orderId} created. ` : '') + (r.manual.length ? `Order by hand: ${r.manual.map((m) => `${m.qty} x ${m.name}`).join(', ')}` : ''));
    } else if (b.dataset.act === 'shipped') {
      await api('update', { id, status: 'shipped' });
    } else {
      const cell = b.parentElement;
      const field = b.dataset.act === 'track' ? 'tracking_number' : 'notes';
      cell.innerHTML = `<input class="small" style="width:150px" id="edit-${id}" placeholder="${field === 'notes' ? 'Note' : 'Tracking number'}"> <button data-save="${field}" data-id="${esc(id)}">Save</button>`;
      $('edit-' + id).focus();
      return;
    }
    load();
  } catch (err) {
    say(err.message);
  }
});
document.addEventListener('click', async (e) => {
  const s = e.target.closest('[data-save]');
  if (!s) return;
  const id = s.dataset.id;
  const value = $('edit-' + id).value.trim();
  const body = { id, [s.dataset.save]: value };
  if (s.dataset.save === 'tracking_number' && value) body.status = 'shipped';
  try {
    await api('update', body);
    load();
  } catch (err) {
    say(err.message);
  }
});

if (password) {
  $('login').hidden = true;
  $('app').hidden = false;
  load().catch(() => {});
} else showLogin();
