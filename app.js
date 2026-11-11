const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const K='qra_v1';
let S;try{S=JSON.parse(localStorage.getItem(K))}catch(e){}
S=Object.assign({pin:null,sessions:[],cur:null,sound:true,vib:true,dup:true,lock:true},S||{});
const save=()=>{try{localStorage.setItem(K,JSON.stringify(S))}catch(e){toast('Storage full')}};
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,5);
const hash=p=>{let h=5381;for(const c of 'qra'+p)h=((h<<5)+h+c.charCodeAt(0))|0;return String(h)};
const pad2=n=>String(n).padStart(2,'0');
const fmtT=t=>{const d=new Date(t);return pad2(d.getHours())+':'+pad2(d.getMinutes())+':'+pad2(d.getSeconds())};
const fmtD=t=>{const d=new Date(t);return d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate())};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let tt;function toast(m){const e=$('#toast');e.textContent=m;e.classList.remove('hidden');clearTimeout(tt);tt=setTimeout(()=>e.classList.add('hidden'),2200)}

/* ---------- sessions ---------- */
function mk(name){const s={id:uid(),name:name||('Session '+fmtD(Date.now())),created:Date.now(),rows:[],dups:0};S.sessions.unshift(s);S.cur=s.id;save();return s}
const cur=()=>S.sessions.find(s=>s.id===S.cur)||S.sessions[0]||mk();
let viewId=null;const view=()=>S.sessions.find(s=>s.id===viewId)||cur();

/* ---------- PIN lock ---------- */
let pin='',mode='unlock',after=null,first='';
function showLock(m,cb){mode=m;after=cb||null;pin='';first='';$('#lock').classList.remove('hidden');lockUI()}
function lockUI(){
  const t={unlock:['Enter PIN','Unlock to continue'],set1:['Create a PIN','Choose a 4-digit PIN'],set2:['Confirm PIN','Enter the same PIN again'],cur:['Current PIN','Enter your current PIN']}[mode];
  $('#lockT').textContent=t[0];$('#lockS').textContent=t[1];
  $$('#dots i').forEach((d,i)=>d.classList.toggle('f',i<pin.length));
}
function build(){const p=$('#pad');['1','2','3','4','5','6','7','8','9','','0','⌫'].forEach(k=>{const b=document.createElement('button');b.textContent=k;if(!k)b.style.visibility='hidden';b.onclick=()=>key(k);p.appendChild(b)})}
function bad(m){const d=$('#dots');d.classList.add('bad');setTimeout(()=>d.classList.remove('bad'),350);toast(m);pin='';lockUI();navigator.vibrate&&navigator.vibrate(120)}
function key(k){
  if(k==='⌫')pin=pin.slice(0,-1);else if(pin.length<4)pin+=k;
  lockUI();if(pin.length<4)return;
  setTimeout(()=>{
    if(mode==='unlock'||mode==='cur'){
      if(hash(pin)!==S.pin)return bad('Wrong PIN');
      if(mode==='cur'){mode='set1';pin='';return lockUI()}
      done();
    }else if(mode==='set1'){first=pin;pin='';mode='set2';lockUI()}
    else if(mode==='set2'){
      if(pin!==first){mode='set1';return bad('PINs did not match')}
      S.pin=hash(pin);save();toast('PIN saved');done();
    }
  },120);
}
function done(){$('#lock').classList.add('hidden');pin='';if(after)after();after=null;refresh()}

/* ---------- navigation ---------- */
function go(t){
  $$('.tab').forEach(e=>e.classList.toggle('on',e.id===t));
  $$('nav button').forEach(b=>b.classList.toggle('on',b.dataset.go===t));
  t==='scan'?startCam():stopCam();
  if(t==='rec')viewId=S.cur;
  refresh();
}
$$('[data-go]').forEach(b=>b.onclick=()=>go(b.dataset.go));

