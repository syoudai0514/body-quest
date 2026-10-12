import {test} from 'node:test';
import assert from 'node:assert/strict';
import {freshState,today} from '../src/domain';
import {balanceNote,pfcBalance,shares} from '../src/balance';
import type {Meal} from '../src/types';
const d=today();
const meal=(kcal:number,protein:number,fat:number,carbs:number,extra:Partial<Meal>={}):Meal=>({id:crypto.randomUUID(),date:d,slot:'昼食',name:'x',quantity:1,source:'',estimated:true,kcal,protein,fat,carbs,...extra});
function day(...m:Meal[]){const s=freshState();s.settings={...s.settings,kcal:2000,protein:140,fat:60,carbs:225};s.meals=m;return s;}
test('shares are whole percents of P/F/C energy and always add up to 100',()=>{
 assert.deepEqual(shares(0,0,0),null);
 for(const [p,f,c] of [[30,20,100],[1,1,1],[140,60,225],[7,33,12]]){const x=shares(p,f,c)!;assert.equal(x.protein+x.fat+x.carbs,100);}
 assert.deepEqual(shares(25,10,50),{protein:26,fat:23,carbs:51},'100/90/200 kcal of 390');
});
test('balance reports every axis against its target and flags the ones that are over',()=>{
 const b=pfcBalance(day(meal(900,60,50,80),meal(700,50,30,60)),d);
 assert.deepEqual(b.axes.map(a=>[a.key,Math.round(a.eaten),a.target]),[['kcal',1600,2000],['protein',110,140],['fat',80,60],['carbs',140,225]]);
 assert.equal(b.by.fat.over,true);assert.equal(b.by.fat.left,0);assert.equal(b.by.carbs.over,false);assert.equal(Math.round(b.by.carbs.left),85);
 assert.match(b.note,/脂質が目安を20g超えています/);
 const empty=pfcBalance(day(),d);assert.equal(empty.eatenShare,null);assert.match(empty.note,/食事を記録すると/);assert.equal(empty.recorded,false);
 // another day's meals are not counted
 const other=day(meal(500,30,10,60,{date:'2020-01-01'}));assert.equal(pfcBalance(other,d).by.kcal.eaten,0);
});
test('alcohol energy is reported on its own and stays out of the P/F/C split',()=>{
 const b=pfcBalance(day(meal(700,40,20,80),meal(140,0,0,0,{alcoholG:20,slot:'間食'})),d);
 assert.equal(Math.round(b.alcoholKcal),140);assert.deepEqual(b.eatenShare,shares(40,20,80));assert.equal(b.by.kcal.eaten,840);
});
test('the note picks the largest imbalance, waits for enough food and never asks to skip a meal',()=>{
 const note=(...m:Meal[])=>pfcBalance(day(...m),d).note;
 assert.match(note(meal(300,20,10,30)),/記録すると/,'under 600 kcal there is too little to judge');
 assert.match(note(meal(1000,60,40,130),meal(600,40,30,80)),/脂質の割合が高め|脂質が目安/);
 assert.match(note(meal(1300,70,35,140)),/バランスは、目安の範囲|炭水化物の割合が低め|脂質の割合が高め/);
 const low=note(meal(1000,90,35,80));assert.match(low,/炭水化物の割合が低め/);assert.match(low,/極端な糖質制限は避け/);
 assert.match(note(meal(1500,80,40,330)),/炭水化物が目安を\d+g超えています/);
 for(const m of [meal(900,60,50,80),meal(1000,90,35,80),meal(1500,80,40,330)])assert.ok(!/抜|減らし|断食/.test(note(m)));
 const by=pfcBalance(day(meal(1300,100,50,150)),d);assert.equal(balanceNote(by.by,null,null),'食事を記録すると、たんぱく質・脂質・炭水化物のバランスを見ます。');
});
