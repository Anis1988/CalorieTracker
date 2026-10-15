import { useEffect, useMemo, useState } from 'react';
import { useStore, dayOf } from '../lib/store';
import { addDays, shortDay, todayStr, weekday, dayLabel } from '../lib/date';
import { energyNum, energyUnit, macroGoals, sum } from '../lib/nutrition';
import type { DayData } from '../lib/types';
import { CalorieBars } from '../components/Charts';
import { MACROS, MacroLine } from '../components/Food';
import { Empty, Seg, toast } from '../components/ui';
import { errText } from '../lib/api';

type Range = 7 | 30 | 90;

/** 📊 History: calories per day against the goal, averages, streak, most eaten foods, and every day. */
export function History({ openDay }: { openDay: (d: string) => void }) {
  const st = useStore();
  const s = st.settings;
  const [range, setRange] = useState<Range>(() => { try { return (Number(localStorage.getItem('ct.range')) || 7) as Range; } catch { return 7; } });
  const [busy, setBusy] = useState(false);
  const today = todayStr();
  const from = addDays(today, -(range - 1));
  useEffect(() => {
    try { localStorage.setItem('ct.range', String(range)); } catch { /* private mode */ }
    setBusy(true);
    st.loadRange(from, today).catch((e) => toast('err', errText(e))).finally(() => setBusy(false));
  }, [from, today, range, st.loadRange]); // eslint-disable-line react-hooks/exhaustive-deps

  const g = macroGoals(s);
  const list = useMemo(() => Array.from({ length: range }, (_, i) => addDays(from, i)).map((date) => ({ date, d: dayOf(st.days, date) as DayData })), [st.days, from, range]);
  const logged = list.filter((x) => x.d.entries.length);
  const totals = logged.map((x) => sum(x.d.entries.flatMap((e) => e.items)));
  const avg = totals.length ? sum(totals) : null;
  const n = totals.length || 1;
  const onGoal = totals.filter((t) => t.calories <= g.calories * 1.05).length;
  const streak = (() => { let k = 0; for (let i = 0; i < 400; i++) { const dd = addDays(today, -i); if (dayOf(st.days, dd).entries.length) k++; else if (i > 0 || k) break; } return k; })();
  const top = useMemo(() => {
    const c = new Map<string, { name: string; n: number; kcal: number }>();
    for (const x of logged) for (const e of x.d.entries) for (const f of e.items) {
      const k = f.name.toLowerCase();
      const v = c.get(k) ?? { name: f.name, n: 0, kcal: 0 };
      v.n++; v.kcal += f.calories;
      c.set(k, v);
    }
    return [...c.values()].sort((a, b) => b.n - a.n || b.kcal - a.kcal).slice(0, 6);
  }, [logged]);
  const mk = avg ? { protein: avg.protein * 4, carbs: avg.carbs * 4, fat: avg.fat * 9 } : null;
  const mkSum = mk ? mk.protein + mk.carbs + mk.fat || 1 : 1;

  return (
    <div className="mx-auto max-w-xl space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">History</h1>
        {busy && <span className="spinner text-lime-600" aria-label="Loading" />}
      </div>
      <Seg label="Range" options={[[7, '7 days'], [30, '30 days'], [90, '3 months']]} value={range} onChange={setRange} />

      <section className="card rise">
        <div className="mb-2 flex items-baseline justify-between"><h2 className="font-display text-[17px] font-semibold">Calories per day</h2><span className="text-xs muted">tap a bar</span></div>
        <CalorieBars unit={energyUnit(s.units)} goal={energyNum(g.calories, s.units)}
          days={list.map((x) => ({ date: x.date, label: range === 7 ? weekday(x.date) : shortDay(x.date), tip: dayLabel(x.date), value: energyNum(sum(x.d.entries.flatMap((e) => e.items)).calories, s.units) }))} />
      </section>

      <div className="rise rise-1 grid grid-cols-3 gap-2">
        <Stat label="Average" value={avg ? energyNum(avg.calories / n, s.units).toLocaleString() : '—'} sub={`${energyUnit(s.units)} a day`} />
        <Stat label="On goal" value={`${onGoal}/${logged.length}`} sub="days logged" />
        <Stat label="Streak" value={String(streak)} sub={streak === 1 ? 'day in a row' : 'days in a row'} />
      </div>

      {avg && mk && (
        <section className="card rise rise-2 space-y-3">
          <h2 className="font-display text-[17px] font-semibold">Average day</h2>
          <MacroLine t={{ ...avg, protein: avg.protein / n, carbs: avg.carbs / n, fat: avg.fat / n }} className="!text-sm" />
          <div className="flex h-3 gap-[2px] overflow-hidden rounded-full" role="img" aria-label={MACROS.map((m) => `${m.label} ${Math.round((mk[m.key] / mkSum) * 100)}% of calories`).join(', ')}>
            {MACROS.map((m) => <div key={m.key} className="bar-grow h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(mk[m.key] / mkSum) * 100}%`, background: m.color }} />)}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {MACROS.map((m) => <span key={m.key} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: m.color }} aria-hidden="true" />{m.label} <b className="num">{Math.round((mk[m.key] / mkSum) * 100)}%</b></span>)}
          </div>
          <p className="text-xs muted">Share of calories from each. Your plan: {s.goals.macro === 'custom' ? 'your own split' : `${s.goals.macro}`} (Settings → Daily goals).</p>
        </section>
      )}

      {top.length > 0 && (
        <section className="card rise rise-3">
          <h2 className="mb-1 font-display text-[17px] font-semibold">Most eaten</h2>
          <ul className="divide-y divide-stone-900/[0.06] dark:divide-white/[0.06]">
            {top.map((f) => <li key={f.name} className="flex items-center justify-between gap-3 py-2 text-sm"><span className="min-w-0 truncate font-semibold">{f.name}</span><span className="shrink-0 muted">{f.n}× · <span className="num">{energyNum(f.kcal / f.n, s.units)}</span> {energyUnit(s.units)} each</span></li>)}
          </ul>
        </section>
      )}

      <section className="card rise rise-4 !pb-2">
        <h2 className="mb-1 font-display text-[17px] font-semibold">Days</h2>
        {[...list].reverse().filter((x) => x.d.entries.length || x.date === today).map((x) => {
          const t = sum(x.d.entries.flatMap((e) => e.items));
          const over = t.calories > g.calories * 1.05;
          return (
            <button key={x.date} className="tap -mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-2xl px-2 py-2.5 text-left" onClick={() => openDay(x.date)}>
              <span className="min-w-0 flex-1"><span className="block font-bold">{dayLabel(x.date)}</span><span className="block text-xs muted">{x.d.entries.length} meal{x.d.entries.length === 1 ? '' : 's'}</span></span>
              <span className={`num shrink-0 font-semibold ${over ? 'text-amber-700 dark:text-amber-300' : ''}`}>{energyNum(t.calories, s.units).toLocaleString()}</span>
              {over && <span className="shrink-0 text-xs font-bold text-amber-700 dark:text-amber-300">over</span>}
            </button>
          );
        })}
        {!logged.length && <Empty icon="📊">Nothing logged in this period yet.</Empty>}
      </section>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="card !rounded-[22px] !px-3 !py-3 text-center">
      <p className="label">{label}</p>
      <p className="big mt-2 truncate">{value}</p>
      <p className="mt-1 text-[11px] leading-tight muted">{sub}</p>
    </div>
  );
}
