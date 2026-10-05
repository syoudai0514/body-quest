import {Activity,Plus} from 'lucide-react';
import type {AppState} from './types';
import {bodyFields,bodyHistory,formatBody,latestBody} from './body';
import {Empty} from './ui';

// Latest scale reading with the change since the previous one; values are device estimates, so trends matter more than one reading.
export function BodyCard({state,record}:{state:AppState;record:()=>void}) {
 const {latest,previous}=latestBody(state.weights),count=bodyHistory(state.weights).length;
 return <section className="card body-card"><div className="section-heading"><h2><Activity size={19}/>体組成</h2><button className="secondary compact" onClick={record}><Plus size={16}/>写真から記録</button></div>
  {!latest?<Empty>体組成計の結果画面を写真で読み取ると、<br/>体脂肪率・骨格筋率などの変化を確認できます。</Empty>:<>
   <p className="muted">{latest.date.replaceAll('-','/')} {latest.time} · 体重 {latest.kg.toFixed(1)}kg{previous?` · 前回 ${previous.date.slice(5).replace('-','/')} と比較`:''}</p>
   <div className="body-grid">{bodyFields.filter(f=>latest.body?.[f.key]!==undefined).map(f=>{const v=latest.body![f.key]!,p=previous?.body?.[f.key],d=p===undefined?null:+(v-p).toFixed(1);const good=d===null||d===0||!f.better?'':(d<0)===(f.better==='down')?'good':'bad';return <div key={f.key}><span>{f.label}</span><strong>{formatBody(f.key,v)}</strong>{d!==null?<small className={good}>{d>0?'+':''}{d}{f.unit}</small>:null}</div>;})}</div>
   <p className="muted">家庭用体組成計の値は推定で、水分や時間帯で変わります。{count<3?'同じ時間・条件で何回か測ると、傾向が見えてきます。':'体脂肪率が下がり、骨格筋率が保てていれば、筋肉を残した減量ができています。'}</p>
  </>}
 </section>;
}
