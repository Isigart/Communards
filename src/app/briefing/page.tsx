'use client';

import { useEffect, useState } from 'react';
import type { Suggestion, SupplySpan } from '@/lib/types';
import { getToken, fetchSuggestions, fetchPrepTasks } from '@/lib/cache';

interface PrepTask {
  id: string;
  label: string;
  scheduled_day: string | null;
  scheduled_slot: string | null;
}

const shortName = (name: string) =>
  name.split(/\s+(surgelé|qualité|boîte|UE|France|Import|IQF|DD|en rondelles|en branches|très fins|coupés|émincés|précuit)/i)[0].trim();

const slotLabel = (slot: string | null) => {
  if (slot === 'matin') return 'matin';
  if (slot === 'aprem') return 'aprem';
  if (slot === 'soir') return 'soir';
  return '';
};

export default function BriefingPage() {
  const [span, setSpan] = useState<SupplySpan | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [prepTasks, setPrepTasks] = useState<PrepTask[]>([]);
  const [briefCode, setBriefCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [sugData, preps] = await Promise.all([
      fetchSuggestions(true),
      fetchPrepTasks(true),
    ]);
    setSpan(sugData.span);
    setSuggestions(sugData.suggestions);
    setPrepTasks(preps as unknown as PrepTask[]);
    setLoading(false);
  }

  async function generateCode() {
    if (!span) return;
    setGenerating(true);
    const token = await getToken();
    if (!token) return;
    const res = await fetch('/api/brief', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ span_id: span.id }),
    });
    if (res.ok) {
      const data = await res.json();
      setBriefCode(data.code);
    }
    setGenerating(false);
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><p className="text-muted">On prepare le briefing...</p></div>;
  }

  const today = new Date().toISOString().split('T')[0];

  // Toutes les dates du span
  const allDates: string[] = [];
  if (span) {
    const start = new Date(span.start_date + 'T00:00:00');
    const end = new Date(span.end_date + 'T00:00:00');
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      allDates.push(d.toISOString().split('T')[0]);
    }
  }

  const getMeals = (date: string) => suggestions.filter((s) => s.meal_date === date);
  const getPreps = (date: string) => prepTasks.filter((t) => t.scheduled_day === date);

  const formatDay = (date: string) =>
    new Date(date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="min-h-screen p-4 max-w-lg mx-auto space-y-6">
      <header>
        <h1 className="font-titre text-lg text-noir">Briefing</h1>
        <p className="text-sm text-muted">Le planning du span pour l&apos;equipe.</p>
      </header>

      {!briefCode ? (
        <button onClick={generateCode} disabled={generating || !span} className="btn-rouge w-full">
          {generating ? 'on genere le code...' : 'partager avec l\'equipe →'}
        </button>
      ) : (
        <div className="card text-center">
          <p className="text-xs text-muted uppercase tracking-wide">Code equipe</p>
          <p className="text-3xl font-data text-noir tracking-widest mt-1">{briefCode}</p>
          <p className="text-sm text-muted mt-3">Lien a partager :</p>
          <p className="text-sm font-data text-noir mt-1 break-all">
            {typeof window !== 'undefined' ? window.location.origin : ''}/brief/{briefCode}
          </p>
          <p className="text-xs text-muted mt-2">Valide 24h</p>
        </div>
      )}

      {/* Planning du span */}
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
              {lunch && (
                <div className="card py-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-data text-xs text-muted">dejeuner</span>
                  </div>
                  {lunch.ingredients.map((ing, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-noir">{shortName(ing.name)}</span>
                      <span className="font-data text-muted">{ing.quantity} {ing.unit}</span>
                    </div>
                  ))}
                  {lunch.notes && <p className="text-xs text-noir/60 italic mt-2">{lunch.notes}</p>}
                </div>
              )}

              {dinner && (
                <div className="card py-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-data text-xs text-muted">diner</span>
                  </div>
                  {dinner.ingredients.map((ing, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-noir">{shortName(ing.name)}</span>
                      <span className="font-data text-muted">{ing.quantity} {ing.unit}</span>
                    </div>
                  ))}
                  {dinner.notes && <p className="text-xs text-noir/60 italic mt-2">{dinner.notes}</p>}
                </div>
              )}

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
