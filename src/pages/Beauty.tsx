import { useMemo, useState, type ReactNode } from 'react';
import { useStore } from '../lib/store';
import { shortDay } from '../lib/date';
import { avoidHits } from '../lib/avoid';
import { clashes } from '../lib/clash';
import { SHELF_STATUS, type BeautyCheck, type ShelfItem, type ShelfStatus } from '../lib/types';
import { BeautyResult, CheckSheet, ClashList, ShelfRow, ShelfSheet, SkinProfile, profileLine, recentChecks, routine, soonExpiring } from '../components/Beauty';
import { Empty, Fold, ICONS, Icon } from '../components/ui';

/** 💄 Check (Beauty's home): your skin in one line, the big button, recent checks, what's expiring. */
export function BeautyHome({ check, setCheck, go }: { check: 'pick' | 'camera' | 'gallery' | null; setCheck: (c: 'pick' | 'camera' | 'gallery' | null) => void; go: (t: string) => void }) {
  const st = useStore();
  const b = st.settings.beauty;
  const [open, setOpen] = useState<ShelfItem | null>(null);
  const recent = recentChecks(st.shelf).slice(0, 6);
  const expiring = soonExpiring(st.shelf).slice(0, 3);
  const counts = { good: st.shelf.filter((x) => x.verdict === 'good').length, avoid: st.shelf.filter((x) => x.verdict === 'avoid').length };
  return (
    <div className="mx-auto max-w-xl space-y-3.5">
      <section className="card rise overflow-hidden">
        <p className="label">Your skin</p>
        <button className="tap -mx-1 mt-1 block rounded-xl px-1 text-left font-display text-[17px] font-semibold leading-snug" onClick={() => go('skin')}>{profileLine(b)} <span className="text-sm font-normal text-pink-700 underline dark:text-pink-300">edit</span></button>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button className="btn-primary !min-h-[76px] flex-col !gap-1 !rounded-[22px] text-[14px]" onClick={() => setCheck('camera')}><Icon d={ICONS.camera} className="h-6 w-6" /> Check a product</button>
          <button className="btn !min-h-[76px] flex-col !gap-1 !rounded-[22px]" onClick={() => setCheck('gallery')}><Icon d={ICONS.image} className="h-6 w-6" /> From gallery</button>
        </div>
        <p className="mt-2 text-xs muted">Snap the front and the ingredient list: you’ll see if it suits your skin, what helps, and what to watch.</p>
      </section>

      {st.shelf.length > 0 && (
        <div className="rise rise-1 grid grid-cols-3 gap-2 text-center">
          <Tile n={st.shelf.length} label="checked" />
          <Tile n={counts.good} label="good for you" />
          <Tile n={counts.avoid} label="not for you" />
        </div>
      )}

      {expiring.length > 0 && (
        <section className="card rise rise-2 !py-3">
          <p className="mb-1 font-bold">⏳ Time to replace soon</p>
          {expiring.map(({ x, e }) => <p key={x.id} className="text-sm">{x.product}: {e.left < 0 ? <b className="text-red-700 dark:text-red-300">expired {shortDay(e.date)}</b> : <>use by <b>{shortDay(e.date)}</b></>}</p>)}
        </section>
      )}

      <section className="card rise rise-3 !pb-2">
        <div className="flex items-baseline justify-between"><h2 className="font-display text-[17px] font-semibold">Recent checks</h2>{st.shelf.length > 6 && <button className="tap -my-2 min-h-[44px] rounded-xl px-2 text-xs font-bold text-pink-700 dark:text-pink-300" onClick={() => go('shelf')}>See all</button>}</div>
        {recent.length ? recent.map((x) => <ShelfRow key={x.id} x={x} onOpen={() => setOpen(x)} />) : <Empty icon="🧴">Nothing checked yet. Tap “Check a product” and snap your moisturizer, foundation or anything else.</Empty>}
      </section>

      {check && <CheckSheet start={check === 'pick' ? undefined : check} onClose={() => setCheck(null)} />}
      {open && <ShelfSheet x={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

const Tile = ({ n, label }: { n: number; label: string }) => (
  <div className="card !rounded-[22px] !px-2 !py-3"><p className="big">{n}</p><p className="mt-1 text-[11px] leading-tight muted">{label}</p></div>
);

/** 🧴 My shelf: everything checked, by status. */
export function Shelf() {
  const st = useStore();
  const [f, setF] = useState<'all' | ShelfStatus>(() => { try { return (localStorage.getItem('ct.shelfFilter') as ShelfStatus | null) ?? 'all'; } catch { return 'all'; } });
  const [open, setOpen] = useState<ShelfItem | null>(null);
  const [q, setQ] = useState('');
  const pick = (v: 'all' | ShelfStatus) => { setF(v); try { localStorage.setItem('ct.shelfFilter', v); } catch { /* private mode */ } };
  const list = st.shelf.filter((x) => (f === 'all' || x.status === f) && (!q.trim() || `${x.brand} ${x.product} ${x.category}`.toLowerCase().includes(q.trim().toLowerCase())));
  return (
    <div className="mx-auto max-w-xl space-y-3.5">
      <h1 className="text-2xl font-semibold">My shelf</h1>
      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {([['all', 'All', '🧴'], ...SHELF_STATUS.map((s) => [s.id, s.label, s.icon])] as [string, string, string][]).map(([id, l, ic]) => {
          const n = id === 'all' ? st.shelf.length : st.shelf.filter((x) => x.status === id).length;
          return <button key={id} className={`chip min-h-[40px] shrink-0 !px-3 ${f === id ? '!border-transparent bg-gradient-to-br from-pink-300 to-purple-400 text-[#2a0b22]' : ''}`} aria-pressed={f === id} onClick={() => pick(id as 'all' | ShelfStatus)}>{ic} {l} <span className="num opacity-70">{n}</span></button>;
        })}
      </div>
      {st.shelf.length > 5 && <label className="block"><span className="sr-only">Search my shelf</span><input className="input w-full" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search brand or product" /></label>}
      <section className="card rise !pb-2">
        {list.length ? list.map((x) => <ShelfRow key={x.id} x={x} onOpen={() => setOpen(x)} />) : <Empty icon="🧴">{st.shelf.length ? 'Nothing here.' : 'Products you check are kept here.'}</Empty>}
      </section>
      {open && <ShelfSheet x={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

/** 🌸 Skin: your profile, and your routine built from what you use. */
export function Skin() {
  const st = useStore();
  const r = useMemo(() => routine(st.shelf), [st.shelf]);
  const mix = useMemo(() => clashes(st.shelf.filter((x) => x.status === 'using' || x.status === 'loved')), [st.shelf]);
  return (
    <div className="mx-auto max-w-xl space-y-3.5">
      <h1 className="text-2xl font-semibold">My skin</h1>
      <section className="card rise"><SkinProfile /></section>
      <section className="card rise rise-1 space-y-2">
        <h2 className="font-display text-[17px] font-semibold">🧪 Mixing check</h2>
        <p className="text-xs muted">Products you use (or love) that shouldn’t go on at the same time, and what to do. Checked from their ingredients, free.</p>
        <ClashList list={mix} empty={r.am.length || r.pm.length ? '✅ No clashes in what you use.' : 'Mark products as “Using” on My shelf to check them.'} />
      </section>
      <section className="card rise rise-2 space-y-3">
        <h2 className="font-display text-[17px] font-semibold">🌗 My routine</h2>
        {!r.am.length && !r.pm.length ? <p className="text-sm muted">Mark products as “Using” or “Loved it” on My shelf and your morning and evening routine shows here, in the right order.</p> : (
          <div className="grid gap-3 sm:grid-cols-2">
            <Steps title="☀️ Morning" items={r.am} />
            <Steps title="🌙 Evening" items={r.pm} />
          </div>
        )}
      </section>
    </div>
  );
}
const Steps = ({ title, items }: { title: string; items: ShelfItem[] }) => (
  <div><p className="mb-1 text-sm font-bold">{title}</p>
    {items.length ? <ol className="space-y-1 text-sm">{items.map((x, i) => <li key={x.id} className="flex gap-2"><span className="num flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-pink-500/15 text-xs font-bold text-pink-800 dark:text-pink-200">{i + 1}</span><span><b>{x.category}</b>: {x.product}</span></li>)}</ol> : <p className="text-sm muted">—</p>}
  </div>
);

/* ---------- 📖 the Beauty guide (made-up products, no working buttons) ---------- */
const EX: Omit<BeautyCheck, 'id' | 'createdAt'> = {
  brand: 'Example Skin', product: 'Barrier Repair Cream', category: 'Moisturizer', verdict: 'good', score: 9,
  summary: 'A rich, fragrance-free cream that suits dry skin well: it holds water in and repairs the skin barrier.',
  good: [{ name: 'Ceramides', why: 'rebuild the barrier that dry skin is missing' }, { name: 'Glycerin', why: 'draws water into the skin' }, { name: 'Shea butter', why: 'softens rough, flaky patches' }],
  watch: [{ name: 'Quite thick', why: 'may feel heavy under makeup in the morning: use a thin layer' }],
  avoidHits: [], ingredients: ['Aqua', 'Glycerin', 'Butyrospermum Parkii Butter', 'Ceramide NP', 'Cholesterol', 'Phytosphingosine'], ingredientsFrom: 'label',
  howToUse: ['Morning and night on damp skin', 'Under sunscreen in the morning'], shade: '', pao: '12M', by: 'Gemini Flash',
};
const BAD = ['Aqua', 'Alcohol Denat.', 'Parfum', 'Salicylic Acid'];
const EX2: Omit<BeautyCheck, 'id' | 'createdAt'> = {
  ...EX, brand: 'Example Glow', product: 'Clarifying Toner', category: 'Toner', verdict: 'avoid', score: 2,
  summary: 'It has Parfum (fragrance), which is on your avoid list. The alcohol can also dry your skin further.',
  good: [], watch: [{ name: 'Alcohol Denat.', why: 'strips moisture from dry skin' }], ingredients: BAD, avoidHits: avoidHits(['Fragrance'], BAD), howToUse: [], pao: '',
};
const SHELF_EX: ShelfItem[] = [
  { ...EX, id: 'g1', createdAt: '', status: 'loved' },
  { ...EX2, id: 'g2', createdAt: '', status: 'nope' },
];
const Example = ({ children, caption }: { children: ReactNode; caption: string }) => (
  <figure className="space-y-1.5">
    <div className="pointer-events-none select-none rounded-2xl border border-dashed p-2" style={{ borderColor: 'var(--bd)' }} aria-hidden="true">{children}</div>
    <figcaption className="text-xs muted">{caption}</figcaption>
  </figure>
);
const P = ({ children }: { children: ReactNode }) => <p className="text-[15px] leading-relaxed text-stone-700 dark:text-stone-300">{children}</p>;

export function BeautyGuide() {
  return (
    <div className="mx-auto max-w-xl space-y-3">
      <h1 className="text-2xl font-semibold">Beauty guide</h1>
      <p className="text-sm muted">How the 💄 Beauty side works. Tap a topic. (🥗 Calories and 🍳 Cooking have their own guides.)</p>

      <Fold icon="✨" title="What it does" open>
        <P>Take a photo of a skincare or makeup product. The AI reads the brand, the product and its ingredients, and tells you if it’s good for <b>your</b> skin: <b>✅ Good match</b>, <b>🟡 OK</b> or <b>❌ Not for you</b>, with a score out of 10 and the reasons.</P>
        <P>Switch between 🥗 Calories, 💄 Beauty and 🍳 Cooking with the switch at the top. Each side has its own menu and look; Settings are shared.</P>
        <Example caption="Made-up check of a moisturizer for dry skin."><BeautyResult r={EX} /></Example>
      </Fold>

      <Fold icon="🌸" title="Your skin profile">
        <P>Fill in the <b>Skin</b> tab once: your skin type (dry, oily, combination, normal) and whether it’s sensitive, what you’d like to help (acne, redness, dark spots…), ingredients to avoid, your skin tone and undertone (for foundation shades), and whether you prefer fragrance-free, vegan or pregnancy-safe products. Every check uses it.</P>
        <P>Not sure of your undertone? Look at the veins on your wrist: blue-ish = cool, green-ish = warm, both = neutral.</P>
      </Fold>

      <Fold icon="📸" title="Checking a product">
        <P>Tap <b>Check a product</b> (or the big camera button). Snap the front, then the <b>ingredient list</b> on the back: with it the answer is much surer. Up to 3 photos. You can add a note, like a shade number or “for under my eyes”.</P>
        <P>You get: what helps your skin (💗), what to watch out for (⚠️), how to use it, shade advice for foundation and concealer, and the full ingredient list. If there’s no ingredient list in the photos, the AI uses the product’s usual formula and says so.</P>
      </Fold>

      <Fold icon="🚫" title="Ingredients to avoid">
        <P>Anything on your avoid list is checked word by word in the ingredients, with its other names too (Fragrance also catches “parfum” and “aroma”). If it’s there, the product is always <b>Not for you</b>, whatever the AI thinks, and the ingredient shows in red.</P>
        <Example caption="Made-up toner when you avoid fragrance."><BeautyResult r={EX2} /></Example>
      </Fold>

      <Fold icon="🧴" title="My shelf and routine">
        <P>Save each product as <b>Using</b>, <b>Loved it</b>, <b>Want to try</b>, <b>Didn’t suit me</b> or <b>Just checked</b>. For products you use, add the day you opened it and how long it lasts (the little open-jar symbol, like “12M”): you’ll see when it’s time to replace it.</P>
        <Example caption="Made-up shelf."><div>{SHELF_EX.map((x) => <ShelfRow key={x.id} x={x} />)}</div></Example>
        <P>The <b>Skin</b> tab puts what you use in order for the morning and evening (cleanser, serum, moisturizer, sunscreen…).</P>
      </Fold>

      <Fold icon="🧪" title="Mixing check">
        <P>Some ingredients don’t go well together, like retinol with exfoliating acids, or benzoyl peroxide with vitamin C. The <b>Skin</b> tab checks everything you mark as Using or Loved, and when you check a new product it’s compared with what you use. ⛔ means use them apart, ⚠️ means take care, ℹ️ is just good to know. Free: read from the ingredients, no AI.</P>
        <Example caption="Made-up clash between two products."><ClashList list={clashes([{ id: 'a', product: 'Example Night Retinol', category: 'Serum', ingredients: ['Aqua', 'Retinol'] }, { id: 'b', product: 'Example Glow Toner', category: 'Toner', ingredients: ['Aqua', 'Glycolic Acid'] }])} /></Example>
      </Fold>

      <Fold icon="🤖" title="The AI and what it costs">
        <P>The AI picked in Settings → AI (the same one for all three sides): free Gemini, or Claude (paid, about 1–2 cents a check) for everything if you choose it, with the other as a backup if you like, all under the daily limits. The same photos are remembered and never paid for twice. Each check is 1 AI read.</P>
        <P>It’s guidance, not medical advice. If your skin reacts easily, try a new product on a small patch (inside of the arm) for a day first.</P>
      </Fold>
    </div>
  );
}
