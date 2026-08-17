import {TrackingAdapter} from './tracking.js';
import {WorldEngine} from './world-engine.js';

const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const video=$('#camera');
const scanOverlay=$('#scanOverlay');
const sctx=scanOverlay.getContext('2d');
const tracking=new TrackingAdapter();
let world=null;
let stream=null;
let facingMode='environment';
let currentElement='LAV';
let started=false;
let quality='MEDIUM';
let meshVisible=true;

const ELEMENTS=[
 ['🌋','LAV'],['🌊','SU'],['❄️','BUZ'],['🌱','ÇİMEN'],['🏜️','KUM'],['☁️','BULUT'],['🌌','UZAY'],['🟣','VOID'],
 ['💎','KRİSTAL'],['🔥','ATEŞ'],['🧊','DONMUŞ'],['🍄','MANTAR'],['🌲','ORMAN'],['🌑','AY'],['☣️','TOKSİK'],['🌈','GÖKKUŞAĞI'],
 ['⚡','ELEKTRİK'],['🪨','TAŞ'],['🏙️','CYBERPUNK'],['👾','GLITCH']
];

function toast(text){const el=$('#readyToast');el.textContent=text;el.classList.remove('hidden');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.add('hidden'),1500);}
function resizeOverlay(){const dpr=Math.min(devicePixelRatio||1,1.5);scanOverlay.width=innerWidth*dpr;scanOverlay.height=innerHeight*dpr;scanOverlay.style.width=innerWidth+'px';scanOverlay.style.height=innerHeight+'px';sctx.setTransform(dpr,0,0,dpr,0,0);}
addEventListener('resize',resizeOverlay);resizeOverlay();

async function startCamera(){
  if(!navigator.mediaDevices?.getUserMedia){toast('Kamera desteklenmiyor');return;}
  try{
    if(stream)stream.getTracks().forEach(t=>t.stop());
    await tracking.start();
    stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:facingMode},width:{ideal:1920},height:{ideal:1080}},audio:false});
    video.srcObject=stream;await video.play();
    $('#permissionCard').classList.add('hidden');
    if(!world){world=new WorldEngine($('#worldLayer'),tracking);world.start();}
    started=true;
    await runScan();
    updateCapability();
  }catch(err){console.error(err);$('#permissionCard p').textContent='Kamera açılamadı. Safari kamera iznini kontrol et.';}
}

function updateCapability(){
  const pose=tracking.getPose();
  $('#modeBadge').textContent=pose.quality==='orientation'?'WORLD LOCK • ORIENTATION':'WORLD LOCK • FALLBACK';
  $('#capabilityText').textContent=pose.quality==='orientation'
    ? 'Web V3 telefonu döndürdüğünde 3D dünya tabanını yönelim verisiyle sabit tutmaya çalışır. Sonraki adımda bu TrackingAdapter gerçek 6DoF WebAR motoruna bağlanabilir.'
    : 'Hareket sensörü kullanılamıyor. 3D dünya çalışır ama telefon döndükçe gerçek world-lock sınırlıdır.';
}

async function runScan(){
  const hud=$('#scanHud');const bar=$('#scanProgress');const text=$('#scanText');const surface=$('#surfaceHud');
  hud.classList.remove('hidden');surface.classList.add('hidden');
  let p=0;
  await new Promise(resolve=>{
    const timer=setInterval(()=>{
      p+=5+Math.random()*7;bar.style.width=Math.min(p,100)+'%';
      text.textContent=p<30?'Hareket sensörü kalibre ediliyor…':p<65?'3D dünya tabanı hazırlanıyor…':'Dünya koordinatı kilitleniyor…';
      drawScan(Math.min(p,100)/100);
      if(p>=100){clearInterval(timer);resolve();}
    },110);
  });
  sctx.clearRect(0,0,innerWidth,innerHeight);tracking.recenter();world?.recenter();
  hud.classList.add('hidden');surface.classList.remove('hidden');toast('DÜNYA HAZIR');
}

function drawScan(progress){
  sctx.clearRect(0,0,innerWidth,innerHeight);sctx.save();
  sctx.strokeStyle='rgba(93,235,255,.28)';sctx.lineWidth=1;
  const horizon=innerHeight*(.42+.08*(1-progress));
  for(let i=0;i<8;i++){
    const t=i/7,y=horizon+(innerHeight-horizon)*Math.pow(t,1.35);const half=innerWidth*(.12+.48*t);
    sctx.beginPath();sctx.moveTo(innerWidth/2-half,y);sctx.lineTo(innerWidth/2+half,y);sctx.stroke();
  }
  for(let i=-5;i<=5;i++){
    sctx.beginPath();sctx.moveTo(innerWidth/2+i*12,horizon);sctx.lineTo(innerWidth/2+i*innerWidth*.12,innerHeight);sctx.stroke();
  }
  const y=horizon+(innerHeight-horizon)*progress;sctx.strokeStyle='rgba(122,255,236,.9)';sctx.lineWidth=2;sctx.beginPath();sctx.moveTo(0,y);sctx.lineTo(innerWidth,y);sctx.stroke();sctx.restore();
}

