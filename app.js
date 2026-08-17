const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

const camera = $('#camera');
const fx = $('#fx');
const scanOverlay = $('#scanOverlay');
const ctx = fx.getContext('2d');
const sctx = scanOverlay.getContext('2d');
const permissionCard = $('#permissionCard');
const scanHud = $('#scanHud');
const scanProgress = $('#scanProgress');
const scanText = $('#scanText');
const readyToast = $('#readyToast');
const modeBadge = $('#modeBadge');
const capabilityText = $('#capabilityText');
const surfaceHud = $('#surfaceHud');
const surfaceConfidence = $('#surfaceConfidence');

let stream = null;
let facingMode = 'environment';
let currentElement = 'LAV';
let activeElement = null;
let scanning = false;
let active = false;
let quality = 'MEDIUM';
let arSupported = false;
let motionEnabled = true;
let showMesh = true;
let gyroBeta = 72;
let gyroGamma = 0;
let horizon = 0.46;
let estimatedHorizon = 0.46;
let floorConfidence = 0.74;
let transition = 0;
let lastSample = 0;
let sparks = [];

const sampleCanvas = document.createElement('canvas');
sampleCanvas.width = 72;
sampleCanvas.height = 108;
const sampleCtx = sampleCanvas.getContext('2d',{willReadFrequently:true});

const ELEMENTS = [
  ['🌋','LAV'],['🌊','SU'],['❄️','BUZ'],['🌱','ÇİMEN'],['🏜️','KUM'],['☁️','BULUT'],['🌌','UZAY'],['🟣','VOID'],
  ['💎','KRİSTAL'],['🔥','ATEŞ'],['🧊','DONMUŞ'],['🍄','MANTAR'],['🌲','ORMAN'],['🌑','AY'],['☣️','TOKSİK'],['🌈','GÖKKUŞAĞI'],
  ['⚡','ELEKTRİK'],['🪨','TAŞ'],['🏙️','CYBERPUNK'],['👾','GLITCH']
];

function resizeCanvas(){
  const dpr = Math.min(devicePixelRatio || 1, quality==='ULTRA'?2:quality==='HIGH'?1.7:quality==='MEDIUM'?1.35:1);
  for(const c of [fx,scanOverlay]){
    c.width = innerWidth*dpr; c.height = innerHeight*dpr;
    c.style.width = innerWidth+'px'; c.style.height = innerHeight+'px';
  }
  ctx.setTransform(dpr,0,0,dpr,0,0);
  sctx.setTransform(dpr,0,0,dpr,0,0);
}
addEventListener('resize',resizeCanvas); resizeCanvas();

async function detectAR(){
  try{ arSupported=!!(navigator.xr && await navigator.xr.isSessionSupported('immersive-ar')); }catch{ arSupported=false; }
  modeBadge.textContent = arSupported ? 'WEBXR READY' : 'REALITY ESTIMATION';
  capabilityText.textContent = arSupported
    ? 'WebXR immersive-ar kullanılabilir. Bu web sürümü güvenli fallback motorunu da korur.'
    : 'Safari tam ARKit plane/depth verisi sunmadığı için zemin alanı kamera görüntüsü + hareket sensörüyle tahmin edilir. Native sürümde gerçek ARKit plane mesh kullanılabilir.';
}
detectAR();

async function requestMotion(){
  if(!motionEnabled) return;
  try{
    if(typeof DeviceOrientationEvent!=='undefined' && typeof DeviceOrientationEvent.requestPermission==='function'){
      const r=await DeviceOrientationEvent.requestPermission();
      if(r!=='granted') return;
    }
    addEventListener('deviceorientation',e=>{
      if(typeof e.beta==='number') gyroBeta=e.beta;
      if(typeof e.gamma==='number') gyroGamma=e.gamma;
    },{passive:true});
  }catch(e){ console.warn('motion unavailable',e); }
}

