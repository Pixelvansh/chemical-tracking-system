// Auto-refresh every 5 seconds
setInterval(function(){
  loadStats();
  loadRetailerOrders();
  loadRecentActivity();
  loadReceivedBatches();
  loadMyMfrRequests();
  loadInventory();
}, 5000);

// ChemTrack India — Distributor Dashboard JS (Updated with Request System)
const session = JSON.parse(localStorage.getItem('chemtrack_session') || '{}');
let splitRowCount = 0, currentParentForSplit = null, verifiedBarcodeForReceive = null;

function showSection(name, el) {
  document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
  const sec = document.getElementById('section-' + name); if (sec) sec.classList.add('active');
  if (el) el.classList.add('active'); return false;
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

  else { sidebar.style.width='0px'; main.style.marginLeft='0'; }
}
function distLogout() { if (confirm('Logout?')) { localStorage.removeItem('chemtrack_session'); window.location.href='login.html'; } }
function getDistDispatches() { return JSON.parse(localStorage.getItem('dist_dispatches_'+session.id)||'[]'); }
function saveDistDispatches(d) { localStorage.setItem('dist_dispatches_'+session.id, JSON.stringify(d)); }
function getFullUserData() { return (JSON.parse(localStorage.getItem('chemtrack_users')||'[]')).find(u => u.email===session.email) || {}; }
function formatDate(iso) { if (!iso) return '—'; return new Date(iso).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}); }
function statusBadge(s) { return '<span class="status-badge '+s+'">'+s.replace(/_/g,' ').toUpperCase()+'</span>'; }

function getMyReceivedBatches() {
  const myName = session.companyName||session.name||'';
  return (JSON.parse(localStorage.getItem('chemtrack_chain')||'[]')).filter(b => b.toParty===myName && b.toRole==='distributor');
}
function getRetailerRequests() {
  const myName=session.companyName||session.name||'', myEmail=session.email||'';
  return getAllRequests().filter(r => r.type==='retail_request' && r.status==='pending' && (!r.toEmail||r.toEmail===myEmail||!r.toParty||r.toParty===myName));
}

function initDashboard() {
  const fullUser=getFullUserData(), name=session.companyName||session.name||'Distributor';
  const set=(id,v)=>{ const el=document.getElementById(id); if(el) el.textContent=v; };
  set('nav-company-name',name); set('sidebar-urn','URN: '+(session.urn||fullUser.urn||'N/A'));
  set('welcome-msg','Welcome, '+name); set('welcome-sub','NCB Approved Distributor — '+(session.state||fullUser.state||''));
  populateCityDropdowns();
  loadStats(); loadRecentActivity(); loadReceivedBatches(); loadInventory();
  loadMyMfrRequests(); loadRetailerOrders(); loadQRCodes(); loadHistory(); loadProfile(fullUser);
}

function populateCityDropdowns() {
  ['dist-receive-city','split-city'].forEach(id => {
    const el=document.getElementById(id); if(!el) return;
    el.innerHTML='<option value="">-- Select City --</option>';
    Object.keys(CITY_GPS).forEach(c => el.innerHTML+='<option value="'+c+'">'+c+'</option>');
  });
}

function loadStats() {
  const batches=getMyReceivedBatches(), dispatches=getDistDispatches(), retailReqs=getRetailerRequests();
  const totalStock = batches.filter(b=>b.status==='received').reduce((s,b)=>s+Number(b.remainingQty||0),0);
  const set=(id,v)=>{ const el=document.getElementById(id); if(el) el.textContent=v; };
  set('stat-stock',totalStock+' kg'); set('stat-received',batches.filter(b=>b.status==='received'||b.status==='fully_split').length);
  set('stat-splits',dispatches.length); set('stat-retailers',new Set(dispatches.map(d=>d.toParty)).size);
  const badge=document.getElementById('badge-retail-orders');
  if(badge){ badge.textContent=retailReqs.length; badge.style.display=retailReqs.length>0?'flex':'none'; }
}

