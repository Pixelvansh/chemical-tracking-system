// ================================================
// ChemTrack India — Exporter Dashboard JS
// ================================================

const session = JSON.parse(localStorage.getItem('chemtrack_session') || '{}');
let capturedGPS = null;

// ── SECTION SWITCH ──
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
 else {
    sidebar.style.width = '0px'; main.style.marginLeft = '0';
  }
}

function exporterLogout() {
  if (confirm('Logout from ChemTrack?')) {
    localStorage.removeItem('chemtrack_session');
    window.location.href = 'login.html';
  }
}

// ── DATA HELPERS ──
function getExports()        { return JSON.parse(localStorage.getItem('exp_dispatches_' + session.id) || '[]'); }
function saveExports(d)      { localStorage.setItem('exp_dispatches_' + session.id, JSON.stringify(d)); }
function getInventory()      { return JSON.parse(localStorage.getItem('exp_inventory_' + session.id) || '[]'); }
function saveInventory(d)    { localStorage.setItem('exp_inventory_' + session.id, JSON.stringify(d)); }
function getFullUserData()   {
  return (JSON.parse(localStorage.getItem('chemtrack_users') || '[]')).find(u => u.email === session.email) || {};
}
function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
}
function statusBadge(s) {
  return '<span class="status-badge ' + s + '">' + s.replace(/_/g,' ').toUpperCase() + '</span>';
}

// ── INIT ──
document.addEventListener('DOMContentLoaded', initDashboard);

function initDashboard() {
  const u = getFullUserData();
  const name = session.companyName || session.name || 'Exporter';

  const e = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  e('nav-company-name', name);
  e('sidebar-urn', 'URN: ' + (session.urn || u.urn || 'N/A'));
  e('welcome-msg', 'Welcome, ' + name);
  e('welcome-sub', 'NCB Approved Exporter — ' + (session.state || u.state || '') + ' | IEC: ' + (u.iecCode || 'N/A'));

  const iecEl = document.getElementById('ex-iec');
  if (iecEl && u.iecCode) iecEl.value = u.iecCode;
  const dgftEl = document.getElementById('ex-dgft');
  if (dgftEl && u.dgft) dgftEl.value = u.dgft;

  const dateEl = document.getElementById('ex-date');
  if (dateEl) {
    const d = new Date(); d.setDate(d.getDate() + 1);
    dateEl.value = d.toISOString().split('T')[0];
  }

  loadStats(); loadRecentExports(); loadInventoryTable();
  loadExportLog(); loadQRTable(); loadProfile(u);
}

// ── STATS ──
function loadStats() {
  const exports   = getExports();
  const inventory = getInventory();
  const totalStock    = inventory.reduce((s, i) => s + Number(i.qty || 0), 0);
  const totalExported = exports.reduce((s, e) => s + Number(e.qty || 0), 0);
  const countries = [...new Set(exports.map(e => e.country).filter(Boolean))].length;
  const pending   = exports.filter(e => e.status === 'pending').length;

  const sv = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  sv('stat-stock',     totalStock.toLocaleString('en-IN'));
  sv('stat-exported',  totalExported.toLocaleString('en-IN'));
  sv('stat-countries', countries);
  sv('stat-pending',   pending);

  const badge = document.getElementById('badge-export');
  if (badge) { badge.textContent = pending; badge.style.display = pending > 0 ? 'flex' : 'none'; }
  const cb = document.getElementById('comp-blockchain');
  if (cb) cb.textContent = exports.length + ' entries';
}

// ── RECENT EXPORTS ──
function loadRecentExports() {
  const tbody = document.getElementById('recent-export-tbody');
  if (!tbody) return;
  const exports = getExports();
  if (!exports.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-td">No exports yet.</td></tr>'; return;
  }
  tbody.innerHTML = [...exports]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 6)
    .map(e =>
      '<tr>' +
      '<td><code style="font-size:0.75rem;background:#f0f4ff;color:#132C54;padding:2px 6px;border-radius:4px">' + e.exportId + '</code></td>' +
      '<td>' + e.material + '</td>' +
      '<td>' + Number(e.qty).toLocaleString('en-IN') + ' kg</td>' +
      '<td>🌍 ' + (e.country || '—') + '</td>' +
      '<td>⚓ ' + (e.port || '—') + '</td>' +
      '<td>' + formatDate(e.createdAt) + '</td>' +
      '<td>' + statusBadge(e.status) + '</td>' +
      '</tr>'
    ).join('');
}

