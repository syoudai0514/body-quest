import type {AppState} from './types';
import {totals} from './domain';
import {planReady} from './planning';

export type Axis = {key:'kcal'|'protein'|'fat'|'carbs';label:string;unit:string;eaten:number;target:number;ratio:number;over:boolean;left:number};
export type Shares = {protein:number;fat:number;carbs:number};
// Share of the energy that comes from P, F and C (4/9/4 kcal per gram), in whole percent adding up to 100. Alcohol is not part of it.
export function shares(p:number,f:number,c:number):Shares|null {
 const e=4*p+9*f+4*c;if(e<=0)return null;
 const protein=Math.round(4*p/e*100),fat=Math.round(9*f/e*100);
 return {protein,fat,carbs:Math.max(0,100-protein-fat)};
}
// How the day is going against every target, not only protein.
export function pfcBalance(state:AppState,date:string) {
 const meals=state.meals.filter(m=>m.date===date),n=totals(meals),s=state.settings;
 const axis=(key:Axis['key'],label:string,unit:string,target:number):Axis=>{const eaten=n[key];return {key,label,unit,eaten,target,ratio:target>0?eaten/target:0,over:Math.round(eaten)>Math.round(target),left:Math.max(0,target-eaten)};};
 const axes=[axis('kcal','カロリー','kcal',s.kcal),axis('protein','たんぱく質','g',s.protein),axis('fat','脂質','g',s.fat),axis('carbs','炭水化物','g',s.carbs)];
 const by=Object.fromEntries(axes.map(a=>[a.key,a])) as Record<Axis['key'],Axis>;
 const eatenShare=shares(n.protein,n.fat,n.carbs),targetShare=shares(s.protein,s.fat,s.carbs);
 const alcoholKcal=meals.reduce((sum,m)=>sum+(m.alcoholG??0)*7,0);
 return {axes,by,eatenShare,targetShare,alcoholKcal,ready:planReady(s),recorded:meals.length>0,note:balanceNote(by,eatenShare,targetShare)};
}
// One plain sentence about the biggest imbalance. It waits for enough food to be recorded and never asks to skip a meal.
export function balanceNote(by:Record<Axis['key'],Axis>,eaten:Shares|null,target:Shares|null):string {
 if(!eaten||!target||by.kcal.eaten<600)return '食事を記録すると、たんぱく質・脂質・炭水化物のバランスを見ます。';
 const over=(a:Axis)=>a.ratio>1.15;
 if(over(by.fat))return `脂質が目安を${Math.round(by.fat.eaten-by.fat.target)}g超えています。次の食事は揚げ物や油を控えめに、焼く・蒸す・刺身などを選びましょう。`;
 if(over(by.carbs))return `炭水化物が目安を${Math.round(by.carbs.eaten-by.carbs.target)}g超えています。次は主食を普通盛りにして、たんぱく質と野菜を足しましょう。`;
 if(eaten.fat>=target.fat+6)return `脂質の割合が高め（${eaten.fat}%、目安${target.fat}%）。次の食事は脂の少ない調理法がおすすめです。`;
 if(eaten.carbs<=target.carbs-12&&by.kcal.left>0)return `炭水化物の割合が低め（${eaten.carbs}%、目安${target.carbs}%）。極端な糖質制限は避け、ご飯・パン・芋などの主食も適量を。`;
 if(eaten.protein<=target.protein-6&&by.protein.left>0)return `たんぱく質の割合が低め（${eaten.protein}%、目安${target.protein}%）。次の食事で肉・魚・卵・大豆製品を足しましょう。`;
 return 'たんぱく質・脂質・炭水化物のバランスは、目安の範囲です。';
}
