export function makeQuest(){return{fragments:0,complete:false};}
export function updateQuest(q,p,w,say){if(q.complete)return;if(Math.hypot(p.x-w.altar.x,p.y-w.altar.y)<30&&q.fragments>=3){q.complete=true;say('Eldoria kurtuldu!');}}
export function drawQuestMarker(c,q,w){if(q.complete)return;const x=w.altar.x,y=w.altar.y-40;c.fillStyle='#f7df81';c.font='bold 18px monospace';c.textAlign='center';c.fillText('✦',x,y);c.textAlign='left';}
