const KEY='eldoria-3d-save-v1';
export function saveGame(data){try{localStorage.setItem(KEY,JSON.stringify({...data,updatedAt:Date.now()}));}catch(e){console.warn('[save] unavailable',e);}}
export function loadGame(){try{const value=localStorage.getItem(KEY);return value?JSON.parse(value):null;}catch{return null;}}
export function clearSave(){try{localStorage.removeItem(KEY);}catch{}}
