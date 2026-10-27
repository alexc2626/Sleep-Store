const id = new URLSearchParams(location.search).get('order') || '';
document.getElementById('orderId').textContent = id.replace(/[^A-Z0-9-]/gi, '');
