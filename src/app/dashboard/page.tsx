'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import type { Establishment, Suggestion, SupplySpan } from '@/lib/types';
import { BUDGET_HCR } from '@/lib/types';

export default function DashboardPage() {
  const [establishment, setEstablishment] = useState<Establishment | null>(null);
  const [currentSpan, setCurrentSpan] = useState<SupplySpan | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function getToken() {
    const supabase = createBrowserClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      window.location.href = '/';
      return null;
    }
    return session.access_token;
  }

  async function loadDashboard() {
    const token = await getToken();
    if (!token) return;

    const estRes = await fetch('/api/establishment', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (estRes.status === 404) {
      window.location.href = '/onboarding';
      return;
    }

    if (estRes.ok) {
      const est = await estRes.json();
      setEstablishment(est);
    }

    const sugRes = await fetch('/api/suggestions', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (sugRes.ok) {
      const data = await sugRes.json();
      setCurrentSpan(data.span);
      setSuggestions(data.suggestions || []);
    }

    setLoading(false);
  }

  async function generateSuggestions() {
    setGenerating(true);
    const token = await getToken();
    if (!token) return;

    // Etape 1: creer le span (rapide)
    const res = await fetch('/api/suggestions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) { setGenerating(false); return; }
    const data = await res.json();
    setCurrentSpan(data.span);

    if (data.status === 'ready') {
      // Suggestions deja generees
      await loadDashboard();
      setGenerating(false);
      return;
    }

    // Etape 2: generer les suggestions (peut prendre 10-15s)
    const genRes = await fetch('/api/suggestions/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ span_id: data.span.id }),
    });

    if (genRes.ok) {
      await loadDashboard();
    }
    setGenerating(false);
  }

  async function handleFeedback(suggestionId: string, status: 'done' | 'modified' | 'skipped') {
    const token = await getToken();
    if (!token) return;

    await fetch('/api/feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
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

  const today = new Date().toISOString().split('T')[0];
  const todaySuggestions = suggestions.filter((s) => s.meal_date === today);
  const totalEstimated = suggestions.reduce((sum, s) => sum + (s.estimated_cost || 0), 0);
  const budgetTotal = (establishment?.budget_per_meal || BUDGET_HCR) * (establishment?.employee_count || 0) * suggestions.length;

  return (
    <div className="min-h-screen p-4 max-w-lg mx-auto space-y-6">
      <p className="text-sm text-gray-500">{establishment?.name}</p>

      {/* Budget */}
      <div className="card">
        <h2 className="text-sm font-medium text-gray-500">Budget</h2>
        <div className="flex items-end gap-2 mt-1">
          {suggestions.length > 0 ? (
            <>
              <span className="text-2xl font-bold">{totalEstimated.toFixed(0)}</span>
              <span className="text-gray-400">/ {budgetTotal.toFixed(0)} EUR</span>
            </>
          ) : (
            <span className="text-gray-400">Aucune suggestion generee</span>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-1">
          {establishment?.employee_count} pers. x {BUDGET_HCR} EUR/repas (budget legal HCR)
        </p>
        {currentSpan && (
          <p className="text-xs text-gray-400 mt-1">
            Span : {currentSpan.start_date} → {currentSpan.end_date}
          </p>
        )}
      </div>

      {/* Generate button */}
      {suggestions.length === 0 && (
        <button
          onClick={generateSuggestions}
          disabled={generating}
          className="btn-primary w-full py-3 text-base"
        >
          {generating ? 'Generation en cours...' : 'Generer les suggestions'}
        </button>
      )}

      {/* Today's meals */}
      <section>
        <h2 className="font-semibold text-gray-700 mb-3">Aujourd&apos;hui</h2>
        {todaySuggestions.length === 0 ? (
          <p className="text-sm text-gray-400">
            {suggestions.length === 0
              ? 'Cliquez sur "Generer les suggestions" pour commencer.'
              : 'Pas de suggestions pour aujourd\'hui.'}
          </p>
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
                        ~{s.estimated_cost} EUR
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
