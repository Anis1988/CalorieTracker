/**
 * 🚫 Your "avoid" list against a product's ingredients: plain text matching, no AI (also run on the phone for the
 * Guide example). Common names cover their label names (Fragrance → parfum, aroma…). Fatty alcohols (cetyl,
 * stearyl…) are gentle and don't count as "alcohol".
 */
const NAMES: Record<string, string[]> = {
  fragrance: ['fragrance', 'parfum', 'perfume', 'aroma'],
  alcohol: ['alcohol denat', 'denatured alcohol', 'sd alcohol', 'ethanol', 'isopropyl alcohol', 'alcohol'],
  'essential oils': ['essential oil', 'limonene', 'linalool', 'citral', 'geraniol', 'eugenol', 'citronellol', 'lavandula', 'mentha piperita', 'peppermint', 'eucalyptus', 'tea tree', 'melaleuca'],
  parabens: ['paraben'],
  sulfates: ['lauryl sulfate', 'laureth sulfate', 'coco-sulfate'],
  silicones: ['dimethicone', 'methicone', 'siloxane', 'silsesquioxane'],
  retinol: ['retinol', 'retinyl', 'retinal', 'tretinoin', 'adapalene'],
  nuts: ['almond', 'prunus amygdalus', 'macadamia', 'hazelnut', 'corylus', 'walnut', 'juglans', 'cashew', 'argan', 'shea', 'butyrospermum'],
  'coconut oil': ['coconut', 'cocos nucifera'],
  'mineral oil': ['mineral oil', 'paraffinum liquidum', 'petrolatum'],
  lanolin: ['lanolin'],
  'chemical sunscreen filters': ['oxybenzone', 'benzophenone-3', 'avobenzone', 'octinoxate', 'ethylhexyl methoxycinnamate', 'homosalate', 'octocrylene'],
  talc: ['talc'],
  'formaldehyde releasers': ['formaldehyde', 'dmdm hydantoin', 'quaternium-15', 'imidazolidinyl urea', 'diazolidinyl urea', 'bronopol'],
};
const FATTY = /(cetyl|cetearyl|stearyl|behenyl|lanolin|myristyl|arachidyl|benzyl|phenethyl)\s+alcohol/i;

export function avoidHits(avoid: string[], ingredients: string[]): string[] {
  const out: string[] = [];
  for (const a of avoid) {
    const key = a.trim().toLowerCase();
    if (!key) continue;
    const words = NAMES[key] ?? [key];
    for (const ing of ingredients) {
      const low = ing.toLowerCase();
      if (key === 'alcohol' && FATTY.test(low) && !/denat|ethanol|isopropyl|sd alcohol/.test(low)) continue;
      if (words.some((w) => low.includes(w))) {
        const label = key === low ? ing : `${ing} (${a})`;
        if (!out.includes(label)) out.push(label);
      }
    }
  }
  return out.slice(0, 10);
}
