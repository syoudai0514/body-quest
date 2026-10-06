export type Nutrition = { kcal: number; protein: number; fat: number; carbs: number };
export type Food = Nutrition & { id: string; name: string; portion: string; category: string; source: string; estimated: boolean; steps?: string[]; minutes?: number };
export type Meal = Nutrition & { id: string; date: string; slot: string; name: string; quantity: number; source: string; estimated: boolean; alcoholG?: number };
export type BodyComp = { bodyFat?: number; muscle?: number; visceral?: number; leanMass?: number; water?: number; protein?: number; bone?: number; bmr?: number; bodyAge?: number; bmi?: number };
export type Weight = { id: string; date: string; time: '朝'|'夜'; kg: number; waist?: number; body?: BodyComp };
export type Exercise = { id: string; date: string; name: string; minutes: number; details: string; met?: number; netKcal?: number };
export type EnergyProfile = { age: number; height: number; sex: 'male'|'female'; activity: number; exerciseMode: 'separate'|'included'; weeklyExerciseKcal: number };
export type ClosedDay = { expenditure: number; weight: number };
export type Photo = { id: string; date: string; image: string };
export type CoachMode = 'gentle'|'balanced'|'direct';
export type CaloriePolicy = 'standard'|'flexible';
export type Settings = { kcal: number; protein: number; fat: number; carbs: number; startWeight: number|null; targetWeight: number|null; startDate: string; deadline: string; whiskeyMl: number; ldl: boolean; backPain: boolean; energy?: EnergyProfile; goalName?: string; goalKind?: 'event'|'longterm'; nutritionMode?: 'auto'|'manual'; coachMode?: CoachMode; proteinPerKg?: number; caloriePolicy?: CaloriePolicy; belowBmrAcknowledged?: boolean; homeAiAuto?: boolean ; gameMode?: boolean };
export type AppState = { version: 1; settings: Settings; foods: Food[]; meals: Meal[]; weights: Weight[]; exercises: Exercise[]; photos: Photo[]; contexts: Record<string,string>; lastBackup: string|null; closedDays?: Record<string,ClosedDay>; favorites?: string[]; painDates?: string[]; homeBriefs?: HomeBriefRecord[] };
export type Draft = Nutrition & { name: string; portion: string; note: string; estimated: boolean; factor?: number; base?: Nutrition };

export type BriefPhase = 'morning'|'afternoon'|'evening';
export type HomeAdvice = {headline:string;summary:string;tips:string[]};
export type HomeBriefRecord = {id:string;date:string;phase:BriefPhase;attemptedAt:string;brief?:HomeAdvice;briefSignature?:string;generatedAt?:string;error?:string};
