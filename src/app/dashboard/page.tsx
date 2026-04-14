'use client';

import { useEffect, useState } from 'react';
import type { Establishment, Suggestion, SupplySpan } from '@/lib/types';
import { BUDGET_HCR } from '@/lib/types';
import { getToken, fetchEstablishment, fetchSuggestions, invalidateSuggestions } from '@/lib/cache';

export default function DashboardPage() {
  const [establishment, setEstablishment] = useState<Establishment | null>(null);
  const [currentSpan, setCurrentSpan] = useState<SupplySpan | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => { loadDashboard(); }, []);

  async function loadDashboard() {
    const est = await fetchEstablishment();
    if (est) setEstablishment(est);

    const { span, suggestions: sugs } = await fetchSuggestions();
    setCurrentSpan(span);
    setSuggestions(sugs);
    setLoading(false);
  }

  async function generateSuggestions() {
    setGenerating(true);
    const token = await getToken();
    if (!token) return;

    const res = await fetch('/api/suggestions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) { setGenerating(false); return; }
    const data = await res.json();
    setCurrentSpan(data.span);

    if (data.status === 'ready') {
      invalidateSuggestions();
      const fresh = await fetchSuggestions(true);
      setSuggestions(fresh.suggestions);
      setGenerating(false);
      return;
    }

    const genRes = await fetch('/api/suggestions/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ span_id: data.span.id }),
    });
    if (genRes.ok) {
      invalidateSuggestions();
      const fresh = await fetchSuggestions(true);
      setCurrentSpan(fresh.span);
      setSuggestions(fresh.suggestions);
    }
    setGenerating(false);
  }

  async function handleFeedback(suggestionId: string, status: 'done' | 'modified' | 'skipped') {
    const token = await getToken();
    if (!token) return;
    await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ suggestion_id: suggestionId, status }),
    });
    invalidateSuggestions();
    const fresh = await fetchSuggestions(true);
    setSuggestions(fresh.suggestions);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted">On prepare le service...</p>
      </div>
    );
  }

  const today = new Date().toISOString().split('T')[0];
  const todaySuggestions = suggestions.filter((s) => s.meal_date === today);
  const totalEstimated = suggestions.reduce((sum, s) => sum + (s.estimated_cost || 0), 0);
  const budgetTotal = (establishment?.budget_per_meal || BUDGET_HCR) * (establishment?.employee_count || 0) * suggestions.length;

  return (
    <div className="min-h-screen p-4 max-w-lg mx-auto space-y-6">
      <p className="text-sm text-muted">{establishment?.name}</p>

      {/* Budget */}
      <div className="card">
        <p className="text-xs text-muted uppercase tracking-wide">Budget du span</p>
        <div className="flex items-end gap-2 mt-1">
          {suggestions.length > 0 ? (
            <>
              <span className="text-2xl font-data text-noir">{totalEstimated.toFixed(0)}</span>
              <span className="text-muted font-data">/ {budgetTotal.toFixed(0)} EUR</span>
            </>
          ) : (
            <span className="text-muted">Rien de prevu. Qui cuisine ?</span>
          )}
        </div>
        {suggestions.length > 0 && budgetTotal > 0 && (
          <div className="mt-2 h-1.5 bg-bordure rounded-full overflow-hidden">
            <div
              className="h-full bg-rouge rounded-full transition-all"
              style={{ width: `${Math.min((totalEstimated / budgetTotal) * 100, 100)}%` }}
            />
          </div>
        )}
        <p className="text-xs text-muted mt-1 font-data">
          {establishment?.employee_count} pers. × {BUDGET_HCR} EUR
        </p>
        {currentSpan && (
          <p className="text-xs text-muted mt-1 font-data">
            {new Date(currentSpan.start_date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} → {new Date(currentSpan.end_date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
          </p>
        )}
      </div>

      {/* Generate button */}
      {suggestions.length === 0 && (
        <button onClick={generateSuggestions} disabled={generating} className="btn-rouge w-full">
          {generating ? 'on prepare le planning...' : 'generer les suggestions →'}
        </button>
      )}

      {/* Today's meals */}
      <section>
        <h2 className="font-titre text-lg text-noir mb-3">Aujourd&apos;hui</h2>
        {todaySuggestions.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted">
              {suggestions.length === 0 ? 'Rien de prevu. Qui cuisine ?' : 'Pas de repas prevu aujourd\'hui.'}
            </p>
            {suggestions.length > 0 && (
              <button onClick={generateSuggestions} disabled={generating} className="btn-rouge w-full">
                {generating ? 'on ajoute ca...' : '+ ajouter le repas du jour →'}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {todaySuggestions.map((s) => (
              <div key={s.id} className="card">
                <span className="font-titre text-sm text-noir">
                  {s.meal_type === 'lunch' ? 'Dejeuner' : 'Diner'}
                </span>
                <div className="mt-2 space-y-1">
                  {s.ingredients.map((ing, i) => (
                    <p key={i} className="text-sm text-noir">
                      {ing.name} <span className="text-muted font-data text-xs">{ing.quantity} {ing.unit}</span>
                    </p>
                  ))}
                </div>
                {s.estimated_cost && establishment?.employee_count && (
                  <p className="text-xs font-data text-muted mt-2">~{(s.estimated_cost / establishment.employee_count).toFixed(2)} EUR/pers</p>
                )}
                {s.notes && (
                  <p className="text-xs text-noir/60 mt-2 italic">{s.notes}</p>
                )}
                <div className="flex gap-2 mt-3">
                  <button onClick={() => handleFeedback(s.id, 'done')} className="flex-1 text-sm py-1.5 rounded-lg border border-bordure text-noir hover:bg-noir/5">Fait</button>
                  <button onClick={() => handleFeedback(s.id, 'modified')} className="flex-1 text-sm py-1.5 rounded-lg border border-bordure text-noir hover:bg-noir/5">Modifie</button>
                  <button onClick={() => handleFeedback(s.id, 'skipped')} className="flex-1 text-sm py-1.5 rounded-lg border border-bordure text-muted hover:bg-noir/5">Pas fait</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
