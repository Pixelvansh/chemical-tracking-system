// Auto-refresh every 5 seconds
setInterval(function(){
  loadStats();
  loadOrders();
  loadRecentDispatches();
}, 5000);

// ChemTrack India — Supplier Dashboard JS (Updated with barcode chain system)
const session = JSON.parse(localStorage.getItem('chemtrack_session') || '{}');

function showSection(name, el) {
  document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
  const sec = document.getElementById('section-' + name);
  if (sec) sec.classList.add('active');
  if (el) el.classList.add('active');
  return false;
}
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const main = document.querySelector('.dash-main');
  if (!sidebar) return;
  const isMobile = window.innerWidth <= 768;
  if (isMobile) {
    sidebar.classList.toggle('open');
    let overlay = document.getElementById('sidebar-overlay');
    if (sidebar.classList.contains('open')) {
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'sidebar-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:996;';
        overlay.onclick = () => { sidebar.classList.remove('open'); overlay.remove(); };
        document.body.appendChild(overlay);
      }
    } else { if (overlay) overlay.remove(); }
  } else {
    if (sidebar.style.width === '0px' || !sidebar.style.width) {
      sidebar.style.width = '240px';
      if (main) main.style.marginLeft = '240px';
    } else {
      sidebar.style.width = '0px';
      if (main) main.style.marginLeft = '0';
    }
  }
}
window.addEventListener('resize', () => {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (window.innerWidth > 768 && sidebar) {
    sidebar.classList.remove('open');
    if (overlay) overlay.remove();
  }
});

  else { sidebar.style.width = '0px'; main.style.marginLeft = '0'; }
}
function supplierLogout() {
  if (confirm('Logout?')) { localStorage.removeItem('chemtrack_session'); window.location.href = 'login.html'; }
}
function getDispatches() { return JSON.parse(localStorage.getItem('supplier_dispatches_' + session.id) || '[]'); }
function saveDispatches(d) { localStorage.setItem('supplier_dispatches_' + session.id, JSON.stringify(d)); }
function getInventory() { return JSON.parse(localStorage.getItem('supplier_inventory_' + session.id) || '[]'); }
function saveInventory(d) { localStorage.setItem('supplier_inventory_' + session.id, JSON.stringify(d)); }
function getFullUserData() {
  const users = JSON.parse(localStorage.getItem('chemtrack_users') || '[]');
  return users.find(u => u.email === session.email) || {};
}
function getManufacturerRequests() {
  const myEmail    = (session.email || '').toLowerCase().trim();
  // Session se saare possible name variants nikalo
  const fullUser   = JSON.parse(localStorage.getItem('chemtrack_users') || '[]')
                       .find(u => u && u.email === session.email) || {};
  const myCompany  = (session.companyName || session.name || fullUser.companyName || fullUser.name || '').toLowerCase().trim();

  return JSON.parse(localStorage.getItem('mfr_raw_requests') || '[]')
    .filter(r => {
      // Fulfilled/rejected — skip
      if (r.status === 'fulfilled' || r.status === 'rejected') return false;
      // Only pending/approved
      if (r.status !== 'pending' && r.status !== 'approved') return false;

      const assignedEmail   = (r.assignedSupplier || '').toLowerCase().trim();
      const assignedCompany = (r.supplierCompany  || '').toLowerCase().trim();

      // Koi assignment nahi — sab suppliers ko dikhao
      if (!assignedEmail && !assignedCompany) return true;
      // Email exact match
      if (assignedEmail && assignedEmail === myEmail) return true;
      // Company name — koi bhi partial match
      if (assignedCompany && myCompany) {
        if (assignedCompany === myCompany) return true;
        if (assignedCompany.includes(myCompany)) return true;
        if (myCompany.includes(assignedCompany)) return true;
        // Word-level match — "new supplier" mein "new" ya "supplier" match
        const words = myCompany.split(/\s+/);
        if (words.some(w => w.length > 2 && assignedCompany.includes(w))) return true;
      }
      return false;
    });
}
function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function statusBadge(s) { return `<span class="status-badge ${s}">${s.replace(/_/g,' ').toUpperCase()}</span>`; }

