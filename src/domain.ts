import {bodyOk} from './body';
import {validAdvice} from './homeAdvice';
import type { AppState, Food, Meal, Nutrition, Settings, Weight } from './types';
export function localDate(date: Date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
export const today = () => localDate(new Date());
export function offsetDate(date: string, days: number) { const d = new Date(`${date}T12:00:00`); d.setDate(d.getDate()+days); return localDate(d); }
export function daysBetween(a: string, b: string) { return Math.round((Date.parse(`${b}T12:00:00Z`)-Date.parse(`${a}T12:00:00Z`))/86400000); }
export const zero: Nutrition = {kcal:0,protein:0,fat:0,carbs:0};
export function totals(items: Nutrition[]): Nutrition { return items.reduce((a,b)=>({kcal:a.kcal+b.kcal,protein:a.protein+b.protein,fat:a.fat+b.fat,carbs:a.carbs+b.carbs}),{...zero}); }
export function scale(n: Nutrition, qty: number): Nutrition { return {kcal:n.kcal*qty,protein:n.protein*qty,fat:n.fat*qty,carbs:n.carbs*qty}; }
export function whiskey(ml: number, abv=40) { const grams=ml*abv/100*0.789; return {alcoholG:grams,kcal:grams*7,protein:0,fat:0,carbs:0}; }
export function recipeNutrition(ingredients: {food: Nutrition; grams: number}[], finishedGrams: number, servingGrams: number) { if(finishedGrams<=0 || servingGrams<=0 || ingredients.some(i=>i.grams<0)) throw new Error('重量を確認してください'); return scale(totals(ingredients.map(i=>scale(i.food,i.grams/100))),servingGrams/finishedGrams); }
// Older data may hold several records for one date and time; like the averages, the last one wins.
export function latestRecord(weights: Weight[], date: string, time: Weight['time']) { let found: Weight|undefined, waist: number|undefined; for(const w of weights) if(w.date===date&&w.time===time){found=w;if(w.waist!==undefined)waist=w.waist;} return found?{...found,...(waist!==undefined&&found.waist===undefined?{waist}:{})}:undefined; }
export function morningAverage(weights: Weight[], end: string, days=7) { const map=new Map<string,number>(); for(const w of weights) if(w.time==='朝' && w.date<=end && w.date>=offsetDate(end,-days+1)) map.set(w.date,w.kg); const values=[...map.values()]; return values.length?{value:values.reduce((a,b)=>a+b,0)/values.length,count:values.length}:null; }
export function trend(weights: Weight[], end: string) { const a=morningAverage(weights,end), b=morningAverage(weights,offsetDate(end,-7)); return a&&b&&a.count>=4&&b.count>=4?{current:a.value,previous:b.value,change:a.value-b.value}:null; }
export function coaching(state: AppState, date: string) {
 const n=totals(state.meals.filter(m=>m.date===date)), t=trend(state.weights,date), tips: string[]=[];
 if(!state.weights.some(w=>w.date===date&&w.time==='朝')) tips.push('明朝、起床後・トイレ後・朝食前に体重を記録。同じ条件で比較しよう。');
 if(n.protein<state.settings.protein && state.meals.some(m=>m.date===date)) tips.push(`記録上、たんぱく質はあと${Math.round(state.settings.protein-n.protein)}g。魚・鶏肉・豆腐から一品。未記録の食事があれば先に入力しよう。`);
 if(state.meals.some(m=>m.date===date && (m.alcoholG??0)>0)) tips.push('ハイボールもエネルギーに含まれる。次の一杯を炭酸水に替える選択も。翌朝の増減だけで判断しない。');
 if(t) { if(t.change < -(t.current*0.01)) tips.push('平均体重の減り方が速め。食事をさらに減らさず、疲れ・空腹・集中力を確認。体調不良があれば医療者へ相談。'); else if(state.settings.targetWeight===state.settings.startWeight&&state.settings.targetWeight!==null)tips.push('体重維持の目標です。週の平均と体調を確認し、食事量を極端に減らさず習慣を続けよう。'); else if(t.change >= -0.1) tips.push('2週間の平均では減量が進んでいない。まず記録漏れ・外食の量・ウイスキーの注ぐ量を確認してから、小さく調整しよう。'); else tips.push('平均体重は緩やかに減少中。今の習慣を続け、ウエストも週1回確認しよう。'); }
 else tips.push('朝の記録が各週4日以上、2週間分そろうと傾向を評価。一日の増減では食事を減らさない。');
 const days=daysBetween(date,state.settings.deadline),goal=state.settings.targetWeight;
 if(t&&goal!==null&&days>0&&t.current>goal){const required=(t.current-goal)/days*7;if(required>t.current*0.01)tips.push('目標体重に期限内で届くには減量ペースが速すぎる可能性。食事を極端に減らさず、目標体重を見直してウエストと見た目を優先しよう。');else if(-t.change<required-0.15)tips.push('今の平均体重のペースでは、期限の目安に届かない可能性。まず記録と外食・飲酒量を確認し、無理のない小さな変更を一つ。見た目の変化も確認しよう。');}
 if(state.settings.backPain) tips.push('腰に痛みが出る腹筋ローラーは休止。今日は痛みのない範囲の運動に。');
 const mode=state.settings.coachMode??'balanced';
 return tips.map(t=>mode==='gentle'?`少しずつで大丈夫。${t}`:mode==='direct'?`今日の行動：${t}`:t);
}
export function defaultSettings(): Settings {const d=today();return {kcal:2000,protein:140,fat:60,carbs:225,startWeight:null,targetWeight:null,startDate:d,deadline:offsetDate(d,365),goalName:'',goalKind:'longterm',nutritionMode:'auto',coachMode:'balanced',proteinPerKg:1.6,whiskeyMl:30,ldl:false,backPain:false};}
const estimate='一般的な材料量からの目安。商品・量・調理法で変わる';
export const presets: Food[] = [
 {id:'rice150',name:'ご飯',portion:'炊飯後 150g',category:'基本',kcal:234,protein:3.8,fat:0.5,carbs:55.7,source:estimate,estimated:true},
 {id:'chicken',name:'皮なし鶏胸肉',portion:'生 100g',category:'基本',kcal:105,protein:23.3,fat:1.9,carbs:0,source:estimate,estimated:true},
 {id:'onion',name:'玉ねぎ',portion:'生 100g',category:'基本',kcal:33,protein:1,fat:0.1,carbs:8.4,source:estimate,estimated:true},
 {id:'mushroom',name:'しめじ',portion:'生 100g',category:'基本',kcal:26,protein:2.7,fat:0.5,carbs:4.8,source:estimate,estimated:true},
 {id:'oil',name:'植物油',portion:'100g（材料計算用）',category:'基本',kcal:900,protein:0,fat:100,carbs:0,source:estimate,estimated:true},
 {id:'yogurt',name:'無糖ヨーグルト＋バナナ',portion:'ヨーグルト150g・バナナ1本',category:'朝食',kcal:190,protein:7,fat:4.5,carbs:32,source:estimate,estimated:true},
 {id:'fishset',name:'焼き魚定食・普通盛り',portion:'1食',category:'外食',kcal:650,protein:30,fat:22,carbs:80,source:estimate,estimated:true},
 {id:'ramen',name:'ラーメン',portion:'1杯・種類による',category:'外食',kcal:800,protein:25,fat:30,carbs:100,source:'種類・油・麺量で大きく変わる仮の目安。栄養表示があれば修正',estimated:true},
 {id:'ponzu',name:'鶏胸肉のポン酢蒸し',portion:'鶏150g・きのこ100g・ポン酢15g',category:'レシピ',kcal:200,protein:37,fat:3.5,carbs:8,source:estimate,estimated:true,minutes:15,steps:['皮なし鶏胸肉150gを厚さ1cm程度のそぎ切りにし、きのこ100gと耐熱容器へ。酒小さじ2を加える。','ふんわりラップをして600Wで3分、肉を返して追加で2〜3分。時間は目安。食品用温度計で中心75℃に達し、その状態を1分保つまで追加加熱する。','ポン酢15gをかける。ご飯150gは別に記録。食べない分は浅い容器で速やかに冷まし冷蔵、1〜2日を目安に。長く保存する分は冷凍。']},
 {id:'tomato',name:'鶏胸肉のトマト煮',portion:'鶏150g・トマト150g・玉ねぎ50g・油3g',category:'レシピ',kcal:245,protein:37,fat:6,carbs:13,source:estimate,estimated:true,minutes:20,steps:['鶏胸肉150gを一口大、玉ねぎ50gを薄切り。鍋に油3gを入れ、玉ねぎを炒める。','カットトマト150g、水50ml、鶏肉、少量の塩・こしょうを加え、蓋をして煮る。','中心75℃で1分以上加熱できたことを確認。ご飯やパンは別に記録。速やかに冷却して冷蔵1〜2日、長く保存する分は冷凍。']},
 {id:'soup',name:'鶏胸肉と豆腐のスープ',portion:'鶏100g・絹豆腐150g・きのこ100g',category:'レシピ',kcal:230,protein:35,fat:8,carbs:8,source:estimate,estimated:true,minutes:15,steps:['鍋に水300ml、きのこ100g、薄く切った鶏胸肉100gを入れて煮る。','肉の中心75℃で1分以上を確認して、絹豆腐150gと少量のだし・しょうゆを加えて温める。','主食は別に追加。汁物だけで夕食を済ませず、一日の食事量も確認。']},
 {id:'protein-shake',name:'プロテイン（ホエイ・水割り）',portion:'粉30g・1杯',category:'たんぱく質',kcal:115,protein:22,fat:1.5,carbs:3.5,source:'一般的なホエイプロテインの目安。商品の栄養表示で修正',estimated:true},
 {id:'salad-chicken',name:'サラダチキン',portion:'1個 110g',category:'たんぱく質',kcal:120,protein:26,fat:1.5,carbs:0.5,source:'一般的な商品の目安。購入した商品の表示で修正',estimated:true},
 {id:'greek-yogurt',name:'ギリシャヨーグルト（無糖）',portion:'1個 100g',category:'たんぱく質',kcal:90,protein:10,fat:0.5,carbs:5,source:'一般的な商品の目安。商品の表示で修正',estimated:true},
 {id:'boiled-egg',name:'ゆで卵',portion:'1個 50g',category:'たんぱく質',kcal:67,protein:6.3,fat:5.2,carbs:0.2,source:estimate,estimated:true},
 {id:'natto',name:'納豆',portion:'1パック 45g（たれ別）',category:'たんぱく質',kcal:86,protein:7.4,fat:4.5,carbs:5.4,source:estimate,estimated:true},
 {id:'tofu',name:'絹ごし豆腐',portion:'150g',category:'たんぱく質',kcal:84,protein:8,fat:5.3,carbs:3,source:estimate,estimated:true},
 {id:'tuna',name:'ツナ缶（水煮）',portion:'1缶 70g',category:'たんぱく質',kcal:50,protein:11.5,fat:0.5,carbs:0.1,source:'一般的な商品の目安。缶の表示で修正',estimated:true},
 {id:'convenience',name:'おにぎり＋サラダチキン＋サラダ',portion:'購入時の1セット',category:'外食',kcal:420,protein:30,fat:10,carbs:53,source:'一般的な組み合わせの目安。ドレッシングを含む商品表示で修正',estimated:true},
];
export function freshState(): AppState {return {version:1,settings:defaultSettings(),foods:presets,meals:[],weights:[],exercises:[],photos:[],contexts:{},lastBackup:null};}
// Adds built-in foods introduced after the user's data was created; existing entries stay as edited.
export function withPresets(state: AppState): AppState {const ids=new Set(state.foods.map(f=>f.id)),missing=presets.filter(p=>!ids.has(p.id));return missing.length?{...state,foods:[...state.foods,...missing]}:state;}
export function mealFromFood(food: Food, date: string, slot: string, quantity=1): Meal {return {id:crypto.randomUUID(),date,slot,name:food.name,quantity,source:food.source,estimated:food.estimated,...scale(food,quantity)};}
const finite=(x:unknown):x is number=>typeof x==='number'&&Number.isFinite(x);
const dateOk=(x:unknown):x is string=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+'T12:00:00Z'))&&new Date(x+'T12:00:00Z').toISOString().slice(0,10)===x;
const textOk=(x:unknown):x is string=>typeof x==='string'&&x.length<=10000;
const nutritionOk=(x:unknown):x is Nutrition=>!!x&&typeof x==='object'&&['kcal','protein','fat','carbs'].every(k=>finite((x as Record<string,unknown>)[k])&&(x as Record<string,number>)[k]>=0&&(x as Record<string,number>)[k]<=50000);
export function validateState(value: unknown): AppState {
 if(!value||typeof value!=='object')throw new Error('バックアップ形式が違います');const s=value as AppState,p=s.settings;
 if(s.version!==1||!p||!finite(p.kcal)||p.kcal<1200||p.kcal>5000||![p.protein,p.fat,p.carbs].every(x=>finite(x)&&x>=0&&x<=1000)||!dateOk(p.startDate)||!dateOk(p.deadline)||daysBetween(p.startDate,p.deadline)<0||!finite(p.whiskeyMl)||p.whiskeyMl<5||p.whiskeyMl>200||typeof p.ldl!=='boolean'||typeof p.backPain!=='boolean'||![p.startWeight,p.targetWeight].every(x=>x===null||(finite(x)&&x>=30&&x<=300)))throw new Error('目標設定が不正です');
 if(p.energy){const e=p.energy;if(!finite(e.age)||e.age<18||e.age>100||!finite(e.height)||e.height<120||e.height>230||!['male','female'].includes(e.sex)||!finite(e.activity)||e.activity<1.2||e.activity>2||!['separate','included'].includes(e.exerciseMode)||!finite(e.weeklyExerciseKcal)||e.weeklyExerciseKcal<0||e.weeklyExerciseKcal>4200)throw new Error('消費カロリー設定が不正です');}
 if((p.goalName!==undefined&&(typeof p.goalName!=='string'||p.goalName.length>80))||(p.goalKind!==undefined&&!['event','longterm'].includes(p.goalKind))||(p.nutritionMode!==undefined&&!['auto','manual'].includes(p.nutritionMode))||(p.coachMode!==undefined&&!['gentle','balanced','direct'].includes(p.coachMode))||(p.proteinPerKg!==undefined&&(!finite(p.proteinPerKg)||p.proteinPerKg<1.2||p.proteinPerKg>2)))throw new Error('計画設定が不正です');
 if((p.caloriePolicy!==undefined&&!['standard','flexible'].includes(p.caloriePolicy))||(p.belowBmrAcknowledged!==undefined&&typeof p.belowBmrAcknowledged!=='boolean')||(p.caloriePolicy==='flexible'&&p.belowBmrAcknowledged!==true))throw new Error('詳細調整の設定が不正です');
 if(p.homeAiAuto!==undefined&&typeof p.homeAiAuto!=='boolean')throw new Error('AI自動更新の設定が不正です');
 if(p.gameMode!==undefined&&typeof p.gameMode!=='boolean')throw new Error('遊び要素の設定が不正です');
 if(s.homeBriefs!==undefined&&(!Array.isArray(s.homeBriefs)||s.homeBriefs.length>90||s.homeBriefs.some(r=>!r||!textOk(r.id)||!dateOk(r.date)||!['morning','afternoon','evening'].includes(r.phase)||typeof r.attemptedAt!=='string'||!Number.isFinite(Date.parse(r.attemptedAt))||(r.brief!==undefined&&(!validAdvice(r.brief)||typeof r.briefSignature!=='string'||r.briefSignature.length>100||typeof r.generatedAt!=='string'||!Number.isFinite(Date.parse(r.generatedAt))))||(r.error!==undefined&&(typeof r.error!=='string'||r.error.length>1000)))))throw new Error('AIアドバイスの保存形式が不正です');
 if(s.favorites!==undefined&&(!Array.isArray(s.favorites)||s.favorites.length>20000||s.favorites.some(id=>typeof id!=='string'||id.length>10000)))throw new Error('お気に入りデータが不正です');
 if(s.painDates!==undefined&&(!Array.isArray(s.painDates)||s.painDates.length>20000||!s.painDates.every(dateOk)))throw new Error('体調データが不正です');
 if(s.closedDays!==undefined&&(!s.closedDays||typeof s.closedDays!=='object'||Array.isArray(s.closedDays)||Object.entries(s.closedDays).some(([date,d])=>!dateOk(date)||!d||!finite(d.expenditure)||d.expenditure<500||d.expenditure>12000||!finite(d.weight)||d.weight<30||d.weight>300)))throw new Error('収支確定データが不正です');
 for(const key of ['foods','meals','weights','exercises','photos'] as const)if(!Array.isArray(s[key])||s[key].length>20000)throw new Error('記録形式が不正です');
 if(s.foods.some(f=>!nutritionOk(f)||![f.id,f.name,f.portion,f.category,f.source].every(textOk)||typeof f.estimated!=='boolean'||(f.steps!==undefined&&(!Array.isArray(f.steps)||!f.steps.every(textOk)))||(f.minutes!==undefined&&(!finite(f.minutes)||f.minutes<0))))throw new Error('食品データが不正です');
 if(s.meals.some(m=>!nutritionOk(m)||![m.id,m.name,m.slot,m.source].every(textOk)||!dateOk(m.date)||!finite(m.quantity)||m.quantity<=0||typeof m.estimated!=='boolean'||(m.alcoholG!==undefined&&(!finite(m.alcoholG)||m.alcoholG<0))))throw new Error('食事データが不正です');
 if(s.weights.some(w=>!textOk(w.id)||!dateOk(w.date)||!['朝','夜'].includes(w.time)||!finite(w.kg)||w.kg<30||w.kg>300||(w.waist!==undefined&&(!finite(w.waist)||w.waist<40||w.waist>250))||(w.body!==undefined&&!bodyOk(w.body))))throw new Error('体重データが不正です');
 if(s.exercises.some(e=>(e.met!==undefined&&(!finite(e.met)||e.met<1||e.met>12))||(e.netKcal!==undefined&&(!finite(e.netKcal)||e.netKcal<0||e.netKcal>6000))||![e.id,e.name,e.details].every(textOk)||!dateOk(e.date)||!finite(e.minutes)||e.minutes<=0||e.minutes>300))throw new Error('運動データが不正です');
 if(s.photos.some(p=>!textOk(p.id)||!dateOk(p.date)||typeof p.image!=='string'||p.image.length>3000000||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(p.image)))throw new Error('写真データが不正です');
 if(!s.contexts||typeof s.contexts!=='object'||Array.isArray(s.contexts)||Object.entries(s.contexts).some(([d,c])=>!dateOk(d)||!['在宅','出社','飲み会','休日'].includes(c))||(s.lastBackup!==null&&!dateOk(s.lastBackup)))throw new Error('日付データが不正です');return s;
}
