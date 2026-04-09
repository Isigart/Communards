import type { Supplier } from './types';

export interface SpanDefinition {
  start_day: number; // 0=Sun ... 6=Sat
  end_day: number;
  day_count: number;
}

/**
 * Calcule les supply spans a partir des jours de livraison d'un fournisseur.
 * Les spans couvrent la periode entre deux livraisons consecutives.
 *
 * Exemple: Metro livre Lundi (1) + Jeudi (4)
 *   Span 1: Lun → Mer (3 jours)
 *   Span 2: Jeu → Dim (4 jours)
 */
export function computeSpanDefinitions(deliveryDays: number[]): SpanDefinition[] {
  if (deliveryDays.length === 0) return [];

  const sorted = [...deliveryDays].sort((a, b) => a - b);
  const spans: SpanDefinition[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const startDay = sorted[i];
    const nextDelivery = sorted[(i + 1) % sorted.length];
    const dayCount = nextDelivery > startDay
      ? nextDelivery - startDay
      : 7 - startDay + nextDelivery;

    const endDay = (startDay + dayCount - 1) % 7;
    spans.push({ start_day: startDay, end_day: endDay, day_count: dayCount });
  }

  return spans;
}

/**
 * Genere les spans concrets (avec dates) pour une semaine donnee.
 */
export function generateWeekSpans(
  supplier: Supplier,
  weekStartDate: Date
): { start_date: string; end_date: string; day_count: number }[] {
  const definitions = computeSpanDefinitions(supplier.delivery_days);
  const spans: { start_date: string; end_date: string; day_count: number }[] = [];

  for (const def of definitions) {
    const start = new Date(weekStartDate);
    const currentDay = start.getDay();
    const daysUntilStart = (def.start_day - currentDay + 7) % 7;
    start.setDate(start.getDate() + daysUntilStart);

    const end = new Date(start);
    end.setDate(end.getDate() + def.day_count - 1);

    spans.push({
      start_date: formatDate(start),
      end_date: formatDate(end),
      day_count: def.day_count,
    });
  }

  return spans;
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

/**
 * Retourne le prochain jour de livraison a partir d'aujourd'hui.
 */
export function nextDeliveryDay(deliveryDays: number[], from: Date = new Date()): Date {
  const today = from.getDay();
  const sorted = [...deliveryDays].sort((a, b) => a - b);

  for (const day of sorted) {
    if (day >= today) {
      const result = new Date(from);
      result.setDate(result.getDate() + (day - today));
      return result;
    }
  }

  // Wrap to next week
  const result = new Date(from);
  result.setDate(result.getDate() + (7 - today + sorted[0]));
  return result;
}
