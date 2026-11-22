import '../style.css';
import * as THREE from 'three';
import {makeWorld,updateWorld} from './world.js';
import {createPlayer} from './player.js';
import {makeVehicleSystem} from './vehicles.js';
import {createUI} from './ui.js';
import {loadGame,saveGame} from './save.js';
const canvas=document.querySelector('#game'),loading=document.querySelector('#loading-screen');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
const scene=new THREE.Scene();scene.background=new THREE.Color('#91b7c2');scene.fog=new THREE.Fog('#91b7c2',115,230);
const camera=new THREE.PerspectiveCamera(62,innerWidth/innerHeight,.1,300);
scene.add(new THREE.HemisphereLight('#dceeff','#66715c',2));
const sun=new THREE.DirectionalLight('#fff0d2',3);sun.position.set(-55,85,30);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-100;sun.shadow.camera.right=100;sun.shadow.camera.top=100;sun.shadow.camera.bottom=-100;scene.add(sun);
const fill=new THREE.DirectionalLight('#8fc6e8',.8);fill.position.set(60,30,-60);scene.add(fill);
const world=makeWorld(scene);
const player=await createPlayer(scene);
const saved=loadGame();player.setPosition(saved?.x??world.spawn.x,saved?.z??world.spawn.z);
const vehicles=makeVehicleSystem(world),ui=createUI(),keys=new Set();
let started=false,money=saved?.money??250,mission=0,toast='';
function notify(t){ui.toast(t);}
function save(){const pos=vehicles.active??player.position;saveGame({x:pos.x,z:pos.z,money});}
function interact(){
 const p=player.position;
 if(mission===0&&Math.hypot(p.x-world.missionNpc.x,p.z-world.missionNpc.z)<4.2){mission=1;notify('Yeni görev: Sahil yolundaki işarete git!');return;}
 if(mission===1){const pos=vehicles.active??player.position;if(Math.hypot(pos.x-world.marker.position.x,pos.z-world.marker.position.z)<5){mission=2;money+=500;world.marker.visible=false;notify('Teslimat tamamlandı! +$500');return;}}
 notify('Burada etkileşime geçilecek bir şey yok.');
}
function keyAction(k){if(k==='f'){notify(vehicles.enterExit(player));}if(k==='e')interact();if(k==='k'){save();notify('Oyun kaydedildi.');}}
ui.bind({onStart:()=>{started=true;document.querySelector('#start-screen').classList.add('hidden');notify('Vice City’ye hoş geldin! Yakındaki araca F ile binebilirsin.');},onKey:(k,on)=>{if(on){if(!keys.has(k))keyAction(k);keys.add(k);}else keys.delete(k);}});
window.addEventListener('keydown',e=>{const k=e.key.toLowerCase();if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k))e.preventDefault();if(!keys.has(k))keyAction(k);keys.add(k);});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>keys.clear());
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
const clock=new THREE.Clock(),look=new THREE.Vector3(),desired=new THREE.Vector3();
function frame(){requestAnimationFrame(frame);const dt=Math.min(clock.getDelta(),.04);
 if(started){if(vehicles.active){vehicles.update(keys,dt);}else player.update(dt,keys,world);
  updateWorld(world,dt);
  const target=vehicles.target()??new THREE.Vector3(player.position.x,1.2,player.position.z);
  const driving=!!vehicles.active;
  if(driving){const a=vehicles.active;const dir=new THREE.Vector3(Math.sin(a.rotation),0,Math.cos(a.rotation));desired.set(a.x-dir.x*10,6.2,a.z-dir.z*10);}
  else desired.set(target.x+8,8.5,target.z+11);
  camera.position.lerp(desired,1-Math.exp(-dt*4));look.set(target.x,1,target.z);camera.lookAt(look);
  const pos=vehicles.active??player.position;
  let title='Şehri keşfet',desc='Sahil şehrinde özgürce dolaş.';
  if(mission===0){title='Bir iş bul';desc='Haritadaki sarı işaretli kişiye yaklaş ve E’ye bas.';}
  if(mission===1){title='Paket teslimatı';desc='Sahil yolundaki altın işarete git. Ödül: $500';}
  if(mission===2){title='Görev tamamlandı';desc='Şehri keşfetmeye devam et!';}
  const nearNpc=!vehicles.active&&Math.hypot(pos.x-world.missionNpc.x,pos.z-world.missionNpc.z)<4.5;
  ui.prompt(vehicles.active?'F — Araçtan in':nearNpc?'E — İş al':'');
  ui.update({money,missionTitle:title,missionDesc:desc,vehicle:vehicles.active,speed:vehicles.active?.speed??0});
  ui.drawMap(player,world,vehicles.active);
 }else updateWorld(world,dt);
 renderer.render(scene,camera);
}
loading.classList.add('done');setTimeout(()=>loading.remove(),650);frame();window.addEventListener('beforeunload',save);
