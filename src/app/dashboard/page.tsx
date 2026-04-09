'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import type { Establishment, Suggestion, SupplySpan } from '@/lib/types';

export default function DashboardPage() {
  const [establishment, setEstablishment] = useState<Establishment | null>(null);
  const [currentSpan, setCurrentSpan] = useState<SupplySpan | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    const supabase = createBrowserClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      window.location.href = '/';
      return;
    }

    const token = session.access_token;

    const estRes = await fetch('/api/establishment', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (estRes.status === 404) {
      window.location.href = '/onboarding';
      return;
    }
    const est = await estRes.json();
    setEstablishment(est);

    const sugRes = await fetch('/api/suggestions', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (sugRes.ok) {
      const data = await sugRes.json();
      setCurrentSpan(data.span);
      setSuggestions(data.suggestions);
    }
    setLoading(false);
  }

  async function handleFeedback(suggestionId: string, status: 'done' | 'modified' | 'skipped') {
    const supabase = createBrowserClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    await fetch('/api/feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ suggestion_id: suggestionId, status }),
    });
    loadDashboard();
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Chargement...</p>
      </div>
    );
  }

  const todaySuggestions = suggestions.filter(
    (s) => s.meal_date === new Date().toISOString().split('T')[0]
  );

  const totalEstimated = suggestions.reduce((sum, s) => sum + (s.estimated_cost || 0), 0);
  const budgetTotal = (establishment?.budget_per_meal || 0) * suggestions.length;

  return (
    <div className="min-h-screen p-4 max-w-lg mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-brand-600">Communard</h1>
          <p className="text-sm text-gray-500">{establishment?.name}</p>
        </div>
        <a href="/planning" className="btn-secondary text-sm">Planning</a>
      </header>

      {/* Budget card */}
      <div className="card">
        <h2 className="text-sm font-medium text-gray-500">Budget span</h2>
        <div className="flex items-end gap-2 mt-1">
          <span className="text-2xl font-bold">{totalEstimated.toFixed(0)}</span>
          <span className="text-gray-400">/ {budgetTotal.toFixed(0)} {establishment?.currency}</span>
        </div>
        {currentSpan && (
          <p className="text-xs text-gray-400 mt-1">
            {currentSpan.start_date} → {currentSpan.end_date}
          </p>
        )}
      </div>

      {/* Today's meals */}
      <section>
        <h2 className="font-semibold text-gray-700 mb-3">Aujourd&apos;hui</h2>
        {todaySuggestions.length === 0 ? (
          <p className="text-sm text-gray-400">Pas de suggestions pour aujourd&apos;hui.</p>
        ) : (
          <div className="space-y-3">
            {todaySuggestions.map((s) => (
              <div key={s.id} className="card">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-medium uppercase text-brand-500">
                      {s.meal_type === 'lunch' ? 'Dejeuner' : 'Diner'}
                    </span>
                    <div className="mt-1 space-y-1">
                      {s.ingredients.map((ing, i) => (
                        <p key={i} className="text-sm">
                          <span className="font-medium">{ing.name}</span>
                          <span className="text-gray-400 ml-1">{ing.quantity} {ing.unit}</span>
                        </p>
                      ))}
                    </div>
                    {s.estimated_cost && (
                      <p className="text-xs text-gray-400 mt-2">
                        ~{s.estimated_cost} {establishment?.currency}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => handleFeedback(s.id, 'done')}
                    className="flex-1 text-sm py-1.5 rounded-lg bg-green-100 text-green-700 hover:bg-green-200"
                  >
                    Fait
                  </button>
                  <button
                    onClick={() => handleFeedback(s.id, 'modified')}
                    className="flex-1 text-sm py-1.5 rounded-lg bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                  >
                    Modifie
                  </button>
                  <button
                    onClick={() => handleFeedback(s.id, 'skipped')}
                    className="flex-1 text-sm py-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200"
                  >
                    Pas fait
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