/* ---------- render ---------- */
function refresh(){
  const s=cur();$('#pill').textContent=s.name;$('#sessName').value=s.name;
  $('#presT').textContent=$('#presV').textContent=s.rows.length;
  $('#dupT').textContent=s.dups||0;
  $('#lastT').textContent=s.rows.length?fmtT(s.rows[s.rows.length-1].t):'—';
  $('#oSound').checked=S.sound;$('#oVib').checked=S.vib;$('#oDup').checked=S.dup;$('#oLock').checked=S.lock;
  $('#latest').innerHTML=s.rows.slice(-4).reverse().map(r=>`<div>${esc(r.c)}<span>${fmtT(r.t)}</span></div>`).join('');
  renderTable();
}
function renderTable(){
  const v=view(),q=$('#search').value.trim().toLowerCase();
  $('#sessSel').innerHTML=S.sessions.map(x=>`<option value="${x.id}" ${x.id===v.id?'selected':''}>${esc(x.name)} (${x.rows.length})</option>`).join('');
  const rows=v.rows.map((r,i)=>({r,i})).filter(o=>!q||o.r.c.toLowerCase().includes(q));
  $('#cnt').textContent=v.rows.length+' present';
  $('#tb').innerHTML=rows.map(o=>`<tr><td>${o.i+1}</td><td>${esc(o.r.c)}</td><td class="t">${fmtT(o.r.t)}</td><td><button data-d="${o.i}">✕</button></td></tr>`).join('');
  $('#empty').classList.toggle('hidden',rows.length>0);
}
$('#tb').onclick=e=>{const i=e.target.dataset.d;if(i==null)return;const v=view();if(confirm('Remove "'+v.rows[i].c+'"?')){v.rows.splice(i,1);save();refresh()}};
$('#sessSel').onchange=e=>{viewId=e.target.value;renderTable()};
$('#search').oninput=renderTable;

/* ---------- scanning ---------- */
const vid=$('#vid'),cv=document.createElement('canvas'),cx=cv.getContext('2d',{willReadFrequently:true});
let stream,raf,wl,last={c:'',t:0},ac,ftm;
async function startCam(){
  if(stream)return;$('#camErr').classList.add('hidden');
  try{
    stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280}},audio:false});
    vid.srcObject=stream;await vid.play();tick();
    try{wl=await navigator.wakeLock.request('screen')}catch(e){}
  }catch(e){stream=null;$('#camErr').classList.remove('hidden')}
}
function stopCam(){cancelAnimationFrame(raf);if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;try{wl&&wl.release()}catch(e){}}
function tick(){
  if(!stream)return;
  if(vid.readyState>=2&&vid.videoWidth){
    const sc=Math.min(1,640/vid.videoWidth);cv.width=vid.videoWidth*sc|0;cv.height=vid.videoHeight*sc|0;
    cx.drawImage(vid,0,0,cv.width,cv.height);
    const d=cx.getImageData(0,0,cv.width,cv.height),r=jsQR(d.data,d.width,d.height,{inversionAttempts:'dontInvert'});
    if(r&&r.data&&r.data.trim())onCode(r.data.trim());
  }
  raf=requestAnimationFrame(tick);
}
function beep(f){if(!S.sound)return;try{ac=ac||new (window.AudioContext||window.webkitAudioContext)();const o=ac.createOscillator(),g=ac.createGain();o.frequency.value=f;g.gain.value=.15;o.connect(g);g.connect(ac.destination);o.start();o.stop(ac.currentTime+.12)}catch(e){}}
function flash(msg,warn){const f=$('#flash');f.textContent=msg;f.className='flash'+(warn?' warn':'');clearTimeout(ftm);ftm=setTimeout(()=>f.classList.add('hidden'),2000)}
function add(c,manual){
  const s=cur();
  if(S.dup&&s.rows.some(r=>r.c===c)){s.dups=(s.dups||0)+1;save();beep(300);S.vib&&navigator.vibrate&&navigator.vibrate([80,60,80]);flash('⚠ Already scanned: '+c,true);refresh();return false}
  s.rows.push({c,t:Date.now(),m:manual?1:0});save();beep(880);S.vib&&navigator.vibrate&&navigator.vibrate(60);flash('✓ '+c);refresh();return true;
}
function onCode(c){const n=Date.now();if(c===last.c&&n-last.t<2500){last.t=n;return}last={c,t:n};add(c)}
$('#manBtn').onclick=()=>{const v=prompt('Type the student ID / name to mark present:');if(v&&v.trim())add(v.trim(),true)};
$('#torch').onclick=async()=>{try{const t=stream.getVideoTracks()[0];t._on=!t._on;await t.applyConstraints({advanced:[{torch:t._on}]})}catch(e){toast('Light not supported')}};

