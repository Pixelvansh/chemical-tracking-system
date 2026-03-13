// ================================================
// ChemTrack India — Login Page JS
// Full details save on register for admin preview
// ================================================

// ── TAB SWITCHING ──
function switchTab(tab) {
  const tabs = ['login', 'register', 'admin'];
  document.querySelectorAll('.tab-btn').forEach((btn, i) => {
    btn.classList.toggle('active', tabs[i] === tab);
  });
  document.querySelectorAll('.form-section').forEach(s => {
    s.classList.remove('active');
  });
  const tabEl = document.getElementById('tab-' + tab);
  if (tabEl) tabEl.classList.add('active');
}

// ── CATEGORY SELECT ──
function selectCategory(cat, el) {
  document.querySelectorAll('.category-card').forEach(c => {
    c.classList.remove('selected');
  });
  el.classList.add('selected');

  document.querySelectorAll('.dynamic-fields').forEach(f => {
    f.style.display = 'none';
  });

  const fields = document.getElementById('fields-' + cat);
  if (fields) fields.style.display = 'block';

  document.getElementById('reg-form-body').style.display = 'block';

  setTimeout(() => {
    document.getElementById('reg-form-body').scrollIntoView({
      behavior: 'smooth', block: 'start'
    });
  }, 100);
}

// ── FILE UPLOAD ──
function showFileName(input, nameId) {
  const el = document.getElementById(nameId);
  if (el && input.files[0]) {
    el.textContent = '✓ ' + input.files[0].name;
    el.style.display = 'block';
    el.style.color = 'var(--green)';
  }
}

// ── PASSWORD TOGGLE ──
function togglePass(id, btn) {
  const input = document.getElementById(id);
  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = '🙈';
  } else {
    input.type = 'password';
    btn.textContent = '👁';
  }
}

// ── ALERT HELPERS ──
function showAlert(id, msg, type) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.className = 'alert alert-' + type + ' show';
}

function hideAlert(id) {
  const el = document.getElementById(id);
  if (el) { el.className = 'alert'; el.textContent = ''; }
}

// ── GET / SAVE USERS ──
function getUsers() {
  return JSON.parse(localStorage.getItem('chemtrack_users') || '[]');
}

function saveUsers(users) {
  localStorage.setItem('chemtrack_users', JSON.stringify(users));
}

// ── SAFE INPUT READER ──
function readInput(selector) {
  try {
    const el = document.querySelector(selector);
    return el ? el.value.trim() : '';
  } catch(e) { return ''; }
}

