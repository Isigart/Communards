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
  const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  return months[new Date().getMonth()];
}

export async function generateSuggestions(input: GenerateInput): Promise<Omit<Suggestion, 'id' | 'span_id' | 'establishment_id' | 'created_at'>[]> {
  const { establishment, span, pastFeedback } = input;
  const nbPersons = establishment.employee_count;
  const currentMonth = getCurrentMonth();

  // Charger les templates du mois courant (la colonne 'season' contient les mois)
  const supabase = createServerClient();
  const { data: templates } = await supabase
    .from('meal_templates')
    .select('*')
    .contains('season', [currentMonth]);

  const MIN_COST_PER_PERSON = 2.00;

  // Si pas de templates pour la saison, fallback sur tous
  const { data: allTemplatesRaw } = await supabase.from('meal_templates').select('*');
  const totalCount = allTemplatesRaw?.length || 0;
  const allTemplates = templates && templates.length > 0 ? templates : (allTemplatesRaw || []);

  if (allTemplates.length === 0) {
    throw new Error(`No meal templates in database (total: ${totalCount}). Ajoute des templates dans la table meal_templates.`);
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
      if (constraints.includes('vegetarien') && !tags.includes('vegetarien')) return false;
      if (constraints.includes('sans-porc')) {
        if (t.protein_type === 'porc') return false;
        if (!tags.includes('sans-porc') && !tags.includes('halal') && !tags.includes('vegetarien')) return false;
      }
      if (constraints.includes('sans-gluten') && !tags.includes('sans-gluten')) return false;
      return true;
    });
  }

  if (pool.length === 0) {
    throw new Error(`Pool vide apres contraintes [${constraints.join(', ')}]. ${beforeDietary} templates avant filtrage dietetique, total en base: ${totalCount}, mois: ${currentMonth}.`);
  }

  // Construire la liste compacte des repas disponibles
  const templateList = pool.map((t: Record<string, unknown>, i: number) =>
    `${i}|${t.name}|${t.meal_type}|${t.protein_type}|${(t.estimated_cost_per_person as number)?.toFixed(2)}€`
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

  // Filtrer le pool sur les meal_type demandes
  const filteredPool = pool.filter((t: Record<string, unknown>) =>
    services.includes(t.meal_type as string)
  );

  if (filteredPool.length === 0) {
    throw new Error(`Aucun template pour les services [${services.join(', ')}]. Pool avant: ${pool.length}. Verifie les meal_type dans meal_templates.`);
  }

  const filteredTemplateList = filteredPool.map((t: Record<string, unknown>, i: number) =>
    `${i}|${t.name}|${t.meal_type}|${t.protein_type}|${(t.estimated_cost_per_person as number)?.toFixed(2)}€`
  ).join('\n');

  const exampleSelections = services.map((s) =>
    `{"day_index":0,"meal_date":"${span.start_date}","meal_type":"${s}","template_index":${services.indexOf(s) * 5}}`
  ).join(',');

  const prompt = `Choisis des repas pour ${span.day_count} jours (${span.start_date} au ${span.end_date}), ${servicesLabel}.
${nbPersons} personnes, max ${establishment.budget_per_meal}€/pers/repas.
${feedbackContext}

Repas disponibles (index|nom|type|proteine|cout):
${filteredTemplateList}

Regles IMPORTANTES:
- Ne genere que les services demandes (${services.join(', ')})
- Ne jamais utiliser la meme proteine sur 4 repas consecutifs (2 jours)
- Maximiser la variete des proteines sur tout le span
- Alterner les couts, minimum ${MIN_COST_PER_PERSON}€/pers par repas
- Privilegier les repas apprecies, eviter les repas mal notes
Reponds UNIQUEMENT avec les index choisis en JSON:
[${exampleSelections}]`;

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
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

  // Post-traitement: corriger les redondances de proteines
  // Regle: pas la meme proteine sur 2 repas consecutifs (dej + din du meme jour, ou diner soir + dejeuner lendemain)
  selections.sort((a, b) => {
    if (a.meal_date !== b.meal_date) return a.meal_date.localeCompare(b.meal_date);
    return a.meal_type === 'lunch' ? -1 : 1;
  });

  const usedInWindow: string[] = []; // proteines des 2 derniers repas
  for (let i = 0; i < selections.length; i++) {
    const sel = selections[i];
    const template = filteredPool[sel.template_index];
    if (!template) continue;
    const protein = template.protein_type as string;

    if (usedInWindow.includes(protein)) {
      // Chercher un remplacement : meme meal_type, proteine differente (tous les templates eligibles)
      const candidates = filteredPool
        .map((t: Record<string, unknown>, idx: number) => ({ t, idx }))
        .filter(({ t, idx }) =>
          idx !== sel.template_index &&
          t.meal_type === sel.meal_type &&
          !usedInWindow.includes(t.protein_type as string)
        );

      if (candidates.length > 0) {
        // Prendre un candidat au hasard pour eviter de toujours choisir le meme
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        selections[i] = { ...sel, template_index: pick.idx };
        usedInWindow.push(pick.t.protein_type as string);
      } else {
        usedInWindow.push(protein);
      }
    } else {
      usedInWindow.push(protein);
    }

    // Ne garder que les 4 proteines les plus recentes (2 jours complets)
    if (usedInWindow.length > 4) usedInWindow.shift();
  }

  // Transformer les selections en suggestions completes
  return selections
    .filter((sel) => services.includes(sel.meal_type))
    .map((sel) => {
    const template = filteredPool[sel.template_index];
    if (!template) return null;

    // Multiplier les quantites par le nombre de personnes
    const ingredients = ((template.ingredients as Record<string, string>[]) || []).map((ing) => ({
      name: ing.name,
      quantity: (parseFloat(ing.quantity) * nbPersons).toFixed(1),
      unit: ing.unit,
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