function loadRecentActivity() {
  const tbody=document.getElementById('recent-tbody'); if(!tbody) return;
  const all=[
    ...getMyReceivedBatches().map(b => ({id:b.barcodeId, material:b.material, qty:b.qty, action:'RECEIVED',     party:b.fromParty,  date:b.receivedAt||b.createdAt, status:b.status})),
    ...getDistDispatches().map(d  => ({id:d.barcodeId, material:d.material, qty:d.qty, action:'SPLIT→RETAIL',  party:d.toParty,    date:d.createdAt,                status:d.status})),
    ...getRetailerRequests().map(r => ({id:r.requestId, material:r.material, qty:r.qty, action:'RETAIL ORDER',  party:r.fromParty,  date:r.createdAt,                status:r.status}))
  ];
  all.sort((a,b)=>new Date(b.date)-new Date(a.date));
  if(!all.length){ tbody.innerHTML='<tr><td colspan="6" class="empty-td">No activity yet.</td></tr>'; return; }
  tbody.innerHTML=all.slice(0,8).map(a=>'<tr><td><code class="barcode-code-sm">'+a.id+'</code></td><td>'+a.material+'</td><td>'+a.qty+' kg</td><td>'+a.action+'</td><td>'+formatDate(a.date)+'</td><td>'+statusBadge(a.status)+'</td></tr>').join('');
}

