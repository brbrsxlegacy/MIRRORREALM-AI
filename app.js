const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const camera = $('#camera');
const canvas = $('#fx');
const ctx = canvas.getContext('2d');
const permissionCard = $('#permissionCard');
const scanHud = $('#scanHud');
const scanProgress = $('#scanProgress');
const scanText = $('#scanText');
const readyToast = $('#readyToast');
const modeBadge = $('#modeBadge');
const capabilityText = $('#capabilityText');
const unsupportedNote = $('#unsupportedNote');

let stream = null;
let facingMode = 'environment';
let currentElement = 'LAV';
let scanning = false;
let active = false;
let particles = [];
let blobs = [];
let quality = 'MEDIUM';
let arSupported = false;

const ELEMENTS = [
  ['🌋','LAV'],['🌊','SU'],['❄️','BUZ'],['🌱','ÇİMEN'],['🏜️','KUM'],['☁️','BULUT'],['🌌','UZAY'],['🟣','VOID'],
  ['💎','KRİSTAL'],['🔥','ATEŞ'],['🧊','DONMUŞ'],['🍄','MANTAR'],['🌲','ORMAN'],['🌑','AY'],['☣️','TOKSİK'],['🌈','GÖKKUŞAĞI'],
  ['⚡','ELEKTRİK'],['🪨','TAŞ'],['🏙️','CYBERPUNK'],['👾','GLITCH']
];

const palette = {
  LAV:['#ff6a00','#ff1600','#ffd35a'], SU:['#1fc8ff','#1266ff','#7bf4ff'], BUZ:['#c6f7ff','#76d8ff','#eaffff'], ÇİMEN:['#4dcc63','#1a7a38','#a4ef78'],
  KUM:['#e7c775','#b98945','#fff0a8'], BULUT:['#e9f5ff','#a8c5d9','#ffffff'], UZAY:['#10122a','#6842d8','#22c8ff'], VOID:['#12001f','#4d087f','#d04bff'],
  KRİSTAL:['#83f3ff','#a36cff','#f2eaff'], ATEŞ:['#ff4200','#ffb000','#fff16c'], DONMUŞ:['#bff6ff','#6fb9e9','#e7fbff'], MANTAR:['#c847ff','#ff5d84','#6fda77'],
  ORMAN:['#14532d','#2d8b57','#77b255'], AY:['#a7a7a7','#555','#ddd'], TOKSİK:['#8cff00','#1d6f19','#d8ff4f'], GÖKKUŞAĞI:['#ff3b3b','#35e27b','#537cff'],
  ELEKTRİK:['#ffe95a','#79f2ff','#ffffff'], TAŞ:['#777','#3c4148','#b2b6bb'], CYBERPUNK:['#00eaff','#ff27df','#171a3a'], GLITCH:['#00ff9d','#ff005d','#7b2cff']
};

function resizeCanvas(){
  const dpr = Math.min(devicePixelRatio || 1, quality === 'ULTRA' ? 2 : quality === 'HIGH' ? 1.6 : 1.25);
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  canvas.style.width = innerWidth + 'px';
  canvas.style.height = innerHeight + 'px';
  ctx.setTransform(dpr,0,0,dpr,0,0);
}
addEventListener('resize', resizeCanvas);
resizeCanvas();

async function detectAR(){
  try{
    arSupported = !!(navigator.xr && await navigator.xr.isSessionSupported('immersive-ar'));
  }catch{ arSupported = false; }
  if(arSupported){
    modeBadge.textContent = 'WEBXR AR AVAILABLE';
    capabilityText.textContent = 'Bu tarayıcı immersive WebXR AR destekliyor. Bu MVP kamera modunda başlar; native plane/mesh modu sonraki fazda bağlanabilir.';
  } else {
    modeBadge.textContent = 'CAMERA AR FALLBACK';
    capabilityText.textContent = 'Bu tarayıcı gerçek immersive WebXR AR sunmuyor. MIRRORREALM sahte plane detection göstermiyor; kamera + ekran-ankorlu efekt modunu kullanıyor.';
  }
}
detectAR();

async function startCamera(){
  if(!navigator.mediaDevices?.getUserMedia){
    alert('Bu tarayıcı kamera erişimini desteklemiyor.'); return;
  }
  try{
    if(stream) stream.getTracks().forEach(t=>t.stop());
    stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:facingMode},width:{ideal:1920},height:{ideal:1080}},audio:false});
    camera.srcObject = stream;
    permissionCard.classList.add('hidden');
    active = true;
    startScan();
  }catch(err){
    permissionCard.querySelector('p').textContent = 'Kamera izni alınamadı. Ayarlardan kamera iznini açıp tekrar dene.';
    console.error(err);
  }
}
$('#startBtn').addEventListener('click', startCamera);