function initDashboard() {
  const fullUser = getFullUserData();
  const name = session.companyName || session.name || 'Supplier';
  const el1 = document.getElementById('nav-company-name'); if (el1) el1.textContent = name;
  const el2 = document.getElementById('sidebar-urn'); if (el2) el2.textContent = 'URN: ' + (session.urn || fullUser.urn || 'N/A');
  const el3 = document.getElementById('welcome-msg'); if (el3) el3.textContent = 'Welcome, ' + name;
  const el4 = document.getElementById('welcome-sub'); if (el4) el4.textContent = 'NCB Approved Supplier — ' + (session.state || fullUser.state || '');
  loadStats(); loadRecentDispatches(); loadInventory(); loadOrders(); loadHistory(); loadQRCodes(); loadProfile(fullUser);
  populateCityDropdown('d-city');
}

function populateCityDropdown(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = '<option value="">-- Select Dispatch City --</option>';
  Object.keys(CITY_GPS).forEach(city => { el.innerHTML += `<option value="${city}">${city}</option>`; });
}

function loadStats() {
  const dispatches = getDispatches(), inventory = getInventory(), requests = getManufacturerRequests();
  const totalStock = inventory.reduce((s, i) => s + Number(i.qty || 0), 0);
  const el1 = document.getElementById('stat-stock'); if (el1) el1.textContent = totalStock + ' kg';
  const el2 = document.getElementById('stat-dispatched'); if (el2) el2.textContent = dispatches.length;
  const el3 = document.getElementById('stat-orders'); if (el3) el3.textContent = requests.filter(r => r.status === 'pending' || r.status === 'approved').length;
  const el4 = document.getElementById('stat-completed'); if (el4) el4.textContent = dispatches.filter(d => d.status === 'delivered').length;
}

function loadRecentDispatches() {
  const tbody = document.getElementById('recent-dispatch-tbody');
  if (!tbody) return;
  const dispatches = getDispatches();
  if (!dispatches.length) { tbody.innerHTML = `<tr><td colspan="6" class="empty-td">No dispatches yet.</td></tr>`; return; }
  tbody.innerHTML = [...dispatches].reverse().slice(0, 5).map(d => `
    <tr>
      <td><code class="barcode-code">${d.barcodeId || d.dispatchId}</code></td>
      <td>${d.material}</td><td>${d.qty} kg</td>
      <td>${d.toParty || d.recipient}</td>
      <td>${formatDate(d.createdAt || d.date)}</td>
      <td>${statusBadge(d.status)}</td>
    </tr>`).join('');
}

function loadInventory() {
  const tbody = document.getElementById('inventory-tbody');
  if (!tbody) return;
  const inventory = getInventory();
  if (!inventory.length) { tbody.innerHTML = `<tr><td colspan="7" class="empty-td">No inventory added yet.</td></tr>`; return; }
  tbody.innerHTML = inventory.map((item, i) => `
    <tr>
      <td>${i+1}</td><td><strong>${item.material}</strong></td>
      <td>${item.qty} kg</td><td>₹${item.price || '—'}/kg</td>
      <td>${item.chemicals || '—'}</td><td>${formatDate(item.addedAt)}</td>
      <td><button class="btn-sm-red" onclick="removeStock(${i})">🗑 Remove</button></td>
    </tr>`).join('');
}

