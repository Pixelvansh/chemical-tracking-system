// ChemTrack India — Consumer Dashboard JS (Updated with Request System)
const session = JSON.parse(localStorage.getItem('chemtrack_session') || '{}');
let verifiedBarcodeForReceive = null;

function showSection(name, el) {
  document.querySelectorAll('.content-section').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.sidebar-item').forEach(i=>i.classList.remove('active'));
  const sec=document.getElementById('section-'+name); if(sec) sec.classList.add('active');
  if(el) el.classList.add('active'); return false;
}
function toggleSidebar() {
  const sidebar=document.getElementById('sidebar'), main=document.querySelector('.dash-main');
  if(sidebar.style.width==='0px'||!sidebar.style.width){ sidebar.style.width='240px'; main.style.marginLeft='240px'; }
  else{ sidebar.style.width='0px'; main.style.marginLeft='0'; }
}
function consumerLogout(){ if(confirm('Logout?')){ localStorage.removeItem('chemtrack_session'); window.location.href='login.html'; } }
function getRequests(){ return JSON.parse(localStorage.getItem('consumer_requests_'+session.id)||'[]'); }
function saveRequests(d){ localStorage.setItem('consumer_requests_'+session.id, JSON.stringify(d)); }
function getStock(){ return JSON.parse(localStorage.getItem('consumer_stock_'+session.id)||'[]'); }
function saveStock(d){ localStorage.setItem('consumer_stock_'+session.id, JSON.stringify(d)); }
function getUsageLogs(){ return JSON.parse(localStorage.getItem('consumer_usage_'+session.id)||'[]'); }
function saveUsageLogs(d){ localStorage.setItem('consumer_usage_'+session.id, JSON.stringify(d)); }
function getFullUserData(){ return (JSON.parse(localStorage.getItem('chemtrack_users')||'[]')).find(u=>u.email===session.email)||{}; }
function formatDate(iso){ if(!iso) return '—'; return new Date(iso).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}); }
function statusBadge(s){ return '<span class="status-badge '+s+'">'+s.replace(/_/g,' ').toUpperCase()+'</span>'; }

// Auto-refresh every 5 seconds
setInterval(function(){
  loadStats();
  loadMyRetailerRequests();
  loadRecentRequests();
}, 5000);

function initDashboard(){
  const fullUser=getFullUserData(), name=session.companyName||session.name||'Consumer';
  const set=(id,v)=>{ const el=document.getElementById(id); if(el) el.textContent=v; };
  set('nav-company-name',name); set('sidebar-urn','URN: '+(session.urn||fullUser.urn||'N/A'));
  set('welcome-msg','Welcome, '+name); set('welcome-sub','NCB Approved Consumer — '+(session.state||fullUser.state||''));
  populateCityDropdowns();
  loadStats(); loadRecentRequests(); loadStock(); loadUsageTable();
  loadMyRetailerRequests(); loadHistory(); loadProfile(fullUser);
}

function populateCityDropdowns(){
  ['consumer-receive-city'].forEach(id=>{ const el=document.getElementById(id); if(!el) return; el.innerHTML='<option value="">-- Select City --</option>'; Object.keys(CITY_GPS).forEach(c=>el.innerHTML+='<option value="'+c+'">'+c+'</option>'); });
}

function loadStats(){
  const requests=getRequests(), stock=getStock(), usage=getUsageLogs();
  const totalStock=stock.reduce((s,i)=>s+Number(i.qty||0),0);
  const set=(id,v)=>{ const el=document.getElementById(id); if(el) el.textContent=v; };
  set('stat-stock',totalStock); set('stat-pending',requests.filter(r=>r.status==='pending').length);
  set('stat-approved',requests.filter(r=>r.status==='received'||r.status==='fulfilled').length);
  set('stat-used',usage.reduce((s,u)=>s+Number(u.qty||0),0));
}

