import Anthropic from '@anthropic-ai/sdk';
import type { Establishment, Suggestion, Feedback, SupplySpan } from './types';
import { createServerClient } from './supabase';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

interface GenerateInput {
  establishment: Establishment;
  span: SupplySpan;
  pastFeedback: Feedback[];
}

function getCurrentMonth(): string {
  // v3: schema utilise les mois sans accents (matches saison TEXT[] CHECK constraint)
  const months = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'];
  return months[new Date().getMonth()];
}

function getCurrentSaison(): string {
  // Saison large pour matcher saison: ['ete'] / ['hiver'] etc.
  const m = new Date().getMonth() + 1;
  if (m === 12 || m <= 2) return 'hiver';
  if (m <= 5) return 'printemps';
  if (m <= 8) return 'ete';
  return 'automne';
}

export async function generateSuggestions(input: GenerateInput): Promise<Omit<Suggestion, 'id' | 'span_id' | 'establishment_id' | 'created_at'>[]> {
  const { establishment, span, pastFeedback } = input;
  const nbPersons = establishment.employee_count;
  const currentMonth = getCurrentMonth();

  // v3: charger templates du mois courant via colonne 'saison' TEXT[]
  // saison contient soit ['toutes'] soit ['printemps','ete',...] soit ['mai','juin',...]
  const supabase = createServerClient();
  const currentSaison = getCurrentSaison();
  const { data: templatesMonth, error: seasonErr } = await supabase
    .from('meal_templates')
    .select('*')
    .or(`saison.cs.{${currentMonth}},saison.cs.{${currentSaison}},saison.cs.{toutes}`);
  const templates = templatesMonth;

  const MIN_COST_PER_PERSON = 2.00;

  // Si pas de templates pour la saison, fallback sur tous
  const { data: allTemplatesRaw, error: allErr } = await supabase.from('meal_templates').select('*');
  const totalCount = allTemplatesRaw?.length || 0;
  const allTemplates = templates && templates.length > 0 ? templates : (allTemplatesRaw || []);

  if (allTemplates.length === 0) {
    const errInfo = allErr ? ` | allErr: ${allErr.message} (${allErr.code})` : '';
    const seasonInfo = seasonErr ? ` | seasonErr: ${seasonErr.message}` : '';
    throw new Error(`No meal templates in database (total: ${totalCount}, month: ${currentMonth}).${errInfo}${seasonInfo}`);
  }

  // Filtrer les repas en dessous du plancher
  const afterCost = allTemplates.filter((t: Record<string, unknown>) =>
    (t.estimated_cost_per_person as number) >= MIN_COST_PER_PERSON
  );
  // Si le filtre de cout vide tout, on garde tout (templates probablement mal price)
  let pool = afterCost.length > 0 ? afterCost : allTemplates;

  // Filtrer selon les contraintes alimentaires
  const constraints: string[] = establishment.dietary_constraints || [];
  const beforeDietary = pool.length;
  if (constraints.length > 0) {
    pool = pool.filter((t: Record<string, unknown>) => {
      const tags = (t.tags as string[]) || [];
      const containsPorc = (t.contains_porc as boolean) || false;
      const containsGluten = (t.contains_gluten as boolean) || false;
      const isVege = (t.is_vegetarien as boolean) || false;
      if (constraints.includes('vegetarien') && !isVege) return false;
      if (constraints.includes('sans-porc') && containsPorc) return false;
      if (constraints.includes('halal') && !(t.halal_compatible as boolean)) return false;
      if (constraints.includes('sans-gluten') && containsGluten) return false;
      if (constraints.includes('sans-lactose') && (t.contains_lactose as boolean)) return false;
      return true;
    });
  }

  if (pool.length === 0) {
    throw new Error(`Pool vide apres contraintes [${constraints.join(', ')}]. ${beforeDietary} templates avant filtrage dietetique, total en base: ${totalCount}, mois: ${currentMonth}.`);
  }

  // Construire la liste compacte des repas disponibles
  const templateList = pool.map((t: Record<string, unknown>, i: number) =>
    `${i}|${t.name}|${t.categorie_gemrcn}|${(t.estimated_cost_per_person as number)?.toFixed(2)}€`
  ).join('\n');

  // Construire le contexte feedback avec les noms des repas
  let feedbackContext = '';
  if (pastFeedback.length > 0) {
    // Charger les suggestions associees aux feedbacks
    const feedbackSuggestionIds = pastFeedback.map(f => f.suggestion_id).filter(Boolean);
    let feedbackSuggestions: Record<string, unknown>[] = [];
    if (feedbackSuggestionIds.length > 0) {
      const { data } = await supabase
        .from('suggestions')
        .select('id, ingredients')
        .in('id', feedbackSuggestionIds);
      feedbackSuggestions = data || [];
    }

    const liked = pastFeedback
      .filter(f => f.status === 'done')
      .map(f => {
        const sug = feedbackSuggestions.find(s => s.id === f.suggestion_id);
        if (!sug) return null;
        const ings = (sug.ingredients as { name: string }[]) || [];
        return ings.slice(0, 2).map(i => i.name).join(', ');
      })
      .filter(Boolean);

    const disliked = pastFeedback
      .filter(f => f.status === 'skipped')
      .map(f => {
        const sug = feedbackSuggestions.find(s => s.id === f.suggestion_id);
        if (!sug) return null;
        const ings = (sug.ingredients as { name: string }[]) || [];
        return ings.slice(0, 2).map(i => i.name).join(', ');
      })
      .filter(Boolean);

    if (liked.length > 0) feedbackContext += `\nRepas apprecies: ${liked.join(' | ')}`;
    if (disliked.length > 0) feedbackContext += `\nRepas a eviter: ${disliked.join(' | ')}`;
  }

  // Determiner les services a generer
  const services = (establishment.services && establishment.services.length > 0)
    ? establishment.services
    : ['lunch', 'dinner'];
  const servicesLabel = services.length === 2
    ? 'dejeuner + diner chaque jour'
    : services[0] === 'lunch' ? 'dejeuner uniquement' : 'diner uniquement';

  // Les templates ne sont plus separes par meal_type — on utilise tout le pool
  // Melange aleatoire pour eviter que Claude suive l'ordre d'insertion
  const filteredPool = [...pool].sort(() => Math.random() - 0.5);

  const filteredTemplateList = filteredPool.map((t: Record<string, unknown>, i: number) =>
    `${i}|${t.name}|${t.categorie_gemrcn}|${(t.estimated_cost_per_person as number)?.toFixed(2)}€`
  ).join('\n');

  const exampleSelections = services.map((s) =>
    `{"day_index":0,"meal_date":"${span.start_date}","meal_type":"${s}","template_index":${services.indexOf(s) * 5}}`
  ).join(',');

  const prompt = `Choisis des repas pour ${span.day_count} jours (${span.start_date} au ${span.end_date}), ${servicesLabel}.
${nbPersons} personnes, max ${establishment.budget_per_meal}€/pers/repas.
${feedbackContext}

Repas disponibles (index|nom|categorie_gemrcn|cout):
${filteredTemplateList}

Regles IMPORTANTES:
- Ne genere que les services demandes (${services.join(', ')})
- Ne jamais utiliser la meme proteine sur 4 repas consecutifs (2 jours)
- Maximiser la variete des proteines sur tout le span
- La premiere semaine doit couvrir AU MOINS 5 proteines differentes (ne pas piocher toujours les memes au debut)
- Varier les feculents : un meme feculent (riz, pates, pommes de terre, semoule, lentilles, quinoa, boulgour...) max 2 fois par semaine
- Inclure au moins 2 repas vegetariens par semaine (ils couvrent toutes les contraintes : vegetarien, sans-porc, halal)
- Alterner les couts, minimum ${MIN_COST_PER_PERSON}€/pers par repas
- Privilegier les repas apprecies, eviter les repas mal notes
- Coherence : eviter de mettre deux plats "lourds" consecutifs (ex: blanquette midi + pot-au-feu soir). Alterner plat chaud/plat froid quand possible
Reponds UNIQUEMENT avec les index choisis en JSON:
[${exampleSelections}]`;

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

  let selections: { day_index: number; meal_date: string; meal_type: string; template_index: number }[];
  try {
    selections = JSON.parse(jsonMatch[0]);
  } catch {
    const lastComplete = jsonMatch[0].lastIndexOf('},');
    if (lastComplete > 0) {
      selections = JSON.parse(jsonMatch[0].substring(0, lastComplete + 1) + ']');
    } else {
      throw new Error('Failed to parse selections JSON');
    }
  }

  // Post-traitement: corriger les redondances sur 3 niveaux
  // 1. Cartes : pas la même carte sur fenêtre de 4 repas (2 jours)
  // 2. Accompagnements (féculent + légume) : pas le même sur les 2 derniers repas
  //    (les desserts/laitages sont OK à répéter — yaourt tous les jours c'est conforme GEMRCN)
  // 3. Catégorie GEMRCN protéine : pas la même sur 4 repas consécutifs
  selections.sort((a, b) => {
    if (a.meal_date !== b.meal_date) return a.meal_date.localeCompare(b.meal_date);
    return a.meal_type === 'lunch' ? -1 : 1;
  });

  type V3IngredientType = { name: string; quantity_kg?: number; price_ht_kg?: number; category?: string };

  const recentCardIds: number[] = [];        // window de 4 cartes (2 jours)
  const recentSides: string[] = [];          // window de féculents+légumes des 2 derniers repas
  const recentCategories: string[] = [];     // window de 4 catégories GEMRCN

  // On ne suit QUE les féculents et légumes (les accompagnements visibles)
  // → ignorer les protéines (déjà gérées par catégorie GEMRCN) et desserts (laitages OK à répéter)
  const getCardSides = (t: Record<string, unknown>): string[] =>
    ((t.ingredients as V3IngredientType[]) || [])
      .filter((ing) => ing.category === 'feculent' || ing.category === 'legume')
      .map((ing) => ing.name);

  for (let i = 0; i < selections.length; i++) {
    const sel = selections[i];
    const template = filteredPool[sel.template_index];
    if (!template) continue;

    const protein = template.categorie_gemrcn as string;
    const cardSides = getCardSides(template);
    const sidesOverlap = cardSides.filter((n) => recentSides.includes(n)).length;

    const cardRepeated = recentCardIds.includes(sel.template_index);
    const proteinRepeated = recentCategories.includes(protein);
    const sidesRepeated = sidesOverlap >= 1; // strict : aucun féculent/légume en commun

    if (cardRepeated || proteinRepeated || sidesRepeated) {
      // Cherche le meilleur remplaçant
      // Stratégie : on essaie d'abord "tout propre" (overlap=0, carte/cat différentes),
      // puis on relâche progressivement pour ne jamais bloquer
      const allCandidates = filteredPool
        .map((t: Record<string, unknown>, idx: number) => {
          const sides = getCardSides(t);
          const ovlp = sides.filter((n) => recentSides.includes(n)).length;
          return { t, idx, ovlp, cat: t.categorie_gemrcn as string };
        })
        .filter(({ idx }) => idx !== sel.template_index);

      const tryFilters = [
        // 1. parfait : carte non-récente, catégorie non-récente, 0 overlap accompagnement
        (c: typeof allCandidates[0]) => !recentCardIds.includes(c.idx) && !recentCategories.includes(c.cat) && c.ovlp === 0,
        // 2. assoupli : on accepte 1 overlap d'accompagnement
        (c: typeof allCandidates[0]) => !recentCardIds.includes(c.idx) && !recentCategories.includes(c.cat) && c.ovlp <= 1,
        // 3. on accepte la même catégorie protéine si rien d'autre
        (c: typeof allCandidates[0]) => !recentCardIds.includes(c.idx) && c.ovlp === 0,
        // 4. dernier recours : juste pas la même carte
        (c: typeof allCandidates[0]) => !recentCardIds.includes(c.idx),
      ];

      let pick: typeof allCandidates[0] | null = null;
      for (const f of tryFilters) {
        const matches = allCandidates.filter(f);
        if (matches.length > 0) {
          // Parmi les matches, prendre celui avec le moins d'overlap, sinon random
          matches.sort((a, b) => a.ovlp - b.ovlp);
          const minOvlp = matches[0].ovlp;
          const best = matches.filter((c) => c.ovlp === minOvlp);
          pick = best[Math.floor(Math.random() * best.length)];
          break;
        }
      }

      if (pick) {
        selections[i] = { ...sel, template_index: pick.idx };
      }
    }

    // Mettre à jour les fenêtres avec la carte finalement retenue
    const finalTemplate = filteredPool[selections[i].template_index];
    if (finalTemplate) {
      recentCardIds.push(selections[i].template_index);
      recentCategories.push(finalTemplate.categorie_gemrcn as string);
      recentSides.push(...getCardSides(finalTemplate));
    }

    // Sliding windows
    while (recentCardIds.length > 4) recentCardIds.shift();         // 4 cartes = 2 jours
    while (recentCategories.length > 4) recentCategories.shift();   // 4 catégories = 2 jours
    while (recentSides.length > 4) recentSides.shift();             // ~4 sides = 2 derniers repas (1 fec + 1 leg × 2)
  }

  // Transformer les selections en suggestions completes
  return selections
    .filter((sel) => services.includes(sel.meal_type))
    .map((sel) => {
    const template = filteredPool[sel.template_index];
    if (!template) return null;

    // v3: ingredients ont quantity_kg, on convertit vers le format suggestion (quantity + unit)
    type V3Ingredient = { name: string; quantity_kg: number; price_ht_kg: number; category: string };
    const ingredients = ((template.ingredients as V3Ingredient[]) || []).map((ing) => ({
      name: ing.name,
      quantity: (ing.quantity_kg * nbPersons).toFixed(2),
      unit: 'kg',
      category: ing.category,
    }));

    return {
      day_index: sel.day_index,
      meal_date: sel.meal_date,
      meal_type: sel.meal_type as 'lunch' | 'dinner',
      ingredients,
      estimated_cost: Math.round((template.estimated_cost_per_person as number) * nbPersons * 100) / 100,
      grocery_list: [],
      notes: null,
    };
  }).filter(Boolean) as Omit<Suggestion, 'id' | 'span_id' | 'establishment_id' | 'created_at'>[];
}
