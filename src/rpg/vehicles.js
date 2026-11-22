import * as THREE from 'three';
import {isBlocked} from './world.js';
export function makeVehicleSystem(world){
 let active=null;
 function nearest(p){let best=null,dist=4.6;for(const c of world.cars){if(c.occupied)continue;const d=Math.hypot(c.x-p.position.x,c.z-p.position.z);if(d<dist){dist=d;best=c;}}return best;}
 function enterExit(player){
  if(active){const a=active;const side=new THREE.Vector3(Math.cos(a.rotation),0,-Math.sin(a.rotation)).multiplyScalar(3.4);const x=a.x+side.x,z=a.z+side.z;if(!isBlocked(world,x,z)){player.setPosition(x,z);player.root.visible=true;a.occupied=false;active=null;return 'Araçtan indin.';}return 'İnmek için yer yok.';}
  const c=nearest(player);if(!c)return 'Yakında binebileceğin araç yok. Araca yaklaş.';active=c;c.occupied=true;c.speed=0;player.root.visible=false;return 'Araca bindin. WASD ile sür, F ile in.';
 }
 function update(keys,dt){
  if(!active)return;
  const c=active,accel=keys.has('w')||keys.has('arrowup'),reverse=keys.has('s')||keys.has('arrowdown'),left=keys.has('a')||keys.has('arrowleft'),right=keys.has('d')||keys.has('arrowright');
  if(accel)c.speed=Math.min(25,c.speed+18*dt);else if(reverse)c.speed=Math.max(-9,c.speed-22*dt);else c.speed*=Math.pow(.965,dt*60);
  if(Math.abs(c.speed)>.4){const steer=(right?1:0)-(left?1:0);c.rotation+=steer*dt*(1.5+Math.min(1,Math.abs(c.speed)/15))*(c.speed>=0?1:-1);}
  const nx=c.x+Math.sin(c.rotation)*c.speed*dt,nz=c.z+Math.cos(c.rotation)*c.speed*dt;
  let blocked=Math.abs(nx)>world.bounds-2||Math.abs(nz)>world.bounds-2;
  if(!blocked)for(const o of world.colliders){if(Math.hypot(nx-o.x,nz-o.z)<o.r+1.7){blocked=true;break;}}
  if(!blocked){c.x=nx;c.z=nz;c.group.position.set(c.x,0,c.z);c.group.rotation.y=c.rotation;}else c.speed*=-.18;
  for(const other of world.cars){if(other===c)continue;if(Math.hypot(c.x-other.x,c.z-other.z)<3.1){c.speed*=-.25;break;}}
 }
 function target(){return active?new THREE.Vector3(active.x,1,active.z):null;}
 return{enterExit,update,get active(){return active;},target};
}
