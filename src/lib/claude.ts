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

  const prompt = `Repas du personnel — ${establishment.employee_count} personnes, ${establishment.budget_per_meal} ${config.currency}/repas max.
Du ${span.start_date} au ${span.end_date} (${span.day_count} jours).
${feedbackContext}
Pour chaque jour: dejeuner + diner. Ingredients + quantites pour ${establishment.employee_count} pers.
Regles: produits stables uniquement (pas de frais fragiles). Surgeles et conserves acceptes. Produits classes collectivite acceptes. Pas de condiments (sel, poivre, huile, vinaigre, epices de base sont deja en cuisine). Varier proteines/feculents/legumes. Saison.
Reponds UNIQUEMENT en JSON compact, pas de texte avant/apres:
[{"day_index":0,"meal_date":"YYYY-MM-DD","meal_type":"lunch","ingredients":[{"name":"...","quantity":"2","unit":"kg","category":"proteine"}],"estimated_cost":3.2,"grocery_list":[],"notes":null}]`;

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

  // Tenter de reparer un JSON tronque
  let jsonStr = jsonMatch[0];
  try {
    return JSON.parse(jsonStr);
  } catch {
    // Tronquer au dernier objet complet
    const lastComplete = jsonStr.lastIndexOf('},');
    if (lastComplete > 0) {
      jsonStr = jsonStr.substring(0, lastComplete + 1) + ']';
      return JSON.parse(jsonStr);
    }
    throw new Error('Failed to parse suggestions JSON');
  }
}
