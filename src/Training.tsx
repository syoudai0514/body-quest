import {TrainingPreferences} from './TrainingProfile';
import {SetEditor,SetReview,SetSummary,blankSet,draftsFrom,parseSet,type SetDraft} from './StrengthLog';
import {validSets,setText} from './workoutData';
import {useState} from 'react';
import {Check,Dumbbell,Mic,Repeat,Sparkles,Trash2} from 'lucide-react';
import {askAi,exerciseAiContext,type ExerciseDraft} from './ai';
import type {AppState,Exercise,ExerciseKind} from './types';
import {offsetDate} from './domain';
import {netExercise,profileOf,weightAt} from './energy';
import {planReady} from './planning';
import {lastSession,menus,menuSteps,painMenu,progressionTip,recommendMenu,trainingWeek,type Menu,type Place} from './training';
import {Field} from './ui';

type Props={state:AppState;date:string;context:string;online:boolean;update:(fn:(s:AppState)=>AppState)=>void;notify:(text:string)=>void;consult:(q:string)=>void};
type WalkingPreset={name:string;minutes:number;met:number};
function WalkingShortcuts({state,date,choose}:{state:AppState;date:string;choose:(preset:WalkingPreset)=>void}) {
 return <section className="card walking-shortcuts"><div className="section-heading"><h2>日常の移動も、運動に</h2><span className="pill">時間で記録</span></div><div className="walk-quick-grid">{[{name:'1駅分歩く',minutes:15,met:2.8},{name:'ゆるウォーキング',minutes:20,met:2.8},{name:'早歩き',minutes:30,met:4},{name:'バイク',minutes:20,met:4}].map(w=><button key={w.name} onClick={()=>choose(w)}><strong>{w.name}</strong><small>{w.minutes}分から調整 · {planReady(state.settings)?`追加消費 約${Math.round(netExercise(w.met,w.minutes,weightAt(state,date)))}kcal`:'プロフィール設定で消費を計算'}</small></button>)}</div><p className="muted">時間は入力のスタート値です。実際に歩いた時間・ペースに直して保存。消費は安静時との差分の推定で、食事目標を自動で増やしません。</p></section>;
}
const places:(Place|'すべて')[]=['すべて','家','ジム','外','回復'];