function loadRecentRequests(){
  const tbody=document.getElementById('recent-tbody'); if(!tbody) return;
  const requests=getRequests();
  if(!requests.length){ tbody.innerHTML='<tr><td colspan="6" class="empty-td">No requests yet.</td></tr>'; return; }
  tbody.innerHTML=[...requests].reverse().slice(0,5).map(r=>'<tr><td><strong>'+r.requestId+'</strong></td><td>'+(r.chemical||r.material||'—')+'</td><td>'+r.qty+' kg</td><td>'+(r.retailer||r.supplier||'—')+'</td><td>'+formatDate(r.date)+'</td><td>'+statusBadge(r.status)+'</td></tr>').join('');
}

// ── CONSUMER → RETAILER REQUEST ──
function submitRetailerRequest(){
  const chemical=document.getElementById('req-chemical')?.value.trim();
  const qty=document.getElementById('req-qty')?.value.trim();
  const retailer=document.getElementById('req-retailer')?.value.trim();
  const retailEmail=document.getElementById('req-retailer-email')?.value.trim();
  const purpose=document.getElementById('req-purpose')?.value.trim()||document.getElementById('req-purpose')?.value;
  const notes=document.getElementById('req-notes')?.value.trim();
  if(!chemical||!qty||!retailer||!purpose){ showAlertInline('request-alert','⚠️ Chemical, Qty, Retailer Name, Purpose required.','warning'); return; }
  // Blockchain request
  const req=createRequest({ type:'consumer_request', fromParty:session.companyName||session.name, fromEmail:session.email, fromUrn:session.urn||'', toParty:retailer, toEmail:retailEmail||'', material:chemical, qty:Number(qty), notes:purpose+(notes?' | '+notes:'') });
  // Local save bhi (existing logic)
  const localReqs=getRequests();
  localReqs.push({ requestId:req.requestId, chemical, qty:Number(qty), retailer, retailEmail, supplier:retailer, purpose, notes, status:'pending', date:new Date().toISOString() });
  saveRequests(localReqs);
  showAlertInline('request-alert','✅ Request <strong>'+req.requestId+'</strong> sent to Retailer: '+retailer+'!<br>Retailer accept karega tab barcode milega.','success');
  ['req-chemical','req-qty','req-retailer','req-retailer-email','req-purpose','req-notes'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  loadStats(); loadRecentRequests(); loadMyRetailerRequests();
  showToast('📤 Request sent to Retailer!','success');
}

function loadMyRetailerRequests(){
  const tbody=document.getElementById('my-retailer-requests-tbody'); if(!tbody) return;
  const reqs=getAllRequests().filter(r=>r.type==='consumer_request'&&r.fromEmail===session.email);
  if(!reqs.length){ tbody.innerHTML='<tr><td colspan="7" class="empty-td">No requests sent yet.</td></tr>'; return; }
  tbody.innerHTML=[...reqs].reverse().map(r=>'<tr><td><strong>'+r.requestId+'</strong></td><td>'+r.toParty+'</td><td>'+r.material+'</td><td>'+r.qty+' kg</td><td>'+statusBadge(r.status)+'</td><td>'+(r.barcodeId?'<code class="barcode-code-sm">'+r.barcodeId+'</code>':'—')+'</td><td>'+formatDate(r.createdAt)+'</td></tr>').join('');
}

// ── RECEIVE FROM RETAILER (barcode scan) ──
function verifyConsumerReceive(){
  const id=document.getElementById('receive-barcode-id')?.value.trim();
  if(!id){ showAlertInline('receive-alert','⚠️ Enter barcode ID.','warning'); return; }
  const entry=findBarcode(id), resultDiv=document.getElementById('consumer-verify-result'), formDiv=document.getElementById('consumer-confirm-form');
  if(!entry){ resultDiv.innerHTML='<div class="alert alert-error show">❌ Barcode not found: '+id+'</div>'; formDiv.style.display='none'; verifiedBarcodeForReceive=null; return; }
  if(entry.status!=='dispatched'){ resultDiv.innerHTML='<div class="alert alert-warning show">⚠️ Status is "'+entry.status+'". Must be dispatched.</div>'; formDiv.style.display='none'; verifiedBarcodeForReceive=null; return; }
  verifiedBarcodeForReceive=id;
  resultDiv.innerHTML='<div class="scan-found"><h4>✅ Barcode Verified</h4><table class="detail-table"><tr><td>Material</td><td><strong>'+entry.material+'</strong></td></tr><tr><td>Qty</td><td>'+entry.qty+' kg</td></tr><tr><td>From Retailer</td><td>'+entry.fromParty+'</td></tr><tr><td>Chemicals</td><td>'+(entry.chemicals||'—')+'</td></tr></table></div>';
  formDiv.style.display='block';
  showAlertInline('receive-alert','✅ Valid barcode. Confirm receipt karo.','success');
}

function confirmConsumerReceive(){
  if(!verifiedBarcodeForReceive){ showAlertInline('receive-alert','⚠️ Verify barcode first.','warning'); return; }
  const city=document.getElementById('consumer-receive-city')?.value;
  const gps=city?getCityGPS(city):null;
  const chain_entry=findBarcode(verifiedBarcodeForReceive);
  const result=receiveBarcode(verifiedBarcodeForReceive, session.companyName||session.name, 'consumer', gps);
  if(result.error){ showAlertInline('receive-alert','❌ '+result.error,'error'); return; }
  // Update stock
  const stock=getStock(), existing=stock.find(s=>(s.chemical||s.material)?.toLowerCase()===chain_entry.material.toLowerCase());
  if(existing){ existing.qty+=chain_entry.qty; existing.lastUpdated=new Date().toISOString(); }
  else stock.push({ chemical:chain_entry.material, qty:chain_entry.qty, supplier:chain_entry.fromParty, lastUpdated:new Date().toISOString() });
  saveStock(stock);
  // Update local request status
  const localReqs=getRequests();
  const lIdx=localReqs.findIndex(r=>r.status==='pending'&&(r.chemical||'').toLowerCase()===chain_entry.material.toLowerCase());
  if(lIdx!==-1){ localReqs[lIdx].status='received'; saveRequests(localReqs); }
  showAlertInline('receive-alert','✅ Received! Stock updated. NCB blockchain recorded. Delivery confirmed.','success');
  document.getElementById('consumer-confirm-form').style.display='none';
  verifiedBarcodeForReceive=null;
  loadStats(); loadRecentRequests(); loadStock(); loadMyRetailerRequests(); loadHistory();
  showToast('📦 Chemical received & delivery confirmed!','success');
}

function loadStock(){
  const tbody=document.getElementById('stock-tbody'); if(!tbody) return;
  const stock=getStock();
  if(!stock.length){ tbody.innerHTML='<tr><td colspan="6" class="empty-td">No stock available.</td></tr>'; return; }
  tbody.innerHTML=stock.map((s,i)=>'<tr><td>'+(i+1)+'</td><td><strong>'+(s.chemical||s.material)+'</strong></td><td>'+s.qty+' kg</td><td>'+(s.supplier||'—')+'</td><td>'+formatDate(s.lastUpdated)+'</td><td>'+statusBadge('approved')+'</td></tr>').join('');
}

// ── USAGE LOG (existing logic preserved) ──
function logUsage(){
  const chemical=document.getElementById('use-chemical')?.value.trim();
  const qty=document.getElementById('use-qty')?.value.trim();
  const process=document.getElementById('use-process')?.value.trim();
  const date=document.getElementById('use-date')?.value;
  const remarks=document.getElementById('use-remarks')?.value.trim();
  if(!chemical||!qty||!process){ showAlertInline('usage-alert','⚠️ Chemical, Quantity, Process required.','warning'); return; }
  const stock=getStock(), stockItem=stock.find(s=>(s.chemical||s.material)?.toLowerCase()===chemical.toLowerCase());
  if(stockItem){
    if(stockItem.qty<Number(qty)){ showAlertInline('usage-alert','⚠️ Usage ('+qty+'kg) exceeds stock ('+stockItem.qty+'kg).','error'); return; }
    stockItem.qty-=Number(qty); stockItem.lastUpdated=new Date().toISOString(); saveStock(stock);
  }
  const logs=getUsageLogs();
  logs.push({ chemical, qty:Number(qty), process, date:date||new Date().toISOString().split('T')[0], remarks:remarks||'—', status:'logged', loggedAt:new Date().toISOString() });
  saveUsageLogs(logs);
  showAlertInline('usage-alert','✅ Usage logged. '+qty+'kg of '+chemical+' recorded on NCB blockchain.','success');
  clearUsageForm(); loadStats(); loadStock(); loadUsageTable();
  showToast('📊 Usage logged!','success');
}

function clearUsageForm(){ ['use-chemical','use-qty','use-process','use-date','use-remarks'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; }); }