function openAddStock() {
  ['stock-material','stock-qty','stock-price','stock-chemicals'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  hideAlert('stock-alert');
  document.getElementById('stock-modal').classList.add('show');
}

function saveStock() {
  const material = document.getElementById('stock-material').value.trim();
  const qty = document.getElementById('stock-qty').value.trim();
  const price = document.getElementById('stock-price').value.trim();
  const chemicals = document.getElementById('stock-chemicals') ? document.getElementById('stock-chemicals').value.trim() : '';
  if (!material || !qty) { showAlertInline('stock-alert', '⚠️ Material and quantity required.', 'warning'); return; }
  const inventory = getInventory();
  inventory.push({ material, qty: Number(qty), price: price || '—', chemicals, addedAt: new Date().toISOString() });
  saveInventory(inventory);
  closeModal('stock-modal');
  showToast('✅ Stock added!', 'success');
  loadInventory(); loadStats();
}

function removeStock(i) {
  if (!confirm('Remove this stock?')) return;
  const inv = getInventory(); inv.splice(i, 1); saveInventory(inv);
  loadInventory(); loadStats(); showToast('🗑️ Removed.', 'info');
}

function loadOrders() {
  const tbody = document.getElementById('orders-tbody');
  if (!tbody) return;
  const requests = getManufacturerRequests();
  const pending = requests.filter(r => r.status === 'pending' || r.status === 'approved');
  if (!pending.length) { tbody.innerHTML = `<tr><td colspan="7" class="empty-td">No pending orders from manufacturers.</td></tr>`; return; }
  tbody.innerHTML = pending.map(r => `
    <tr>
      <td><strong>${r.requestId}</strong></td><td>${r.mfrCompany}</td>
      <td>${r.material}</td><td>${r.qty} kg</td>
      <td>${r.chemicals || '—'}</td><td>${formatDate(r.createdAt)}</td>
      <td>
        <button class="btn-sm btn-green" onclick="fulfillOrder('${r.requestId}')">✅ Fulfill</button>
        <button class="btn-sm btn-red" onclick="rejectOrder('${r.requestId}')">❌ Reject</button>
      </td>
    </tr>`).join('');
}

function fulfillOrder(requestId) {
  const requests = JSON.parse(localStorage.getItem('mfr_raw_requests') || '[]');
  const req = requests.find(r => r.requestId === requestId);
  if (!req) { showToast('Request not found.', 'error'); return; }
  const el1 = document.getElementById('d-material'); if (el1) el1.value = req.material;
  const el2 = document.getElementById('d-qty'); if (el2) el2.value = req.qty;
  const el3 = document.getElementById('d-recipient'); if (el3) el3.value = req.mfrCompany;
  const el4 = document.getElementById('d-recipient-urn'); if (el4) el4.value = req.mfrUrn || '';
  const el5 = document.getElementById('d-chemicals'); if (el5) el5.value = req.chemicals || '';
  const el6 = document.getElementById('d-order-ref'); if (el6) el6.value = requestId;
  document.getElementById('section-orders').classList.remove('active');
  document.getElementById('section-dispatch').classList.add('active');
  document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
  showToast('📋 Order details pre-filled. Complete dispatch form.', 'info');
}

function rejectOrder(requestId) {
  if (!confirm('Reject this order?')) return;
  const requests = JSON.parse(localStorage.getItem('mfr_raw_requests') || '[]');
  const idx = requests.findIndex(r => r.requestId === requestId);
  if (idx !== -1) { requests[idx].status = 'rejected'; localStorage.setItem('mfr_raw_requests', JSON.stringify(requests)); }
  loadOrders(); loadStats(); showToast('Order rejected.', 'info');
}

let capturedGPS = null;

function captureGPS() {
  const city = document.getElementById('d-city') ? document.getElementById('d-city').value : '';
  if (city) {
    capturedGPS = getCityGPS(city);
    const s = document.getElementById('gps-status');
    if (s) { s.textContent = '✅ Location: ' + city; s.style.color = 'var(--green)'; }
    return;
  }
  const statusEl = document.getElementById('gps-status');
  if (statusEl) statusEl.textContent = '📡 Capturing GPS...';
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => {
        capturedGPS = { lat: pos.coords.latitude.toFixed(4), lng: pos.coords.longitude.toFixed(4), city: 'GPS Location' };
        if (statusEl) { statusEl.textContent = '✅ GPS: ' + capturedGPS.lat + '°N, ' + capturedGPS.lng + '°E'; statusEl.style.color = 'var(--green)'; }
      },
      () => { if (statusEl) { statusEl.textContent = '⚠️ Select a city above for location.'; statusEl.style.color = 'var(--orange)'; } }
    );
  }
}

function submitDispatch() {
  const material = document.getElementById('d-material').value.trim();
  const qty = document.getElementById('d-qty').value.trim();
  const chemicals = document.getElementById('d-chemicals') ? document.getElementById('d-chemicals').value.trim() : '';
  const recipient = document.getElementById('d-recipient').value.trim();
  const recipientUrn = document.getElementById('d-recipient-urn').value.trim();
  const vehicle = document.getElementById('d-vehicle').value.trim();
  const driver = document.getElementById('d-driver').value.trim();
  const permit = document.getElementById('d-permit').value.trim();
  const remarks = document.getElementById('d-remarks').value.trim();
  const city = document.getElementById('d-city') ? document.getElementById('d-city').value : '';
  const orderRef = document.getElementById('d-order-ref') ? document.getElementById('d-order-ref').value.trim() : '';

  if (!material || !qty || !recipient || !recipientUrn || !vehicle) {
    showAlertInline('dispatch-alert', '⚠️ Fill all required fields: Material, Qty, Recipient, URN, Vehicle.', 'warning'); return;
  }

  const gpsData = capturedGPS || (city ? getCityGPS(city) : null);

  const barcode = createRootBarcode({
    material, chemicals, qty: Number(qty),
    fromParty: session.companyName || session.name || 'Supplier',
    fromRole: 'supplier', toParty: recipient, toRole: 'manufacturer',
    supplierUrn: session.urn || '', vehicle, driver, permit, remarks, gps: gpsData
  });

  const dispatches = getDispatches();
  dispatches.push(Object.assign({}, barcode, { dispatchId: barcode.barcodeId, recipient, date: barcode.createdAt }));
  saveDispatches(dispatches);

  const inv = getInventory();
  const iIdx = inv.findIndex(i => i.material.toLowerCase() === material.toLowerCase());
  if (iIdx !== -1) { inv[iIdx].qty = Math.max(0, inv[iIdx].qty - Number(qty)); saveInventory(inv); }

  if (orderRef) {
    const requests = JSON.parse(localStorage.getItem('mfr_raw_requests') || '[]');
    const rIdx = requests.findIndex(r => r.requestId === orderRef);
    if (rIdx !== -1) { requests[rIdx].status = 'fulfilled'; requests[rIdx].barcodeId = barcode.barcodeId; }
    localStorage.setItem('mfr_raw_requests', JSON.stringify(requests));
  }

  showAlertInline('dispatch-alert',
    '✅ Dispatched! Barcode ID: <strong>' + barcode.barcodeId + '</strong> — QR Generated. Chain recorded.',
    'success');

  showDispatchedQR(barcode);
  clearDispatchForm();
  loadStats(); loadRecentDispatches(); loadHistory(); loadQRCodes();
  showToast('🚚 Material dispatched! QR generated.', 'success');
}

