export class TrackingAdapter {
  constructor(){
    this.enabled=true;this.ready=false;this.mode='fallback';
    this.alpha=0;this.beta=70;this.gamma=0;this.heading0=null;this.pitch0=null;this.roll0=null;
    this.xrPose=null;this.xrOrigin=null;this.xrYaw0=0;this.listeners=[];this.xrStarted=false;
  }

  async waitForXR8(timeout=8000){
    if(window.XR8) return window.XR8;
    return await new Promise(resolve=>{
      let done=false;const finish=v=>{if(done)return;done=true;clearTimeout(t);window.removeEventListener('xrloaded',on);resolve(v)};
      const on=()=>finish(window.XR8||null);window.addEventListener('xrloaded',on,{once:true});
      const t=setTimeout(()=>finish(window.XR8||null),timeout);
    });
  }

  async start(xrCanvas){
    if(!this.enabled) return 'fallback';
    try{
      const XR8=await this.waitForXR8();
      if(XR8 && xrCanvas){
        XR8.XrController.configure({disableWorldTracking:false,enableLighting:true,scale:'absolute'});
        const poseModule={
          name:'mirrorrealm-pose',
          onUpdate:({processCpuResult})=>{
            const reality=processCpuResult?.reality;if(!reality)return;
            this.xrPose={position:{...reality.position},rotation:{...reality.rotation},trackingStatus:reality.trackingStatus||'LIMITED'};
            if(!this.xrOrigin){this.xrOrigin={...reality.position};this.xrYaw0=this.quatToEuler(reality.rotation).yaw;}
            this.ready=true;this.mode='xr8';
          }
        };
        XR8.addCameraPipelineModules([XR8.GlTextureRenderer.pipelineModule(),XR8.XrController.pipelineModule(),poseModule]);
        XR8.run({canvas:xrCanvas,allowedDevices:XR8.XrConfig.device().MOBILE_AND_HEADSETS,cameraConfig:{direction:XR8.XrConfig.camera().BACK}});
        this.xrStarted=true;this.mode='xr8';
        return 'xr8';
      }
    }catch(err){console.warn('XR8 start failed, using orientation fallback',err);}
    await this.startOrientation();return this.mode;
  }

  async startOrientation(){
    try{
      if(typeof DeviceOrientationEvent!=='undefined' && typeof DeviceOrientationEvent.requestPermission==='function'){
        const r=await DeviceOrientationEvent.requestPermission();if(r!=='granted'){this.mode='fallback';return false;}
      }
      const handler=e=>{
        if(typeof e.alpha==='number')this.alpha=e.alpha;if(typeof e.beta==='number')this.beta=e.beta;if(typeof e.gamma==='number')this.gamma=e.gamma;
        if(this.heading0===null){this.heading0=this.alpha;this.pitch0=this.beta;this.roll0=this.gamma;}
        this.ready=true;this.mode='orientation';
      };
      window.addEventListener('deviceorientation',handler,{passive:true});this.listeners.push(()=>window.removeEventListener('deviceorientation',handler));return true;
    }catch(err){console.warn(err);this.mode='fallback';return false;}
  }

  quatToEuler(q){
    const {x,y,z,w}=q;const sinr=2*(w*x+y*z),cosr=1-2*(x*x+y*y);const roll=Math.atan2(sinr,cosr);
    const sinp=2*(w*y-z*x);const pitch=Math.abs(sinp)>=1?Math.sign(sinp)*Math.PI/2:Math.asin(sinp);
    const siny=2*(w*z+x*y),cosy=1-2*(y*y+z*z);const yaw=Math.atan2(siny,cosy);
    return {yaw,pitch,roll};
  }

  recenter(){
    if(this.mode==='xr8'&&this.xrPose){this.xrOrigin={...this.xrPose.position};this.xrYaw0=this.quatToEuler(this.xrPose.rotation).yaw;return;}
    this.heading0=this.alpha;this.pitch0=this.beta;this.roll0=this.gamma;
  }
  setEnabled(v){this.enabled=!!v;}
  getPose(){
    if(this.mode==='xr8'&&this.xrPose&&this.enabled){
      const e=this.quatToEuler(this.xrPose.rotation),o=this.xrOrigin||this.xrPose.position;
      return {yaw:e.yaw-this.xrYaw0,pitch:e.pitch,roll:e.roll,x:this.xrPose.position.x-o.x,y:this.xrPose.position.y-o.y,z:this.xrPose.position.z-o.z,quality:this.xrPose.trackingStatus==='NORMAL'?'xr8':'xr8-limited'};
    }
    if(!this.ready||!this.enabled)return {yaw:0,pitch:-.12,roll:0,x:0,y:0,z:0,quality:'fallback'};
    const d=Math.PI/180;return {yaw:Math.max(-1.2,Math.min(1.2,-(this.alpha-(this.heading0??this.alpha))*d)),pitch:Math.max(-.7,Math.min(.7,(this.beta-(this.pitch0??this.beta))*d-.12)),roll:Math.max(-.5,Math.min(.5,-(this.gamma-(this.roll0??this.gamma))*d)),x:0,y:0,z:0,quality:'orientation'};
  }
  destroy(){this.listeners.forEach(fn=>fn());this.listeners=[];try{if(this.xrStarted&&window.XR8)window.XR8.stop();}catch{}this.xrStarted=false;}
}
