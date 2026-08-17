import {TrackingAdapter} from './tracking.js';
import {SurfaceEngine} from './surface-engine.js';

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const video=$('#camera'), xrCanvas=$('#xrCanvas'), scanOverlay=$('#scanOverlay'), sctx=scanOverlay.getContext('2d');
const tracking=new TrackingAdapter();
let world=null,stream=null,currentElement='LAV',started=false,quality='MEDIUM',meshVisible=true,placingEnabled=true;
const ELEMENTS=[['🌋','LAV'],['🌊','SU'],['❄️','BUZ'],['🌱','ÇİMEN'],['🏜️','KUM'],['☁️','BULUT'],['🌌','UZAY'],['🟣','VOID'],['💎','KRİSTAL'],['🔥','ATEŞ'],['🧊','DONMUŞ'],['🍄','MANTAR'],['🌲','ORMAN'],['🌑','AY'],['☣️','TOKSİK'],['🌈','GÖKKUŞAĞI'],['⚡','ELEKTRİK'],['🪨','TAŞ'],['🏙️','CYBERPUNK'],['👾','GLITCH']];

function toast(t){const e=$('#readyToast');e.textContent=t;e.classList.remove('hidden');clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.add('hidden'),1700)}
function resizeOverlay(){const d=Math.min(devicePixelRatio||1,1.5);scanOverlay.width=innerWidth*d;scanOverlay.height=innerHeight*d;scanOverlay.style.width=innerWidth+'px';scanOverlay.style.height=innerHeight+'px';sctx.setTransform(d,0,0,d,0,0)}
addEventListener('resize',resizeOverlay);resizeOverlay();

async function startAR(){
 try{
  if(stream){stream.getTracks().forEach(t=>t.stop());stream=null;}
  const mode=await tracking.start(xrCanvas);
  if(mode==='xr8'){video.classList.add('hidden');xrCanvas.classList.remove('hidden');}
  else{
   xrCanvas.classList.add('hidden');video.classList.remove('hidden');
   if(!navigator.mediaDevices?.getUserMedia)throw new Error('Kamera desteklenmiyor');
   stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}},audio:false});video.srcObject=stream;await video.play();
  }
  $('#permissionCard').classList.add('hidden');
  if(!world){world=new SurfaceEngine($('#worldLayer'),tracking);world.start();}
  started=true;await runScan();updateCapability();toast('YÜZEYE DOKUN');
 }catch(err){console.error(err);$('#permissionCard p').textContent='AR kamera açılamadı. Kamera iznini kontrol et.';}
}

function updateCapability(){
 const q=tracking.getPose().quality;
 $('#modeBadge').textContent=q==='xr8'?'8TH WALL • 6DOF':q==='xr8-limited'?'8TH WALL • LIMITED':q==='orientation'?'ORIENTATION FALLBACK':'FALLBACK';
 $('#surfaceConfidence').textContent=q.startsWith('xr8')?'WORLD LOCK':'MANUAL PLACE';
 $('#surfaceName').textContent=q.startsWith('xr8')?'AR SURFACE':'MANUAL SURFACE';
 $('#capabilityText').textContent=q.startsWith('xr8')?'6DoF world tracking aktif. Efekt dokunduğun yerde dünya koordinatına kilitlenir.':'Gerçek 6DoF başlamadı. Efekt yalnızca elle yerleştirilir; yüzey algılandı diye gösterilmez.';
}

async function runScan(){
 const hud=$('#scanHud'),bar=$('#scanProgress'),text=$('#scanText'),surface=$('#surfaceHud');hud.classList.remove('hidden');surface.classList.add('hidden');let p=0;
 await new Promise(r=>{const timer=setInterval(()=>{p+=6+Math.random()*7;bar.style.width=Math.min(p,100)+'%';const q=tracking.getPose().quality;text.textContent=q.startsWith('xr8')?(p<55?'SLAM dünya takibi başlatılıyor…':'Pozisyon kilitleniyor…'):'Kamera hazırlanıyor…';drawScan(Math.min(p,100)/100);if(p>=100){clearInterval(timer);r()}},100)});
 sctx.clearRect(0,0,innerWidth,innerHeight);tracking.recenter();world?.recenter();hud.classList.add('hidden');surface.classList.remove('hidden');
}
function drawScan(p){sctx.clearRect(0,0,innerWidth,innerHeight);sctx.strokeStyle='rgba(93,235,255,.35)';sctx.lineWidth=1.2;const y=innerHeight*(.3+.55*p);sctx.beginPath();sctx.moveTo(0,y);sctx.lineTo(innerWidth,y);sctx.stroke();}

const grid=$('#elementGrid');
ELEMENTS.forEach(([icon,name],i)=>{const b=document.createElement('button');b.innerHTML=`${icon}<span>${name}</span>`;if(i===0)b.classList.add('selected');b.onclick=()=>{currentElement=name;[...grid.children].forEach(x=>x.classList.remove('selected'));b.classList.add('selected');world?.setElement(name)};grid.appendChild(b)});

