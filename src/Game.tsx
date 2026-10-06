import {Check,ChevronRight,Sparkles,Swords,TrendingDown,Trophy} from 'lucide-react';
import type {AppState} from './types';
import {achievements,boss,dailyQuests,levelInfo,todayXp,totalXp,XP,type Quest} from './game';
import {today} from './domain';

// Today's quests replace the plain shortcuts: each row is a habit, worth XP, and opens where it is done.
export function QuestPanel({state,date,open,consult}:{state:AppState;date:string;open:(target:Quest['target']|'progress')=>void;consult:()=>void}) {
 const lv=levelInfo(totalXp(state,today())),quests=dailyQuests(state,date),done=quests.filter(q=>q.done).length,clear=done===quests.length;
 return <section className="card quest-panel" aria-label="今日のクエスト">
  <div className="quest-level"><span className="level-badge">Lv.{lv.level}</span><span><strong>{lv.title}</strong><small>あと {lv.need-lv.into} XP で Lv.{lv.level+1}</small></span><span className="xp-total">{lv.xp.toLocaleString()} XP</span></div>
  <div className="xp-bar" role="img" aria-label={`次のレベルまで${lv.progress}%`}><span style={{width:`${lv.progress}%`}}/></div>
  <div className="section-heading quest-heading"><h2><Swords size={18}/>{date===today()?'デイリークエスト':'この日のクエスト'}</h2><span className={`pill ${clear?'done-pill':''}`}>{clear?'🎉 クリア！':`${done}/${quests.length}`}</span></div>
  <div className="quest-list">{quests.map(q=><button key={q.id} className={`quest-item ${q.done?'done':''}`} onClick={()=>open(q.target)}><span className="quest-check">{q.done?<Check size={15}/>:null}</span><span className="quest-label">{q.label}</span><span className="xp-chip">+{q.xp}XP</span><ChevronRight size={16}/></button>)}</div>
  <p className="muted quest-note">{clear?`全クエストクリア！ ボーナス +${XP.clear}XP。この日は ${todayXp(state,date)}XP 獲得。`:`今日は ${todayXp(state,date)}XP 獲得。体重・3食・運動・締めくくりがそろうとクリアボーナス +${XP.clear}XP。`}食事を抜いたり減らしたりしてもXPは増えません。</p>
  <div className="quest-links"><button className="text-button" onClick={()=>open('progress')}><TrendingDown size={15}/>道のりを見る</button><button className="text-button" onClick={consult}><Sparkles size={15}/>コーチに相談</button></div>
 </section>;
}

export function BossBar({state}:{state:AppState}) {
 const b=boss(state,today());if(!b)return null;
 return <div className={`boss ${b.defeated?'defeated':''}`}><div><span>⚔️ {b.name}</span><strong>{b.defeated?'討伐！':`HP ${b.hp.toFixed(1)} / ${b.max.toFixed(1)}`}</strong></div><div className="boss-hp" role="img" aria-label={`ボスの残りHP ${b.pct}%`}><span style={{width:`${b.pct}%`}}/></div><small>{b.defeated?'目標体重に到達。次は維持のクエストへ。':`1kg減るごとに1kgのダメージ。残り${b.daysLeft}日で討伐を目指そう。`}</small></div>;
}

export function AchievementsCard({state}:{state:AppState}) {
 const list=achievements(state,today()),earned=list.filter(a=>a.earned).length;
 return <section className="card achievements"><div className="section-heading"><h2><Trophy size={19}/>称号コレクション</h2><span className="pill">{earned}/{list.length}</span></div>
  <div className="badge-grid">{list.map(a=><div key={a.id} className={`badge ${a.earned?'earned':''}`} title={a.desc}><span className="badge-icon">{a.earned?a.icon:'🔒'}</span><strong>{a.title}</strong><small>{a.desc}</small></div>)}</div>
 </section>;
}
