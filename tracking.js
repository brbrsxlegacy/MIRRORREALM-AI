export class TrackingAdapter {
  constructor(){
    this.enabled=true;
    this.ready=false;
    this.alpha=0;
    this.beta=70;
    this.gamma=0;
    this.heading0=null;
    this.pitch0=null;
    this.roll0=null;
    this.listeners=[];
  }

  async start(){
    if(!this.enabled) return false;
    try{
      if(typeof DeviceOrientationEvent!=='undefined' && typeof DeviceOrientationEvent.requestPermission==='function'){
        const result=await DeviceOrientationEvent.requestPermission();
        if(result!=='granted') return false;
      }
      const handler=(e)=>{
        if(typeof e.alpha==='number') this.alpha=e.alpha;
        if(typeof e.beta==='number') this.beta=e.beta;
        if(typeof e.gamma==='number') this.gamma=e.gamma;
        if(this.heading0===null){
          this.heading0=this.alpha;
          this.pitch0=this.beta;
          this.roll0=this.gamma;
        }
        this.ready=true;
      };
      window.addEventListener('deviceorientation',handler,{passive:true});
      this.listeners.push(()=>window.removeEventListener('deviceorientation',handler));
      return true;
    }catch(err){
      console.warn('TrackingAdapter motion permission unavailable',err);
      return false;
    }
  }

  recenter(){
    this.heading0=this.alpha;
    this.pitch0=this.beta;
    this.roll0=this.gamma;
  }

  setEnabled(value){ this.enabled=!!value; }

  getPose(){
    if(!this.ready || !this.enabled){
      return {yaw:0,pitch:-0.12,roll:0,quality:'fallback'};
    }
    const deg=Math.PI/180;
    const yaw=(this.alpha-(this.heading0??this.alpha))*deg;
    const pitch=(this.beta-(this.pitch0??this.beta))*deg;
    const roll=(this.gamma-(this.roll0??this.gamma))*deg;
    return {
      yaw:Math.max(-1.2,Math.min(1.2,-yaw)),
      pitch:Math.max(-0.7,Math.min(0.7,pitch-0.12)),
      roll:Math.max(-0.5,Math.min(0.5,-roll)),
      quality:'orientation'
    };
  }

  destroy(){ this.listeners.forEach(fn=>fn()); this.listeners=[]; }
}

// Later: replace this adapter with an 8th Wall/WebAR adapter implementing
// start(), recenter(), setEnabled() and getPose() with true 6DoF pose data.