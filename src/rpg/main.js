import { makeWorld, drawWorld, isSolid } from './world.js';
import { makePlayer, updatePlayer, drawPlayer } from './player.js';
import { makeEnemies, updateEnemies, drawEnemies } from './enemies.js';
import { makeQuest, updateQuest, drawQuestMarker } from './quests.js';
import { makeItems, updateItems, drawItems } from './items.js';
import { makeUI } from './ui.js';
import { loadGame, saveGame } from './save.js';
import { makeEffects, updateEffects, drawEffects } from './effects.js';

const canvas=document.querySelector('#game'),ctx=canvas.getContext('2d');
ctx.imageSmoothingEnabled=false;
const W=canvas.width,H=canvas.height,TILE=32;
const world=makeWorld(),player=makePlayer(),enemies=makeEnemies(),items=makeItems(),quest=makeQuest(),effects=makeEffects();
const ui=makeUI();
const saved=loadGame();
if(saved){player.x=saved.x??player.x;player.y=saved.y??player.y;player.hp=saved.hp??player.hp;player.gold=saved.gold??0;player.potions=saved.potions??0;quest.fragments=saved.fragments??0;}
const keys=new Set(),camera={x:0,y:0};let last=0,started=false,inventory=false,dialogue='',notice='';let noticeTime=0;
function say(t){notice=t;noticeTime=2.3;}
function nearNPC(){return Math.hypot(player.x-world.npc.x,player.y-world.npc.y)<54;}
function interact(){if(nearNPC()){dialogue=quest.fragments<3?'Köyün yaşlısı: Ormanın kuzeyinde üç mühür parçası saklı. Onları bulup sunağa getir!':'Köyün yaşlısı: Krallığın mührünü yeniden birleştirdin. Eldoria seni unutmayacak!';ui.showDialogue(dialogue);return;}const altar=world.altar;if(Math.hypot(player.x-altar.x,player.y-altar.y)<58){if(quest.fragments>=3){quest.complete=true;say('Kadim mühür etkinleştirildi!');}else say('Sunak: '+quest.fragments+'/3 mühür parçası bulundu.');}}
function attack(){if(player.attackCooldown>0)return;player.attackCooldown=.38;player.swing=.18;effects.slash(player.x+player.facingX*20,player.y+player.facingY*20,player.facingX,player.facingY);let hit=false;for(const e of enemies){if(!e.alive)continue;const dx=e.x-player.x,dy=e.y-player.y,d=Math.hypot(dx,dy);const dot=(dx*player.facingX+dy*player.facingY)/(d||1);if(d<57&&dot>.05){e.hp-=1;e.flash=.14;hit=true;if(e.hp<=0){e.alive=false;player.gold+=3;effects.burst(e.x,e.y,'#f5d36f');say('Yaratık yenildi! +3 altın');}}}if(!hit)say('Kılıcın havayı biçti.');}
function toggleInventory(){inventory=!inventory;ui.setInventory(inventory,player);}
window.addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' ','Tab'].includes(e.key))e.preventDefault();keys.add(e.key.toLowerCase());if(e.repeat)return;if(e.key===' '||e.key.toLowerCase()==='j')attack();if(e.key.toLowerCase()==='e')interact();if(e.key.toLowerCase()==='i')toggleInventory();if(e.key.toLowerCase()==='p'&&player.potions>0&&player.hp<player.maxHp){player.potions--;player.hp=Math.min(player.maxHp,player.hp+3);say('Can iksiri kullanıldı.');}if(e.key.toLowerCase()==='k')saveNow();});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
function saveNow(){saveGame({x:player.x,y:player.y,hp:player.hp,gold:player.gold,potions:player.potions,fragments:quest.fragments});say('Oyun kaydedildi!');}
ui.bind({onStart:()=>{started=true;document.querySelector('#overlay').classList.add('hidden');say('Orman köyüne hoş geldin!');},onAttack:attack,onInteract:interact,onMove:(d,on)=>{on?keys.add(d):keys.delete(d);},onInventory:toggleInventory,onSave:saveNow,onPotion:()=>{if(player.potions>0&&player.hp<player.maxHp){player.potions--;player.hp=Math.min(player.maxHp,player.hp+3);say('Can iksiri kullanıldı.');}}});
function update(dt){if(!started)return;if(inventory||ui.dialogueOpen)return;updatePlayer(player,keys,dt,(x,y)=>isSolid(world,x,y));updateEnemies(enemies,player,dt,effects);updateItems(items,player,quest,say);updateQuest(quest,player,world,say);updateEffects(effects,dt);if(player.hp<=0){player.hp=player.maxHp;player.x=world.spawn.x;player.y=world.spawn.y;player.gold=Math.max(0,player.gold-5);say('Bayıldın! Köye geri döndün. -5 altın');}noticeTime=Math.max(0,noticeTime-dt);if(Math.random()<.002)saveNow();}
function render(){ctx.clearRect(0,0,W,H);camera.x=Math.max(0,Math.min(world.width*TILE-W,player.x-W/2));camera.y=Math.max(0,Math.min(world.height*TILE-H,player.y-H/2));ctx.save();ctx.translate(-Math.floor(camera.x),-Math.floor(camera.y));drawWorld(ctx,world);drawQuestMarker(ctx,quest,world);drawItems(ctx,items);drawEnemies(ctx,enemies);drawPlayer(ctx,player);drawEffects(ctx,effects);ctx.restore();ui.drawHUD(ctx,player,quest,noticeTime>0?notice:'');if(inventory)ui.drawInventory(ctx,player);if(ui.dialogueOpen)ui.drawDialogue(ctx);}
function frame(t){const dt=Math.min(.033,(t-last)/1000||0);last=t;update(dt);render();requestAnimationFrame(frame);}
requestAnimationFrame(frame);
window.addEventListener('beforeunload',saveNow);
