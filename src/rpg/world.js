import * as THREE from 'three';
const material=(color,roughness=.86,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
function mesh(parent,geo,mat,x,y,z,cast=true){const o=new THREE.Mesh(geo,mat);o.position.set(x,y,z);o.castShadow=cast;o.receiveShadow=true;parent.add(o);return o;}
function building(parent,x,z,w,d,h,seed,colliders){
 const g=new THREE.Group();g.position.set(x,0,z);parent.add(g);
 const palette=['#c6a58a','#b7b0a0','#d0c0a4','#8d9b9d','#d2b28c','#9babb0','#d4c5ad'];
 const wall=material(palette[seed%palette.length]),trim=material('#e5d5bc'),glass=new THREE.MeshStandardMaterial({color:'#315d70',roughness:.2,metalness:.35,emissive:'#173441',emissiveIntensity:.18});
 mesh(g,new THREE.BoxGeometry(w,h,d),wall,0,h/2,0);
 mesh(g,new THREE.BoxGeometry(w+0.45,.35,d+0.45),trim,0,h+.12,0);
 mesh(g,new THREE.BoxGeometry(w+.25,.3,d+.25),material('#505c60'),0,.15,0);
 const floors=Math.max(2,Math.floor(h/2.5)),cols=Math.max(2,Math.floor(w/2.5));
 for(let floor=0;floor<floors;floor++)for(let col=0;col<cols;col++){
  const yy=1.1+floor*2.25,xx=-w/2+1.1+col*(w-2.2)/Math.max(1,cols-1);
  if(yy>h-.5)continue;
  mesh(g,new THREE.BoxGeometry(.85,1.05,.08),glass,xx,yy,d/2+.045,false);
  mesh(g,new THREE.BoxGeometry(.85,1.05,.08),glass,xx,yy,-d/2-.045,false);
 }
 for(let side of [-1,1])for(let floor=0;floor<floors;floor++)for(let col=0;col<Math.max(2,Math.floor(d/3));col++){
  const zz=-d/2+1.2+col*(d-2.4)/Math.max(1,Math.floor(d/3)-1),yy=1.1+floor*2.25;
  if(yy<h-.5)mesh(g,new THREE.BoxGeometry(.08,1.05,.85),glass,side*(w/2+.045),yy,zz,false);
 }
 if(seed%3===0){const roof=mesh(g,new THREE.BoxGeometry(w*.45,.45,d*.35),material('#66777a'),0,h+.4,0);roof.castShadow=true;}
 colliders.push({x,z,r:Math.max(w,d)*.48+1});
 return g;
}
function palm(parent,x,z,s=1){
 const g=new THREE.Group();g.position.set(x,0,z);g.scale.setScalar(s);parent.add(g);
 mesh(g,new THREE.CylinderGeometry(.18,.28,4.2,7),material('#8d6746'),0,2.1,0);
 const leaves=material('#287b55');
 for(let i=0;i<7;i++){const a=i*Math.PI*2/7;const leaf=mesh(g,new THREE.ConeGeometry(.42,3.5,5),leaves,Math.cos(a)*1.15,4.1+Math.sin(i*2)*.18,Math.sin(a)*1.15,false);leaf.rotation.z=-Math.cos(a)*.85;leaf.rotation.x=Math.sin(a)*.85;leaf.rotation.y=-a;}
 return g;
}
function human(parent,x,z,shirt,pants){
 const g=new THREE.Group();g.position.set(x,0,z);parent.add(g);
 const skin=material('#c58d68'),top=material(shirt),bottom=material(pants),dark=material('#252b31');
 mesh(g,new THREE.CylinderGeometry(.22,.3,.85,8),top,0,1.02,0);
 mesh(g,new THREE.SphereGeometry(.22,12,10),skin,0,1.62,0);
 mesh(g,new THREE.BoxGeometry(.12,.62,.14),bottom,-.12,.35,0);
 mesh(g,new THREE.BoxGeometry(.12,.62,.14),bottom,.12,.35,0);
 mesh(g,new THREE.BoxGeometry(.13,.65,.14),top,-.32,1.05,0);
 mesh(g,new THREE.BoxGeometry(.13,.65,.14),top,.32,1.05,0);
 mesh(g,new THREE.BoxGeometry(.27,.09,.42),dark,0,.04,.08);
 return g;
}
function carStatic(parent,x,z,color,rotation=0){
 const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rotation;parent.add(g);
 const body=material(color,.38,.28),glass=new THREE.MeshStandardMaterial({color:'#263f4c',roughness:.18,metalness:.45}),rubber=material('#17191c');
 mesh(g,new THREE.BoxGeometry(2.1,.65,4.1),body,0,.72,0);
 mesh(g,new THREE.BoxGeometry(1.65,.78,2.05),glass,0,1.35,-.12);
 mesh(g,new THREE.BoxGeometry(2.12,.22,1.15),body,0,1.05,1.25);
 for(const sx of [-1,1])for(const sz of [-1,1]){const w=mesh(g,new THREE.CylinderGeometry(.39,.39,.22,14),rubber,sx*1.02,.42,sz*1.25);w.rotation.z=Math.PI/2;}
 const light=material('#fff0b5',.25,.1),red=material('#b52f30');
 for(const sx of [-.72,.72]){mesh(g,new THREE.BoxGeometry(.35,.16,.08),light,sx,.78,2.07,false);mesh(g,new THREE.BoxGeometry(.35,.16,.08),red,sx,.78,-2.07,false);}
 return g;
}
export function makeWorld(scene){
 const root=new THREE.Group();scene.add(root);
 const ground=mesh(root,new THREE.PlaneGeometry(250,250),material('#b4a98f'),0,-.12,0,false);ground.rotation.x=-Math.PI/2;
 const road=material('#30383d'),line=material('#e7d8a4'),sidewalk=material('#aaa69b'),grass=material('#6b9863');
 // Coastal city grid: broad avenues and cross streets.
 for(let i=-2;i<=2;i++){
  const p=i*38;
  mesh(root,new THREE.BoxGeometry(12,.08,220),road,p,-.055,0,false);
  mesh(root,new THREE.BoxGeometry(220,.08,12),road,0,-.054,p,false);
  for(let k=-5;k<=5;k++){
   mesh(root,new THREE.BoxGeometry(.16,.018,4),line,p,-.005,k*18,false);
   mesh(root,new THREE.BoxGeometry(4,.018,.16),line,k*18,-.004,p,false);
  }
  mesh(root,new THREE.BoxGeometry(15,.22,220),sidewalk,p-13,.02,0,false);
  mesh(root,new THREE.BoxGeometry(15,.22,220),sidewalk,p+13,.02,0,false);
  mesh(root,new THREE.BoxGeometry(220,.22,15),sidewalk,0,.02,p-13,false);
  mesh(root,new THREE.BoxGeometry(220,.22,15),sidewalk,0,.02,p+13,false);
 }
 const colliders=[];
 let seed=7;
 for(let gx=-2;gx<2;gx++)for(let gz=-2;gz<2;gz++){
  const cx=gx*38+19,cz=gz*38+19;
  for(let n=0;n<4;n++){
   seed=(seed*9301+49297)%233280;const w=8+(seed/233280)*7;
   seed=(seed*9301+49297)%233280;const d=8+(seed/233280)*7;
   const ox=(n%2===0?-1:1)*7,oz=(n<2?-1:1)*7;
   seed=(seed*9301+49297)%233280;const h=7+(seed/233280)*24;
   building(root,cx+ox,cz+oz,w,d,h,Math.floor(seed),colliders);
  }
 }
 // Waterfront promenade and beach.
 const sea=new THREE.Mesh(new THREE.PlaneGeometry(250,42),new THREE.MeshStandardMaterial({color:'#247d91',roughness:.22,metalness:.2}));sea.rotation.x=-Math.PI/2;sea.position.set(0,-.18,119);root.add(sea);
 mesh(root,new THREE.BoxGeometry(250,.12,15),material('#dfc99c'),0,-.04,91,false);
 for(let i=-10;i<=10;i++)palm(root,i*10,82+(i%2)*3,.9+(i%3)*.08);
 // City park with paths and palms.
 mesh(root,new THREE.BoxGeometry(28,.05,28),grass,-57,.0,-57,false);
 for(let i=0;i<14;i++)palm(root,-68+(i%4)*7,-68+Math.floor(i/4)*7,.65);
 const parkPath=material('#d6c7a6');mesh(root,new THREE.BoxGeometry(4,.08,26),parkPath,-57,.04,-57,false);mesh(root,new THREE.BoxGeometry(26,.08,4),parkPath,-57,.045,-57,false);
 // Port cranes and warehouse silhouettes.
 for(let i=0;i<3;i++){
  const x=66+i*12,z=78;
  mesh(root,new THREE.BoxGeometry(1,16,1),material('#d65d45'),x,8,z);
  mesh(root,new THREE.BoxGeometry(16,.7,1),material('#d65d45'),x+6,16,z);
  mesh(root,new THREE.BoxGeometry(1,.5,1),material('#e8c16a'),x+12,15.3,z);
 }
 // A few recognisable street props.
 for(let i=0;i<24;i++){const x=-92+(i*17)%184,z=-88+(i*31)%175;mesh(root,new THREE.CylinderGeometry(.12,.12,1.1,8),material('#525d62'),x,.55,z);mesh(root,new THREE.SphereGeometry(.22,8,8),material('#f3d16d'),x,1.18,z,false);}
 const pedestrians=[];
 const colors=['#e7a35b','#5e91b4','#c56c63','#d7d1b8','#6a8c63','#9b79a9'];
 for(let i=0;i<26;i++){
  const x=-88+(i*29)%176,z=-88+(i*43)%176;
  if(Math.abs(x%38)<9||Math.abs(z%38)<9)continue;
  const g=human(root,x,z,colors[i%colors.length],i%2?'#333e52':'#4c4a43');
  pedestrians.push({group:g,x,z,phase:i*.8,dir:i%2?1:-1});
 }
 const cars=[];
 const parked=[[-25,5,'#d44d48',Math.PI/2],[18,-24,'#e2bd50',0],[55,18,'#4c8fb4',Math.PI/2],[-58,18,'#e7e5db',0],[23,56,'#5e9c70',Math.PI/2],[-20,-55,'#a65b9b',0],[75,-25,'#cf7542',Math.PI/2]];
 for(const [x,z,c,r] of parked)cars.push({group:carStatic(root,x,z,c,r),x,z,rotation:r,speed:0,occupied:false});
 const spawn={x:-7,z:17};
 const missionNpc={x:8,z:18,group:human(root,8,18,'#e7c15e','#26394c')};
 const marker=new THREE.Group();marker.position.set(65,0,-55);root.add(marker);
 const ring=mesh(marker,new THREE.TorusGeometry(2,.15,8,32),material('#f3cb65',.3,.3),0,1.2,0,false);ring.rotation.x=Math.PI/2;
 mesh(marker,new THREE.CylinderGeometry(.08,.08,2.4,8),material('#f3cb65'),0,1.2,0,false);
 const bounds=108;
 return{root,colliders,pedestrians,cars,spawn,missionNpc,marker,ring,bounds,sea};
}
export function isBlocked(world,x,z,r=.65){
 if(Math.abs(x)>world.bounds||Math.abs(z)>world.bounds)return true;
 for(const o of world.colliders)if(Math.hypot(x-o.x,z-o.z)<r+o.r)return true;
 for(const c of world.cars||[])if(!c.occupied&&Math.hypot(x-c.x,z-c.z)<2.3+r)return true;
 return false;
}
export function updateWorld(world,dt){
 world.ring.rotation.z+=dt*.8;
 for(const p of world.pedestrians){p.phase+=dt;p.group.position.x=p.x+Math.sin(p.phase*.35)*.8;p.group.position.z=p.z+Math.cos(p.phase*.35)*.8;p.group.rotation.y=Math.sin(p.phase*.35)*.5;}
}
