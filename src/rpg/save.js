const KEY='eldoria-save-v1';
export function saveGame(data){try{localStorage.setItem(KEY,JSON.stringify({...data,updated:Date.now()}));}catch(e){console.warn('Save unavailable',e);}}
export function loadGame(){try{const raw=localStorage.getItem(KEY);return raw?JSON.parse(raw):null;}catch(e){return null;}}
