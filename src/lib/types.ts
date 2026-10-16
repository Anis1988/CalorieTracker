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
  display: { theme: 'auto' | 'light' | 'dark'; weekStart: 0 | 1; healthScore: boolean; macros: boolean; timeZone: string }; // timeZone: your phone's, kept up to date by the app (for “today” on the server)
  water: { on: boolean; step: number };
  beauty: Beauty;
  cooking: Cooking;
}

// ---------- 🍳 Cooking ----------
export interface Cooking {
  on: boolean; // show 🍳 Cooking in the switch
  diet: string; // '' = anything
  allergies: string[]; // always flagged (plain text check), never just left to the AI
  dislikes: string[];
  tools: string[]; // kitchen tools you have
  servings: number;
  maxTime: number; // minutes, 0 = any
  skill: 'easy' | 'medium' | 'any';
  count: number; // recipes per search
  units: 'metric' | 'us';
  staples: string[]; // always in the kitchen (salt, oil…)
  fitDay: boolean; // aim at what's left of today's calories by default
  pictures: 'real' | 'opened' | 'all'; // free photos only · AI picture when a recipe is opened/saved · AI for every recipe
  aiPicsPerDay: number; // most AI pictures a day (each costs about 4 cents)
  imageModel: string; // Gemini model that draws them
}
export const DIETS = ['Vegetarian', 'Vegan', 'Pescatarian', 'High protein', 'Low carb', 'Keto', 'Mediterranean', 'Halal', 'Kosher', 'Gluten-free', 'Dairy-free'];
export const ALLERGIES = ['Peanuts', 'Tree nuts', 'Gluten', 'Dairy', 'Eggs', 'Fish', 'Shellfish', 'Soy', 'Sesame'];
export const TOOLS = ['Oven', 'Stove', 'Microwave', 'Air fryer', 'Blender', 'Slow cooker', 'Pressure cooker', 'Grill', 'Rice cooker'];
export const CUISINES = ['Any', 'Mediterranean', 'Italian', 'Mexican', 'Middle Eastern', 'North African', 'Indian', 'Chinese', 'Japanese', 'Thai', 'American', 'French'];
export const MEAL_KINDS = ['Any', 'Breakfast', 'Lunch', 'Dinner', 'Snack', 'Dessert'];

/** A real photo of the dish (Pexels / Pixabay / Wikimedia): small for cards, big for full screen. */
/** thumb/full are web addresses, or "ai:<id>" for an AI picture kept on the server (shown via /api/entries?photo=). */
export interface RecipePhoto { thumb: string; full: string; credit: string; link: string; v?: number; ai?: boolean } // v 2 = matched to the dish
export interface RecipeIngredient { name: string; qty: number | null; unit: string; have: boolean; sub: string }
export interface Recipe {
  id: string;
  title: string;
  summary: string;
  cuisine: string;
  meal: string;
  minutes: number;
  difficulty: 'easy' | 'medium' | 'hard';
  servings: number;
  perServing: { calories: number; protein: number; carbs: number; fat: number; fiber: number; sugar: number };
  ingredients: RecipeIngredient[];
  steps: string[];
  tips: string[];
  tags: string[];
  allergyHits: string[]; // from your allergies (free check)
  by?: string;
  photo?: RecipePhoto | null; // null = looked for, none found
  photoQuery?: string; // words to find a photo of this dish
  // saved in Recipes
  createdAt?: string;
  fav?: boolean;
  rating?: number; // 1..5
  cooked?: number;
  lastCooked?: string;
  myNotes?: string;
}
export interface RecipeSearch { detected: string[]; recipes: Recipe[]; by: string; cached?: boolean; note?: string }
export interface ShopItem { id: string; name: string; done: boolean; from?: string }