async function startCamera(){
  if(!navigator.mediaDevices?.getUserMedia){
    permissionCard.querySelector('p').textContent='Bu tarayıcı kamera erişimini desteklemiyor.'; return;
  }
  try{
    await requestMotion();
    if(stream) stream.getTracks().forEach(t=>t.stop());
    stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:facingMode},width:{ideal:1920},height:{ideal:1080}},audio:false});
    camera.srcObject=stream;
    await camera.play();
    permissionCard.classList.add('hidden');
    active=true;
    startScan();
  }catch(err){
    permissionCard.querySelector('p').textContent='Kamera izni alınamadı. Safari ayarlarından kamera iznini açıp tekrar dene.';
    console.error(err);
  }
}
$('#startBtn').addEventListener('click',startCamera);
$('#cameraFlipBtn').addEventListener('click',async()=>{facingMode=facingMode==='environment'?'user':'environment';if(active)await startCamera();});

function startScan(){
  scanning=true; activeElement=null; transition=0; floorConfidence=.55;
  scanHud.classList.remove('hidden'); surfaceHud.classList.add('hidden');
  let p=0;
  const timer=setInterval(()=>{
    p += 3.5+Math.random()*5;
    scanProgress.style.width=Math.min(100,p)+'%';
    scanText.textContent=p<32?'Kamera dengeleniyor…':p<68?'Zemin sınırı tahmin ediliyor…':'Perspektif ağı kilitleniyor…';
    if(p>=100){
      clearInterval(timer); scanning=false;
      floorConfidence=Math.max(.72,floorConfidence);
      scanHud.classList.add('hidden'); surfaceHud.classList.remove('hidden');
      toast('DÜNYA HAZIR');
    }
  },130);
}

function estimateFloorFromFrame(now){
  if(!active || camera.readyState<2 || now-lastSample<450) return;
  lastSample=now;
  try{
    sampleCtx.drawImage(camera,0,0,sampleCanvas.width,sampleCanvas.height);
    const {data}=sampleCtx.getImageData(0,0,sampleCanvas.width,sampleCanvas.height);
    const w=sampleCanvas.width,h=sampleCanvas.height;
    const row=[];
    for(let y=0;y<h;y++){
      let sum=0;
      for(let x=0;x<w;x+=3){
        const i=(y*w+x)*4; sum += data[i]*.299+data[i+1]*.587+data[i+2]*.114;
      }
      row[y]=sum/(Math.ceil(w/3));
    }
    let bestY=Math.round(h*.46),best=-1;
    for(let y=Math.round(h*.32);y<Math.round(h*.63);y++){
      const g=Math.abs(row[y+2]-row[y-2]);
      if(g>best){best=g;bestY=y;}
    }
    const visual=bestY/h;
    const gyroInfluence=Math.max(-.055,Math.min(.055,(gyroBeta-70)*.0022));
    estimatedHorizon=Math.max(.34,Math.min(.60,visual*.72+(.46+gyroInfluence)*.28));
    horizon += (estimatedHorizon-horizon)*.08;
    floorConfidence=Math.max(.58,Math.min(.94,.62+best/95));
    surfaceConfidence.textContent='EST. '+Math.round(floorConfidence*100)+'%';
  }catch(e){}
}

function floorPoly(){
  const w=innerWidth,h=innerHeight;
  const hy=horizon*h;
  const skew=Math.max(-.08,Math.min(.08,gyroGamma/180));
  const topHalf=w*(.24+Math.max(0,(.52-horizon))*.18);
  const center=w*(.5+skew*.5);
  return [
    {x:center-topHalf,y:hy},
    {x:center+topHalf,y:hy},
    {x:w*1.06,y:h*1.01},
    {x:-w*.06,y:h*1.01}
  ];
}

function pathFloor(c=ctx){
  const p=floorPoly(); c.beginPath();c.moveTo(p[0].x,p[0].y);for(let i=1;i<p.length;i++)c.lineTo(p[i].x,p[i].y);c.closePath();
}

function clipFloor(){ctx.save();pathFloor();ctx.clip();}
function finishFloor(){ctx.restore();}

function floorY(t){ return horizon*innerHeight + (innerHeight-horizon*innerHeight)*Math.pow(t,1.22); }
function floorHalfWidth(t){ const p=floorPoly(); const top=(p[1].x-p[0].x)/2; return top+(innerWidth*.58-top)*Math.pow(t,1.05); }
function floorCenter(){ return innerWidth*(.5+Math.max(-.08,Math.min(.08,gyroGamma/180))*.5); }

