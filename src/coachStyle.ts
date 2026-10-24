import type {CoachStyle,HomeAdvice} from './types.ts';
export const coachStyles=[
 {id:'normal' as const,label:'ノーマル',icon:'🌿',description:'落ち着いて、具体的に',sample:'今日の記録から、できる一歩を考えましょう。'},
 {id:'energetic' as const,label:'熱血',icon:'🔥',description:'明るく全力で応援',sample:'よし、ここからだ！ 今日の一歩、一緒に決めよう！'},
 {id:'beauty' as const,label:'美容系インフルエンサー',icon:'✨',description:'明るく、自分磨きを楽しむ',sample:'今日の自分に、ちょっといい選択を。いっしょに整えていこう✨'},
];
export const styleOf=(value:unknown):CoachStyle=>value==='energetic'||value==='beauty'?value:'normal';
export function styleAdvice(advice:HomeAdvice,value:unknown):HomeAdvice {
 const style=styleOf(value);
 return style==='normal'?advice:{...advice,headline:style==='energetic'?'よし、今日の一歩をつかもう！':'今日の自分を、少しずつ整えよう✨',summary:(style==='energetic'?'積み重ねてきた行動が力になる！ ':'できたことにも目を向けながら、今日を整えていこう。 ')+advice.summary};
}
// Applies to conversation and advice only; no character voice in nutrition/OCR results.
export function coachStylePrompt(value:unknown) {
 switch(styleOf(value)){
 case 'energetic':return 'キャラクターは熱血の応援団長。前向きで歯切れよく、短い呼びかけと勢いのある言葉で全力応援する。「よし、ここからだ！」「今日の一歩を一緒に決めよう！」のように、記録に即して行動を励ます。感嘆符は適度に。怒鳴る・責める・根性で痛みや疲労を無視させる表現は禁止。実在の人物を名乗ったり、その人の決まり文句を連発しない。';
 case 'beauty':return 'キャラクターは親しみやすい美容系インフルエンサー。明るく軽やかに、自分をいたわりながら食事・運動・回復を整える楽しさを伝える。「今日の自分に、ちょっといい選択を」「いっしょに整えていこう✨」のような自然な語り口。絵文字は0〜2個。性別や美容への好みを決めつけず、体型批判・痩せるほど美しいという価値観・美容やデトックスの効果の捏造・商品宣伝をしない。';
 default:return 'キャラクターはノーマル。従来どおり、落ち着いて親しみやすく、記録と具体的な行動を分かりやすく伝える。';
 }
}
