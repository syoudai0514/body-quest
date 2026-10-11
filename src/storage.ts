import { freshState, salvageState } from './domain';
import type { AppState } from './types';
let dbPromise: Promise<IDBDatabase>|undefined;
function database() {return dbPromise??=new Promise((resolve,reject)=>{const r=indexedDB.open('body-quest',1);r.onupgradeneeded=()=>r.result.createObjectStore('data');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(new Error('端末保存を開けません。ブラウザの設定を確認してください。'));});}
// Records set aside on load are kept untouched under a second key, so they can still be recovered from the device.
export async function loadState(): Promise<{state:AppState;dropped:number}> {const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction('data','readwrite'),store=tx.objectStore('data'),r=store.get('state');r.onsuccess=()=>{try{if(!r.result){resolve({state:freshState(),dropped:0});return;}const result=salvageState(r.result);if(result.dropped)store.put(r.result,`state-before-repair-${new Date().toISOString()}`);resolve(result);}catch(e){reject(e);}};r.onerror=()=>reject(r.error);});}
export async function saveState(state: AppState) {const db=await database();return new Promise<void>((resolve,reject)=>{const tx=db.transaction('data','readwrite');tx.objectStore('data').put(state,'state');tx.oncomplete=()=>resolve();tx.onerror=()=>reject(new Error('保存できません。空き容量を確認し、バックアップしてください。'));});}
export async function photoData(file: File, maxSide=1280, quality=0.8) {if(!/^image\/(jpeg|png|webp)$/.test(file.type))throw new Error('JPEG・PNG・WebPの写真を選んでください。HEICはJPEGに変換してください。');if(file.size>15*1024*1024)throw new Error('15MB以下の写真を選んでください');const bitmap=await createImageBitmap(file);const size=Math.min(1,maxSide/Math.max(bitmap.width,bitmap.height));const c=document.createElement('canvas');c.width=Math.round(bitmap.width*size);c.height=Math.round(bitmap.height*size);c.getContext('2d')!.drawImage(bitmap,0,0,c.width,c.height);bitmap.close();return c.toDataURL('image/jpeg',quality);}
// Photos of one meal are sent together and the server takes about 3.6MB in all. Photos keep full quality while they fit;
// past that, the largest is re-encoded from its original one step smaller at a time (a label stays legible down to ~768px).
export type FoodPhoto={file:File;data:string;level:number};
export const MAX_FOOD_PHOTOS=10;
const MAX_FOOD_PHOTO_CHARS=3600000,STEPS=[[1280,0.8],[1024,0.72],[896,0.66],[768,0.6]] as const;
export async function fitFoodPhotos(photos:FoodPhoto[],limit=MAX_FOOD_PHOTO_CHARS,encode=photoData) {
 const out=[...photos];
 while(out.reduce((n,p)=>n+p.data.length,0)>limit){
  let i=-1;out.forEach((p,j)=>{if(p.level<STEPS.length-1&&(i<0||p.data.length>out[i].data.length))i=j;});
  if(i<0)throw new Error('写真の合計が大きすぎます。枚数を減らしてください。');
  const level=out[i].level+1,[side,quality]=STEPS[level];
  out[i]={...out[i],data:await encode(out[i].file,side,quality),level};
 }
 return out;
}
export async function addFoodPhotos(current:FoodPhoto[],files:File[]) {
 if(current.length+files.length>MAX_FOOD_PHOTOS)throw new Error(`写真は${MAX_FOOD_PHOTOS}枚までです。あと${MAX_FOOD_PHOTOS-current.length}枚選べます。`);
 const added=await Promise.all(files.map(async file=>({file,data:await photoData(file,STEPS[0][0],STEPS[0][1]),level:0})));
 return fitFoodPhotos([...current,...added]);
}
