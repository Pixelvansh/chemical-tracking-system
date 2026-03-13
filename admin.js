// ═══════════════════════════════════════════════════════
// ChemTrack India — NCB Admin Portal JS
// Live data from localStorage — sabke dashboards ka data
// ═══════════════════════════════════════════════════════

let currentApproveEmail = null;
let currentRejectEmail  = null;
let allUsers = [];
let refreshTimer = null;

// ── INIT ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  checkAdminSession();
  loadAll();
  startAutoRefresh();
});

function checkAdminSession() {
  const s = localStorage.getItem('chemtrack_admin');
  if (!s) { window.location.href = 'login.html'; return; }
}

function adminLogout() {
  if (confirm('Logout from NCB Admin Portal?')) {
    localStorage.removeItem('chemtrack_admin');
    window.location.href = 'login.html';
  }
}

function loadAll() {
  allUsers = JSON.parse(localStorage.getItem('chemtrack_users') || '[]')
    .filter(u => u && u.email)
    .map(u => ({
      ...u,
      role:        u.role || u.category || '',      // category → role normalize
      companyName: u.companyName || u.name || '',
      status:      u.status || 'pending'
    }));
  updateDashboardStats();
  loadRecentRegistrations();
  loadApprovals();
  loadCompanies();
  loadChainData();
  loadRawRequests();
  renderLiveLocations();
  updateRefreshTime();
  updateBadges();
}

function startAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(loadAll, 5000);
}

function updateRefreshTime() {
  const now = new Date().toLocaleTimeString('en-IN');
  const el1 = document.getElementById('last-refresh');
  const el2 = document.getElementById('last-refresh-approvals');
  if (el1) el1.textContent = 'Last updated: ' + now;
  if (el2) el2.textContent = 'Last updated: ' + now;
}

