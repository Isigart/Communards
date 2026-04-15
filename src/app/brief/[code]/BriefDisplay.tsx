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

const SLOT_LABELS: Record<string, string> = {
  matin: 'matin',
  aprem: 'apres-midi',
  soir: 'soir',
};

export function BriefDisplay({ establishmentName, suggestions, prepTasks, span }: Props) {
  const today = new Date().toISOString().split('T')[0];
  const todayMeals = suggestions.filter((s) => s.meal_date === today);
  const upcoming = suggestions.filter((s) => s.meal_date > today);

  const todayPrepsMatin = prepTasks.filter((t) => t.scheduled_day === today && t.scheduled_slot === 'matin');
  const todayPrepsAprem = prepTasks.filter((t) => t.scheduled_day === today && t.scheduled_slot === 'aprem');
  const todayPrepsSoir = prepTasks.filter((t) => t.scheduled_day === today && t.scheduled_slot === 'soir');
  const hasTodayPreps = todayPrepsMatin.length > 0 || todayPrepsAprem.length > 0 || todayPrepsSoir.length > 0;

  const formatDate = (date: string) =>
    new Date(date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <div className="min-h-screen p-4 max-w-lg mx-auto space-y-6">
      <header className="text-center">
        <h1 className="font-titre text-xl text-noir">Briefing</h1>
        <p className="text-sm text-muted">{establishmentName}</p>
        <p className="text-xs font-data text-muted mt-1">
          {formatDate(span.start_date)} → {formatDate(span.end_date)}
        </p>
      </header>

      {/* Preps du jour */}
      {hasTodayPreps && (
        <section>
          <h2 className="font-titre text-base text-noir mb-3">Preps du jour</h2>
          {[
            { preps: todayPrepsMatin, slot: 'matin' },
            { preps: todayPrepsAprem, slot: 'aprem' },
            { preps: todayPrepsSoir, slot: 'soir' },
          ].map(({ preps, slot }) =>
            preps.length > 0 ? (
              <div key={slot} className="mb-2">
                <p className="text-xs font-data text-muted mb-1">{SLOT_LABELS[slot]}</p>
                {preps.map((task) => (
                  <div key={task.id} className="card py-2 mb-1">
                    <p className="text-sm text-noir">{task.label}</p>
                  </div>
                ))}
              </div>
            ) : null
          )}
        </section>
      )}

      {/* Repas du jour */}
      <section>
        <h2 className="font-titre text-base text-noir mb-3">Aujourd&apos;hui</h2>
        {todayMeals.length === 0 ? (
          <p className="text-sm text-muted">Rien de prevu aujourd&apos;hui.</p>
        ) : (
          <div className="space-y-3">
            {todayMeals.map((s) => (
              <div key={s.id} className="card">
                <span className="font-titre text-sm text-noir">
                  {s.meal_type === 'lunch' ? 'Dejeuner' : 'Diner'}
                </span>
                <div className="mt-2 space-y-1">
                  {s.ingredients.map((ing, i) => (
                    <div key={i} className="flex justify-between items-center">
                      <span className="text-sm text-noir">{ing.name}</span>
                      <span className="text-sm font-data text-muted">{ing.quantity} {ing.unit}</span>
                    </div>
                  ))}
                </div>
                {s.notes && (
                  <p className="text-xs text-noir/60 italic mt-2">{s.notes}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* A venir */}
      {upcoming.length > 0 && (
        <section>
          <h2 className="font-titre text-base text-noir mb-3">A venir</h2>
          <div className="space-y-2">
            {upcoming.map((s) => {
              const dayPreps = prepTasks.filter((t) => t.scheduled_day === s.meal_date);
              return (
                <div key={s.id} className="card py-2.5">
                  <div className="flex justify-between items-center">
                    <span className="font-titre text-sm text-noir">
                      {new Date(s.meal_date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })}
                      {' — '}{s.meal_type === 'lunch' ? 'Dej' : 'Din'}
                    </span>
                    <span className="text-xs text-muted">
                      {s.ingredients.slice(0, 3).map((ing) => ing.name).join(', ')}
                    </span>
                  </div>
                  {s.notes && <p className="text-xs text-noir/60 italic mt-1">{s.notes}</p>}
                  {dayPreps.length > 0 && (
                    <p className="text-xs font-data text-muted mt-1">
                      preps : {dayPreps.map((t) => t.label).join(', ')}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
