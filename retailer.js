// Auto-refresh every 5 seconds
setInterval(function(){
  loadStats();
  loadMyDistRequests();
  loadConsumerOrders();
  loadDispatchConsumer();
  loadRecentReceipts();
  loadStock();
}, 5000);

// ChemTrack India — Retailer Dashboard JS (Updated with Request System)
const session = JSON.parse(localStorage.getItem('chemtrack_session') || '{}');
let verifiedBarcodeForReceive = null;

function showSection(name, el) {
  document.querySelectorAll('.content-section').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.sidebar-item').forEach(i=>i.classList.remove('active'));
  const sec=document.getElementById('section-'+name); if(sec) sec.classList.add('active');
  if(el) el.classList.add('active'); return false;
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

  else{ sidebar.style.width='0px'; main.style.marginLeft='0'; }
}
function retailerLogout(){ if(confirm('Logout?')){ localStorage.removeItem('chemtrack_session'); window.location.href='login.html'; } }
function getReceipts(){ return JSON.parse(localStorage.getItem('retailer_receipts_'+session.id)||'[]'); }
function saveReceipts(d){ localStorage.setItem('retailer_receipts_'+session.id, JSON.stringify(d)); }
function getStock(){ return JSON.parse(localStorage.getItem('retailer_stock_'+session.id)||'[]'); }
function saveStock(d){ localStorage.setItem('retailer_stock_'+session.id, JSON.stringify(d)); }
function getFullUserData(){ return (JSON.parse(localStorage.getItem('chemtrack_users')||'[]')).find(u=>u.email===session.email)||{}; }
function formatDate(iso){ if(!iso) return '—'; return new Date(iso).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}); }
function statusBadge(s){ return '<span class="status-badge '+s+'">'+s.replace(/_/g,' ').toUpperCase()+'</span>'; }

function getConsumerRequests(){
  const myName=session.companyName||session.name||'', myEmail=session.email||'';
  return getAllRequests().filter(r=>r.type==='consumer_request'&&r.status==='pending'&&(!r.toEmail||r.toEmail===myEmail||!r.toParty||r.toParty===myName));
}

function initDashboard(){
  const fullUser=getFullUserData(), name=session.companyName||session.name||'Retailer';
  const set=(id,v)=>{ const el=document.getElementById(id); if(el) el.textContent=v; };
  set('nav-company-name',name); set('sidebar-urn','URN: '+(session.urn||fullUser.urn||'N/A'));
  set('welcome-msg','Welcome, '+name); set('welcome-sub','NCB Approved Retailer — '+(session.state||fullUser.state||''));
  populateCityDropdowns();
  loadStats(); loadRecentReceipts(); loadStock(); loadConsumerOrders(); loadDispatchConsumer();
  loadMyDistRequests(); loadHistory(); loadProfile(fullUser);
}

function populateCityDropdowns(){
  ['retailer-receive-city'].forEach(id=>{ const el=document.getElementById(id); if(!el) return; el.innerHTML='<option value="">-- Select City --</option>'; Object.keys(CITY_GPS).forEach(c=>el.innerHTML+='<option value="'+c+'">'+c+'</option>'); });
}

function loadStats(){
  const receipts=getReceipts(), stock=getStock(), consumerReq=getConsumerRequests();
  const totalStock=stock.reduce((s,i)=>s+Number(i.qty||0),0);
  const set=(id,v)=>{ const el=document.getElementById(id); if(el) el.textContent=v; };
  set('stat-stock',totalStock); set('stat-received',receipts.length);
  set('stat-qr',receipts.filter(r=>r.barcodeVerified).length);
  const badge=document.getElementById('badge-consumer-orders');
  if(badge){ badge.textContent=consumerReq.length; badge.style.display=consumerReq.length>0?'flex':'none'; }
}

