import { useEffect, useRef, useState } from 'react';

/**
 * Two small charts, drawn to the real width of the screen (so text stays sharp and readable on a phone):
 * calories per day against the goal (bars), and weight over time (a line). Tap or hover a bar/point for its value.
 * One series each, so no legend: the title names it. Thin marks, rounded bar tops, a quiet grid.
 */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(340);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(200, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

const niceMax = (v: number) => { const step = v > 3000 ? 1000 : v > 1200 ? 500 : v > 300 ? 100 : 10; return Math.ceil(v / step) * step; };

export function CalorieBars({ days, goal, unit = 'kcal', height = 180 }: { days: { date: string; label: string; value: number; tip: string }[]; goal: number; unit?: string; height?: number }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 36, r: 6, t: 10, b: 22 };
  const max = niceMax(Math.max(goal * 1.15, ...days.map((d) => d.value), 100));
  const iw = w - pad.l - pad.r, ih = height - pad.t - pad.b;
  const band = iw / Math.max(1, days.length);
  const bw = Math.max(3, Math.min(28, band - 2));
  const y = (v: number) => pad.t + ih - (v / max) * ih;
  const ticks = [0, max / 2, max];
  const every = Math.ceil(days.length / Math.floor(iw / 28));
  const h = hover != null ? days[hover] : null;
  return (
    <div ref={ref} className="relative select-none">
      <svg width={w} height={height} role="img" aria-label={`Calories per day; goal ${goal} ${unit}`} onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} className="stroke-stone-900/[0.07] dark:stroke-white/[0.08]" />
            <text x={pad.l - 6} y={y(t) + 3.5} textAnchor="end" className="fill-stone-500 text-[10px] dark:fill-stone-400" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{t >= 1000 ? `${(t / 1000).toFixed(t % 1000 ? 1 : 0)}k` : t}</text>
          </g>
        ))}
        {days.map((d, i) => {
          const x = pad.l + i * band + (band - bw) / 2;
          const over = d.value > goal;
          const hgt = Math.max(0, pad.t + ih - y(d.value));
          return (
            <g key={d.date}>
              {d.value > 0 && <path className="bar-up" style={{ animationDelay: `${i * 0.02}s` }} d={roundTop(x, y(d.value), bw, hgt, Math.min(4, bw / 2))} fill={over ? '#f59e0b' : '#84cc16'} opacity={hover == null || hover === i ? 1 : 0.45} />}
              {i % every === 0 && <text x={x + bw / 2} y={height - 6} textAnchor="middle" className="fill-stone-500 text-[10px] dark:fill-stone-400">{d.label}</text>}
              <rect x={pad.l + i * band} y={pad.t} width={band} height={ih} fill="transparent" onMouseEnter={() => setHover(i)} onClick={() => setHover(hover === i ? null : i)} />
            </g>
          );
        })}
        <line x1={pad.l} x2={w - pad.r} y1={y(goal)} y2={y(goal)} strokeDasharray="5 4" strokeWidth={1.5} className="stroke-stone-700 dark:stroke-stone-200" />
        <text x={w - pad.r} y={y(goal) - 4} textAnchor="end" className="fill-stone-700 text-[10px] font-bold dark:fill-stone-200">goal {goal.toLocaleString()}</text>
      </svg>
      {h && hover != null && (
        <div className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-xl border bg-white/95 px-2.5 py-1.5 text-xs shadow-lg dark:bg-stone-900/95" style={{ left: Math.min(w - 70, Math.max(70, pad.l + hover * band + band / 2)), borderColor: 'var(--bd)' }}>
          <b>{h.tip}</b><br /><span className="num">{Math.round(h.value).toLocaleString()} {unit}</span>{h.value > goal ? ' · over goal' : ''}
        </div>
      )}
    </div>
  );
}

const roundTop = (x: number, y: number, w: number, h: number, r: number) => {
  const rr = Math.min(r, h);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
};

export function WeightLine({ points, goal, unit, height = 190 }: { points: { date: string; label: string; value: number }[]; goal?: number | null; unit: string; height?: number }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 40, r: 10, t: 12, b: 22 };
  const vals = points.map((p) => p.value).concat(goal ? [goal] : []);
  const lo = Math.floor(Math.min(...vals) - 1), hi = Math.ceil(Math.max(...vals) + 1);
  const iw = w - pad.l - pad.r, ih = height - pad.t - pad.b;
  const x = (i: number) => pad.l + (points.length < 2 ? iw / 2 : (i / (points.length - 1)) * iw);
  const y = (v: number) => pad.t + ih - ((v - lo) / Math.max(1, hi - lo)) * ih;
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join('');
  const ticks = [lo, (lo + hi) / 2, hi];
  const h = hover != null ? points[hover] : null;
  const pick = (cx: number) => { if (!points.length) return; const i = points.length < 2 ? 0 : Math.round(((cx - pad.l) / iw) * (points.length - 1)); setHover(Math.max(0, Math.min(points.length - 1, i))); };
  return (
    <div ref={ref} className="relative select-none">
      <svg width={w} height={height} role="img" aria-label={`Weight over time in ${unit}`}
        onMouseMove={(e) => pick(e.clientX - e.currentTarget.getBoundingClientRect().left)} onMouseLeave={() => setHover(null)}
        onTouchStart={(e) => pick(e.touches[0].clientX - e.currentTarget.getBoundingClientRect().left)} onTouchMove={(e) => pick(e.touches[0].clientX - e.currentTarget.getBoundingClientRect().left)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} className="stroke-stone-900/[0.07] dark:stroke-white/[0.08]" />
            <text x={pad.l - 6} y={y(t) + 3.5} textAnchor="end" className="fill-stone-500 text-[10px] dark:fill-stone-400" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{Math.round(t)}</text>
          </g>
        ))}
        {goal ? <>
          <line x1={pad.l} x2={w - pad.r} y1={y(goal)} y2={y(goal)} strokeDasharray="5 4" strokeWidth={1.5} className="stroke-stone-700 dark:stroke-stone-200" />
          <text x={w - pad.r} y={y(goal) - 4} textAnchor="end" className="fill-stone-700 text-[10px] font-bold dark:fill-stone-200">goal</text>
        </> : null}
        <path d={path} fill="none" stroke="#65a30d" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" className="dark:stroke-lime-400" />
        {points.map((p, i) => <circle key={p.date} cx={x(i)} cy={y(p.value)} r={hover === i ? 5.5 : 4} className="fill-lime-600 stroke-white dark:fill-lime-400 dark:stroke-stone-900" strokeWidth={2} />)}
        {points.length > 0 && <>
          <text x={pad.l} y={height - 6} className="fill-stone-500 text-[10px] dark:fill-stone-400">{points[0].label}</text>
          {points.length > 1 && <text x={w - pad.r} y={height - 6} textAnchor="end" className="fill-stone-500 text-[10px] dark:fill-stone-400">{points[points.length - 1].label}</text>}
        </>}
        {h && hover != null && <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} className="stroke-stone-400/60" />}
      </svg>
      {h && hover != null && (
        <div className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-xl border bg-white/95 px-2.5 py-1.5 text-xs shadow-lg dark:bg-stone-900/95" style={{ left: Math.min(w - 60, Math.max(60, x(hover))), borderColor: 'var(--bd)' }}>
          <b>{h.label}</b><br /><span className="num">{h.value.toFixed(1)} {unit}</span>
        </div>
      )}
    </div>
  );
}