// Say what you did ("chest press 30kg 10x3, bike 20 min"); the AI turns it into records to confirm before saving.
type EditableDraft=ExerciseDraft&{draftSets?:SetDraft[]};
function ExerciseAi({state,date,online,save}:{state:AppState;date:string;online:boolean;save:(list:ExerciseDraft[])=>void}) {
 const [text,setText]=useState(''),[drafts,setDrafts]=useState<EditableDraft[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[readFor,setReadFor]=useState(date);
 const shown=readFor===date?drafts:[];
 const edit=(i:number,patch:Partial<EditableDraft>)=>setDrafts(drafts.map((d,j)=>j===i?{...d,...patch}:d));
 const valid=(d:EditableDraft)=>!!d.name.trim()&&d.minutes>=1&&d.minutes<=300&&d.met>=1&&d.met<=12&&(!d.draftSets||validSets(d.draftSets.map(parseSet)));
 async function read() {setBusy(true);setError('');try{const r=await askAi('exercise',text,exerciseAiContext(state,date,menus.map(m=>m.name)));setReadFor(date);setDrafts((r.exercises??[]).map(d=>({...d,...(d.sets?.length?{draftSets:draftsFrom(d.sets)}:{})})));if(!r.exercises?.length)setError('運動を読み取れませんでした。種目・時間・回数などを具体的に書いてください。');}catch(e){setError(e instanceof Error?e.message:'AIを利用できません');}finally{setBusy(false);}}
 const commit=(list:EditableDraft[])=>{if(list.some(d=>!valid(d))){setError('運動名・時間・強度と、セットの種目・重量・回数を確認してください');return;}save(list.map(d=>({...d,...(d.draftSets?{sets:d.draftSets.map(parseSet)}:{})})));setDrafts(drafts.filter(d=>!list.includes(d)));if(list.length===shown.length)setText('');};
 return <section className="card exercise-ai"><div className="section-heading"><h2><Mic size={19}/>やったことを伝えて記録</h2><span className="pill">Gemini</span></div>
  {shown.length?<details className="exercise-read-again"><summary>入力文を確認・読み直す</summary>  <Field label="やった運動"><textarea rows={3} maxLength={3000} value={text} onChange={e=>setText(e.target.value)} placeholder="例：ジムでチェストプレス30kg×10回×3、ラットプルダウン25kg、最後にバイク20分。腰は問題なし"/></Field>
  <p className="muted">キーボードのマイクで話して入力できます。送信すると文章・運動の方針・最近の運動記録がGoogle Geminiに送られます。読み取り結果を確認してから記録します。</p>
  <button className="primary" disabled={busy||!text.trim()||!online} onClick={read}><Sparkles size={18}/>{busy?'読み取り中…':'AIで読み取る'}</button>
</details>:<>  <Field label="やった運動"><textarea rows={3} maxLength={3000} value={text} onChange={e=>setText(e.target.value)} placeholder="例：ジムでチェストプレス30kg×10回×3、ラットプルダウン25kg、最後にバイク20分。腰は問題なし"/></Field>
  <p className="muted">キーボードのマイクで話して入力できます。送信すると文章・運動の方針・最近の運動記録がGoogle Geminiに送られます。読み取り結果を確認してから記録します。</p>
  <button className="primary" disabled={busy||!text.trim()||!online} onClick={read}><Sparkles size={18}/>{busy?'読み取り中…':'AIで読み取る'}</button>
</>}
  {error?<p className="error" role="alert">{error}</p>:null}
  {shown.map((d,i)=><div className="draft exercise-draft" key={i}>
   <div className="exercise-result-heading"><h3>{d.name}</h3><span className="pill">{d.minutes}分</span></div>
   {d.draftSets&&validSets(d.draftSets.map(parseSet))?<SetReview sets={d.draftSets.map(parseSet)}/>:<p className="muted preline">{d.details}</p>}
   {d.note?<p className="muted exercise-estimate-note">{d.note}</p>:null}
   <details className="exercise-draft-edit"><summary>内容を修正</summary>
    <Field label="運動名"><input value={d.name} maxLength={150} onChange={e=>edit(i,{name:e.target.value})}/></Field>
    <div className="form-grid"><Field label="実施時間（分）"><input type="number" min="1" max="300" value={d.minutes} onChange={e=>edit(i,{minutes:Number(e.target.value)})}/></Field><Field label="強度（METs）"><input type="number" min="1" max="12" step="0.1" value={d.met} onChange={e=>edit(i,{met:Number(e.target.value)})}/></Field></div>
    {d.draftSets?<SetEditor sets={d.draftSets} change={draftSets=>edit(i,{draftSets})}/>:null}
    <Field label="内容・体調メモ"><textarea rows={2} maxLength={3000} value={d.details} onChange={e=>edit(i,{details:e.target.value})}/></Field>
   </details>
   <p className="muted exercise-net-note">追加消費：{planReady(state.settings)?`約${Math.round(netExercise(d.met,d.minutes,weightAt(state,date)))} kcal（推定）`:'プロフィール設定後に計算'}</p>
   <button className={shown.length===1?'primary':'secondary'} onClick={()=>commit([d])}><Check size={16}/>確認して記録</button>
  </div>)}
  {shown.length>1?<button className="primary" onClick={()=>commit(shown)}><Check size={18}/>{shown.length}件をまとめて記録</button>:null}
 </section>;
}

export function TrainingPage({state,date,context,online,update,notify,consult}:Props) {
 const pain=!!state.painDates?.includes(date),setPain=(on:boolean)=>update(s=>({...s,painDates:on?[...new Set([...(s.painDates??[]),date])]:(s.painDates??[]).filter(d=>d!==date)})),[place,setPlace]=useState<Place|'すべて'>(()=>state.settings.training?.mode==='walking'?'外':state.settings.training?.mode==='home'?'家':state.settings.training?'ジム':'すべて'),[open,setOpen]=useState<string|null>(null);
 const [name,setName]=useState('家で10分'),[minutes,setMinutes]=useState(10),[details,setDetails]=useState(''),[met,setMet]=useState(1),[kind,setKind]=useState<ExerciseKind>('strength'),[sets,setSets]=useState<SetDraft[]>([]),[setError,setSetError]=useState(''),[editingId,setEditingId]=useState<string|null>(null);
 const {menu:recommended,reason}=recommendMenu(state,date,context,pain),week=trainingWeek(state,date);
 const shown=pain?[painMenu]:menus.filter(m=>place==='すべて'||m.place===place);
 const recent=state.exercises.filter(e=>e.date<date&&e.date>=offsetDate(date,-14)).sort((a,b)=>b.date.localeCompare(a.date)).filter((e,i,all)=>all.findIndex(x=>x.name===e.name)===i).slice(0,5);
 const choose=(m:Menu)=>{const previous=lastSession(state,m.name,date);setEditingId(null);setSets(previous?.sets?.length?draftsFrom(previous.sets):state.settings.training?.mode==='advanced'&&m.strength?[blankSet(m.moves.find(x=>x.dose.includes('回'))?.name??'')]:[]);setSetError('');setKind(m.strength?'strength':m.place==='回復'?'mobility':'cardio');setName(m.name);setMinutes(m.minutes);setMet(m.met>1?m.met:1);setDetails(previous?.details||menuSteps(m).join('\n'));document.getElementById('exercise-form')?.scrollIntoView({behavior:'smooth'});};
 const record=(e:Omit<Exercise,'id'|'date'>,label='運動を記録しました')=>{update(s=>({...s,exercises:[...s.exercises,{...e,id:crypto.randomUUID(),date,...(e.met&&e.met>1&&planReady(s.settings)?{netKcal:netExercise(e.met,e.minutes,weightAt(s,date))}:{})}]}));notify(label);};
 const chooseWalking=(w:WalkingPreset)=>{setEditingId(null);setName(w.name);setMinutes(w.minutes);setMet(w.met);setKind('cardio');setSets([]);setDetails('');setSetError('');document.getElementById('exercise-form')?.scrollIntoView({behavior:'smooth'});};
 const included=profileOf(state.settings).exerciseMode==='included';
 const card=(m:Menu,highlight=false)=>{const previous=lastSession(state,m.name,date),expanded=highlight||open===m.id||pain;return <div className={`training-plan ${highlight?'recommended':''}`} key={m.id+(highlight?'-top':'')}>
  <div><Dumbbell size={22}/><span className="pill">{m.place} · {m.minutes}分</span></div>
  <h3>{m.name}</h3><p className="muted">{m.focus}</p>
  {expanded?<><ol className="move-steps">{m.moves.map(x=><li key={x.name}><strong>{x.name}</strong>{x.dose?<b> {x.dose}</b>:null}{x.cue?<small>{x.cue}</small>:null}</li>)}</ol>
   {m.strength?<p className="tip-line">{progressionTip(previous)}</p>:null}
   {previous?<p className="muted preline">前回の記録：{previous.details||'詳細なし'}</p>:null}
   <button className="secondary" onClick={()=>choose(m)}>このメニューを記録する</button></>
  :<button className="text-button" aria-expanded={false} onClick={()=>setOpen(m.id)}>種目を見る</button>}
 </div>;};
 const saveAi=(list:ExerciseDraft[])=>{update(s=>({...s,exercises:[...s.exercises,...list.map(d=>({id:crypto.randomUUID(),date,name:d.name.trim(),minutes:Math.round(d.minutes),details:d.details,kind:d.kind??(/筋トレ|プレス|ダンベル|ベンチ/.test(d.name)?'strength':/ストレッチ|体操/.test(d.name)?'mobility':'cardio'),...(d.sets?.length?{sets:d.sets}:{}),...(d.met>1?{met:d.met,...(planReady(s.settings)?{netKcal:netExercise(d.met,d.minutes,weightAt(s,date))}:{})}:{})}))]}));notify(list.length>1?`${list.length}件の運動を記録しました`:`${list[0].name}を記録しました`);};
 return <>
  <TrainingPreferences state={state} save={training=>{setPlace(training.mode==='walking'?'外':training.mode==='home'?'家':'ジム');update(s=>({...s,settings:{...s.settings,training}}));}}/>
  {state.settings.training?.mode==='advanced'?<details className="training-cardio-fold"><summary>通勤・有酸素も記録する</summary><WalkingShortcuts state={state} date={date} choose={chooseWalking}/></details>:<WalkingShortcuts state={state} date={date} choose={chooseWalking}/>}
  <ExerciseAi state={state} date={date} online={online} save={saveAi}/>
  <section className="card training-hero"><div className="section-heading"><h2><Sparkles size={19}/>今日のおすすめ</h2><span className="pill">{context}</span></div>
   <div className="plan-stats">{state.settings.training?.mode==='walking'?<div><span>歩くスタイル</span><strong>続ける<small> 通勤や散歩もOK</small></strong></div>:<div><span>今週の筋トレ</span><strong>{week.strengthDays}<small> / 週{week.target}{week.maximum!==week.target?`〜${week.maximum}`:''}回</small></strong></div>}<div><span>今週の運動時間</span><strong>{week.minutes}<small> 分</small></strong></div></div>
   <label className="check"><input type="checkbox" checked={pain} onChange={e=>setPain(e.target.checked)}/>今日は腰に痛みがある</label>
   <p>{reason}</p>
   <div className="training-grid">{card(recommended,true)}</div>
   <button className="text-button" onClick={()=>consult(pain?'今日は腰に痛みがあります。悪化させないために避けるべき動作と、今日できる回復のための過ごし方を教えて。受診の目安も知りたい':`今週の筋トレ${week.strengthDays}回、前回までの記録をもとに、今日の${context}の日に合うメニューを、設定した運動スタイル・目的・週の予定とセット履歴を使って、種目・重量の決め方・回数・セット・休憩・RIRの目安つきで提案して`)}><Sparkles size={15}/>{pain?'痛みがある日の過ごし方をAIに相談':'AIにメニューを組んでもらう'}</button>
  </section>
  <details className="card training-library"><summary>メニューから選ぶ<span>自宅・ジム・歩行</span></summary><div className="training-library-body">
   {!pain?<div className="filter-chips">{places.map(p=><button key={p} className={place===p?'selected':''} onClick={()=>setPlace(p)}>{p}</button>)}</div>:null}
   <div className="training-grid">{shown.filter(m=>m.id!==recommended.id||pain).map(m=>card(m))}</div>
   <p className="muted">回数は「あと2〜3回できる」重さで。フォームが崩れる前に終了し、痛みが出たら中止。{state.settings.backPain?'腹筋ローラーは腰を反らさず、痛みがあれば休止。':''}運動の消費は推定として記録し、食事目標を自動で増やしません。</p>
  </div></details>
  {recent.length?<details className="card training-recent"><summary><Repeat size={18}/>最近の運動をくり返す<span>{recent.length}件</span></summary>{recent.map(e=><div className="record-row" key={e.id}><Dumbbell size={18}/><span><strong>{e.name} · {e.minutes}分</strong><small>{e.date.slice(5).replace('-','/')}{e.met?` · ${e.met} METs`:''}</small>{e.details?<small className="preline">{e.details}</small>:null}{e.sets?.length?<details><summary>前回のセット（{e.sets.length}件）</summary><p className="preline">{setText(e.sets)}</p></details>:null}</span><button className="secondary compact" aria-label={`${e.name}を同じ内容で記録`} onClick={()=>record({name:e.name,minutes:e.minutes,details:e.details,...(e.kind?{kind:e.kind}:{}),...(e.sets?{sets:e.sets}:{}),...(e.met?{met:e.met}:{})},'同じ内容で記録しました')}><Check size={15}/>同じ内容</button></div>)}</details>:null}
  <section className="card" id="exercise-form"><h2>運動を記録</h2>
   <form onSubmit={e=>{e.preventDefault();const parsed=kind==='strength'?sets.map(parseSet):[];if(!validSets(parsed)){setSetError('セットの種目・重量・回数・RIRを確認してください');return;}if(editingId&&!state.exercises.some(x=>x.id===editingId&&x.date===date)){setSetError('この記録は削除されています。修正をやめて、新しく記録してください');return;}if(editingId){update(s=>({...s,exercises:s.exercises.map(e=>e.id===editingId?{...e,name,minutes,details,kind,sets:kind==='strength'?parsed:undefined,met,...(planReady(s.settings)?{netKcal:netExercise(met,minutes,weightAt(s,date))}:{})}:e)}));notify('運動の記録を更新しました');setEditingId(null);}else record({name,minutes,details,kind,...(parsed.length?{sets:parsed}:{}),...(met>1?{met}:{})},'運動を記録しました');setDetails('');setSets([]);setSetError('');}}>
    <div className="form-grid"><Field label="運動・メニュー"><input value={name} onChange={e=>setName(e.target.value)} required maxLength={150}/></Field><Field label="時間（分）"><input type="number" min="1" max="300" required value={minutes} onChange={e=>setMinutes(Number(e.target.value))}/></Field></div>
    <div className="segmented exercise-kind" aria-label="運動の種類">{([['cardio','歩く・有酸素'],['strength','筋トレ'],['mobility','回復・ストレッチ']] as const).map(([id,label])=><button key={id} type="button" aria-pressed={kind===id} className={kind===id?'active':''} onClick={()=>{setKind(id);setSetError('');}}>{label}</button>)}</div>
    <Field label="運動強度・消費の目安"><select aria-label="運動強度・消費の目安" value={met} onChange={e=>setMet(Number(e.target.value))}><option value="1">消費を加算しない・不明</option><option value="2.5">軽い体操・ストレッチ・2.5 METs目安</option><option value="2.8">ゆっくり歩行・2.8 METs目安</option><option value="3.5">一般的な筋トレ・3.5 METs目安</option><option value="4">早歩き・軽〜中程度のバイク・4 METs目安</option><option value="5">休憩の短いサーキット・5 METs目安</option><option value="6">強めのバイク・6 METs目安</option></select></Field>
    <p className="muted">安静時との差分：{planReady(state.settings)?`約${Math.round(netExercise(met,minutes,weightAt(state,date)))} kcal`:'プロフィール設定後に計算'}。休憩を含む実際の強度で選択。{included?'現在は活動係数に運動込みなので、収支への追加加算はしません。':'「別途加算」設定では収支の推定消費に含みます。'}同じ運動を重複登録しないでください。</p>
    <Field label="回数・セット・重量・体調（任意）"><textarea value={details} rows={4} maxLength={3000} placeholder="チェストプレス20kg、10回×2。腰の痛みなし。" onChange={e=>setDetails(e.target.value)}/></Field>
    {kind==='strength'?<><SetEditor sets={sets} change={setSets}/>{sets.length>0&&validSets(sets.map(parseSet))?<SetSummary sets={sets.map(parseSet)} history={state.exercises} date={date}/>:null}</>:null}{setError?<p className="error" role="alert">{setError}</p>:null}
    <button className="primary" type="submit">{editingId?'運動を更新':'運動を保存'}</button>{editingId?<button type="button" className="text-button" onClick={()=>{setEditingId(null);setSets([]);setDetails('');}}>修正をやめる</button>:null}
   </form>
   {state.exercises.filter(e=>e.date===date).map(e=><div className="record-row" key={e.id}><Dumbbell size={18}/><span><strong>{e.name} · {e.minutes}分</strong>{e.netKcal!==undefined?<small>追加消費の目安 {Math.round(e.netKcal)} kcal{included?'（係数に含むため加算なし）':''}</small>:null}<small className="preline">{e.details}</small>{e.sets?.length?<><details><summary>セットと前回比較を見る</summary><p className="preline">{setText(e.sets)}</p><SetSummary sets={e.sets} history={state.exercises.filter(x=>x.id!==e.id)} date={e.date}/></details><button className="text-button" onClick={()=>{setName(e.name);setMinutes(e.minutes);setMet(e.met??1);setDetails(e.details);setKind('strength');setSets(draftsFrom(e.sets!));setEditingId(e.id);document.getElementById('exercise-form')?.scrollIntoView({behavior:'smooth'});}}>この記録を修正</button></>:null}</span><button className="icon-button" aria-label={`${e.name}の記録を削除`} onClick={()=>{update(s=>({...s,exercises:s.exercises.filter(x=>x.id!==e.id)}));if(editingId===e.id){setEditingId(null);setSets([]);setDetails('');setSetError('');}}}><Trash2 size={16}/></button></div>)}
  </section>
 </>;
}
