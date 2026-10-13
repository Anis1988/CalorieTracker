/**
 * 🚫 Allergies against a recipe's ingredients: plain word matching, no AI (also used on the phone). An ingredient
 * that says "-free" / "free" or is a known safe swap (almond milk is fine for dairy) doesn't count.
 */
const WORDS: Record<string, { hit: RegExp; safe?: RegExp }> = {
  'Peanuts': { hit: /peanut|groundnut|satay/ },
  'Tree nuts': { hit: /almond|walnut|pecan|cashew|pistachio|hazelnut|macadamia|brazil nut|pine nut|praline|marzipan|nutella/, safe: /nutmeg|coconut|water chestnut/ },
  'Gluten': { hit: /wheat|flour|bread|pasta|spaghetti|noodle|couscous|bulgur|barley|rye|semolina|seitan|breadcrumb|panko|tortilla|pita|soy sauce|cracker|biscuit|cake|pastry|beer/, safe: /gluten[- ]free|rice flour|almond flour|coconut flour|corn tortilla|rice noodle|tamari|chickpea flour|oat flour \(gf\)/ },
  'Dairy': { hit: /milk|butter|cheese|cream|yog(h)?urt|ghee|whey|casein|parmesan|mozzarella|feta|ricotta|labneh|kefir/, safe: /dairy[- ]free|almond milk|oat milk|soy milk|coconut milk|coconut cream|rice milk|vegan (butter|cheese)|peanut butter|nut butter|cocoa butter|shea butter|apple butter/ },
  'Eggs': { hit: /\begg|mayonnaise|mayo|meringue|aioli/, safe: /egg[- ]free|eggplant|vegan mayo/ },
  'Fish': { hit: /salmon|tuna|cod|haddock|sardine|anchov|mackerel|trout|tilapia|halibut|fish|bass/, safe: /fish[- ]free/ },
  'Shellfish': { hit: /shrimp|prawn|crab|lobster|mussel|clam|scallop|oyster|crayfish|langoustine|squid|calamari|octopus/ },
  'Soy': { hit: /\bsoy|soya|tofu|edamame|miso|tempeh|tamari/, safe: /soy[- ]free/ },
  'Sesame': { hit: /sesame|tahini|halva|za'?atar/ },
};

export function allergyHits(allergies: string[], ingredients: { name: string }[]): string[] {
  const out: string[] = [];
  for (const a of allergies) {
    const w = WORDS[a];
    const key = a.toLowerCase();
    for (const i of ingredients) {
      const low = i.name.toLowerCase();
      if (/\b(free|no)\b/.test(low) && low.includes(key.split(' ')[0])) continue;
      const hit = w ? w.hit.test(low) && !(w.safe && w.safe.test(low)) : low.includes(key);
      if (hit) { const label = `${i.name} (${a})`; if (!out.includes(label)) out.push(label); }
    }
  }
  return out.slice(0, 8);
}