function showDispatchedQR(barcode) {
  const panel = document.getElementById('qr-result-panel');
  if (!panel) return;
  panel.style.display = 'block';
  const el1 = document.getElementById('qr-result-id'); if (el1) el1.textContent = barcode.barcodeId;
  const el2 = document.getElementById('qr-result-material'); if (el2) el2.textContent = barcode.material + ' — ' + barcode.qty + ' kg';
  const el3 = document.getElementById('qr-result-to'); if (el3) el3.textContent = barcode.toParty;
  const el4 = document.getElementById('qr-result-gps'); if (el4) el4.textContent = gpsLabel(barcode.gpsOrigin);
  renderQR('qr-result-canvas', barcode.barcodeId, 160);
}

function clearDispatchForm() {
  ['d-material','d-qty','d-chemicals','d-recipient','d-recipient-urn','d-vehicle','d-driver','d-delivery-date','d-permit','d-remarks','d-order-ref']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  capturedGPS = null;
  const s = document.getElementById('gps-status');
  if (s) { s.textContent = 'Select city or capture GPS'; s.style.color = ''; }
  const panel = document.getElementById('qr-result-panel');
  if (panel) panel.style.display = 'none';
}

function loadHistory() {
  const tbody = document.getElementById('history-tbody');
  if (!tbody) return;
  const dispatches = getDispatches();
  if (!dispatches.length) { tbody.innerHTML = `<tr><td colspan="8" class="empty-td">No dispatch history yet.</td></tr>`; return; }
  tbody.innerHTML = [...dispatches].reverse().map((d, i) => `
    <tr>
      <td>${i+1}</td>
      <td><code class="barcode-code">${d.barcodeId || d.dispatchId}</code></td>
      <td>${d.material}</td><td>${d.qty} kg</td>
      <td>${d.toParty || d.recipient}</td><td>${d.vehicle || '—'}</td>
      <td>${formatDate(d.createdAt || d.date)}</td>
      <td>${statusBadge(d.status)}</td>
    </tr>`).join('');
}

function loadQRCodes() {
  const container = document.getElementById('qr-cards-grid');
  if (!container) return;
  const dispatches = getDispatches();
  if (!dispatches.length) {
    container.innerHTML = '<div class="empty-state"><span>🔲</span><p>No QR codes yet. Dispatch material to generate QR.</p></div>'; return;
  }
  container.innerHTML = [...dispatches].reverse().map(d => {
    const bid = d.barcodeId || d.dispatchId;
    return `<div class="qr-card">
      <div class="qr-card-top"><div id="qr-mini-${bid}"></div></div>
      <div class="qr-card-info">
        <strong>${d.material}</strong><span>${d.qty} kg</span>
        <span class="barcode-small">→ ${d.toParty || d.recipient}</span>
        <code class="barcode-code-sm">${bid.slice(0,22)}...</code>
        <span>${statusBadge(d.status)}</span>
      </div>
      <div class="qr-card-actions">
        <button class="btn-sm" onclick="printQR('${bid}')">🖨 Print</button>
        <button class="btn-sm btn-blue" onclick="viewChainModal('${bid}')">🔗 Chain</button>
      </div>
    </div>`;
  }).join('');
  setTimeout(() => { dispatches.forEach(d => { const bid = d.barcodeId || d.dispatchId; renderQR('qr-mini-' + bid, bid, 100); }); }, 100);
}

