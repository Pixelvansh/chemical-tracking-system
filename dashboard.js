// ================================================
// ChemTrack India — Dashboard JS
// Role-based sidebar + section management
// ================================================

const session = JSON.parse(localStorage.getItem('chemtrack_session') || 'null');

// Role-based sidebar menus
const SIDEBAR_CONFIG = {
  manufacturer: [
    { id: 'mfr-dashboard',    icon: '📊', label: 'Dashboard' },
    { id: 'mfr-raw-request',  icon: '📋', label: 'Raw Material Request', badge: '1' },
    { id: 'mfr-create-batch', icon: '➕', label: 'Create Batch' },
    { id: 'mfr-batches',      icon: '📦', label: 'My Batches' },
    { id: 'mfr-dispatch',     icon: '🚚', label: 'Dispatch Chemical' },
    { id: 'mfr-qr',           icon: '🔲', label: 'QR Code Manager' },
    { id: 'alerts',            icon: '🚨', label: 'Alerts' },
    { id: 'profile',           icon: '👤', label: 'My Profile' },
  ],
  distributor: [
    { id: 'dist-dashboard', icon: '📊', label: 'Dashboard' },
    { id: 'dist-receive',   icon: '📥', label: 'Receive Chemical', badge: '2' },
    { id: 'dist-inventory', icon: '🏗️', label: 'My Inventory' },
    { id: 'dist-forward',   icon: '🚚', label: 'Forward Chemical' },
    { id: 'alerts',          icon: '🚨', label: 'Alerts' },
    { id: 'profile',         icon: '👤', label: 'My Profile' },
  ],
  supplier: [
    { id: 'dist-dashboard', icon: '📊', label: 'Dashboard' },
    { id: 'dist-inventory', icon: '📦', label: 'My Inventory' },
    { id: 'dist-forward',   icon: '🚚', label: 'Dispatch Supplies' },
    { id: 'alerts',          icon: '🚨', label: 'Alerts' },
    { id: 'profile',         icon: '👤', label: 'My Profile' },
  ],
  consumer: [
    { id: 'con-dashboard', icon: '📊', label: 'Dashboard' },
    { id: 'con-receive',   icon: '📥', label: 'Receive Delivery', badge: '1' },
    { id: 'con-stock',     icon: '🏗️', label: 'My Stock' },
    { id: 'con-usage',     icon: '📊', label: 'Monthly Usage Log', badge: '!' },
    { id: 'alerts',         icon: '🚨', label: 'Alerts' },
    { id: 'profile',        icon: '👤', label: 'My Profile' },
  ],
  retailer: [
    { id: 'con-dashboard', icon: '📊', label: 'Dashboard' },
    { id: 'con-receive',   icon: '📥', label: 'Receive Stock' },
    { id: 'con-stock',     icon: '🏗️', label: 'My Stock' },
    { id: 'alerts',         icon: '🚨', label: 'Alerts' },
    { id: 'profile',        icon: '👤', label: 'My Profile' },
  ],
  exporter: [
    { id: 'dist-dashboard', icon: '📊', label: 'Dashboard' },
    { id: 'dist-inventory', icon: '📦', label: 'My Inventory' },
    { id: 'dist-forward',   icon: '✈️', label: 'Export Dispatch' },
    { id: 'alerts',          icon: '🚨', label: 'Alerts' },
    { id: 'profile',         icon: '👤', label: 'My Profile' },
  ]
};

// Role emoji map
const ROLE_EMOJI = {
  manufacturer: '🏭',
  distributor:  '🚚',
  supplier:     '📦',
  consumer:     '🏥',
  retailer:     '🏪',
  exporter:     '✈️'
};

// Default first section per role
const DEFAULT_SECTION = {
  manufacturer: 'mfr-dashboard',
  distributor:  'dist-dashboard',
  supplier:     'dist-dashboard',
  consumer:     'con-dashboard',
  retailer:     'con-dashboard',
  exporter:     'dist-dashboard'
};

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {
  if (!session) return;

  const role = session.role || 'manufacturer';

  // Set navbar info (guard missing elements)
  const navFirmNameEl = document.getElementById('nav-firm-name');
  const navFirmRoleEl = document.getElementById('nav-firm-role');
  const navRoleLabelEl = document.getElementById('nav-role-label');
  if (navFirmNameEl) navFirmNameEl.textContent = session.name || session.email;
  if (navFirmRoleEl) navFirmRoleEl.textContent = role.toUpperCase();
  if (navRoleLabelEl) navRoleLabelEl.textContent = role.charAt(0).toUpperCase() + role.slice(1) + ' Portal';

  // Build sidebar
  buildSidebar(role);

  // Show default section
  const def = DEFAULT_SECTION[role] || 'mfr-dashboard';
  showSection(def, null);

  // Profile page
  setupProfile();
});