// ── SECTION NAVIGATION ────────────────────────────────
function showSection(name, el) {
  document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
  const sec = document.getElementById('section-' + name);
  if (sec) sec.classList.add('active');
  if (el && el.classList) el.classList.add('active');
  return false;
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const main    = document.querySelector('.admin-main');
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

// ── HELPER ────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
}
function fmtDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
}
function roleBadge(role) {
  if (!role) return '<span style="background:#eee;color:#888;padding:2px 8px;border-radius:50px;font-size:0.72rem;font-weight:700;">👤 UNKNOWN</span>';
  const icons  = { supplier:'📦', manufacturer:'🏭', distributor:'🚚', retailer:'🏪', consumer:'🏥', exporter:'✈️', admin:'🔐' };
  const colors = { supplier:'#f68100', manufacturer:'#2e86c1', distributor:'#117a8b', retailer:'#6c3483', consumer:'#337a12', exporter:'#c0392b' };
  const color  = colors[role] || '#666';
  return `<span style="background:${color}22;color:${color};padding:2px 8px;border-radius:50px;font-size:0.72rem;font-weight:700;">${icons[role]||'👤'} ${role.toUpperCase()}</span>`;
}
function statusBadge(s) {
  if (!s) s = 'pending';
  const map = { approved:'#337a12', pending:'#f68100', rejected:'#c0392b', suspended:'#6c757d' };
  const c = map[s] || '#888';
  return `<span style="background:${c}22;color:${c};padding:3px 10px;border-radius:50px;font-size:0.72rem;font-weight:700;">${s.toUpperCase()}</span>`;
}
function generateURN(role, company) {
  const prefix = { supplier:'SUP', manufacturer:'MFR', distributor:'DST', retailer:'RET', consumer:'CON', exporter:'EXP' };
  const p = prefix[role] || 'NCB';
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${p}-NCB-${rand}-IND`;
}

// ── DASHBOARD STATS ───────────────────────────────────
function updateDashboardStats() {
  const total    = allUsers.length;
  const pending  = allUsers.filter(u => u && u.status === 'pending').length;
  const approved = allUsers.filter(u => u && u.status === 'approved').length;
  const rejected = allUsers.filter(u => u && u.status === 'rejected').length;

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('total-firms',    total);
  set('pending-count',  pending);
  set('approved-count', approved);
  set('rejected-count', rejected);
}

function updateBadges() {
  const pending = allUsers.filter(u => u && u.status === 'pending').length;
  const chain   = JSON.parse(localStorage.getItem('chemtrack_chain') || '[]');
  const rawReqs = JSON.parse(localStorage.getItem('mfr_raw_requests') || '[]');

  const b1 = document.getElementById('badge-approvals');
  if (b1) { b1.textContent = pending; b1.style.display = pending > 0 ? 'flex' : 'none'; }

  const b2 = document.getElementById('badge-chain');
  if (b2) { b2.textContent = chain.length; b2.style.display = chain.length > 0 ? 'flex' : 'none'; }

  const b3 = document.getElementById('badge-raw');
  if (b3) {
    const p = rawReqs.filter(r => r.status === 'pending').length;
    b3.textContent = p; b3.style.display = p > 0 ? 'flex' : 'none';
  }
}

// ── RECENT REGISTRATIONS ──────────────────────────────
function loadRecentRegistrations() {
  const tbody = document.getElementById('recent-tbody'); if (!tbody) return;
  const valid  = allUsers.filter(u => u && u.email);
  const recent = [...valid].sort((a, b) => new Date(b.registeredAt||0) - new Date(a.registeredAt||0)).slice(0, 8);
  if (!recent.length) { tbody.innerHTML = '<tr><td colspan="6" class="empty-td">No registrations yet.</td></tr>'; return; }
  tbody.innerHTML = recent.map(u => {
    const name   = u.companyName || u.name || '—';
    const status = u.status || 'pending';
    const role   = u.role   || '';
    return '<tr>' +
      '<td><strong>' + name + '</strong></td>' +
      '<td>' + roleBadge(role) + '</td>' +
      '<td style="font-size:0.82rem">' + u.email + '</td>' +
      '<td>' + fmtDate(u.registeredAt) + '</td>' +
      '<td>' + statusBadge(status) + '</td>' +
      '<td>' + (status === 'pending'
        ? '<button class="btn-approve" onclick="openApproveModal(\'' + u.email + '\')">✅ Approve</button> <button class="btn-reject" onclick="openRejectModal(\'' + u.email + '\')" style="margin-left:4px">❌ Reject</button>'
        : '<button class="btn-view" onclick="viewCompanyDetails(\'' + u.email + '\')">👁 View</button>') +
      '</td></tr>';
  }).join('');
}

// ── PENDING APPROVALS ─────────────────────────────────
let filteredApprovals = [];

function loadApprovals() {
  filteredApprovals = allUsers.filter(u => u && u.email && u.status === 'pending');
  renderApprovalCards(filteredApprovals);
}

function renderApprovalCards(list) {
  const container = document.getElementById('approvals-list'); if (!container) return;
  if (!list.length) {
    container.innerHTML = '<div class="empty-state"><span>📭</span><p>No Pending Approvals</p><p style="font-size:0.82rem;color:var(--gray)">New registrations will appear here automatically</p></div>';
    return;
  }
  container.innerHTML = list.map(u => {
    const fields = {
      manufacturer: ['cbnLicense','gst','ownerName','phone','state'],
      supplier:     ['cbnLicense','gst','ownerName','phone','state'],
      distributor:  ['distLicense','gst','ownerName','phone','state'],
      retailer:     ['retailLicense','gst','ownerName','phone','state'],
      consumer:     ['drugLicense','gst','ownerName','phone','purpose'],
      exporter:     ['iec','gst','ownerName','phone','state']
    };
    const role2   = u.role || u.category || '';
    const flds = fields[role2] || ['gst','ownerName','phone','state'];
    const details = flds.map(f => u[f] ? '<span><strong>'+f+':</strong> '+u[f]+'</span>' : '').filter(Boolean).join(' &nbsp;·&nbsp; ');
    const avatarMap = {supplier:'📦',manufacturer:'🏭',distributor:'🚚',retailer:'🏪',consumer:'🏥',exporter:'✈️'};
    const safeEmail = (u.email||'').replace(/'/g, "\\'");
    const safeName  = (u.companyName || u.name || '—').replace(/</g,'&lt;');
    return '<div class="approval-card">' +
      '<div class="approval-left">' +
        '<div class="approval-avatar">' + (avatarMap[role2]||'👤') + '</div>' +
        '<div class="approval-info">' +
          '<h3>' + safeName + '</h3>' +
          '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:4px 0">' +
            roleBadge(role2) +
            '<span style="font-size:0.78rem;color:var(--gray)">' + u.email + '</span>' +
            '<span style="font-size:0.78rem;color:var(--gray)">Registered: ' + fmtDate(u.registeredAt) + '</span>' +
          '</div>' +
          '<div style="font-size:0.8rem;color:#555;margin-top:4px">' + details + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="approval-actions">' +
        '<button class="btn-approve" onclick="openApproveModal(\'' + safeEmail + '\')">✅ Approve</button>' +
        '<button class="btn-reject"  onclick="openRejectModal(\''  + safeEmail + '\')">❌ Reject</button>' +
        '<button class="btn-view"    onclick="viewCompanyDetails(\'' + safeEmail + '\')">👁 Details</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

function filterApprovals(role) {
  const list = role === 'all' ? allUsers.filter(u => u && u.email && u.status === 'pending')
                              : allUsers.filter(u => u && u.email && u.status === 'pending' && u.role === role);
  renderApprovalCards(list);
}

function searchApprovals(q) {
  const query = q.toLowerCase();
  const list = allUsers.filter(u => u && u.email && u.status === 'pending' &&
    ((u.email||'').toLowerCase().includes(query) || (u.companyName||u.name||'').toLowerCase().includes(query)));
  renderApprovalCards(list);
}

// ── APPROVE / REJECT ──────────────────────────────────
function openApproveModal(email) {
  const freshUsers = JSON.parse(localStorage.getItem('chemtrack_users') || '[]');
  // Case-insensitive find + trim
  const u = freshUsers.find(x => x && x.email && x.email.trim().toLowerCase() === (email||'').trim().toLowerCase());
  if (!u) { showToast('User not found: ' + email, 'error'); return; }
  const role3 = u.role || u.category || 'unknown';
  currentApproveEmail = email;
  const el1 = document.getElementById('modal-approve-name');
  const el2 = document.getElementById('modal-approve-cat');
  const el3 = document.getElementById('modal-approve-email');
  if (el1) el1.textContent = u.companyName || u.name || '—';
if (el2) el2.textContent = (u.role || u.category || 'unknown').toUpperCase();
  if (el3) el3.textContent = u.email;
  const noteEl = document.getElementById('approve-note'); if (noteEl) noteEl.value = '';
  document.getElementById('approve-modal').classList.add('show');
}

function confirmApprove() {
  if (!currentApproveEmail) return;
  const users = JSON.parse(localStorage.getItem('chemtrack_users') || '[]');
  const idx   = users.findIndex(u => u && u.email && u.email.trim().toLowerCase() === (currentApproveEmail||'').trim().toLowerCase());
  if (idx === -1) { showToast('User not found.', 'error'); return; }

  const urn = generateURN(users[idx].role || 'unknown', users[idx].companyName || users[idx].name);
  users[idx].status     = 'approved';
  users[idx].urn        = urn;
  users[idx].approvedAt = new Date().toISOString();
  users[idx].approvedBy = 'NCB Admin';
  users[idx].approveNote = document.getElementById('approve-note')?.value || '';
  localStorage.setItem('chemtrack_users', JSON.stringify(users));

  // Agar us user ka active session hai toh usse bhi update karo
  const sess = JSON.parse(localStorage.getItem('chemtrack_session') || '{}');
  if (sess.email === currentApproveEmail) {
    sess.status = 'approved'; sess.urn = urn;
    localStorage.setItem('chemtrack_session', JSON.stringify(sess));
  }

  closeModal('approve-modal');
  showToast('✅ ' + (users[idx].companyName || users[idx].name) + ' approved! URN: ' + urn, 'success');
  loadAll();
}

function openRejectModal(email) {
  const freshUsers2 = JSON.parse(localStorage.getItem('chemtrack_users') || '[]');
  const u = freshUsers2.find(x => x && x.email && x.email.trim().toLowerCase() === (email||'').trim().toLowerCase());
  if (!u) { showToast('User not found: ' + email, 'error'); return; }
  currentRejectEmail = email;
  const el = document.getElementById('modal-reject-name'); if (el) el.textContent = u.companyName || u.name;
  const r = document.getElementById('reject-reason'); if (r) r.value = '';
  const d = document.getElementById('reject-detail'); if (d) d.value = '';
  document.getElementById('reject-modal').classList.add('show');
}

function confirmReject() {
  if (!currentRejectEmail) return;
  const reason = document.getElementById('reject-reason')?.value;
  if (!reason) { showToast('⚠️ Please select a rejection reason.', 'warning'); return; }
  const detail = document.getElementById('reject-detail')?.value || '';
  const users  = JSON.parse(localStorage.getItem('chemtrack_users') || '[]');
  const idx    = users.findIndex(u => u && u.email && u.email.trim().toLowerCase() === (currentRejectEmail||'').trim().toLowerCase());
  if (idx === -1) return;
  users[idx].status       = 'rejected';
  users[idx].rejectedAt   = new Date().toISOString();
  users[idx].rejectReason = reason + (detail ? ' — ' + detail : '');
  localStorage.setItem('chemtrack_users', JSON.stringify(users));
  closeModal('reject-modal');
  showToast('❌ ' + (users[idx].companyName || users[idx].name) + ' rejected.', 'info');
  loadAll();
}

// ── ALL COMPANIES ─────────────────────────────────────
function loadCompanies() {
  const tbody = document.getElementById('companies-tbody'); if (!tbody) return;
  if (!allUsers.length) { tbody.innerHTML = '<tr><td colspan="7" class="empty-td">No companies registered yet.</td></tr>'; return; }
  const sorted = [...allUsers].filter(u => u && u.email).sort((a, b) => new Date(b.registeredAt||0) - new Date(a.registeredAt||0));
  tbody.innerHTML = sorted.map((u, i) => `
    <tr>
      <td>${i+1}</td>
      <td><strong>${u.companyName || u.name || '—'}</strong><br><span style="font-size:0.75rem;color:var(--gray)">${u.urn || 'URN pending'}</span></td>
      <td>${roleBadge(u.role)}</td>
      <td style="font-size:0.82rem">${u.email}</td>
      <td>${fmtDate(u.registeredAt)}</td>
      <td>${statusBadge(u.status)}</td>
      <td>
        <button class="btn-view" onclick="viewCompanyDetails('${u.email}')">👁 View</button>
        ${u.status === 'approved'
          ? `<button class="btn-reject" onclick="suspendUser('${u.email}')" style="margin-left:4px;font-size:0.72rem">🔒 Suspend</button>`
          : u.status === 'pending'
          ? `<button class="btn-approve" onclick="openApproveModal('${u.email}')" style="margin-left:4px">✅ Approve</button>`
          : ''}
      </td>
    </tr>`).join('');
}

function suspendUser(email) {
  if (!confirm('Suspend this company? They will not be able to login.')) return;
  const users = JSON.parse(localStorage.getItem('chemtrack_users') || '[]');
  const idx = users.findIndex(u => u.email === email);
  if (idx !== -1) { users[idx].status = 'suspended'; localStorage.setItem('chemtrack_users', JSON.stringify(users)); }
  showToast('🔒 User suspended.', 'info'); loadAll();
}

function viewCompanyDetails(email) {
  const freshU = JSON.parse(localStorage.getItem('chemtrack_users')||'[]'); const u = freshU.find(x => x && x.email && x.email.trim().toLowerCase() === (email||'').trim().toLowerCase()); if (!u) return;
  const info = Object.entries(u).map(([k, v]) => {
    if (typeof v === 'object' || k === 'password') return '';
    return `<tr><td style="font-weight:600;color:#132c54;padding:5px 10px;width:160px">${k}</td><td style="padding:5px 10px;color:#333">${v||'—'}</td></tr>`;
  }).join('');
  const el = document.getElementById('admin-scan-result');
  if (el) {
    el.innerHTML = `<div class="scan-found" style="margin-top:0"><h4>🏢 ${u.companyName||u.name} — Details</h4><table style="width:100%;border-collapse:collapse">${info}</table></div>`;
    showSection('chain', document.querySelector('[onclick*="chain"]'));
  }
}

// ── RAW MATERIAL REQUESTS ─────────────────────────────
function loadRawRequests() {
  const tbody = document.querySelector('#section-raw-requests table tbody'); if (!tbody) return;
  const allRaw = JSON.parse(localStorage.getItem('mfr_raw_requests') || '[]');
  if (!allRaw.length) { tbody.innerHTML = '<tr><td colspan="9" class="empty-td">No raw material requests yet.</td></tr>'; return; }
  const sorted = [...allRaw].sort((a, b) => new Date(b.createdAt||0) - new Date(a.createdAt||0));
  tbody.innerHTML = sorted.map(r => `
    <tr>
      <td><code style="font-size:0.72rem;background:#f0f4ff;padding:2px 5px;border-radius:4px">${r.requestId}</code></td>
      <td><strong>${r.mfrCompany || '—'}</strong></td>
      <td>${r.material || '—'}</td>
      <td>${r.qty || '—'}</td>
      <td>${r.supplierCompany || '—'}</td>
      <td style="font-size:0.78rem">${r.chemicals || '—'}</td>
      <td>${fmtDate(r.createdAt)}</td>
      <td>${statusBadge(r.status)}</td>
      <td>
        ${r.status === 'pending'
          ? `<button class="btn-approve" onclick="approveRawRequest('${r.requestId}')">✅ Approve</button>`
          : '—'}
      </td>
    </tr>`).join('');
}

function approveRawRequest(requestId) {
  const all = JSON.parse(localStorage.getItem('mfr_raw_requests') || '[]');
  const idx = all.findIndex(r => r.requestId === requestId);
  if (idx !== -1) { all[idx].status = 'approved'; localStorage.setItem('mfr_raw_requests', JSON.stringify(all)); }
  showToast('✅ Raw material request approved!', 'success'); loadRawRequests(); updateBadges();
}

// ── CHAIN TRACKING ────────────────────────────────────
function loadChainData() {
  const tbody = document.getElementById('chain-tbody'); if (!tbody) return;
  const chain = JSON.parse(localStorage.getItem('chemtrack_chain') || '[]');
  updateBadges();
  if (!chain.length) { tbody.innerHTML = '<tr><td colspan="10" class="empty-td">No chain data yet. Users need to create and dispatch barcodes first.</td></tr>'; return; }
  const sorted = [...chain].sort((a, b) => new Date(b.createdAt||0) - new Date(a.createdAt||0));
  tbody.innerHTML = sorted.map(b => {
    const level = b.parentId ? (b.parentId.startsWith('RAW') ? 2 : b.parentId.startsWith('MFR') ? 3 : 4) : 1;
    const levelLabel = ['','🔵 Root','🟢 L2','🟡 L3','🔴 L4'][level] || '—';
    return `<tr>
      <td><code style="font-family:monospace;font-size:0.7rem;background:#f0f4ff;padding:2px 5px;border-radius:3px">${b.barcodeId}</code></td>
      <td>${levelLabel}</td>
      <td>${b.material||'—'}</td>
      <td>${b.qty||'—'} kg</td>
      <td>${b.remainingQty||'—'} kg</td>
      <td style="font-size:0.78rem">${b.fromParty||'—'}</td>
      <td style="font-size:0.78rem">${b.toParty||'—'}</td>
      <td style="font-size:0.72rem">📍 ${gpsLabel(b.gpsOrigin)||'—'}</td>
      <td>${statusBadge(b.status)}</td>
      <td><button class="btn-view" onclick="adminViewChain('${b.barcodeId}')">🔗 Chain</button></td>
    </tr>`;
  }).join('');
  renderGPSMap(chain);
}

function adminLoadAllChain() { loadChainData(); showToast('📋 Chain data loaded!', 'info'); }

function adminScanBarcode() {
  const val = document.getElementById('admin-scan-input')?.value.trim();
  if (!val) { showToast('Enter a barcode ID.', 'warning'); return; }
  const result = document.getElementById('admin-scan-result');
  const entry  = findBarcode(val);
  if (!entry) { result.innerHTML = '<div style="background:#fee;border:1.5px solid #c0392b;border-radius:8px;padding:1rem;margin-top:0.5rem;color:#c0392b">❌ Barcode not found: ' + val + '</div>'; return; }
  const chain = entry.chain.map((step, i) => `
    <div style="display:flex;gap:1rem;padding:0.5rem 0;border-bottom:1px solid #eee">
      <span style="background:#132c54;color:#fff;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:0.72rem;flex-shrink:0">${i+1}</span>
      <div style="font-size:0.82rem"><strong>${step.event}</strong> — ${step.by} (${step.role})<br><span style="color:#888">${new Date(step.timestamp).toLocaleString('en-IN')} ${step.gps ? '📍 '+gpsLabel(step.gps) : ''}</span></div>
    </div>`).join('');
  result.innerHTML = `
    <div class="scan-found" style="margin-top:0.5rem">
      <h4>✅ Barcode Found — ${entry.barcodeId}</h4>
      <table style="width:100%;font-size:0.83rem;border-collapse:collapse">
        <tr><td style="padding:4px 8px;font-weight:600;width:140px;color:#132c54">Material</td><td>${entry.material}</td></tr>
        <tr><td style="padding:4px 8px;font-weight:600;color:#132c54">Qty</td><td>${entry.qty} kg</td></tr>
        <tr><td style="padding:4px 8px;font-weight:600;color:#132c54">Remaining</td><td>${entry.remainingQty} kg</td></tr>
        <tr><td style="padding:4px 8px;font-weight:600;color:#132c54">From → To</td><td>${entry.fromParty} → ${entry.toParty}</td></tr>
        <tr><td style="padding:4px 8px;font-weight:600;color:#132c54">Parent</td><td>${entry.parentId||'Root Barcode'}</td></tr>
        <tr><td style="padding:4px 8px;font-weight:600;color:#132c54">GPS Origin</td><td>📍 ${gpsLabel(entry.gpsOrigin)||'—'}</td></tr>
        <tr><td style="padding:4px 8px;font-weight:600;color:#132c54">Status</td><td>${statusBadge(entry.status)}</td></tr>
      </table>
      <div style="margin-top:1rem"><strong>Blockchain Chain (${entry.chain.length} events):</strong><div style="margin-top:0.5rem">${chain}</div></div>
    </div>`;
}

function adminViewChain(barcodeId) {
  document.getElementById('admin-scan-input').value = barcodeId;
  adminScanBarcode();
}

// ── GPS MAP ───────────────────────────────────────────
function renderGPSMap(chain) {
  const mapDiv = document.getElementById('admin-gps-map'); if (!mapDiv) return;
  const active = chain.filter(b => b.status !== 'received' && b.status !== 'fully_split');
  if (!active.length) {
    mapDiv.innerHTML = '<div style="text-align:center;padding:2rem;color:#aaa"><span style="font-size:2rem">🗺️</span><p style="margin-top:0.5rem">Koi active shipment nahi — sab deliver ho gaye ya receive ho gaye</p></div>';
    return;
  }
  const roleColors = { supplier:'#f6ad55', manufacturer:'#68d391', distributor:'#63b3ed', retailer:'#fc8181', consumer:'#b794f4' };
  mapDiv.innerHTML = `
    <div style="margin-bottom:1rem;display:flex;gap:1rem;flex-wrap:wrap">
      ${Object.entries(roleColors).map(([r,c])=>`<span style="display:flex;align-items:center;gap:4px;font-size:0.78rem"><span style="width:10px;height:10px;border-radius:50%;background:${c};display:inline-block"></span>${r}</span>`).join('')}
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:0.8rem">
      ${active.map(b => {
        const gps = b.gpsCurrent || b.gpsOrigin;
        const color = roleColors[b.toRole] || '#aaa';
        return `<div style="background:#1e3a5f;border:1.5px solid ${color};border-radius:10px;padding:0.8rem;cursor:pointer" onclick="adminViewChain('${b.barcodeId}')">
          <div style="color:${color};font-size:0.75rem;font-weight:700;text-transform:uppercase">${b.toRole||'—'}</div>
          <div style="color:#e0e8f4;font-weight:600;margin:4px 0;font-size:0.88rem">${b.material}</div>
          <div style="color:#aaa;font-size:0.75rem">${b.qty} kg → <strong style="color:#fff">${b.toParty||'—'}</strong></div>
          <div style="color:#aaa;font-size:0.72rem;margin-top:4px">📍 ${gpsLabel(gps)||'GPS N/A'}</div>
          <div style="color:#aaa;font-size:0.7rem;font-family:monospace;margin-top:2px">${b.barcodeId.slice(0,20)}...</div>
        </div>`;
      }).join('')}
    </div>`;
}

// ── LIVE LOCATION PANEL ───────────────────────────────
function renderLiveLocations() {
  const panel = document.getElementById('live-location-panel'); if (!panel) return;
  const liveData = JSON.parse(localStorage.getItem('chemtrack_live_locations') || '[]');
  const countEl  = document.getElementById('live-location-count');
  const refreshEl = document.getElementById('live-location-refresh');
  const now = new Date().toLocaleTimeString('en-IN');
  if (refreshEl) refreshEl.textContent = 'Updated: ' + now;
  if (!liveData.length) {
    panel.innerHTML = `<div class="live-empty"><span style="font-size:2.5rem">📡</span><p>Koi bhi user abhi online nahi hai.</p><p style="font-size:0.8rem;color:#888">Jab users apna dashboard kholenge aur location allow karenge, unki live GPS yahan aayegi.</p></div>`;
    if (countEl) countEl.textContent = '0 online';
    return;
  }
  const roleIcon = { supplier:'📦', manufacturer:'🏭', distributor:'🚚', retailer:'🏪', consumer:'🏥', exporter:'✈️' };
  const roleColors = { supplier:'#f6ad55', manufacturer:'#68d391', distributor:'#63b3ed', retailer:'#b794f4', consumer:'#fc8181', exporter:'#ff6b6b' };
  if (countEl) countEl.textContent = liveData.length + ' online';
  panel.innerHTML = liveData.map(u => {
    const color = roleColors[u.role] || '#aaa';
    const minsAgo = u.updatedAt ? Math.floor((Date.now() - new Date(u.updatedAt)) / 60000) : null;
    const timeStr = minsAgo !== null ? (minsAgo < 1 ? 'Just now' : minsAgo + ' min ago') : '—';
    const mapsLink = u.lat && u.lng ? `https://www.google.com/maps?q=${u.lat},${u.lng}` : null;
    return `
    <div class="live-user-card" style="background:#fff;border:1.5px solid ${color}33;border-radius:12px;padding:1rem;box-shadow:0 2px 8px rgba(0,0,0,0.07)">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
        <span style="font-size:1.8rem">${roleIcon[u.role]||'👤'}</span>
        <div style="flex:1">
          <div style="font-weight:700;color:#132c54;font-size:0.9rem">${u.company||u.email}</div>
          <div style="font-size:0.72rem;background:${color}22;color:${color};padding:2px 8px;border-radius:50px;display:inline-block;font-weight:700">${u.role.toUpperCase()}</div>
        </div>
        <div style="width:10px;height:10px;border-radius:50%;background:${minsAgo<5?'#337a12':'#f68100'};box-shadow:0 0 0 3px ${minsAgo<5?'#337a1222':'#f6810022'}"></div>
      </div>
      <div style="font-size:0.8rem;color:#555;line-height:1.7">
        <div>📍 <strong>${u.city || (u.lat && u.lng ? u.lat.toFixed(4)+'°N, '+u.lng.toFixed(4)+'°E' : 'Location N/A')}</strong></div>
        ${u.lat && u.lng ? `<div style="font-size:0.72rem;color:#888">Lat: ${u.lat.toFixed(5)}, Lng: ${u.lng.toFixed(5)}</div>` : ''}
        <div>⏱️ ${timeStr}</div>
        <div style="font-size:0.72rem;color:#aaa">${u.email}</div>
      </div>
      ${mapsLink ? `<a href="${mapsLink}" target="_blank" style="display:block;margin-top:8px;background:#132c54;color:#fff;text-align:center;padding:5px;border-radius:6px;font-size:0.78rem;text-decoration:none;font-weight:700">🗺️ Open in Google Maps</a>` : ''}
    </div>`;
  }).join('');
}

