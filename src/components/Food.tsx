import { useId, useState } from 'react';
import type { Entry, Food, Settings } from '../lib/types';
import { energyNum, energyUnit, kcalText, scaleFood, sum, waterText, type Totals } from '../lib/nutrition';
import { timeText } from '../lib/date';
import { ICONS, Icon, NumberBox, Thumb } from './ui';

/**
 * The food pieces of the app. Each is also drawn in the Guide with made-up numbers.
 * Macro colours (checked for colour-blind readers in light and dark): protein = sky, carbs = amber, fat = pink.
 * They always come with their name and number, never colour alone.
 */
export const MACROS = [
  { key: 'protein', label: 'Protein', short: 'P', color: 'var(--protein)' },
  { key: 'carbs', label: 'Carbs', short: 'C', color: 'var(--carbs)' },
  { key: 'fat', label: 'Fat', short: 'F', color: 'var(--fat)' },
] as const;

/** 🎯 The big ring: eaten against today's goal. */
export function CalorieRing({ eaten, goal, units, size = 196 }: { eaten: number; goal: number; units: Settings['units']; size?: number }) {
  const id = useId().replace(/:/g, '');
  const stroke = 16;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const share = goal > 0 ? eaten / goal : 0;
  const over = eaten > goal;
  const left = Math.round(goal - eaten);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`${Math.round(eaten)} of ${goal} calories eaten, ${over ? `${-left} over` : `${left} left`}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="overflow-visible">
        <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#a3e635" /><stop offset="1" stopColor="#f59e0b" /></linearGradient></defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} style={{ stroke: 'var(--trk)' }} />
        {eaten > 0 && <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${c * Math.min(1, share)} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`}
          stroke={over ? undefined : `url(#${id})`} className={`ring-arc transition-[stroke-dasharray] duration-700 ${over ? 'stroke-red-500 dark:stroke-red-400' : ''}`} style={over ? undefined : { filter: 'drop-shadow(0 0 8px rgba(163,230,53,.45))' }} />}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="label">{over ? 'Over by' : 'Left'}</span>
        <span className={`num text-[38px] font-semibold leading-none ${over ? 'text-red-600 dark:text-red-400' : 'text-stone-900 dark:text-white'}`}>{energyNum(Math.abs(left), units).toLocaleString()}</span>
        <span className="mt-1 text-xs muted"><span className="num">{energyNum(eaten, units).toLocaleString()}</span> / <span className="num">{energyNum(goal, units).toLocaleString()}</span> {energyUnit(units)}</span>
      </div>
    </div>
  );
}

