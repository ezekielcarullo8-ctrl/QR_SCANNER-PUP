const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const K='qra_v1';
let S;try{S=JSON.parse(localStorage.getItem(K))}catch(e){}
S=Object.assign({pin:null,sessions:[],cur:null,sound:true,vib:true,dup:true,lock:true,only:true,roster:null},S||{});
if(!S.roster)S.roster=Object.assign({},window.ROSTER_DEFAULT||{});
const save=()=>{try{localStorage.setItem(K,JSON.stringify(S))}catch(e){toast('Storage full')}};
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,5);
const hash=p=>{let h=5381;for(const c of 'qra'+p)h=((h<<5)+h+c.charCodeAt(0))|0;return String(h)};
const pad2=n=>String(n).padStart(2,'0');
const fmtT=t=>{const d=new Date(t);return pad2(d.getHours())+':'+pad2(d.getMinutes())+':'+pad2(d.getSeconds())};
const fmtD=t=>{const d=new Date(t);return d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate())};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let tt;function toast(m,ms){const e=$('#toast');e.textContent=m;e.classList.remove('hidden');clearTimeout(tt);tt=setTimeout(()=>e.classList.add('hidden'),ms||2200)}
const nm=c=>S.roster[String(c).trim().toUpperCase()]||null;
const total=()=>Object.keys(S.roster).length;
const label=c=>nm(c)||'Unknown student';

/* sessions */
function mk(name){const s={id:uid(),name:name||('Session '+fmtD(Date.now())),created:Date.now(),rows:[],dups:0};S.sessions.unshift(s);S.cur=s.id;save();return s}
const cur=()=>S.sessions.find(s=>s.id===S.cur)||S.sessions[0]||mk();
let viewId=null,absMode=false;const view=()=>S.sessions.find(s=>s.id===viewId)||cur();

/* PIN lock */
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

/* navigation */
function go(t){
  $$('.tab').forEach(e=>e.classList.toggle('on',e.id===t));
  $$('nav button').forEach(b=>b.classList.toggle('on',b.dataset.go===t));
  t==='scan'?startCam():stopCam();
  if(t==='rec')viewId=S.cur;
  refresh();
}
$$('[data-go]').forEach(b=>b.onclick=()=>go(b.dataset.go));

/* render */
function refresh(){
  const s=cur(),T=total(),n=s.rows.length,l=s.rows[n-1];
  $('#pill').textContent=s.name;$('#sessName').value=s.name;
  $('#presT').textContent=T?n+' / '+T:n;$('#presV').textContent=n;
  $('#presV').parentElement.style.setProperty('--p',T?Math.min(100,n/T*100):100);
  $('#dupT').textContent=s.dups||0;
  $('#lastT').textContent=l?label(l.c)+' · '+fmtT(l.t):'—';
  $('#oSound').checked=S.sound;$('#oVib').checked=S.vib;$('#oDup').checked=S.dup;$('#oLock').checked=S.lock;$('#oOnly').checked=S.only;
  $('#rosterInfo').textContent=T?T+' students on the class list.':'No class list yet. Import the QR cards PDF.';
  $('#latest').innerHTML=s.rows.slice(-4).reverse().map(r=>`<div>${esc(label(r.c))}<span>${fmtT(r.t)}</span></div>`).join('');
  renderTable();
}
function renderTable(){
  const v=view(),q=$('#search').value.trim().toLowerCase(),seen=new Set(v.rows.map(r=>r.c.toUpperCase()));
  $('#sessSel').innerHTML=S.sessions.map(x=>`<option value="${x.id}" ${x.id===v.id?'selected':''}>${esc(x.name)} (${x.rows.length})</option>`).join('');
  const T=total();$('#cnt').textContent=v.rows.length+(T?' / '+T:'')+' present';
  $('#absBtn').textContent=absMode?'Show present students':'Show absent students ('+Math.max(0,Object.keys(S.roster).filter(k=>!seen.has(k)).length)+')';
  let html='',n=0;
  if(absMode){
    Object.entries(S.roster).filter(([k])=>!seen.has(k)).sort((a,b)=>a[1].localeCompare(b[1])).forEach(([k,name])=>{
      if(q&&!(name+k).toLowerCase().includes(q))return;n++;
      html+=`<tr class="abs"><td>${n}</td><td><b>${esc(name)}</b><small>${esc(k)}</small></td><td class="t">Absent</td><td></td></tr>`});
  }else v.rows.forEach((r,i)=>{
    if(q&&!(label(r.c)+r.c).toLowerCase().includes(q))return;n++;
    html+=`<tr><td>${i+1}</td><td><b>${esc(label(r.c))}</b><small>${esc(r.c)}</small></td><td class="t">${fmtT(r.t)}</td><td><button data-d="${i}">✕</button></td></tr>`});
  $('#tb').innerHTML=html;$('#empty').classList.toggle('hidden',n>0);
  $('#empty').textContent=absMode?'Everyone is present. 🎉':'No scans yet. Open Scan to start.';
}
$('#tb').onclick=e=>{const i=e.target.dataset.d;if(i==null)return;const v=view();if(confirm('Remove "'+label(v.rows[i].c)+'"?')){v.rows.splice(i,1);save();refresh()}};
$('#sessSel').onchange=e=>{viewId=e.target.value;renderTable()};
$('#search').oninput=renderTable;
$('#absBtn').onclick=()=>{absMode=!absMode;renderTable()};