function baseFill(a,b,alpha=.7){
  const g=ctx.createLinearGradient(0,horizon*innerHeight,0,innerHeight);
  g.addColorStop(0,a);g.addColorStop(1,b);ctx.globalAlpha=alpha;ctx.fillStyle=g;pathFloor();ctx.fill();ctx.globalAlpha=1;
}

function drawPerspectiveLines(color,now,speed=0.00025,alpha=.35){
  ctx.strokeStyle=color;ctx.lineWidth=1;ctx.globalAlpha=alpha;
  for(let i=0;i<9;i++){
    let t=((i/9)+(now*speed)%1)%1; const y=floorY(t); const hw=floorHalfWidth(t); const cx=floorCenter();
    ctx.beginPath();ctx.moveTo(cx-hw,y);ctx.lineTo(cx+hw,y);ctx.stroke();
  }
  ctx.globalAlpha=1;
}

function renderLav(now){
  baseFill('#260404','#7a1200',.79);
  ctx.globalCompositeOperation='screen';
  for(let k=0;k<14;k++){
    const t=(k+1)/15, y=floorY(t), hw=floorHalfWidth(t), cx=floorCenter();
    ctx.strokeStyle=k%3===0?'#ffd56b':'#ff4a0b';ctx.lineWidth=1.6+2.4*t;ctx.globalAlpha=.45+.25*Math.sin(now*.002+k);
    ctx.beginPath();
    for(let x=-hw;x<=hw;x+=16){
      const yy=y+Math.sin(x*.035+k*1.7+now*.0022)*7*t+Math.sin(x*.012-now*.0014)*5*t;
      if(x===-hw)ctx.moveTo(cx+x,yy);else ctx.lineTo(cx+x,yy);
    }
    ctx.stroke();
  }
  ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
}

function renderWater(now){
  baseFill('rgba(20,113,170,.48)','rgba(0,76,145,.72)',1);
  drawPerspectiveLines('#8beaff',now,.00016,.38);
  ctx.globalCompositeOperation='screen';
  for(let i=0;i<7;i++){
    const t=.2+i*.12,y=floorY(t);ctx.strokeStyle='#bff8ff';ctx.globalAlpha=.18;ctx.lineWidth=2;
    ctx.beginPath();for(let x=0;x<=innerWidth;x+=12){const yy=y+Math.sin(x*.035+now*.002+i)*5*(.4+t);x?ctx.lineTo(x,yy):ctx.moveTo(x,yy)}ctx.stroke();
  }
  ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
}

function renderIce(now){
  baseFill('rgba(176,245,255,.34)','rgba(73,177,221,.58)',1);
  ctx.strokeStyle='rgba(230,253,255,.62)';ctx.lineWidth=1.3;
  const cx=floorCenter();
  for(let i=0;i<18;i++){
    const a=(i/18)*Math.PI*2+Math.sin(i*9)*.3, len=80+(i%5)*32;
    const x=cx+Math.cos(a)*18,y=floorY(.62)+Math.sin(a)*14;
    ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+Math.cos(a)*len,y+Math.sin(a)*len*.42);ctx.stroke();
  }
  ctx.globalAlpha=.18;ctx.fillStyle='#fff';for(let i=0;i<18;i++){const x=(i*97)%innerWidth,y=floorY(((i*37)%100)/100);ctx.fillRect(x,y,1+(i%3),1+(i%2));}ctx.globalAlpha=1;
}

function renderGrass(now){
  baseFill('rgba(24,91,38,.58)','rgba(32,112,43,.78)',1);
  ctx.strokeStyle='rgba(129,223,102,.6)';ctx.lineWidth=1;
  for(let i=0;i<95;i++){
    const x=(i*83+17)%innerWidth,t=((i*47)%100)/100,y=floorY(t),len=3+8*t;
    ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+Math.sin(now*.002+i)*2,y-len);ctx.stroke();
  }
}

function renderSand(now){
  baseFill('rgba(193,151,78,.62)','rgba(230,190,111,.8)',1);
  ctx.strokeStyle='rgba(255,229,166,.38)';ctx.lineWidth=1.2;
  for(let i=0;i<12;i++){const y=floorY(i/12);ctx.beginPath();for(let x=0;x<innerWidth;x+=14){const yy=y+Math.sin(x*.02+i+now*.00035)*5;x?ctx.lineTo(x,yy):ctx.moveTo(x,yy)}ctx.stroke();}
}

