export function createUI(){
 const root=document.querySelector('#game-ui');
 root.innerHTML=`
 <div class="topbar"><div class="brand"><span>VC</span><div><b>VICE CITY</b><small>STORIES</small></div></div><div class="mission"><small>GÖREV</small><b id="mission-title">Şehri keşfet</b><span id="mission-desc">Sahil şehrinde özgürce dolaş.</span></div><div class="cash"><small>BAKİYE</small><b id="cash">$ 250</b></div></div>
 <div id="toast"></div><div id="prompt"></div><div class="speedometer" id="speedometer"><b id="speed">0</b><small>KM/H</small></div>
 <canvas id="minimap" width="160" height="160"></canvas>
 <div class="controls-hint" id="controls-hint">WASD HAREKET · SHIFT KOŞ · F ARACA BİN / İN · E GÖREV · K KAYDET</div>
 <div id="mobile-controls"><div class="pad"><button data-key="w">▲</button><button data-key="a">◀</button><button data-key="s">▼</button><button data-key="d">▶</button></div><div class="actions"><button data-key="f">F</button><button data-key="e">E</button><button data-key="shift">⚡</button></div></div>`;
 const toastEl=root.querySelector('#toast'),promptEl=root.querySelector('#prompt');let callbacks={},timer;
 function bind(c){callbacks=c;document.querySelector('#start-button').addEventListener('click',c.onStart);
  root.querySelectorAll('[data-key]').forEach(b=>{const k=b.dataset.key;const down=e=>{e.preventDefault();c.onKey(k,true);};const up=()=>c.onKey(k,false);b.addEventListener('pointerdown',down);['pointerup','pointerleave','pointercancel'].forEach(ev=>b.addEventListener(ev,up));});
 }
 function toast(t){toastEl.textContent=t;toastEl.classList.add('show');clearTimeout(timer);timer=setTimeout(()=>toastEl.classList.remove('show'),2600);}
 function prompt(t){promptEl.textContent=t;promptEl.classList.toggle('show',!!t);}
 function update({money,missionTitle,missionDesc,vehicle,speed}){root.querySelector('#cash').textContent='$ '+money;root.querySelector('#mission-title').textContent=missionTitle;root.querySelector('#mission-desc').textContent=missionDesc;root.querySelector('#speedometer').classList.toggle('show',vehicle);root.querySelector('#speed').textContent=Math.round(Math.abs(speed)*3.6);}
 function drawMap(player,world,vehicle){const c=root.querySelector('#minimap').getContext('2d'),w=160;c.clearRect(0,0,w,w);c.fillStyle='#283c3e';c.fillRect(0,0,w,w);c.fillStyle='#56666a';for(let i=-2;i<=2;i++){const p=(i*38+125)/250*w;c.fillRect(p-4,0,8,w);c.fillRect(0,p-4,w,8);}c.fillStyle='#6b8d66';c.fillRect(13,13,20,20);c.fillStyle='#26859a';c.fillRect(0,139,w,21);const pos=vehicle?{x:vehicle.x,z:vehicle.z}:player.position;const x=80+pos.x/250*160,z=80+pos.z/250*160;c.fillStyle='#f5d36f';c.beginPath();c.arc(Math.max(4,Math.min(156,x)),Math.max(4,Math.min(156,z)),4,0,Math.PI*2);c.fill();c.fillStyle='#fff';c.fillRect(80+world.missionNpc.x/250*160-2,80+world.missionNpc.z/250*160-2,4,4);}
 return{bind,toast,prompt,update,drawMap};
}