function loadUsageTable(){
  const tbody=document.getElementById('usage-tbody'); if(!tbody) return;
  const logs=getUsageLogs();
  if(!logs.length){ tbody.innerHTML='<tr><td colspan="6" class="empty-td">No usage logged yet.</td></tr>'; return; }
  tbody.innerHTML=[...logs].reverse().map((u,i)=>'<tr><td>'+(i+1)+'</td><td><strong>'+u.chemical+'</strong></td><td>'+u.qty+' kg</td><td>'+u.process+'</td><td>'+formatDate(u.loggedAt)+'</td><td>'+statusBadge('logged')+'</td></tr>').join('');
}

function loadHistory(){
  const tbody=document.getElementById('history-tbody'); if(!tbody) return;
  const globalReqs=getAllRequests().filter(r=>r.type==='consumer_request'&&r.fromEmail===session.email);
  const localReqs=getRequests();
  // Merge: global mein jo hain woh prefer karo
  const combined=[...globalReqs.map(r=>({id:r.requestId, type:'BLOCKCHAIN REQ', material:r.material, qty:r.qty, party:r.toParty, date:r.createdAt, status:r.status}))];
  // Local mein jo extra hain (puraane) woh bhi dikhao
  localReqs.forEach(r=>{ if(!globalReqs.find(g=>g.requestId===r.requestId)) combined.push({id:r.requestId, type:'RETAILER REQ', material:r.chemical||r.material, qty:r.qty, party:r.retailer||r.supplier||'—', date:r.date, status:r.status}); });
  combined.sort((a,b)=>new Date(b.date)-new Date(a.date));
  if(!combined.length){ tbody.innerHTML='<tr><td colspan="8" class="empty-td">No history yet.</td></tr>'; return; }
  tbody.innerHTML=combined.map((r,i)=>'<tr><td>'+(i+1)+'</td><td><code class="barcode-code-sm">'+r.id+'</code></td><td>'+r.type+'</td><td>'+r.material+'</td><td>'+r.qty+' kg</td><td>'+(r.party||'—')+'</td><td>'+formatDate(r.date)+'</td><td>'+statusBadge(r.status)+'</td></tr>').join('');
}

