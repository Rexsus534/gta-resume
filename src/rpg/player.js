import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {isBlocked} from './world.js';
const BASE=import.meta.env.BASE_URL;
export async function createPlayer(scene){
 const loader=new GLTFLoader();
 const [character,animation]=await Promise.all([loader.loadAsync(BASE+'models/character.glb'),loader.loadAsync(BASE+'models/animations.glb')]);
 const root=new THREE.Group();root.name='EldoriaHero';const model=character.scene;root.add(model);scene.add(root);root.updateMatrixWorld(true);
 model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;for(const m of (Array.isArray(o.material)?o.material:[o.material])){if(m.emissive)m.emissive.setScalar(0);m.emissiveIntensity=0;m.emissiveMap=null;if(m.map)m.map.colorSpace=THREE.SRGBColorSpace;m.roughness=.88;m.metalness=0;m.needsUpdate=true;}}});
 const bounds=new THREE.Box3().setFromObject(model,true);let h=bounds.max.y-bounds.min.y;if(!Number.isFinite(h)||h<.001||h>100)h=1.8;model.position.y=-bounds.min.y;root.scale.setScalar(1.75/h);model.rotation.y=Math.PI;
 const mixer=new THREE.AnimationMixer(model);const find=n=>animation.animations.find(c=>c.name.toLowerCase()===n.toLowerCase())||character.animations.find(c=>c.name.toLowerCase()===n.toLowerCase());
 const clips={idle:character.animations[0]||null,walk:find('Walking'),run:find('Running')};const actions={};for(const [name,clip] of Object.entries(clips)){if(!clip)continue;const a=mixer.clipAction(clip);a.setLoop(THREE.LoopRepeat,Infinity);a.play();a.setEffectiveWeight(name==='idle'?1:0);actions[name]=a;}
 const p={root,model,position:new THREE.Vector3(0,0,21),facing:new THREE.Vector3(0,0,-1),hp:8,maxHp:8,gold:0,potions:1,speed:0,walkTime:0};
 root.position.copy(p.position);
 p.setPosition=(x,z)=>{p.position.set(x,0,z);root.position.copy(p.position);};
 p.update=(dt,keys,world)=>{let x=0,z=0;if(keys.has('w')||keys.has('arrowup')||keys.has('up'))z-=1;if(keys.has('s')||keys.has('arrowdown')||keys.has('down'))z+=1;if(keys.has('a')||keys.has('arrowleft')||keys.has('left'))x-=1;if(keys.has('d')||keys.has('arrowright')||keys.has('right'))x+=1;const len=Math.hypot(x,z)||1;x/=len;z/=len;const moving=!!(x||z);const sprint=keys.has('shift');const speed=sprint?7.1:4.3;p.speed=moving?speed:0;if(moving){p.facing.set(x,0,z);const nx=p.position.x+x*speed*dt,nz=p.position.z+z*speed*dt;if(!isBlocked(world,nx,p.position.z))p.position.x=nx;if(!isBlocked(world,p.position.x,nz))p.position.z=nz;root.rotation.y=Math.atan2(x,z)+Math.PI;p.walkTime+=dt*speed;}root.position.set(p.position.x,Math.sin(p.walkTime*2)*.025,p.position.z);const blend=(name,w)=>{if(actions[name])actions[name].setEffectiveWeight(THREE.MathUtils.damp(actions[name].getEffectiveWeight(),w,10,dt));};blend('idle',moving?0:1);blend('walk',moving&&!sprint?1:0);blend('run',moving&&sprint?1:0);if(actions.walk)actions.walk.timeScale=sprint?1.3:1;if(actions.run)actions.run.timeScale=1.15;mixer.update(dt);};
 return p;
}