/** Protein / carbs / fat against their goals. */
export function MacroBars({ t, goals }: { t: Totals; goals: { protein: number; carbs: number; fat: number } }) {
  return (
    <div className="space-y-2.5">
      {MACROS.map((m, i) => {
        const v = t[m.key], g = goals[m.key];
        const pct = g ? Math.min(100, (v / g) * 100) : 0;
        return (
          <div key={m.key}>
            <div className="flex items-baseline justify-between text-sm"><span className="font-bold">{m.label}</span><span className="num text-xs muted"><b className="text-stone-800 dark:text-stone-100">{Math.round(v)}</b> / {g} g</span></div>
            <div className="mt-1 h-2.5 overflow-hidden rounded-full" style={{ background: 'var(--trk)' }}>
              <div className="bar-grow h-full rounded-full" style={{ width: `${pct}%`, background: m.color, animationDelay: `${i * 0.08}s` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** "P 32 · C 40 · F 12" with coloured dots. */
export function MacroLine({ t, className = '' }: { t: Totals; className?: string }) {
  return (
    <span className={`inline-flex flex-wrap gap-x-2.5 text-xs muted ${className}`}>
      {MACROS.map((m) => <span key={m.key} className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: m.color }} aria-hidden="true" />{m.short} <b className="num font-semibold text-stone-700 dark:text-stone-200">{Math.round(t[m.key])}</b>g</span>)}
    </span>
  );
}

export function HealthBadge({ score }: { score: number }) {
  if (!score) return null;
  const tone = score >= 7 ? 'bg-lime-500/15 text-lime-800 dark:text-lime-300' : score >= 4 ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300' : 'bg-red-500/15 text-red-700 dark:text-red-300';
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-extrabold ${tone}`} title="How balanced the meal is, 1 to 10"><Icon d={ICONS.spark} className="h-3.5 w-3.5" stroke={2} />{score}/10</span>;
}

/**
 * ✏️ The breakdown, ready to fix: change any amount (everything scales with it), rename, remove, or add an item.
 * readOnly: just shows it (Guide, a saved meal).
 */
export function FoodEditor({ items, onChange, units, readOnly }: { items: Food[]; onChange?: (f: Food[]) => void; units: Settings['units']; readOnly?: boolean }) {
  const [open, setOpen] = useState<number | null>(null);
  const set = (i: number, f: Food) => onChange?.(items.map((x, j) => (j === i ? f : x)));
  return (
    <ul className="space-y-2">
      {items.map((f, i) => (
        <li key={i} className="rounded-2xl border p-3" style={{ borderColor: 'var(--bd)', background: 'var(--gl2)' }}>
          <button className="flex w-full items-start gap-3 text-left" onClick={() => !readOnly && setOpen(open === i ? null : i)} aria-expanded={open === i} disabled={readOnly}>
            <span className="min-w-0 flex-1">
              <span className="block font-bold leading-snug">{f.name}</span>
              <span className="block text-xs muted">{f.portion}{f.grams ? ` · ${f.grams} g` : ''}{f.confidence && f.confidence < 60 ? ' · a rough guess' : ''}</span>
              <MacroLine t={f} className="mt-1" />
            </span>
            <span className="num shrink-0 text-right text-[15px] font-semibold">{energyNum(f.calories, units)}<span className="block text-[10px] font-normal muted">{energyUnit(units)}</span></span>
          </button>
          {open === i && !readOnly && (
            <div className="rise mt-3 space-y-2 border-t pt-3" style={{ borderColor: 'var(--bd)' }}>
              <label className="block text-xs font-semibold muted">Name<input className="input mt-1 w-full" value={f.name} onChange={(e) => set(i, { ...f, name: e.target.value })} /></label>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold muted">Amount</span>
                {[0.5, 0.75, 1.25, 1.5, 2].map((x) => <button key={x} className="chip" onClick={() => set(i, scaleFood(f, f.grams * x))}>×{x}</button>)}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <NumberBox label="Grams" value={f.grams} unit="g" max={5000} onChange={(g) => set(i, scaleFood(f, g))} />
                <NumberBox label="Calories" value={f.calories} unit="kcal" max={10000} onChange={(n) => set(i, { ...f, calories: n })} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {MACROS.map((m) => <label key={m.key} className="text-xs font-semibold muted">{m.label}<NumberBox label={m.label} value={f[m.key]} unit="g" width="w-full" step={0.1} max={2000} onChange={(n) => set(i, { ...f, [m.key]: n })} /></label>)}
              </div>
              <button className="btn-ghost text-red-700 dark:text-red-300" onClick={() => { onChange?.(items.filter((_, j) => j !== i)); setOpen(null); }}><Icon d={ICONS.trash} className="h-4 w-4" /> Remove</button>
            </div>
          )}
        </li>
      ))}
      {!items.length && <li className="rounded-2xl border border-dashed p-4 text-center text-sm muted" style={{ borderColor: 'var(--bd)' }}>No food found.</li>}
    </ul>
  );
}

/** One saved meal in a list. */
export function EntryRow({ e, units, onOpen, src }: { e: Entry; units: Settings['units']; onOpen?: () => void; src?: string }) {
  const t = sum(e.items);
  return (
    <button className="tap -mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-2xl px-2 py-2 text-left" onClick={onOpen}>
      <Thumb id={e.photo} src={src} fallback={e.source === 'barcode' ? '🏷️' : e.source === 'text' ? '✍️' : '🍽️'} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-bold">{e.title}</span>
        <span className="block text-xs muted">{timeText(e.time)} · {e.items.length} item{e.items.length === 1 ? '' : 's'}</span>
        <MacroLine t={t} />
      </span>
      <span className="num shrink-0 text-right font-semibold">{kcalText(t.calories, units).replace(/ (kcal|kJ)/, '')}<span className="block text-[10px] font-normal muted">{energyUnit(units)}</span></span>
    </button>
  );
}

/** 💧 Water: tap a glass to add one. */
export function WaterCard({ ml, goal, step, units, onSet }: { ml: number; goal: number; step: number; units: Settings['units']; onSet?: (ml: number) => void }) {
  const glasses = Math.max(1, Math.round(goal / step));
  const full = Math.floor(ml / step);
  return (
    <section className="card rise rise-3">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="font-display text-[17px] font-semibold">💧 Water</h2>
        <span className="num text-sm muted"><b className="text-stone-800 dark:text-stone-100">{waterText(ml, units)}</b> / {waterText(goal, units)}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: Math.min(16, Math.max(glasses, full)) }, (_, i) => (
          <button key={i} aria-label={i < full ? `Glass ${i + 1}, drunk` : `Add glass ${i + 1}`} onClick={() => onSet?.(i < full ? i * step : (i + 1) * step)}
            className={`tap flex h-11 w-9 items-end justify-center rounded-b-xl rounded-t-md border pb-1 transition ${i < full ? 'border-sky-400/60 bg-gradient-to-t from-sky-400/70 to-sky-300/30 text-white' : 'text-stone-400'}`} style={i < full ? undefined : { borderColor: 'var(--bd)' }}>
            {i < full ? <Icon d={ICONS.drop} className="pop-in h-4 w-4" /> : <Icon d={ICONS.plus} className="h-3.5 w-3.5" />}
          </button>
        ))}
      </div>
      {onSet && ml > 0 && <button className="btn-ghost mt-1 text-xs" onClick={() => onSet(Math.max(0, ml - step))}><Icon d={ICONS.minus} className="h-4 w-4" /> Take one off</button>}
    </section>
  );
}
