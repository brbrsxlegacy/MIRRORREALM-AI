import * as THREE from 'three';

const MODE={LAV:0,SU:1,BUZ:2,ÇİMEN:3,KUM:4,BULUT:5,UZAY:6,VOID:7,KRİSTAL:8,ATEŞ:9,DONMUŞ:10,MANTAR:11,ORMAN:12,AY:13,TOKSİK:14,GÖKKUŞAĞI:15,ELEKTRİK:16,TAŞ:17,CYBERPUNK:18,GLITCH:19};

const vertexShader=`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
const fragmentShader=`
precision highp float;uniform float uTime;uniform float uMode;varying vec2 vUv;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n(p);p*=2.03;a*=.5;}return v;}
vec3 effect(float m,vec2 uv){
 if(m<.5){float q=fbm(uv*5.+vec2(uTime*.08,-uTime*.04));float c=smoothstep(.58,.76,abs(sin((uv.x+q*.3)*23.))*abs(sin((uv.y-q*.2)*17.))+.2*q);return mix(mix(vec3(.05,0.,0.),vec3(1.,.08,0.),q),vec3(1.,.72,.08),c);}
 if(m<1.5){float w=.5+.5*sin(uv.x*22.+sin(uv.y*8.)+uTime*1.4);return mix(vec3(0.,.08,.28),vec3(0.,.7,1.),w*.65)+smoothstep(.75,.95,fbm(uv*10.+uTime*.03))*vec3(.25,.8,1.);}
 if(m<2.5){float c=abs(sin((uv.x+uv.y)*25.)*sin((uv.x-uv.y)*20.));return mix(vec3(.25,.68,.9),vec3(.9,1.,1.),smoothstep(.6,.82,c));}
 if(m<3.5){return vec3(.03,.18,.05)+vec3(.08,.55,.1)*fbm(uv*9.);}
 if(m<4.5){float r=.5+.5*sin((uv.y+fbm(uv*4.)*.1)*42.);return mix(vec3(.48,.3,.1),vec3(.95,.72,.32),r*.65);}
 if(m<5.5){float q=fbm(uv*3.+vec2(uTime*.03,0.));return mix(vec3(.36,.58,.78),vec3(1.),smoothstep(.4,.72,q));}
 if(m<6.5){float s=smoothstep(.995,1.,h(floor(uv*100.)));return vec3(.01,0.,.06)+vec3(.18,.03,.4)*fbm(uv*3.)+s;}
 if(m<7.5){vec2 p=uv-.5;float r=length(p);return vec3(.04,0.,.07)+vec3(.5,.02,.9)*(.5+.5*sin(r*45.-uTime*2.));}
 if(m<8.5){float f=abs(fract((uv.x+uv.y)*9.)-.5);return vec3(.04,.15,.22)+vec3(.2,.85,1.)*smoothstep(.2,.03,f)+vec3(.5,.1,.7)*fbm(uv*5.);}
 if(m<9.5){float q=fbm(vec2(uv.x*6.,uv.y*5.-uTime*.7));return mix(vec3(.1,0.,0.),vec3(1.,.45,0.),q);}
 if(m<10.5){return vec3(.2,.55,.75)+vec3(.6,.9,1.)*smoothstep(.7,.92,fbm(uv*12.));}
 if(m<11.5){return vec3(.12,.04,.17)+vec3(.65,.08,.5)*fbm(uv*7.);}
 if(m<12.5){return vec3(.01,.08,.02)+vec3(.03,.32,.08)*fbm(uv*5.);}
 if(m<13.5){return vec3(.18)+vec3(.22)*fbm(uv*12.);}
 if(m<14.5){return vec3(.02,.12,.01)+vec3(.3,.8,.01)*fbm(uv*6.+uTime*.03);}
 if(m<15.5){return .55+.45*cos(6.28318*(uv.x*3.+uv.y+uTime*.1+vec3(0.,.33,.67)));}
 if(m<16.5){float bolt=smoothstep(.05,0.,abs(uv.x-.5-.18*sin(uv.y*24.+uTime*5.)));return vec3(0.,.03,.12)+bolt*vec3(.6,1.,1.);}
 if(m<17.5){return vec3(.14,.15,.16)+vec3(.25)*fbm(uv*9.);}
 if(m<18.5){float gx=smoothstep(.04,0.,abs(fract(uv.x*14.)-.5));float gy=smoothstep(.04,0.,abs(fract(uv.y*14.)-.5));return vec3(.01,.01,.05)+(gx+gy)*mix(vec3(0.,1.,1.),vec3(1.,0.,.8),.5+.5*sin(uTime*2.));}
 float line=step(.86,h(vec2(floor(uv.y*70.+uTime*8.),floor(uTime*3.))));return vec3(line*.8,line*.15,line*.95)+vec3(h(floor(uv*80.))*.08);
}
void main(){vec2 uv=vUv*4.;vec3 c=effect(uMode,uv);float edge=smoothstep(0.,.08,vUv.x)*smoothstep(0.,.08,vUv.y)*smoothstep(0.,.08,1.-vUv.x)*smoothstep(0.,.08,1.-vUv.y);gl_FragColor=vec4(c,.88*edge);}`;

export class SurfaceEngine{
 constructor(container,tracking){
  this.container=container;this.tracking=tracking;this.clock=new THREE.Clock();this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(62,innerWidth/innerHeight,.01,100);this.camera.position.set(0,1.55,0);
  this.renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.renderer.setSize(innerWidth,innerHeight);this.renderer.outputColorSpace=THREE.SRGBColorSpace;container.appendChild(this.renderer.domElement);
  this.uniforms={uTime:{value:0},uMode:{value:MODE.LAV}};this.material=new THREE.ShaderMaterial({vertexShader,fragmentShader,uniforms:this.uniforms,transparent:true,depthWrite:false,side:THREE.DoubleSide});
  this.surface=new THREE.Mesh(new THREE.PlaneGeometry(2.4,2.4),this.material);this.surface.visible=false;this.scene.add(this.surface);
  this.outline=new THREE.LineSegments(new THREE.EdgesGeometry(this.surface.geometry),new THREE.LineBasicMaterial({color:0x79efff,transparent:true,opacity:.55}));this.surface.add(this.outline);this.outline.position.z=.005;
  this.portal=this.makePortal();this.portal.visible=false;this.scene.add(this.portal);
  this.resize=()=>{this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();this.renderer.setSize(innerWidth,innerHeight)};addEventListener('resize',this.resize);
 }
 makePortal(){const g=new THREE.Group();const ring=new THREE.Mesh(new THREE.TorusGeometry(.7,.06,20,64),new THREE.MeshBasicMaterial({color:0x7aeaff,transparent:true,opacity:.9}));g.add(ring);const inner=new THREE.Mesh(new THREE.CircleGeometry(.65,64),new THREE.MeshBasicMaterial({color:0x25105f,transparent:true,opacity:.82}));g.add(inner);return g;}
 updateCamera(){const p=this.tracking.getPose();this.camera.rotation.order='YXZ';this.camera.rotation.y=p.yaw||0;this.camera.rotation.x=p.pitch||0;this.camera.rotation.z=(p.roll||0)*.65;this.camera.position.set(p.x||0,1.55+(p.y||0),p.z||0);return p;}
 placeSurface(clientX,clientY){
  this.updateCamera();const ndc=new THREE.Vector2(clientX/innerWidth*2-1,-(clientY/innerHeight)*2+1);const ray=new THREE.Raycaster();ray.setFromCamera(ndc,this.camera);
  const floorTap=clientY>innerHeight*.47;
  if(floorTap){const plane=new THREE.Plane(new THREE.Vector3(0,1,0),0);const hit=new THREE.Vector3();if(!ray.ray.intersectPlane(plane,hit))return false;this.surface.position.copy(hit);this.surface.position.y=.012;this.surface.rotation.set(-Math.PI/2,0,0);}
  else {const dir=new THREE.Vector3();this.camera.getWorldDirection(dir);const point=ray.ray.origin.clone().add(ray.ray.direction.clone().multiplyScalar(2.8));this.surface.position.copy(point);this.surface.rotation.set(0,this.camera.rotation.y,0);this.surface.lookAt(this.camera.position);this.surface.rotateY(Math.PI);}
  this.surface.visible=true;this.outline.visible=true;setTimeout(()=>{if(this.outline)this.outline.visible=false},1200);return floorTap?'floor':'wall';
 }
 setElement(name){this.uniforms.uMode.value=MODE[name]??0;}
 setQuality(q){const r=q==='ULTRA'?2:q==='HIGH'?1.65:q==='MEDIUM'?1.35:1;this.renderer.setPixelRatio(Math.min(devicePixelRatio,r));this.resize();}
 setGridVisible(v){this.outline.visible=!!v&&this.surface.visible;}
 scaleSurface(mult){this.surface.scale.multiplyScalar(mult);this.surface.scale.clampScalar(.45,4);}
 togglePortal(force){this.portal.visible=typeof force==='boolean'?force:!this.portal.visible;if(this.portal.visible){this.portal.position.copy(this.surface.visible?this.surface.position:new THREE.Vector3(0,.2,-3));this.portal.position.y+=1;}return this.portal.visible;}
 recenter(){this.tracking.recenter();}
 start(){const loop=()=>{this.frame=requestAnimationFrame(loop);this.uniforms.uTime.value=this.clock.getElapsedTime();this.updateCamera();this.renderer.render(this.scene,this.camera)};loop();}
 destroy(){cancelAnimationFrame(this.frame);removeEventListener('resize',this.resize);this.renderer.dispose();this.container.innerHTML='';}
}
