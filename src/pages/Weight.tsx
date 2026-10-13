import { useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { addDays, dayLabel, shortDay, todayStr } from '../lib/date';
import { autoCalories, bmi, bmiLabel, kcalText, lbToKg, weightNum, weightText } from '../lib/nutrition';
import { WeightLine } from '../components/Charts';
import { ICONS, Icon, Seg, toast } from '../components/ui';
import { errText } from '../lib/api';

type Range = 30 | 90 | 365 | 0;

/** ⚖️ Weight: log it, see the trend and how far the goal is. The newest weight also updates your calorie goal. */
export function Weight() {
  const st = useStore();
  const s = st.settings;
  const u = s.units;
  const [range, setRange] = useState<Range>(90);
  const [date, setDate] = useState(todayStr());
  const [text, setText] = useState('');
  const all = useMemo(() => Object.entries(st.weights).sort((a, b) => a[0].localeCompare(b[0])), [st.weights]);
  const from = range ? addDays(todayStr(), -range) : '0000';
  const shown = all.filter(([d]) => d >= from);
  const latest = all[all.length - 1];
  const first = shown[0];
  const change = latest && first ? latest[1] - first[1] : 0;
  const goal = s.profile.goalWeightKg;

  const save = async () => {
    const n = Number(text.replace(',', '.'));
    const kg = u.weight === 'lb' ? lbToKg(n) : n;
    if (!(kg > 20 && kg < 400)) return toast('err', 'That weight doesn’t look right.');
    try {
      await st.saveWeight(date, kg);
      // The newest weight keeps the automatic calorie goal up to date.
      if (!latest || date >= latest[0]) await st.saveSettings({ ...s, profile: { ...s.profile, weightKg: Math.round(kg * 10) / 10 } });
      setText('');
      toast('ok', 'Weight saved.');
    } catch (e) { toast('err', errText(e)); }
  };

  return (
    <div className="mx-auto max-w-xl space-y-3.5">
      <h1 className="text-2xl font-semibold">Weight</h1>

      <section className="card rise grid grid-cols-3 gap-2 text-center">
        <div><p className="label">Now</p><p className="num mt-1 text-xl font-semibold">{latest ? weightNum(latest[1], u) : '—'}</p><p className="text-[11px] muted">{u.weight}</p></div>
        <div><p className="label">Change</p><p className={`num mt-1 text-xl font-semibold ${change < 0 ? 'text-lime-700 dark:text-lime-300' : ''}`}>{shown.length > 1 ? `${change > 0 ? '+' : ''}${weightNum(change, u)}` : '—'}</p><p className="text-[11px] muted">{range ? `last ${range === 365 ? 'year' : `${range} days`}` : 'since the start'}</p></div>
        <div><p className="label">Goal</p><p className="num mt-1 text-xl font-semibold">{goal ? weightNum(goal, u) : '—'}</p><p className="text-[11px] muted">{goal && latest ? `${weightText(Math.abs(latest[1] - goal), u)} to go` : 'set in Settings'}</p></div>
      </section>

      <section className="card rise rise-1 space-y-2">
        <h2 className="font-display text-[17px] font-semibold">Log your weight</h2>
        <div className="flex flex-wrap gap-2">
          <label className="min-w-0 flex-1 basis-32"><span className="sr-only">Weight in {u.weight}</span><input className="input num w-full text-lg" inputMode="decimal" placeholder={`e.g. ${weightNum(s.profile.weightKg, u)}`} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void save()} /></label>
          <label className="basis-36"><span className="sr-only">Day</span><input type="date" className="input w-full" value={date} max={todayStr()} onChange={(e) => e.target.value && setDate(e.target.value)} /></label>
          <button className="btn-primary basis-full sm:basis-auto" disabled={!text.trim()} onClick={() => void save()}>Save ({u.weight})</button>
        </div>
        <p className="text-xs muted">Same time each day (morning, before eating) gives the clearest trend. Your daily calorie goal follows your newest weight{s.goals.auto ? `: now ${kcalText(autoCalories(s.profile), u)}` : ' when it’s set to automatic'}.</p>
      </section>

      <section className="card rise rise-2 space-y-2">
        <Seg label="Range" options={[[30, '30 d'], [90, '90 d'], [365, '1 year'], [0, 'All']]} value={range} onChange={setRange} />
        {shown.length ? <WeightLine unit={u.weight} goal={goal ? weightNum(goal, u) : null} points={shown.map(([d, kg]) => ({ date: d, label: shortDay(d), value: weightNum(kg, u) }))} />
          : <p className="py-6 text-center text-sm muted">No weights in this period yet.</p>}
      </section>

      <section className="card rise rise-3 text-sm">
        <p><b>BMI {bmi(s.profile).toFixed(1)}</b>: {bmiLabel(bmi(s.profile))} (18.5–25). It’s only a rough guide: it doesn’t know about muscle.</p>
      </section>

      {all.length > 0 && (
        <section className="card rise rise-4 !pb-2">
          <h2 className="mb-1 font-display text-[17px] font-semibold">All weights</h2>
          {[...all].reverse().slice(0, 60).map(([d, kg]) => (
            <div key={d} className="flex items-center justify-between gap-3 border-t py-1.5 first:border-0" style={{ borderColor: 'var(--trk)' }}>
              <span className="text-sm">{dayLabel(d)}</span>
              <span className="flex items-center gap-1"><span className="num font-semibold">{weightText(kg, u)}</span>
                <button className="btn-ghost" aria-label={`Delete the weight of ${dayLabel(d)}`} onClick={() => void st.deleteWeight(d).catch((e) => toast('err', errText(e)))}><Icon d={ICONS.trash} className="h-4 w-4" /></button>
              </span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
