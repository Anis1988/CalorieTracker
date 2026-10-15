import { useEffect, useState } from 'react';
import { useStore, dayOf } from '../lib/store';
import { addDays, dayLabel, todayStr } from '../lib/date';
import { macroGoals, sum, kcalText, energyUnit, energyNum } from '../lib/nutrition';
import { MEALS, type Entry } from '../lib/types';
import { CalorieRing, EntryRow, MacroBars, WaterCard } from '../components/Food';
import { AddSheet, EntrySheet, type AddMode } from '../components/Add';
import { ICONS, Icon, toast } from '../components/ui';
import { errText } from '../lib/api';

/** 🍽️ Today (or any day): the ring, macros, water, and every meal. */
export function Today({ date, setDate, add, setAdd }: { date: string; setDate: (d: string) => void; add: AddMode | null; setAdd: (m: AddMode | null) => void }) {
  const st = useStore();
  const s = st.settings;
  const [open, setOpen] = useState<Entry | null>(null);
  useEffect(() => { void st.loadRange(addDays(date, -1), addDays(date, 1)).catch(() => undefined); }, [date, st.loadRange]); // eslint-disable-line react-hooks/exhaustive-deps
  const d = dayOf(st.days, date);
  const t = sum(d.entries.flatMap((e) => e.items));
  const g = macroGoals(s);
  const isToday = date === todayStr();
  const tips = insights(t, g, d.entries.length, isToday);

  return (
    <div className="mx-auto max-w-xl space-y-3.5">
      <div className="flex items-center justify-between gap-2">
        <button className="btn h-11 w-11 !p-0" aria-label="Day before" onClick={() => setDate(addDays(date, -1))}><Icon d={ICONS.left} /></button>
        <div className="text-center">
          <p className="label">{isToday ? 'Your day' : 'Looking back'}</p><h1 className="text-2xl font-semibold">{dayLabel(date)}</h1>
          {!isToday && <button className="tap -mb-2 min-h-[32px] rounded-lg px-2 text-xs font-bold text-lime-700 underline dark:text-lime-300" onClick={() => setDate(todayStr())}>Back to today</button>}
        </div>
        <button className="btn h-11 w-11 !p-0" aria-label="Next day" disabled={isToday} onClick={() => setDate(addDays(date, 1))}><Icon d={ICONS.right} /></button>
      </div>

      <section className="card rise flex flex-col items-center gap-4 sm:flex-row sm:items-center">
        <CalorieRing eaten={t.calories} goal={g.calories} units={s.units} />
        <div className="w-full min-w-0 flex-1">
          {s.display.macros ? <MacroBars t={t} goals={g} /> : <p className="text-sm muted">Goal {kcalText(g.calories, s.units)} a day.</p>}
          {t.fiber > 0 && <p className="mt-2 text-xs muted">Fiber <b className="num text-stone-700 dark:text-stone-200">{Math.round(t.fiber)}</b> / {g.fiber} g · Sugar <b className="num text-stone-700 dark:text-stone-200">{Math.round(t.sugar)}</b> g</p>}
        </div>
      </section>

      <div className="rise rise-1 grid grid-cols-2 gap-2">
        <button className="btn-primary !min-h-[56px] !rounded-[20px] text-[15px]" onClick={() => setAdd('photo')}><Icon d={ICONS.camera} className="h-6 w-6" /> Snap a meal</button>
        <button className="btn !min-h-[56px] !rounded-[20px]" onClick={() => setAdd('pick')}><Icon d={ICONS.plus} className="h-5 w-5" /> Other ways</button>
      </div>

      {tips.length > 0 && (
        <section className="card rise rise-2 space-y-1 !py-3 text-sm">
          {tips.map((x) => <p key={x}>{x}</p>)}
        </section>
      )}

      {s.water.on && <WaterCard ml={d.water} goal={s.goals.waterMl} step={s.water.step} units={s.units} onSet={(ml) => void st.setWater(date, ml).catch((e) => toast('err', errText(e)))} />}

      {MEALS.map((m, i) => {
        const list = d.entries.filter((e) => e.meal === m.id);
        const mt = sum(list.flatMap((e) => e.items));
        return (
          <section key={m.id} className={`card rise rise-${Math.min(4, i + 1)} !pb-2`}>
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-[17px] font-semibold"><span aria-hidden="true">{m.icon}</span> {m.label}</h2>
              <span className="num text-sm muted">{list.length ? `${energyNum(mt.calories, s.units).toLocaleString()} ${energyUnit(s.units)}` : ''}</span>
            </div>
            {list.map((e) => <EntryRow key={e.id} e={e} units={s.units} onOpen={() => setOpen(e)} />)}
            {!list.length && <button className="btn-ghost -ml-2 mt-1 text-xs" onClick={() => setAdd('pick')}><Icon d={ICONS.plus} className="h-4 w-4" /> Add {m.label.toLowerCase()}</button>}
          </section>
        );
      })}

      {add && <AddSheet date={date} mode={add} onClose={() => setAdd(null)} />}
      {open && <EntrySheet entry={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

/** Free tips from today's numbers (no AI). */
export function insights(t: ReturnType<typeof sum>, g: ReturnType<typeof macroGoals>, meals: number, isToday: boolean): string[] {
  const out: string[] = [];
  if (!meals) return isToday ? ['📸 Snap your first meal: the AI lists each food with its calories.'] : [];
  const left = g.calories - t.calories;
  const hour = new Date().getHours();
  if (left < 0) out.push(`🔶 ${Math.round(-left)} kcal over your goal. A lighter next meal or a walk evens it out.`);
  else if (isToday && hour >= 20 && left > g.calories * 0.35) out.push(`🍽️ Still ${Math.round(left)} kcal left: eating too little can leave you hungry tomorrow.`);
  if (t.protein < g.protein * 0.6 && (!isToday || hour >= 16)) out.push(`💪 Protein is low (${Math.round(t.protein)} of ${g.protein} g): eggs, yogurt, chicken, beans or tofu help.`);
  if (t.fiber > 0 && t.fiber < g.fiber * 0.5 && (!isToday || hour >= 18)) out.push(`🥦 Fiber is low (${Math.round(t.fiber)} of ${g.fiber} g): vegetables, fruit, oats or beans.`);
  if (t.sugar > 50) out.push(`🍬 ${Math.round(t.sugar)} g of sugar so far: drinks and sweets add up quickly.`);
  if (!out.length && left >= 0 && t.protein >= g.protein * 0.8) out.push('✅ Nicely on track today.');
  return out.slice(0, 2);
}
