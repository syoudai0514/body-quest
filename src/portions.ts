// Only one mass/volume basis. Mixed recipes must use the ingredient/yield calculator.
const normalize=(portion:string)=>portion.normalize('NFKC').replaceAll('⁄','/');
const scalar=(match:RegExpMatchArray)=>Number(match[1])/(match[2]===undefined?1:Number(match[2]));
function multipliers(text:string) {
 const matches=[...text.matchAll(/×\s*(\d+(?:\.\d+)?)/g)];
 if(matches.length!==(text.match(/×/g)??[]).length)return NaN;
 return matches.reduce((value,match)=>value*Number(match[1]),1);
}
export function portionMeasure(portion:string):{value:number;unit:'g'|'ml'}|null {
 const text=normalize(portion),matches=[...text.matchAll(/(?<![\d./-])(\d+(?:\.\d+)?)(?:\s*\/\s*(\d+(?:\.\d+)?))?\s*(kg|ml|g|グラム|ミリリットル)(?![a-z])/gi)];
 if(matches.length!==1||/[gｇ](?:\s*[+＋・、]\s*[^\d\s（(]|と[^\d\s])/i.test(text))return null;
 const m=matches[0],unit=m[3].toLowerCase(),value=scalar(m)*(unit==='kg'?1000:1)*multipliers(text);
 return value>0&&Number.isFinite(value)?{value,unit:unit==='ml'||unit==='ミリリットル'?'ml':'g'}:null;
}
export const portionForQuantity=(portion:string|undefined,quantity:number)=>portion?`${portion}${quantity===1?'':` ×${quantity}`}`:undefined;

export function portionCount(portion:string) {
 const text=normalize(portion),matches=[...text.matchAll(/(?<![\d./-])(\d+(?:\.\d+)?)(?:\s*\/\s*(\d+(?:\.\d+)?))?\s*(本|袋|個|枚|食(?:分)?|パック|杯|人前|粒)/g)];
 if(matches.length!==1||/[gｇ](?:\s*[+＋・、]\s*[^\d\s（(]|と[^\d\s])/i.test(text))return null;
 const m=matches[0],value=scalar(m)*multipliers(text);return value>0&&Number.isFinite(value)?{value,unit:m[3]}:null;
}