/* ---------- export ---------- */
async function exportCSV(){
  const v=cur();if(!v.rows.length)return toast('Nothing to export');
  const q=x=>'"'+String(x).replace(/"/g,'""')+'"';
  const csv='\ufeff'+['No.,Scanned content,Date,Time,Entry',...v.rows.map((r,i)=>[i+1,q(r.c),fmtD(r.t),fmtT(r.t),r.m?'Manual':'Scan'].join(','))].join('\r\n');
  const name=(v.name.replace(/[^\w\-]+/g,'_')||'attendance')+'_'+fmtD(v.created)+'.csv',P=window.Capacitor&&Capacitor.Plugins;
  try{
    const w=await P.Filesystem.writeFile({path:name,data:csv,directory:'CACHE',encoding:'utf8'});
    await P.Share.share({title:name,url:w.uri,dialogTitle:'Save or send attendance'});
  }catch(e){
    if(e&&/cancel/i.test(e.message||''))return;
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download=name;a.click();
  }
}
$('#expBtn').onclick=$('#expTile').onclick=exportCSV;

/* ---------- actions ---------- */
$('#renameBtn').onclick=()=>{const n=$('#sessName').value.trim();if(!n)return toast('Enter a name');cur().name=n;save();refresh();toast('Saved')};
$('#newBtn').onclick=()=>{const n=prompt('Name for the new session:',$('#sessName').value.trim()+' '+fmtD(Date.now()));if(n){mk(n.trim());refresh();toast('New session started')}};
$('#clrBtn').onclick=()=>{const v=view();if(v.rows.length&&confirm('Clear all '+v.rows.length+' records in this session?')){v.rows=[];v.dups=0;save();refresh()}};
$('#delSess').onclick=()=>{const s=cur();if(confirm('Delete "'+s.name+'" and its records?')){S.sessions=S.sessions.filter(x=>x!==s);S.cur=null;save();cur();refresh();toast('Deleted')}};
$('#pinBtn').onclick=()=>showLock('cur');
[['oSound','sound'],['oVib','vib'],['oDup','dup'],['oLock','lock']].forEach(([id,k])=>$('#'+id).onchange=e=>{S[k]=e.target.checked;save()});

/* ---------- battery ---------- */
if(navigator.getBattery)navigator.getBattery().then(b=>{const u=()=>{const p=Math.round(b.level*100);$('#rBat').style.setProperty('--p',p);$('#batV').textContent=p+'%';$('#batT').textContent=b.charging?'Charging':p+'%'};u();b.onlevelchange=b.onchargingchange=u}).catch(()=>{});
$('#rBat').style.setProperty('--c','var(--g)');

/* ---------- lifecycle ---------- */
let hid=0;
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){hid=Date.now();stopCam()}
  else{if(S.pin&&S.lock&&hid&&Date.now()-hid>30000&&$('#lock').classList.contains('hidden'))showLock('unlock');if($('#scan').classList.contains('on'))startCam()}
});
build();cur();refresh();
S.pin?showLock('unlock'):showLock('set1');