const grid=$('#elementGrid');
ELEMENTS.forEach(([icon,name],i)=>{
  const b=document.createElement('button');b.innerHTML=`${icon}<span>${name}</span>`;if(i===0)b.classList.add('selected');
  b.onclick=()=>{currentElement=name;[...grid.children].forEach(x=>x.classList.remove('selected'));b.classList.add('selected');};grid.appendChild(b);
});

function openPanel(id){$$('.panel').forEach(p=>p.classList.add('hidden'));$(id).classList.remove('hidden');}
$$('[data-close]').forEach(b=>b.onclick=()=>$('#'+b.dataset.close).classList.add('hidden'));
$('#settingsBtn').onclick=()=>openPanel('#settingsPanel');
$('#startBtn').onclick=startCamera;
$('#cameraFlipBtn').onclick=async()=>{facingMode=facingMode==='environment'?'user':'environment';if(started)await startCamera();};
$('#applyFloorBtn').onclick=()=>{world?.setElement(currentElement);$('#elementsPanel').classList.add('hidden');toast(`${currentElement} • TÜM TABAN`);};
$('#recalibrateBtn').onclick=runScan;
$('#qualitySelect').onchange=e=>{quality=e.target.value;world?.setQuality(quality);toast('QUALITY • '+quality);};
$('#meshToggle').onchange=e=>{meshVisible=e.target.checked;world?.setGridVisible(meshVisible);};
$('#motionToggle').onchange=e=>{tracking.setEnabled(e.target.checked);updateCapability();};

$$('.toolbar button').forEach(btn=>btn.onclick=()=>{
  $$('.toolbar button').forEach(x=>x.classList.remove('active'));btn.classList.add('active');
  const tool=btn.dataset.tool;
  if(tool==='elements')openPanel('#elementsPanel');
  else if(tool==='ai')openPanel('#aiPanel');
  else if(tool==='portal'){const on=world?.togglePortal();toast(on?'🌀 PORTAL AÇILDI':'PORTAL KAPANDI');}
  else if(tool==='spawn')spawnDragon();
  else if(tool==='chaos')startChaos();
  else toast('🎮 Mini Games sonraki adım');
});

function spawnDragon(){
  if(!world)return;
  toast('🐉 Mini yaratık sistemi sonraki adımda gerçek modele bağlanacak');
}
function startChaos(){world?.setElement('ELEKTRİK');toast('⚡ CHAOS • ELECTRIC FLOOR');}

$$('[data-prompt]').forEach(b=>b.onclick=()=>{$('#aiPrompt').value=b.dataset.prompt;});
$('#aiGenerateBtn').onclick=async()=>{const p=$('#aiPrompt').value.trim();if(!p)return toast('Bir dünya tarif et');await sendAI(p);};

async function sendAI(prompt){
  $('#aiStatus').textContent='AI düşünüyor…';
  try{
    const r=await fetch('/api/ai',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({prompt})});
    if(!r.ok)throw new Error(await r.text());
    const data=await r.json();applyPlan(data.plan||data);$('#aiStatus').textContent='AI planı uygulandı.';
  }catch(err){console.warn(err);applyPlan(localPlan(prompt));$('#aiStatus').textContent='Yerel komut motoru kullanıldı.';}
}

function localPlan(text=''){
  const s=text.toLocaleLowerCase('tr');let element='KRİSTAL';
  if(s.includes('lav'))element='LAV';else if(s.includes('buz')||s.includes('dondur'))element='BUZ';else if(s.includes('su'))element='SU';
  else if(s.includes('orman'))element='ORMAN';else if(s.includes('uzay'))element='UZAY';else if(s.includes('cyber')||s.includes('neon'))element='CYBERPUNK';
  else if(s.includes('mantar'))element='MANTAR';else if(s.includes('elektrik')||s.includes('şimşek'))element='ELEKTRİK';
  return {actions:[{type:'paint',element},{type:s.includes('portal')?'portal':'noop'}]};
}

function applyPlan(plan){
  for(const a of plan.actions||[]){
    if(a.type==='paint'&&a.element){currentElement=a.element;world?.setElement(a.element);}
    if(a.type==='portal')world?.togglePortal(true);
  }
  $('#aiPanel').classList.add('hidden');toast('✨ AI WORLD APPLIED');
}

$('#voiceBtn').onclick=()=>{
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR)return toast('Sesli komut desteklenmiyor');
  const rec=new SR();rec.lang='tr-TR';rec.interimResults=false;toast('🎙️ Dinliyorum…');rec.start();
  rec.onresult=e=>sendAI(e.results[0][0].transcript);rec.onerror=()=>toast('Ses anlaşılamadı');
};

$('#photoBtn').onclick=()=>{
  if(!started)return toast('Önce kamerayı aç');
  const out=document.createElement('canvas');out.width=innerWidth;out.height=innerHeight;const o=out.getContext('2d');
  o.drawImage(video,0,0,out.width,out.height);
  const webgl=$('#worldLayer canvas');if(webgl)o.drawImage(webgl,0,0,out.width,out.height);
  out.toBlob(blob=>{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='mirrorrealm-'+Date.now()+'.jpg';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500);},'image/jpeg',.92);
};

updateCapability();