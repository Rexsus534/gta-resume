import '../style.css';
import * as THREE from 'three';
import { makeWorld, updateWorld } from './world.js';
import { createPlayer } from './player.js';
import { makeEnemies, updateEnemies, damageEnemies } from './enemies.js';
import { makeQuest, interactQuest, updateQuest } from './quests.js';
import { makeItems, updateItems } from './items.js';
import { createUI } from './ui.js';
import { makeEffects, updateEffects, burst, slash } from './effects.js';
import { loadGame, saveGame } from './save.js';

const canvas=document.querySelector('#game');
const loading=document.querySelector('#loading-screen');
const loadingText=document.querySelector('#loading-text');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.65));
renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.12;

const scene=new THREE.Scene();
scene.background=new THREE.Color('#9bb5a2');
scene.fog=new THREE.FogExp2('#9bb5a2',0.012);
const camera=new THREE.PerspectiveCamera(48,innerWidth/innerHeight,.1,180);
camera.position.set(0,22,16);
const hemi=new THREE.HemisphereLight('#dcebd8','#3b503c',2.1);scene.add(hemi);
const sun=new THREE.DirectionalLight('#ffe5b5',3.2);
sun.position.set(-24,38,18);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
sun.shadow.camera.left=-34;sun.shadow.camera.right=34;sun.shadow.camera.top=34;sun.shadow.camera.bottom=-34;sun.shadow.bias=-.00025;scene.add(sun);
const fill=new THREE.DirectionalLight('#9dc9e4',.75);fill.position.set(20,12,-20);scene.add(fill);

const world=makeWorld(scene);
const player=await createPlayer(scene);
const saved=loadGame();
if(saved)player.setPosition(saved.x??world.spawn.x,saved.z??world.spawn.z);
player.setPosition(saved?.x??world.spawn.x,saved?.z??world.spawn.z);
const enemies=makeEnemies(scene);
const items=makeItems(scene);
const quest=makeQuest();
if(saved){quest.fragments=saved.fragments??0;player.hp=saved.hp??player.hp;player.gold=saved.gold??0;player.potions=saved.potions??0;}
const effects=makeEffects(scene);
const ui=createUI();
const keys=new Set();
let started=false,inventoryOpen=false,attackCooldown=0,toastTimer=0,lastSave=0;
let toast='';

function notify(message){toast=message;toastTimer=2.5;ui.toast(message);}
function save(){saveGame({x:player.position.x,z:player.position.z,hp:player.hp,gold:player.gold,potions:player.potions,fragments:quest.fragments});}
function attack(){
 if(attackCooldown>0||inventoryOpen)return;
 attackCooldown=.42;
 slash(effects,player.position,player.facing);
 const hit=damageEnemies(enemies,player.position,player.facing);
 if(hit){player.gold+=2;notify('Yaratık vuruldu! +2 altın');}
 else notify('Işık darbesi!');
}
function interact(){const result=interactQuest(quest,player,world);if(result)notify(result);}
function potion(){if(player.potions>0&&player.hp<player.maxHp){player.potions--;player.hp=Math.min(player.maxHp,player.hp+3);notify('Can iksiri kullanıldı.');}else notify('Kullanılabilir iksir yok.');}
function toggleInventory(){inventoryOpen=!inventoryOpen;ui.setInventory(inventoryOpen,player,quest);}
ui.bind({
 onStart:()=>{started=true;document.querySelector('#start-screen').classList.add('hidden');notify('Eldoria ormanına hoş geldin!');},
 onMove:(dir,on)=>on?keys.add(dir):keys.delete(dir),
 onAttack:attack,onInteract:interact,onInventory:toggleInventory,onPotion:potion,
 onClose:()=>{inventoryOpen=false;ui.setInventory(false,player,quest);}
});
window.addEventListener('keydown',e=>{
 const k=e.key.toLowerCase();
 if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k))e.preventDefault();
 keys.add(k);
 if(e.repeat)return;
 if(k===' '||k==='j')attack();
 if(k==='e')interact();
 if(k==='i'){toggleInventory();}
 if(k==='p')potion();
 if(k==='escape'&&inventoryOpen)toggleInventory();
 if(k==='k'){save();notify('Oyun kaydedildi.');}
});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
window.addEventListener('blur',()=>keys.clear());
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});

const clock=new THREE.Clock();
const camTarget=new THREE.Vector3();
const camPosition=new THREE.Vector3();
function frame(){
 requestAnimationFrame(frame);
 const dt=Math.min(clock.getDelta(),.04);
 if(started&&!inventoryOpen){
  player.update(dt,keys,world);
  updateEnemies(enemies,player,dt,effects,notify);
  updateItems(items,player,quest,notify);
  updateQuest(quest,player,world,notify);
  updateEffects(effects,dt);
  attackCooldown=Math.max(0,attackCooldown-dt);
  toastTimer=Math.max(0,toastTimer-dt);
  if(player.hp<=0){player.hp=player.maxHp;player.setPosition(world.spawn.x,world.spawn.z);player.gold=Math.max(0,player.gold-5);notify('Köy şifacısı seni iyileştirdi. -5 altın');}
  if(clock.elapsedTime-lastSave>18){save();lastSave=clock.elapsedTime;}
  const nearNpc=Math.hypot(player.position.x-world.npc.x,player.position.z-world.npc.z)<3.1;
  const nearAltar=Math.hypot(player.position.x-world.altar.x,player.position.z-world.altar.z)<3.4;
  ui.setPrompt(nearNpc?'E — Köy büyüğüyle konuş':nearAltar?'E — Kadim sunağı incele':'');
  ui.update(player,quest);
  ui.drawMap(player,world,quest);
 }else if(started){ui.update(player,quest);}
 updateWorld(world,dt);
 const px=player.position.x,pz=player.position.z;
 camTarget.set(px,0,pz);
 camPosition.set(px+0.3,22,pz+15.5);
 camera.position.lerp(camPosition,1-Math.exp(-dt*4.2));
 camera.lookAt(camTarget);
 renderer.render(scene,camera);
}
loading.classList.add('done');
setTimeout(()=>loading.remove(),700);
frame();
window.addEventListener('beforeunload',save);