$('#cameraFlipBtn').addEventListener('click', async()=>{
  facingMode = facingMode === 'environment' ? 'user' : 'environment';
  if(active) await startCamera();
});

function startScan(){
  scanning = true;
  scanHud.classList.remove('hidden');
  unsupportedNote.classList.toggle('hidden', arSupported);
  if(!arSupported) unsupportedNote.textContent = 'Not: Bu cihazda gerçek yüzey/derinlik algılama API’si yok. Tarama animasyonu kamera hazırlığını gösterir; zemin/duvar geometrisi algılandı diye iddia etmez.';
  let p = 0;
  const timer = setInterval(()=>{
    p += 4 + Math.random()*7;
    scanProgress.style.width = Math.min(p,100)+'%';
    scanText.textContent = p<35?'Kamera dengeleniyor…':p<70?'Ortam görünümü hazırlanıyor…':'Efekt katmanı kalibre ediliyor…';
    if(p>=100){
      clearInterval(timer); scanning=false;
      scanHud.classList.add('hidden');
      readyToast.classList.remove('hidden');
      setTimeout(()=>readyToast.classList.add('hidden'),1400);
    }
  },120);
}

const elementGrid = $('#elementGrid');
ELEMENTS.forEach(([icon,name],i)=>{
  const b = document.createElement('button');
  b.innerHTML = `${icon}<span>${name}</span>`;
  if(i===0)b.classList.add('selected');
  b.onclick=()=>{
    currentElement=name;
    [...elementGrid.children].forEach(x=>x.classList.remove('selected'));
    b.classList.add('selected');
  };
  elementGrid.appendChild(b);
});

function openPanel(id){
  $$('.panel').forEach(p=>p.classList.add('hidden'));
  $(id).classList.remove('hidden');
}
$$('[data-close]').forEach(b=>b.onclick=()=>$('#'+b.dataset.close).classList.add('hidden'));
$('#settingsBtn').onclick=()=>openPanel('#settingsPanel');

$$('.toolbar button').forEach(btn=>btn.addEventListener('click',()=>{
  $$('.toolbar button').forEach(x=>x.classList.remove('active')); btn.classList.add('active');
  const tool=btn.dataset.tool;
  if(tool==='elements') openPanel('#elementsPanel');
  else if(tool==='ai') openPanel('#aiPanel');
  else toast(`${tool.toUpperCase()} • Phase 2/3 hazırlığında`);
}));

canvas.parentElement.addEventListener('pointerdown',(e)=>{
  if(!active || scanning || !$('#elementsPanel').classList.contains('hidden') || !$('#aiPanel').classList.contains('hidden')) return;
  const target = e.target.closest('button,textarea,select,.panel,.toolbar,.topbar');
  if(target) return;
  paintAt(e.clientX,e.clientY,currentElement);
});

function paintAt(x,y,type){
  const colors=palette[type]||palette.LAV;
  const size=Math.min(innerWidth,innerHeight)*(type==='BULUT'?0.22:0.18);
  blobs.push({x,y,r:size,t:0,type,colors,life: quality==='LOW'?900:1500});
  const count=quality==='LOW'?8:quality==='MEDIUM'?14:quality==='HIGH'?22:30;
  for(let i=0;i<count;i++) particles.push({x:x+(Math.random()-.5)*size,y:y+(Math.random()-.5)*size,vx:(Math.random()-.5)*.55,vy:-.25-Math.random()*.8,a:1,s:2+Math.random()*5,c:colors[(Math.random()*colors.length)|0],type});
  if(type==='LAV') toast('🌋 LAV yüzey efekti eklendi');
}

function drawBlob(b,now){
  const age=now-b.t0;
  const pulse=1+Math.sin(now/260+b.x)*.04;
  ctx.save();
  ctx.globalCompositeOperation='screen';
  const g=ctx.createRadialGradient(b.x,b.y,b.r*.08,b.x,b.y,b.r*pulse);
  g.addColorStop(0,b.colors[2]+'dd'); g.addColorStop(.28,b.colors[0]+'bb'); g.addColorStop(.65,b.colors[1]+'99'); g.addColorStop(1,b.colors[1]+'00');
  ctx.fillStyle=g; ctx.beginPath();
  const steps=22;
  for(let i=0;i<=steps;i++){
    const a=i/steps*Math.PI*2;
    const rr=b.r*(.74+.16*Math.sin(a*3+now/500)+.08*Math.sin(a*7-now/330));
    const px=b.x+Math.cos(a)*rr, py=b.y+Math.sin(a)*rr*.55;
    i?ctx.lineTo(px,py):ctx.moveTo(px,py);
  }
  ctx.closePath();ctx.fill();
  ctx.globalAlpha=.35;
  ctx.strokeStyle=b.colors[2];ctx.lineWidth=1.5;ctx.stroke();
  ctx.restore();
}

