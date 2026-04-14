import type { Supplier } from './types';

export interface SpanDefinition {
  start_day: number; // 0=Sun ... 6=Sat
  end_day: number;
  day_count: number;
  order_day: number; // jour de commande qui declenche ce span
}

/**
 * Calcule les supply spans a partir des jours de commande.
 * Le span commence le LENDEMAIN du jour de commande
 * et se termine le jour de la PROCHAINE commande inclus.
 *
 * Exemple: commande Mardi (2) + Vendredi (5)
 *   Commande mardi → Span: Mer (3) → Ven (5) = 3 jours
 *   Commande vendredi → Span: Sam (6) → Mar (2) = 4 jours
 */
export function computeSpanDefinitions(orderDays: number[]): SpanDefinition[] {
  if (orderDays.length === 0) return [];

  const sorted = [...orderDays].sort((a, b) => a - b);
  const spans: SpanDefinition[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const orderDay = sorted[i];
    const nextOrderDay = sorted[(i + 1) % sorted.length];
    const startDay = (orderDay + 1) % 7; // lendemain de la commande

    const dayCount = nextOrderDay > orderDay
      ? nextOrderDay - orderDay
      : 7 - orderDay + nextOrderDay;

    const endDay = nextOrderDay;
    spans.push({ start_day: startDay, end_day: endDay, day_count: dayCount, order_day: orderDay });
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
 * Retourne le prochain jour de commande a partir d'aujourd'hui.
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