function viewChainModal(barcodeId) {
  const entry = findBarcode(barcodeId);
  if (!entry) { showToast('Barcode not in chain yet.', 'warning'); return; }
  const tree = getTree(entry.rootId);
  let html = '<div class="chain-timeline">';
  entry.chain.forEach(step => {
    html += `<div class="chain-step">
      <div class="chain-dot"></div>
      <div class="chain-content">
        <strong>${step.event}</strong>
        <span>${step.by} (${step.role})</span>
        <span>${new Date(step.timestamp).toLocaleString('en-IN')}</span>
        <span>${step.note}</span>
        ${step.gps ? '<span>📍 ' + gpsLabel(step.gps) + '</span>' : ''}
      </div>
    </div>`;
  });
  html += '</div>';
  html += '<p style="margin-top:1rem;font-size:0.8rem;color:var(--gray)">Total chain barcodes for root: <strong>' + tree.length + '</strong></p>';
  const m1 = document.getElementById('chain-modal-id'); if (m1) m1.textContent = barcodeId;
  const m2 = document.getElementById('chain-modal-material'); if (m2) m2.textContent = entry.material + ' — ' + entry.qty + ' kg';
  const m3 = document.getElementById('chain-modal-body'); if (m3) m3.innerHTML = html;
  renderQR('chain-modal-qr', barcodeId, 120);
  document.getElementById('chain-modal').classList.add('show');
}

function scanQR() {
  const val = document.getElementById('scan-input') ? document.getElementById('scan-input').value.trim() : '';
  if (!val) { showToast('Enter a barcode ID.', 'warning'); return; }
  const entry = findBarcode(val);
  const result = document.getElementById('scan-result');
  if (!entry) { result.innerHTML = '<div class="alert alert-error show">❌ Barcode not found: ' + val + '</div>'; return; }
  result.innerHTML = `<div class="scan-found">
    <h4>✅ Barcode Found</h4>
    <table class="detail-table">
      <tr><td>Barcode ID</td><td><code>${entry.barcodeId}</code></td></tr>
      <tr><td>Material</td><td>${entry.material}</td></tr>
      <tr><td>Qty</td><td>${entry.qty} kg</td></tr>
      <tr><td>Remaining</td><td>${entry.remainingQty} kg</td></tr>
      <tr><td>From</td><td>${entry.fromParty}</td></tr>
      <tr><td>To</td><td>${entry.toParty}</td></tr>
      <tr><td>Status</td><td>${statusBadge(entry.status)}</td></tr>
      <tr><td>GPS Origin</td><td>📍 ${gpsLabel(entry.gpsOrigin)}</td></tr>
    </table>
    <button class="btn-sm btn-blue" onclick="viewChainModal('${entry.barcodeId}')">🔗 View Full Chain</button>
  </div>`;
}

function loadProfile(fullUser) {
  const u = fullUser, s = session;
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v || '—'; };
  set('prof-company', s.companyName || u.companyName);
  set('prof-email', s.email); set('prof-phone', s.phone || u.phone);
  set('prof-owner', s.ownerName || u.ownerName); set('prof-designation', s.designation || u.designation);
  set('prof-state', s.state || u.state); set('prof-city', s.city || u.city);
  set('prof-gst', s.gst || u.gst); set('prof-urn', s.urn || u.urn);
  set('prof-pan', s.pan || u.pan); set('prof-wdl', u.wdlNumber);
  set('prof-materials', u.rawMaterials);
  set('prof-registered', formatDate(s.registeredAt || u.registeredAt));
  set('prof-approved', formatDate(s.approvedAt || u.approvedAt));
}

function closeModal(id) { const el = document.getElementById(id); if (el) el.classList.remove('show'); }
function showAlertInline(id, msg, type) {
  const el = document.getElementById(id); if (!el) return;
  el.innerHTML = msg; el.className = 'alert alert-' + type + ' show';
}
function hideAlert(id) { const el = document.getElementById(id); if (el) { el.className = 'alert'; el.textContent = ''; } }
function showToast(msg, type) {
  type = type || 'info';
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.className = 'toast ' + type;
  setTimeout(function() { t.classList.add('show'); }, 10);
  setTimeout(function() { t.classList.remove('show'); }, 3500);
}

document.addEventListener('DOMContentLoaded', initDashboard);