// ── ALERTS ────────────────────────────────────────────
// Dynamic alerts — chain data se generate karte hain
function loadDynamicAlerts() {
  const chain = JSON.parse(localStorage.getItem('chemtrack_chain') || '[]');
  const alertsDiv = document.querySelector('#section-alerts .alerts-list');
  if (!alertsDiv) return;
  const dynamicAlerts = [];
  // Qty mismatch check — dispatched lekin receive nahi hua 6+ ghante se
  chain.filter(b => b.status === 'dispatched').forEach(b => {
    const dispTime = b.chain.find(c => c.event === 'dispatched');
    if (dispTime) {
      const hrs = (Date.now() - new Date(dispTime.timestamp)) / 3600000;
      if (hrs > 6) dynamicAlerts.push({ type:'warning', title:'Shipment in Transit Too Long', detail: b.barcodeId + ' — ' + b.material + ' ' + b.qty + 'kg dispatched to ' + b.toParty + '. No receipt for ' + Math.floor(hrs) + ' hours.', gps: gpsLabel(b.gpsOrigin)||'Unknown', time: fmtDateTime(dispTime.timestamp), party: b.fromParty });
    }
  });
  if (!dynamicAlerts.length) return; // Default alerts rehne do HTML mein
  const newHTML = dynamicAlerts.map(a => `
    <div class="alert-card ${a.type}">
      <div class="alert-left">
        <span class="alert-type-icon">${a.type==='critical'?'⚠️':'🛑'}</span>
        <div>
          <p class="alert-title">${a.title}</p>
          <p class="alert-detail">${a.detail}</p>
          <p class="alert-meta">📍 ${a.gps} &nbsp;·&nbsp; 🕐 ${a.time} &nbsp;·&nbsp; 🏭 ${a.party}</p>
        </div>
      </div>
      <div class="alert-actions">
        <span class="alert-badge ${a.type}">${a.type.toUpperCase()}</span>
        <button class="btn-investigate" onclick="showToast('Investigating...','info')">Investigate</button>
      </div>
    </div>`).join('');
  alertsDiv.insertAdjacentHTML('afterbegin', newHTML);
}

// ── MODAL ─────────────────────────────────────────────
function closeModal(id) {
  const el = document.getElementById(id); if (el) el.classList.remove('show');
}

// ── TOAST ─────────────────────────────────────────────
function showToast(msg, type) {
  type = type || 'info';
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.className = 'toast ' + type;
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => t.classList.remove('show'), 3500);
}