// ── INVENTORY TABLE ──
function loadInventoryTable() {
  const tbody = document.getElementById('inventory-tbody');
  if (!tbody) return;
  const inv = getInventory();
  if (!inv.length) { tbody.innerHTML = '<tr><td colspan="7" class="empty-td">No inventory added yet.</td></tr>'; return; }
  tbody.innerHTML = inv.map((item, i) =>
    '<tr>' +
    '<td>' + (i + 1) + '</td>' +
    '<td><strong>' + item.material + '</strong></td>' +
    '<td>' + Number(item.qty).toLocaleString('en-IN') + ' kg</td>' +
    '<td>₹' + (item.price ? Number(item.price).toLocaleString('en-IN') : '—') + '</td>' +
    '<td><code style="font-size:0.75rem">' + (item.permit || 'N/A') + '</code></td>' +
    '<td>' + formatDate(item.addedAt) + '</td>' +
    '<td><button onclick="deleteStock(' + i + ')" style="background:none;border:none;cursor:pointer;color:var(--red)">🗑 Remove</button></td>' +
    '</tr>'
  ).join('');
}

// ── EXPORT LOG ──
function loadExportLog(countryFilter, statusFilter) {
  const tbody = document.getElementById('export-log-tbody');
  if (!tbody) return;
  let exports = getExports();
  if (countryFilter && countryFilter !== 'all') exports = exports.filter(e => e.country === countryFilter);
  if (statusFilter  && statusFilter  !== 'all') exports = exports.filter(e => e.status  === statusFilter);

  if (!exports.length) {
    tbody.innerHTML = '<tr><td colspan="10" class="empty-td">No export records found.</td></tr>';
    loadCountrySummary([]); return;
  }
  tbody.innerHTML = [...exports]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((e, i) =>
      '<tr>' +
      '<td>' + (i + 1) + '</td>' +
      '<td><code style="font-size:0.72rem;background:#f0f4ff;color:#132C54;padding:2px 5px;border-radius:3px">' + e.exportId + '</code></td>' +
      '<td>' + e.material + '</td>' +
      '<td>' + Number(e.qty).toLocaleString('en-IN') + ' kg</td>' +
      '<td>🌍 ' + (e.country || '—') + '</td>' +
      '<td>' + (e.port || '—') + '</td>' +
      '<td><code style="font-size:0.72rem">' + (e.dgft || '—') + '</code></td>' +
      '<td>' + formatDate(e.createdAt) + '</td>' +
      '<td>' + statusBadge(e.status) + '</td>' +
      '<td><button onclick="showChain(\'' + e.exportId + '\')" style="background:none;border:1px solid var(--navy);color:var(--navy);padding:3px 8px;border-radius:4px;font-size:0.75rem;cursor:pointer">View QR</button></td>' +
      '</tr>'
    ).join('');

  loadCountrySummary(getExports());
}

function loadCountrySummary(exports) {
  const tbody = document.getElementById('country-summary-tbody');
  if (!tbody) return;
  if (!exports.length) { tbody.innerHTML = '<tr><td colspan="4" class="empty-td">No exports recorded yet.</td></tr>'; return; }
  const map = {};
  exports.forEach(e => {
    const c = e.country || 'Unknown';
    if (!map[c]) map[c] = { count: 0, qty: 0, last: null };
    map[c].count++;
    map[c].qty += Number(e.qty || 0);
    if (!map[c].last || new Date(e.createdAt) > new Date(map[c].last)) map[c].last = e.createdAt;
  });
  tbody.innerHTML = Object.entries(map)
    .sort((a, b) => b[1].qty - a[1].qty)
    .map(([country, d]) =>
      '<tr><td>🌍 <strong>' + country + '</strong></td><td>' + d.count + '</td>' +
      '<td>' + d.qty.toLocaleString('en-IN') + ' kg</td><td>' + formatDate(d.last) + '</td></tr>'
    ).join('');
}

