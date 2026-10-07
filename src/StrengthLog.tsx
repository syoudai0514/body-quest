import {Plus,Trash2} from 'lucide-react';
import type {Exercise,StrengthSet} from './types';
import {setComparisons,volume,workSets} from './workoutData';
import {Field} from './ui';
export type SetDraft={id:string;exercise:string;kg:string;reps:string;rir:string;warmup:boolean};
export const blankSet=(name=''):SetDraft=>({id:crypto.randomUUID(),exercise:name,kg:'',reps:'',rir:'',warmup:false});
export const draftsFrom=(sets:StrengthSet[])=>sets.map(s=>({...blankSet(s.exercise),kg:String(s.kg),reps:String(s.reps),rir:s.rir===undefined?'':String(s.rir),warmup:!!s.warmup}));
export const parseSet=(s:SetDraft):StrengthSet=>({exercise:s.exercise.trim(),kg:s.kg===''?NaN:Number(s.kg),reps:s.reps===''?NaN:Number(s.reps),...(s.rir!==''?{rir:Number(s.rir)}:{}),warmup:s.warmup});
export function SetEditor({sets,change}:{sets:SetDraft[];change:(sets:SetDraft[])=>void}) {
 const edit=(id:string,patch:Partial<SetDraft>)=>change(sets.map(s=>s.id===id?{...s,...patch}:s));
 return <div className="set-editor"><div className="section-heading"><h3>セットごとの記録</h3><span className="pill">重量・回数・RIR</span></div><p className="muted">重量は器具の表示値（ダンベルは片手）。自重は0kg。RIRは「あと何回できたか」の余力です。準備セットは総負荷から除きます。</p>
 {sets.map((s,i)=><div className="set-row" key={s.id}><div className="set-row-title"><span>SET {String(i+1).padStart(2,'0')}</span><button type="button" className="icon-button" aria-label={`セット${i+1}を削除`} onClick={()=>change(sets.filter(x=>x.id!==s.id))}><Trash2 size={15}/></button></div><Field label={`セット${i+1}の種目`}><input required maxLength={100} value={s.exercise} placeholder="ベンチプレス" onChange={e=>edit(s.id,{exercise:e.target.value})}/></Field><div className="set-numbers"><Field label="重量（kg）"><input required type="number" inputMode="decimal" min="0" max="500" step="0.5" value={s.kg} placeholder="0" onChange={e=>edit(s.id,{kg:e.target.value})}/></Field><Field label="回数"><input required type="number" inputMode="numeric" min="1" max="100" step="1" value={s.reps} onChange={e=>edit(s.id,{reps:e.target.value})}/></Field><Field label="RIR（任意）"><input type="number" inputMode="numeric" min="0" max="10" step="1" value={s.rir} placeholder="2" onChange={e=>edit(s.id,{rir:e.target.value})}/></Field></div><label className="check"><input type="checkbox" checked={s.warmup} onChange={e=>edit(s.id,{warmup:e.target.checked})}/>ウォームアップ</label><button className="text-button" type="button" disabled={sets.length>=60} onClick={()=>change([...sets,{...s,id:crypto.randomUUID()}])}><Plus size={14}/>同じ種目のセットを追加</button></div>)}
 <button type="button" className="secondary" disabled={sets.length>=60} onClick={()=>change([...sets,blankSet()])}><Plus size={16}/>種目・セットを追加</button>
 </div>;
}
export function SetSummary({sets,history,date}:{sets:StrengthSet[];history:Exercise[];date:string}) {
 const comparisons=setComparisons(history,sets,date);
 return <div className="set-summary"><span className="eyebrow">WORKOUT LOG</span><strong>{workSets(sets).length}<small> ワークセット · 記録上の総負荷 {volume(sets).toLocaleString('ja-JP')} kg×回</small></strong><p className="muted">自重分・ダンベルの両手換算は含みません。負荷の増加だけで筋力向上は判定しません。</p>{comparisons.map(c=><div className="set-compare" key={c.name}><b>{c.name}</b><span>{c.sets}セット · 最大 {c.best}kg</span><small>{c.previousVolume!==null?`前回 ${c.date?.slice(5).replace('-','/')}：${c.previousSets}セット・最大${c.previousBest}kg・${c.previousVolume.toLocaleString()} kg×回 → 今回 ${c.currentVolume.toLocaleString()} kg×回`:'この種目の前回データはまだありません'}</small></div>)}</div>;
}
