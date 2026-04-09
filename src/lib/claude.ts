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

  const prompt = `Tu es un assistant culinaire pour le repas du personnel (la table de l'equipe) en restauration professionnelle.

Etablissement: ${establishment.name}
Nombre d'employes: ${establishment.employee_count}
Budget par repas: ${establishment.budget_per_meal} ${config.currency}
Marche: ${config.supplier_ref}
Periode: ${span.start_date} au ${span.end_date} (${span.day_count} jours, ${span.meal_count} repas)
${feedbackContext}

Genere des combinaisons d'ingredients pour chaque repas de cette periode.
Regles:
- Pas de recettes, juste des combinaisons d'ingredients
- Respecter le budget par repas
- Varier les proteines, feculents, legumes
- Privilegier les produits de saison
- Adapter au marche local (${config.supplier_ref})
- Si feedback "skipped" sur un ingredient, l'eviter
- Si feedback "modified", tenir compte des ajustements

Reponds en JSON valide uniquement, sous cette forme:
[
  {
    "day_index": 0,
    "meal_date": "YYYY-MM-DD",
    "meal_type": "lunch",
    "ingredients": [{"name": "...", "quantity": "...", "unit": "kg", "category": "proteine"}],
    "estimated_cost": 3.20,
    "grocery_list": [{"name": "...", "quantity": "...", "unit": "kg", "supplier": "..."}],
    "notes": null
  }
]`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '';
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error('Failed to parse suggestions from Claude response');
  }

  return JSON.parse(jsonMatch[0]);
}
