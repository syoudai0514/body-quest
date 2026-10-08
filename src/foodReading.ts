import {calculateServing,preparationOf,valuesOf} from './nutrition.ts';
import type {Nutrition,Draft} from './types.ts';
import {portionMeasure,portionCount,portionForQuantity} from './portions.ts';
export {portionMeasure,portionForQuantity} from './portions.ts';
export const draftPortion=(draft:Draft)=>portionForQuantity(draft.portion,draft.factor??1)??'1食';
const keys=['kcal','protein','fat','carbs'] as const;
const nutritionOk=(value:unknown):value is Nutrition=>!!value&&typeof value==='object'&&keys.every(k=>{const n=(value as Nutrition)[k];return typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=50000;});
export function normalizeFoodReading(value:unknown,hasImage:boolean):Draft {
 if(!value||typeof value!=='object')throw new Error('INVALID_OUTPUT');const f=value as Draft;
 if(!nutritionOk(f)||!['name','portion','note'].every(k=>typeof (f as unknown as Record<string,unknown>)[k]==='string'&&String((f as unknown as Record<string,unknown>)[k]).length<=2000)||!f.name.trim()||typeof f.estimated!=='boolean')throw new Error('INVALID_OUTPUT');
 if(f.basis!==undefined&&!['label','reference','estimate'].includes(f.basis))throw new Error('INVALID_OUTPUT');
 if(f.basis==='label'&&hasImage){const label=f.label;if(!nutritionOk(label)||typeof label.portion!=='string'||!label.portion.trim()||label.portion.length>2000)throw new Error('INVALID_OUTPUT');const from=portionMeasure(label.portion),to=portionMeasure(f.portion);let factor=1;
  if(from&&to){if(from.unit!==to.unit)throw new Error('INVALID_OUTPUT');factor=to.value/from.value;}else if(label.portion!==f.portion){const base=portionCount(label.portion),eaten=portionCount(f.portion);if(!base||!eaten||base.unit!==eaten.unit)throw new Error('INVALID_OUTPUT');factor=eaten.value/base.value;}
  if(!Number.isFinite(factor)||factor<=0||factor>100)throw new Error('INVALID_OUTPUT');const numbers=calculateServing({portion:label.portion,values:label},f.portion);if(!nutritionOk(numbers))throw new Error('INVALID_OUTPUT');
  const count=portionCount(f.portion),portion=!to&&from&&count?`${count.value}${count.unit}（${Math.round(from.value*factor*10)/10}${from.unit}）`:f.portion;
  return {name:f.name,portion,...numbers,estimated:false,basis:'label',nutrition:{kind:'label',portion:label.portion,values:valuesOf(label),preparation:'ready',title:'写真の栄養表示',checkedAt:new Date().toISOString()},label:{portion:label.portion,kcal:label.kcal,protein:label.protein,fat:label.fat,carbs:label.carbs},note:`写真の栄養表示：${label.portion}あたり ${label.kcal}kcal / P${label.protein}g / F${label.fat}g / C${label.carbs}g。${factor===1?'':'食べた量へ換算。'}`};
 }
 return {name:f.name,portion:f.portion,kcal:f.kcal,protein:f.protein,fat:f.fat,carbs:f.carbs,estimated:true,note:f.note,nutrition:{kind:'estimate',portion:f.portion,values:valuesOf(f),preparation:preparationOf(f.portion)},...(f.basis==='reference'?{basis:'reference' as const}:{})};
}
export function foodWarnings(food:Pick<Draft,'name'|'portion'|'protein'>):string[] {
 const measure=portionMeasure(food.portion);if(!measure||measure.unit!=='g'||!/サラダチキン|鶏(?:むね|胸)/.test(food.name)||/ジャーキー|乾燥/.test(food.name))return [];
 return food.protein/measure.value*100>40?['鶏肉の量に対してたんぱく質が多すぎる可能性があります。生／加熱後の重量と、100gあたりの値を二重換算していないか確認してください。']:[];
}