// ── BUILD SIDEBAR ──
function buildSidebar(role) {
  const menu   = document.getElementById('sidebar-menu');
  const config = SIDEBAR_CONFIG[role] || SIDEBAR_CONFIG['manufacturer'];
  if (!menu) return;

  menu.innerHTML = config.map(item => `
    <li>
      <a class="sidebar-item" href="#"
         onclick="showSection('${item.id}', this); return false;">
        <span class="s-icon">${item.icon}</span>
        <span class="s-text">${item.label}</span>
        ${item.badge ? `<span class="s-badge">${item.badge}</span>` : ''}
      </a>
    </li>
  `).join('');
}

// ── SHOW SECTION ──
function showSection(name, el) {
  document.querySelectorAll('.content-section').forEach(s => {
    s.classList.remove('active');
  });
  document.querySelectorAll('.sidebar-item').forEach(i => {
    i.classList.remove('active');
  });

  const sec = document.getElementById('section-' + name);
  if (sec) sec.classList.add('active');
  if (el)  el.classList.add('active');
}

// ── SIDEBAR TOGGLE ──
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const main    = document.getElementById('dash-main');
  if (!sidebar) return;

  const isMobile = window.innerWidth <= 768;

  if (isMobile) {
    // Mobile: slide in/out as overlay
    sidebar.classList.toggle('open');
    // Create/remove overlay
    let overlay = document.getElementById('sidebar-overlay');
    if (sidebar.classList.contains('open')) {
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'sidebar-overlay';
        overlay.className = 'sidebar-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:996;';
        overlay.onclick = () => {
          sidebar.classList.remove('open');
          overlay.remove();
        };
        document.body.appendChild(overlay);
      }
    } else {
      if (overlay) overlay.remove();
    }
  } else {
    // Desktop: collapse/expand with margin shift
    const sidebarW = getComputedStyle(document.documentElement).getPropertyValue('--sidebar-w').trim() || '240px';
    if (sidebar.style.width === '0px') {
      sidebar.style.width = sidebarW;
      if (main) main.style.marginLeft = sidebarW;
    } else {
      sidebar.style.width = '0px';
      if (main) main.style.marginLeft = '0';
    }
  }
}

// Close sidebar when window resizes past mobile breakpoint
window.addEventListener('resize', () => {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (window.innerWidth > 768 && sidebar) {
    sidebar.classList.remove('open');
    if (overlay) overlay.remove();
  }
});

// ── LOGOUT ──
function userLogout() {
  if (confirm('Logout from ChemTrack?')) {
    localStorage.removeItem('chemtrack_session');
    window.location.href = 'login.html';
  }
}

// ── FILE UPLOAD ──
function showFileName(input, nameId) {
  const el = document.getElementById(nameId);
  if (el && input.files[0]) {
    el.textContent = '✓ ' + input.files[0].name;
    el.style.display = 'block';
  }
}

// ── PROFILE SETUP ──
function setupProfile() {
  if (!session) return;
  const role = session.role || '';

  const nameEl  = document.getElementById('profile-name');
  const emailEl = document.getElementById('profile-email');
  const catEl   = document.getElementById('profile-cat');
  const roleEl  = document.getElementById('profile-role-text');
  const avatarEl= document.getElementById('profile-avatar');

  if (nameEl)   nameEl.textContent  = session.name || session.email;
  if (emailEl)  emailEl.value       = session.email;
  if (catEl)    catEl.value         = role;
  if (roleEl)   roleEl.textContent  = role.toUpperCase() + ' — NCB Approved';
  if (avatarEl) avatarEl.textContent= ROLE_EMOJI[role] || '🏢';
}

// ── QR MANAGER ──
function loadQRTree(batchId) {
  const tree = document.getElementById('qr-manager-tree');
  if (!tree) return;
  if (batchId) {
    tree.style.display = 'block';
  } else {
    tree.style.display = 'none';
  }
}

// ── BATCH CREATION ──
function calcWaste() {
  const raw    = parseFloat(document.querySelector('#section-mfr-create-batch input[placeholder="e.g. 500"]')?.value) || 0;
  const output = parseFloat(document.querySelector('#section-mfr-create-batch input[placeholder="e.g. 450"]')?.value) || 0;
  const wasteEl = document.getElementById('waste-calc');
  const wasteText = document.getElementById('waste-text');
  if (!wasteEl || !wasteText) return;

  if (raw > 0 && output > 0) {
    const waste = raw - output;
    wasteEl.style.display = 'flex';
    if (waste < 0) {
      wasteText.textContent = '⚠️ Output cannot exceed raw material!';
      wasteEl.style.background = 'rgba(192,57,43,0.08)';
    } else {
      wasteText.textContent = `⚖️ Waste/Loss: ${waste}kg will be logged as WASTE001`;
      wasteEl.style.background = 'rgba(246,129,0,0.07)';
    }
  }
}

