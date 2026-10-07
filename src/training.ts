import type {AppState, Exercise} from './types';
import {daysBetween, offsetDate} from './domain';

export type Move = {name:string;dose:string;cue:string};
export type Place = '家'|'ジム'|'外'|'回復';
export type Menu = {id:string;name:string;place:Place;minutes:number;met:number;strength:boolean;focus:string;moves:Move[]};

export const menus: Menu[] = [
 {id:'home10',name:'家で10分',place:'家',minutes:10,met:3.5,strength:true,focus:'全身・はじめの一歩',moves:[
  {name:'椅子スクワット',dose:'10〜12回 × 2',cue:'椅子にお尻が軽く触れたら立つ。膝はつま先と同じ向き'},
  {name:'壁・台に手をついた腕立て',dose:'8〜12回 × 2',cue:'頭からかかとまで一直線。楽になったら台を低く'},
  {name:'ヒップリフト',dose:'12回 × 2',cue:'お尻を締めて持ち上げ、腰は反らさない'},
  {name:'バードドッグ',dose:'左右5回 × 2',cue:'痛みのない範囲でゆっくり。腰を反らさない'}]},
 {id:'home20',name:'家で20分・下半身と体幹',place:'家',minutes:20,met:3.5,strength:true,focus:'大きな筋肉で消費を底上げ',moves:[
  {name:'スクワット',dose:'12〜15回 × 3',cue:'お尻を後ろへ引き、太ももが床と平行の手前まで'},
  {name:'リバースランジ',dose:'左右8回 × 2',cue:'前の膝が内側に入らないように。不安定なら壁に手を'},
  {name:'ヒップリフト',dose:'15回 × 2',cue:'上で1秒止める'},
  {name:'カーフレイズ',dose:'15〜20回 × 2',cue:'かかとをゆっくり下ろす'},
  {name:'膝つきサイドプランク',dose:'左右20秒 × 2',cue:'腰に痛みが出たら中止'}]},
 {id:'home-upper',name:'家で15分・上半身',place:'家',minutes:15,met:3.5,strength:true,focus:'胸・背中・肩',moves:[
  {name:'腕立て伏せ（膝つき可）',dose:'8〜12回 × 3',cue:'胸を床に近づけ、肘は体から45度ほど'},
  {name:'ワンハンドロー（ダンベル・水入りペットボトル）',dose:'左右10〜12回 × 3',cue:'机に手をつき背中を丸めない。肘を腰へ引く'},
  {name:'座ってショルダープレス',dose:'10〜12回 × 2',cue:'腰を反らさず、耳の横まで上げる'},
  {name:'プランク',dose:'20〜30秒 × 2',cue:'お尻を上げすぎず下げすぎず'}]},
 {id:'gym-a',name:'ジムで30分・全身A（押す）',place:'ジム',minutes:30,met:3.5,strength:true,focus:'脚・胸・肩',moves:[
  {name:'バイクで準備',dose:'5分',cue:'軽く息が上がる程度'},
  {name:'レッグプレス',dose:'8〜12回 × 3',cue:'腰がシートから浮かない深さまで'},
  {name:'チェストプレス',dose:'8〜12回 × 3',cue:'肩をすくめず、胸で押す'},
  {name:'ショルダープレス',dose:'10〜12回 × 2',cue:'背もたれに背中をつける'},
  {name:'プランク',dose:'30秒 × 2',cue:'腰が反るなら膝をつく'}]},
 {id:'gym-b',name:'ジムで30分・全身B（引く）',place:'ジム',minutes:30,met:3.5,strength:true,focus:'背中・脚の裏側',moves:[
  {name:'バイクで準備',dose:'5分',cue:'軽く息が上がる程度'},
  {name:'ラットプルダウン',dose:'8〜12回 × 3',cue:'胸を張り、鎖骨へ向かって引く'},
  {name:'シーテッドロー',dose:'10〜12回 × 3',cue:'背中を丸めず、肩甲骨を寄せる'},
  {name:'レッグカール',dose:'10〜12回 × 2',cue:'反動を使わずゆっくり戻す'},
  {name:'ヒップアブダクション',dose:'15回 × 2',cue:'お尻の横を意識'}]},
 {id:'walk',name:'早歩き30分',place:'外',minutes:30,met:4,strength:false,focus:'有酸素・回復日にも',moves:[
  {name:'早歩き',dose:'20〜30分',cue:'会話はできるが少し息が弾む速さ'},
  {name:'階段・坂道',dose:'できる範囲で',cue:'膝や腰に痛みが出たら平地に'}]},
 {id:'recovery',name:'回復・ストレッチ10分',place:'回復',minutes:10,met:2.5,strength:false,focus:'筋トレの翌日・疲れた日',moves:[
  {name:'胸・肩のストレッチ',dose:'各30秒 × 2',cue:'反動をつけない'},
  {name:'もも裏・お尻のストレッチ',dose:'左右30秒 × 2',cue:'気持ちよく伸びる範囲で'},
  {name:'ゆっくり深呼吸',dose:'1〜2分',cue:'リラックスして終える'}]},
];
menus.push(
 {id:'walk-easy',name:'ゆるウォーキング20分',place:'外',minutes:20,met:2.8,strength:false,focus:'通勤・散歩・日常の活動',moves:[{name:'ゆっくり歩く',dose:'10〜20分',cue:'会話が楽にできるペース。実際に歩いた時間を記録'}]},
 {id:'gym-upper',name:'ジム本格・上半身',place:'ジム',minutes:60,met:3.5,strength:true,focus:'胸・背中・肩・腕／下半身と交互に',moves:[
  {name:'ベンチプレス',dose:'6〜10回 × 3',cue:'準備セットを別に行う。重いフリーウェイトはセーフティか補助者を利用'},
  {name:'ラットプルダウン',dose:'8〜12回 × 3',cue:'反動を使わず、同じ可動域で'},
  {name:'ダンベルショルダープレス',dose:'8〜12回 × 2',cue:'腰を反らさず、無理のない範囲で'},
  {name:'シーテッドロー',dose:'8〜12回 × 3',cue:'腰を固定し、背中で引く'},
  {name:'サイドレイズ',dose:'12〜15回 × 2',cue:'肩に痛みが出ない範囲で'}]},
 {id:'gym-lower',name:'ジム本格・下半身',place:'ジム',minutes:60,met:3.5,strength:true,focus:'脚・お尻／上半身と交互に',moves:[
  {name:'スクワット',dose:'6〜10回 × 3',cue:'セーフティをセット。フォームと可動域を優先'},
  {name:'レッグプレス',dose:'8〜12回 × 3',cue:'腰が浮かない深さで'},
  {name:'レッグカール',dose:'10〜15回 × 3',cue:'反動を使わず'},
  {name:'カーフレイズ',dose:'12〜20回 × 3',cue:'下ろす動きもゆっくり'}]}
);

