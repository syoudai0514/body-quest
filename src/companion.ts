import type {AppState,BriefPhase,HomeAdvice} from './types';
import type {HomeAction,homeReport} from './homeCoach';
import {latestRecord,offsetDate} from './domain';
import {slotForHour} from './history';
import {gameOn,levelInfo,todayXp,totalXp} from './game';

type Report=ReturnType<typeof homeReport>;
export type Focus={id:string;theme:string;headline:string;fact:string;mission:string;why:string;done:boolean;action?:HomeAction;question:string};
const phases:BriefPhase[]=['morning','afternoon','evening'];
export const COMPANION_VERSION=3;

// Only earlier/current periods, never future records. Old backups also provide useful language memory.
export function recentBriefs(state:AppState,date:string,phase:BriefPhase='evening') {
 return (state.homeBriefs??[]).filter(r=>r.brief&&r.date>=offsetDate(date,-7)&&(r.date<date||(r.date===date&&phases.indexOf(r.phase)<=phases.indexOf(phase))))
  .sort((a,b)=>b.date.localeCompare(a.date)||phases.indexOf(b.phase)-phases.indexOf(a.phase)).slice(0,6)
  .map(r=>({date:r.date,phase:r.phase,focusId:r.focusId,headline:r.brief!.headline,summary:r.brief!.summary,tips:r.brief!.tips}));
}

