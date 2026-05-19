import Anthropic from '@anthropic-ai/sdk';
import type { Establishment, Suggestion, Feedback, SupplySpan } from './types';
import { createServerClient } from './supabase';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

interface GenerateInput {
  establishment: Establishment;
  span: SupplySpan;
  pastFeedback: Feedback[];
}

function getCurrentSaison(): string {
  // Saison large pour matcher saison: ['ete'] / ['hiver'] etc.
  const m = new Date().getMonth() + 1;
  if (m === 12 || m <= 2) return 'hiver';
  if (m <= 5) return 'printemps';
  if (m <= 8) return 'ete';
  return 'automne';
}

// Représente une ligne de base_ingredients
interface BaseIngredient {
  id: string;
  name: string;
  category: 'proteine' | 'feculent' | 'legume' | 'dessert';
  /** Catégorie GEMRCN (recommandations nutritionnelles collectivité) — null pour les ingrédients sans règle (féculents, légumes) */
  categorie_gemrcn: string | null;
  saison: string[];
  qty_per_person_kg: number;
  price_per_kg_ht: number | null;
  contains_porc: boolean;
  contains_gluten: boolean;
  contains_lactose: boolean;
  is_vegetarien: boolean;
  halal_compatible: boolean;
  aliases: string[];
  active: boolean;
}

// Classifie un dessert dans 5 buckets pour rotation (yaourt/crème/compote/fruit/fromage)
function classifyDessert(name: string): string | null {
  const s = (name || '').toLowerCase();
  if (/yaourt|fromage\s+blanc|petit\s+suisse|lait\s+fermenté/.test(s)) return 'yaourt';
  if (/cr[èe]me\s+(dessert|anglaise)|mousse|flan|li[ée]geois|lait\s+g[ée]lifi[ée]|riz\s+au\s+lait|semoule\s+au\s+lait/.test(s)) return 'creme';
  if (/compote/.test(s)) return 'compote';
  if (/comt[ée]|emmental|brie|camembert|tomme|reblochon|munster|roquefort|bleu|ch[èe]vre|cantal|fromage/.test(s)) return 'fromage';
  return 'fruit'; // pomme, banane, etc.
}

