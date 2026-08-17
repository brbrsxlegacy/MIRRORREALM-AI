import * as THREE from 'three';

const MODE={
  LAV:0,SU:1,BUZ:2,ÇİMEN:3,KUM:4,BULUT:5,UZAY:6,VOID:7,KRİSTAL:8,ATEŞ:9,
  DONMUŞ:10,MANTAR:11,ORMAN:12,AY:13,TOKSİK:14,GÖKKUŞAĞI:15,ELEKTRİK:16,TAŞ:17,CYBERPUNK:18,GLITCH:19
};

const vertexShader=`
varying vec2 vUv;
varying vec3 vWorld;
void main(){
  vUv=uv;
  vec4 world=modelMatrix*vec4(position,1.0);
  vWorld=world.xyz;
  gl_Position=projectionMatrix*viewMatrix*world;
}`;

const fragmentShader=`
precision highp float;
uniform float uTime;
uniform float uMode;
uniform float uIntensity;
varying vec2 vUv;
varying vec3 vWorld;

float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
float noise(vec2 p){
  vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);
}
float fbm(vec2 p){float v=0.;float a=.5;for(int i=0;i<5;i++){v+=a*noise(p);p*=2.03;a*=.5;}return v;}
float grid(vec2 uv,float scale){vec2 g=abs(fract(uv*scale-.5)-.5)/fwidth(uv*scale);return 1.-min(min(g.x,g.y),1.);}

vec3 lava(vec2 uv){
  float n=fbm(uv*5.+vec2(uTime*.07,-uTime*.035));
  float cracks=smoothstep(.56,.72,abs(sin((uv.x+n*.35)*23.))*abs(sin((uv.y-n*.2)*17.))+.22*n);
  vec3 dark=vec3(.08,.005,.0),hot=vec3(1.,.12,.0),gold=vec3(1.,.72,.08);
  return mix(mix(dark,hot,smoothstep(.32,.7,n)),gold,cracks*.8);
}
vec3 water(vec2 uv){
  float w=sin((uv.x*16.+uTime*.9)+sin(uv.y*9.))*0.5+0.5;
  w+=sin((uv.y*20.-uTime*.7)+sin(uv.x*8.))*0.25;
  float caust=smoothstep(.7,.95,fbm(uv*11.+uTime*.04));
  return mix(vec3(.0,.12,.32),vec3(.0,.58,.9),w*.55)+caust*vec3(.35,.9,1.);
}
vec3 ice(vec2 uv){
  float c=abs(sin((uv.x+uv.y)*28.)*sin((uv.x-uv.y)*21.));
  float n=fbm(uv*8.);
  return mix(vec3(.32,.72,.92),vec3(.88,1.,1.),smoothstep(.62,.82,c+n*.25));
}
vec3 grass(vec2 uv){float n=fbm(uv*9.);float blades=smoothstep(.86,.98,hash(floor(uv*80.)));return vec3(.04,.22,.06)+vec3(.1,.55,.12)*n+blades*vec3(.3,.8,.2);}
vec3 sand(vec2 uv){float d=fbm(uv*5.+vec2(uTime*.01,0.));float rip=.5+.5*sin((uv.y+d*.14)*45.);return mix(vec3(.52,.33,.12),vec3(.94,.72,.33),rip*.5+d*.3);}
vec3 clouds(vec2 uv){float n=fbm(uv*3.+vec2(uTime*.025,0.));return mix(vec3(.4,.62,.78),vec3(1.),smoothstep(.42,.72,n));}
vec3 space(vec2 uv){float s=smoothstep(.996,1.,hash(floor(uv*120.)));float neb=fbm(uv*3.+vec2(uTime*.01,0.));return vec3(.01,.0,.06)+vec3(.18,.03,.42)*neb+s*vec3(1.);}
vec3 voidc(vec2 uv){vec2 p=uv-.5;float r=length(p);float a=atan(p.y,p.x);float ring=.5+.5*sin(r*48.-uTime*2.+a*5.);return vec3(.05,0.,.08)+vec3(.5,.02,.9)*ring*(1.-smoothstep(.1,.7,r));}
vec3 crystal(vec2 uv){float f=abs(fract((uv.x+uv.y)*9.)-.5)+abs(fract((uv.x-uv.y)*13.)-.5);float shine=smoothstep(.25,.03,f);return vec3(.05,.18,.25)+vec3(.2,.8,1.)*shine+vec3(.55,.12,.8)*fbm(uv*6.);}
vec3 firec(vec2 uv){float n=fbm(vec2(uv.x*6.,uv.y*5.-uTime*.7));float f=smoothstep(.25,.85,n+(1.-uv.y)*.4);return mix(vec3(.12,0.,0.),vec3(1.,.45,.02),f);}
vec3 frozen(vec2 uv){float g=grid(uv+vec2(fbm(uv*3.)*.03),12.);return vec3(.2,.55,.75)+g*vec3(.65,.95,1.);}
vec3 mushroom(vec2 uv){float n=fbm(uv*7.);float dots=smoothstep(.94,1.,hash(floor(uv*28.)));return vec3(.14,.05,.18)+vec3(.62,.08,.5)*n+dots*vec3(1.,.35,.5);}
vec3 forest(vec2 uv){float n=fbm(uv*4.);float trunks=smoothstep(.47,.5,abs(fract(uv.x*16.+n*.2)-.5));return vec3(.015,.09,.03)+vec3(.04,.35,.09)*n+trunks*vec3(.08,.04,.01);}
vec3 moon(vec2 uv){float n=fbm(uv*12.);float pits=smoothstep(.72,.9,fbm(uv*22.));return vec3(.22,.22,.24)+n*.22-pits*.15;}
vec3 toxic(vec2 uv){float n=fbm(uv*6.+vec2(uTime*.03,0.));float bub=smoothstep(.82,.96,hash(floor(uv*22.+uTime*.2)));return vec3(.03,.14,.01)+vec3(.3,.8,.02)*n+bub*vec3(.75,1.,.1);}
vec3 rainbow(vec2 uv){float h=uv.x*5.+uv.y*2.+uTime*.15;return .55+.45*cos(6.28318*(h+vec3(0.,.33,.67)));}
vec3 electric(vec2 uv){float n=fbm(uv*8.);float bolt=smoothstep(.045,.0,abs(uv.x-.5-.18*sin(uv.y*24.+n*3.+uTime*4.)));return vec3(.0,.04,.12)+bolt*vec3(.5,.95,1.);}
vec3 stone(vec2 uv){float n=fbm(uv*9.);float mortar=grid(uv+vec2(step(.5,fract(uv.y*8.))*.04,0.),8.);return vec3(.16,.17,.18)+n*.22-mortar*.12;}
vec3 cyber(vec2 uv){float g=grid(uv,16.);float pulse=.5+.5*sin(uTime*2.+uv.y*20.);return vec3(.01,.01,.06)+g*mix(vec3(0.,1.,1.),vec3(1.,0.,.8),pulse);}
vec3 glitch(vec2 uv){float line=step(.86,hash(vec2(floor(uv.y*70.+uTime*8.),floor(uTime*3.))));float off=(hash(vec2(floor(uv.y*90.),floor(uTime*8.)))-.5)*.18*line;float n=hash(floor((uv+vec2(off,0.))*vec2(90.,60.)));return vec3(n*.1+line*.8,line*.15+n*.1,n*.08+line*.9);}

void main(){
  vec2 uv=vUv*4.;
  vec3 c;
  if(uMode<.5)c=lava(uv);
  else if(uMode<1.5)c=water(uv);
  else if(uMode<2.5)c=ice(uv);
  else if(uMode<3.5)c=grass(uv);
  else if(uMode<4.5)c=sand(uv);
  else if(uMode<5.5)c=clouds(uv);
  else if(uMode<6.5)c=space(uv);
  else if(uMode<7.5)c=voidc(uv);
  else if(uMode<8.5)c=crystal(uv);
  else if(uMode<9.5)c=firec(uv);
  else if(uMode<10.5)c=frozen(uv);
  else if(uMode<11.5)c=mushroom(uv);
  else if(uMode<12.5)c=forest(uv);
  else if(uMode<13.5)c=moon(uv);
  else if(uMode<14.5)c=toxic(uv);
  else if(uMode<15.5)c=rainbow(uv);
  else if(uMode<16.5)c=electric(uv);
  else if(uMode<17.5)c=stone(uv);
  else if(uMode<18.5)c=cyber(uv);
  else c=glitch(uv);
  float vign=1.-smoothstep(.55,.95,length(vUv-.5));
  gl_FragColor=vec4(c*uIntensity,clamp(.76+.18*vign,0.,.95));
}`;