function renderSpace(now){
  baseFill('rgba(4,5,23,.86)','rgba(8,7,42,.94)',1);
  for(let i=0;i<70;i++){
    const x=(i*137)%innerWidth,t=((i*53)%100)/100,y=floorY(t),tw=.5+.5*Math.sin(now*.003+i);
    ctx.globalAlpha=.35+.6*tw;ctx.fillStyle=i%8===0?'#8beaff':'#fff';ctx.beginPath();ctx.arc(x,y,1+(i%3)*.45,0,Math.PI*2);ctx.fill();
  }
  ctx.globalAlpha=1;
}

function renderVoid(now){
  baseFill('rgba(16,0,31,.78)','rgba(53,0,83,.9)',1);
  const cx=floorCenter(),cy=floorY(.62);
  for(let i=0;i<9;i++){ctx.strokeStyle=i%2?'#7e2fff':'#e14dff';ctx.globalAlpha=.18;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(cx,cy,35+i*30,12+i*13,now*.00015,0,Math.PI*2);ctx.stroke();}ctx.globalAlpha=1;
}

function renderCrystal(now){
  baseFill('rgba(52,91,112,.5)','rgba(71,45,120,.68)',1);
  for(let i=0;i<24;i++){
    const x=(i*109)%innerWidth,t=.2+((i*31)%70)/100,y=floorY(t),s=5+18*t;
    ctx.fillStyle=i%2?'rgba(116,239,255,.42)':'rgba(187,111,255,.38)';ctx.beginPath();ctx.moveTo(x,y-s);ctx.lineTo(x+s*.55,y);ctx.lineTo(x,y+s*.3);ctx.lineTo(x-s*.55,y);ctx.closePath();ctx.fill();
  }
}

function renderFire(now){
  baseFill('rgba(40,7,0,.46)','rgba(95,20,0,.7)',1);
  for(let i=0;i<34;i++){
    const x=(i*91)%innerWidth,t=.25+((i*43)%70)/100,y=floorY(t),s=6+13*t;
    ctx.globalAlpha=.25+.35*Math.sin(now*.005+i);ctx.fillStyle=i%3?'#ff6a00':'#ffd45e';ctx.beginPath();ctx.moveTo(x,y-s*1.8);ctx.quadraticCurveTo(x+s,y-s*.5,x,y);ctx.quadraticCurveTo(x-s,y-s*.5,x,y-s*1.8);ctx.fill();
  }ctx.globalAlpha=1;
}

function renderForest(now){
  baseFill('rgba(8,54,28,.63)','rgba(12,82,40,.82)',1);
  for(let i=0;i<28;i++){
    const x=(i*113)%innerWidth,t=.18+((i*41)%78)/100,y=floorY(t),s=4+12*t;
    ctx.fillStyle='rgba(97,202,91,.55)';ctx.beginPath();ctx.arc(x,y,s,0,Math.PI*2);ctx.fill();
  }
}

