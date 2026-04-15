import Anthropic from '@anthropic-ai/sdk';
import type { Establishment, Suggestion, Feedback, SupplySpan } from './types';
import { createServerClient } from './supabase';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

interface GenerateInput {
  establishment: Establishment;
  span: SupplySpan;
  pastFeedback: Feedback[];
}

function getCurrentSeason(): string {
  const month = new Date().getMonth() + 1;
  if (month >= 3 && month <= 5) return 'printemps';
  if (month >= 6 && month <= 8) return 'ete';
  if (month >= 9 && month <= 11) return 'automne';
  return 'hiver';
}

export async function generateSuggestions(input: GenerateInput): Promise<Omit<Suggestion, 'id' | 'span_id' | 'establishment_id' | 'created_at'>[]> {
  const { establishment, span, pastFeedback } = input;
  const nbPersons = establishment.employee_count;
  const season = getCurrentSeason();

  // Charger les templates de la saison
  const supabase = createServerClient();
  const { data: templates } = await supabase
    .from('meal_templates')
    .select('*')
    .contains('season', [season]);

  const MIN_COST_PER_PERSON = 3.50;

  // Si pas de templates, fallback sur tous
  const allTemplates = templates && templates.length > 0
    ? templates
    : (await supabase.from('meal_templates').select('*')).data || [];

  // Filtrer les repas en dessous du plancher
  const pool = allTemplates.filter((t: Record<string, unknown>) =>
    (t.estimated_cost_per_person as number) >= MIN_COST_PER_PERSON
  );

  if (pool.length === 0) {
    throw new Error('No meal templates available above minimum cost');
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

  const prompt = `Choisis des repas pour ${span.day_count} jours (${span.start_date} au ${span.end_date}), dejeuner + diner chaque jour.
${nbPersons} personnes, max ${establishment.budget_per_meal}€/pers/repas.
${feedbackContext}

Repas disponibles (index|nom|type|proteine|cout):
${templateList}

Regles: varier les proteines (pas la meme 2 jours de suite), alterner les couts, minimum ${MIN_COST_PER_PERSON}€/pers par repas. Privilegier les repas apprecies, eviter les repas mal notes. Reponds UNIQUEMENT avec les index choisis en JSON:
[{"day_index":0,"meal_date":"${span.start_date}","meal_type":"lunch","template_index":5},{"day_index":0,"meal_date":"${span.start_date}","meal_type":"dinner","template_index":12}]`;

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

  // Transformer les selections en suggestions completes
  return selections.map((sel) => {
    const template = pool[sel.template_index];
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
