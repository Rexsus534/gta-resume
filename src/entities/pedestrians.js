import * as THREE from 'three';
import { CITY, BLOCK_HALF, blockCenter } from '../config.js';

const shirtPalette=[0xc85d45,0x3f83a6,0xd3a44c,0x657c54,0x8c6aa5,0xe0d4c1,0x3f4958,0xd18a54];
const pantsPalette=[0x303744,0x51463c,0x263f42,0x625b54];
const shirts=shirtPalette.map(c=>new THREE.MeshStandardMaterial({color:c,roughness:.9}));
const pants=pantsPalette.map(c=>new THREE.MeshStandardMaterial({color:c,roughness:.95}));
const skin=new THREE.MeshStandardMaterial({color:0xb98261,roughness:.95});
const hair=new THREE.MeshStandardMaterial({color:0x292321,roughness:1});
const torsoGeo=new THREE.CapsuleGeometry(.22,.42,3,7);
const headGeo=new THREE.SphereGeometry(.17,9,7);
const limbGeo=new THREE.CapsuleGeometry(.075,.34,3,6);
const shoeGeo=new THREE.BoxGeometry(.16,.1,.28);

function makePerson(scene,x,z,index){
 const root=new THREE.Group();root.position.set(x,.17,z);scene.add(root);
 const top=new THREE.Mesh(torsoGeo,shirts[index%shirts.length]);top.position.y=.88;top.castShadow=true;root.add(top);
 const head=new THREE.Mesh(headGeo,skin);head.position.y=1.42;head.castShadow=true;root.add(head);
 const hairCap=new THREE.Mesh(new THREE.SphereGeometry(.175,8,6,0,Math.PI*2,0,Math.PI*.52),hair);hairCap.position.y=1.48;root.add(hairCap);
 const arms=[],legs=[];
 for(const side of [-1,1]){
  const arm=new THREE.Group();arm.position.set(side*.28,1.02,0);const am=new THREE.Mesh(limbGeo,shirts[index%shirts.length]);am.position.y=-.23;am.castShadow=true;arm.add(am);root.add(arm);arms.push(arm);
  const leg=new THREE.Group();leg.position.set(side*.12,.48,0);const lm=new THREE.Mesh(limbGeo,pants[index%pants.length]);lm.position.y=-.2;lm.castShadow=true;leg.add(lm);const shoe=new THREE.Mesh(shoeGeo,hair);shoe.position.set(0,-.42,.06);leg.add(shoe);root.add(leg);legs.push(leg);
 }
 return{root,arms,legs};
}
export function createPedestrians(scene,count=58,seed=20261123){
 let state=seed>>>0;const rnd=()=>{state=(state*1664525+1013904223)>>>0;return state/4294967296;};
 const people=[];
 for(let i=0;i<count;i++){
  const bx=Math.floor(rnd()*CITY.blocks),bz=Math.floor(rnd()*CITY.blocks),c=blockCenter(bx,bz);
  const edge=Math.floor(rnd()*4),along=(rnd()*2-1)*22,side=rnd()<.5?-1:1,offset=BLOCK_HALF-2.2;
  let x=c.x,z=c.z,axis='x';
  if(edge===0){x+=side*offset;z+=along;axis='z';}
  if(edge===1){x+=along;z+=side*offset;axis='x';}
  if(edge===2){x-=side*offset;z+=along;axis='z';}
  if(edge===3){x+=along;z-=side*offset;axis='x';}
  const person=makePerson(scene,x,z,i);
  const dir=rnd()<.5?-1:1,speed=.55+rnd()*.65;
  people.push({...person,x,z,axis,dir,speed,phase:rnd()*Math.PI*2,walk:0,range:18+rnd()*9});
 }
 function update(dt){
  for(const p of people){
   p.walk+=dt*p.speed*4.2;p.phase+=dt*p.speed;
   const travel=Math.sin(p.phase*.18)*p.range;
   if(p.axis==='x')p.root.position.x=p.x+travel;else p.root.position.z=p.z+travel;
   p.root.rotation.y=p.axis==='x'?(Math.cos(p.phase*.18)*p.dir>0?Math.PI/2:-Math.PI/2):(Math.cos(p.phase*.18)*p.dir>0?0:Math.PI);
   const swing=Math.sin(p.walk)*.48;
   p.legs[0].rotation.x=swing;p.legs[1].rotation.x=-swing;
   p.arms[0].rotation.x=-swing*.72;p.arms[1].rotation.x=swing*.72;
  }
 }
 return{people,update};
}
