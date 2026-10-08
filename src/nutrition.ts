import type {Food,Meal,Draft,Nutrition,NutritionBasis,Preparation,AppState} from './types.ts';
import {portionCount,portionMeasure,portionForQuantity} from './portions.ts';
export const nutrientKeys=['kcal','protein','fat','carbs'] as const;
export const valuesOf=(n:Nutrition):Nutrition=>({kcal:n.kcal,protein:n.protein,fat:n.fat,carbs:n.carbs});
export const multiplyNutrition=(n:Nutrition,factor:number):Nutrition=>{if(!Number.isFinite(factor)||factor<=0||factor>1000)throw Error('量を確認してください');return {kcal:n.kcal*factor,protein:n.protein*factor,fat:n.fat*factor,carbs:n.carbs*factor};};
export function servingFactor(basis:string,consumed:string) {
 if(basis===consumed)return 1;
 if(consumed.startsWith(basis)){const suffix=consumed.slice(basis.length);if(/^(?:\s*×\s*\d+(?:\.\d+)?)+$/.test(suffix))return [...suffix.matchAll(/×\s*(\d+(?:\.\d+)?)/g)].reduce((f,m)=>f*Number(m[1]),1);}
 const a=portionMeasure(basis),b=portionMeasure(consumed);
 if(a&&b){if(a.unit!==b.unit)throw Error('gとmlは換算できません');return b.value/a.value;}
 const x=portionCount(basis),y=portionCount(consumed);if(x&&y&&x.unit===y.unit)return y.value/x.value;
 throw Error('基準量と食べた量の単位が対応していません');
}
export const calculateServing=(basis:Pick<NutritionBasis,'portion'|'values'>,consumed:string)=>multiplyNutrition(basis.values,servingFactor(basis.portion,consumed));
export function preparationOf(portion:string):Preparation {return /(?:^|\s)生(?:\s|$)|生(?:重量|\s*\d)|加熱前|調理前/.test(portion)?'raw':/加熱後|調理後|完成後|ゆで|焼き|蒸し|炊飯後/.test(portion)?'cooked':'unknown';}
export function basisForFood(f:Food):NutritionBasis {return f.nutrition??{kind:f.estimated?'estimate':'manual',portion:f.portion,values:valuesOf(f),preparation:preparationOf(f.portion)};}
export function draftBasis(d:Draft):NutritionBasis {
 if(d.nutrition)return d.nutrition;
 if(d.label&&d.basis==='label')return {kind:'label',portion:d.label.portion,values:valuesOf(d.label),preparation:'ready',checkedAt:new Date().toISOString(),title:'写真の栄養表示'};
 return {kind:'estimate',portion:d.portion,values:d.base??valuesOf(d),preparation:preparationOf(d.portion)};
}
export function scaledDraft(d:Draft,factor:number):Draft {
 const base=d.base??valuesOf(d),reference=d.nutrition??(d.label&&d.basis==='label'?draftBasis(d):undefined),portion=portionForQuantity(d.portion,factor)!;
 const values=reference?calculateServing(reference,portion):multiplyNutrition(base,factor);
 return {...d,...values,base,factor,checked:false};
}
export function foodFromDraft(d:Draft):Food {
 const reference=draftBasis(d),useOriginal=['label','manufacturer','composition'].includes(reference.kind),portion=useOriginal?reference.portion:portionForQuantity(d.portion,d.factor??1)!;
 return {id:crypto.randomUUID(),name:d.name.trim(),portion,category:'マイ食品',source:d.note,estimated:d.estimated,...(useOriginal?reference.values:valuesOf(d)),nutrition:useOriginal?reference:{...reference,portion,values:valuesOf(d)}};
}
export const preparationLabels:Record<Preparation,string>={raw:'生・調理前',cooked:'調理後',ready:'市販品・そのまま',unknown:'調理条件未確認'};
export const sourceLabels:Record<NutritionBasis['kind'],string>={label:'写真の表示値',manufacturer:'メーカー表示',composition:'文科省の標準値',recipe:'材料・完成重量から計算',manual:'手入力の表示値',estimate:'AI・一般的な推定'};
export function normalizedFoodText(text:string) {
 return text.normalize('NFKC').toLowerCase().replace(/savas/g,'ザバス').replace(/鶏(?:胸|むね|ムネ)(?:肉)?/g,'にわとり むね').replace(/鶏肉|チキン/g,'にわとり').replace(/ご飯|ごはん/g,'こめ めし').replace(/胸/g,'むね').replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-0x60)).replace(/[\[\]［］＜＞〈〉（）()・,、]/g,' ').trim();
}
export function matchesFood(f:Pick<Food,'name'|'portion'|'source'>,query:string) {
 const hay=normalizedFoodText(`${f.name} ${f.portion} ${f.source}`).replace(/\s/g,'');return normalizedFoodText(query).split(/\s+/).filter(Boolean).every(q=>hay.includes(q));
}
export function searchFoods(foods:Food[],query:string,favorites:string[]=[],limit=50) {
 const exact=normalizedFoodText(query).replace(/\s/g,'');return foods.filter(f=>!f.archived&&matchesFood(f,query)).map((f,index)=>({f,index,score:(normalizedFoodText(f.name).replace(/\s/g,'')===exact&&exact?10:0)+(favorites.includes(f.id)?3:0)+(f.nutrition&&['label','manufacturer','composition'].includes(f.nutrition.kind)?2:0)})).sort((a,b)=>b.score-a.score||a.index-b.index).slice(0,limit).map(x=>x.f);
}
export function foodIdentity(f:Food) {
 const b=basisForFood(f);return b.barcode?`barcode:${b.barcode}`:[normalizedFoodText(f.name).replace(/\s/g,''),b.preparation,b.portion,b.kind==='manufacturer'||b.kind==='composition'?b.url??'':''].join('|');
}
function basisSignature(b:NutritionBasis|undefined){if(!b)return '';const {checkedAt,...stable}=b;return JSON.stringify(stable);}
export function upsertFoods(foods:Food[],incoming:Food[],at=new Date().toISOString()) {
 let result=[...foods];for(const f of incoming){const old=result.find(x=>x.id===f.id||foodIdentity(x)===foodIdentity(f));if(!old){result.push({...f,revision:1});continue;}
 const changed=old.name!==f.name||old.portion!==f.portion||old.source!==f.source||old.estimated!==f.estimated||nutrientKeys.some(k=>old[k]!==f[k])||basisSignature(old.nutrition)!==basisSignature(f.nutrition);
 const revised={...old,...f,id:old.id,archived:false,revision:(old.revision??1)+(changed?1:0),revisions:changed?[...(old.revisions??[]),{at,name:old.name,portion:old.portion,source:old.source,estimated:old.estimated,values:valuesOf(old),...(old.nutrition?{nutrition:old.nutrition}:{})}].slice(-10):old.revisions};result=result.map(x=>x.id===old.id?revised:x);
 }return result;
}
export function mealNutrition(f:Food,quantity:number) {const basis=basisForFood(f);return multiplyNutrition(calculateServing(basis,f.portion),quantity);}
export function nutritionIssues(f:Pick<Food,'name'|'portion'|'protein'|'fat'|'carbs'|'kcal'|'estimated'|'nutrition'>) {
 const issues:string[]=[],m=portionMeasure(f.portion);
 if(!f.nutrition)issues.push('出典と計算の基準をまだ確認していません');
 if(m?.unit==='g'&&f.protein+f.fat+f.carbs>m.value*1.15)issues.push('PFCの合計が食品の重さを超えています。基準量・単位を確認してください');
 if(m?.unit==='g'&&/サラダチキン|鶏(?:むね|胸)/.test(f.name)&&!/ジャーキー|乾燥/.test(f.name)&&f.protein/m.value*100>40)issues.push('鶏肉の量に対してたんぱく質が多く、二重換算の可能性があります');
 if(f.kcal===0&&f.protein+f.fat+f.carbs>1)issues.push('PFCがあるのにカロリーが0です。表示を確認してください');
 if(f.nutrition){try{const expected=calculateServing(f.nutrition,f.portion);if(nutrientKeys.some(k=>Math.abs(expected[k]-f[k])>Math.max(.15,expected[k]*.005)))issues.push('保存値と計算の基準が一致していません');}catch{issues.push('基準量と保存量の単位を確認してください');}}
 return issues;
}
export function validNutritionBasis(value:unknown):value is NutritionBasis {
 if(!value||typeof value!=='object')return false;const b=value as NutritionBasis,validValues=(v:unknown)=>!!v&&typeof v==='object'&&nutrientKeys.every(k=>typeof (v as Nutrition)[k]==='number'&&Number.isFinite((v as Nutrition)[k])&&(v as Nutrition)[k]>=0&&(v as Nutrition)[k]<=50000),text=(s:unknown,max=2000)=>typeof s==='string'&&s.length>0&&s.length<=max;
 if(!['label','manufacturer','composition','recipe','manual','estimate'].includes(b.kind)||!text(b.portion)||!validValues(b.values)||!['raw','cooked','ready','unknown'].includes(b.preparation))return false;
 if(b.url!==undefined){try{const u=new URL(b.url);if(u.protocol!=='https:'||u.username||u.password||b.url.length>2000)return false;}catch{return false;}}
 if(b.title!==undefined&&!text(b.title))return false;if(b.checkedAt!==undefined&&(!text(b.checkedAt)||!Number.isFinite(Date.parse(b.checkedAt))))return false;if(b.barcode!==undefined&&!/^\d{8,14}$/.test(b.barcode))return false;
 if(b.finishedGrams!==undefined&&(!Number.isFinite(b.finishedGrams)||b.finishedGrams<=0||b.finishedGrams>100000))return false;
 if(b.ingredients!==undefined&&(!Array.isArray(b.ingredients)||b.ingredients.length>50||b.ingredients.some(i=>!i||!text(i.name)||!text(i.source,10000)||!Number.isFinite(i.grams)||i.grams<0||i.grams>100000||!validValues(i.values)||(i.url!==undefined&&(!text(i.url)||!i.url.startsWith('https://'))))))return false;
 return true;
}
export function canUseFoodReference(f:Food) {return !f.archived&&!!f.nutrition&&nutritionIssues(f).length===0;}
export const foodSnapshot=(m:Meal)=>m.nutrition?{...m.nutrition,values:{...m.nutrition.values}}:undefined;
export function manageFood(state:AppState,food:Food) {return {...state,foods:upsertFoods(state.foods,[food])};}
