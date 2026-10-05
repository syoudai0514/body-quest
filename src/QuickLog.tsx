import {useState} from 'react';
import {Beef,Check,RotateCcw as History,Layers,Minus,Plus,Scale,Sparkles} from 'lucide-react';
import type {AppState,Food,Meal,Weight} from './types';
import {latestRecord,mealFromFood,offsetDate,today} from './domain';
import {planReady} from './planning';
import {copyMeals,mealFromHistory,mealHistory,mealSets,proteinAdvice,proteinPicks,proteinStatus,searchHistory,slots} from './history';
import {Empty} from './ui';

const fmt=(n:number)=>Math.round(n).toLocaleString('ja-JP');
const short=(date:string)=>date===today()?'今日':date===offsetDate(today(),-1)?'昨日':`${Number(date.slice(5,7))}/${Number(date.slice(8))}`;

export function QuickWeight({state,date,save,openFull,time='朝'}:{state:AppState;date:string;save:(w:Weight)=>void;openFull:()=>void;time?:Weight['time']}) {
 const existing=latestRecord(state.weights,date,time);
 const previousDate=state.weights.filter(w=>w.time===time&&w.date<date).reduce<string|null>((d,w)=>!d||w.date>d?w.date:d,null),previous=previousDate?latestRecord(state.weights,previousDate,time):undefined;
 const [kg,setKg]=useState((existing??previous)?.kg.toFixed(1)??''),[editing,setEditing]=useState(!existing);
 const value=Number(kg),valid=kg!==''&&Number.isFinite(value)&&value>=30&&value<=300,rounded=Math.round(value*10)/10;
 // Nudging needs a real starting value; never invent one.
 const step=(d:number)=>{if(valid)setKg((Math.round((value+d)*10)/10).toFixed(1));};
 const title=date===today()?(time==='朝'?'今朝の体重':'今夜の体重'):`${short(date)}の${time}の体重`;
 if(existing&&!editing)return <section className="card quick-weight compact"><Scale size={19}/><span><strong>{title} {existing.kg.toFixed(1)}<small> kg</small></strong><small>{previous?`前回 ${short(previous.date)} ${previous.kg.toFixed(1)}kg（${existing.kg-previous.kg>0?'+':''}${(existing.kg-previous.kg).toFixed(1)}kg）`:'記録済み'}{existing.waist?` · ウエスト ${existing.waist}cm`:''}{existing.body?.bodyFat!==undefined?` · 体脂肪 ${existing.body.bodyFat}%`:''}</small></span><span className="pill done-pill"><Check size={14}/>記録済み</span><button className="text-button" onClick={()=>setEditing(true)}>修正</button></section>;
 return <section className="card quick-weight"><div className="section-heading"><h2><Scale size={19}/>{title}</h2>{existing?<span className="pill done-pill"><Check size={14}/>記録済み</span>:<span className="pill">{time==='朝'?'起床後・トイレ後':'就寝前・同じ条件で'}</span>}</div>
  <form className="quick-weight-form" onSubmit={e=>{e.preventDefault();if(!valid)return;save({...existing,id:existing?.id??crypto.randomUUID(),date,time,kg:rounded});setEditing(false);}}>
   <button type="button" className="step-button" aria-label="0.1kg減らす" disabled={!valid} onClick={()=>step(-.1)}><Minus size={20}/></button>
   <label className="weight-input"><span className="sr-only">{time}の体重（kg）</span><input type="number" inputMode="decimal" min="30" max="300" step="0.1" value={kg} placeholder="00.0" onChange={e=>setKg(e.target.value)} aria-label={`${time}の体重（kg）`}/><small>kg</small></label>
   <button type="button" className="step-button" aria-label="0.1kg増やす" disabled={!valid} onClick={()=>step(.1)}><Plus size={20}/></button>
   <button className="primary" type="submit" disabled={!valid||existing?.kg===rounded}>{existing?`${time}の体重を更新`:`${time}の体重を保存`}</button>
  </form>
  <p className="muted quick-weight-note">{previous?<>前回 {short(previous.date)} {previous.kg.toFixed(1)}kg{valid?<b className={value-previous.kg>0?'up':'down'}>（{value-previous.kg>0?'+':''}{(value-previous.kg).toFixed(1)}kg）</b>:null}。±で微調整してそのまま保存。</>:'最初の一回は数字を入力。同じ時間・条件で測りましょう。'}<button type="button" className="text-button" onClick={openFull}>体組成・ウエストも記録</button></p>
 </section>;
}

