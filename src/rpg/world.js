const S=32;
export function makeWorld(){const width=64,height=44,tiles=Array.from({length:height},(_,y)=>Array.from({length:width},(_,x)=>{let n=(x*17+y*31+x*y*7)%97;if(x<2||y<2||x>width-3||y>height-3)return 2;if(n<7)return 3;if(n<13)return 4;return 0;}));
const clear=(x,y,r=2)=>{for(let yy=y-r;yy<=y+r;yy++)for(let xx=x-r;xx<=x+r;xx++)if(tiles[yy]?.[xx]!==undefined)tiles[yy][xx]=0;};
for(let x=7;x<58;x++)clear(x,22,1);for(let y=8;y<38;y++)clear(32,y,1);
for(let y=16;y<29;y++)for(let x=8;x<20;x++)tiles[y][x]=0;
const spawn={x:13*S,y:22*S},npc={x:16*S,y:20*S},altar={x:51*S,y:9*S};
for(const [x,y] of [[21,14],[47,10],[51,31],[26,30],[40,25],[16,12],[51,9]])clear(x,y,2);
const obstacles=[];for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(tiles[y][x]===2||tiles[y][x]===3||tiles[y][x]===4)obstacles.push({x:x*S,y:y*S,t:tiles[y][x]});
return{width,height,tiles,spawn,npc,altar,obstacles};}
export function isSolid(world,x,y){const tx=Math.floor(x/S),ty=Math.floor(y/S);if(!world.tiles[ty]||world.tiles[ty][tx]===undefined)return true;const t=world.tiles[ty][tx];return t===2||t===3||t===4;}
function pixelTree(c,x,y){c.fillStyle='#1c392c';c.fillRect(x+3,y+9,26,20);c.fillStyle='#2f6740';c.fillRect(x+5,y+3,22,22);c.fillStyle='#4b8a4e';c.fillRect(x+9,y,12,8);c.fillStyle='#79543a';c.fillRect(x+13,y+22,7,12);c.fillStyle='#75a95a';c.fillRect(x+8,y+7,4,4);c.fillRect(x+21,y+13,4,4);}
function drawTile(c,t,x,y){if(t===0){c.fillStyle=((x/32|0)+(y/32|0))%2?'#527d48':'#57834b';c.fillRect(x,y,32,32);c.fillStyle='#6b9553';c.fillRect(x+5,y+7,2,2);c.fillRect(x+23,y+22,2,2);}else if(t===1){c.fillStyle='#8c754d';c.fillRect(x,y,32,32);}else if(t===2){c.fillStyle='#294f69';c.fillRect(x,y,32,32);c.fillStyle='#4d8290';c.fillRect(x+3,y+8,13,2);c.fillRect(x+18,y+21,9,2);}else if(t===3){pixelTree(c,x,y);}else{c.fillStyle='#777c79';c.fillRect(x+5,y+8,22,20);c.fillStyle='#a6aaa0';c.fillRect(x+9,y+5,13,7);}}
export function drawWorld(c,w){const S=32;for(let y=0;y<w.height;y++)for(let x=0;x<w.width;x++)drawTile(c,w.tiles[y][x],x*S,y*S);
for(let x=8;x<20;x++){drawTile(c,1,x*S,16*S);drawTile(c,1,x*S,28*S);}for(let y=16;y<29;y++){drawTile(c,1,8*S,y*S);drawTile(c,1,19*S,y*S);}
c.fillStyle='#b18a55';c.fillRect(10*S,18*S,7*S,6*S);c.fillStyle='#d7c18b';c.fillRect(10*S+5,18*S+5,7*S-10,6*S-10);c.fillStyle='#754b35';c.fillRect(12*S,18*S+20,3*S,4*S);c.fillStyle='#9b4e3d';c.fillRect(10*S,17*S,7*S,10);c.fillStyle='#d27a4d';c.fillRect(11*S,16*S,5*S,3*S);
const n=w.npc;c.fillStyle='#503d31';c.fillRect(n.x-10,n.y-8,20,24);c.fillStyle='#e5b78a';c.fillRect(n.x-7,n.y-17,14,13);c.fillStyle='#e4d3a0';c.fillRect(n.x-9,n.y-19,18,5);c.fillStyle='#f6e7ae';c.fillRect(n.x-3,n.y-12,2,2);
const a=w.altar;c.fillStyle='#8c8c94';c.fillRect(a.x-23,a.y-14,46,29);c.fillStyle='#c5b8d2';c.fillRect(a.x-15,a.y-22,30,10);c.fillStyle='#70d4ca';c.fillRect(a.x-4,a.y-18,8,8);c.fillStyle='#d7c58b';c.fillRect(a.x-2,a.y+15,4,5);}