function loop(now=0){
  ctx.clearRect(0,0,innerWidth,innerHeight);
  blobs.forEach(b=>{ if(!b.t0)b.t0=now; drawBlob(b,now); });
  particles.forEach(p=>{
    p.x+=p.vx;p.y+=p.vy;p.a-=.008;p.s*=.997;
    ctx.globalAlpha=Math.max(0,p.a);ctx.fillStyle=p.c;ctx.beginPath();ctx.arc(p.x,p.y,p.s,0,Math.PI*2);ctx.fill();
  });
  ctx.globalAlpha=1;
  particles=particles.filter(p=>p.a>0);
  if(blobs.length>18) blobs.splice(0,blobs.length-18);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

function toast(msg){
  readyToast.textContent=msg; readyToast.classList.remove('hidden');
  clearTimeout(toast._t); toast._t=setTimeout(()=>readyToast.classList.add('hidden'),1600);
}

$('#qualitySelect').addEventListener('change',e=>{quality=e.target.value;resizeCanvas();toast('QUALITY • '+quality)});
$('#gridToggle').addEventListener('change',e=>$('#scanGrid').style.display=e.target.checked?'block':'none');

$('#photoBtn').addEventListener('click',()=>{
  if(!active)return toast('Önce kamerayı aç');
  const out=document.createElement('canvas'); out.width=camera.videoWidth||1080; out.height=camera.videoHeight||1920;
  const o=out.getContext('2d'); o.drawImage(camera,0,0,out.width,out.height);
  // UI gizli temiz fotoğraf: kamera + FX'i ölçekleyerek birleştir.
  o.drawImage(canvas,0,0,out.width,out.height);
  out.toBlob(blob=>{
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='mirrorrealm-'+Date.now()+'.jpg'; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),2000);
  },'image/jpeg',.92);
});

async function sendAI(prompt){
  $('#aiStatus').textContent='AI düşünüyor…';
  try{
    const r=await fetch('/api/ai',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({prompt})});
    if(!r.ok) throw new Error(await r.text());
    const data=await r.json();
    $('#aiStatus').textContent='AI planı uygulandı.';
    applyPlan(data.plan || data);
  }catch(err){
    console.warn(err);
    $('#aiStatus').textContent='Groq backend bağlı değil. Yerel komut ayrıştırıcı kullanıldı.';
    applyPlan(localPlan(prompt));
  }
}

function localPlan(text=''){
  const s=text.toLocaleLowerCase('tr');
  const actions=[];
  if(s.includes('lav')) actions.push({type:'paint',element:'LAV'});
  if(s.includes('buz')||s.includes('dondur')) actions.push({type:'paint',element:'BUZ'});
  if(s.includes('su')||s.includes('sel')) actions.push({type:'paint',element:'SU'});
  if(s.includes('orman')) actions.push({type:'paint',element:'ORMAN'});
  if(s.includes('uzay')) actions.push({type:'paint',element:'UZAY'});
  if(s.includes('cyber')||s.includes('neon')) actions.push({type:'paint',element:'CYBERPUNK'});
  if(s.includes('ateş')||s.includes('yak')) actions.push({type:'paint',element:'ATEŞ'});
  if(!actions.length) actions.push({type:'paint',element:'KRİSTAL'});
  return {title:'Local world plan',actions};
}

function applyPlan(plan){
  const actions=plan.actions||[];
  const pts=[[.5,.68],[.27,.58],[.73,.57],[.5,.46],[.18,.72],[.82,.72]];
  actions.forEach((a,idx)=>{
    if(a.type==='paint'){
      const el=palette[a.element]?a.element:'KRİSTAL';
      currentElement=el;
      for(let i=0;i<Math.min(6,quality==='LOW'?3:6);i++) setTimeout(()=>paintAt(innerWidth*pts[i][0],innerHeight*pts[i][1],el),i*90+idx*120);
    }
  });
  toast('✨ AI WORLD APPLIED');
}

$('#aiGenerateBtn').addEventListener('click',()=>{
  const p=$('#aiPrompt').value.trim(); if(!p)return toast('Dünyanı tarif et'); sendAI(p);
});

$('#voiceBtn').addEventListener('click',()=>{
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR)return toast('Bu tarayıcı sesli komutu desteklemiyor');
  const rec=new SR(); rec.lang='tr-TR'; rec.interimResults=false; rec.maxAlternatives=1;
  toast('🎙️ Dinliyorum…'); rec.start();
  rec.onresult=e=>{const text=e.results[0][0].transcript;toast('“'+text+'”');sendAI(text)};
  rec.onerror=()=>toast('Ses anlaşılamadı');
});