export function companion(state:AppState,report:Report,preferred?:string,avoid?:string|string[]) {
 const {date,phase}=report,game=gameOn(state.settings),start=offsetDate(date,-6),past=offsetDate(date,-13);
 const meals=state.meals.filter(m=>m.date>=start&&m.date<=date),exercises=state.exercises.filter(e=>e.date>=start&&e.date<=date);
 const days=new Set([...meals.map(m=>m.date),...state.weights.filter(w=>w.date>=start&&w.date<=date&&w.time==='朝').map(w=>w.date)]).size;
 const morningDays=new Set(state.weights.filter(w=>w.time==='朝'&&w.date>=start&&w.date<=date).map(w=>w.date)).size;
 const slot=slotForHour(phase==='morning'?8:phase==='afternoon'?13:19),logged=state.meals.some(m=>m.date===date&&m.slot===slot);
 const workout=exercises.filter(e=>e.date===date),pain=!!state.painDates?.includes(date),closed=!!state.closedDays?.[date];
 const memory=recentBriefs(state,date,phase),lv=levelInfo(totalXp(state,date)),xp=todayXp(state,date);
 const mealAction:HomeAction={kind:'meal',date,slot,label:`${slot}を確認して記録`,detail:'実際に食べた内容と量で記録'};
 const planAction:HomeAction={kind:'plan',date,label:'記録と計画を見る',detail:'確定した記録を確認'};
 const weightAction:HomeAction={kind:'weight',date,time:phase==='evening'?'夜':'朝',label:`${phase==='evening'?'夜':'朝'}の体重を記録`,detail:'測った値だけ。推測では埋めません'};
 const weightDone=!!latestRecord(state.weights,date,weightAction.time!);
 const candidates:Focus[]=[];
 const add=(f:Focus)=>candidates.push(f);
 const familiar=new Map<string,Set<string>>();
 for(const m of state.meals.filter(m=>m.date>=past&&m.date<date&&m.slot===slot)){const seen=familiar.get(m.name)??new Set<string>();seen.add(m.date);familiar.set(m.name,seen);}
 const usual=[...familiar].filter(([,d])=>d.size>=2).sort((a,b)=>b[1].size-a[1].size||a[0].localeCompare(b[0]))[0];
 const name=usual?.[0].slice(0,45);
 if(usual)add({id:'familiar',theme:'定番を味方に',headline:game?'いつもの装備、今日はどうする？':'いつもの食事から、今日を考えよう',fact:`過去13日間の${slot}に「${name}」を${usual[1].size}日記録しています。`,mission:logged?`${slot}の記録、できています`:`${slot}も「${name}」なら、量を確認して記録`,why:'定番は続けやすさの味方。違うものを食べた日は、その内容でOK。',done:logged,action:mealAction,question:`いつもの${slot}「${name}」を活かして、飽きないアレンジを1つ。確認済みの栄養値がなければ数値を創作しないで。`});
 if(meals.length)add({id:'discovery',theme:'食事の発見',headline:game?'食卓の図鑑、少しずつ増えている':'記録すると、食事の選択肢が見えてくる',fact:`直近7日間に記録した食品名は${new Set(meals.map(m=>m.name)).size}種類、食事を記録した日は${new Set(meals.map(m=>m.date)).size}日です。`,mission:logged?`${slot}の記録を見返してみよう`:`${slot}をひとつ、記録に残そう`,why:'種類の数は栄養バランスの採点ではありません。好きな食事を続ける工夫を見つけよう。',done:logged,action:mealAction,question:'最近の食事の好みを活かし、いつもの食材と違う選択肢を1つ。なぜ合うかも短く教えて。'});
 add({id:'rhythm',theme:'続ける力',headline:game?(days?'積み重ねが、冒険のセーブポイント':'最初のセーブポイントを作ろう'):(days?'続けられていることに目を向けよう':'今日の一歩を残そう'),fact:`直近7日間のうち${days}日、朝の体重か食事の記録があります。`,mission:weightDone?`${weightAction.time}の体重、記録できました`:`${weightAction.time}の体重を測ったら、ひとつ記録`,why:'空いた日があっても、積み重ねは消えません。今日は今日の一歩で十分。',done:weightDone,action:weightAction,question:'自分の記録から、続けられている良い習慣を1つ見つけて。次の一歩は小さく。'});
 add({id:'map',theme:'自分を知る',headline:game?'地図は、一度の数字より積み重ね':'自分の変化を、同じ条件で見よう',fact:`直近7日間の朝の体重は${morningDays}日分あります。`,mission:weightDone?`${weightAction.time}の測定値を記録済み`:`測っていたら${weightAction.time}の体重を記録`,why:phase==='evening'?'夜は朝と別に記録。食事や水分の影響もあるので、朝の平均と混ぜません。':'同じ時間帯で記録すると、1回の増減に振り回されず傾向を見られます。',done:weightDone,action:weightAction,question:'記録済みの朝の体重から分かることと、まだ分からないことを1つずつ教えて。'});
 if(!pain&&!report.tooFast)add({id:'movement',theme:'動き方を選ぶ',headline:game?(workout.length?'今日の行動、経験値になっている':'今日はどのルートで進もう？'):(workout.length?'今日の運動、記録できています':'暮らしに合う動き方を選ぼう'),fact:`直近7日間の運動記録は${new Set(exercises.map(e=>e.date)).size}日・合計${Math.round(exercises.reduce((n,e)=>n+e.minutes,0))}分です。`,mission:workout.length?`「${workout[0].name.slice(0,45)}」を記録済み`:state.settings.training?.mode==='walking'?'散歩や移動で歩いたら記録しよう':'今日のメニューを確認しよう',why:workout.length?'今日は実施した分を評価。さらに追加しなくて大丈夫。':'記録がない日は未実施とは限りません。体調と時間に合う選択を。',done:!!workout.length,action:workout.length?undefined:{kind:'training',date,label:'運動を見る',detail:'方針・体調に合うメニュー'},question:workout.length?'今日記録した運動の良かった点と、回復の過ごし方を短く教えて。':'運動方針と最近の記録を踏まえて、今日のメニューを1つ。痛み・疲労があれば回復を優先して。'});
 if(phase==='evening'||closed)add({id:'reflection',theme:'一日の収穫',headline:game?(closed?'今日の冒険、ちゃんと残せた':'今日は何を持ち帰ろう？'):(closed?'この日の記録を振り返ろう':'今日できたことを、ひとつ見つけよう'),fact:`この日は食事を${new Set(state.meals.filter(m=>m.date===date).map(m=>m.slot)).size}区分、運動を${workout.length}件記録しています。${closed?'収支も確定済みです。':'収支はまだ未確定です。'}`,mission:closed?'記録の締めくくり、完了':'食べたものを確認して、一日を締めくくろう',why:'点数や体重だけでなく、続けられた行動も振り返りの材料です。',done:closed,action:{...planAction,kind:'close',label:'この日の記録を確認'},question:'今日の記録から「できたこと」を1つ、明日試す小さな工夫を1つ。未記録を未実施と決めつけないで。'});
 if(workout.length||exercises.some(e=>e.date===offsetDate(date,-1))||pain||report.tooFast)add({id:'recovery',theme:'回復も前進',headline:game?'今日は回復の作戦会議':'回復を大切にする日もあっていい',fact:pain?'この日には痛みの記録があります。':report.tooFast?'朝の平均体重の減り方が速めです。':workout.length?`今日は「${workout[0].name.slice(0,45)}」の運動記録があります。`:'昨日の運動記録があります。',mission:pain?'痛みを誘発する動作をやめ、回復を相談':report.tooFast?'食事をさらに削らず、体調を確認':'疲れている部位と、今日の余力を確認しよう',why:pain?'運動の強度アップより体調が優先です。':report.tooFast?'速く減らすほど高評価、ではありません。':'回復も続けるための準備。疲労が不明なら、次の負荷を決める前に確認しよう。',done:false,question:pain?'今日は痛みの記録があります。負荷を上げずに、回復の過ごし方と受診の目安を教えて。':report.tooFast?'減量ペースが速いようです。食事を削らず、体調と計画で確認することを教えて。':'最近の運動記録に合わせ、回復の過ごし方を1つ教えて。次の筋トレは部位・疲労を確認して考えたい。'});
 const priority=pain||report.tooFast?'recovery':null;
 const order=phase==='morning'?['familiar','rhythm','map','discovery','movement','recovery','reflection']:phase==='afternoon'?['discovery','movement','familiar','rhythm','recovery','map','reflection']:['reflection','recovery','familiar','rhythm','movement','discovery','map'];
 // Least recently discussed topic first; ties follow the role of this time of day.
 const recency=(id:string)=>{const i=memory.findIndex(m=>m.focusId===id);return i<0?100:i;};
 const skip=new Set(typeof avoid==='string'?[avoid]:avoid??[]);
 const sorted=[...candidates].sort((a,b)=>recency(b.id)-recency(a.id)||order.indexOf(a.id)-order.indexOf(b.id));
 const focus=candidates.find(f=>f.id===priority)??candidates.find(f=>f.id===preferred&&!skip.has(f.id))??sorted.find(f=>!skip.has(f.id))??sorted.find(f=>f.id!==[...skip].at(-1))??sorted[0];
 const tone=state.settings.coachMode==='direct'?'次の一手は、これ。':state.settings.coachMode==='gentle'?'できそうなときに、一歩だけ。':'今日できる一歩を選ぼう。';
 const fallback:HomeAdvice={headline:focus.headline,summary:`${focus.fact}${focus.done?'記録できたことを、まず評価しよう。':tone}`,tips:[focus.why]};
 return {version:COMPANION_VERSION,game,focus,memory,priority,level:lv.level,rank:lv.title,xp,nextLevelXp:lv.need-lv.into,fallback};
}