export const painMenu: Menu = {id:'pain',name:'回復を優先',place:'回復',minutes:5,met:1,strength:false,focus:'腰に痛みがある日',moves:[
 {name:'痛みを誘発する動作と腹筋ローラーは休止',dose:'',cue:''},
 {name:'楽な姿勢や、痛みのない範囲の軽い動きにとどめる',dose:'',cue:''},
 {name:'痛みの増悪・脚のしびれや脱力があれば受診。排尿排便の異常は速やかに医療機関へ',dose:'',cue:''}]};

export const menuSteps = (m:Menu) => m.moves.map(x=>[x.name,x.dose].filter(Boolean).join(' '));
const strengthNames = new Set(menus.filter(m=>m.strength).map(m=>m.name));
export const isStrength = (e:Exercise) => e.kind!==undefined?e.kind==='strength':!!e.sets?.length||strengthNames.has(e.name)||/筋トレ|トレーニング|ジム|スクワット|腕立て|プレス|ダンベル|ベンチ/.test(e.name);

export function trainingWeek(state:AppState,date:string) {
 const weekday=(new Date(date+'T12:00:00').getDay()+6)%7,from=offsetDate(date,-weekday);
 const week=state.exercises.filter(e=>e.date>=from&&e.date<=date);
 return {from,strengthDays:new Set(week.filter(isStrength).map(e=>e.date)).size,minutes:week.reduce((s,e)=>s+e.minutes,0),target:state.settings.training?.mode==='walking'?0:state.settings.training?.weeklyDays??2,maximum:state.settings.training?.mode==='walking'?0:state.settings.training?.weeklyDays??3};
}
export function lastSession(state:AppState,name:string,before:string) {
 return state.exercises.filter(e=>e.name===name&&e.date<before).sort((a,b)=>b.date.localeCompare(a.date))[0];
}
const byId = (id:string) => menus.find(m=>m.id===id)!;
function alternate(state:AppState,date:string,ids:string[]) {
 const names=ids.map(id=>byId(id).name),last=state.exercises.filter(e=>names.includes(e.name)&&e.date<=date).sort((a,b)=>b.date.localeCompare(a.date))[0];
 return byId(last?ids[(names.indexOf(last.name)+1)%ids.length]:ids[0]);
}
export function recommendMenu(state:AppState,date:string,context:string,pain:boolean):{menu:Menu;reason:string} {
 if(pain)return {menu:painMenu,reason:'痛みがある日は休むのも計画のうち。'};
 const today=state.exercises.filter(e=>e.date===date),week=trainingWeek(state,date);
 const lastStrength=state.exercises.filter(e=>isStrength(e)&&e.date<date).sort((a,b)=>b.date.localeCompare(a.date))[0];
 if(today.some(isStrength))return {menu:byId('recovery'),reason:'今日の筋トレは記録済み。ストレッチで締めくくり、たんぱく質を取りましょう。'};
 const profile=state.settings.training;
 if(context==='飲み会')return {menu:byId(profile?'walk-easy':'walk'),reason:'飲み会の日は軽い歩行で。飲酒後の運動は避けましょう。'};
 if(profile?.mode==='walking')return {menu:byId('walk-easy'),reason:'通勤の1駅分や散歩も運動です。距離を決めつけず、実際に歩いた時間で記録しましょう。'};
 if(profile?.mode==='advanced'){
  const menu=alternate(state,date,['gym-upper','gym-lower']);
  // Split sessions can train different muscles on consecutive days; unknown older/custom sessions require recovery first.
  const same=state.exercises.filter(e=>e.date<date&&e.name===menu.name).sort((a,b)=>b.date.localeCompare(a.date))[0];
  const unknownRecent=lastStrength&&daysBetween(lastStrength.date,date)<=1&&!['gym-upper','gym-lower'].some(id=>byId(id).name===lastStrength.name);
  if(unknownRecent||(same&&daysBetween(same.date,date)<=1))return {menu:byId('walk-easy'),reason:'直近の筋トレと部位が重なる、または部位を確認できません。今日は回復を優先し、分割や疲労はAIにも相談できます。'};
  if(week.strengthDays>=week.target)return {menu:byId('recovery'),reason:`予定の週${week.target}回を達成。さらに行う場合は部位ごとの回復と疲労を確認してメニューを選びましょう。`};
  return {menu:{...menu,minutes:profile.minutes},reason:`${profile.goal==='strength'?'筋力向上':profile.goal==='hypertrophy'?'筋肥大':'体力づくり'}を意識した上半身／下半身の分割例。週${week.target}回の予定に合わせ、同じ部位の回復と前回のセット記録を確認。種目・量は調整できます。`};
 }
 if(lastStrength&&daysBetween(lastStrength.date,date)<=1)return {menu:byId('walk'),reason:'昨日は筋トレの日。同じ筋肉は48時間ほど休ませ、今日は軽い有酸素で。'};
 if(week.strengthDays>=week.maximum)return {menu:byId('walk'),reason:`今週の筋トレは目安の${week.maximum}回に到達。回復と有酸素で調整しましょう。`};
 const home=profile?profile.mode==='home':context==='在宅';
 const menu=home?(state.exercises.some(e=>e.name===byId('home10').name)?alternate(state,date,['home20','home-upper']):byId('home10')):alternate(state,date,['gym-a','gym-b']);
 const left=Math.max(0,week.target-week.strengthDays);
 return {menu,reason:left?`今週の筋トレはあと${left}回が目安（週${week.target}${week.maximum!==week.target?`〜${week.maximum}`:''}回）。${lastStrength?`前回は${lastStrength.date.slice(5).replace('-','/')}。`:'まずは軽めの重さから。'}`:'週の目安は達成。余裕があればもう1回、疲れていれば休養を。'};
}
export function progressionTip(previous:Exercise|undefined) {
 if(!previous)return 'あと2〜3回できる重さ・回数で。フォームが崩れる前に終了。';
 return `前回（${previous.date.slice(5).replace('-','/')}）の記録をもとに、全セットで回数の上限までできた種目は回数を1回増やすか重さを少し（2.5〜5%）上げましょう。`;
}
