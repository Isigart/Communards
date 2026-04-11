import Anthropic from '@anthropic-ai/sdk';
import type { Establishment, Suggestion, Feedback, SupplySpan, Ingredient } from './types';
import { MARKET_CONFIG } from './types';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

interface GenerateInput {
  establishment: Establishment;
  span: SupplySpan;
  pastFeedback: Feedback[];
}

export async function generateSuggestions(input: GenerateInput): Promise<Omit<Suggestion, 'id' | 'span_id' | 'establishment_id' | 'created_at'>[]> {
  const { establishment, span, pastFeedback } = input;
  const config = MARKET_CONFIG[establishment.market];

  const feedbackContext = pastFeedback.length > 0
    ? `\nHistorique feedback recent:\n${pastFeedback.map(f =>
        `- ${f.status}${f.notes ? `: ${f.notes}` : ''}`
      ).join('\n')}`
    : '';

  const prompt = `Repas du personnel — ${establishment.name}, ${establishment.employee_count} personnes, ${establishment.budget_per_meal} ${config.currency}/repas max.
Periode: ${span.start_date} au ${span.end_date} (${span.day_count} jours).
${feedbackContext}

Pour chaque jour, genere dejeuner + diner. Combinaisons d'ingredients uniquement (pas de recettes). Quantites pour ${establishment.employee_count} personnes. Varier proteines/feculents/legumes. Produits de saison.

JSON uniquement:
[{"day_index":0,"meal_date":"YYYY-MM-DD","meal_type":"lunch","ingredients":[{"name":"...","quantity":"...","unit":"kg","category":"proteine"}],"estimated_cost":3.20,"grocery_list":[{"name":"...","quantity":"...","unit":"kg","supplier":"${config.supplier_ref}"}],"notes":null}]`;

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '';
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error('Failed to parse suggestions from Claude response');
  }

  return JSON.parse(jsonMatch[0]);
}
