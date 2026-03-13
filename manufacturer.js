// Auto-refresh every 5 seconds
setInterval(function(){
  loadStats();
  loadDistributorOrders();
  loadRecentActivity();
}, 5000);

// ChemTrack India — Manufacturer Dashboard JS (Updated with Request System)
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
function mfrLogout() {
  if (confirm('Logout?')) { localStorage.removeItem('chemtrack_session'); window.location.href = 'login.html'; }
}
function getMfrDispatches() { return JSON.parse(localStorage.getItem('mfr_dispatches_' + session.id) || '[]'); }
function saveMfrDispatches(d) { localStorage.setItem('mfr_dispatches_' + session.id, JSON.stringify(d)); }
function getMyRawRequests() {
  return JSON.parse(localStorage.getItem('mfr_raw_requests') || '[]').filter(r => r.mfrEmail === session.email);
}
function getDistributorRequests() {
  const myName = session.companyName || session.name || '', myEmail = session.email || '';
  return getAllRequests().filter(r =>
    r.type === 'dist_request' && r.status === 'pending' &&
    (!r.toEmail || r.toEmail === myEmail || !r.toParty || r.toParty === myName)
  );
}
function getFullUserData() {
  return (JSON.parse(localStorage.getItem('chemtrack_users') || '[]')).find(u => u.email === session.email) || {};
}
function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function statusBadge(s) { return '<span class="status-badge ' + s + '">' + s.replace(/_/g,' ').toUpperCase() + '</span>'; }

function initDashboard() {
  const fullUser = getFullUserData(), name = session.companyName || session.name || 'Manufacturer';
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('nav-company-name', name); set('sidebar-urn', 'URN: ' + (session.urn || fullUser.urn || 'N/A'));
  set('welcome-msg', 'Welcome, ' + name); set('welcome-sub', 'NCB Approved Manufacturer — ' + (session.state || fullUser.state || ''));
  populateCityDropdowns();
  loadStats(); loadRecentActivity(); loadMyRawRequests(); loadReceivedRaw();
  loadDistributorOrders(); loadQRCodes(); loadHistory(); loadProfile(fullUser);
}

function populateCityDropdowns() {
  ['receive-city','mfr-city'].forEach(id => {
    const el = document.getElementById(id); if (!el) return;
    el.innerHTML = '<option value="">-- Select City --</option>';
    Object.keys(CITY_GPS).forEach(c => el.innerHTML += '<option value="' + c + '">' + c + '</option>');
  });
}

function loadStats() {
  const raw = getMyRawRequests(), dist = getDistributorRequests(), dispatches = getMfrDispatches();
  const distPending = dist.length;
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('stat-raw-pending', distPending); set('stat-raw-received', raw.filter(r => r.status === 'fulfilled').length);
  set('stat-manufactured', dispatches.length); set('stat-dispatched', dispatches.length);
  const b1 = document.getElementById('badge-dist-orders');
  if (b1) { b1.textContent = distPending; b1.style.display = distPending > 0 ? 'flex' : 'none'; }
  const pending = raw.filter(r => r.status === 'pending').length;
  const b2 = document.getElementById('badge-pending');
  if (b2) { b2.textContent = pending; b2.style.display = pending > 0 ? 'flex' : 'none'; }
}

function loadRecentActivity() {
  const tbody = document.getElementById('recent-tbody'); if (!tbody) return;
  const myEmail = session.email || '', myName = session.companyName || session.name || '';
  const all = [
    ...getMfrDispatches().map(d   => ({ id: d.barcodeId, type:'MFR→DIST',   material:d.material, qty:d.qty, party:d.toParty,              date:d.createdAt, status:d.status })),
    ...getMyRawRequests().map(r   => ({ id: r.requestId, type:'RAW REQ',    material:r.material, qty:r.qty, party:r.supplierCompany||'—',  date:r.createdAt, status:r.status })),
    ...getDistributorRequests().map(r => ({ id: r.requestId, type:'DIST ORDER', material:r.material, qty:r.qty, party:r.fromParty,          date:r.createdAt, status:r.status }))
  ];
  all.sort((a,b) => new Date(b.date) - new Date(a.date));
  if (!all.length) { tbody.innerHTML = '<tr><td colspan="7" class="empty-td">No activity yet.</td></tr>'; return; }
  tbody.innerHTML = all.slice(0,8).map(a =>
    '<tr><td><code class="barcode-code">' + a.id + '</code></td><td>' + a.type + '</td><td>' + a.material + '</td><td>' + a.qty + ' kg</td><td>' + a.party + '</td><td>' + formatDate(a.date) + '</td><td>' + statusBadge(a.status) + '</td></tr>'
  ).join('');
}