function openPanel(id){$$('.panel').forEach(p=>p.classList.add('hidden'));$(id).classList.remove('hidden')}
$$('[data-close]').forEach(b=>b.onclick=()=>$('#'+b.dataset.close).classList.add('hidden'));
$('#settingsBtn').onclick=()=>openPanel('#settingsPanel');$('#startBtn').onclick=startAR;$('#cameraFlipBtn').onclick=()=>toast('AR modunda arka kamera kullanılır');
$('#applyFloorBtn').onclick=()=>{world?.setElement(currentElement);$('#elementsPanel').classList.add('hidden');placingEnabled=true;toast('ŞİMDİ YÜZEYE DOKUN')};
$('#recalibrateBtn').onclick=runScan;$('#qualitySelect').onchange=e=>{quality=e.target.value;world?.setQuality(quality)};$('#meshToggle').onchange=e=>{meshVisible=e.target.checked;world?.setGridVisible(meshVisible)};$('#motionToggle').onchange=e=>{tracking.setEnabled(e.target.checked);updateCapability()};

addEventListener('pointerup',e=>{
 if(!started||!placingEnabled)return;
 if(e.target.closest('button,.panel,.toolbar,.topbar,.capture-stack,textarea,select,input'))return;
 if($$('.panel:not(.hidden)').length)return;
 const type=world?.placeSurface(e.clientX,e.clientY);if(!type)return;
 world.setElement(currentElement);toast(type==='floor'?`${currentElement} • ZEMİNE KİLİTLENDİ`:`${currentElement} • DUVARA KİLİTLENDİ`);
});

let pinchStart=0;
addEventListener('touchstart',e=>{if(e.touches.length===2)pinchStart=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY)},{passive:true});
addEventListener('touchmove',e=>{if(e.touches.length===2&&pinchStart&&world){const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);world.scaleSurface(Math.max(.9,Math.min(1.1,d/pinchStart)));pinchStart=d}},{passive:true});

$$('.toolbar button').forEach(btn=>btn.onclick=()=>{ $$('.toolbar button').forEach(x=>x.classList.remove('active'));btn.classList.add('active');const tool=btn.dataset.tool;if(tool==='elements')openPanel('#elementsPanel');else if(tool==='ai')openPanel('#aiPanel');else if(tool==='portal'){const on=world?.togglePortal();toast(on?'🌀 PORTAL AÇILDI':'PORTAL KAPANDI')}else if(tool==='chaos'){world?.setElement('ELEKTRİK');toast('⚡ ELEKTRİK')}else if(tool==='spawn')toast('🐉 SPAWN sonraki aşama');else toast('🎮 GAMES sonraki aşama')});

$$('[data-prompt]').forEach(b=>b.onclick=()=>{$('#aiPrompt').value=b.dataset.prompt});$('#aiGenerateBtn').onclick=async()=>{const p=$('#aiPrompt').value.trim();if(!p)return toast('Bir dünya tarif et');await sendAI(p)};
async function sendAI(prompt){$('#aiStatus').textContent='AI düşünüyor…';try{const r=await fetch('/api/ai',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({prompt})});if(!r.ok)throw new Error(await r.text());const d=await r.json();applyPlan(d.plan||d);$('#aiStatus').textContent='AI planı uygulandı.'}catch{applyPlan(localPlan(prompt));$('#aiStatus').textContent='Yerel komut motoru kullanıldı.'}}
function localPlan(text=''){const s=text.toLocaleLowerCase('tr');let e='KRİSTAL';if(s.includes('lav'))e='LAV';else if(s.includes('buz')||s.includes('dondur'))e='BUZ';else if(s.includes('su'))e='SU';else if(s.includes('orman'))e='ORMAN';else if(s.includes('uzay'))e='UZAY';else if(s.includes('cyber')||s.includes('neon'))e='CYBERPUNK';return {actions:[{type:'paint',element:e},{type:s.includes('portal')?'portal':'noop'}]}}
function applyPlan(plan){for(const a of plan.actions||[]){if(a.type==='paint'&&a.element){currentElement=a.element;world?.setElement(a.element)}if(a.type==='portal')world?.togglePortal(true)}$('#aiPanel').classList.add('hidden');toast('AI HAZIR • YÜZEYE DOKUN')}

$('#voiceBtn').onclick=()=>{const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR)return toast('Sesli komut desteklenmiyor');const rec=new SR();rec.lang='tr-TR';rec.start();toast('🎙️ Dinliyorum…');rec.onresult=e=>sendAI(e.results[0][0].transcript)};
$('#photoBtn').onclick=()=>{if(!started)return toast('Önce AR başlat');const out=document.createElement('canvas');out.width=innerWidth;out.height=innerHeight;const o=out.getContext('2d');try{o.drawImage(xrCanvas.classList.contains('hidden')?video:xrCanvas,0,0,out.width,out.height)}catch{}const gl=$('#worldLayer canvas');if(gl)o.drawImage(gl,0,0,out.width,out.height);out.toBlob(blob=>{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='mirrorrealm-'+Date.now()+'.jpg';a.click()},'image/jpeg',.92)};
updateCapability();