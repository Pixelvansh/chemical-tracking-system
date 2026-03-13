function getChain() {
  return JSON.parse(localStorage.getItem('chemtrack_chain') || '[]');
}

function saveChain(data) {
  localStorage.setItem('chemtrack_chain', JSON.stringify(data));
}

// ── GENERATE UNIQUE BARCODE ID ──
function genBarcodeId(prefix) {
  const ts   = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substr(2, 5).toUpperCase();
  return (prefix || 'CTK') + '-' + ts + '-' + rand;
}

// ── CREATE ROOT BARCODE (Supplier → Manufacturer) ──
// Called when supplier dispatches raw material
function createRootBarcode(params) {
  // params: { material, chemicals, qty, fromParty, fromRole, toParty, toRole,
  //           vehicle, driver, permit, gps, supplierUrn, remarks }
  const id = genBarcodeId('RAW');
  const entry = {
    barcodeId:    id,
    parentId:     null,       // root — no parent
    rootId:       id,         // self is root
    level:        1,          // 1=supplier, 2=manufacturer, 3=distributor, 4=retailer
    role:         'supplier',
    qty:          Number(params.qty),
    remainingQty: Number(params.qty),
    material:     params.material,
    chemicals:    params.chemicals || '',
    fromParty:    params.fromParty,
    fromRole:     params.fromRole || 'supplier',
    toParty:      params.toParty,
    toRole:       params.toRole || 'manufacturer',
    supplierUrn:  params.supplierUrn || '',
    vehicle:      params.vehicle || '—',
    driver:       params.driver || '—',
    permit:       params.permit || '—',
    remarks:      params.remarks || '—',
    gpsOrigin:    params.gps || null,
    gpsCurrent:   params.gps || null,
    status:       'dispatched',
    createdAt:    new Date().toISOString(),
    receivedAt:   null,
    chain: [
      {
        step:      1,
        event:     'DISPATCHED',
        by:        params.fromParty,
        role:      params.fromRole || 'supplier',
        to:        params.toParty,
        qty:       Number(params.qty),
        gps:       params.gps || null,
        timestamp: new Date().toISOString(),
        note:      'Root barcode created. Raw material dispatched.'
      }
    ]
  };

  const chain = getChain();
  chain.push(entry);
  saveChain(chain);
  return entry;
}

// ── RECEIVE BARCODE (party receives shipment) ──
function receiveBarcode(barcodeId, receiverParty, receiverRole, gps) {
  const chain = getChain();
  const idx   = chain.findIndex(b => b.barcodeId === barcodeId);
  if (idx === -1) return { error: 'Barcode not found: ' + barcodeId };

  const entry = chain[idx];
  if (entry.status === 'received' || entry.status === 'consumed') {
    return { error: 'Barcode already received/consumed.' };
  }

  entry.status      = 'received';
  entry.receivedAt  = new Date().toISOString();
  entry.gpsCurrent  = gps || entry.gpsCurrent;
  if (!entry.chain) entry.chain = [];  // purane barcodes ke liye fix
  entry.chain.push({
    step:      entry.chain.length + 1,
    event:     'RECEIVED',
    by:        receiverParty,
    role:      receiverRole,
    qty:       entry.qty,
    gps:       gps || null,
    timestamp: new Date().toISOString(),
    note:      'Shipment received and verified.'
  });

  chain[idx] = entry;
  saveChain(chain);
  return entry;
}

// ── MANUFACTURE: raw → finished product barcode ──
// Manufacturer uses received raw, creates new barcode for finished chemical
function createManufacturedBarcode(params) {
  // params: { rawBarcodeId, finishedMaterial, qty, chemicals,
  //           fromParty, toParty, toRole, gps, vehicle, driver, permit }
  const chain      = getChain();
  const rawEntry   = chain.find(b => b.barcodeId === params.rawBarcodeId);
  if (!rawEntry) return { error: 'Source raw barcode not found.' };

  const id = genBarcodeId('MFR');
  const entry = {
    barcodeId:    id,
    parentId:     params.rawBarcodeId,
    rootId:       rawEntry.rootId,
    level:        2,
    role:         'manufacturer',
    qty:          Number(params.qty),
    remainingQty: Number(params.qty),
    material:     params.finishedMaterial,
    chemicals:    params.chemicals || rawEntry.chemicals,
    rawSource:    params.rawBarcodeId,
    fromParty:    params.fromParty,
    fromRole:     'manufacturer',
    toParty:      params.toParty,
    toRole:       params.toRole || 'distributor',
    vehicle:      params.vehicle || '—',
    driver:       params.driver || '—',
    permit:       params.permit || '—',
    gpsOrigin:    params.gps || null,
    gpsCurrent:   params.gps || null,
    status:       'dispatched',
    createdAt:    new Date().toISOString(),
    receivedAt:   null,
    chain: [
      {
        step:      1,
        event:     'MANUFACTURED',
        by:        params.fromParty,
        role:      'manufacturer',
        qty:       Number(params.qty),
        gps:       params.gps || null,
        timestamp: new Date().toISOString(),
        note:      'Manufactured from raw: ' + params.rawBarcodeId
      }
    ]
  };

  // Mark raw barcode as consumed
  const rawIdx = chain.findIndex(b => b.barcodeId === params.rawBarcodeId);
  if (rawIdx !== -1) {
    chain[rawIdx].status = 'consumed';
    chain[rawIdx].chain.push({
      step:      chain[rawIdx].chain.length + 1,
      event:     'CONSUMED',
      by:        params.fromParty,
      role:      'manufacturer',
      qty:       Number(params.qty),
      gps:       params.gps || null,
      timestamp: new Date().toISOString(),
      note:      'Used in manufacturing. Output barcode: ' + id
    });
  }

  chain.push(entry);
  saveChain(chain);
  return entry;
}

