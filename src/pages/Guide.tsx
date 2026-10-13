import type { ReactNode } from 'react';
import { Fold } from '../components/ui';
import { CalorieRing, EntryRow, FoodEditor, HealthBadge, MacroBars, MacroLine, WaterCard } from '../components/Food';
import { CalorieBars, WeightLine } from '../components/Charts';
import { useStore } from '../lib/store';
import { addDays, shortDay, todayStr, weekday } from '../lib/date';
import { sum } from '../lib/nutrition';
import type { Entry, Food } from '../lib/types';

/* made-up examples, only for this guide */
const LUNCH: Food[] = [
  { name: 'Grilled chicken breast', portion: '1 medium breast', grams: 150, calories: 248, protein: 46, carbs: 0, fat: 5.4, fiber: 0, sugar: 0, confidence: 85 },
  { name: 'White rice', portion: '1 cup', grams: 180, calories: 234, protein: 4.8, carbs: 51, fat: 0.5, fiber: 0.7, sugar: 0, confidence: 80 },
  { name: 'Steamed broccoli', portion: '1 cup', grams: 90, calories: 31, protein: 2.5, carbs: 6, fat: 0.3, fiber: 2.4, sugar: 1.5, confidence: 90 },
  { name: 'Olive oil (cooking)', portion: '1 tablespoon', grams: 13, calories: 119, protein: 0, carbs: 0, fat: 13.5, fiber: 0, sugar: 0, confidence: 55 },
];
const ENTRY: Entry = { id: 'g1', date: todayStr(), time: '12:40', meal: 'lunch', title: 'Chicken, rice and broccoli', items: LUNCH, source: 'photo', createdAt: '' };
const DAYS = [1850, 2240, 1990, 2105, 2460, 1780, 2010];
const WEIGHTS = [82.4, 82.1, 81.9, 82.0, 81.6, 81.3, 81.4, 81.0];

const Example = ({ children, caption }: { children: ReactNode; caption: string }) => (
  <figure className="space-y-1.5">
    <div className="pointer-events-none select-none rounded-2xl border border-dashed p-2" style={{ borderColor: 'var(--bd)' }} aria-hidden="true">{children}</div>
    <figcaption className="text-xs muted">{caption}</figcaption>
  </figure>
);
const P = ({ children }: { children: ReactNode }) => <p className="text-[15px] leading-relaxed text-stone-700 dark:text-stone-300">{children}</p>;

