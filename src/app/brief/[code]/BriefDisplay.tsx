'use client';

import type { Suggestion, SupplySpan } from '@/lib/types';

interface Props {
  establishmentName: string;
  suggestions: Suggestion[];
  span: SupplySpan;
}

export function BriefDisplay({ establishmentName, suggestions, span }: Props) {
  const today = new Date().toISOString().split('T')[0];
  const todayMeals = suggestions.filter((s) => s.meal_date === today);
  const upcoming = suggestions.filter((s) => s.meal_date > today);

  return (
    <div className="min-h-screen p-4 max-w-lg mx-auto space-y-6">
      <header className="text-center">
        <h1 className="text-xl font-bold text-brand-600">Briefing</h1>
        <p className="text-sm text-gray-500">{establishmentName}</p>
        <p className="text-xs text-gray-400">
          {span.start_date} → {span.end_date}
        </p>
      </header>

      <section>
        <h2 className="font-semibold text-gray-700 mb-3">Aujourd&apos;hui</h2>
        {todayMeals.length === 0 ? (
          <p className="text-sm text-gray-400">Rien pour aujourd&apos;hui.</p>
        ) : (
          <div className="space-y-3">
            {todayMeals.map((s) => (
              <div key={s.id} className="card">
                <span className="text-xs font-medium uppercase text-brand-500">
                  {s.meal_type === 'lunch' ? 'Dejeuner' : 'Diner'}
                </span>
                <div className="mt-2 flex flex-wrap gap-1">
                  {s.ingredients.map((ing, i) => (
                    <span
                      key={i}
                      className="inline-block text-sm bg-brand-50 text-brand-700 rounded-full px-3 py-1"
                    >
                      {ing.name} — {ing.quantity} {ing.unit}
                    </span>
                  ))}
                </div>
                {s.notes && (
                  <p className="text-xs text-gray-500 mt-2">{s.notes}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {upcoming.length > 0 && (
        <section>
          <h2 className="font-semibold text-gray-700 mb-3">A venir</h2>
          <div className="space-y-2">
            {upcoming.map((s) => (
              <div key={s.id} className="card py-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">
                    {new Date(s.meal_date + 'T00:00:00').toLocaleDateString('fr-FR', {
                      weekday: 'short',
                      day: 'numeric',
                    })}
                    {' — '}
                    {s.meal_type === 'lunch' ? 'Dej' : 'Din'}
                  </span>
                  <span className="text-xs text-gray-400">
                    {s.ingredients.map((ing) => ing.name).join(', ')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