// ---------- 💄 Beauty ----------
export type SkinType = 'dry' | 'oily' | 'combination' | 'normal';
export interface Beauty {
  on: boolean; // show the Food | Beauty switch
  skinType: SkinType;
  sensitive: boolean;
  concerns: string[];
  avoid: string[]; // ingredients to avoid (allergies, things that don't suit you)
  tone: '' | 'fair' | 'light' | 'medium' | 'tan' | 'deep';
  undertone: '' | 'cool' | 'warm' | 'neutral' | 'olive';
  fragranceFree: boolean;
  vegan: boolean;
  pregnancy: boolean;
  barcode: boolean; // 🏷️ look up barcodes on Open Beauty Facts (free) on the Check screen
}
export const SKIN_TYPES: { id: SkinType; label: string; hint: string }[] = [
  { id: 'dry', label: 'Dry', hint: 'Feels tight, flaky patches' },
  { id: 'oily', label: 'Oily', hint: 'Shiny, especially by midday' },
  { id: 'combination', label: 'Combination', hint: 'Oily T-zone, dry cheeks' },
  { id: 'normal', label: 'Normal', hint: 'Mostly comfortable' },
];
export const CONCERNS = ['Acne / breakouts', 'Redness / rosacea', 'Dark spots', 'Fine lines', 'Dullness', 'Large pores', 'Eczema', 'Dark circles', 'Dehydration', 'Blackheads'];
export const AVOID_IDEAS = ['Fragrance', 'Alcohol', 'Essential oils', 'Parabens', 'Sulfates', 'Silicones', 'Retinol', 'Nuts', 'Coconut oil', 'Mineral oil', 'Lanolin', 'Chemical sunscreen filters', 'Talc', 'Formaldehyde releasers'];
export const TONES: { id: Beauty['tone']; label: string; color: string }[] = [
  { id: 'fair', label: 'Fair', color: '#f6dccb' }, { id: 'light', label: 'Light', color: '#ecc5a6' }, { id: 'medium', label: 'Medium', color: '#c99a73' },
  { id: 'tan', label: 'Tan', color: '#a6764f' }, { id: 'deep', label: 'Deep', color: '#6b452c' },
];
export const UNDERTONES: { id: Beauty['undertone']; label: string; hint: string }[] = [
  { id: 'cool', label: 'Cool', hint: 'Veins look blue, silver suits you' },
  { id: 'warm', label: 'Warm', hint: 'Veins look green, gold suits you' },
  { id: 'neutral', label: 'Neutral', hint: 'A bit of both' },
  { id: 'olive', label: 'Olive', hint: 'Greenish-grey hint' },
];

export type Verdict = 'good' | 'ok' | 'avoid';
/** What the AI found for a beauty product, checked against your skin profile. */
export interface BeautyCheck {
  id: string;
  brand: string;
  product: string;
  category: string; // e.g. Foundation, Moisturizer, Serum…
  verdict: Verdict;
  score: number; // 1..10 for you
  summary: string;
  good: { name: string; why: string }[];
  watch: { name: string; why: string }[];
  avoidHits: string[]; // from your avoid list (free text check, the AI can't override it)
  ingredients: string[];
  ingredientsFrom: 'label' | 'known' | 'none' | 'database'; // database = Open Beauty Facts (barcode)
  howToUse: string[];
  shade: string; // shade advice for face makeup, else ''
  pao: string; // period after opening on the jar, e.g. "12M", else ''
  code?: string; // barcode, when found on Open Beauty Facts
  free?: boolean; // only the free checks (barcode, no AI yet)
  by: string;
  cached?: boolean;
  note?: string;
  createdAt: string;
}
export type ShelfStatus = 'checked' | 'wishlist' | 'using' | 'loved' | 'nope';
export const SHELF_STATUS: { id: ShelfStatus; label: string; icon: string }[] = [
  { id: 'using', label: 'Using', icon: '✨' },
  { id: 'loved', label: 'Loved it', icon: '💖' },
  { id: 'wishlist', label: 'Want to try', icon: '🛍️' },
  { id: 'nope', label: 'Didn’t suit me', icon: '🙅' },
  { id: 'checked', label: 'Just checked', icon: '🔍' },
];
export interface ShelfItem extends BeautyCheck { status: ShelfStatus; photo?: string; openedOn?: string; paoMonths?: number; myNotes?: string }

export const DEFAULT_SETTINGS: Settings = {
  profile: { sex: 'male', age: 35, heightCm: 175, weightKg: 80, activity: 'light', goal: 'maintain', pace: 0.5, goalWeightKg: null },
  goals: { auto: true, calories: 2200, macro: 'balanced', custom: { protein: 30, carbs: 40, fat: 30 }, fiber: 30, waterMl: 2500 },
  units: { weight: 'kg', height: 'cm', water: 'ml', energy: 'kcal' },
  meals: { breakfastUntil: '10:30', lunchUntil: '15:30', dinnerUntil: '21:30' },
  ai: { provider: 'gemini', fallback: true, geminiModel: 'gemini-flash-latest', claudeModel: 'claude-sonnet-5-5', effort: 'low', geminiDailyLimit: 100, claudeDailyLimit: 10, claudeUnlimited: false, rememberDays: 7, askNote: false, review: true, tips: true },
  photos: { keep: true, days: 90 },
  display: { theme: 'auto', weekStart: 1, healthScore: true, macros: true, timeZone: '' },
  water: { on: true, step: 250 },
  cooking: { on: true, diet: '', allergies: [], dislikes: [], tools: ['Oven', 'Stove', 'Microwave'], servings: 2, maxTime: 0, skill: 'any', count: 6, units: 'metric', staples: ['Salt', 'Pepper', 'Olive oil', 'Water'], fitDay: false, pictures: 'opened', aiPicsPerDay: 10, imageModel: 'gemini-2.5-flash-image' },
  beauty: { on: true, skinType: 'normal', sensitive: false, concerns: [], avoid: [], tone: '', undertone: '', fragranceFree: false, vegan: false, pregnancy: false, barcode: true },
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
    beauty: { ...d.beauty, ...o.beauty },
    cooking: { ...d.cooking, ...o.cooking },
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
  used: { gemini: number; claude: number; image?: number }; // AI reads today (image = AI recipe pictures)
}