export function Guide() {
  const u = useStore().settings.units;
  const t = sum(LUNCH);
  return (
    <div className="mx-auto max-w-xl space-y-3">
      <h1 className="text-2xl font-semibold">Guide</h1>
      <p className="text-sm muted">How it works, in plain words. Tap a topic.</p>

      <Fold icon="✨" title="What it does" open>
        <P>Take a photo of what you eat. The AI finds every food and drink on the plate, guesses each portion, and works out the calories, protein, carbs, fat, fiber and sugar. You check it, fix anything, and save. The app adds it all up for the day.</P>
        <P>The ring shows what’s <b>left</b> of today’s goal (it turns red with “over by” if you go past it). The bars under it are protein, carbs and fat against your goals.</P>
        <Example caption="Made-up day: 1,420 kcal eaten of a 2,200 goal.">
          <div className="flex flex-col items-center gap-3"><CalorieRing eaten={1420} goal={2200} units={u} size={170} /><div className="w-full"><MacroBars t={{ calories: 1420, protein: 96, carbs: 150, fat: 45, fiber: 18, sugar: 30 }} goals={{ protein: 138, carbs: 248, fat: 73 }} /></div></div>
        </Example>
      </Fold>

      <Fold icon="📸" title="Snap a meal">
        <P>Tap the big round camera button at the bottom (or <b>Snap a meal</b> on Today). Take the photo from above, with the whole plate in it: the plate, cutlery or your hand help the AI judge the size.</P>
        <P>In a few seconds you get the list: each food, its portion and grams, its calories and P / C / F (protein, carbs, fat). Things people forget, like cooking oil, butter, sauces and drinks, are counted too. “A rough guess” means the AI wasn’t sure about that one: worth a look.</P>
        <Example caption="Made-up lunch read from a photo.">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2"><span className="font-display text-lg font-semibold">Chicken, rice and broccoli</span><HealthBadge score={8} /></div>
            <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-2xl px-3 py-2.5" style={{ background: 'var(--trk)' }}><span className="num text-2xl font-semibold">{Math.round(t.calories)} kcal</span><MacroLine t={t} /></div>
            <FoodEditor items={LUNCH} units={u} readOnly />
          </div>
        </Example>
        <P>The <b>score</b> (1–10) says how balanced the meal is. With tips on (Settings → AI), you also get one or two short tips for your goal, in the same read.</P>
        <P>The meal (breakfast, lunch, dinner or snack) is picked from the time; change it before saving if you like. You can also change the day and time, for a meal you forgot.</P>
      </Fold>

      <Fold icon="✏️" title="Fixing the numbers">
        <P>Tap any food in the list to change it: its name, the grams (everything else follows), or quick sizes ×0.5 to ×2. You can also type the calories or protein yourself, or <b>Remove</b> something that isn’t there.</P>
        <P>Missing something? Type it in the “Add something” box (for example “a can of coke”) and it’s added to the meal. Tip: Settings → AI → <b>Ask for a note</b> lets you say “no dressing” or “I ate half” before the photo is read.</P>
        <P>Not happy with the answer? Tap <b>Ask Claude instead</b> (or Gemini) under the Save button to have the other AI read it.</P>
      </Fold>

      <Fold icon="➕" title="Other ways to add food">
        <P><b>✍️ Describe it</b>: type what you had (“2 eggs, toast with butter and a latte”) and the AI does the rest. Handy when there’s no photo.</P>
        <P><b>🏷️ Barcode</b>: for packaged food. Take a photo of the barcode (on most Android phones) or type its number. It’s looked up in Open Food Facts, a free public database: no AI, no cost. Pick the amount (a serving or grams).</P>
        <P><b>⭐ Favorites & recent</b>: meals you saved as a favorite, and everything from the last 2 weeks. One tap, no AI. To make a favorite, tick “Also save as a favorite” when you save.</P>
        <P><b>Eat it again today</b>: open any saved meal and tap it to copy it to today.</P>
        <Example caption="Made-up saved meal, as it shows on Today."><EntryRow e={ENTRY} units={u} src="" /></Example>
      </Fold>

      <Fold icon="💧" title="Water">
        <P>Tap a glass each time you drink one. Tap a full glass to go back to it. The glass size and your daily goal are in Settings; turn the water tracker off there if you don’t want it.</P>
        <Example caption="Made-up: 5 glasses of 250 ml."><WaterCard ml={1250} goal={2500} step={250} units={u} /></Example>
      </Fold>

      <Fold icon="📊" title="History">
        <P>Calories for each day against your goal (the dashed line), for 7 days, 30 days or 3 months. Amber bars went over the goal. Tap a bar to see its number.</P>
        <Example caption="Made-up week with a 2,200 kcal goal.">
          <CalorieBars goal={2200} days={DAYS.map((v, i) => { const d = addDays(todayStr(), i - 6); return { date: d, label: weekday(d), tip: shortDay(d), value: v }; })} />
        </Example>
        <P>Under it: your average day, how many days you stayed on goal, your streak (days in a row with something logged), where your calories come from (protein / carbs / fat), and the foods you eat most. Tap a day to open it.</P>
      </Fold>

      <Fold icon="⚖️" title="Weight">
        <P>Log your weight in the Weight tab (same time each day, before breakfast, is best). The chart shows the trend and your goal weight. Your newest weight also updates your daily calorie goal when it’s automatic.</P>
        <Example caption="Made-up weights over 8 weeks, with a goal of 78 kg.">
          <WeightLine unit="kg" goal={78} points={WEIGHTS.map((v, i) => { const d = addDays(todayStr(), (i - 7) * 7); return { date: d, label: shortDay(d), value: v }; })} />
        </Example>
      </Fold>

      <Fold icon="🎯" title="Your calorie goal">
        <P>Fill in <b>Settings → About you</b> (age, height, weight, how active you are, and whether you want to lose, keep or gain). The app works out what your body uses in a day, then takes off (or adds) enough to reach your pace: about 7,700 kcal for each kg. It never suggests less than 1,500 (men) or 1,200 (women).</P>
        <P>Prefer your own number? Turn off <b>Work out my calorie goal</b> in Settings → Daily goals and type it. The protein / carbs / fat split can be Balanced, High protein, Low carb, Keto, or your own.</P>
        <P>This is a helpful estimate, not medical advice. If you have a health condition, ask your doctor what’s right for you.</P>
      </Fold>

      <Fold icon="🤖" title="The AI and what it costs">
        <P><b>Gemini</b> (Google) is free within Google’s daily allowance and is asked first. <b>Claude</b> is the paid backup: about 1–2 cents a photo with Sonnet. If Gemini is over its daily limit, isn’t set up or fails, Claude takes over (turn this off in Settings → AI). You can switch which one goes first.</P>
        <P>Each AI has a daily limit you set (Settings → AI), so the cost can’t run away. The same photo or words are remembered for 7 days and never paid for twice. Barcodes, favorites and recent meals never use the AI.</P>
      </Fold>

      <Fold icon="🔒" title="Privacy">
        <P>Only you can open the app (your access code). Photos are made smaller on your phone first; the full photo never leaves it. The AI gets the smaller copy to read it, and a tiny copy is kept with the meal so you can see it (for 90 days, or not at all: Settings → Photos).</P>
        <P>Your meals, weights and settings are kept in your own storage (Upstash, linked to your Vercel account). Settings → Your data lets you download everything (spreadsheet or backup) or delete it all.</P>
      </Fold>

      <Fold icon="📲" title="Put it on your phone">
        <P><b>iPhone</b>: open the website in Safari, tap Share, then <b>Add to Home Screen</b>. <b>Android</b>: open it in Chrome, tap ⋮, then <b>Add to Home screen</b> (or Install app). It opens full-screen like an app, with its own icon.</P>
      </Fold>

      <Fold icon="🛠️" title="Setting it up (once)">
        <P>On Vercel, in the project’s <b>Settings → Environment Variables</b>:</P>
        <ul className="list-disc space-y-1 pl-5 text-[15px] text-stone-700 dark:text-stone-300">
          <li><b>APP_ACCESS_TOKEN</b>: a long secret code you make up. You type it once on each device.</li>
          <li><b>GEMINI_API_KEY</b>: free from Google AI Studio (aistudio.google.com → Get API key).</li>
          <li><b>ANTHROPIC_API_KEY</b> (optional, the paid backup): from console.anthropic.com.</li>
        </ul>
        <P>Then <b>Storage → Upstash for Redis</b> (free) → Create and connect it to the project: it adds its own keys. Redeploy, open the site and type your access code. Settings → AI shows a ✓ for each part that’s ready.</P>
      </Fold>
    </div>
  );
}