export function HistoryPicker({state,date,slot,query='',add,addMany,compact=false}:{state:AppState;date:string;slot:string;query?:string;add:(m:Meal)=>void;addMany:(m:Meal[],label:string)=>void;compact?:boolean}) {
 const [tab,setTab]=useState<'often'|'recent'|'sets'>('often');
 const items=searchHistory(mealHistory(state,slot,date),query),recent=[...items].sort((a,b)=>b.lastDate.localeCompare(a.lastDate)),sets=mealSets(state,date).filter(s=>!query||s.meals.some(m=>m.name.includes(query)));
 const yesterday=state.meals.filter(m=>m.date===offsetDate(date,-1)&&m.slot===slot);
 const list=(tab==='recent'?recent:items).slice(0,compact?6:12);
 if(!items.length&&!yesterday.length)return compact?<Empty>食事を記録すると、よく食べるものがここに並び<br/>ワンタップで追加できます。</Empty>:null;
 return <div className="history-picker">
  {!compact?<div className="history-tabs" role="tablist">{([['often','よく食べる',History],['recent','最近',History],['sets','セット',Layers]] as const).map(([id,label,Icon])=><button type="button" role="tab" aria-selected={tab===id} key={id} className={tab===id?'active':''} onClick={()=>setTab(id)}><Icon size={14}/>{label}</button>)}</div>:null}
  {yesterday.length?<button type="button" className="copy-slot" onClick={()=>addMany(copyMeals(yesterday,date,slot),`前日の${slot}を追加しました`)}><Layers size={16}/><span><strong>前日の{slot}と同じ</strong><small>{yesterday.map(m=>m.name).join('・')} · {fmt(yesterday.reduce((s,m)=>s+m.kcal,0))} kcal</small></span><Plus size={18}/></button>:null}
  {tab==='sets'&&!compact?(sets.length?sets.map(s=><button type="button" className="copy-slot" key={s.key} onClick={()=>addMany(copyMeals(s.meals,date,slot),'セットを追加しました')}><Layers size={16}/><span><strong>{s.slot}のいつもの組み合わせ{s.count>1?`（${s.count}回）`:''}</strong><small>{s.meals.map(m=>m.name).join('・')} · {fmt(s.kcal)} kcal · P {Math.round(s.protein)}g</small></span><Plus size={18}/></button>):<Empty>同じ食事で2品以上を記録すると、組み合わせとして再利用できます。</Empty>)
  :<div className="history-chips">{list.map(h=><button type="button" key={h.key} className="history-chip" aria-label={`${h.name}をもう一度追加`} onClick={()=>add(mealFromHistory(h,date,slot))}><span><strong>{h.name}</strong><small>{h.quantity!==1?`×${h.quantity} · `:''}{fmt(h.kcal)} kcal · P {Math.round(h.protein)}g{h.count>1?` · ${h.count}回`:''}{tab==='recent'?` · ${short(h.lastDate)}`:''}</small></span><Plus size={16}/></button>)}{!list.length&&query?<Empty>履歴に「{query}」はありません。</Empty>:null}</div>}
 </div>;
}

export function ProteinCard({state,date,slot,add,consult}:{state:AppState;date:string;slot:string;add:(m:Meal)=>void;consult:(q:string)=>void}) {
 const p=proteinStatus(state,date),picks=proteinPicks(state,date),trained=state.exercises.some(e=>e.date===date);
 return <section className="card protein-card"><div className="section-heading"><h2><Beef size={19}/>たんぱく質</h2><span className="pill">{planReady(state.settings)?`1食 ${p.perMeal}g目安`:'目標未設定・仮の目安'}</span></div>
  <div className="protein-meter"><strong>{Math.round(p.eaten)}<small> / {p.target} g</small></strong><span>{p.remaining>0?`あと ${Math.round(p.remaining)} g`:'目標達成'}</span></div>
  <div className="bar"><span className="bar-protein" style={{width:`${p.ratio*100}%`}}/></div>
  <div className="protein-slots">{slots.map(s=><span key={s} className={p.bySlot[s]>=p.perMeal?'hit':''}>{s.replace('食','')} {Math.round(p.bySlot[s])}g</span>)}</div>
  <p className="tip-line">{proteinAdvice(state,date,trained)}</p>
  {p.remaining>0&&picks.length?<><p className="muted picks-label">ワンタップで{slot}に追加</p><div className="protein-picks">{picks.map((f:Food)=><button key={f.id} className="history-chip" aria-label={`${f.name}を追加（たんぱく質${Math.round(f.protein)}g）`} onClick={()=>add(mealFromFood(f,date,slot))}><span><strong>{f.name}</strong><small>P {Math.round(f.protein)}g · {fmt(f.kcal)} kcal</small></span><Plus size={16}/></button>)}</div></>:null}
  <details className="protein-guide"><summary>プロテインの上手な使い方</summary><ul>
   <li>食事で{p.perMeal}g前後に届かない食事や、筋トレの日の補助に1杯（約20g）。必須ではなく、食事の置き換えにはしません。</li>
   <li>おすすめのタイミング：たんぱく質が少なくなりがちな朝食・間食、運動後の食事が遅くなるとき。</li>
   <li>選び方：1杯のたんぱく質量・カロリー・糖質を表示で確認。水や無糖の飲み物で割ると低カロリー。</li>
   <li>腎臓の病気などでたんぱく質の制限を受けている場合は、事前に医師へ相談してください。</li>
  </ul></details>
  <button className="secondary" onClick={()=>consult(`残り${fmt(Math.max(0,p.kcalLeft))}kcalで、たんぱく質をあと${Math.round(p.remaining)}g取れる次の食事を具体的に提案して`)}><Sparkles size={16}/>残りで食べるものをAIに相談</button>
 </section>;
}

