/**
 * 🏷️ Barcodes, read on the phone (no AI, nothing uploaded): from a photo when the browser can (BarcodeDetector,
 * most Android phones), else typed. Used by 🥗 Add food (Open Food Facts) and 💄 Check (Open Beauty Facts).
 */
type Detector = new (o: object) => { detect: (i: ImageBitmapSource) => Promise<{ rawValue: string }[]> };

export const canReadBarcodes = () => typeof window !== 'undefined' && 'BarcodeDetector' in window;

/** The number in a photo of a barcode, or '' if none was found. Throws when the browser can't read barcodes. */
export async function readBarcode(f: Blob): Promise<string> {
  const Det = (window as unknown as { BarcodeDetector: Detector }).BarcodeDetector;
  const found = await new Det({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] }).detect(await createImageBitmap(f));
  return found[0]?.rawValue ?? '';
}

export const digits = (c: string) => c.replace(/\D/g, '');

// ---------- 💄 Open Beauty Facts (free, public, ODbL; called from the phone) ----------
export interface BeautyProduct { code: string; name: string; brand: string; category: string; image: string; ingredients: string[]; link: string }

/** The product for a barcode, or null if Open Beauty Facts doesn't know it. Ingredients may be empty. */
export async function lookUpBeauty(code: string): Promise<BeautyProduct | null> {
  const n = digits(code);
  const r = await fetch(`https://world.openbeautyfacts.org/api/v2/product/${n}.json?fields=product_name,product_name_en,brands,categories_tags,image_front_small_url,image_front_url,image_url,ingredients_text,ingredients_text_en`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`Open Beauty Facts didn’t answer (${r.status}). Try again in a moment.`);
  const j = (await r.json()) as { status?: number; product?: Record<string, unknown> };
  const p = j.product;
  if (!p || j.status === 0) return null;
  const s = (k: string) => (typeof p[k] === 'string' ? (p[k] as string).trim() : '');
  return {
    code: n,
    name: (s('product_name_en') || s('product_name')).slice(0, 100),
    brand: s('brands').split(',')[0].trim().slice(0, 60),
    category: categoryOf(Array.isArray(p.categories_tags) ? (p.categories_tags as string[]) : []),
    image: s('image_front_url') || s('image_url') || s('image_front_small_url'),
    ingredients: splitIngredients(s('ingredients_text_en') || s('ingredients_text')),
    link: `https://world.openbeautyfacts.org/product/${n}`,
  };
}

/** "Aqua, Glycerin (vegetable), Parfum." → ['Aqua', 'Glycerin (vegetable)', 'Parfum'] (commas inside brackets kept). */
export function splitIngredients(t: string): string[] {
  const text = t.replace(/^\s*(ingredients?|ingrédients|inci)\s*[:：-]\s*/i, '').replace(/[\r\n]+/g, ', ');
  const out: string[] = [];
  let cur = '', depth = 0;
  for (const ch of text) {
    if (ch === '(' || ch === '[') depth++;
    if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1);
    if ((ch === ',' || ch === '•' || ch === ';') && depth === 0) { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out.map((x) => x.replace(/[.*\s]+$/, '').replace(/^[\s*_]+/, '').replace(/_/g, '').trim()).filter((x) => x.length > 1).map((x) => x.slice(0, 80)).slice(0, 120);
}

/** Open Beauty Facts categories (en:face-creams…) → the app's categories. */
const CATS: [RegExp, string][] = [
  [/sunscreen|sun-protection|sun-cream|spf/, 'Sunscreen'], [/makeup-remover|micellar/, 'Makeup remover'], [/cleanser|cleansing|face-wash|soap/, 'Cleanser'],
  [/toner|tonic|lotion-tonique/, 'Toner'], [/serum/, 'Serum'], [/eye-cream|eye-contour/, 'Eye cream'], [/mask/, 'Mask'], [/scrub|exfoliat|peel/, 'Exfoliant'],
  [/foundation/, 'Foundation'], [/concealer/, 'Concealer'], [/powder/, 'Powder'], [/blush/, 'Blush'], [/mascara/, 'Mascara'], [/eyeliner/, 'Eyeliner'],
  [/eyeshadow|eye-shadow/, 'Eyeshadow'], [/lip-balm/, 'Lip balm'], [/lip-gloss/, 'Lip gloss'], [/lipstick/, 'Lipstick'], [/primer/, 'Primer'],
  [/shampoo|conditioner|hair/, 'Hair'], [/body|shower|deodorant|hand-cream/, 'Body'], [/oil/, 'Oil'], [/cream|moistur|day-care|night-care|face-care/, 'Moisturizer'],
];
function categoryOf(tags: string[]): string {
  const t = tags.join(' ').toLowerCase();
  return CATS.find(([re]) => re.test(t))?.[1] ?? 'Other';
}
