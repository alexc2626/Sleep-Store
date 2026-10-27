const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

$('trackForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const out = $('trackResult');
  out.innerHTML = '<p>Looking up your order...</p>';
  const q = new URLSearchParams({ order: $('tOrder').value, email: $('tEmail').value });
  try {
    const res = await fetch('/api/track?' + q);
    const d = await res.json();
    if (!res.ok) throw new Error(d.error);
    out.innerHTML = `<div class="panel"><h2>${esc(d.label)}</h2><p>Order ${esc(d.id)}, placed ${new Date(d.created_at).toLocaleDateString()}</p><ul>${d.items
      .map((i) => `<li>${i.qty} x ${esc(i.name)}</li>`)
      .join('')}</ul>${d.tracking_number ? `<p>Tracking number <b>${esc(d.tracking_number)}</b></p><a class="btn btn-glow" href="${esc(d.tracking_url)}" target="_blank" rel="noopener">Track parcel</a>` : '<p>Your tracking number will appear here as soon as your order ships.</p>'}</div>`;
  } catch (err) {
    out.innerHTML = `<p class="err">${esc(err.message || 'Something went wrong. Please try again.')}</p>`;
  }
});