function filterExportLog(val)    { loadExportLog(val, null); }
function filterExportStatus(val) { loadExportLog(null, val); }
function searchExportLog(q) {
  const filtered = getExports().filter(e =>
    (e.material || '').toLowerCase().includes(q.toLowerCase()) ||
    (e.country  || '').toLowerCase().includes(q.toLowerCase()) ||
    (e.exportId || '').toLowerCase().includes(q.toLowerCase())
  );
  const tbody = document.getElementById('export-log-tbody');
  if (!filtered.length) { tbody.innerHTML = '<tr><td colspan="10" class="empty-td">No results found.</td></tr>'; return; }
  loadExportLog();
}

// ── QR TABLE ──
function loadQRTable() {
  const tbody = document.getElementById('qr-tbody');
  if (!tbody) return;
  const exports = getExports();
  if (!exports.length) { tbody.innerHTML = '<tr><td colspan="7" class="empty-td">No QR codes generated yet.</td></tr>'; return; }
  tbody.innerHTML = exports.map(e =>
    '<tr>' +
    '<td><code style="font-size:0.72rem;background:#f0f4ff;color:#132C54;padding:2px 6px;border-radius:4px">' + e.exportId + '</code></td>' +
    '<td>' + e.material + '</td>' +
    '<td>' + Number(e.qty).toLocaleString('en-IN') + ' kg</td>' +
    '<td>🌍 ' + (e.country || '—') + '</td>' +
    '<td>' + formatDate(e.createdAt) + '</td>' +
    '<td>' + statusBadge(e.status) + '</td>' +
    '<td style="display:flex;gap:6px">' +
    '<button onclick="showChain(\'' + e.exportId + '\')" style="background:var(--navy);color:#fff;border:none;padding:4px 10px;border-radius:4px;font-size:0.75rem;cursor:pointer">📋 Chain</button>' +
    '<button onclick="printQR(\'' + e.exportId + '\')" style="background:var(--orange);color:#fff;border:none;padding:4px 10px;border-radius:4px;font-size:0.75rem;cursor:pointer">🖨️ Print</button>' +
    '</td></tr>'
  ).join('');
}

// ── GPS ──
function captureGPS() {
  const el = document.getElementById('gps-status');
  if (!navigator.geolocation) { if (el) el.textContent = '⚠️ Geolocation not supported'; return; }
  if (el) el.textContent = '📡 Capturing GPS...';
  navigator.geolocation.getCurrentPosition(
    pos => {
      capturedGPS = { lat: pos.coords.latitude.toFixed(6), lng: pos.coords.longitude.toFixed(6) };
      if (el) el.textContent = '✅ GPS: ' + capturedGPS.lat + ', ' + capturedGPS.lng;
      showToast('📍 GPS captured!', 'success');
    },
    () => {
      capturedGPS = { lat: 28.6139, lng: 77.2090 };
      if (el) el.textContent = '📍 GPS (fallback Delhi): ' + capturedGPS.lat + ', ' + capturedGPS.lng;
    }
  );
}

