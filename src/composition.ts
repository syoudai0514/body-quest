import type {Food} from './types';
import {normalizedFoodText,searchFoods,preparationOf} from './nutrition';
export type CompositionData={edition:string;sourceUrl:string;notes:string;foods:[string,string,number,number,number,number,string][]};
let loaded:Promise<Food[]>|undefined;
export function compositionFoods(data:CompositionData):Food[] {
 return data.foods.map(([code,name,kcal,protein,fat,carbs,note])=>{const portion='可食部100g',url=`https://fooddb.mext.go.jp/details/details.pl?ITEM_NO=${Number(code.slice(0,2))}_${code}_7`,values={kcal,protein,fat,carbs};return {id:`mext-${code}`,name,portion,category:'標準食品',...values,source:`${data.edition}。${note||'標準成分値'}。${data.notes}`,estimated:true,nutrition:{kind:'composition',portion,values,preparation:preparationOf(name),url,title:data.edition,checkedAt:'2026-03-27T00:00:00Z'}};});
}
export function loadComposition() {return loaded??=fetch('/food-composition.json').then(r=>{if(!r.ok)throw Error('標準食品を読み込めませんでした');return r.json() as Promise<CompositionData>;}).then(compositionFoods).catch(e=>{loaded=undefined;throw e;});}
export function searchComposition(foods:Food[],query:string) {return normalizedFoodText(query).length?searchFoods(foods,query,[],20):[];}