function loadProfile(fullUser){
  const u=fullUser,s=session,set=(id,v)=>{ const el=document.getElementById(id); if(el) el.textContent=v||'—'; };
  set('prof-company',s.companyName||u.companyName); set('prof-company2',s.companyName||u.companyName);
  set('prof-email',s.email); set('prof-phone',s.phone||u.phone);
  set('prof-owner',s.ownerName||u.ownerName); set('prof-designation',s.designation||u.designation);
  set('prof-state',s.state||u.state); set('prof-city',s.city||u.city);
  set('prof-gst',s.gst||u.gst); set('prof-urn',s.urn||u.urn); set('prof-pan',s.pan||u.pan);
  set('prof-drug-license',u.drugLicense); set('prof-purpose',u.purpose);
  set('prof-monthly',u.monthlyNeed?u.monthlyNeed+' kg/month':'—');
  set('prof-registered',formatDate(s.registeredAt||u.registeredAt));
}

function showAlertInline(id,msg,type){ const el=document.getElementById(id); if(!el) return; el.innerHTML=msg; el.className='alert alert-'+type+' show'; }
function showToast(msg,type='info'){
  let t=document.getElementById('toast'); if(!t){ t=document.createElement('div'); t.id='toast'; document.body.appendChild(t); }
  t.textContent=msg; t.className='toast '+type;
  setTimeout(()=>t.classList.add('show'),10); setTimeout(()=>t.classList.remove('show'),3500);
}
document.addEventListener('DOMContentLoaded',()=>{ initDashboard(); startLiveTracking(session); });