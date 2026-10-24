import type {Settings} from './types';
import {coachStyles,styleOf} from './coachStyle';
export function CoachStyleSelector({settings,save}:{settings:Settings;save:(s:Settings)=>void}) {
 const selected=styleOf(settings.coachStyle),style=coachStyles.find(s=>s.id===selected)!;
 return <fieldset className="coach-selector character-selector"><legend>AIのキャラクター</legend><p className="muted">話し方のテンションを選べます。アドバイスの強度とは別の設定です。</p><div className="mode-grid">{coachStyles.map(s=><button type="button" key={s.id} aria-pressed={selected===s.id} onClick={()=>save({...settings,coachStyle:s.id})} className={selected===s.id?'selected':''}><strong>{s.icon} {s.label}</strong><small>{s.description}</small></button>)}</div><p className="character-sample" aria-live="polite">{style.sample}</p></fieldset>;
}
