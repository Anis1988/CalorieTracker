import { useState } from 'react';
import { useStore } from '../lib/store';
import { api, errText, setCode } from '../lib/api';
import { getServer, isNative, setServer, shareText } from '../lib/native';
import { todayStr } from '../lib/date';
import { ACTIVITIES, MACRO_PLANS, autoCalories, bmr, kcalText, kgToLb, lbToKg, macroGoals, tdee, weightNum, waterText } from '../lib/nutrition';
import { ALLERGIES, CLAUDE_MODELS, DIETS, GEMINI_MODELS, TOOLS, type Settings as S } from '../lib/types';
import { ChipInput } from '../components/Cooking';
import { Field, Fold, NumberBox, Seg, Toggle, toast } from '../components/ui';
import { SkinProfile, profileLine } from '../components/Beauty';

/** ⚙️ Everything you can change. Each change is saved at once (one copy on the server, the same on every device). */
export function Settings({ space = 'food' }: { space?: 'food' | 'beauty' | 'cooking' }) {
  const st = useStore();
  const s = st.settings;
  const u = s.units;
  const save = (next: S) => void st.saveSettings(next).catch((e) => toast('err', errText(e)));
  const set = <K extends keyof S>(k: K, patch: Partial<S[K]>) => save({ ...s, [k]: { ...s[k], ...patch } });
  const g = macroGoals(s);
  const kg = (n: number) => (u.weight === 'lb' ? lbToKg(n) : n);
  const status = st.status;
  const customSum = s.goals.custom.protein + s.goals.custom.carbs + s.goals.custom.fat;

  return (
    <div className="mx-auto max-w-xl space-y-3">
      <h1 className="text-2xl font-semibold">Settings</h1>

      {space === 'beauty' ? (
        <Fold icon="🌸" title="Your skin" subtitle={profileLine(s.beauty)}>
          <SkinProfile />
        </Fold>
      ) : space === 'cooking' ? <KitchenFold /> : (<>
      <Fold icon="👤" title="About you" subtitle={`${s.profile.age} y · ${weightNum(s.profile.weightKg, u)} ${u.weight} · ${s.profile.goal === 'lose' ? 'losing' : s.profile.goal === 'gain' ? 'gaining' : 'keeping'} weight`}>
        <Field label="Sex" hint="Used only for the calorie maths."><Seg label="Sex" options={[['male', 'Male'], ['female', 'Female']]} value={s.profile.sex} onChange={(v) => set('profile', { sex: v })} className="w-44" /></Field>
        <Field label="Age"><NumberBox label="Age" value={s.profile.age} min={12} max={100} unit="years" onChange={(n) => set('profile', { age: n })} /></Field>
        <Field label="Height">
          {u.height === 'cm' ? <NumberBox label="Height" value={s.profile.heightCm} min={100} max={250} unit="cm" onChange={(n) => set('profile', { heightCm: n })} /> : <>
            <NumberBox label="Feet" width="w-16" value={Math.floor(Math.round(s.profile.heightCm / 2.54) / 12)} min={3} max={8} unit="ft" onChange={(n) => set('profile', { heightCm: Math.round((n * 12 + (Math.round(s.profile.heightCm / 2.54) % 12)) * 2.54) })} />
            <NumberBox label="Inches" width="w-16" value={Math.round(s.profile.heightCm / 2.54) % 12} min={0} max={11} unit="in" onChange={(n) => set('profile', { heightCm: Math.round((Math.floor(Math.round(s.profile.heightCm / 2.54) / 12) * 12 + n) * 2.54) })} />
          </>}
        </Field>
        <Field label="Weight" hint="Logging your weight updates this by itself."><NumberBox label="Weight" value={weightNum(s.profile.weightKg, u)} step={0.1} min={20} max={900} unit={u.weight} onChange={(n) => set('profile', { weightKg: Math.round(kg(n) * 10) / 10 })} /></Field>
        <Field label="How active you are">
          <select className="input max-w-[16rem]" value={s.profile.activity} onChange={(e) => set('profile', { activity: e.target.value as S['profile']['activity'] })} aria-label="How active you are">
            {ACTIVITIES.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
        </Field>
        <Field label="Your goal"><Seg label="Goal" options={[['lose', 'Lose'], ['maintain', 'Keep'], ['gain', 'Gain']]} value={s.profile.goal} onChange={(v) => set('profile', { goal: v })} className="w-56" /></Field>
        {s.profile.goal !== 'maintain' && (
          <Field label="How fast" hint="Slower is easier to keep up. 0.5 kg (about 1 lb) a week is a common choice.">
            <select className="input" value={s.profile.pace} onChange={(e) => set('profile', { pace: Number(e.target.value) })} aria-label="How fast">
              {[0.25, 0.5, 0.75, 1].map((p) => <option key={p} value={p}>{u.weight === 'lb' ? `${(kgToLb(p)).toFixed(1)} lb` : `${p} kg`} a week</option>)}
            </select>
          </Field>
        )}
        <Field label="Goal weight" hint="Optional: shown on the Weight chart.">
          <NumberBox blankZero label="Goal weight" value={s.profile.goalWeightKg ? weightNum(s.profile.goalWeightKg, u) : 0} step={0.1} max={900} unit={u.weight} onChange={(n) => set('profile', { goalWeightKg: n ? Math.round(kg(n) * 10) / 10 : null })} />
        </Field>
        <p className="rounded-2xl p-3 text-xs muted" style={{ background: 'var(--trk)' }}>Your body uses about <b>{kcalText(bmr(s.profile), u)}</b> at rest and <b>{kcalText(tdee(s.profile), u)}</b> on a normal day. Suggested goal: <b>{kcalText(autoCalories(s.profile), u)}</b> a day.</p>
      </Fold>

      <Fold icon="🎯" title="Daily goals" subtitle={`${kcalText(g.calories, u)} · P ${g.protein} g · C ${g.carbs} g · F ${g.fat} g`}>
        <Field label="Work out my calorie goal" hint="From About you. Turn off to type your own."><Toggle on={s.goals.auto} onChange={(v) => set('goals', { auto: v, calories: v ? s.goals.calories : autoCalories(s.profile) })} label="Automatic calorie goal" /></Field>
        {!s.goals.auto && <Field label="Calories a day"><NumberBox label="Calories a day" value={s.goals.calories} min={800} max={8000} step={10} unit="kcal" onChange={(n) => set('goals', { calories: n })} /></Field>}
        <Field label="Protein, carbs and fat">
          <select className="input" value={s.goals.macro} onChange={(e) => set('goals', { macro: e.target.value as S['goals']['macro'] })} aria-label="Macro plan">
            {MACRO_PLANS.map((m) => <option key={m.id} value={m.id}>{m.label}{m.id !== 'custom' ? ` (${m.split.protein}/${m.split.carbs}/${m.split.fat})` : ''}</option>)}
          </select>
        </Field>
        {s.goals.macro === 'custom' && (
          <div className="space-y-1 rounded-2xl p-3" style={{ background: 'var(--trk)' }}>
            {(['protein', 'carbs', 'fat'] as const).map((k) => <Field key={k} label={`${k[0].toUpperCase()}${k.slice(1)} (% of calories)`}><NumberBox label={`${k} percent`} value={s.goals.custom[k]} min={0} max={100} unit="%" onChange={(n) => set('goals', { custom: { ...s.goals.custom, [k]: n } })} /></Field>)}
            <p className={`text-xs ${customSum === 100 ? 'muted' : 'font-bold text-amber-700 dark:text-amber-300'}`}>Total {customSum}%{customSum !== 100 ? ': make it 100%' : ''}</p>
          </div>
        )}
        <Field label="Fiber"><NumberBox label="Fiber goal" value={s.goals.fiber} min={0} max={100} unit="g" onChange={(n) => set('goals', { fiber: n })} /></Field>
        <Field label="Water" hint={waterText(s.goals.waterMl, u)}><NumberBox label="Water goal" value={u.water === 'oz' ? Math.round(s.goals.waterMl / 29.5735) : s.goals.waterMl} min={0} max={u.water === 'oz' ? 300 : 9000} step={u.water === 'oz' ? 1 : 50} unit={u.water} onChange={(n) => set('goals', { waterMl: Math.round(u.water === 'oz' ? n * 29.5735 : n) })} /></Field>
      </Fold>

      <Fold icon="📏" title="Units" subtitle={`${u.weight} · ${u.height === 'cm' ? 'cm' : 'ft/in'} · ${u.water} · ${u.energy}`}>
        <Field label="Weight"><Seg label="Weight unit" options={[['kg', 'kg'], ['lb', 'lb']]} value={u.weight} onChange={(v) => set('units', { weight: v })} className="w-36" /></Field>
        <Field label="Height"><Seg label="Height unit" options={[['cm', 'cm'], ['ftin', 'ft / in']]} value={u.height} onChange={(v) => set('units', { height: v })} className="w-36" /></Field>
        <Field label="Water"><Seg label="Water unit" options={[['ml', 'ml'], ['oz', 'oz']]} value={u.water} onChange={(v) => set('units', { water: v })} className="w-36" /></Field>
        <Field label="Energy"><Seg label="Energy unit" options={[['kcal', 'kcal'], ['kJ', 'kJ']]} value={u.energy} onChange={(v) => set('units', { energy: v })} className="w-36" /></Field>
      </Fold>

      <Fold icon="🍽️" title="Meals" subtitle="Which meal a photo goes to, by the time">
        <p className="text-xs muted">A meal is put in Breakfast, Lunch, Dinner or Snacks by the time you add it. You can always change it before saving.</p>
        <Field label="Breakfast until"><input type="time" className="input" value={s.meals.breakfastUntil} onChange={(e) => e.target.value && set('meals', { breakfastUntil: e.target.value })} aria-label="Breakfast until" /></Field>
        <Field label="Lunch until"><input type="time" className="input" value={s.meals.lunchUntil} onChange={(e) => e.target.value && set('meals', { lunchUntil: e.target.value })} aria-label="Lunch until" /></Field>
        <Field label="Dinner until" hint="After this it’s a snack."><input type="time" className="input" value={s.meals.dinnerUntil} onChange={(e) => e.target.value && set('meals', { dinnerUntil: e.target.value })} aria-label="Dinner until" /></Field>
      </Fold>

      </>)}

      <Fold icon="🤖" title="AI"  subtitle={`${s.ai.provider === 'gemini' ? 'Gemini (free)' : 'Claude (paid)'} first${s.ai.fallback ? ', the other as backup' : ''} · today ${status?.used.gemini ?? 0} + ${status?.used.claude ?? 0}`}>
        <div className="flex flex-wrap gap-1.5 pb-1">
          <Chip ok={!!status?.keys.gemini} label="Gemini key" />
          <Chip ok={!!status?.keys.claude} label="Claude key" />
          <Chip ok={!!status?.store} label="Storage" />
        </div>
        <p className="rounded-2xl p-3 text-xs muted" style={{ background: 'var(--trk)' }}>The AI you pick here is used everywhere: 🥗 Calories, 💄 Beauty and 🍳 Cooking. To use the paid Claude for everything, pick <b>Claude</b> below, then Sonnet or Opus.</p>
        <Field label="Ask first" hint="Gemini is free (within Google’s daily allowance). Claude costs a little per read.">
          <Seg label="AI asked first" options={[['gemini', 'Gemini (free)'], ['claude', 'Claude']]} value={s.ai.provider} onChange={(v) => set('ai', { provider: v })} className="w-56" />
        </Field>
        <Field label="Use the other AI as a backup" hint="When the first one is over its daily limit, isn’t set up, or fails."><Toggle on={s.ai.fallback} onChange={(v) => set('ai', { fallback: v })} label="Backup AI" /></Field>
        <Field label="Gemini model" hint={GEMINI_MODELS.find((m) => m.id === s.ai.geminiModel)?.hint}>
          <select className="input" value={s.ai.geminiModel} onChange={(e) => set('ai', { geminiModel: e.target.value })} aria-label="Gemini model">{GEMINI_MODELS.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
        </Field>
        <Field label="Claude model" hint={CLAUDE_MODELS.find((m) => m.id === s.ai.claudeModel)?.hint}>
          <select className="input" value={s.ai.claudeModel} onChange={(e) => set('ai', { claudeModel: e.target.value })} aria-label="Claude model">{CLAUDE_MODELS.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
        </Field>
        <Field label="Claude: how hard it thinks" hint="Low is quick and cheapest, and plenty for food.">
          <Seg label="Effort" options={[['low', 'Low'], ['medium', 'Medium'], ['high', 'High']]} value={s.ai.effort} onChange={(v) => set('ai', { effort: v })} className="w-56" />
        </Field>
        <Field label="Gemini: most reads a day" hint={`Used today: ${status?.used.gemini ?? 0}`}><NumberBox label="Gemini daily limit" value={s.ai.geminiDailyLimit} min={0} max={1500} onChange={(n) => set('ai', { geminiDailyLimit: n })} /></Field>
        <Field label="Claude: most reads a day" hint={`Used today: ${status?.used.claude ?? 0}. Keeps the cost under control.`}>
          {!s.ai.claudeUnlimited && <NumberBox label="Claude daily limit" value={s.ai.claudeDailyLimit} min={0} max={500} onChange={(n) => set('ai', { claudeDailyLimit: n })} />}
          <span className="text-xs muted">No limit</span><Toggle on={s.ai.claudeUnlimited} onChange={(v) => set('ai', { claudeUnlimited: v })} label="Claude with no daily limit" />
        </Field>
        <Field label="Remember answers for" hint="The same photo or words are answered again for free."><NumberBox label="Remember answers for" value={s.ai.rememberDays} min={0} max={90} unit="days" onChange={(n) => set('ai', { rememberDays: n })} /></Field>
        <Field label="Ask for a note before reading a photo" hint="e.g. “no dressing”, “I ate half”. Off = the photo is read straight away."><Toggle on={s.ai.askNote} onChange={(v) => set('ai', { askNote: v })} label="Ask for a note" /></Field>
        <Field label="Let me check before saving" hint="Off = a photo is saved as soon as it’s read (you can still change it after)."><Toggle on={s.ai.review} onChange={(v) => set('ai', { review: v })} label="Check before saving" /></Field>
        <Field label="Tips with each meal" hint="1–2 short tips for your goal, in the same AI read (no extra cost)."><Toggle on={s.ai.tips} onChange={(v) => set('ai', { tips: v })} label="Tips" /></Field>
      </Fold>

      <Fold icon="📸" title="Photos" subtitle={s.photos.keep ? `Small copies kept ${s.photos.days} days` : 'Not kept'}>
        <Field label="Keep a small copy of each photo" hint="So your meals show their picture. The full photo never leaves your phone."><Toggle on={s.photos.keep} onChange={(v) => set('photos', { keep: v })} label="Keep photos" /></Field>
        {s.photos.keep && <Field label="Keep them for"><NumberBox label="Keep photos for" value={s.photos.days} min={1} max={730} unit="days" onChange={(n) => set('photos', { days: n })} /></Field>}
      </Fold>

      <Fold icon="🎨" title="Look" subtitle={`${s.display.theme === 'auto' ? 'Follows your phone' : s.display.theme === 'dark' ? 'Dark' : 'Light'}`}>
        <Field label="Light or dark"><Seg label="Theme" options={[['auto', 'Phone'], ['light', 'Light'], ['dark', 'Dark']]} value={s.display.theme} onChange={(v) => { applyTheme(v); set('display', { theme: v }); }} className="w-56" /></Field>
        <Field label="💄 Beauty side" hint="In the switch at the top."><Toggle on={s.beauty.on} onChange={(v) => set('beauty', { on: v })} label="Beauty side" /></Field>
        <Field label="🍳 Cooking side" hint="In the switch at the top. Both off = a calories-only app."><Toggle on={s.cooking.on} onChange={(v) => set('cooking', { on: v })} label="Cooking side" /></Field>
        {space === 'food' && <>
        <Field label="Show protein, carbs and fat bars"><Toggle on={s.display.macros} onChange={(v) => set('display', { macros: v })} label="Macro bars" /></Field>
        <Field label="Show the meal score (1–10)"><Toggle on={s.display.healthScore} onChange={(v) => set('display', { healthScore: v })} label="Meal score" /></Field>
        <Field label="Water tracker"><Toggle on={s.water.on} onChange={(v) => set('water', { on: v })} label="Water tracker" /></Field>
        {s.water.on && <Field label="One glass is" hint={waterText(s.water.step, u)}><NumberBox label="Glass size" value={u.water === 'oz' ? Math.round(s.water.step / 29.5735) : s.water.step} min={u.water === 'oz' ? 2 : 50} max={u.water === 'oz' ? 40 : 1000} step={u.water === 'oz' ? 1 : 50} unit={u.water} onChange={(n) => set('water', { step: Math.round(u.water === 'oz' ? n * 29.5735 : n) })} /></Field>}
        </>}
      </Fold>

      <DataFold />

      <Fold icon="🔑" title="This device" subtitle="Your access code">
        <p className="text-sm muted">The access code is saved on this phone only. Signing out removes it here; your meals stay safe on the server.</p>
        {isNative() && <SiteAddress />}
        <button className="btn mt-2" onClick={() => { setCode(''); location.reload(); }}>Sign out on this device</button>
      </Fold>
    </div>
  );
}

const Chip = ({ ok, label }: { ok: boolean; label: string }) => (
  <span className={`chip !cursor-default ${ok ? '!border-lime-400 text-lime-800 dark:text-lime-300' : 'text-stone-500'}`}>{ok ? '✓' : '○'} {label}</span>
);

export function applyTheme(t: 'auto' | 'light' | 'dark') {
  try { localStorage.setItem('ct.theme', t); } catch { /* private mode */ }
  document.documentElement.classList.toggle('dark', t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches));
}

/** 💾 Download everything (spreadsheet or backup) or delete it all. */
function DataFold() {
  const st = useStore();
  const [busy, setBusy] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const download = (name: string, type: string, text: string) => {
    if (isNative()) return void shareText(name, text).catch((e) => toast('err', errText(e)));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  const all = async () => (await api.days('2024-01-01', todayStr())).days;
  const csv = async () => {
    setBusy(true);
    try {
      const days = await all();
      const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const rows = [['date', 'time', 'meal', 'meal name', 'food', 'portion', 'grams', 'kcal', 'protein g', 'carbs g', 'fat g', 'fiber g', 'sugar g'].join(',')];
      for (const d of Object.keys(days).sort()) for (const e of days[d].entries) for (const f of e.items) rows.push([e.date, e.time, e.meal, e.title, f.name, f.portion, f.grams, f.calories, f.protein, f.carbs, f.fat, f.fiber, f.sugar].map(q).join(','));
      download(`calories-${todayStr()}.csv`, 'text/csv', rows.join('\n'));
    } catch (e) { toast('err', errText(e)); }
    setBusy(false);
  };
  const json = async () => {
    setBusy(true);
    try { download(`calorie-tracker-backup-${todayStr()}.json`, 'application/json', JSON.stringify({ settings: st.settings, days: await all(), weights: st.weights, favorites: st.favorites, beautyShelf: st.shelf }, null, 1)); } catch (e) { toast('err', errText(e)); }
    setBusy(false);
  };
  const wipe = async () => {
    setBusy(true);
    try { await api.wipe(); toast('ok', 'Everything was deleted.'); setConfirmText(''); await st.refresh(); } catch (e) { toast('err', errText(e)); }
    setBusy(false);
  };
  return (
    <Fold icon="💾" title="Your data" subtitle="Download or delete">
      <div className="flex flex-wrap gap-2 pt-1">
        <button className="btn" disabled={busy} onClick={() => void csv()}>⬇️ Spreadsheet (.csv)</button>
        <button className="btn" disabled={busy} onClick={() => void json()}>⬇️ Full backup (.json)</button>
      </div>
      <p className="pt-1 text-xs muted">The spreadsheet has one line per food (opens in Excel or Google Sheets).</p>
      <div className="mt-3 space-y-2 rounded-2xl border border-red-300 p-3 dark:border-red-900">
        <p className="text-sm font-bold text-red-700 dark:text-red-300">Delete everything</p>
        <p className="text-xs muted">Every meal, photo, weight, favorite, beauty product and setting. This can’t be undone. Type DELETE to confirm.</p>
        <div className="flex gap-2">
          <input className="input min-w-0 flex-1" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="DELETE" aria-label="Type DELETE to confirm" />
          <button className="btn-danger" disabled={busy || confirmText !== 'DELETE'} onClick={() => void wipe()}>Delete</button>
        </div>
      </div>
    </Fold>
  );
}

/** Android app: the website it talks to (the same meals and settings as in the browser). */
function SiteAddress() {
  const [v, setV] = useState(getServer());
  return (
    <div className="space-y-1.5 pt-2">
      <label className="block text-sm font-semibold">Your site’s address
        <input className="input mt-1 w-full" type="url" inputMode="url" autoCapitalize="none" autoCorrect="off" value={v} onChange={(e) => setV(e.target.value)} />
      </label>
      <button className="btn" disabled={!v.trim() || v.trim() === getServer()} onClick={() => { setServer(v); location.reload(); }}>Save address</button>
    </div>
  );
}

/** 🍳 Settings → Your kitchen (Cooking side). */
function KitchenFold() {
  const st = useStore();
  const c = st.settings.cooking;
  const set = (p: Partial<S['cooking']>) => void st.saveSettings({ ...st.settings, cooking: { ...c, ...p } }).catch((e) => toast('err', errText(e)));
  const tog = (l: string[], v: string) => (l.includes(v) ? l.filter((x) => x !== v) : [...l, v]);
  const chip = (on: boolean) => `chip !px-3 !py-1.5 ${on ? '!border-transparent bg-gradient-to-br from-orange-300 to-orange-500 text-[#2b1203]' : ''}`;
  return (
    <Fold icon="🍳" title="Your kitchen" subtitle={[c.diet || 'Any diet', c.allergies.length ? `allergies: ${c.allergies.join(', ')}` : '', `${c.servings} servings`].filter(Boolean).join(' · ')} open>
      <p className="pt-1 text-sm font-bold">Diet</p>
      <div className="flex flex-wrap gap-1.5">{['', ...DIETS].map((d) => <button key={d || 'any'} className={chip(c.diet === d)} aria-pressed={c.diet === d} onClick={() => set({ diet: d })}>{d || 'Anything'}</button>)}</div>
      <p className="pt-3 text-sm font-bold">Allergies <span className="font-normal muted">(never used, and double-checked)</span></p>
      <div className="flex flex-wrap gap-1.5">{ALLERGIES.map((a) => <button key={a} className={chip(c.allergies.includes(a))} aria-pressed={c.allergies.includes(a)} onClick={() => set({ allergies: tog(c.allergies, a) })}>{c.allergies.includes(a) ? '🚫 ' : ''}{a}</button>)}</div>
      <p className="pt-3 text-sm font-bold">Foods I don’t like</p>
      <ChipInput label="foods I don't like" values={c.dislikes} onChange={(v) => set({ dislikes: v })} placeholder="e.g. mushrooms, coriander" />
      <p className="pt-3 text-sm font-bold">Always in my kitchen</p>
      <ChipInput label="staples" values={c.staples} onChange={(v) => set({ staples: v })} placeholder="e.g. salt, olive oil, garlic" />
      <p className="pt-3 text-sm font-bold">My kitchen tools</p>
      <div className="flex flex-wrap gap-1.5">{TOOLS.map((t) => <button key={t} className={chip(c.tools.includes(t))} aria-pressed={c.tools.includes(t)} onClick={() => set({ tools: tog(c.tools, t) })}>{t}</button>)}</div>
      <div className="pt-2">
        <Field label="Servings" hint="Usual number of people"><NumberBox label="Servings" value={c.servings} min={1} max={12} onChange={(n) => set({ servings: n })} /></Field>
        <Field label="Time limit" hint="0 = any"><NumberBox label="Time limit" value={c.maxTime} min={0} max={240} step={5} unit="min" onChange={(n) => set({ maxTime: n })} /></Field>
        <Field label="How hard"><Seg label="How hard" options={[['easy', 'Easy'], ['medium', 'Medium'], ['any', 'Any']]} value={c.skill} onChange={(v) => set({ skill: v })} className="w-52" /></Field>
        <Field label="Recipes per search" hint="Fewer is quicker and cheaper"><Seg label="Recipes per search" options={[[4, '4'], [6, '6'], [8, '8']]} value={c.count} onChange={(v) => set({ count: v })} className="w-40" /></Field>
        <Field label="Amounts in"><Seg label="Recipe units" options={[['metric', 'g / ml'], ['us', 'cups / oz']]} value={c.units} onChange={(v) => set({ units: v })} className="w-48" /></Field>
        <Field label="Fit my day, every time" hint="Recipes aim at what’s left of today’s calories"><Toggle on={c.fitDay} onChange={(v) => set({ fitDay: v })} label="Fit my day by default" /></Field>
        <div className="py-2">
          <p className="text-sm font-semibold">Recipe pictures</p>
          <p className="mb-1.5 text-xs muted">Real photos are free. An AI picture shows the exact dish (Gemini, about 4 cents, made once and kept).</p>
          <Seg label="Recipe pictures" options={[['real', 'Real only'], ['opened', 'AI on open'], ['all', 'AI for all']]} value={c.pictures} onChange={(v) => set({ pictures: v })} />
        </div>
        {c.pictures !== 'real' && <Field label="AI pictures a day, at most" hint={`Made today: ${st.status?.used.image ?? 0}`}><NumberBox label="AI pictures a day" value={c.aiPicsPerDay} min={0} max={200} onChange={(n) => set({ aiPicsPerDay: n })} /></Field>}
      </div>
    </Fold>
  );
}
