import {useState} from 'react';
import {groupSets,describeSets} from './setGroups';
import {Plus,Trash2} from 'lucide-react';
import type {Exercise,StrengthSet} from './types';
import {validSets,setComparisons,volume,workSets} from './workoutData';
export type SetDraft={id:string;exercise:string;kg:string;reps:string;rir:string;warmup:boolean};
export const blankSet=(name=''):SetDraft=>({id:crypto.randomUUID(),exercise:name,kg:'',reps:'',rir:'',warmup:false});
export const draftsFrom=(sets:StrengthSet[])=>sets.map(s=>({...blankSet(s.exercise),kg:String(s.kg),reps:String(s.reps),rir:s.rir===undefined?'':String(s.rir),warmup:!!s.warmup}));
export const parseSet=(s:SetDraft):StrengthSet=>({exercise:s.exercise.trim(),kg:s.kg===''?NaN:Number(s.kg),reps:s.reps===''?NaN:Number(s.reps),...(s.rir!==''?{rir:Number(s.rir)}:{}),warmup:s.warmup});
export function SetReview({sets}:{sets:StrengthSet[]}) {
 return <div className="set-review" aria-label="読み取ったセットの一覧">{groupSets(sets).map((group,i)=>{const lines=describeSets(group);return <div className="set-review-exercise" key={i}><div><strong>{group[0].exercise}</strong><small>{group.length}セット</small></div>{lines.slice(0,2).map((line,j)=><p key={j}>{line}</p>)}{lines.length>2?<details className="set-review-more"><summary>残り{lines.length-2}パターンを見る</summary>{lines.slice(2).map((line,j)=><p key={j}>{line}</p>)}</details>:null}</div>;})}</div>;
}
function ExerciseSets({group,sets,change,extra,startOpen}:{group:SetDraft[];sets:SetDraft[];change:(sets:SetDraft[])=>void;extra:boolean;startOpen:boolean}) {
 const first=group[0],ids=new Set(group.map(s=>s.id)),source=group.find(s=>!s.warmup),valid=validSets(group.map(parseSet)),lines=valid?describeSets(group.map(parseSet)):[];
 const [open,setOpen]=useState(startOpen||!valid);
 const edit=(id:string,patch:Partial<SetDraft>)=>change(sets.map(s=>s.id===id?{...s,...patch}:s));
 return <details className="set-exercise" open={open} onToggle={e=>setOpen(e.currentTarget.open)}><summary className="set-exercise-toggle"><strong>{first.exercise||'新しい種目'}</strong><span>{group.length}セット</span>{valid?<small>{lines.slice(0,2).join(' ／ ')}{lines.length>2?' …':''}</small>:<small>重量・回数を入力</small>}</summary><div className="set-exercise-body">
  <div className="set-exercise-name"><input aria-label="種目名" required maxLength={100} value={first.exercise} placeholder="ベンチプレス" onChange={e=>change(sets.map(s=>ids.has(s.id)?{...s,exercise:e.target.value}:s))}/><span>{group.length}セット</span></div>
  <div className={`set-table ${extra?'show-extra':''}`}><div className="set-table-head" aria-hidden="true"><span>SET</span><span>kg</span><span>回数</span>{extra?<span>余力</span>:null}<span/></div>
  {group.map((s,i)=><div className="set-row" key={s.id}><button className={`set-type ${s.warmup?'is-warmup':''}`} type="button" disabled={!extra} aria-label={`セット${i+1}を${s.warmup?'本番':'準備'}に変更`} aria-pressed={s.warmup} onClick={()=>edit(s.id,{warmup:!s.warmup})}>{s.warmup?'W':i+1}</button><input aria-label="重量（kg）" required type="number" inputMode="decimal" min="0" max="500" step="0.5" value={s.kg} placeholder="0" onChange={e=>edit(s.id,{kg:e.target.value})}/><input aria-label="回数" required type="number" inputMode="numeric" min="1" max="100" step="1" value={s.reps} onChange={e=>edit(s.id,{reps:e.target.value})}/>{extra?<input aria-label="RIR（任意）" type="number" inputMode="numeric" min="0" max="10" step="1" value={s.rir} placeholder="—" onChange={e=>edit(s.id,{rir:e.target.value})}/>:null}<button type="button" className="icon-button" aria-label={`${first.exercise||'未入力の種目'}のセット${i+1}を削除`} onClick={()=>change(sets.filter(x=>x.id!==s.id))}><Trash2 size={15}/></button></div>)}
  </div><div className="set-exercise-actions"><button className="text-button" type="button" disabled={sets.length>=60} onClick={()=>{const last=group.at(-1)!;const index=sets.findIndex(s=>s.id===last.id)+1;change([...sets.slice(0,index),{...last,id:crypto.randomUUID()},...sets.slice(index)]);}}><Plus size={14}/>セットを追加</button>{group.filter(s=>!s.warmup).length>1?<button className="text-button" type="button" disabled={!source||!validSets([parseSet(source)])} onClick={()=>change(sets.map(s=>ids.has(s.id)&&!s.warmup?{...s,kg:source!.kg,reps:source!.reps}:s))}>最初の重量・回数にそろえる</button>:null}</div>
 </div></details>;
}
export function SetEditor({sets,change}:{sets:SetDraft[];change:(sets:SetDraft[])=>void}) {
 const [extra,setExtra]=useState(false),groups=groupSets(sets);
 return <div className="set-editor"><div className="section-heading"><h3>種目とセット</h3><span className="pill">{sets.length}セット</span></div>
 {groups.map(group=><ExerciseSets key={group[0].id} group={group} sets={sets} change={change} extra={extra} startOpen={groups.length===1}/>)}
 <button type="button" className="secondary" disabled={sets.length>=60} onClick={()=>change([...sets,blankSet()])}><Plus size={16}/>種目を追加</button>
 <label className="check set-extra-toggle"><input type="checkbox" checked={extra} onChange={e=>setExtra(e.target.checked)}/>余力・準備セットも編集</label>
 <details className="set-help"><summary>重量・余力の入力について</summary><p className="muted">重量は器具の表示値（ダンベルは片手）。自重は0kg。余力（RIR）は「あと何回できたか」。準備はSET番号をタップしてWに変更すると集計から除外します。詳細を閉じても入力済みの余力・準備の情報は残ります。「そろえる」は同じ種目の本番セットの重量・回数だけを変更します。</p></details>
 </div>;
}
export function SetSummary({sets,history,date}:{sets:StrengthSet[];history:Exercise[];date:string}) {
 const comparisons=setComparisons(history,sets,date);
 return <div className="set-summary"><span className="eyebrow">WORKOUT LOG</span><strong>{workSets(sets).length}<small> ワークセット · 記録上の総負荷 {volume(sets).toLocaleString('ja-JP')} kg×回</small></strong><p className="muted">自重分・ダンベルの両手換算は含みません。負荷の増加だけで筋力向上は判定しません。</p>{comparisons.map(c=><div className="set-compare" key={c.name}><b>{c.name}</b><span>{c.sets}セット · 最大 {c.best}kg</span><small>{c.previousVolume!==null?`前回 ${c.date?.slice(5).replace('-','/')}：${c.previousSets}セット・最大${c.previousBest}kg・${c.previousVolume.toLocaleString()} kg×回 → 今回 ${c.currentVolume.toLocaleString()} kg×回`:'この種目の前回データはまだありません'}</small></div>)}</div>;
}