/* scanning */
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
function flash(msg,warn){const f=$('#flash');f.textContent=msg;f.className='flash'+(warn?' warn':'');clearTimeout(ftm);ftm=setTimeout(()=>f.classList.add('hidden'),2200)}
function add(raw,manual){
  const c=raw.trim(),s=cur(),name=nm(c);
  if(S.only&&total()&&!name){beep(220);S.vib&&navigator.vibrate&&navigator.vibrate([200]);flash('✕ Not on class list: '+c,true);return false}
  if(S.dup&&s.rows.some(r=>r.c.toUpperCase()===c.toUpperCase())){s.dups=(s.dups||0)+1;save();beep(300);S.vib&&navigator.vibrate&&navigator.vibrate([80,60,80]);flash('⚠ Already scanned: '+label(c),true);refresh();return false}
  s.rows.push({c,t:Date.now(),m:manual?1:0});save();beep(880);S.vib&&navigator.vibrate&&navigator.vibrate(60);flash('✓ '+label(c));refresh();return true;
}
function onCode(c){const n=Date.now();if(c===last.c&&n-last.t<2500){last.t=n;return}last={c,t:n};add(c)}
$('#manBtn').onclick=()=>{
  const v=(prompt('Type student no. (e.g. 00066) or part of the name:')||'').trim().toUpperCase();if(!v)return;
  const m=Object.entries(S.roster).filter(([k,n])=>k===v||k.includes(v)||n.toUpperCase().includes(v));
  if(m.length===1)add(m[0][0],true);
  else if(!m.length)toast(total()?'No match on the class list':'Class list is empty'),!total()&&add(v,true);
  else toast(m.length+' matches. Type more of the number or name.',3000);
};
$('#torch').onclick=async()=>{try{const t=stream.getVideoTracks()[0];t._on=!t._on;await t.applyConstraints({advanced:[{torch:t._on}]})}catch(e){toast('Light not supported')}};

