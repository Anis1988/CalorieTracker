import type { ShelfItem } from './types';

/**
 * 🧪 Ingredient clash check (free, no AI): finds the "actives" in each product's ingredients, then known pairs that
 * shouldn't go on together (same routine / same time). Advice is the usual dermatologist guidance, in plain words.
 */
type Active = 'retinoid' | 'aha' | 'bha' | 'vitc' | 'bpo' | 'niacinamide' | 'copper';
const FIND: Record<Active, RegExp> = {
  retinoid: /retinol|retinal\b|retinaldehyde|retinyl|tretinoin|adapalene|tazarotene|retinoate/i,
  aha: /glycolic|lactic acid|mandelic|malic acid|tartaric acid/i,
  bha: /salicylic|betaine salicylate|salix alba/i,
  vitc: /ascorbic acid|ascorbyl|ascorbate|tetrahexyldecyl/i,
  bpo: /benzoyl peroxide/i,
  niacinamide: /niacinamide/i,
  copper: /copper tripeptide|copper peptide|cu-ghk|ghk-cu/i,
};
export const ACTIVE_NAME: Record<Active, string> = { retinoid: 'retinoid (retinol)', aha: 'AHA acid (glycolic, lactic…)', bha: 'BHA (salicylic acid)', vitc: 'vitamin C', bpo: 'benzoyl peroxide', niacinamide: 'niacinamide', copper: 'copper peptides' };

export function activesOf(x: Pick<ShelfItem, 'ingredients' | 'category'>): Active[] {
  const text = x.ingredients.join(', ');
  const out = (Object.keys(FIND) as Active[]).filter((a) => FIND[a].test(text));
  return out;
}

export type Level = 'high' | 'medium' | 'low';
export interface Clash { a: string; b: string; level: Level; title: string; tip: string }
const RULES: { x: Active[]; y: Active[]; level: Level; title: string; tip: string }[] = [
  { x: ['retinoid'], y: ['aha', 'bha'], level: 'high', title: 'Retinoid + exfoliating acid', tip: 'Both can sting and peel together. Use them on different nights.' },
  { x: ['retinoid'], y: ['bpo'], level: 'high', title: 'Retinoid + benzoyl peroxide', tip: 'Benzoyl peroxide can weaken the retinoid and dries the skin. Benzoyl peroxide in the morning, retinoid at night.' },
  { x: ['retinoid'], y: ['vitc'], level: 'medium', title: 'Retinoid + vitamin C', tip: 'They work best apart: vitamin C in the morning, retinoid at night.' },
  { x: ['vitc'], y: ['aha', 'bha'], level: 'medium', title: 'Vitamin C + exfoliating acid', tip: 'Strong acids together can irritate. Alternate days, or acid at night and vitamin C in the morning.' },
  { x: ['bpo'], y: ['vitc'], level: 'medium', title: 'Benzoyl peroxide + vitamin C', tip: 'Benzoyl peroxide can break down vitamin C. Use them at different times of day.' },
  { x: ['copper'], y: ['vitc', 'aha', 'bha'], level: 'medium', title: 'Copper peptides + acids / vitamin C', tip: 'They can cancel each other out. Use them at different times of day.' },
  { x: ['retinoid'], y: ['retinoid'], level: 'medium', title: 'Two retinoids', tip: 'Doubling up mostly adds irritation. Pick one.' },
  { x: ['aha', 'bha'], y: ['aha', 'bha'], level: 'low', title: 'Two exfoliating products', tip: 'Easy to over-exfoliate. Keep acids to 2–3 times a week in total.' },
  { x: ['niacinamide'], y: ['vitc'], level: 'low', title: 'Niacinamide + vitamin C', tip: 'Fine together for most people. If your skin flushes or tingles, use them apart.' },
];

/** Clashes between products (each pair once). `extra` = a product being checked against the shelf. */
export function clashes(items: Pick<ShelfItem, 'id' | 'product' | 'ingredients' | 'category'>[], extra?: Pick<ShelfItem, 'id' | 'product' | 'ingredients' | 'category'>): Clash[] {
  const list = items.map((x) => ({ x, act: activesOf(x) }));
  const out: Clash[] = [];
  const pairs: [typeof list[number], typeof list[number]][] = [];
  if (extra) { const e = { x: extra, act: activesOf(extra) }; for (const o of list) if (o.x.id !== extra.id) pairs.push([e, o]); }
  else for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) pairs.push([list[i], list[j]]);
  for (const [p, q] of pairs) {
    for (const r of RULES) {
      const hit = (r.x.some((a) => p.act.includes(a)) && r.y.some((a) => q.act.includes(a))) || (r.x.some((a) => q.act.includes(a)) && r.y.some((a) => p.act.includes(a)));
      if (hit) { out.push({ a: p.x.product || 'Product', b: q.x.product || 'Product', level: r.level, title: r.title, tip: r.tip }); break; }
    }
  }
  const rank = { high: 0, medium: 1, low: 2 };
  return out.sort((a, b) => rank[a.level] - rank[b.level]);
}