function loadRecentReceipts(){
  const tbody=document.getElementById('recent-tbody'); if(!tbody) return;
  const receipts=getReceipts();
  if(!receipts.length){ tbody.innerHTML='<tr><td colspan="6" class="empty-td">No receipts yet.</td></tr>'; return; }
  tbody.innerHTML=[...receipts].reverse().slice(0,5).map(r=>'<tr><td><strong>'+r.receiptId+'</strong></td><td>'+r.material+'</td><td>'+r.qty+' kg</td><td>'+(r.distributor||'—')+'</td><td>'+formatDate(r.date)+'</td><td>'+statusBadge(r.status)+'</td></tr>').join('');
}

// ── RETAILER → DISTRIBUTOR REQUEST ──
function submitDistributorRequest(){
  const material=document.getElementById('dist-req-material')?.value.trim();
  const qty=document.getElementById('dist-req-qty')?.value.trim();
  const chemicals=document.getElementById('dist-req-chemicals')?.value.trim();
  const distName=document.getElementById('dist-req-dist-name')?.value.trim();
  const distEmail=document.getElementById('dist-req-dist-email')?.value.trim();
  const notes=document.getElementById('dist-req-notes')?.value.trim();
  if(!material||!qty||!distName){ showAlertInline('dist-req-alert','⚠️ Material, Qty, Distributor Name required.','warning'); return; }
  const req=createRequest({ type:'retail_request', fromParty:session.companyName||session.name, fromEmail:session.email, fromUrn:session.urn||'', toParty:distName, toEmail:distEmail||'', material, qty:Number(qty), chemicals, notes });
  showAlertInline('dist-req-alert','✅ Request <strong>'+req.requestId+'</strong> sent to Distributor: '+distName+'!','success');
  ['dist-req-material','dist-req-qty','dist-req-chemicals','dist-req-dist-name','dist-req-dist-email','dist-req-notes'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  loadMyDistRequests(); loadStats();
  showToast('📤 Request sent to Distributor!','success');
}

function loadMyDistRequests(){
  const tbody=document.getElementById('my-dist-requests-tbody'); if(!tbody) return;
  const reqs=getAllRequests().filter(r=>r.type==='retail_request'&&r.fromEmail===session.email);
  if(!reqs.length){ tbody.innerHTML='<tr><td colspan="7" class="empty-td">No orders sent yet.</td></tr>'; return; }
  tbody.innerHTML=[...reqs].reverse().map(r=>'<tr><td><strong>'+r.requestId+'</strong></td><td>'+r.toParty+'</td><td>'+r.material+'</td><td>'+r.qty+' kg</td><td>'+statusBadge(r.status)+'</td><td>'+(r.barcodeId?'<code class="barcode-code-sm">'+r.barcodeId+'</code>':'—')+'</td><td>'+formatDate(r.createdAt)+'</td></tr>').join('');
}

// ── CONSUMER ORDERS ──
function loadConsumerOrders(){
  const tbody=document.getElementById('consumer-orders-tbody'); if(!tbody) return;
  const myEmail=session.email||'', myName=session.companyName||session.name||'';
  const all=getAllRequests().filter(r=>{
    if(r.type!=='consumer_request') return false;
    if(!r.toEmail && !r.toParty) return true;
    const te=(r.toEmail||'').toLowerCase().trim(), tp=(r.toParty||'').toLowerCase().trim();
    const me=myEmail.toLowerCase().trim(), mn=myName.toLowerCase().trim();
    if(te && te===me) return true;
    if(tp && (tp===mn || tp.includes(mn) || mn.includes(tp))) return true;
    return false;
  });
  if(!all.length){ tbody.innerHTML='<tr><td colspan="7" class="empty-td">No orders from consumers yet.</td></tr>'; return; }
  tbody.innerHTML=[...all].reverse().map(r=>{
    let actions;
    if(r.status==='pending') actions='<button class="btn-sm btn-green" onclick="acceptConsumerOrder(\''+r.requestId+'\')">✅ Accept</button> <button class="btn-sm btn-red" onclick="rejectConsumerOrder(\''+r.requestId+'\')">❌ Reject</button>';
    else if(r.status==='accepted') actions='<button class="btn-sm btn-orange" onclick="fulfillConsumerOrder(\''+r.requestId+'\')">📦 Dispatch to Consumer</button>';
    else actions=statusBadge(r.status);
    return '<tr><td><strong>'+r.requestId+'</strong></td><td>'+r.fromParty+'</td><td>'+r.material+'</td><td>'+r.qty+' kg</td><td>'+(r.notes||'—')+'</td><td>'+formatDate(r.createdAt)+'</td><td>'+actions+'</td></tr>';
  }).join('');
}

function acceptConsumerOrder(requestId){ acceptRequest(requestId); loadConsumerOrders(); loadStats(); showToast('✅ Consumer order accepted! Ab dispatch karo.','success'); }
function rejectConsumerOrder(requestId){ if(!confirm('Reject?')) return; rejectRequest(requestId,'Rejected by retailer.'); loadConsumerOrders(); loadStats(); showToast('Order rejected.','info'); }

function fulfillConsumerOrder(requestId){
  const req = getAllRequests().find(r => r.requestId === requestId);
  if(!req){ showToast('Request not found.','error'); return; }
  const stock = getStock();
  const stockItem = stock.find(s => s.material && s.material.toLowerCase() === (req.material||'').toLowerCase());
  if(!stockItem || stockItem.qty < req.qty){
    showAlertInline('consumer-order-alert', '❌ Insufficient stock! Available: '+(stockItem?stockItem.qty+' kg':'0 kg')+', Required: '+req.qty+' kg', 'error');
    return;
  }
  const barcodeId = 'RET-'+Date.now().toString(36).toUpperCase()+'-'+Math.random().toString(36).substr(2,4).toUpperCase();
  const gps = getCityGPS(session.state || '') || null;
  const chain = JSON.parse(localStorage.getItem('chemtrack_chain')||'[]');
  chain.push({
    barcodeId, type:'RET', material:req.material, qty:req.qty,
    fromParty: session.companyName||session.name, fromEmail:session.email,
    toParty: req.fromParty, toEmail:req.fromEmail,
    status:'dispatched', parentId: null,
    chain: [{ step:1, event:'DISPATCHED', by:session.companyName||session.name, role:'retailer', qty:req.qty, gps:null, timestamp:new Date().toISOString(), note:'Dispatched to consumer.' }],
    gps: gps ? (gps.lat+','+gps.lng) : null,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  });
  localStorage.setItem('chemtrack_chain', JSON.stringify(chain));
  stockItem.qty -= req.qty;
  stockItem.lastUpdated = new Date().toISOString();
  saveStock(stock);
  const allReqs = getAllRequests();
  const idx = allReqs.findIndex(r => r.requestId === requestId);
  if(idx !== -1){ allReqs[idx].status = 'fulfilled'; allReqs[idx].barcodeId = barcodeId; saveAllRequests(allReqs); }

  // ── QR + Barcode display ──
  const qrId = 'fulfill-qr-'+barcodeId;
  const alertDiv = document.getElementById('consumer-order-alert');
  if(alertDiv){
    alertDiv.innerHTML =
      '<div style="padding:16px;background:#e8f5e9;border:2px solid #4caf50;border-radius:8px">'+
      '<h3 style="margin:0 0 8px;color:#2e7d32">✅ Dispatched Successfully!</h3>'+
      '<p style="margin:0 0 8px">Consumer ko yeh Barcode ID do:</p>'+
      '<div style="background:#fff;border:2px dashed #4caf50;border-radius:6px;padding:12px;text-align:center;margin-bottom:12px">'+
      '<code style="font-size:1.3rem;font-weight:bold;letter-spacing:2px;color:#1a1a1a;user-select:all">'+barcodeId+'</code>'+
      '</div>'+
      '<div style="display:flex;justify-content:center;margin-bottom:10px">'+
      '<div id="'+qrId+'" style="background:#fff;padding:8px;border-radius:8px;border:2px solid #4caf50;display:inline-block"></div>'+
      '</div>'+
      '<p style="margin:0;font-size:0.85rem;color:#555;text-align:center">Consumer → Receive Chemical → paste karo → Verify → Confirm</p>'+
      '</div>';
    alertDiv.className = 'alert show';
    alertDiv.scrollIntoView({behavior:'smooth', block:'start'});
    setTimeout(()=>{ if(typeof renderQR==='function') renderQR(qrId, barcodeId, 130); }, 300);
  }
  loadConsumerOrders(); loadStats(); loadStock(); loadHistory();
  showToast('📦 Dispatched! Barcode: '+barcodeId,'success');
}

// ── RECEIVE FROM DISTRIBUTOR (barcode scan) ──
function verifyRetailerReceive(){
  const id=document.getElementById('receive-barcode-id')?.value.trim();
  if(!id){ showAlertInline('receive-alert','⚠️ Enter barcode ID.','warning'); return; }
  const entry=findBarcode(id), resultDiv=document.getElementById('retailer-verify-result'), formDiv=document.getElementById('retailer-confirm-form');
  if(!entry){ resultDiv.innerHTML='<div class="alert alert-error show">❌ Barcode not found: '+id+'</div>'; formDiv.style.display='none'; verifiedBarcodeForReceive=null; return; }
  if(entry.status!=='dispatched'){ resultDiv.innerHTML='<div class="alert alert-warning show">⚠️ Status is "'+entry.status+'". Must be dispatched.</div>'; formDiv.style.display='none'; verifiedBarcodeForReceive=null; return; }
  verifiedBarcodeForReceive=id;
  resultDiv.innerHTML='<div class="scan-found"><h4>✅ Barcode Verified</h4><table class="detail-table"><tr><td>Material</td><td><strong>'+entry.material+'</strong></td></tr><tr><td>Qty</td><td>'+entry.qty+' kg</td></tr><tr><td>From Distributor</td><td>'+entry.fromParty+'</td></tr><tr><td>Chemicals</td><td>'+(entry.chemicals||'—')+'</td></tr><tr><td>Parent</td><td>'+(entry.parentId||'—')+'</td></tr></table></div>';
  formDiv.style.display='block';
  showAlertInline('receive-alert','✅ Valid barcode. Confirm receipt below.','success');
}

function confirmRetailerReceive(){
  if(!verifiedBarcodeForReceive){ showAlertInline('receive-alert','⚠️ Verify barcode first.','warning'); return; }
  const city=document.getElementById('retailer-receive-city')?.value;
  const gps=city?getCityGPS(city):null;
  const chain_entry=findBarcode(verifiedBarcodeForReceive);
  const result=receiveBarcode(verifiedBarcodeForReceive, session.companyName||session.name, 'retailer', gps);
  if(result.error){ showAlertInline('receive-alert','❌ '+result.error,'error'); return; }
  const receipts=getReceipts();
  receipts.push({ receiptId:'REC-'+Date.now().toString(36).toUpperCase(), material:chain_entry.material, qty:chain_entry.qty, distributor:chain_entry.fromParty, barcodeId:verifiedBarcodeForReceive, barcodeVerified:true, gps:gps?gpsLabel(gps):'Not captured', status:'received', date:new Date().toISOString() });
  saveReceipts(receipts);
  const stock=getStock(), existing=stock.find(s=>s.material?.toLowerCase()===chain_entry.material.toLowerCase());
  if(existing){ existing.qty+=chain_entry.qty; existing.lastUpdated=new Date().toISOString(); }
  else stock.push({ material:chain_entry.material, qty:chain_entry.qty, distributor:chain_entry.fromParty, lastUpdated:new Date().toISOString() });
  saveStock(stock);
  const allReqs=getAllRequests();
  const linked=allReqs.find(r=>r.barcodeId===verifiedBarcodeForReceive&&r.type==='retail_request'&&r.fromEmail===session.email);
  if(linked){ const idx=allReqs.findIndex(r=>r.requestId===linked.requestId); if(idx!==-1){ allReqs[idx].status='received'; saveAllRequests(allReqs); } }
  showAlertInline('receive-alert','✅ Received! Stock updated. Blockchain recorded.','success');
  document.getElementById('retailer-confirm-form').style.display='none';
  verifiedBarcodeForReceive=null;
  loadStats(); loadRecentReceipts(); loadStock(); loadMyDistRequests(); loadHistory();
  showToast('📦 Stock received & verified!','success');
}

function loadStock(){
  const tbody=document.getElementById('stock-tbody'); if(!tbody) return;
  const stock=getStock();
  if(!stock.length){ tbody.innerHTML='<tr><td colspan="6" class="empty-td">No stock available.</td></tr>'; return; }
  tbody.innerHTML=stock.map((s,i)=>'<tr><td>'+(i+1)+'</td><td><strong>'+s.material+'</strong></td><td>'+s.qty+' kg</td><td>'+(s.distributor||'—')+'</td><td>'+formatDate(s.lastUpdated)+'</td><td>'+statusBadge('verified')+'</td></tr>').join('');
}

function loadHistory(){
  const tbody=document.getElementById('history-tbody'); if(!tbody) return;
  const myEmail=session.email||'', myName=session.companyName||session.name||'';
  const distReqs=getAllRequests().filter(r=>r.type==='retail_request'&&r.fromEmail===myEmail);
  const consumerReqs=getAllRequests().filter(r=>r.type==='consumer_request'&&(!r.toEmail||r.toEmail===myEmail||!r.toParty||r.toParty===myName));
  const rows=[
    ...getReceipts().map(r=>({id:r.receiptId, type:'RECEIVED',      material:r.material, qty:r.qty, party:r.distributor, date:r.date,      status:r.status})),
    ...distReqs.map(r    =>({id:r.requestId, type:'DIST REQUEST',   material:r.material, qty:r.qty, party:r.toParty,    date:r.createdAt,  status:r.status})),
    ...consumerReqs.map(r=>({id:r.requestId, type:'CONSUMER ORDER', material:r.material, qty:r.qty, party:r.fromParty,  date:r.createdAt,  status:r.status}))
  ];
  rows.sort((a,b)=>new Date(b.date)-new Date(a.date));
  if(!rows.length){ tbody.innerHTML='<tr><td colspan="8" class="empty-td">No history.</td></tr>'; return; }
  tbody.innerHTML=rows.map((r,i)=>'<tr><td>'+(i+1)+'</td><td><code class="barcode-code-sm">'+r.id+'</code></td><td>'+r.type+'</td><td>'+r.material+'</td><td>'+r.qty+' kg</td><td>'+r.party+'</td><td>'+formatDate(r.date)+'</td><td>'+statusBadge(r.status)+'</td></tr>').join('');
}

function loadProfile(fullUser){
  const u=fullUser,s=session,set=(id,v)=>{ const el=document.getElementById(id); if(el) el.textContent=v||'—'; };
  set('prof-company',s.companyName||u.companyName); set('prof-company2',s.companyName||u.companyName);
  set('prof-email',s.email); set('prof-phone',s.phone||u.phone);
  set('prof-owner',s.ownerName||u.ownerName); set('prof-designation',s.designation||u.designation);
  set('prof-state',s.state||u.state); set('prof-city',s.city||u.city);
  set('prof-gst',s.gst||u.gst); set('prof-urn',s.urn||u.urn);
  set('prof-pan',s.pan||u.pan); set('prof-retail-license',u.retailLicense);
  set('prof-registered',formatDate(s.registeredAt||u.registeredAt));
  set('prof-approved',formatDate(s.approvedAt||u.approvedAt));
}

function closeModal(id){ document.getElementById(id)?.classList.remove('show'); }
function showAlertInline(id,msg,type){ const el=document.getElementById(id); if(!el) return; el.innerHTML=msg; el.className='alert alert-'+type+' show'; }
function showToast(msg,type='info'){
  let t=document.getElementById('toast'); if(!t){ t=document.createElement('div'); t.id='toast'; document.body.appendChild(t); }
  t.textContent=msg; t.className='toast '+type;
  setTimeout(()=>t.classList.add('show'),10); setTimeout(()=>t.classList.remove('show'),3500);
}
document.addEventListener('DOMContentLoaded',()=>{ initDashboard(); startLiveTracking(session); });

// ── DISPATCH TO CONSUMER SECTION ──
function loadDispatchConsumer(){
  const tbody=document.getElementById('dispatch-consumer-tbody'); if(!tbody) return;
  const myEmail=(session.email||'').toLowerCase();
  const myName=(session.companyName||session.name||'').toLowerCase();
  const fullUser=JSON.parse(localStorage.getItem('chemtrack_users')||'[]').find(u=>u&&u.email===session.email)||{};
  const myName2=(fullUser.companyName||fullUser.name||'').toLowerCase();
  const accepted=getAllRequests().filter(r=>{
    if(r.type!=='consumer_request'||r.status!=='accepted') return false;
    const te=(r.toEmail||'').toLowerCase(), tp=(r.toParty||'').toLowerCase();
    if(!te&&!tp) return true;
    if(te===myEmail) return true;
    if(tp&&(tp===myName||tp===myName2||myName.includes(tp)||tp.includes(myName))) return true;
    return false;
  });
  const badge=document.getElementById('badge-dispatch');
  if(badge){ badge.textContent=accepted.length; badge.style.display=accepted.length?'inline':'none'; }
  if(!accepted.length){ tbody.innerHTML='<tr><td colspan="7" class="empty-td">No accepted orders to dispatch.</td></tr>'; return; }
  tbody.innerHTML=[...accepted].reverse().map(r=>'<tr>'+
    '<td><strong>'+r.requestId+'</strong></td>'+
    '<td>'+r.fromParty+'</td>'+
    '<td>'+r.material+'</td>'+
    '<td>'+r.qty+' kg</td>'+
    '<td>'+(r.notes||'—')+'</td>'+
    '<td>'+formatDate(r.createdAt)+'</td>'+
    '<td><button class="btn-sm btn-green" onclick="doDispatchToConsumer(\''+r.requestId+'\')">🚚 Generate Barcode & Dispatch</button></td>'+
    '</tr>').join('');
}

function doDispatchToConsumer(requestId){
  const allReqs=getAllRequests();
  const req=allReqs.find(r=>r.requestId===requestId);
  if(!req){ showToast('Request not found.','error'); return; }
  const stock=getStock();
  function fuzzyMatch(a, b){
    a=(a||'').toLowerCase().replace(/[^a-z0-9]/g,'');
    b=(b||'').toLowerCase().replace(/[^a-z0-9]/g,'');
    return a===b || a.includes(b) || b.includes(a) ||
           (a.length>4 && b.length>4 && (a.slice(0,5)===b.slice(0,5)));
  }
  const si=stock.findIndex(s=>fuzzyMatch(s.material, req.material));
  const avail=si!==-1?(stock[si].qty||0):0;
  if(si===-1){
    const anyMatch=stock.findIndex(s=>s.qty>0&&s.qty>=req.qty);
    if(anyMatch===-1){
      const alertDiv=document.getElementById('dispatch-consumer-alert');
      if(alertDiv){ alertDiv.innerHTML='❌ No matching stock found for "'+req.material+'". Available: '+stock.map(s=>s.material+' ('+s.qty+'kg)').join(', '); alertDiv.className='alert alert-error show'; }
      return;
    }
  } else if(avail<req.qty){
    const alertDiv=document.getElementById('dispatch-consumer-alert');
    if(alertDiv){ alertDiv.innerHTML='❌ Insufficient stock! Available: '+avail+' kg, Required: '+req.qty+' kg'; alertDiv.className='alert alert-error show'; }
    return;
  }

  // RET barcode generate
  const barcodeId='RET-'+Date.now().toString(36).toUpperCase()+'-'+Math.random().toString(36).substr(2,4).toUpperCase();

  // Chain mein save
  const chain=JSON.parse(localStorage.getItem('chemtrack_chain')||'[]');
  chain.push({ barcodeId, type:'RET', material:req.material, qty:req.qty,
    fromParty:session.companyName||session.name, fromEmail:session.email,
    toParty:req.fromParty, toEmail:req.fromEmail,
    status:'dispatched', parentId:null,
    chain: [{ step:1, event:'DISPATCHED', by:session.companyName||session.name, role:'retailer', qty:req.qty, gps:null, timestamp:new Date().toISOString(), note:'Dispatched to consumer.' }],
    gps:null, createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() });
  localStorage.setItem('chemtrack_chain', JSON.stringify(chain));

  // Stock deduct
  const finalSi=si!==-1?si:stock.findIndex(s=>s.qty>=req.qty);
  if(finalSi!==-1){ stock[finalSi].qty-=req.qty; stock[finalSi].lastUpdated=new Date().toISOString(); saveStock(stock); }

  // Request update
  const idx=allReqs.findIndex(r=>r.requestId===requestId);
  if(idx!==-1){ allReqs[idx].status='dispatched'; allReqs[idx].barcodeId=barcodeId; saveAllRequests(allReqs); }

  // ── Barcode box dikhao ──
  const box=document.getElementById('dispatch-barcode-box');
  const codeEl=document.getElementById('generated-ret-barcode');
  if(box){ box.style.display='block'; box.scrollIntoView({behavior:'smooth'}); }
  if(codeEl) codeEl.textContent=barcodeId;

  // ── QR Code render karo dispatch box ke andar ──
  const qrContainerId='dispatch-qr-'+barcodeId;
  if(box){
    const oldQr=document.getElementById('dispatch-qr-area');
    if(oldQr) oldQr.remove();
    const qrArea=document.createElement('div');
    qrArea.id='dispatch-qr-area';
    qrArea.style.cssText='display:flex;flex-direction:column;align-items:center;margin-top:14px;padding-top:12px;border-top:1px dashed #ccc;';
    qrArea.innerHTML=
      '<p style="margin:0 0 10px;font-size:0.95rem;color:#333;font-weight:600">📱 Consumer QR Code</p>'+
      '<div id="'+qrContainerId+'" style="background:#fff;padding:10px;border-radius:8px;border:2px solid #4caf50;display:inline-block"></div>'+
      '<p style="margin:10px 0 0;font-size:0.82rem;color:#777;text-align:center">Consumer → "Receive Chemical" → Scan ya Paste karo</p>';
    box.appendChild(qrArea);
    setTimeout(()=>{ if(typeof renderQR==='function') renderQR(qrContainerId, barcodeId, 140); }, 300);
  }

  // Alert
  const alertDiv=document.getElementById('dispatch-consumer-alert');
  if(alertDiv){ alertDiv.innerHTML='✅ Dispatched! Consumer ko yeh barcode do: <strong>'+barcodeId+'</strong>'; alertDiv.className='alert alert-success show'; }

  loadDispatchConsumer(); loadStats(); loadStock(); loadConsumerOrders();
  showToast('📦 Dispatched! RET Barcode: '+barcodeId,'success');
}