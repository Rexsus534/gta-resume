export function createPoliceSiren(){
 let ctx=null,osc=null,lfo=null,gain=null,active=false;
 function start(){
  if(active)return;
  const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;
  try{
   ctx??=new Audio();if(ctx.state==='suspended')ctx.resume();
   osc=ctx.createOscillator();lfo=ctx.createOscillator();const depth=ctx.createGain();gain=ctx.createGain();
   osc.type='sawtooth';lfo.type='sine';osc.frequency.value=720;lfo.frequency.value=1.25;depth.gain.value=260;gain.gain.value=.025;
   lfo.connect(depth);depth.connect(osc.frequency);osc.connect(gain);gain.connect(ctx.destination);osc.start();lfo.start();active=true;
  }catch(e){console.warn('Siren audio unavailable',e);}
 }
 function stop(){if(!active)return;active=false;try{gain.gain.setTargetAtTime(0,ctx.currentTime,.08);osc.stop(ctx.currentTime+.3);lfo.stop(ctx.currentTime+.3);}catch{}osc=null;lfo=null;}
 return{start,stop,get active(){return active;}};
}