// ── SPLIT BARCODE (Distributor splits to multiple retailers) ──
// Returns array of new child barcodes
function splitBarcode(params) {
  // params: { parentBarcodeId, splits: [{qty, toParty, toRole, gps, vehicle}],
  //           byParty, gps }
  const chain  = getChain();
  const pIdx   = chain.findIndex(b => b.barcodeId === params.parentBarcodeId);
  if (pIdx === -1) return { error: 'Parent barcode not found.' };

  const parent    = chain[pIdx];
  const totalSplit = params.splits.reduce((s, x) => s + Number(x.qty), 0);

  if (totalSplit > parent.remainingQty) {
    return { error: `Split total (${totalSplit} kg) exceeds remaining qty (${parent.remainingQty} kg).` };
  }

  const newBarcodes = [];

  params.splits.forEach(split => {
    const id = genBarcodeId('DST');
    const entry = {
      barcodeId:    id,
      parentId:     params.parentBarcodeId,
      rootId:       parent.rootId,
      level:        parent.level + 1,
      role:         'distributor',
      qty:          Number(split.qty),
      remainingQty: Number(split.qty),
      material:     parent.material,
      chemicals:    parent.chemicals,
      fromParty:    params.byParty,
      fromRole:     'distributor',
      toParty:      split.toParty,
      toRole:       split.toRole || 'retailer',
      vehicle:      split.vehicle || '—',
      driver:       split.driver || '—',
      permit:       split.permit || '—',
      gpsOrigin:    params.gps || null,
      gpsCurrent:   params.gps || null,
      status:       'dispatched',
      createdAt:    new Date().toISOString(),
      receivedAt:   null,
      chain: [
        {
          step:      1,
          event:     'SPLIT_DISPATCHED',
          by:        params.byParty,
          role:      'distributor',
          qty:       Number(split.qty),
          gps:       params.gps || null,
          timestamp: new Date().toISOString(),
          note:      'Split from parent: ' + params.parentBarcodeId
        }
      ]
    };
    chain.push(entry);
    newBarcodes.push(entry);
  });

  // Update parent remaining qty
  chain[pIdx].remainingQty -= totalSplit;
  chain[pIdx].chain.push({
    step:      chain[pIdx].chain.length + 1,
    event:     'SPLIT',
    by:        params.byParty,
    role:      'distributor',
    qty:       totalSplit,
    gps:       params.gps || null,
    timestamp: new Date().toISOString(),
    note:      `Split into ${params.splits.length} parts. Remaining: ${chain[pIdx].remainingQty} kg`
  });

  if (chain[pIdx].remainingQty <= 0) {
    chain[pIdx].status = 'fully_split';
  }

  saveChain(chain);
  return { success: true, barcodes: newBarcodes, parent: chain[pIdx] };
}

// ── FIND BARCODE ──
function findBarcode(id) {
  return getChain().find(b => b.barcodeId === id) || null;
}

// ── GET FULL TREE of a root barcode ──
function getTree(rootId) {
  const chain = getChain();
  return chain.filter(b => b.rootId === rootId);
}

// ── RENDER QR CODE into a div ──
// div must be empty; uses qrcodejs library
function renderQR(containerId, text, size) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '';
  if (typeof QRCode === 'undefined') {
    el.innerHTML = '<small style="color:gray">QR lib loading...</small>';
    return;
  }
  new QRCode(el, {
    text:         text,
    width:        size || 160,
    height:       size || 160,
    colorDark:    '#132C54',
    colorLight:   '#ffffff',
    correctLevel: QRCode.CorrectLevel.H
  });
}

