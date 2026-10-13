/** Days are your phone's days (not UTC), written YYYY-MM-DD. */
const pad = (n: number) => String(n).padStart(2, '0');
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayStr = () => ymd(new Date());
export const nowTime = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
export const parse = (s: string) => new Date(`${s}T12:00:00`);
export const addDays = (s: string, n: number) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
export const daysBetween = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / 86400000);
export function dayLabel(s: string): string {
  const diff = daysBetween(todayStr(), s);
  if (diff === 0) return 'Today';
  if (diff === -1) return 'Yesterday';
  if (diff === 1) return 'Tomorrow';
  return parse(s).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}
export const shortDay = (s: string) => parse(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
export const weekday = (s: string) => parse(s).toLocaleDateString(undefined, { weekday: 'narrow' });
export const timeText = (t: string) => { const [h, m] = t.split(':').map(Number); const d = new Date(); d.setHours(h, m); return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }); };
