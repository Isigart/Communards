'use client';

import { useEffect, useState } from 'react';
import type { Establishment, Suggestion, SupplySpan } from '@/lib/types';
import { getToken, fetchEstablishment, fetchSuggestions, fetchSuppliers, invalidateSuggestions } from '@/lib/cache';

type FeedbackStatus = 'done' | 'modified' | 'skipped';

export default function DashboardPage() {
  const [establishment, setEstablishment] = useState<Establishment | null>(null);
  const [currentSpan, setCurrentSpan] = useState<SupplySpan | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [deliveryDays, setDeliveryDays] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  // Commentaires inline par suggestion
  const [commentOpen, setCommentOpen] = useState<Record<string, boolean>>({});
  const [commentText, setCommentText] = useState<Record<string, string>>({});

  useEffect(() => { loadDashboard(); }, []);

  async function loadDashboard() {
    const est = await fetchEstablishment();
    if (est) setEstablishment(est);

    const { span, suggestions: sugs } = await fetchSuggestions();
    setCurrentSpan(span);
    setSuggestions(sugs);

    const suppliers = await fetchSuppliers();
    const primary = suppliers.find((s) => s.is_primary);
    if (primary) setDeliveryDays((primary.delivery_days as number[]) || []);

    setLoading(false);

    // Auto-regenerer si le span est expire ou inexistant
    const today = new Date().toISOString().split('T')[0];
    if ((span && span.end_date < today) || (!span && est)) {
      await generateSuggestions();
    }
  }

  async function generateSuggestions() {
    setGenerating(true);
    setGenError(null);
    const token = await getToken();
    if (!token) { setGenerating(false); return; }

    const res = await fetch('/api/suggestions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const body = await res.text();
      setGenError(`Span: ${res.status} — ${body.slice(0, 200)}`);
      setGenerating(false);
      return;
    }
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
      const result = await genRes.json();
      if (result.count === 0) {
        setGenError('Claude a repondu mais 0 repas generes. Verifie les templates.');
        setGenerating(false);
        return;
      }
      invalidateSuggestions();
      const fresh = await fetchSuggestions(true);
      setCurrentSpan(fresh.span);
      setSuggestions(fresh.suggestions);
    } else {
      const body = await genRes.text();
      let msg = body;
      try { msg = JSON.parse(body).error || body; } catch { /* skip */ }
      setGenError(`Generation: ${genRes.status} — ${msg.slice(0, 400)}`);
    }
    setGenerating(false);
  }

  async function handleFeedback(suggestionId: string, status: FeedbackStatus) {
    const token = await getToken();
    if (!token) return;
    const notes = (commentText[suggestionId] || '').trim() || null;
    await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ suggestion_id: suggestionId, status, notes }),
    });
    invalidateSuggestions();
    // Reset le commentaire local
    setCommentOpen((prev) => ({ ...prev, [suggestionId]: false }));
    setCommentText((prev) => ({ ...prev, [suggestionId]: '' }));
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

  const todayDay = new Date().getDay();
  const isOrderDay = deliveryDays.includes(todayDay);

  return (
    <div className="min-h-screen p-4 max-w-lg mx-auto space-y-6">
      <p className="text-sm text-muted">{establishment?.name}</p>

      {/* Alerte commande */}
      {isOrderDay && (
        <div className="border border-rouge rounded-xl px-4 py-3 flex items-center gap-3">
          <span className="font-data text-[10px] uppercase bg-rouge text-papier px-2 py-1 rounded-full">Commande</span>
          <p className="text-sm text-noir">Aujourd&apos;hui, c&apos;est jour de commande.</p>
        </div>
      )}

      {/* Span info */}
      {currentSpan && (
        <div className="card">
          <p className="text-xs text-muted uppercase tracking-wide">Prochain span</p>
          <p className="text-sm text-noir mt-1 font-data">
            {new Date(currentSpan.start_date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} → {new Date(currentSpan.end_date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
          </p>
          {suggestions.length === 0 && (
            <p className="text-sm text-muted mt-2">Rien de prevu. Qui cuisine ?</p>
          )}
        </div>
      )}

      {/* Generate button */}
      {suggestions.length === 0 && (
        <button onClick={generateSuggestions} disabled={generating} className="btn-rouge w-full">
          {generating ? 'on prepare le planning...' : 'generer les suggestions →'}
        </button>
      )}

      {genError && (
        <div className="border border-rouge rounded-xl px-4 py-3 bg-rouge/5">
          <p className="text-xs font-data uppercase text-rouge mb-1">Erreur generation</p>
          <p className="text-sm text-noir break-words">{genError}</p>
        </div>
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
            {todaySuggestions.map((s) => {
              const isCommentOpen = commentOpen[s.id] || false;
              const noteValue = commentText[s.id] || '';
              return (
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
                    <p className="text-xs font-data text-muted mt-2">
                      ~{(s.estimated_cost / establishment.employee_count).toFixed(2)} EUR/pers
                    </p>
                  )}
                  {s.notes && (
                    <p className="text-xs text-noir/60 mt-2 italic">{s.notes}</p>
                  )}

                  {/* Zone commentaire collapsible */}
                  {isCommentOpen && (
                    <textarea
                      className="input w-full text-sm mt-3"
                      placeholder="Ce qui a clochè (optionnel)..."
                      rows={2}
                      value={noteValue}
                      onChange={(e) => setCommentText((prev) => ({ ...prev, [s.id]: e.target.value }))}
                      autoFocus
                    />
                  )}

                  {/* Boutons feedback */}
                  <div className="flex items-center gap-2 mt-3 justify-between">
                    {!isCommentOpen ? (
                      <button
                        onClick={() => setCommentOpen((prev) => ({ ...prev, [s.id]: true }))}
                        className="text-xs text-muted underline"
                      >
                        + commentaire
                      </button>
                    ) : (
                      <button
                        onClick={() => setCommentOpen((prev) => ({ ...prev, [s.id]: false }))}
                        className="text-xs text-muted underline"
                      >
                        annuler
                      </button>
                    )}
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleFeedback(s.id, 'done')}
                        className="text-xl leading-none opacity-40 hover:opacity-100 transition-opacity"
                        title="Fait"
                      >
                        &#x1F44D;
                      </button>
                      <button
                        onClick={() => handleFeedback(s.id, 'modified')}
                        className="text-xl leading-none opacity-40 hover:opacity-100 transition-opacity"
                        title="Modifié"
                      >
                        &#x270F;
                      </button>
                      <button
                        onClick={() => handleFeedback(s.id, 'skipped')}
                        className="text-xl leading-none opacity-40 hover:opacity-100 transition-opacity"
                        title="Non fait"
                      >
                        &#x1F44E;
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