// ── PRINT QR ──
function printQR(barcodeId) {
  const entry = findBarcode(barcodeId);
  if (!entry) { alert('Barcode not found.'); return; }

  const win = window.open('', '_blank');
  win.document.write(`
    <!DOCTYPE html><html><head>
    <title>ChemTrack QR — ${barcodeId}</title>
    <style>
      body { font-family: sans-serif; padding: 20px; text-align: center; }
      .qr-wrap { display:inline-block; border: 2px solid #132C54; padding: 16px; border-radius: 8px; }
      h2 { color:#132C54; margin:0 0 8px; font-size:1rem; }
      p  { margin:2px 0; font-size:0.78rem; color:#555; }
      .bid { font-size:0.7rem; font-family:monospace; color:#132C54; margin-top:8px; }
    </style>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"><\/script>
    </head><body>
    <div class="qr-wrap">
      <h2>ChemTrack India — NCB</h2>
      <div id="qr"></div>
      <p><strong>${entry.material}</strong> — ${entry.qty} kg</p>
      <p>From: ${entry.fromParty} → To: ${entry.toParty}</p>
      <p>Date: ${new Date(entry.createdAt).toLocaleDateString('en-IN')}</p>
      <p class="bid">${barcodeId}</p>
    </div>
    <script>
      window.onload = function() {
        new QRCode(document.getElementById('qr'), {
          text: '${barcodeId}',
          width: 180, height: 180,
          colorDark: '#132C54', colorLight: '#ffffff'
        });
        setTimeout(() => window.print(), 800);
      };
    <\/script>
    </body></html>
  `);
  win.document.close();
}

// ── GET GPS LABEL ──
function gpsLabel(gps) {
  if (!gps) return 'Unknown';
  if (typeof gps === 'string') return gps;
  return gps.city || (gps.lat + ', ' + gps.lng);
}

// ── SIMULATED CITY GPS (for demo tracking) ──
const CITY_GPS = {
  'Delhi':     { lat: 28.6139, lng: 77.2090, city: 'Delhi' },
  'Mumbai':    { lat: 19.0760, lng: 72.8777, city: 'Mumbai' },
  'Chennai':   { lat: 13.0827, lng: 80.2707, city: 'Chennai' },
  'Kolkata':   { lat: 22.5726, lng: 88.3639, city: 'Kolkata' },
  'Bangalore': { lat: 12.9716, lng: 77.5946, city: 'Bangalore' },
  'Hyderabad': { lat: 17.3850, lng: 78.4867, city: 'Hyderabad' },
  'Pune':      { lat: 18.5204, lng: 73.8567, city: 'Pune' },
  'Ahmedabad': { lat: 23.0225, lng: 72.5714, city: 'Ahmedabad' },
  'Jaipur':    { lat: 26.9124, lng: 75.7873, city: 'Jaipur' },
  'Lucknow':   { lat: 26.8467, lng: 80.9462, city: 'Lucknow' }
};

function getCityGPS(cityName) {
  return CITY_GPS[cityName] || { lat: 20.5937, lng: 78.9629, city: cityName || 'India' };
}

// ── END barcode-engine.js ──

// ================================================
// LIVE LOCATION TRACKER (localStorage based)
// Same device/browser mein admin ko live dikhta hai
// ================================================

// Storage key: chemtrack_live_locations
// Format: { [userEmail]: { lat, lng, city, accuracy, timestamp, role, companyName, status } }

function getLiveLocations() {
  return JSON.parse(localStorage.getItem('chemtrack_live_locations') || '{}');
}

function saveLiveLocations(data) {
  localStorage.setItem('chemtrack_live_locations', JSON.stringify(data));
}

// ── START LIVE TRACKING for a user ──
// Call this on dashboard load (supplier/manufacturer/distributor)
let _liveTrackInterval = null;
let _liveTrackSession  = null;

function startLiveTracking(session) {
  if (!session || !session.email) return;
  _liveTrackSession = session;

  // Ask permission and get first fix immediately
  _captureAndSaveLoc();

  // Then update every 10 seconds
  _liveTrackInterval = setInterval(_captureAndSaveLoc, 10000);

  // Stop tracking when tab closes
  window.addEventListener('beforeunload', stopLiveTracking);
}

function stopLiveTracking() {
  if (_liveTrackInterval) clearInterval(_liveTrackInterval);

  // Mark user as offline
  if (_liveTrackSession) {
    const locs = getLiveLocations();
    if (locs[_liveTrackSession.email]) {
      locs[_liveTrackSession.email].status = 'offline';
      locs[_liveTrackSession.email].offlineAt = new Date().toISOString();
      saveLiveLocations(locs);
    }
  }
}

