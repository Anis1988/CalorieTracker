import type { Food, MacroPlan, Meal, Settings } from './types.js';

// The maths, shared by the app and the server: calorie goal from your profile, macro targets, totals, units.

const ACTIVITY: Record<Settings['profile']['activity'], { factor: number; label: string }> = {
  sedentary: { factor: 1.2, label: 'Mostly sitting' },
  light: { factor: 1.375, label: 'Light (walks, 1–3 workouts a week)' },
  moderate: { factor: 1.55, label: 'Moderate (3–5 workouts a week)' },
  active: { factor: 1.725, label: 'Active (6–7 workouts a week)' },
  very: { factor: 1.9, label: 'Very active (hard training or a physical job)' },
};
export const ACTIVITIES = Object.entries(ACTIVITY).map(([id, a]) => ({ id: id as Settings['profile']['activity'], ...a }));

/** Calories burned at rest (Mifflin–St Jeor). */
export const bmr = (p: Settings['profile']) => Math.round(10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + (p.sex === 'male' ? 5 : -161));
/** Calories for a normal day at your activity level. */
export const tdee = (p: Settings['profile']) => Math.round(bmr(p) * ACTIVITY[p.activity].factor);

/** Your daily goal from your profile: about 7,700 kcal per kg of body weight, spread over the week. */
export function autoCalories(p: Settings['profile']): number {
  const change = p.goal === 'maintain' ? 0 : Math.round((p.pace * 7700) / 7) * (p.goal === 'lose' ? -1 : 1);
  const floor = p.sex === 'male' ? 1500 : 1200; // never suggest less than this
  return Math.max(floor, Math.round((tdee(p) + change) / 10) * 10);
}
export const calorieGoal = (s: Settings) => (s.goals.auto ? autoCalories(s.profile) : s.goals.calories);

export const MACRO_PLANS: { id: MacroPlan; label: string; split: { protein: number; carbs: number; fat: number } }[] = [
  { id: 'balanced', label: 'Balanced', split: { protein: 25, carbs: 45, fat: 30 } },
  { id: 'protein', label: 'High protein', split: { protein: 35, carbs: 35, fat: 30 } },
  { id: 'lowcarb', label: 'Low carb', split: { protein: 30, carbs: 25, fat: 45 } },
  { id: 'keto', label: 'Keto', split: { protein: 25, carbs: 5, fat: 70 } },
  { id: 'custom', label: 'My own', split: { protein: 30, carbs: 40, fat: 30 } },
];
export const macroSplit = (s: Settings) => (s.goals.macro === 'custom' ? s.goals.custom : MACRO_PLANS.find((m) => m.id === s.goals.macro)!.split);

/** Grams a day for each macro (protein and carbs 4 kcal/g, fat 9 kcal/g). */
export function macroGoals(s: Settings) {
  const kcal = calorieGoal(s);
  const sp = macroSplit(s);
  return { calories: kcal, protein: Math.round((kcal * sp.protein) / 100 / 4), carbs: Math.round((kcal * sp.carbs) / 100 / 4), fat: Math.round((kcal * sp.fat) / 100 / 9), fiber: s.goals.fiber };
}

export type Totals = Pick<Food, 'calories' | 'protein' | 'carbs' | 'fat' | 'fiber' | 'sugar'>;
export const ZERO: Totals = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0 };
export function sum(items: Totals[]): Totals {
  const t = { ...ZERO };
  for (const i of items) for (const k of Object.keys(t) as (keyof Totals)[]) t[k] += Number(i[k]) || 0;
  return t;
}

/** A food at a new size: everything scales with the grams. */
export function scaleFood(f: Food, grams: number): Food {
  const g = Math.max(0, Math.round(grams));
  const r = f.grams > 0 ? g / f.grams : 0;
  const k = (n: number) => Math.round(n * r * 10) / 10;
  return { ...f, grams: g, calories: Math.round(f.calories * r), protein: k(f.protein), carbs: k(f.carbs), fat: k(f.fat), fiber: k(f.fiber), sugar: k(f.sugar) };
}

/** Breakfast / lunch / dinner / snack from the time of day (Settings → Meals). */
export function mealAt(time: string, m: Settings['meals']): Meal {
  if (time < '05:00') return 'snack';
  if (time <= m.breakfastUntil) return 'breakfast';
  if (time <= m.lunchUntil) return 'lunch';
  if (time <= m.dinnerUntil) return 'dinner';
  return 'snack';
}

// ---------- units ----------
export const kcalText = (n: number, u: Settings['units']) => (u.energy === 'kJ' ? `${Math.round(n * 4.184).toLocaleString()} kJ` : `${Math.round(n).toLocaleString()} kcal`);
export const energyNum = (n: number, u: Settings['units']) => Math.round(u.energy === 'kJ' ? n * 4.184 : n);
export const energyUnit = (u: Settings['units']) => (u.energy === 'kJ' ? 'kJ' : 'kcal');
export const kgToLb = (kg: number) => kg * 2.20462;
export const lbToKg = (lb: number) => lb / 2.20462;
export const weightText = (kg: number, u: Settings['units'], digits = 1) => (u.weight === 'lb' ? `${kgToLb(kg).toFixed(digits)} lb` : `${kg.toFixed(digits)} kg`);
export const weightNum = (kg: number, u: Settings['units']) => Math.round((u.weight === 'lb' ? kgToLb(kg) : kg) * 10) / 10;
export const waterText = (ml: number, u: Settings['units']) => (u.water === 'oz' ? `${Math.round(ml / 29.5735)} oz` : ml >= 1000 ? `${(ml / 1000).toFixed(ml % 1000 ? 2 : 1).replace(/0$/, '')} L` : `${ml} ml`);
export const heightText = (cm: number, u: Settings['units']) => { if (u.height === 'cm') return `${cm} cm`; const inch = Math.round(cm / 2.54); return `${Math.floor(inch / 12)}′${inch % 12}″`; };
export const bmi = (p: Settings['profile']) => p.weightKg / (p.heightCm / 100) ** 2;
export const bmiLabel = (b: number) => (b < 18.5 ? 'under the healthy range' : b < 25 ? 'in the healthy range' : b < 30 ? 'above the healthy range' : 'well above the healthy range');