function previewQR() {
  const drums  = parseInt(document.getElementById('drum-count')?.value) || 0;
  const preview = document.getElementById('qr-preview');
  const tree   = document.getElementById('qr-tree');

  if (drums > 0 && drums <= 20) {
    if (!preview || !tree) return;
    preview.style.display = 'block';
    tree.innerHTML = `
      <div class="qr-node master">
        🔲 MASTER QR — CHEM004 (Full batch)
      </div>
      ${Array.from({length: drums}, (_, i) => `
        <div class="qr-node child">
          ↳ 🔲 CHEM004-D0${i+1} (Drum ${i+1} of ${drums})
        </div>
      `).join('')}
    `;
  } else {
    if (preview) preview.style.display = 'none';
  }
}

function createBatch() {
  showToast('✅ Batch CHEM004 created! ' + (document.getElementById('drum-count')?.value || 0) + ' QR codes generated. Blockchain record saved.', 'success');
}

// ── DISPATCH SCAN ──
function simulateScan() {
  showToast('📷 QR Scanner opening... (Use real camera on mobile)', 'info');
  setTimeout(() => {
    const df = document.getElementById('dispatch-form');
    if (df) df.style.display = 'block';
    const sb = document.querySelector('.scan-box');
    if (sb) sb.style.opacity = '0.5';
  }, 1000);
}

// ── DISTRIBUTOR RECEIVE SCAN ──
function simulateDistScan() {
  showToast('📷 Scanning QR...', 'info');
  setTimeout(() => {
    const dr = document.getElementById('dist-receive-form');
    if (dr) dr.style.display = 'block';
    document.querySelectorAll('.scan-box').forEach(b => { if (b) b.style.opacity = '0.5'; });
  }, 800);
}

// ── CONSUMER RECEIVE SCAN ──
function simulateConScan() {
  showToast('📷 Scanning QR...', 'info');
  setTimeout(() => {
    const cr = document.getElementById('con-receive-form');
    if (cr) cr.style.display = 'block';
  }, 800);
}

// ── MISMATCH CHECK ──
function checkMismatch(received) {
  const expected = 100;
  const alert = document.getElementById('mismatch-alert');
  if (!alert) return;
  if (received && parseFloat(received) !== expected) {
    alert.style.display = 'block';
  } else {
    alert.style.display = 'none';
  }
}

// ── MASS BALANCE ──
let mbUsed = 0;
function calcMassBalance(used) {
  mbUsed = parseFloat(used) || 0;
  updateMassBalance();
}
function calcMassBalance2(actual) {
  if (mbUsed <= 0) return;
  const actualUnits   = parseFloat(actual) || 0;
  const expectedUnits = mbUsed * 100; // 1kg = 100 tablets (demo formula)
  const resultEl  = document.getElementById('mass-balance-result');
  const usedEl    = document.getElementById('mb-used');
  const expEl     = document.getElementById('mb-expected');
  const actEl     = document.getElementById('mb-actual');
  const statusEl  = document.getElementById('mb-status');
  const resultRow = document.getElementById('mb-result-row');
  if (!resultEl || !usedEl || !expEl || !actEl || !statusEl || !resultRow) return;

  resultEl.style.display = 'block';
  usedEl.textContent  = mbUsed + ' kg';
  expEl.textContent   = expectedUnits.toLocaleString() + ' tablets (formula)';
  actEl.textContent   = actualUnits.toLocaleString() + ' tablets';

  const diff = Math.abs(expectedUnits - actualUnits);
  const pct  = (diff / expectedUnits) * 100;

  if (pct <= 5) {
    statusEl.textContent       = '✅ MATCH — Normal production';
    statusEl.style.color       = 'var(--green)';
    resultRow.style.background = 'rgba(51,122,18,0.05)';
  } else if (pct <= 15) {
    statusEl.textContent       = '⚠️ MINOR MISMATCH — Review required';
    statusEl.style.color       = 'var(--orange)';
    resultRow.style.background = 'rgba(246,129,0,0.05)';
  } else {
    statusEl.textContent       = '🚨 CRITICAL MISMATCH — NCB Alert raised!';
    statusEl.style.color       = 'var(--red)';
    resultRow.style.background = 'rgba(192,57,43,0.06)';
    showToast('🚨 Mass Balance Mismatch! NCB has been automatically alerted.', 'error');
  }
}
function updateMassBalance() {}

// ── TOAST ──
function showToast(msg, type = 'info') {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.className = 'toast ' + type;
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => toast.classList.remove('show'), 3500);
}