export async function generateSuggestions(input: GenerateInput): Promise<Omit<Suggestion, 'id' | 'span_id' | 'establishment_id' | 'created_at'>[]> {
  const { establishment, span, pastFeedback } = input;
  const nbPersons = establishment.employee_count;
  const includeDessert = establishment.include_dessert !== false; // default true (legacy)
  const supabase = createServerClient();
  const currentSaison = getCurrentSaison();

  // Charger base_ingredients actifs, filtrés par saison
  const { data: ingredientsRaw, error: ingErr } = await supabase
    .from('base_ingredients')
    .select('*')
    .eq('active', true)
    .or(`saison.cs.{${currentSaison}},saison.cs.{toutes}`);

  if (ingErr) {
    throw new Error(`Failed to load base_ingredients: ${ingErr.message}`);
  }

  // Si pas d'ingrédients pour la saison, fallback sur tous (au cas où la table soit mal seedée)
  let pool: BaseIngredient[] = (ingredientsRaw as BaseIngredient[] | null) || [];
  if (pool.length === 0) {
    const { data: allIng } = await supabase
      .from('base_ingredients')
      .select('*')
      .eq('active', true);
    pool = (allIng as BaseIngredient[] | null) || [];
  }

  if (pool.length === 0) {
    throw new Error('No base_ingredients in database. Seed `supabase/base_ingredients.sql` first.');
  }

  // === Contraintes alimentaires par nombre de personnes concernées ===
  // dietary_counts est source de vérité ({ contrainte: count }).
  // Si vide, fallback sur dietary_constraints (legacy, traité comme "toute l'équipe").
  // Règle : count == employee_count → filtre strict, sinon informatif au prompt.
  const counts: Record<string, number> = (establishment.dietary_counts as Record<string, number> | undefined) || {};
  if (Object.keys(counts).length === 0 && establishment.dietary_constraints) {
    for (const c of establishment.dietary_constraints) counts[c] = nbPersons;
  }

  const KNOWN_CONSTRAINTS = new Set(['vegetarien', 'sans-porc', 'halal', 'sans-gluten', 'sans-lactose']);
  const strictKnown: string[] = [];
  const strictCustom: string[] = [];
  const softNotes: { name: string; count: number }[] = [];

  for (const [name, rawCount] of Object.entries(counts)) {
    const c = Number(rawCount) || 0;
    if (c <= 0) continue;
    if (c >= nbPersons) {
      // Toute l'équipe → filtre strict
      if (KNOWN_CONSTRAINTS.has(name)) strictKnown.push(name);
      else if (name.trim().length > 0) strictCustom.push(name);
    } else {
      // Minorité → informatif (le chef gère côté cuisine)
      softNotes.push({ name, count: c });
    }
  }

  // Filtre strict pour les contraintes connues (toute l'équipe)
  if (strictKnown.length > 0) {
    pool = pool.filter((ing) => {
      if (strictKnown.includes('vegetarien') && !ing.is_vegetarien) return false;
      if (strictKnown.includes('sans-porc') && ing.contains_porc) return false;
      if (strictKnown.includes('halal') && !ing.halal_compatible) return false;
      if (strictKnown.includes('sans-gluten') && ing.contains_gluten) return false;
      if (strictKnown.includes('sans-lactose') && ing.contains_lactose) return false;
      return true;
    });
  }

  // Contraintes custom strictes : extraire le mot-clé et exclure les ingrédients
  // qui le contiennent (dans le nom canonique ou les aliases).
  const customKeywords: string[] = [];
  for (const constraint of strictCustom) {
    const keyword = constraint
      .toLowerCase()
      .replace(/^(sans|pas\s+de|pas\s+d['']|allergique\s+(?:au[xs]?|[àa])?|aller?gie\s+(?:au[xs]?|[àa])?|j['']aime\s+pas|sans\s+les?)\s+/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (keyword.length >= 3) customKeywords.push(keyword);
  }
  if (customKeywords.length > 0) {
    pool = pool.filter((ing) => {
      const haystack = [ing.name.toLowerCase(), ...ing.aliases.map((a) => a.toLowerCase())];
      return !customKeywords.some((kw) => haystack.some((h) => h.includes(kw)));
    });
  }

  // Séparer le pool en 4 sous-pools par catégorie
  const byCategory = {
    proteine: pool.filter((i) => i.category === 'proteine'),
    feculent: pool.filter((i) => i.category === 'feculent'),
    legume:   pool.filter((i) => i.category === 'legume'),
    dessert:  pool.filter((i) => i.category === 'dessert'),
  };

  // Vérifier qu'on a au moins 1 ingrédient par catégorie utilisée
  const requiredCats: ('proteine' | 'feculent' | 'legume' | 'dessert')[] = includeDessert
    ? ['proteine', 'feculent', 'legume', 'dessert']
    : ['proteine', 'feculent', 'legume'];
  for (const cat of requiredCats) {
    if (byCategory[cat].length === 0) {
      throw new Error(`Pool ${cat} vide après contraintes strictes [${[...strictKnown, ...strictCustom].join(', ')}]. Élargis les contraintes ou seed plus d'ingrédients.`);
    }
  }

  // Mélanger pour ne pas suggérer toujours les mêmes en début
  for (const cat of Object.keys(byCategory) as (keyof typeof byCategory)[]) {
    byCategory[cat] = byCategory[cat].sort(() => Math.random() - 0.5);
  }

  // Construire les listes compactes pour Claude
  // Format : index|nom|catégorie GEMRCN (si applicable)|prix HT/kg
  const formatList = (items: BaseIngredient[]): string =>
    items.map((i, idx) => {
      const cat = i.categorie_gemrcn ? `|${i.categorie_gemrcn}` : '|';
      return `${idx}|${i.name}${cat}|${(i.price_per_kg_ht ?? 0).toFixed(2)}€/kg`;
    }).join('\n');

  // Planning par jour : lunch_days + dinner_days (0=Dim, 1=Lun, ..., 6=Sam)
  // Fallback legacy : si pas définis, déduire de services (= comportement "tous les jours")
  const ALL_DOW = [1, 2, 3, 4, 5, 6, 0];
  const lunchDays: number[] = Array.isArray(establishment.lunch_days)
    ? establishment.lunch_days
    : ((establishment.services || []).includes('lunch') ? ALL_DOW : []);
  const dinnerDays: number[] = Array.isArray(establishment.dinner_days)
    ? establishment.dinner_days
    : ((establishment.services || []).includes('dinner') ? ALL_DOW : []);

  // Pré-calculer la liste exacte des créneaux à remplir (un slot par paire date+service active ce jour-là)
  const expectedSlots: { day_index: number; meal_date: string; meal_type: 'lunch' | 'dinner' }[] = [];
  const spanStart = new Date(span.start_date + 'T12:00:00');
  for (let d = 0; d < span.day_count; d++) {
    const date = new Date(spanStart);
    date.setDate(date.getDate() + d);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const dayOfWeek = date.getDay();
    if (lunchDays.includes(dayOfWeek)) {
      expectedSlots.push({ day_index: d, meal_date: dateStr, meal_type: 'lunch' });
    }
    if (dinnerDays.includes(dayOfWeek)) {
      expectedSlots.push({ day_index: d, meal_date: dateStr, meal_type: 'dinner' });
    }
  }

  // Si l'utilisateur n'a coché aucun service, rien à générer
  if (expectedSlots.length === 0) {
    throw new Error('Aucun repas à générer : coche au moins un service (midi ou soir) dans le planning hebdo.');
  }

  const slotsLabel = expectedSlots
    .map((s, i) => `${i}|${s.meal_date}|${s.meal_type === 'lunch' ? 'dejeuner' : 'diner'}`)
    .join('\n');

  // Feedback context
  let feedbackContext = '';
  if (pastFeedback.length > 0) {
    const feedbackSuggestionIds = pastFeedback.map(f => f.suggestion_id).filter(Boolean);
    let feedbackSuggestions: Record<string, unknown>[] = [];
    if (feedbackSuggestionIds.length > 0) {
      const { data } = await supabase
        .from('suggestions')
        .select('id, ingredients')
        .in('id', feedbackSuggestionIds);
      feedbackSuggestions = data || [];
    }

    const summarize = (f: Feedback): string | null => {
      const sug = feedbackSuggestions.find(s => s.id === f.suggestion_id);
      if (!sug) return null;
      const ings = (sug.ingredients as { name: string }[]) || [];
      const ingSummary = ings.slice(0, 3).map(i => i.name).join(', ');
      const note = f.notes ? ` [${f.notes}]` : '';
      return `${ingSummary}${note}`;
    };

    const liked = pastFeedback.filter(f => f.status === 'done').map(summarize).filter(Boolean);
    const modified = pastFeedback.filter(f => f.status === 'modified').map(summarize).filter(Boolean);
    const skipped = pastFeedback.filter(f => f.status === 'skipped').map(summarize).filter(Boolean);

    if (liked.length > 0) feedbackContext += `\nRepas réussis (faire +): ${liked.join(' | ')}`;
    if (modified.length > 0) feedbackContext += `\nRepas adaptés par l'user (voir commentaires): ${modified.join(' | ')}`;
    if (skipped.length > 0) feedbackContext += `\nRepas évités (à ne pas reproposer, voir commentaires): ${skipped.join(' | ')}`;
    if (modified.length > 0 || skipped.length > 0) {
      feedbackContext += `\n\nLis attentivement les commentaires entre [crochets] : ils contiennent les vraies préférences du chef.`;
    }
  }

  const customConstraintsLine = strictCustom.length > 0
    ? `\nContraintes strictes du chef à respecter pour tous : ${strictCustom.join(' / ')}.`
    : '';

  // Notes informatives : contraintes touchant SEULEMENT une partie de l'équipe.
  // Claude reçoit l'info, ne filtre pas, mais essaie de proposer un plat
  // compatible quand c'est facile (ex: végé = tout le monde peut manger).
  const softNotesLine = softNotes.length > 0
    ? `\n\nÀ noter sur l'équipe (${nbPersons} personnes) : ${softNotes.map((n) => `${n.count} ${n.name}`).join(', ')}. Quand c'est possible sans contrainte forte, privilégie un plat compatible avec tout le monde (un plat végétarien convient à tous, un plat sans porc aussi). Sinon le chef prévoit une option à côté — pas besoin d'éviter à tout prix.`
    : '';

  const dessertSection = includeDessert
    ? `\n\nDESSERTS disponibles (index|nom|catégorie GEMRCN|prix HT/kg):\n${formatList(byCategory.dessert)}`
    : '';
  const dessertVarietyRule = includeDessert
    ? "\n- Varier les desserts : alterner laitier_calcique / fromage_calcique_haut / fruit_cru / dessert_sucre — pas le même type 3 jours d'affilée"
    : '';

  // Calcul des objectifs GEMRCN (référence : fenêtre 20 repas) ajustés au nombre de repas du span
  const N = expectedSlots.length;
  const gemrcnTarget = (perTwenty: number) => Math.max(1, Math.round((perTwenty / 20) * N));
  const dessertGemrcnTargets = includeDessert
    ? `\n  • ≥${gemrcnTarget(8)} fruits crus (fruit_cru)`
      + `\n  • ≥${gemrcnTarget(6)} laitages (laitier_calcique : yaourt/fromage blanc/petit suisse)`
      + `\n  • Présence de fromage à pâte pressée (fromage_calcique_haut) — au moins 1 fois si possible`
      + `\n  • ≤${gemrcnTarget(4)} desserts sucrés (compote)`
    : '';
  const gemrcnSection = `

Recommandations nutritionnelles GEMRCN (sur ${N} repas, équilibre à viser) :
  • ≥${gemrcnTarget(4)} viandes non hachées (viande_non_hachee — pas le haché reconstitué)
  • ≥${gemrcnTarget(4)} poissons maigres (poisson_maigre : Cabillaud, Colin)
  • Inclure aussi ≥1 poisson gras (poisson_gras : Saumon, Truite, Maquereau, Sardines) — apport oméga-3${dessertGemrcnTargets}
La catégorie GEMRCN apparaît dans les listes ci-dessous — utilise-la pour équilibrer.`;
  const composition = includeDessert
    ? '1 protéine + 1 féculent + 1 légume + 1 dessert'
    : '1 protéine + 1 féculent + 1 légume (pas de dessert)';
  const responseShape = includeDessert
    ? `${expectedSlots.length} objets {p,f,l,d} (indices de protéine, féculent, légume, dessert)`
    : `${expectedSlots.length} objets {p,f,l} (indices de protéine, féculent, légume)`;
  const responseExample = includeDessert
    ? `[{"p":0,"f":3,"l":7,"d":2},{"p":5,"f":1,"l":12,"d":4},...]`
    : `[{"p":0,"f":3,"l":7},{"p":5,"f":1,"l":12},...]`;

  const prompt = `Tu composes ${expectedSlots.length} repas pour ${nbPersons} personnes, budget max ${establishment.budget_per_meal}€/pers/repas.${customConstraintsLine}${softNotesLine}
Chaque repas = ${composition} (index dans les listes ci-dessous).
${feedbackContext}

Créneaux à remplir (slot|date|service):
${slotsLabel}

PROTÉINES disponibles (index|nom|catégorie GEMRCN|prix HT/kg):
${formatList(byCategory.proteine)}

FÉCULENTS disponibles (index|nom||prix HT/kg):
${formatList(byCategory.feculent)}

LÉGUMES disponibles (index|nom||prix HT/kg):
${formatList(byCategory.legume)}${dessertSection}${gemrcnSection}

Règles IMPORTANTES :
- Tu dois renvoyer EXACTEMENT ${expectedSlots.length} repas (un par slot, dans l'ordre)
- Ne JAMAIS répéter la même protéine sur 4 repas consécutifs (2 jours)
- Maximiser la variété des protéines : viandes rouges, blanches, volailles, poissons, œufs, végétal — au moins 5 protéines différentes par semaine
- Au moins 2 repas végétariens par semaine (protéine = œufs, tofu, ou tout ce qui est is_vegetarien)
- Varier les féculents : un même féculent (riz, pâtes, pommes de terre, lentilles…) max 2 fois par semaine
- Varier les légumes : pas le même légume sur 2 repas adjacents${dessertVarietyRule}
- Cohérence : éviter deux plats lourds consécutifs (ex : bourguignon midi + pot-au-feu soir)
- Respecter la saison : les ingrédients listés sont déjà filtrés pour la saison courante (${currentSaison})
- Privilégier les repas appréciés, éviter les repas mal notés

Réponds UNIQUEMENT avec un JSON array de ${responseShape}, dans l'ordre des slots :
${responseExample}`;

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '';
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error('Failed to parse suggestions from Claude response');
  }

  type Pick = { p?: number; f?: number; l?: number; d?: number };
  let rawPicks: Pick[] = [];
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (Array.isArray(parsed)) rawPicks = parsed.filter((x) => typeof x === 'object' && x !== null);
  } catch {
    // Recup partiel : trouver les objets complets
    const matches = jsonMatch[0].match(/\{[^{}]+\}/g) || [];
    for (const m of matches) {
      try { rawPicks.push(JSON.parse(m)); } catch { /* skip */ }
    }
  }

  // Fonction utilitaire : index valide pour une catégorie ?
  const safeIdx = (idx: number | undefined, cat: keyof typeof byCategory): number => {
    if (Number.isInteger(idx) && idx! >= 0 && idx! < byCategory[cat].length) return idx!;
    return Math.floor(Math.random() * byCategory[cat].length);
  };

  // Construire les picks finaux pour chaque slot (complète aléatoirement si manquant)
  const picks = expectedSlots.map((slot, i) => {
    const raw = rawPicks[i] || {};
    return {
      slot,
      p: safeIdx(raw.p, 'proteine'),
      f: safeIdx(raw.f, 'feculent'),
      l: safeIdx(raw.l, 'legume'),
      d: includeDessert ? safeIdx(raw.d, 'dessert') : -1, // -1 = pas de dessert utilisé
    };
  });

  // Post-traitement variété : on parcourt les repas dans l'ordre, et on remplace
  // tout choix qui répète trop tôt par un alternatif respectant les fenêtres.
  const recentProteines: string[] = [];      // fenêtre 4 repas = 2 jours
  const recentFeculents: string[] = [];      // fenêtre 12 repas = 6 jours (max 2x/semaine)
  const recentLegumes: string[] = [];        // fenêtre 4 repas = pas de répétition adjacente
  const recentDessertBuckets: string[] = []; // fenêtre 3 repas

  const pickAlternative = (
    cat: keyof typeof byCategory,
    currentIdx: number,
    avoidNames: string[],
    avoidBucket?: string[]
  ): number => {
    const items = byCategory[cat];
    const candidates = items
      .map((it, idx) => ({ it, idx }))
      .filter(({ idx }) => idx !== currentIdx);

    const tryFilters = [
      // Idéal : pas dans avoid + bucket différent (si dessert)
      ({ it }: { it: BaseIngredient }) => !avoidNames.includes(it.name) && (!avoidBucket || !avoidBucket.includes(classifyDessert(it.name) || '')),
      // Relâche bucket
      ({ it }: { it: BaseIngredient }) => !avoidNames.includes(it.name),
      // Dernier recours : tout sauf l'index actuel
      () => true,
    ];

    for (const f of tryFilters) {
      const matches = candidates.filter(f);
      if (matches.length > 0) {
        return matches[Math.floor(Math.random() * matches.length)].idx;
      }
    }
    return currentIdx;
  };

  for (let i = 0; i < picks.length; i++) {
    const pk = picks[i];
    const proteine = byCategory.proteine[pk.p];

    // Vérifier protéine (fenêtre 4)
    if (recentProteines.includes(proteine.name)) {
      pk.p = pickAlternative('proteine', pk.p, recentProteines);
    }
    // Vérifier féculent (fenêtre 12)
    if (recentFeculents.includes(byCategory.feculent[pk.f].name)) {
      pk.f = pickAlternative('feculent', pk.f, recentFeculents);
    }
    // Vérifier légume (fenêtre 4)
    if (recentLegumes.includes(byCategory.legume[pk.l].name)) {
      pk.l = pickAlternative('legume', pk.l, recentLegumes);
    }
    // Vérifier dessert (fenêtre 3 buckets) — seulement si dessert activé
    if (includeDessert && pk.d >= 0) {
      const dessert = byCategory.dessert[pk.d];
      const dessertBucket = classifyDessert(dessert.name);
      if (dessertBucket && recentDessertBuckets.includes(dessertBucket)) {
        pk.d = pickAlternative('dessert', pk.d, [], recentDessertBuckets);
      }
    }

    // Mettre à jour les fenêtres avec les choix finaux
    recentProteines.push(byCategory.proteine[pk.p].name);
    recentFeculents.push(byCategory.feculent[pk.f].name);
    recentLegumes.push(byCategory.legume[pk.l].name);
    if (includeDessert && pk.d >= 0) {
      const finalDessertBucket = classifyDessert(byCategory.dessert[pk.d].name);
      if (finalDessertBucket) recentDessertBuckets.push(finalDessertBucket);
    }

    while (recentProteines.length > 4) recentProteines.shift();
    while (recentFeculents.length > 12) recentFeculents.shift();
    while (recentLegumes.length > 4) recentLegumes.shift();
    while (recentDessertBuckets.length > 3) recentDessertBuckets.shift();
  }

  // === Helpers pour calculer les alternatives par contrainte soft ===
  // Renvoie true si l'ingrédient respecte la contrainte donnée
  const isCompatibleWith = (ing: BaseIngredient, constraint: string): boolean => {
    if (constraint === 'vegetarien') return ing.is_vegetarien;
    if (constraint === 'sans-porc') return !ing.contains_porc;
    if (constraint === 'halal') return ing.halal_compatible;
    if (constraint === 'sans-gluten') return !ing.contains_gluten;
    if (constraint === 'sans-lactose') return !ing.contains_lactose;
    // Custom : extraire le mot-clé et vérifier l'absence dans nom/aliases
    const keyword = constraint
      .toLowerCase()
      .replace(/^(sans|pas\s+de|pas\s+d['']|allergique\s+(?:au[xs]?|[àa])?|aller?gie\s+(?:au[xs]?|[àa])?|j['']aime\s+pas|sans\s+les?)\s+/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (keyword.length < 3) return true;
    const haystack = [ing.name.toLowerCase(), ...ing.aliases.map((a) => a.toLowerCase())];
    return !haystack.some((h) => h.includes(keyword));
  };

  // Trouve un ingrédient compatible dans la même catégorie (même pool que le main)
  const findCompatibleSwap = (
    original: BaseIngredient,
    constraint: string
  ): BaseIngredient | null => {
    const items = byCategory[original.category] as BaseIngredient[];
    const compatible = items.filter((i) => i.name !== original.name && isCompatibleWith(i, constraint));
    if (compatible.length === 0) return null;
    return compatible[Math.floor(Math.random() * compatible.length)];
  };

  // Composer les suggestions finales + alternatives par contrainte soft
  return picks.map(({ slot, p, f, l, d }) => {
    const mainIngs: BaseIngredient[] = [
      byCategory.proteine[p],
      byCategory.feculent[f],
      byCategory.legume[l],
    ];
    if (includeDessert && d >= 0) mainIngs.push(byCategory.dessert[d]);

    const compiledIngredients = mainIngs.map((ing) => ({
      name: ing.name,
      quantity: (ing.qty_per_person_kg * nbPersons).toFixed(2),
      unit: 'kg',
      category: ing.category,
    }));

    const costPerPerson = mainIngs.reduce(
      (sum, ing) => sum + ing.qty_per_person_kg * (ing.price_per_kg_ht ?? 0),
      0
    );
    const totalCost = Math.round(costPerPerson * nbPersons * 100) / 100;

    // Pour chaque contrainte soft, calculer une alternative si nécessaire
    const alternatives: { for_constraint: string; count: number; ingredients: { name: string; quantity: string; unit: string; category: string }[]; estimated_cost: number }[] = [];

    for (const note of softNotes) {
      const alreadyCompatible = mainIngs.every((ing) => isCompatibleWith(ing, note.name));
      if (alreadyCompatible) continue;

      // Pour chaque ingrédient incompatible, chercher un swap dans la même catégorie
      const altIngs = mainIngs.map((ing) => {
        if (isCompatibleWith(ing, note.name)) return ing;
        return findCompatibleSwap(ing, note.name) || ing; // garde le main si aucune alternative dispo
      });

      // Si aucun swap n'a réussi (toutes les substitutions échouent), skip
      const swapped = altIngs.some((ing, idx) => ing.name !== mainIngs[idx].name);
      if (!swapped) continue;

      const altCompiled = altIngs.map((ing) => ({
        name: ing.name,
        quantity: (ing.qty_per_person_kg * note.count).toFixed(2),
        unit: 'kg',
        category: ing.category,
      }));
      const altCostPerPerson = altIngs.reduce(
        (sum, ing) => sum + ing.qty_per_person_kg * (ing.price_per_kg_ht ?? 0),
        0
      );
      const altTotal = Math.round(altCostPerPerson * note.count * 100) / 100;

      alternatives.push({
        for_constraint: note.name,
        count: note.count,
        ingredients: altCompiled,
        estimated_cost: altTotal,
      });
    }

    return {
      day_index: slot.day_index,
      meal_date: slot.meal_date,
      meal_type: slot.meal_type,
      ingredients: compiledIngredients,
      estimated_cost: totalCost,
      grocery_list: [],
      notes: null,
      alternatives,
    };
  });
}
