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
  const months = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'];
  return months[new Date().getMonth()];
}

function getCurrentSaison(): string {
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

  // v3: charger templates via colonne 'saison' TEXT[]
  // saison contient soit ['toutes'] soit ['printemps','ete',...] soit ['mai','juin',...]
  const supabase = createServerClient();
  const currentSaison = getCurrentSaison();
  const { data: templates, error: seasonErr } = await supabase
    .from('meal_templates')
    .select('*')
    .or(`saison.cs.{${currentMonth}},saison.cs.{${currentSaison}},saison.cs.{toutes}`);

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
  let pool = afterCost.length > 0 ? afterCost : allTemplates;

  // v3: filtrer selon les contraintes alimentaires (booleans)
  const constraints: string[] = establishment.dietary_constraints || [];
  const beforeDietary = pool.length;
  if (constraints.length > 0) {
    pool = pool.filter((t: Record<string, unknown>) => {
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
- Ne jamais utiliser la meme categorie_gemrcn sur 4 repas consecutifs (2 jours)
- Maximiser la variete des categories sur tout le span
- La premiere semaine doit couvrir AU MOINS 5 categories differentes (ne pas piocher toujours les memes au debut)
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

  // Post-traitement: corriger les redondances de categorie_gemrcn
  selections.sort((a, b) => {
    if (a.meal_date !== b.meal_date) return a.meal_date.localeCompare(b.meal_date);
    return a.meal_type === 'lunch' ? -1 : 1;
  });

  const usedInWindow: string[] = [];
  for (let i = 0; i < selections.length; i++) {
    const sel = selections[i];
    const template = filteredPool[sel.template_index];
    if (!template) continue;
    const cat = template.categorie_gemrcn as string;

    if (usedInWindow.includes(cat)) {
      const candidates = filteredPool
        .map((t: Record<string, unknown>, idx: number) => ({ t, idx }))
        .filter(({ idx, t }) =>
          idx !== sel.template_index &&
          !usedInWindow.includes(t.categorie_gemrcn as string)
        );

      if (candidates.length > 0) {
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        selections[i] = { ...sel, template_index: pick.idx };
        usedInWindow.push(pick.t.categorie_gemrcn as string);
      } else {
        usedInWindow.push(cat);
      }
    } else {
      usedInWindow.push(cat);
    }

    if (usedInWindow.length > 4) usedInWindow.shift();
  }

  // v3: ingredients ont quantity_kg, on convertit vers le format suggestion
  type V3Ingredient = { name: string; quantity_kg: number; price_ht_kg: number; category: string };

  return selections
    .filter((sel) => services.includes(sel.meal_type))
    .map((sel) => {
    const template = filteredPool[sel.template_index];
    if (!template) return null;

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