export class WorldEngine{
  constructor(container,tracking){
    this.container=container;
    this.tracking=tracking;
    this.clock=new THREE.Clock();
    this.scene=new THREE.Scene();
    this.camera=new THREE.PerspectiveCamera(62,innerWidth/innerHeight,.01,100);
    this.camera.position.set(0,1.55,0);
    this.renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));
    this.renderer.setSize(innerWidth,innerHeight);
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.container.appendChild(this.renderer.domElement);

    this.uniforms={uTime:{value:0},uMode:{value:MODE.LAV},uIntensity:{value:1.0}};
    this.material=new THREE.ShaderMaterial({vertexShader,fragmentShader,uniforms:this.uniforms,transparent:true,depthWrite:false,side:THREE.DoubleSide});
    this.floor=new THREE.Mesh(new THREE.PlaneGeometry(24,24,1,1),this.material);
    this.floor.rotation.x=-Math.PI/2;
    this.floor.position.set(0,-1.25,-5.5);
    this.scene.add(this.floor);

    this.grid=new THREE.GridHelper(24,24,0x63e7ff,0x63e7ff);
    this.grid.position.copy(this.floor.position);
    this.grid.position.y+=.012;
    this.grid.material.transparent=true;
    this.grid.material.opacity=.12;
    this.scene.add(this.grid);

    this.portal=this.createPortal();
    this.scene.add(this.portal);
    this.portal.visible=false;

    this.resize=()=>{this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();this.renderer.setSize(innerWidth,innerHeight);};
    addEventListener('resize',this.resize);
  }

  createPortal(){
    const group=new THREE.Group();
    group.position.set(0,.35,-4.4);
    const ringMat=new THREE.MeshBasicMaterial({color:0x7aeaff,transparent:true,opacity:.92,side:THREE.DoubleSide});
    const ring=new THREE.Mesh(new THREE.TorusGeometry(1.05,.08,24,80),ringMat);
    group.add(ring);
    const innerMat=new THREE.ShaderMaterial({transparent:true,side:THREE.DoubleSide,uniforms:{uTime:{value:0}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'precision highp float;uniform float uTime;varying vec2 vUv;float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}void main(){vec2 p=vUv-.5;float r=length(p);float a=atan(p.y,p.x);float w=.5+.5*sin(14.*r-2.*uTime+4.*a);vec3 c=mix(vec3(.02,.0,.12),vec3(.1,.8,1.),w);float star=smoothstep(.995,1.,h(floor(vUv*80.)));c+=star;gl_FragColor=vec4(c,smoothstep(.5,.46,r));}'});
    const inner=new THREE.Mesh(new THREE.CircleGeometry(.97,80),innerMat);
    group.add(inner);
    group.userData.inner=inner;
    return group;
  }

  setElement(name){this.uniforms.uMode.value=MODE[name]??MODE.LAV;}
  setQuality(q){const ratio=q==='ULTRA'?2:q==='HIGH'?1.7:q==='MEDIUM'?1.35:1;this.renderer.setPixelRatio(Math.min(devicePixelRatio,ratio));this.resize();}
  setGridVisible(v){this.grid.visible=!!v;}
  togglePortal(force){this.portal.visible=typeof force==='boolean'?force:!this.portal.visible;return this.portal.visible;}
  recenter(){this.tracking.recenter();}

  start(){
    const render=()=>{
      this.frame=requestAnimationFrame(render);
      const t=this.clock.getElapsedTime();
      this.uniforms.uTime.value=t;
      if(this.portal.visible){this.portal.rotation.z=Math.sin(t*.8)*.02;this.portal.userData.inner.material.uniforms.uTime.value=t;}
      const pose=this.tracking.getPose();
      this.camera.rotation.order='YXZ';
      this.camera.rotation.y=pose.yaw;
      this.camera.rotation.x=pose.pitch;
      this.camera.rotation.z=pose.roll*.65;
      this.renderer.render(this.scene,this.camera);
    };
    render();
  }

  destroy(){cancelAnimationFrame(this.frame);removeEventListener('resize',this.resize);this.renderer.dispose();this.container.innerHTML='';}
}