// ── RAW REQUEST (Manufacturer → Supplier) — existing logic preserved ──
function submitRawRequest() {
  const material = document.getElementById('req-material').value.trim();
  const qty = document.getElementById('req-qty').value.trim();
  const chemicals = document.getElementById('req-chemicals').value.trim();
  const supplier = document.getElementById('req-supplier').value.trim();
  const supplierEmail = document.getElementById('req-supplier-email').value.trim();
  if (!supplierEmail || !supplierEmail.includes('@')) {
    showAlert('req-alert', '⚠️ Supplier email required — enter supplier\'s registered email.', 'error');
    return;
  }
  const date = document.getElementById('req-date').value;
  const notes = document.getElementById('req-notes').value.trim();
  if (!material || !qty || !supplier || !chemicals) { showAlertInline('req-alert','⚠️ Fill Material, Qty, Chemical Components, and Supplier.','warning'); return; }
  const requestId = 'REQ-' + Date.now().toString(36).toUpperCase();
  const req = { requestId, material, qty:Number(qty), chemicals, mfrCompany:session.companyName||session.name, mfrEmail:session.email, mfrUrn:session.urn||'', assignedSupplier:supplierEmail, supplierCompany:supplier, requiredBy:date, notes, status:'pending', barcodeId:null, createdAt:new Date().toISOString() };
  const requests = JSON.parse(localStorage.getItem('mfr_raw_requests')||'[]');
  requests.push(req); localStorage.setItem('mfr_raw_requests', JSON.stringify(requests));
  showAlertInline('req-alert','✅ Request <strong>'+requestId+'</strong> sent to supplier!','success');
  ['req-material','req-qty','req-chemicals','req-supplier','req-supplier-email','req-date','req-notes'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
  loadMyRawRequests(); loadStats(); showToast('📤 Raw material request sent!','success');
}

function loadMyRawRequests() {
  const tbody = document.getElementById('my-requests-tbody'); if (!tbody) return;
  const requests = getMyRawRequests();
  if (!requests.length) { tbody.innerHTML = '<tr><td colspan="7" class="empty-td">No raw material requests yet.</td></tr>'; return; }
  tbody.innerHTML = [...requests].reverse().map(r =>
    '<tr><td><strong>'+r.requestId+'</strong></td><td>'+r.material+'</td><td>'+r.qty+' kg</td><td>'+(r.supplierCompany||'—')+'</td><td>'+statusBadge(r.status)+'</td><td>'+(r.barcodeId?'<code class="barcode-code-sm">'+r.barcodeId+'</code>':'—')+'</td><td>'+formatDate(r.createdAt)+'</td></tr>'
  ).join('');
}

// ── DISTRIBUTOR ORDERS ──
function loadDistributorOrders() {
  const tbody = document.getElementById('dist-orders-tbody'); if (!tbody) return;
  const myEmail = session.email||'', myName = session.companyName||session.name||'';
  const fullUser2 = JSON.parse(localStorage.getItem('chemtrack_users')||'[]').find(u=>u&&u.email===session.email)||{};
  const myName2 = (fullUser2.companyName||fullUser2.name||'').toLowerCase();
  const allDistReqs = getAllRequests().filter(r => {
    if(r.type !== 'dist_request') return false;
    if(r.status === 'rejected') return false;
    const te=(r.toEmail||'').toLowerCase(), tp=(r.toParty||'').toLowerCase();
    if(!te&&!tp) return true;
    if(te&&te===myEmail.toLowerCase()) return true;
    const mn=myName.toLowerCase(), mn2=myName2;
    if(tp&&(tp===mn||tp===mn2||mn.includes(tp)||tp.includes(mn)||mn2.includes(tp)||tp.includes(mn2))) return true;
    return false;
  });
  if (!allDistReqs.length) { tbody.innerHTML = '<tr><td colspan="7" class="empty-td">No orders from distributors yet.</td></tr>'; return; }
  tbody.innerHTML = [...allDistReqs].reverse().map(r => {
    let actions;
    if (r.status === 'pending')   actions = '<button class="btn-sm btn-green" onclick="acceptDistOrder(\''+r.requestId+'\')">✅ Accept</button> <button class="btn-sm btn-red" onclick="rejectDistOrder(\''+r.requestId+'\')">❌ Reject</button>';
    else if (r.status === 'accepted') actions = '<button class="btn-sm btn-blue" onclick="fulfillDistOrder(\''+r.requestId+'\')">⚗️ Fulfill</button>';
    else actions = statusBadge(r.status);
    return '<tr><td><strong>'+r.requestId+'</strong></td><td>'+r.fromParty+'</td><td>'+r.material+'</td><td>'+r.qty+' kg</td><td>'+(r.notes||'—')+'</td><td>'+formatDate(r.createdAt)+'</td><td>'+actions+'</td></tr>';
  }).join('');
}

function acceptDistOrder(requestId) {
  acceptRequest(requestId); loadDistributorOrders(); loadStats(); loadRecentActivity();
  showToast('✅ Order accepted! Ab Fulfill karo.','success');
}
function rejectDistOrder(requestId) {
  if (!confirm('Reject this order?')) return;
  rejectRequest(requestId,'Rejected by manufacturer.'); loadDistributorOrders(); loadStats();
  showToast('Order rejected.','info');
}
function fulfillDistOrder(requestId) {
  const req = getAllRequests().find(r => r.requestId === requestId); if (!req) return;
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
  set('mfr-dist-name', req.fromParty); set('mfr-dist-urn', req.fromUrn||'');
  set('mfr-qty', req.qty); set('mfr-dist-req-id', requestId);
  showSection('manufacture', null);
  document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
  showAlertInline('mfr-alert','📋 Distributor order pre-filled: <strong>'+req.fromParty+'</strong> — '+req.qty+' kg of <strong>'+req.material+'</strong>. Ab raw barcode load karo.','info');
  showToast('📋 Order pre-filled! Raw batch load karo.','info');
}

// ── RECEIVE RAW ──
let verifiedBarcodeForReceive = null;

function verifyReceiveBarcode() {
  const id = document.getElementById('receive-barcode-id').value.trim();
  if (!id) { showAlertInline('receive-alert','⚠️ Enter barcode ID.','warning'); return; }
  const entry = findBarcode(id);
  const resultDiv = document.getElementById('receive-verify-result');
  const formDiv   = document.getElementById('receive-confirm-form');
  if (!entry) { resultDiv.innerHTML='<div class="alert alert-error show">❌ Barcode not found: '+id+'</div>'; formDiv.style.display='none'; verifiedBarcodeForReceive=null; return; }
  if (entry.status !== 'dispatched') { resultDiv.innerHTML='<div class="alert alert-warning show">⚠️ Status is "'+entry.status+'". Must be dispatched.</div>'; formDiv.style.display='none'; verifiedBarcodeForReceive=null; return; }
  verifiedBarcodeForReceive = id;
  resultDiv.innerHTML = '<div class="scan-found"><h4>✅ Barcode Verified</h4><table class="detail-table"><tr><td>Material</td><td><strong>'+entry.material+'</strong></td></tr><tr><td>Qty</td><td>'+entry.qty+' kg</td></tr><tr><td>From Supplier</td><td>'+entry.fromParty+'</td></tr><tr><td>Chemicals</td><td>'+(entry.chemicals||'—')+'</td></tr><tr><td>GPS</td><td>📍 '+gpsLabel(entry.gpsOrigin)+'</td></tr></table></div>';
  formDiv.style.display = 'block';
  showAlertInline('receive-alert','✅ Barcode valid. Confirm receipt below.','success');
}

function confirmReceive() {
  if (!verifiedBarcodeForReceive) { showAlertInline('receive-alert','⚠️ Please verify a barcode first.','warning'); return; }
  const city = document.getElementById('receive-city').value;
  const gps  = city ? getCityGPS(city) : null;
  const result = receiveBarcode(verifiedBarcodeForReceive, session.companyName||session.name, 'manufacturer', gps);
  if (result.error) { showAlertInline('receive-alert','❌ '+result.error,'error'); return; }
  const rawReqs = JSON.parse(localStorage.getItem('mfr_raw_requests')||'[]');
  const rIdx = rawReqs.findIndex(r => r.barcodeId === verifiedBarcodeForReceive);
  if (rIdx !== -1) { rawReqs[rIdx].status='fulfilled'; localStorage.setItem('mfr_raw_requests', JSON.stringify(rawReqs)); }
  showAlertInline('receive-alert','✅ Receipt confirmed! '+verifiedBarcodeForReceive+' ab inventory mein hai.','success');
  document.getElementById('receive-confirm-form').style.display='none';
  verifiedBarcodeForReceive = null;
  loadReceivedRaw(); loadStats(); loadRecentActivity(); loadMyRawRequests();
  showToast('📦 Raw material received!','success');
}

function loadReceivedRaw() {
  const tbody = document.getElementById('received-tbody'); if (!tbody) return;
  const chain  = JSON.parse(localStorage.getItem('chemtrack_chain')||'[]');
  const myName = session.companyName||session.name;
  const received = chain.filter(b => b.toRole==='manufacturer' && b.status==='received' && b.toParty===myName);
  if (!received.length) { tbody.innerHTML='<tr><td colspan="8" class="empty-td">No raw materials received yet.</td></tr>'; return; }
  tbody.innerHTML = [...received].reverse().map(b =>
    '<tr><td><code class="barcode-code-sm">'+b.barcodeId+'</code></td><td>'+b.material+'</td><td>'+b.qty+' kg</td><td>'+b.fromParty+'</td><td>'+formatDate(b.receivedAt)+'</td><td>📍 '+gpsLabel(b.gpsCurrent)+'</td><td>'+statusBadge(b.status)+'</td><td><button class="btn-sm btn-blue" onclick="loadRawForMfrDirect(\''+b.barcodeId+'\')">⚗️ Manufacture</button></td></tr>'
  ).join('');
}

function loadRawForMfrDirect(barcodeId) {
  document.getElementById('mfr-raw-barcode').value = barcodeId;
  loadRawForMfr();
  showSection('manufacture', null);
  document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
}

// ── MANUFACTURE & DISPATCH ──
let currentRawForMfr = null;

function loadRawForMfr() {
  const id = document.getElementById('mfr-raw-barcode').value.trim();
  if (!id) { showAlertInline('mfr-alert','⚠️ Enter barcode ID.','warning'); return; }
  const entry = findBarcode(id);
  const infoDiv = document.getElementById('mfr-raw-info');
  const formDiv = document.getElementById('mfr-form');
  if (!entry) { infoDiv.innerHTML='<div class="alert alert-error show">❌ Barcode not found.</div>'; formDiv.style.display='none'; currentRawForMfr=null; return; }
  if (entry.status !== 'received') { infoDiv.innerHTML='<div class="alert alert-warning show">⚠️ Barcode must be "received". Current: '+entry.status+'</div>'; formDiv.style.display='none'; currentRawForMfr=null; return; }
  currentRawForMfr = id;
  infoDiv.innerHTML = '<div class="scan-found" style="margin-top:1rem"><h4>✅ Raw Material Loaded</h4><table class="detail-table"><tr><td>Barcode</td><td><code>'+entry.barcodeId+'</code></td></tr><tr><td>Material</td><td><strong>'+entry.material+'</strong></td></tr><tr><td>Available Qty</td><td>'+entry.qty+' kg</td></tr><tr><td>Chemicals</td><td>'+(entry.chemicals||'—')+'</td></tr><tr><td>From Supplier</td><td>'+entry.fromParty+'</td></tr></table></div>';
  formDiv.style.display = 'block';
  const qtyEl = document.getElementById('mfr-qty');       if (qtyEl && !qtyEl.value)   qtyEl.value   = entry.qty;
  const compEl = document.getElementById('mfr-composition'); if (compEl && !compEl.value) compEl.value = entry.chemicals||'';
  const qrDiv = document.getElementById('mfr-qr-result'); if (qrDiv) qrDiv.style.display='none';
  showAlertInline('mfr-alert','📦 Raw batch loaded. Fill product + distributor details aur dispatch karo.','info');
}

function submitManufacture() {
  if (!currentRawForMfr) { showAlertInline('mfr-alert','⚠️ Pehle raw batch load karo.','warning'); return; }
  const product   = document.getElementById('mfr-product').value.trim();
  const qty       = document.getElementById('mfr-qty').value.trim();
  const comp      = document.getElementById('mfr-composition').value.trim();
  const distName  = document.getElementById('mfr-dist-name').value.trim();
  const distUrn   = document.getElementById('mfr-dist-urn').value.trim();
  const vehicle   = document.getElementById('mfr-vehicle').value.trim();
  const driver    = document.getElementById('mfr-driver').value.trim();
  const permit    = document.getElementById('mfr-permit').value.trim();
  const city      = document.getElementById('mfr-city').value;
  const reqIdEl   = document.getElementById('mfr-dist-req-id');
  const linkedReqId = reqIdEl ? reqIdEl.value.trim() : '';
  if (!product||!qty||!distName||!vehicle) { showAlertInline('mfr-alert','⚠️ Product Name, Qty, Distributor Name, Vehicle — sab required.','warning'); return; }
  const gps = city ? getCityGPS(city) : null;
  const barcode = createManufacturedBarcode({ rawBarcodeId:currentRawForMfr, finishedMaterial:product, qty:Number(qty), chemicals:comp, fromParty:session.companyName||session.name, toParty:distName, toRole:'distributor', vehicle, driver, permit, gps });
  if (barcode.error) { showAlertInline('mfr-alert','❌ '+barcode.error,'error'); return; }
  if (linkedReqId) { linkRequestToBarcode(linkedReqId, barcode.barcodeId); if (reqIdEl) reqIdEl.value=''; }
  const dispatches = getMfrDispatches(); dispatches.push(Object.assign({}, barcode)); saveMfrDispatches(dispatches);
  const qrDiv = document.getElementById('mfr-qr-result'); if (qrDiv) qrDiv.style.display='block';
  const q = (id, v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
  q('mfr-qr-id', barcode.barcodeId); q('mfr-qr-product', barcode.material);
  q('mfr-qr-qty', barcode.qty); q('mfr-qr-to', barcode.toParty); q('mfr-qr-parent', barcode.parentId);
  renderQR('mfr-qr-canvas', barcode.barcodeId, 160);
  showAlertInline('mfr-alert','⚗️ Manufactured! Barcode: <strong>'+barcode.barcodeId+'</strong><br><strong>'+distName+'</strong> ko yeh barcode scan karke receive karna hoga — tab delivery confirmed hogi.','success');
  loadStats(); loadRecentActivity(); loadDistributorOrders(); loadQRCodes(); loadHistory();
  showToast('⚗️ Dispatched to ' + distName + '!','success');
  currentRawForMfr = null;
  ['mfr-product','mfr-dist-name','mfr-dist-urn','mfr-vehicle','mfr-driver','mfr-permit'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
  const mc = document.getElementById('mfr-city'); if (mc) mc.value='';
  document.getElementById('mfr-form').style.display='none';
  document.getElementById('mfr-raw-info').innerHTML='';
  document.getElementById('mfr-raw-barcode').value='';
}

function loadQRCodes() {
  const container = document.getElementById('qr-cards-grid'); if (!container) return;
  const dispatches = getMfrDispatches();
  if (!dispatches.length) { container.innerHTML='<div class="empty-state"><span>🔲</span><p>No QR codes yet.</p></div>'; return; }
  container.innerHTML = [...dispatches].reverse().map(d => {
    const bid = d.barcodeId;
    return '<div class="qr-card"><div class="qr-card-top"><div id="qr-mini-'+bid+'"></div></div><div class="qr-card-info"><strong>'+d.material+'</strong><span>'+d.qty+' kg</span><span class="barcode-small">→ '+d.toParty+'</span><code class="barcode-code-sm">'+bid.slice(0,22)+'...</code><span>'+statusBadge(d.status)+'</span></div><div class="qr-card-actions"><button class="btn-sm" onclick="printQR(\''+bid+'\')">🖨 Print</button><button class="btn-sm btn-blue" onclick="viewChainModal(\''+bid+'\')">🔗 Chain</button></div></div>';
  }).join('');
  setTimeout(() => dispatches.forEach(d => renderQR('qr-mini-'+d.barcodeId, d.barcodeId, 100)), 100);
}

function loadHistory() {
  const tbody = document.getElementById('history-tbody'); if (!tbody) return;
  const myEmail=session.email||'', myName=session.companyName||session.name||'';
  const distReqs = getAllRequests().filter(r => r.type==='dist_request' && (!r.toEmail||r.toEmail===myEmail||!r.toParty||r.toParty===myName));
  const rows = [
    ...getMyRawRequests().map(r  => ({ id:r.requestId, type:'RAW REQUEST',  material:r.material, qty:r.qty, party:r.supplierCompany||'—', date:r.createdAt, status:r.status })),
    ...getMfrDispatches().map(d  => ({ id:d.barcodeId, type:'MFR DISPATCH', material:d.material, qty:d.qty, party:d.toParty,             date:d.createdAt, status:d.status })),
    ...distReqs.map(r            => ({ id:r.requestId, type:'DIST ORDER',   material:r.material, qty:r.qty, party:r.fromParty,           date:r.createdAt, status:r.status }))
  ];
  rows.sort((a,b) => new Date(b.date) - new Date(a.date));
  if (!rows.length) { tbody.innerHTML='<tr><td colspan="8" class="empty-td">No history yet.</td></tr>'; return; }
  tbody.innerHTML = rows.map((r,i) =>
    '<tr><td>'+(i+1)+'</td><td><code class="barcode-code-sm">'+r.id+'</code></td><td>'+r.type+'</td><td>'+r.material+'</td><td>'+r.qty+' kg</td><td>'+r.party+'</td><td>'+formatDate(r.date)+'</td><td>'+statusBadge(r.status)+'</td></tr>'
  ).join('');
}

function scanQR() {
  const val = document.getElementById('scan-input')?.value.trim();
  if (!val) { showToast('Enter a barcode ID.','warning'); return; }
  const entry = findBarcode(val), result = document.getElementById('scan-result');
  if (!entry) { result.innerHTML='<div class="alert alert-error show">❌ Barcode not found: '+val+'</div>'; return; }
  result.innerHTML='<div class="scan-found"><h4>✅ Barcode Found</h4><table class="detail-table"><tr><td>Barcode ID</td><td><code>'+entry.barcodeId+'</code></td></tr><tr><td>Type</td><td>'+(entry.parentId?'Child (Parent: '+entry.parentId+')':'Root Barcode')+'</td></tr><tr><td>Material</td><td>'+entry.material+'</td></tr><tr><td>Qty</td><td>'+entry.qty+' kg</td></tr><tr><td>Remaining</td><td>'+entry.remainingQty+' kg</td></tr><tr><td>From</td><td>'+entry.fromParty+'</td></tr><tr><td>To</td><td>'+entry.toParty+'</td></tr><tr><td>Status</td><td>'+statusBadge(entry.status)+'</td></tr><tr><td>GPS</td><td>📍 '+gpsLabel(entry.gpsOrigin)+'</td></tr></table><button class="btn-sm btn-blue" onclick="viewChainModal(\''+entry.barcodeId+'\')">🔗 View Chain</button></div>';
}

function viewChainModal(barcodeId) {
  const entry = findBarcode(barcodeId); if (!entry) { showToast('Barcode not in chain.','warning'); return; }
  const tree = getTree(entry.rootId);
  let html = '<div class="chain-timeline">';
  entry.chain.forEach(step => {
    html += '<div class="chain-step"><div class="chain-dot"></div><div class="chain-content"><strong>'+step.event+'</strong><span>'+step.by+' ('+step.role+')</span><span>'+new Date(step.timestamp).toLocaleString('en-IN')+'</span><span>'+step.note+'</span>'+(step.gps?'<span>📍 '+gpsLabel(step.gps)+'</span>':'')+'</div></div>';
  });
  html += '</div><div style="margin-top:1rem"><strong>All chain barcodes:</strong><div style="display:flex;flex-wrap:wrap;gap:0.5rem;margin-top:0.5rem">'+tree.map(b=>'<code class="barcode-code-sm">'+b.barcodeId+' ('+b.qty+'kg '+b.status+')</code>').join('')+'</div></div>';
  const m = (id, v) => { const el=document.getElementById(id); if(el) el.innerHTML=v; };
  document.getElementById('chain-modal-id').textContent = barcodeId;
  document.getElementById('chain-modal-material').textContent = entry.material + ' — ' + entry.qty + ' kg';
  document.getElementById('chain-modal-body').innerHTML = html;
  renderQR('chain-modal-qr', barcodeId, 120);
  document.getElementById('chain-modal').classList.add('show');
}

function loadProfile(fullUser) {
  const u=fullUser, s=session, set=(id,v)=>{ const el=document.getElementById(id); if(el) el.textContent=v||'—'; };
  set('prof-company',s.companyName||u.companyName); set('prof-email',s.email);
  set('prof-phone',s.phone||u.phone); set('prof-owner',s.ownerName||u.ownerName);
  set('prof-state',s.state||u.state); set('prof-gst',s.gst||u.gst);
  set('prof-urn',s.urn||u.urn); set('prof-cbn',u.cbnLicense);
  set('prof-approved',formatDate(s.approvedAt||u.approvedAt));
}

function closeModal(id) { document.getElementById(id)?.classList.remove('show'); }
function showAlertInline(id, msg, type) { const el=document.getElementById(id); if(!el) return; el.innerHTML=msg; el.className='alert alert-'+type+' show'; }
function hideAlert(id) { const el=document.getElementById(id); if(el) { el.className='alert'; el.textContent=''; } }
function showToast(msg, type='info') {
  let t=document.getElementById('toast');
  if (!t) { t=document.createElement('div'); t.id='toast'; document.body.appendChild(t); }
  t.textContent=msg; t.className='toast '+type;
  setTimeout(()=>t.classList.add('show'),10); setTimeout(()=>t.classList.remove('show'),3500);
}
document.addEventListener('DOMContentLoaded', () => { initDashboard(); startLiveTracking(session); });

// Auto-fill supplier email jab company name type karo
function autoFillSupplierEmail(companyName) {
  if (!companyName || companyName.length < 3) return;
  const users = JSON.parse(localStorage.getItem('chemtrack_users') || '[]');
  const supplier = users.find(u => u && (u.category === 'supplier' || u.role === 'supplier') &&
    (u.companyName || u.name || '').toLowerCase().includes(companyName.toLowerCase()));
  if (supplier) {
    const emailEl = document.getElementById('req-supplier-email');
    if (emailEl && !emailEl.value) {
      emailEl.value = supplier.email;
      emailEl.style.borderColor = '#337a12';
    }
  }
}