// ── SUBMIT EXPORT ──
function submitExport() {
  const get   = id => (document.getElementById(id)?.value || '').trim();
  const alertEl = document.getElementById('export-alert');
  const err   = msg => { if (alertEl) { alertEl.textContent = msg; alertEl.className = 'alert alert-error show'; } };
  const clear = () => { if (alertEl) alertEl.className = 'alert'; };
  clear();

  const material  = get('ex-material');
  const qty       = get('ex-qty');
  const chemicals = get('ex-chemicals');
  const country   = get('ex-country');
  const importer  = get('ex-importer');
  const importLic = get('ex-import-license');
  const iec       = get('ex-iec');
  const dgft      = get('ex-dgft');
  const shipping  = get('ex-shipping');
  const bol       = get('ex-bol');
  const port      = get('ex-port');
  const date      = get('ex-date');
  const remarks   = get('ex-remarks');

  if (!material)                         { err('⚠️ Chemical / Material name is required.'); return; }
  if (!qty || isNaN(qty) || Number(qty) <= 0) { err('⚠️ Please enter a valid quantity.'); return; }
  if (!country)                          { err('⚠️ Please select a destination country.'); return; }
  if (!importer)                         { err('⚠️ Importing firm name is required.'); return; }
  if (!iec)                              { err('⚠️ IEC Code is required.'); return; }
  if (!dgft)                             { err('⚠️ DGFT NOC Number is required.'); return; }
  if (!port)                             { err('⚠️ Please select a port of export.'); return; }
  if (!date)                             { err('⚠️ Please select an expected export date.'); return; }

  if (!capturedGPS) capturedGPS = { lat: 28.6139, lng: 77.2090 };

  const exportId = 'EXP-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substr(2,5).toUpperCase();
  const gpsStr   = capturedGPS.lat + ', ' + capturedGPS.lng;

  const entry = {
    exportId, material, qty: Number(qty), chemicals, country,
    importer, importLicense: importLic, iec, dgft, port,
    exportDate: date, shipping, bol, remarks,
    gps: gpsStr,
    fromParty: session.companyName || session.name,
    status: 'pending',
    createdAt: new Date().toISOString()
  };

  const exports = getExports();
  exports.push(entry);
  saveExports(exports);

  // Save to global blockchain chain
  const chain = JSON.parse(localStorage.getItem('chemtrack_chain') || '[]');
  chain.push({
    barcodeId: exportId, parentId: null, rootId: exportId,
    level: 5, role: 'exporter',
    qty: Number(qty), remainingQty: Number(qty),
    material, chemicals,
    fromParty: session.companyName || session.name,
    fromRole: 'exporter', toParty: importer,
    toRole: 'foreign_importer',
    country, port, iec, dgft,
    gpsOrigin: gpsStr, gpsCurrent: gpsStr,
    status: 'pending',
    createdAt: new Date().toISOString(),
    chain: [{ event: 'EXPORT_DISPATCH', actor: session.companyName || session.name, role: 'exporter', qty: Number(qty), gps: gpsStr, ts: new Date().toISOString() }]
  });
  localStorage.setItem('chemtrack_chain', JSON.stringify(chain));

  // Show QR result
  const panel = document.getElementById('qr-result-panel');
  if (panel) {
    panel.style.display = 'block';
    document.getElementById('qr-result-id').textContent       = exportId;
    document.getElementById('qr-result-material').textContent = material + ' (' + qty + ' kg)';
    document.getElementById('qr-result-country').textContent  = '🌍 ' + country + ' via ' + port;
    document.getElementById('qr-result-gps').textContent      = gpsStr;

    const canvas = document.getElementById('qr-result-canvas');
    canvas.innerHTML = '';
    if (typeof QRCode !== 'undefined') {
      new QRCode(canvas, {
        text: JSON.stringify({ exportId, material, qty: Number(qty), country, iec, dgft, port, gps: gpsStr }),
        width: 150, height: 150
      });
    }
    panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  if (alertEl) { alertEl.textContent = '✅ Export dispatch submitted! QR generated. NCB + DGFT + Customs auto-notified.'; alertEl.className = 'alert alert-success show'; }

  loadStats(); loadRecentExports(); loadExportLog(); loadQRTable();
  capturedGPS = null;
  showToast('✅ Export created: ' + exportId, 'success');
}

function clearExportForm() {
  ['ex-material','ex-qty','ex-chemicals','ex-importer','ex-import-license','ex-shipping','ex-bol','ex-remarks']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  ['ex-country','ex-port'].forEach(id => { const el = document.getElementById(id); if (el) el.selectedIndex = 0; });
  capturedGPS = null;
  const g = document.getElementById('gps-status'); if (g) g.textContent = 'GPS will be captured automatically at dispatch';
  const p = document.getElementById('qr-result-panel'); if (p) p.style.display = 'none';
  const a = document.getElementById('export-alert'); if (a) a.className = 'alert';
}

// ── SHOW CHAIN MODAL ──
function showChain(exportId) {
  const chain = JSON.parse(localStorage.getItem('chemtrack_chain') || '[]');
  const entry = chain.find(c => c.barcodeId === exportId);

  document.getElementById('chain-modal-id').textContent       = exportId;
  document.getElementById('chain-modal-material').textContent = entry ? entry.material + ' | ' + entry.qty + ' kg → ' + (entry.country || 'Export') : '—';

  const qrDiv = document.getElementById('chain-modal-qr');
  qrDiv.innerHTML = '';
  if (typeof QRCode !== 'undefined') {
    new QRCode(qrDiv, { text: exportId, width: 140, height: 140 });
  }

  const body = document.getElementById('chain-modal-body');
  if (!entry) {
    body.innerHTML = '<p style="color:var(--gray);text-align:center;padding:1rem">Chain data not found.</p>';
  } else {
    const events = entry.chain || [{ event: 'EXPORT_DISPATCH', ts: entry.createdAt, actor: entry.fromParty, gps: entry.gpsOrigin }];
    body.innerHTML =
      '<div style="margin-top:1rem">' +
      '<h4 style="font-size:0.9rem;color:var(--navy);margin-bottom:1rem">🔗 Blockchain Audit Trail</h4>' +
      events.map((ev, i) =>
        '<div style="display:flex;gap:12px;margin-bottom:1rem;padding:10px;background:' + (i%2===0 ? '#f8faff' : '#fff') + ';border-radius:8px;border-left:3px solid var(--navy)">' +
        '<div style="font-size:1.2rem">' + (i === 0 ? '🏭' : '✈️') + '</div>' +
        '<div style="flex:1">' +
        '<p style="margin:0;font-size:0.82rem;font-weight:700;color:var(--navy)">' + ev.event + '</p>' +
        '<p style="margin:2px 0;font-size:0.78rem;color:var(--gray)">Actor: ' + (ev.actor || '—') + ' | GPS: ' + (ev.gps || '—') + '</p>' +
        '<p style="margin:0;font-size:0.75rem;color:var(--gray)">' + new Date(ev.ts).toLocaleString('en-IN') + '</p>' +
        '</div></div>'
      ).join('') +
      '</div>';
  }

  document.getElementById('chain-modal').classList.add('show');
}

// ── SCAN QR ──
function scanQR() {
  const input  = document.getElementById('scan-input')?.value.trim();
  const result = document.getElementById('scan-result');
  if (!input || !result) return;
  const chain = JSON.parse(localStorage.getItem('chemtrack_chain') || '[]');
  const entry = chain.find(c => c.barcodeId === input);
  if (!entry) {
    result.innerHTML = '<div style="padding:1rem;background:rgba(192,57,43,0.08);border-left:3px solid var(--red);border-radius:6px;color:var(--red)">❌ No record found for: <strong>' + input + '</strong></div>';
    return;
  }
  result.innerHTML =
    '<div style="padding:1rem;background:rgba(51,122,18,0.08);border-left:3px solid var(--green);border-radius:8px">' +
    '<h4 style="color:var(--green);margin:0 0 0.8rem">✅ Export Record Verified</h4>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;font-size:0.85rem">' +
    '<p><strong>Export ID:</strong> ' + entry.barcodeId + '</p>' +
    '<p><strong>Material:</strong> ' + entry.material + '</p>' +
    '<p><strong>Quantity:</strong> ' + entry.qty + ' kg</p>' +
    '<p><strong>Destination:</strong> 🌍 ' + (entry.country || '—') + '</p>' +
    '<p><strong>Port:</strong> ' + (entry.port || '—') + '</p>' +
    '<p><strong>IEC Code:</strong> ' + (entry.iec || '—') + '</p>' +
    '<p><strong>DGFT NOC:</strong> ' + (entry.dgft || '—') + '</p>' +
    '<p><strong>GPS:</strong> ' + (entry.gpsOrigin || '—') + '</p>' +
    '<p><strong>Status:</strong> ' + entry.status.toUpperCase() + '</p>' +
    '<p><strong>Created:</strong> ' + new Date(entry.createdAt).toLocaleString('en-IN') + '</p>' +
    '</div>' +
    '<p style="margin-top:0.8rem;font-size:0.78rem;color:var(--gray)">🔒 Blockchain verified — tamper-proof record</p>' +
    '</div>';
}

// ── INVENTORY MODAL ──
function openAddStock() {
  ['stock-material','stock-qty','stock-price','stock-permit'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const a = document.getElementById('stock-alert'); if (a) a.className = 'alert';
  document.getElementById('stock-modal').classList.add('show');
}

function saveStock() {
  const material = document.getElementById('stock-material')?.value.trim();
  const qty      = document.getElementById('stock-qty')?.value.trim();
  const price    = document.getElementById('stock-price')?.value.trim();
  const permit   = document.getElementById('stock-permit')?.value.trim();
  const alertEl  = document.getElementById('stock-alert');

  if (!material) { if (alertEl) { alertEl.textContent = '⚠️ Chemical name required.'; alertEl.className = 'alert alert-error show'; } return; }
  if (!qty || isNaN(qty) || Number(qty) <= 0) { if (alertEl) { alertEl.textContent = '⚠️ Enter valid quantity.'; alertEl.className = 'alert alert-error show'; } return; }

  const inv = getInventory();
  inv.push({ material, qty: Number(qty), price: price ? Number(price) : null, permit: permit || '', addedAt: new Date().toISOString() });
  saveInventory(inv);
  loadInventoryTable(); loadStats();
  closeModal('stock-modal');
  showToast('📦 Stock added: ' + material + ' — ' + qty + ' kg', 'success');
}

function deleteStock(index) {
  if (!confirm('Remove this stock entry?')) return;
  const inv = getInventory();
  inv.splice(index, 1);
  saveInventory(inv);
  loadInventoryTable(); loadStats();
  showToast('🗑 Stock entry removed.', 'info');
}

// ── PRINT QR ──
function printQR(exportId) {
  const w = window.open('', '_blank');
  w.document.write(
    '<html><head><title>Export QR — ' + exportId + '</title>' +
    '<style>body{font-family:sans-serif;padding:2rem;text-align:center}h2{color:#132C54}</style></head><body>' +
    '<img src="../img/logo.png" style="height:50px;margin-bottom:1rem"/>' +
    '<h2>ChemTrack India — NCB Export QR</h2>' +
    '<p><strong>Export ID:</strong> ' + exportId + '</p>' +
    '<div id="pqr" style="display:flex;justify-content:center;margin:1rem 0"></div>' +
    '<p style="font-size:0.75rem;color:#888">Scan to verify | NCB Blockchain Secured | Ministry of Home Affairs</p>' +
    '<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"><\/script>' +
    '<script>new QRCode(document.getElementById("pqr"),{text:"' + exportId + '",width:220,height:220});setTimeout(()=>window.print(),800)<\/script>' +
    '</body></html>'
  );
}

// ── PROFILE ──
function loadProfile(u) {
  const s = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v || '—'; };
  s('prof-company',     u.companyName  || session.companyName);
  s('prof-company2',    u.companyName  || session.companyName);
  s('prof-email',       u.email        || session.email);
  s('prof-phone',       u.phone        || session.phone);
  s('prof-owner',       u.ownerName    || session.ownerName);
  s('prof-designation', u.designation  || session.designation);
  s('prof-state',       u.state        || session.state);
  s('prof-city',        u.city         || session.city);
  s('prof-gst',         u.gst          || session.gst);
  s('prof-urn',         u.urn          || session.urn);
  s('prof-pan',         u.pan          || session.pan);
  s('prof-iec',         u.iecCode);
  s('prof-dgft',        u.dgft);
  s('prof-countries',   u.exportCountries);
  s('prof-volume',      u.exportVolume ? u.exportVolume + ' kg/year' : null);
  s('prof-registered',  u.registeredAt ? formatDate(u.registeredAt) : null);
  s('prof-approved',    u.approvedAt   ? formatDate(u.approvedAt)   : null);
}

// ── MODAL & TOAST ──
function closeModal(id) { const el = document.getElementById(id); if (el) el.classList.remove('show'); }
function showToast(msg, type) {
  const t = document.getElementById('toast'); if (!t) return;
  t.textContent = msg;
  t.className = 'toast show' + (type ? ' ' + type : '');
  setTimeout(() => { t.className = 'toast'; }, 3500);
}