/* export: full class list with Present/Absent */
async function exportCSV(){
  const v=cur();if(!v.rows.length&&!total())return toast('Nothing to export');
  const q=x=>'"'+String(x).replace(/"/g,'""')+'"',at={};v.rows.forEach(r=>at[r.c.toUpperCase()]=r);
  const line=(i,id,n,r)=>[i,q(id),q(n),r?'Present':'Absent',r?fmtD(r.t):'',r?fmtT(r.t):'',r?(r.m?'Manual':'Scan'):''].join(',');
  let i=0;const L=['No.,Student No.,Name,Status,Date,Time,Entry'];
  Object.entries(S.roster).sort((a,b)=>a[1].localeCompare(b[1])).forEach(([k,n])=>L.push(line(++i,k,n,at[k])));
  v.rows.filter(r=>!nm(r.c)).forEach(r=>L.push(line(++i,r.c,'Unknown student',r)));
  const csv='\ufeff'+L.join('\r\n');
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

/* import class list from a QR-cards PDF */
async function importPDF(file){
  if(!window.pdfjsLib)return alert('PDF reader is missing from this build.');
  pdfjsLib.GlobalWorkerOptions.workerSrc='pdf.worker.min.js';
  const found={};let cards=0,noQR=0;
  const med=a=>{a=[...a].sort((x,y)=>x-y);return a[a.length>>1]};
  /* decode one cropped card, retrying at other sizes */
  const readQR=(src)=>{
    for(const k of [1,1.5,2,.7,1.25]){
      const w=Math.round((src.width+100)*k),h=Math.round((src.height+100)*k),t=document.createElement('canvas');t.width=w;t.height=h;
      const g=t.getContext('2d',{willReadFrequently:true});g.fillStyle='#fff';g.fillRect(0,0,w,h);g.imageSmoothingEnabled=false;
      g.drawImage(src,50*k,50*k,src.width*k,src.height*k);
      const d=g.getImageData(0,0,w,h),r=jsQR(d.data,w,h,{inversionAttempts:'attemptBoth'});
      if(r&&r.data&&r.data.trim())return r.data.trim();
    }return null};
  try{
    const pdf=await pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise;
    for(let p=1;p<=pdf.numPages;p++){
      toast('Reading page '+p+' of '+pdf.numPages+'…',60000);await new Promise(r=>setTimeout(r,30));
      const page=await pdf.getPage(p),vp=page.getViewport({scale:1200/page.getViewport({scale:1}).width});
      const c=document.createElement('canvas');c.width=vp.width|0;c.height=vp.height|0;
      const x=c.getContext('2d',{willReadFrequently:true});x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);
      await page.render({canvasContext:x,viewport:vp}).promise;
      /* 1. text lines: the names printed under each QR */
      const items=(await page.getTextContent()).items.filter(i=>i.str.trim()).map(i=>{const t=pdfjsLib.Util.transform(vp.transform,i.transform);return{s:i.str.trim(),x:t[4],y:t[5],w:i.width*vp.scale,h:Math.abs(i.height*vp.scale)||12}});
      items.sort((a,b)=>Math.round(a.y/4)-Math.round(b.y/4)||a.x-b.x);
      const lines=[];
      for(const it of items){const l=lines[lines.length-1];
        if(l&&Math.abs(l.y-it.y)<4&&it.x-l.x1<18&&it.x>=l.x0-1){l.s+=' '+it.s;l.x1=it.x+it.w}
        else lines.push({s:it.s,y:it.y,x0:it.x,x1:it.x+it.w,h:it.h})}
      lines.forEach(l=>l.cx=(l.x0+l.x1)/2);
      /* 2. group lines into columns, then into name blocks (one per card) */
      const cols=[];
      for(const l of [...lines].sort((a,b)=>a.cx-b.cx)){const k=cols[cols.length-1];if(k&&Math.abs(l.cx-k[k.length-1].cx)<20)k.push(l);else cols.push([l])}
      const cxs=cols.map(k=>k.reduce((s,l)=>s+l.cx,0)/k.length),diffs=cxs.slice(1).map((v,i)=>v-cxs[i]);
      const pitch=diffs.length?med(diffs):c.width*.26,blocks=[];
      for(const k of cols){k.sort((a,b)=>a.y-b.y);let b=[k[0]];
        for(const l of k.slice(1)){if(l.y-b[b.length-1].y>c.width*.05){blocks.push(b);b=[l]}else b.push(l)}
        blocks.push(b)}
      /* 3. for each name, read the QR in the card area just above it */
      for(const b of blocks){
        cards++;
        const cxm=b.reduce((s,l)=>s+l.cx,0)/b.length,f=b[0];
        const yb=Math.max(1,Math.round(f.y-f.h*1.1)),yt=Math.max(0,Math.round(yb-pitch*1.05)),x0=Math.max(0,Math.round(cxm-pitch*.46)),x1=Math.min(c.width,Math.round(cxm+pitch*.46));
        const crop=document.createElement('canvas');crop.width=x1-x0;crop.height=yb-yt;
        crop.getContext('2d').drawImage(c,x0,yt,x1-x0,yb-yt,0,0,x1-x0,yb-yt);
        const id=readQR(crop),name=b.map(l=>l.s).join(' ').replace(/\s+/g,' ').trim();
        if(id&&name)found[id.toUpperCase()]=name;else noQR++;
      }
    }
  }catch(e){$('#toast').classList.add('hidden');return alert('Could not read that PDF.\n'+(e.message||e))}
  $('#toast').classList.add('hidden');
  const n=Object.keys(found).length;
  if(!n)return alert('No QR codes with a name below them were found in this PDF.');
  const had=total();Object.assign(S.roster,found);save();refresh();
  alert('Imported '+n+' of '+cards+' students found in the PDF.'+(noQR?'\n'+noQR+' names had no readable QR code and were skipped.':'')+'\nClass list now has '+total()+' students.');
}
$('#impBtn').onclick=()=>$('#pdfIn').click();
$('#pdfIn').onchange=e=>{const f=e.target.files[0];e.target.value='';if(f)importPDF(f)};
$('#resetRos').onclick=()=>{if(!window.ROSTER_DEFAULT)return toast('No built-in list');if(confirm('Replace the class list with the built-in BSIT-2 list?')){S.roster=Object.assign({},window.ROSTER_DEFAULT);save();refresh();toast('BSIT-2 list restored')}};
$('#clrRos').onclick=()=>{if(confirm('Remove all students from the class list? Existing scan records are kept.')){S.roster={};save();refresh()}};

/* actions */
$('#renameBtn').onclick=()=>{const n=$('#sessName').value.trim();if(!n)return toast('Enter a name');cur().name=n;save();refresh();toast('Saved')};
$('#newBtn').onclick=()=>{const n=prompt('Name for the new session:',$('#sessName').value.trim()+' '+fmtD(Date.now()));if(n){mk(n.trim());refresh();toast('New session started')}};
$('#clrBtn').onclick=()=>{const v=view();if(v.rows.length&&confirm('Clear all '+v.rows.length+' records in this session?')){v.rows=[];v.dups=0;save();refresh()}};
$('#delSess').onclick=()=>{const s=cur();if(confirm('Delete "'+s.name+'" and its records?')){S.sessions=S.sessions.filter(x=>x!==s);S.cur=null;save();cur();refresh();toast('Deleted')}};
$('#pinBtn').onclick=()=>showLock('cur');
[['oSound','sound'],['oVib','vib'],['oDup','dup'],['oLock','lock'],['oOnly','only']].forEach(([id,k])=>$('#'+id).onchange=e=>{S[k]=e.target.checked;save()});

/* battery */
if(navigator.getBattery)navigator.getBattery().then(b=>{const u=()=>{const p=Math.round(b.level*100);$('#rBat').style.setProperty('--p',p);$('#batV').textContent=p+'%';$('#batT').textContent=b.charging?'Charging':p+'%'};u();b.onlevelchange=b.onchargingchange=u}).catch(()=>{});
$('#rBat').style.setProperty('--c','var(--g)');

/* lifecycle */
let hid=0;
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){hid=Date.now();stopCam()}
  else{if(S.pin&&S.lock&&hid&&Date.now()-hid>30000&&$('#lock').classList.contains('hidden'))showLock('unlock');if($('#scan').classList.contains('on'))startCam()}
});
build();cur();refresh();
S.pin?showLock('unlock'):showLock('set1');