function readId(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

// ── ROLE TO DASHBOARD PAGE MAP ──
// Approved hone ke baad har role apne dedicated page pe jayega
function getDashboardPage(category) {
  const map = {
    manufacturer: 'manufacturer.html',
    distributor:  'distributor.html',
    supplier:     'supplier.html',
    consumer:     'consumer.html',
    retailer:     'retailer.html',
    exporter:     'exporter.html'
  };
  return map[category] || 'dashboard.html';
}

// ================================================
// LOGIN HANDLER
// ================================================
function handleLogin() {
  const email = (document.getElementById('login-email')?.value || '').trim();
  const pass  = (document.getElementById('login-password')?.value || '').trim();

  hideAlert('login-alert');
  const pendingBoxEl = document.getElementById('pending-box');
  if (pendingBoxEl) pendingBoxEl.style.display = 'none';

  if (!email || !email.includes('@')) {
    document.getElementById('err-login-email').classList.add('show');
    return;
  }
  document.getElementById('err-login-email').classList.remove('show');

  if (!pass) {
    document.getElementById('err-login-pass').classList.add('show');
    return;
  }
  document.getElementById('err-login-pass').classList.remove('show');

  const users = getUsers();
  const user  = users.find(u => u.email === email && u.password === pass);

  if (!user) {
    showAlert('login-alert', '❌ Invalid email or password.', 'error');
    return;
  }

  // ── STATUS CHECKS — pending/rejected/suspended = blocked ──

  if (user.status === 'pending') {
    const pendingBoxEl2 = document.getElementById('pending-box');
    if (pendingBoxEl2) pendingBoxEl2.style.display = 'flex';
    showAlert('login-alert',
      '⏳ Your registration is under review by NCB. Please wait 3–5 working days. Login is blocked until NCB approval.',
      'warning');
    return;
  }

  if (user.status === 'rejected') {
    showAlert('login-alert',
      '❌ Registration rejected. Reason: ' +
      (user.rejectReason || 'Documents incomplete') +
      '. Please contact NCB helpdesk or re-register.',
      'error');
    return;
  }

  if (user.status === 'suspended') {
    showAlert('login-alert',
      '🚫 Your account has been suspended by NCB. Contact NCB helpdesk.',
      'error');
    return;
  }

  // ✅ ONLY allow login if explicitly 'approved'
  if (user.status === 'approved') {
    // Save full session with all details
    localStorage.setItem('chemtrack_session', JSON.stringify({
      id:          user.id,
      email:       user.email,
      name:        user.companyName || user.email,
      role:        user.category,
      status:      'approved',
      companyName: user.companyName  || '',
      ownerName:   user.ownerName    || '',
      designation: user.designation  || '',
      phone:       user.phone        || '',
      state:       user.state        || '',
      city:        user.city         || '',
      address:     user.address      || '',
      gst:         user.gst          || '',
      urn:         user.urn          || '',
      pan:         user.pan          || '',
      approvedAt:  user.approvedAt   || '',
      registeredAt:user.registeredAt || ''
    }));

    const page = getDashboardPage(user.category);
    showAlert('login-alert',
      '✓ Login successful! Redirecting to your dashboard...', 'success');
    setTimeout(() => { window.location.href = page; }, 1500);
    return;
  }

  // Fallback: unknown/missing status — block login
  showAlert('login-alert',
    '⚠️ Account status unknown. Please contact NCB helpdesk.',
    'error');
}

// ================================================
// REGISTER HANDLER — saves ALL form details
// ================================================
function handleRegister() {
  const catEl   = document.querySelector('input[name="cat"]:checked');
  const email   = readId('reg-email');
  const pass    = readId('reg-pass');
  const confirm = readId('reg-pass-confirm');
  const agreed  = document.getElementById('reg-agree')?.checked;

  hideAlert('register-alert');

  // ── Validations ──
  if (!catEl) {
    showAlert('register-alert',
      '⚠️ Please select your firm category first.', 'error');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  if (!email || !email.includes('@')) {
    showAlert('register-alert',
      '⚠️ Please enter a valid official email.', 'error');
    return;
  }

  if (pass.length < 8) {
    showAlert('register-alert',
      '⚠️ Password must be at least 8 characters.', 'error');
    return;
  }

  if (pass !== confirm) {
    document.getElementById('err-pass-match')?.classList.add('show');
    showAlert('register-alert', '⚠️ Passwords do not match.', 'error');
    return;
  }
  document.getElementById('err-pass-match')?.classList.remove('show');

  if (!agreed) {
    showAlert('register-alert',
      '⚠️ Please accept the declaration to proceed.', 'error');
    return;
  }

  // Check duplicate email
  const users = getUsers();
  if (users.find(u => u.email === email)) {
    showAlert('register-alert',
      '⚠️ This email is already registered. Please login instead.', 'error');
    return;
  }

  const cat = catEl.value;

  // ── Collect ALL common form fields ──
  const companyName = readInput('#reg-form-body input[placeholder="Legal company name"]');
  const urn         = readInput('#reg-form-body input[placeholder="NCB URN number"]');
  const gst         = readInput('#reg-form-body input[placeholder="22AAAAA0000A1Z5"]');
  const pan         = readInput('#reg-form-body input[placeholder="ABCDE1234F"]');
  const city        = readInput('#reg-form-body input[placeholder="City name"]');
  const address     = readInput('#reg-form-body input[placeholder="Street, Area, Pincode"]');
  const ownerName   = readInput('#reg-form-body input[placeholder="Full name"]');
  const designation = readInput('#reg-form-body input[placeholder="MD / CEO / Partner"]');
  const phone       = readInput('#reg-form-body input[placeholder="+91 XXXXX XXXXX"]');

  // State select
  const stateEl = document.querySelector('#reg-form-body select.form-input');
  const state   = stateEl ? stateEl.value : '';

  // ── Category specific fields ──
  let catData = {};

  if (cat === 'manufacturer') {
    catData = {
      cbnLicense: readInput('#fields-manufacturer input[placeholder="CBN Mfg License No."]'),
      capacity:   readInput('#fields-manufacturer input[placeholder="e.g. 5000"]'),
      chemicals:  Array.from(
        document.querySelectorAll('#fields-manufacturer input[type="checkbox"]:checked')
      ).map(cb => cb.parentElement.textContent.trim())
    };
  } else if (cat === 'distributor') {
    catData = {
      distLicense: readInput('#fields-distributor input[placeholder="State Drug License No."]'),
      serviceArea: (() => {
        const sel = document.querySelector('#fields-distributor select');
        return sel ? sel.value : '';
      })(),
      warehouse: readInput('#fields-distributor input[placeholder="Warehouse / Storage location"]')
    };
  } else if (cat === 'supplier') {
    catData = {
      wdlNumber:    readInput('#fields-supplier input[placeholder="WDL Number"]'),
      rawMaterials: readInput('#fields-supplier input[placeholder="e.g. Acetic Acid, Glacial"]')
    };
  } else if (cat === 'consumer') {
    catData = {
      drugLicense: readInput('#fields-consumer input[placeholder="Form 20/21 number"]'),
      monthlyNeed: readInput('#fields-consumer input[placeholder="Estimated kg/month"]'),
      purpose: (() => {
        const sel = document.querySelector('#fields-consumer select');
        return sel ? sel.value : '';
      })()
    };
  } else if (cat === 'retailer') {
    catData = {
      retailLicense: readInput('#fields-retailer input[placeholder="RDL Number"]'),
      shopReg:       readInput('#fields-retailer input[placeholder="Shop Act Number"]')
    };
  } else if (cat === 'exporter') {
    catData = {
      iecCode:         readInput('#fields-exporter input[placeholder="Import Export Code"]'),
      dgft:            readInput('#fields-exporter input[placeholder="DGFT number"]'),
      exportCountries: readInput('#fields-exporter input[placeholder="e.g. USA, Germany, Japan"]'),
      exportVolume:    readInput('#fields-exporter input[placeholder="Estimated kg/year"]')
    };
  }

  // ── Check uploaded docs ──
  const docs = {
    gst:     !!(document.getElementById('gst-cert')?.files?.[0] ||
                document.getElementById('gst-name')?.textContent),
    urn:     !!(document.getElementById('urn-cert')?.files?.[0] ||
                document.getElementById('urn-name')?.textContent),
    license: !!(
      document.getElementById('mfr-license')?.files?.[0]  ||
      document.getElementById('dist-license')?.files?.[0] ||
      document.getElementById('supp-license')?.files?.[0] ||
      document.getElementById('cons-license')?.files?.[0] ||
      document.getElementById('ret-license')?.files?.[0]  ||
      document.getElementById('iec-cert')?.files?.[0]
    )
  };

  // ── Build full user object ──
  const newUser = {
    id:           Date.now(),
    email:        email,
    password:     pass,
    category:     cat,
    status:       'pending',
    registeredAt: new Date().toISOString(),

    // Company details
    companyName:  companyName,
    urn:          urn,
    gst:          gst,
    pan:          pan,
    state:        state,
    city:         city,
    address:      address,

    // Contact person
    ownerName:    ownerName,
    designation:  designation,
    phone:        phone,

    // Documents upload status
    docs: docs,

    // Category specific fields
    ...catData
  };

  users.push(newUser);
  saveUsers(users);

  showAlert('register-alert',
    '✅ Registration submitted successfully! NCB will review your documents in 3–5 working days. Login will be enabled only after NCB approval.',
    'success');

  // Switch to login tab after 3 seconds
  setTimeout(() => {
    switchTab('login');
    hideAlert('register-alert');
  }, 3000);
}

// ================================================
// ADMIN LOGIN — 3 Attempt Freeze System
// ================================================
let adminAttempts = 0;
const MAX_ATTEMPTS = 3;
let freezeTimer = null;

const ADMIN_CREDENTIALS = {
  email:    'admin@ncb.gov.in',
  password: 'Admin@1234',
  passkey1: '12345678',
  passkey2: '87654321'
};

function handleAdminLogin() {
  const email = document.getElementById('admin-email').value.trim();
  const pass  = document.getElementById('admin-password').value.trim();
  const pk1   = document.getElementById('admin-pk1').value.trim();
  const pk2   = document.getElementById('admin-pk2').value.trim();

  hideAlert('admin-alert');

  if (!email || !pass || !pk1 || !pk2) {
    showAlert('admin-alert',
      '⚠️ All fields are required for admin login.', 'error');
    return;
  }

  const isValid = (
    email === ADMIN_CREDENTIALS.email    &&
    pass  === ADMIN_CREDENTIALS.password &&
    pk1   === ADMIN_CREDENTIALS.passkey1 &&
    pk2   === ADMIN_CREDENTIALS.passkey2
  );

  if (isValid) {
    localStorage.setItem('chemtrack_admin', JSON.stringify({
      email:     email,
      role:      'ncb_admin',
      loginTime: new Date().toISOString()
    }));
    showAlert('admin-alert',
      '✓ Authentication successful! Redirecting to Admin Portal...', 'success');
    setTimeout(() => { window.location.href = 'admin-portal.html'; }, 1500);
    return;
  }

  // Failed attempt
  adminAttempts++;
  const remaining = MAX_ATTEMPTS - adminAttempts;

  const dot = document.getElementById('dot-' + adminAttempts);
  if (dot) {
    dot.classList.remove('available');
    dot.classList.add('used');
  }

  if (adminAttempts >= MAX_ATTEMPTS) {
    startFreeze();
    return;
  }

  const msgs = {
    1: '❌ Invalid credentials. 2 attempts remaining.',
    2: '❌ Wrong credentials. ⚠️ LAST ATTEMPT before 1-hour freeze!'
  };
  showAlert('admin-alert', msgs[adminAttempts], 'error');
  document.getElementById('attempt-msg').textContent =
    remaining + ' attempt' + (remaining !== 1 ? 's' : '') + ' remaining';
}

function startFreeze() {
  document.getElementById('admin-form-fields').style.display = 'none';
  document.getElementById('freeze-overlay').classList.add('show');
  document.getElementById('attempt-msg').textContent = 'Account frozen for 1 hour';

  let totalSeconds = 60 * 60; // 1 hour
  const timerEl = document.getElementById('freeze-timer');

  freezeTimer = setInterval(() => {
    totalSeconds--;
    const hrs  = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    timerEl.textContent =
      (hrs  > 0 ? String(hrs).padStart(2,'0') + ':' : '') +
      String(mins).padStart(2,'0') + ':' +
      String(secs).padStart(2,'0');

    if (totalSeconds <= 0) {
      clearInterval(freezeTimer);
      adminAttempts = 0;

      ['dot-1','dot-2','dot-3'].forEach(id => {
        const d = document.getElementById(id);
        if (d) { d.classList.remove('used'); d.classList.add('available'); }
      });

      document.getElementById('freeze-overlay').classList.remove('show');
      document.getElementById('admin-form-fields').style.display = 'block';
      document.getElementById('attempt-msg').textContent = '3 attempts before freeze';

      ['admin-email','admin-password','admin-pk1','admin-pk2'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });

      showAlert('admin-alert', 'Account unfrozen. You may try again.', 'warning');
    }
  }, 1000);
}
// ── END login.js ──