'use client';

import type { Suggestion, SupplySpan } from '@/lib/types';

interface PrepTask {
  id: string;
  label: string;
  scheduled_day: string | null;
  scheduled_slot: string | null;
}

interface Props {
  establishmentName: string;
  suggestions: Suggestion[];
  prepTasks: PrepTask[];
  span: SupplySpan;
}

const shortName = (name: string) =>
  name.split(/\s+(surgelé|qualité|boîte|UE|France|Import|IQF|DD|en rondelles|en branches|très fins|coupés|émincés|précuit)/i)[0].trim();

export function BriefDisplay({ establishmentName, suggestions, prepTasks, span }: Props) {
  const today = new Date().toISOString().split('T')[0];

  // Toutes les dates du span
  const allDates: string[] = [];
  const start = new Date(span.start_date + 'T00:00:00');
  const end = new Date(span.end_date + 'T00:00:00');
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    allDates.push(d.toISOString().split('T')[0]);
  }

  const getMeals = (date: string) => suggestions.filter((s) => s.meal_date === date);
  const getPreps = (date: string) => prepTasks.filter((t) => t.scheduled_day === date);

  const formatDay = (date: string) =>
    new Date(date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  const slotLabel = (slot: string | null) => {
    if (slot === 'matin') return 'matin';
    if (slot === 'aprem') return 'aprem';
    if (slot === 'soir') return 'soir';
    return '';
  };

  return (
    <div className="min-h-screen p-4 max-w-lg mx-auto space-y-6">
      <header className="text-center">
        <h1 className="font-titre text-xl text-noir">{establishmentName}</h1>
        <p className="font-data text-xs text-muted mt-1">
          {new Date(span.start_date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} → {new Date(span.end_date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
        </p>
      </header>

      {allDates.map((date) => {
        const meals = getMeals(date);
        const preps = getPreps(date);
        const isToday = date === today;
        const isPast = date < today;
        const lunch = meals.find((m) => m.meal_type === 'lunch');
        const dinner = meals.find((m) => m.meal_type === 'dinner');

        return (
          <div key={date} className={isPast ? 'opacity-40' : ''}>
            <h2 className={`font-titre text-base mb-2 capitalize ${isToday ? 'text-rouge' : 'text-noir'}`}>
              {isToday && 'Aujourd\u2019hui — '}
              {formatDay(date)}
            </h2>

            <div className="space-y-2">
              {/* Dejeuner */}
              {lunch && (
                <div className="card py-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-data text-xs text-muted">dejeuner</span>
                    {lunch.estimated_cost && (
                      <span className="font-data text-xs text-muted">~{(lunch.estimated_cost / (lunch.ingredients.length > 0 ? 1 : 1)).toFixed(0)} EUR</span>
                    )}
                  </div>
                  {lunch.ingredients.map((ing, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-noir">{shortName(ing.name)}</span>
                      <span className="font-data text-muted">{ing.quantity} {ing.unit}</span>
                    </div>
                  ))}
                  {lunch.notes && (
                    <p className="text-xs text-noir/60 italic mt-2">{lunch.notes}</p>
                  )}
                </div>
              )}

              {/* Diner */}
              {dinner && (
                <div className="card py-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-data text-xs text-muted">diner</span>
                    {dinner.estimated_cost && (
                      <span className="font-data text-xs text-muted">~{(dinner.estimated_cost).toFixed(0)} EUR</span>
                    )}
                  </div>
                  {dinner.ingredients.map((ing, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-noir">{shortName(ing.name)}</span>
                      <span className="font-data text-muted">{ing.quantity} {ing.unit}</span>
                    </div>
                  ))}
                  {dinner.notes && (
                    <p className="text-xs text-noir/60 italic mt-2">{dinner.notes}</p>
                  )}
                </div>
              )}

              {/* Preps du jour */}
              {preps.length > 0 && (
                <div className="card py-3 bg-noir/5 border-none">
                  <span className="font-data text-xs text-muted">preps</span>
                  {preps.map((task) => (
                    <div key={task.id} className="flex justify-between text-sm mt-0.5">
                      <span className="text-noir">{task.label}</span>
                      <span className="font-data text-xs text-muted">{slotLabel(task.scheduled_slot)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
