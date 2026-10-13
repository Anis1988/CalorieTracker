// Shared by the app and the server functions (server imports end in .js).

export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export const MEALS: { id: Meal; label: string; icon: string }[] = [
  { id: 'breakfast', label: 'Breakfast', icon: '🌅' },
  { id: 'lunch', label: 'Lunch', icon: '☀️' },
  { id: 'dinner', label: 'Dinner', icon: '🌙' },
  { id: 'snack', label: 'Snacks', icon: '🍎' },
];

/** One food or drink, with its own portion and nutrition (for that portion). */
export interface Food {
  name: string;
  portion: string; // in words, e.g. "1 cup", "2 slices"
  grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  confidence: number; // 0..100
}

/** What the AI (or a barcode) found, before you save it. */
export interface Analysis {
  title: string;
  items: Food[];
  healthScore: number; // 1..10, 0 = none
  notes: string;
  tips: string[];
  by: string; // which AI (or "Open Food Facts")
  cached?: boolean;
  note?: string; // e.g. "Gemini's free allowance was used up, so Claude did it"
}

export type Source = 'photo' | 'text' | 'barcode' | 'manual' | 'favorite';

export interface Entry {
  id: string;
  date: string; // YYYY-MM-DD (your phone's day)
  time: string; // HH:MM
  meal: Meal;
  title: string;
  items: Food[];
  source: Source;
  photo?: string; // photo id (small copy kept on the server)
  by?: string;
  healthScore?: number;
  notes?: string;
  createdAt: string;
}

export interface Favorite { id: string; title: string; items: Food[]; meal?: Meal; createdAt: string }
export interface DayData { entries: Entry[]; water: number } // water in ml

export type Provider = 'gemini' | 'claude';
export type MacroPlan = 'balanced' | 'protein' | 'lowcarb' | 'keto' | 'custom';

export interface Settings {
  profile: { sex: 'male' | 'female'; age: number; heightCm: number; weightKg: number; activity: 'sedentary' | 'light' | 'moderate' | 'active' | 'very'; goal: 'lose' | 'maintain' | 'gain'; pace: number; goalWeightKg: number | null };
  goals: { auto: boolean; calories: number; macro: MacroPlan; custom: { protein: number; carbs: number; fat: number }; fiber: number; waterMl: number };
  units: { weight: 'kg' | 'lb'; height: 'cm' | 'ftin'; water: 'ml' | 'oz'; energy: 'kcal' | 'kJ' };
  meals: { breakfastUntil: string; lunchUntil: string; dinnerUntil: string };
  ai: {
    provider: Provider; // tried first
    fallback: boolean; // the other AI takes over when the first fails or is over its daily limit
    geminiModel: string;
    claudeModel: string;
    effort: 'low' | 'medium' | 'high';
    geminiDailyLimit: number;
    claudeDailyLimit: number;
    claudeUnlimited: boolean;
    rememberDays: number; // the same photo/text is never paid for twice within this many days
    askNote: boolean; // show the "anything to add?" box before a photo is read
    review: boolean; // show the breakdown to check before saving (off = saved right away)
    tips: boolean;
  };
  photos: { keep: boolean; days: number };
  display: { theme: 'auto' | 'light' | 'dark'; weekStart: 0 | 1; healthScore: boolean; macros: boolean };
  water: { on: boolean; step: number };
}

export const DEFAULT_SETTINGS: Settings = {
  profile: { sex: 'male', age: 35, heightCm: 175, weightKg: 80, activity: 'light', goal: 'maintain', pace: 0.5, goalWeightKg: null },
  goals: { auto: true, calories: 2200, macro: 'balanced', custom: { protein: 30, carbs: 40, fat: 30 }, fiber: 30, waterMl: 2500 },
  units: { weight: 'kg', height: 'cm', water: 'ml', energy: 'kcal' },
  meals: { breakfastUntil: '10:30', lunchUntil: '15:30', dinnerUntil: '21:30' },
  ai: { provider: 'gemini', fallback: true, geminiModel: 'gemini-flash-latest', claudeModel: 'claude-sonnet-5-5', effort: 'low', geminiDailyLimit: 100, claudeDailyLimit: 10, claudeUnlimited: false, rememberDays: 7, askNote: false, review: true, tips: true },
  photos: { keep: true, days: 90 },
  display: { theme: 'auto', weekStart: 1, healthScore: true, macros: true },
  water: { on: true, step: 250 },
};

/** Settings saved by an older version: anything missing gets its default. */
export function withDefaults(s: Partial<Settings> | null | undefined): Settings {
  const d = DEFAULT_SETTINGS;
  const o = s ?? {};
  return {
    profile: { ...d.profile, ...o.profile },
    goals: { ...d.goals, ...o.goals, custom: { ...d.goals.custom, ...o.goals?.custom } },
    units: { ...d.units, ...o.units },
    meals: { ...d.meals, ...o.meals },
    ai: { ...d.ai, ...o.ai },
    photos: { ...d.photos, ...o.photos },
    display: { ...d.display, ...o.display },
    water: { ...d.water, ...o.water },
  };
}

export const GEMINI_MODELS = [
  { id: 'gemini-flash-latest', name: 'Gemini Flash', hint: 'Free, fast and good with food photos.' },
  { id: 'gemini-pro-latest', name: 'Gemini Pro', hint: 'Free with a small daily allowance; a bit more careful. Flash takes over when it runs out.' },
  { id: 'gemini-flash-lite-latest', name: 'Gemini Flash-Lite', hint: 'Free, the quickest, a little less precise.' },
];
export const CLAUDE_MODELS = [
  { id: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5', hint: 'Very good at portions. About 1–2 cents a photo.' },
  { id: 'claude-opus-5-5', name: 'Claude Opus 5.5', hint: 'The most careful. A few cents a photo.' },
  { id: 'claude-haiku-5-5', name: 'Claude Haiku 5.5', hint: 'The cheapest Claude, under a cent a photo.' },
];
export const modelName = (p: Provider, id: string) =>
  (p === 'gemini' ? GEMINI_MODELS : CLAUDE_MODELS).find((m) => m.id === id)?.name ?? id;

/** What the server says about itself (Settings → status). */
export interface Status {
  store: boolean;
  keys: { gemini: boolean; claude: boolean };
  used: { gemini: number; claude: number }; // AI reads today
}