// ── DISTRIBUTOR → MANUFACTURER REQUEST ──
function submitManufacturerRequest() {
  const material=document.getElementById('mfr-req-material')?.value.trim();
  const qty=document.getElementById('mfr-req-qty')?.value.trim();
  const chemicals=document.getElementById('mfr-req-chemicals')?.value.trim();
  const mfrName=document.getElementById('mfr-req-mfr-name')?.value.trim();
  const mfrEmail=document.getElementById('mfr-req-mfr-email')?.value.trim();
  const notes=document.getElementById('mfr-req-notes')?.value.trim();
  if(!material||!qty||!mfrName){ showAlertInline('mfr-req-alert','⚠️ Material, Qty, Manufacturer Name required.','warning'); return; }
  const req=createRequest({ type:'dist_request', fromParty:session.companyName||session.name, fromEmail:session.email, fromUrn:session.urn||'', toParty:mfrName, toEmail:mfrEmail||'', material, qty:Number(qty), chemicals, notes });
  showAlertInline('mfr-req-alert','✅ Request <strong>'+req.requestId+'</strong> sent to Manufacturer: '+mfrName+'!','success');
  ['mfr-req-material','mfr-req-qty','mfr-req-chemicals','mfr-req-mfr-name','mfr-req-mfr-email','mfr-req-notes'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  loadMyMfrRequests(); loadStats();
  showToast('📤 Request sent to Manufacturer!','success');
}

function loadMyMfrRequests() {
  const tbody=document.getElementById('my-mfr-requests-tbody'); if(!tbody) return;
  const reqs=getAllRequests().filter(r=>r.type==='dist_request'&&r.fromEmail===session.email);
  if(!reqs.length){ tbody.innerHTML='<tr><td colspan="7" class="empty-td">No orders sent yet.</td></tr>'; return; }
  tbody.innerHTML=[...reqs].reverse().map(r=>
    '<tr><td><strong>'+r.requestId+'</strong></td><td>'+r.toParty+'</td><td>'+r.material+'</td><td>'+r.qty+' kg</td><td>'+statusBadge(r.status)+'</td><td>'+(r.barcodeId?'<code class="barcode-code-sm">'+r.barcodeId+'</code>':'—')+'</td><td>'+formatDate(r.createdAt)+'</td></tr>'
  ).join('');
}

// ── RETAILER ORDERS ──
function loadRetailerOrders() {
  const tbody=document.getElementById('retail-orders-tbody'); if(!tbody) return;
  const myEmail=session.email||'', myName=session.companyName||session.name||'';
  const fullUser2=JSON.parse(localStorage.getItem('chemtrack_users')||'[]').find(u=>u&&u.email===session.email)||{};
  const myName2=(fullUser2.companyName||fullUser2.name||'').toLowerCase();
  const all=getAllRequests().filter(r=>{
    if(r.type!=='retail_request') return false;
    if(r.status==='rejected') return false;
    const te=(r.toEmail||'').toLowerCase(), tp=(r.toParty||'').toLowerCase();
    if(!te&&!tp) return true;
    if(te&&te===myEmail.toLowerCase()) return true;
    const mn=myName.toLowerCase(), mn2=myName2;
    if(tp&&(tp===mn||tp===mn2||mn.includes(tp)||tp.includes(mn)||mn2.includes(tp)||tp.includes(mn2))) return true;
    return false;
  });
  if(!all.length){ tbody.innerHTML='<tr><td colspan="7" class="empty-td">No orders from retailers yet.</td></tr>'; return; }
  tbody.innerHTML=[...all].reverse().map(r=>{
    let actions;
    if(r.status==='pending') actions='<button class="btn-sm btn-green" onclick="acceptRetailOrder(\''+r.requestId+'\')">✅ Accept</button> <button class="btn-sm btn-red" onclick="rejectRetailOrder(\''+r.requestId+'\')">❌ Reject</button>';
    else if(r.status==='accepted') actions='<button class="btn-sm btn-blue" onclick="fulfillRetailOrder(\''+r.requestId+'\')">✂️ Fulfill</button>';
    else actions=statusBadge(r.status);
    return '<tr><td><strong>'+r.requestId+'</strong></td><td>'+r.fromParty+'</td><td>'+r.material+'</td><td>'+r.qty+' kg</td><td>'+(r.notes||'—')+'</td><td>'+formatDate(r.createdAt)+'</td><td>'+actions+'</td></tr>';
  }).join('');
}

function acceptRetailOrder(requestId) {
  acceptRequest(requestId); loadRetailerOrders(); loadStats(); loadRecentActivity();
  showToast('✅ Retailer order accepted! Fulfill via Split.','success');
}
function rejectRetailOrder(requestId) {
  if(!confirm('Reject?')) return;
  rejectRequest(requestId,'Rejected by distributor.'); loadRetailerOrders(); loadStats();
  showToast('Order rejected.','info');
}
function fulfillRetailOrder(requestId) {
  const req=getAllRequests().find(r=>r.requestId===requestId); if(!req) return;
  showSection('split', null);
  document.querySelectorAll('.sidebar-item').forEach(i=>i.classList.remove('active'));
  setTimeout(()=>{
    const ridEl=document.getElementById('split-retail-req-id');
    if(ridEl) ridEl.value=requestId;
    if(!document.getElementById('split-row-1')) addSplitRow();
    const toEl=document.getElementById('split-to-1'), qtyEl=document.getElementById('split-qty-1'), urnEl=document.getElementById('split-urn-1');
    if(toEl)  toEl.value=req.fromParty;
    if(qtyEl) { qtyEl.value=req.qty; updateSplitTotal(); }
    if(urnEl) urnEl.value=req.fromUrn||'';
    showAlertInline('split-alert','📋 Retailer order pre-filled: <strong>'+req.fromParty+'</strong> — '+req.qty+' kg of <strong>'+req.material+'</strong>. Parent barcode load karo.','info');
  },200);
  showToast('📋 Retailer order pre-filled in Split!','info');
}

// ── RECEIVE SHIPMENT ──
function verifyDistReceive() {
  const id=document.getElementById('receive-barcode-id').value.trim();
  if(!id){ showAlertInline('receive-alert','⚠️ Enter barcode ID.','warning'); return; }
  const entry=findBarcode(id), resultDiv=document.getElementById('dist-verify-result'), formDiv=document.getElementById('dist-confirm-form');
  if(!entry){ resultDiv.innerHTML='<div class="alert alert-error show">❌ Barcode not found: '+id+'</div>'; formDiv.style.display='none'; verifiedBarcodeForReceive=null; return; }
  if(entry.status!=='dispatched'){ resultDiv.innerHTML='<div class="alert alert-warning show">⚠️ Status is "'+entry.status+'". Must be dispatched.</div>'; formDiv.style.display='none'; verifiedBarcodeForReceive=null; return; }
  verifiedBarcodeForReceive=id;
  resultDiv.innerHTML='<div class="scan-found"><h4>✅ Barcode Verified</h4><table class="detail-table"><tr><td>Material</td><td><strong>'+entry.material+'</strong></td></tr><tr><td>Qty</td><td>'+entry.qty+' kg</td></tr><tr><td>From Manufacturer</td><td>'+entry.fromParty+'</td></tr><tr><td>Chemicals</td><td>'+(entry.chemicals||'—')+'</td></tr><tr><td>Parent</td><td>'+(entry.parentId||'Root')+'</td></tr></table></div>';
  formDiv.style.display='block';
  showAlertInline('receive-alert','✅ Valid barcode. Confirm receipt below.','success');
}

function confirmDistReceive() {
  if(!verifiedBarcodeForReceive){ showAlertInline('receive-alert','⚠️ Verify a barcode first.','warning'); return; }
  const city=document.getElementById('dist-receive-city').value;
  const gps=city?getCityGPS(city):null;
  const result=receiveBarcode(verifiedBarcodeForReceive, session.companyName||session.name, 'distributor', gps);
  if(result.error){ showAlertInline('receive-alert','❌ '+result.error,'error'); return; }
  const allReqs=getAllRequests();
  const linked=allReqs.find(r=>r.barcodeId===verifiedBarcodeForReceive&&r.type==='dist_request'&&r.fromEmail===session.email);
  if(linked){ const idx=allReqs.findIndex(r=>r.requestId===linked.requestId); if(idx!==-1){ allReqs[idx].status='received'; saveAllRequests(allReqs); } }
  showAlertInline('receive-alert','✅ Received! Barcode '+verifiedBarcodeForReceive+' inventory mein hai.','success');
  document.getElementById('dist-confirm-form').style.display='none';
  verifiedBarcodeForReceive=null;
  loadStats(); loadRecentActivity(); loadReceivedBatches(); loadInventory(); loadMyMfrRequests(); loadHistory();
  showToast('📦 Shipment received!','success');
}

function loadReceivedBatches() {
  const tbody=document.getElementById('dist-received-tbody'); if(!tbody) return;
  const batches=getMyReceivedBatches();
  if(!batches.length){ tbody.innerHTML='<tr><td colspan="8" class="empty-td">No batches received yet.</td></tr>'; return; }
  tbody.innerHTML=[...batches].reverse().map(b=>
    '<tr><td><code class="barcode-code-sm">'+b.barcodeId+'</code></td><td>'+b.material+'</td><td>'+b.qty+' kg</td><td><strong>'+b.remainingQty+' kg</strong></td><td>'+b.fromParty+'</td><td>'+formatDate(b.receivedAt)+'</td><td>📍 '+gpsLabel(b.gpsCurrent)+'</td><td>'+(b.status==='received'?'<button class="btn-sm btn-green" onclick="loadParentDirect(\''+b.barcodeId+'\')">✂️ Split</button>':statusBadge(b.status))+'</td></tr>'
  ).join('');
}

function loadInventory() {
  const tbody=document.getElementById('inventory-tbody'); if(!tbody) return;
  const batches=getMyReceivedBatches().filter(b=>b.status==='received'||b.status==='fully_split');
  if(!batches.length){ tbody.innerHTML='<tr><td colspan="6" class="empty-td">No inventory.</td></tr>'; return; }
  tbody.innerHTML=batches.map(b=>
    '<tr><td><code class="barcode-code-sm">'+b.barcodeId+'</code></td><td>'+b.material+'</td><td>'+b.qty+' kg</td><td><strong>'+b.remainingQty+' kg</strong></td><td>'+statusBadge(b.status)+'</td><td>'+(b.status==='received'?'<button class="btn-sm btn-green" onclick="loadParentDirect(\''+b.barcodeId+'\')">✂️ Split</button>':'—')+'</td></tr>'
  ).join('');
}

function loadParentDirect(barcodeId) {
  document.getElementById('split-parent-id').value=barcodeId;
  loadParentForSplit();
  showSection('split', null);
  document.querySelectorAll('.sidebar-item').forEach(i=>i.classList.remove('active'));
}

// ── SPLIT & DISPATCH ──
function loadParentForSplit() {
  const id=document.getElementById('split-parent-id').value.trim();
  if(!id){ showAlertInline('split-alert','⚠️ Enter barcode ID.','warning'); return; }
  const entry=findBarcode(id), infoDiv=document.getElementById('split-parent-info'), formDiv=document.getElementById('split-form'), qrDiv=document.getElementById('split-qr-results');
  if(!entry){ infoDiv.innerHTML='<div class="alert alert-error show">❌ Barcode not found.</div>'; formDiv.style.display='none'; currentParentForSplit=null; return; }
  if(entry.status!=='received'){ infoDiv.innerHTML='<div class="alert alert-warning show">⚠️ Barcode must be "received". Current: '+entry.status+'</div>'; formDiv.style.display='none'; currentParentForSplit=null; return; }
  currentParentForSplit=id;
  infoDiv.innerHTML='<div class="scan-found" style="margin-top:1rem"><h4>✅ Batch Loaded</h4><table class="detail-table"><tr><td>Barcode</td><td><code>'+entry.barcodeId+'</code></td></tr><tr><td>Material</td><td><strong>'+entry.material+'</strong></td></tr><tr><td>Total Qty</td><td>'+entry.qty+' kg</td></tr><tr><td>Remaining</td><td><strong>'+entry.remainingQty+' kg</strong></td></tr><tr><td>From</td><td>'+entry.fromParty+'</td></tr></table></div>';
  document.getElementById('split-remaining-label').textContent='Available: '+entry.remainingQty+' kg';
  formDiv.style.display='block'; if(qrDiv) qrDiv.style.display='none';
  document.getElementById('split-rows').innerHTML=''; splitRowCount=0; addSplitRow();
  showAlertInline('split-alert','📦 Batch loaded. Retailer splits add karo below.','info');
}

function addSplitRow() {
  splitRowCount++;
  const row=document.createElement('div'); row.className='split-row'; row.id='split-row-'+splitRowCount;
  row.innerHTML='<div class="split-row-header"><strong>Retailer '+splitRowCount+'</strong><button class="btn-sm btn-red" onclick="removeSplitRow('+splitRowCount+')">✕</button></div><div class="form-grid"><div class="form-group"><label>Retailer Name <span class="req">*</span></label><input type="text" id="split-to-'+splitRowCount+'" class="form-input" placeholder="Retailer company name"/></div><div class="form-group"><label>Retailer URN</label><input type="text" id="split-urn-'+splitRowCount+'" class="form-input" placeholder="NCB URN"/></div><div class="form-group"><label>Quantity (kg) <span class="req">*</span></label><input type="number" id="split-qty-'+splitRowCount+'" class="form-input" placeholder="e.g. 50" oninput="updateSplitTotal()"/></div><div class="form-group"><label>Vehicle No.</label><input type="text" id="split-veh-'+splitRowCount+'" class="form-input" placeholder="MH12AB1234"/></div></div>';
  document.getElementById('split-rows').appendChild(row);
}

function removeSplitRow(n) { const r=document.getElementById('split-row-'+n); if(r) r.remove(); updateSplitTotal(); }

function updateSplitTotal() {
  if(!currentParentForSplit) return;
  const parent=findBarcode(currentParentForSplit); if(!parent) return;
  let total=0;
  for(let i=1;i<=splitRowCount;i++){ const el=document.getElementById('split-qty-'+i); if(el&&el.value) total+=Number(el.value); }
  const rem=parent.remainingQty-total, label=document.getElementById('split-remaining-label');
  if(label){ label.textContent='Available: '+parent.remainingQty+' kg | Allocated: '+total+' kg | After split: '+rem+' kg'; label.style.color=rem<0?'red':'var(--navy)'; }
}

function submitSplit() {
  if(!currentParentForSplit){ showAlertInline('split-alert','⚠️ Load a batch first.','warning'); return; }
  const city=document.getElementById('split-city').value, vehicle=document.getElementById('split-vehicle').value.trim();
  const ridEl=document.getElementById('split-retail-req-id'), linkedReqId=ridEl?ridEl.value.trim():'';
  const gps=city?getCityGPS(city):null;
  const splits=[];
  for(let i=1;i<=splitRowCount;i++){
    const toEl=document.getElementById('split-to-'+i), qtyEl=document.getElementById('split-qty-'+i);
    const urnEl=document.getElementById('split-urn-'+i), vehEl=document.getElementById('split-veh-'+i);
    if(!toEl||!qtyEl||!toEl.value.trim()||!qtyEl.value) continue;
    splits.push({ toParty:toEl.value.trim(), toRole:'retailer', qty:Number(qtyEl.value), urn:urnEl?urnEl.value.trim():'', vehicle:vehEl?vehEl.value.trim()||vehicle:vehicle, gps });
  }
  if(!splits.length){ showAlertInline('split-alert','⚠️ At least one retailer split required.','warning'); return; }
  const result=splitBarcode({ parentBarcodeId:currentParentForSplit, splits, byParty:session.companyName||session.name, gps });
  if(result.error){ showAlertInline('split-alert','❌ '+result.error,'error'); return; }
  if(linkedReqId&&result.barcodes.length>0){ linkRequestToBarcode(linkedReqId, result.barcodes[0].barcodeId); if(ridEl) ridEl.value=''; }
  const dispatches=getDistDispatches(); result.barcodes.forEach(b=>dispatches.push(Object.assign({},b))); saveDistDispatches(dispatches);
  showAlertInline('split-alert','✅ Split complete! '+result.barcodes.length+' barcodes generated. Retailers scan karke receive karenge.','success');
  const qrDiv=document.getElementById('split-qr-results'), qrGrid=document.getElementById('split-qr-grid');
  if(qrDiv) qrDiv.style.display='block';
  if(qrGrid) qrGrid.innerHTML=result.barcodes.map(b=>'<div class="qr-card"><div class="qr-card-top"><div id="split-qr-'+b.barcodeId+'"></div></div><div class="qr-card-info"><strong>'+b.material+'</strong><span>'+b.qty+' kg</span><span>→ '+b.toParty+'</span><code class="barcode-code-sm">'+b.barcodeId.slice(0,22)+'...</code></div><div class="qr-card-actions"><button class="btn-sm" onclick="printQR(\''+b.barcodeId+'\')">🖨 Print</button><button class="btn-sm btn-blue" onclick="viewChainModal(\''+b.barcodeId+'\')">🔗 Chain</button></div></div>').join('');
  setTimeout(()=>result.barcodes.forEach(b=>renderQR('split-qr-'+b.barcodeId,b.barcodeId,100)),100);
  loadStats(); loadRecentActivity(); loadReceivedBatches(); loadInventory(); loadRetailerOrders(); loadQRCodes(); loadHistory();
  showToast('✂️ '+result.barcodes.length+' barcodes split & dispatched!','success');
  currentParentForSplit=null;
}

function loadQRCodes() {
  const container=document.getElementById('qr-cards-grid'); if(!container) return;
  const all=[...getMyReceivedBatches(),...getDistDispatches()];
  if(!all.length){ container.innerHTML='<div class="empty-state"><span>🔲</span><p>No QR codes yet.</p></div>'; return; }
  container.innerHTML=all.map(d=>{
    const bid=d.barcodeId;
    return '<div class="qr-card"><div class="qr-card-top"><div id="qr-mini-'+bid+'"></div></div><div class="qr-card-info"><strong>'+d.material+'</strong><span>'+d.qty+' kg</span><span class="barcode-small">'+(d.toRole==='retailer'?'→ '+d.toParty:'← FROM '+d.fromParty)+'</span><code class="barcode-code-sm">'+bid.slice(0,22)+'...</code><span>'+statusBadge(d.status)+'</span></div><div class="qr-card-actions"><button class="btn-sm" onclick="printQR(\''+bid+'\')">🖨 Print</button><button class="btn-sm btn-blue" onclick="viewChainModal(\''+bid+'\')">🔗 Chain</button></div></div>';
  }).join('');
  setTimeout(()=>all.forEach(d=>renderQR('qr-mini-'+d.barcodeId,d.barcodeId,100)),100);
}

function loadHistory() {
  const tbody=document.getElementById('history-tbody'); if(!tbody) return;
  const myEmail=session.email||'', myName=session.companyName||session.name||'';
  const mfrReqs=getAllRequests().filter(r=>r.type==='dist_request'&&r.fromEmail===myEmail);
  const retailReqs=getAllRequests().filter(r=>r.type==='retail_request'&&(!r.toEmail||r.toEmail===myEmail||!r.toParty||r.toParty===myName));
  const rows=[
    ...getMyReceivedBatches().map(b=>({id:b.barcodeId, type:'RECEIVED',    material:b.material, qty:b.qty, party:b.fromParty, date:b.receivedAt||b.createdAt, status:b.status})),
    ...getDistDispatches().map(d  =>({id:d.barcodeId, type:'SPLIT→RETAIL', material:d.material, qty:d.qty, party:d.toParty,   date:d.createdAt,                status:d.status})),
    ...mfrReqs.map(r             =>({id:r.requestId, type:'MFR REQUEST',  material:r.material, qty:r.qty, party:r.toParty,   date:r.createdAt,                status:r.status})),
    ...retailReqs.map(r          =>({id:r.requestId, type:'RETAIL ORDER', material:r.material, qty:r.qty, party:r.fromParty, date:r.createdAt,                status:r.status}))
  ];
  rows.sort((a,b)=>new Date(b.date)-new Date(a.date));
  if(!rows.length){ tbody.innerHTML='<tr><td colspan="8" class="empty-td">No history.</td></tr>'; return; }
  tbody.innerHTML=rows.map((r,i)=>'<tr><td>'+(i+1)+'</td><td><code class="barcode-code-sm">'+r.id+'</code></td><td>'+r.type+'</td><td>'+r.material+'</td><td>'+r.qty+' kg</td><td>'+r.party+'</td><td>'+formatDate(r.date)+'</td><td>'+statusBadge(r.status)+'</td></tr>').join('');
}

function scanQR() {
  const val=document.getElementById('scan-input')?.value.trim(); if(!val){ showToast('Enter barcode ID.','warning'); return; }
  const entry=findBarcode(val), result=document.getElementById('scan-result');
  if(!entry){ result.innerHTML='<div class="alert alert-error show">❌ Not found: '+val+'</div>'; return; }
  result.innerHTML='<div class="scan-found"><h4>✅ Barcode Found</h4><table class="detail-table"><tr><td>Barcode ID</td><td><code>'+entry.barcodeId+'</code></td></tr><tr><td>Type</td><td>'+(entry.parentId?'Child (Parent: '+entry.parentId+')':'Root')+'</td></tr><tr><td>Material</td><td>'+entry.material+'</td></tr><tr><td>Qty</td><td>'+entry.qty+' kg</td></tr><tr><td>Remaining</td><td>'+entry.remainingQty+' kg</td></tr><tr><td>From</td><td>'+entry.fromParty+'</td></tr><tr><td>To</td><td>'+entry.toParty+'</td></tr><tr><td>Status</td><td>'+statusBadge(entry.status)+'</td></tr></table><button class="btn-sm btn-blue" onclick="viewChainModal(\''+entry.barcodeId+'\')">🔗 View Chain</button></div>';
}

function viewChainModal(barcodeId) {
  const entry=findBarcode(barcodeId); if(!entry){ showToast('Barcode not in chain.','warning'); return; }
  const tree=getTree(entry.rootId);
  let html='<div class="chain-timeline">';
  entry.chain.forEach(step=>{ html+='<div class="chain-step"><div class="chain-dot"></div><div class="chain-content"><strong>'+step.event+'</strong><span>'+step.by+' ('+step.role+')</span><span>'+new Date(step.timestamp).toLocaleString('en-IN')+'</span><span>'+step.note+'</span>'+(step.gps?'<span>📍 '+gpsLabel(step.gps)+'</span>':'')+'</div></div>'; });
  html+='</div><div style="margin-top:1rem"><strong>All chain barcodes ('+tree.length+'):</strong><div style="display:flex;flex-wrap:wrap;gap:0.5rem;margin-top:0.5rem">'+tree.map(b=>'<code class="barcode-code-sm">'+b.barcodeId+' ('+b.qty+'kg)</code>').join('')+'</div></div>';
  document.getElementById('chain-modal-id').textContent=barcodeId;
  document.getElementById('chain-modal-material').textContent=entry.material+' — '+entry.qty+' kg';
  document.getElementById('chain-modal-body').innerHTML=html;
  renderQR('chain-modal-qr',barcodeId,120);
  document.getElementById('chain-modal').classList.add('show');
}

function loadProfile(fullUser) {
  const u=fullUser,s=session,set=(id,v)=>{ const el=document.getElementById(id); if(el) el.textContent=v||'—'; };
  set('prof-company',s.companyName||u.companyName); set('prof-email',s.email);
  set('prof-phone',s.phone||u.phone); set('prof-owner',s.ownerName||u.ownerName);
  set('prof-state',s.state||u.state); set('prof-gst',s.gst||u.gst);
  set('prof-urn',s.urn||u.urn); set('prof-dist',u.distLicense);
}

function closeModal(id) { document.getElementById(id)?.classList.remove('show'); }
function showAlertInline(id,msg,type){ const el=document.getElementById(id); if(!el) return; el.innerHTML=msg; el.className='alert alert-'+type+' show'; }
function hideAlert(id){ const el=document.getElementById(id); if(el){ el.className='alert'; el.textContent=''; } }
function showToast(msg,type='info'){
  let t=document.getElementById('toast'); if(!t){ t=document.createElement('div'); t.id='toast'; document.body.appendChild(t); }
  t.textContent=msg; t.className='toast '+type;
  setTimeout(()=>t.classList.add('show'),10); setTimeout(()=>t.classList.remove('show'),3500);
}
document.addEventListener('DOMContentLoaded',()=>{ initDashboard(); startLiveTracking(session); });