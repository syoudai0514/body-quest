import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeFoodReading,portionMeasure,portionForQuantity,draftPortion,foodWarnings} from '../src/foodReading';
import {freshState,mealFromFood,recipeNutrition,today,validateState} from '../src/domain';
import {mealHistory,mealFromHistory} from '../src/history';
import {knownFoods,foodAiContext} from '../src/ai';
const date=today(),label={portion:'1本（430ml）',kcal:193,protein:30,fat:0,carbs:18.5};
const wrong={name:'ザバス脂肪0カフェラテ',portion:'430ml',kcal:103,protein:15,fat:0,carbs:10.3,estimated:true,basis:'label',label,note:'旧製品の値'};
test('photo label overrides an incorrect model total and keeps label energy and total carbohydrates',()=>{
 const d=normalizeFoodReading(wrong,true);assert.deepEqual([d.kcal,d.protein,d.fat,d.carbs,d.estimated],[193,30,0,18.5,false]);assert.match(d.note,/1本（430ml）/);assert.notEqual(d.kcal,d.protein*4+d.carbs*4);assert.equal(d.basis,'label');
});
test('label basis is scaled to consumed volume once, including half a bottle and 100ml labels',()=>{
 const half=normalizeFoodReading({...wrong,portion:'215ml'},true);assert.deepEqual([half.kcal,half.protein,half.carbs],[96.5,15,9.3]);
 const full=normalizeFoodReading({...wrong,label:{...label,portion:'100ml',kcal:45,protein:7,carbs:4.3}},true);assert.deepEqual([full.kcal,full.protein,full.carbs],[193.5,30.1,18.5]);
});
test('one bottle retains its labelled volume even when AI describes the consumed amount as a count',()=>{
 const d=normalizeFoodReading({...wrong,portion:'1本'},true);assert.equal(d.kcal,193);assert.equal(d.portion,'1本（430ml）');assert.deepEqual(portionMeasure(d.portion),{value:430,unit:'ml'});
 const half=normalizeFoodReading({...wrong,portion:'0.5本'},true);assert.equal(half.kcal,96.5);assert.equal(half.portion,'0.5本（215ml）');assert.equal(normalizeFoodReading({...wrong,portion:'1本 ×0.5'},true).portion,'0.5本（215ml）');
});
test('package labels can scale by matching counts without inventing a gram weight',()=>{
 const d=normalizeFoodReading({...wrong,portion:'2袋',label:{...label,portion:'1袋'}},true);assert.equal(d.kcal,386);assert.equal(d.protein,60);assert.equal(d.portion,'2袋');assert.equal(portionMeasure(d.portion),null);
 assert.throws(()=>normalizeFoodReading({...wrong,portion:'2個',label:{...label,portion:'1袋'}},true));
});
test('no photo cannot claim a label reading; incomplete or incompatible photo basis is rejected',()=>{
 assert.equal(normalizeFoodReading(wrong,false).estimated,true);assert.equal(normalizeFoodReading({...wrong,basis:undefined,label:undefined,estimated:false},true).estimated,true);
 for(const patch of [{label:undefined},{label:{...label,carbs:undefined}},{portion:'200g'},{portion:'200mlと100ml'},{label:{...label,kcal:NaN}}])assert.throws(()=>normalizeFoodReading({...wrong,...patch},true));
});
test('mass and volume retain multipliers but mixed ingredient weights have no single basis',()=>{
 assert.deepEqual(portionMeasure('生200グラム ×0.5 ×2'),{value:200,unit:'g'});assert.deepEqual(portionMeasure('0.2kg'),{value:200,unit:'g'});assert.deepEqual(portionMeasure('４３０ｍｌ'),{value:430,unit:'ml'});assert.equal(portionMeasure('鶏200g＋たれ20g'),null);assert.equal(portionMeasure('1回分'),null);
 assert.equal(portionForQuantity(undefined,2),undefined);assert.equal(draftPortion({...normalizeFoodReading(wrong,true),factor:.5}),'430ml ×0.5');
});
test('saved and re-added meals retain their serving basis and existing total is not multiplied twice',()=>{
 const s=freshState(),f={id:'chicken',name:'生の鶏むね肉',portion:'生100g',category:'マイ食品',source:'材料',estimated:true,kcal:105,protein:23.3,fat:1.9,carbs:.1};s.foods=[];s.meals=[mealFromFood(f,date,'朝食',2)];
 const h=mealHistory(s,'朝食',date)[0],again=mealFromHistory(h,date,'昼食');assert.equal(again.portion,'生100g');assert.equal(again.quantity,2);assert.equal(again.kcal,210);assert.equal(again.protein,46.6);
 const ref=knownFoods(s,date)[0];assert.equal(ref.portion,'生100g ×2');assert.equal(ref.kcal,210);assert.equal(ref.protein,46.6);assert.equal(ref.canScale,true);assert.deepEqual(validateState(JSON.parse(JSON.stringify(s))),s);
 assert.throws(()=>validateState({...s,meals:[{...again,portion:200}]}));
});
test('old meals with lost portions and suspicious chicken never become numerical AI references',()=>{
 const s=freshState(),base=mealFromFood({id:'x',name:'サラダチキン',portion:'200g',category:'マイ食品',source:'旧AI',estimated:true,kcal:420,protein:92.4,fat:4.8,carbs:1.2},date,'朝食');s.foods=[];const {portion,...old}=base;s.meals=[old];
 let ref=knownFoods(s,date)[0];assert.equal(ref.canScale,false);assert.equal('kcal' in ref,false);assert.equal('protein' in ref,false);assert.doesNotThrow(()=>validateState(s));assert.equal('kcal' in foodAiContext(s,date).todayMeals[0],false);
 s.meals=[base];ref=knownFoods(s,date)[0];assert.equal('protein' in ref,false);
 s.foods=[{...base,id:'custom',portion:'200g',category:'マイ食品'}];assert.equal(knownFoods(s,date).some(x=>'protein' in x),false);
});
test('chicken anomaly warns without flattening cooked meat into raw weight nutrition',()=>{
 assert.equal(foodWarnings({name:'サラダチキン',portion:'200g',protein:92.4}).length,1);assert.equal(foodWarnings({name:'サラダチキン',portion:'加熱後200g',protein:60}).length,0);assert.equal(foodWarnings({name:'鶏むねジャーキー',portion:'100g',protein:60}).length,0);
 const n=recipeNutrition([{food:{kcal:105,protein:23.3,fat:1.9,carbs:.1},grams:600}],500,200);assert.equal(n.kcal,252);assert.ok(Math.abs(n.protein-55.92)<1e-8);
});
test('raw and cooked serving bases do not merge into one remembered food',()=>{
 const s=freshState(),m=mealFromFood({id:'x',name:'鶏むね肉',portion:'生200g',category:'マイ食品',source:'材料',estimated:true,kcal:210,protein:46.6,fat:3.8,carbs:.2},date,'朝食');s.meals=[m,{...m,id:'y',portion:'加熱後200g'}];assert.equal(mealHistory(s,'朝食',date).length,2);
});