function renderMoon(now){baseFill('rgba(88,91,98,.7)','rgba(54,57,63,.86)',1);for(let i=0;i<26;i++){const x=(i*127)%innerWidth,t=((i*37)%100)/100,y=floorY(t),r=3+13*t;ctx.strokeStyle='rgba(28,30,34,.4)';ctx.beginPath();ctx.ellipse(x,y,r,r*.4,0,0,Math.PI*2);ctx.stroke();}}
function renderToxic(now){baseFill('rgba(28,68,9,.58)','rgba(52,105,5,.8)',1);for(let i=0;i<24;i++){const x=(i*101)%innerWidth,t=((i*29)%100)/100,y=floorY(t),r=2+7*(.3+t);ctx.fillStyle='rgba(155,255,31,.33)';ctx.beginPath();ctx.arc(x,y+Math.sin(now*.002+i)*4,r,0,Math.PI*2);ctx.fill();}}
function renderRainbow(now){const colors=['#ff3c62','#ffb43b','#ffe95a','#52e887','#45b8ff','#8367ff','#e75dff'];for(let i=0;i<colors.length;i++){ctx.fillStyle=colors[i];ctx.globalAlpha=.16;const y=floorY(i/colors.length);ctx.fillRect(0,y,innerWidth,innerHeight/colors.length)}ctx.globalAlpha=1;drawPerspectiveLines('#fff',now,.00018,.18);}
function renderElectric(now){baseFill('rgba(8,28,48,.52)','rgba(10,44,72,.72)',1);ctx.strokeStyle='#bffcff';ctx.lineWidth=1.7;for(let i=0;i<9;i++){const x=(i*121+now*.04)%innerWidth,y=floorY(.25+((i*13)%65)/100);ctx.globalAlpha=.25+.35*Math.random();ctx.beginPath();ctx.moveTo(x,y);for(let k=1;k<6;k++)ctx.lineTo(x+(Math.random()-.5)*18,y+k*10);ctx.stroke()}ctx.globalAlpha=1;}
function renderStone(now){baseFill('rgba(85,89,95,.7)','rgba(54,58,64,.85)',1);ctx.strokeStyle='rgba(190,195,202,.18)';for(let i=0;i<11;i++){const y=floorY(i/11);ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(innerWidth,y);ctx.stroke()}for(let x=0;x<innerWidth;x+=70){ctx.beginPath();ctx.moveTo(x,horizon*innerHeight);ctx.lineTo(x+Math.sin(x)*20,innerHeight);ctx.stroke()}}
function renderCyber(now){baseFill('rgba(3,16,34,.82)','rgba(6,9,27,.92)',1);drawPerspectiveLines('#00eaff',now,.00025,.5);ctx.strokeStyle='#ff36dd';ctx.globalAlpha=.38;for(let i=-6;i<=6;i++){ctx.beginPath();ctx.moveTo(floorCenter(),horizon*innerHeight);ctx.lineTo(floorCenter()+i*innerWidth*.15,innerHeight);ctx.stroke()}ctx.globalAlpha=1;}
function renderGlitch(now){baseFill('rgba(2,20,25,.65)','rgba(18,4,35,.82)',1);for(let i=0;i<24;i++){const y=floorY(((i*31)%100)/100),w=30+((i*53)%130),x=((i*97+now*.08)% (innerWidth+120))-60;ctx.globalAlpha=.15+.2*(i%3);ctx.fillStyle=i%2?'#00ff9d':'#ff005d';ctx.fillRect(x,y,w,2+(i%5))}ctx.globalAlpha=1;}
function renderMushroom(now){baseFill('rgba(50,22,58,.65)','rgba(42,64,38,.76)',1);for(let i=0;i<20;i++){const x=(i*117)%innerWidth,t=.2+((i*29)%78)/100,y=floorY(t),r=4+8*t;ctx.fillStyle=i%2?'#e85cff':'#ff668a';ctx.beginPath();ctx.arc(x,y-r,r,Math.PI,0);ctx.fill();ctx.strokeStyle='rgba(245,235,255,.6)';ctx.beginPath();ctx.moveTo(x,y-r);ctx.lineTo(x,y+4);ctx.stroke()}}
function renderCloud(now){baseFill('rgba(188,226,242,.18)','rgba(198,234,248,.35)',1);for(let i=0;i<18;i++){const x=((i*131+now*.012*(i%3+1))%(innerWidth+120))-60,t=.12+((i*43)%75)/100,y=floorY(t);ctx.globalAlpha=.2;ctx.fillStyle='#fff';ctx.beginPath();ctx.ellipse(x,y,30+20*t,8+9*t,0,0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1;}
function renderFrozen(now){renderIce(now);ctx.globalAlpha=.12;ctx.fillStyle='#dffcff';for(let i=0;i<40;i++){const x=(i*79)%innerWidth,y=floorY(((i*17)%100)/100);ctx.fillRect(x,y,2,2)}ctx.globalAlpha=1;}

function renderFloor(now){
  if(!activeElement) return;
  clipFloor();
  if(transition<1) transition=Math.min(1,transition+.035);
  ctx.globalAlpha=transition;
  const map={LAV:renderLav,SU:renderWater,BUZ:renderIce,ÇİMEN:renderGrass,KUM:renderSand,BULUT:renderCloud,UZAY:renderSpace,VOID:renderVoid,KRİSTAL:renderCrystal,ATEŞ:renderFire,DONMUŞ:renderFrozen,MANTAR:renderMushroom,ORMAN:renderForest,AY:renderMoon,TOKSİK:renderToxic,GÖKKUŞAĞI:renderRainbow,ELEKTRİK:renderElectric,TAŞ:renderStone,CYBERPUNK:renderCyber,GLITCH:renderGlitch};
  (map[activeElement]||renderCrystal)(now);
  ctx.globalAlpha=1;finishFloor();
}

function drawMesh(now){
  sctx.clearRect(0,0,innerWidth,innerHeight);
  if(!active || (!scanning && !showMesh)) return;
  const p=floorPoly();
  sctx.save();sctx.strokeStyle=scanning?'rgba(104,242,255,.55)':'rgba(104,242,255,.16)';sctx.lineWidth=1;
  pathFloor(sctx);sctx.stroke();
  for(let i=1;i<8;i++){
    const t=i/8,y=floorY(t),hw=floorHalfWidth(t),cx=floorCenter();sctx.globalAlpha=scanning?.45:.16;sctx.beginPath();sctx.moveTo(cx-hw,y);sctx.lineTo(cx+hw,y);sctx.stroke();
  }
  for(let i=-4;i<=4;i++){
    sctx.beginPath();sctx.moveTo(floorCenter()+i*8,horizon*innerHeight);sctx.lineTo(floorCenter()+i*innerWidth*.15,innerHeight);sctx.stroke();
  }
  if(scanning){
    const sy=horizon*innerHeight+((now*.18)%(innerHeight-horizon*innerHeight));
    sctx.globalAlpha=.85;sctx.strokeStyle='#9af6ff';sctx.shadowColor='#69eaff';sctx.shadowBlur=14;sctx.beginPath();sctx.moveTo(0,sy);sctx.lineTo(innerWidth,sy);sctx.stroke();
  }
  sctx.restore();
}

function spawnSparks(type){
  const cols=type==='LAV'?['#ff7a18','#ffd35c']:type==='ELEKTRİK'?['#fff','#86f5ff']:type==='KRİSTAL'?['#9cf7ff','#c69bff']:['#bff6ff','#fff'];
  const count=quality==='LOW'?10:quality==='MEDIUM'?20:quality==='HIGH'?32:44;
  for(let i=0;i<count;i++) sparks.push({x:Math.random()*innerWidth,y:floorY(.25+Math.random()*.7),vx:(Math.random()-.5)*.35,vy:-.2-Math.random()*.55,a:1,r:1+Math.random()*2.5,c:cols[i%cols.length]});
}
function drawSparks(){
  for(const p of sparks){p.x+=p.vx;p.y+=p.vy;p.a-=.01;ctx.globalAlpha=Math.max(0,p.a);ctx.fillStyle=p.c;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1;sparks=sparks.filter(p=>p.a>0);
}

function loop(now=0){
  estimateFloorFromFrame(now);
  ctx.clearRect(0,0,innerWidth,innerHeight);
  renderFloor(now);drawSparks();drawMesh(now);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

const elementGrid=$('#elementGrid');
ELEMENTS.forEach(([icon,name],i)=>{
  const b=document.createElement('button');b.innerHTML=`${icon}<span>${name}</span>`;if(i===0)b.classList.add('selected');
  b.onclick=()=>{currentElement=name;[...elementGrid.children].forEach(x=>x.classList.remove('selected'));b.classList.add('selected');};
  elementGrid.appendChild(b);
});

function applyFloor(type=currentElement){
  activeElement=type;transition=0;spawnSparks(type);
  $('#elementsPanel').classList.add('hidden');
  toast(`${ELEMENTS.find(e=>e[1]===type)?.[0]||'✨'} TÜM ZEMİN • ${type}`);
}
$('#applyFloorBtn').onclick=()=>applyFloor();

function openPanel(id){$$('.panel').forEach(p=>p.classList.add('hidden'));$(id).classList.remove('hidden');}
$$('[data-close]').forEach(b=>b.onclick=()=>$('#'+b.dataset.close).classList.add('hidden'));
$('#settingsBtn').onclick=()=>openPanel('#settingsPanel');
$$('.toolbar button').forEach(btn=>btn.addEventListener('click',()=>{
  $$('.toolbar button').forEach(x=>x.classList.remove('active'));btn.classList.add('active');const tool=btn.dataset.tool;
  if(tool==='elements')openPanel('#elementsPanel');
  else if(tool==='ai')openPanel('#aiPanel');
  else if(tool==='portal')toast('🌀 Portal motoru sonraki katman');
  else if(tool==='spawn')toast('🐉 Spawn sistemi hazırlanıyor');
  else if(tool==='chaos')toast('🌪️ Chaos sistemi hazırlanıyor');
  else toast('🎮 Mini Games hazırlanıyor');
}));

function toast(msg){readyToast.textContent=msg;readyToast.classList.remove('hidden');clearTimeout(toast._t);toast._t=setTimeout(()=>readyToast.classList.add('hidden'),1700);}

$('#qualitySelect').addEventListener('change',e=>{quality=e.target.value;resizeCanvas();toast('QUALITY • '+quality)});
$('#meshToggle').addEventListener('change',e=>showMesh=e.target.checked);
$('#motionToggle').addEventListener('change',e=>motionEnabled=e.target.checked);
$('#recalibrateBtn').onclick=()=>{openPanel('#settingsPanel');$('#settingsPanel').classList.add('hidden');startScan();};

$$('[data-prompt]').forEach(b=>b.onclick=()=>{$('#aiPrompt').value=b.dataset.prompt});

async function sendAI(prompt){
  $('#aiStatus').textContent='AI düşünüyor…';
  try{
    const r=await fetch('/api/ai',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({prompt})});
    if(!r.ok) throw new Error(await r.text());
    const data=await r.json();$('#aiStatus').textContent='AI planı uygulandı.';applyPlan(data.plan||data);
  }catch(err){console.warn(err);$('#aiStatus').textContent='Yerel komut motoru kullanıldı.';applyPlan(localPlan(prompt));}
}
function localPlan(text=''){
  const s=text.toLocaleLowerCase('tr');const actions=[];
  const add=(keys,el)=>{if(keys.some(k=>s.includes(k)))actions.push({type:'paint',element:el})};
  add(['lav'],'LAV');add(['buz','dondur'],'BUZ');add(['su','sel'],'SU');add(['orman'],'ORMAN');add(['uzay'],'UZAY');add(['cyber','neon'],'CYBERPUNK');add(['ateş','yak'],'ATEŞ');add(['mantar'],'MANTAR');add(['kristal'],'KRİSTAL');
  if(!actions.length)actions.push({type:'paint',element:'KRİSTAL'});return{title:'Local world plan',actions};
}
function applyPlan(plan){
  const a=(plan.actions||[]).find(x=>x.type==='paint');if(a){currentElement=a.element||'KRİSTAL';applyFloor(currentElement)}
  $('#aiPanel').classList.add('hidden');
}
$('#aiGenerateBtn').addEventListener('click',()=>{const p=$('#aiPrompt').value.trim();if(!p)return toast('Dünyanı tarif et');sendAI(p)});

$('#voiceBtn').addEventListener('click',()=>{
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR)return toast('Bu tarayıcı sesli komutu desteklemiyor');
  const rec=new SR();rec.lang='tr-TR';rec.interimResults=false;rec.maxAlternatives=1;toast('🎙️ Dinliyorum…');rec.start();
  rec.onresult=e=>{const text=e.results[0][0].transcript;toast('“'+text+'”');sendAI(text)};rec.onerror=()=>toast('Ses anlaşılamadı');
});

$('#photoBtn').addEventListener('click',()=>{
  if(!active)return toast('Önce kamerayı aç');
  const out=document.createElement('canvas');out.width=camera.videoWidth||1080;out.height=camera.videoHeight||1920;const o=out.getContext('2d');o.drawImage(camera,0,0,out.width,out.height);o.drawImage(fx,0,0,out.width,out.height);
  out.toBlob(blob=>{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='mirrorrealm-'+Date.now()+'.jpg';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1800)},'image/jpeg',.92);
});