function _captureAndSaveLoc() {
  if (!_liveTrackSession) return;

  if (!navigator.geolocation) {
    _saveLocEntry({ error: 'Geolocation not supported' });
    return;
  }

  navigator.geolocation.getCurrentPosition(
    function(pos) {
      _saveLocEntry({
        lat:      pos.coords.latitude,
        lng:      pos.coords.longitude,
        accuracy: Math.round(pos.coords.accuracy),
        error:    null
      });
    },
    function(err) {
      // Permission denied or unavailable — save last known or error
      const locs = getLiveLocations();
      const last = locs[_liveTrackSession.email];
      if (last && last.lat) {
        // Keep last known, just update timestamp
        last.timestamp = new Date().toISOString();
        last.status    = 'stale';
        locs[_liveTrackSession.email] = last;
        saveLiveLocations(locs);
      } else {
        _saveLocEntry({ error: err.message });
      }
    },
    { enableHighAccuracy: true, timeout: 8000, maximumAge: 5000 }
  );
}

function _saveLocEntry(pos) {
  const s    = _liveTrackSession;
  const locs = getLiveLocations();

  locs[s.email] = {
    email:       s.email,
    companyName: s.companyName || s.name || s.email,
    role:        s.role,
    lat:         pos.lat  || null,
    lng:         pos.lng  || null,
    accuracy:    pos.accuracy || null,
    error:       pos.error || null,
    timestamp:   new Date().toISOString(),
    status:      pos.error ? 'error' : 'live'
  };

  saveLiveLocations(locs);
}

// ── GET FORMATTED TIME AGO ──
function timeAgoSeconds(iso) {
  if (!iso) return '—';
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 15)  return '🟢 Just now';
  if (diff < 60)  return '🟡 ' + diff + 's ago';
  if (diff < 300) return '🟠 ' + Math.floor(diff/60) + 'm ago';
  return '🔴 ' + Math.floor(diff/60) + 'm ago (may be offline)';
}

// ── END live location tracker ──
// ================================================

// ================================================
// UNIFIED REQUEST SYSTEM — ChemTrack India
// chemtrack_requests[] — sabke liye ek store
// type: 'dist_request'     → Distributor → Manufacturer
//       'retail_request'   → Retailer    → Distributor
//       'consumer_request' → Consumer    → Retailer
// ================================================
function getAllRequests() {
  return JSON.parse(localStorage.getItem('chemtrack_requests') || '[]');
}
function saveAllRequests(data) {
  localStorage.setItem('chemtrack_requests', JSON.stringify(data));
}
function createRequest(params) {
  var req = {
    requestId: 'REQ-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substr(2,4).toUpperCase(),
    type:      params.type,
    fromParty: params.fromParty, fromEmail: params.fromEmail || '',
    fromUrn:   params.fromUrn || '', toParty: params.toParty || '',
    toEmail:   params.toEmail || '', material: params.material,
    qty:       Number(params.qty), chemicals: params.chemicals || '',
    notes:     params.notes || '', status: 'pending', barcodeId: null,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  };
  var all = getAllRequests(); all.push(req); saveAllRequests(all);
  return req;
}
function acceptRequest(requestId) {
  var all = getAllRequests();
  var idx = all.findIndex(function(r){ return r.requestId === requestId; });
  if (idx === -1) return { error: 'Not found.' };
  all[idx].status = 'accepted'; all[idx].updatedAt = new Date().toISOString();
  saveAllRequests(all); return all[idx];
}
function rejectRequest(requestId, reason) {
  var all = getAllRequests();
  var idx = all.findIndex(function(r){ return r.requestId === requestId; });
  if (idx === -1) return { error: 'Not found.' };
  all[idx].status = 'rejected'; all[idx].rejectNote = reason || '';
  all[idx].updatedAt = new Date().toISOString(); saveAllRequests(all);
  return all[idx];
}
function linkRequestToBarcode(requestId, barcodeId) {
  var all = getAllRequests();
  var idx = all.findIndex(function(r){ return r.requestId === requestId; });
  if (idx !== -1) {
    all[idx].barcodeId = barcodeId; all[idx].status = 'fulfilled';
    all[idx].updatedAt = new Date().toISOString(); saveAllRequests(all);
  }
}
function getOutgoingRequests(fromEmail) {
  return getAllRequests().filter(function(r){ return r.fromEmail === fromEmail; });
}
// ── END UNIFIED REQUEST SYSTEM ──