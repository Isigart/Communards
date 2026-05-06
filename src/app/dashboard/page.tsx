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
        setGenError('Claude a répondu mais 0 repas générés. Vérifie les templates.');
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
        <p className="text-muted">On prépare le service...</p>
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

      {/* Alerte commande — proéminente le jour J */}
      {isOrderDay && (
        <div className="bg-rouge text-papier rounded-xl px-4 py-4 space-y-2">
          <div className="flex items-center gap-3">
            <span className="font-data text-[10px] uppercase bg-papier text-rouge px-2 py-1 rounded-full">Commande J</span>
            <p className="font-titre text-base">C&apos;est aujourd&apos;hui qu&apos;on commande.</p>
          </div>
          <p className="text-sm text-papier/80">Liste de courses prête dans le Planning, faut juste passer la commande à ton fournisseur.</p>
          <a href="/planning" className="inline-block text-xs font-data uppercase underline tracking-wide">Voir la liste →</a>
        </div>
      )}

      {/* Span info */}
      {currentSpan && suggestions.length > 0 && (
        <div className="card">
          <p className="text-xs text-muted uppercase tracking-wide">Planning en cours</p>
          <p className="text-sm text-noir mt-1 font-data">
            {new Date(currentSpan.start_date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} → {new Date(currentSpan.end_date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
          </p>
        </div>
      )}

      {/* Empty state — accueillant avec CTA évident */}
      {suggestions.length === 0 && (
        <div className="card text-center space-y-4 py-8">
          <p className="font-titre text-lg text-noir">Prêt à servir ?</p>
          <p className="text-sm text-muted">
            Pas encore de planning. Génère ton premier menu en quelques secondes,
            on s&apos;occupe du reste.
          </p>
          <button onClick={generateSuggestions} disabled={generating} className="btn-rouge w-full">
            {generating ? 'On prépare le planning...' : 'Générer mon planning →'}
          </button>
          {currentSpan && (
            <p className="text-xs text-muted font-data">
              Span : {new Date(currentSpan.start_date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} → {new Date(currentSpan.end_date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
            </p>
          )}
        </div>
      )}

      {genError && (
        <div className="border border-rouge rounded-xl px-4 py-3 bg-rouge/5">
          <p className="text-xs font-data uppercase text-rouge mb-1">Erreur génération</p>
          <p className="text-sm text-noir break-words">{genError}</p>
        </div>
      )}

      {/* Today's meals */}
      <section>
        <h2 className="font-titre text-lg text-noir mb-3">Aujourd&apos;hui</h2>
        {todaySuggestions.length === 0 ? (
          <div className="space-y-3">
            {suggestions.length > 0 && (
              <>
                <p className="text-sm text-muted">Pas de repas prévu aujourd&apos;hui.</p>
                <button onClick={generateSuggestions} disabled={generating} className="btn-rouge w-full">
                  {generating ? 'On ajoute ça...' : '+ Ajouter le repas du jour →'}
                </button>
              </>
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
                    {s.meal_type === 'lunch' ? 'Déjeuner' : 'Dîner'}
                  </span>
                  <div className="mt-2 space-y-1">
                    {s.ingredients.map((ing, i) => (
                      <p key={i} className={`text-sm ${ing.category === 'proteine' ? 'text-noir font-medium' : 'text-noir/80'}`}>
                        {ing.name} <span className="text-muted font-data text-xs">{ing.quantity} {ing.unit}</span>
                      </p>
                    ))}
                  </div>
                  {s.estimated_cost && establishment?.employee_count && (
                    <p className="text-xs font-data text-muted mt-2">
                      ~{(s.estimated_cost / establishment.employee_count).toFixed(2)} €/pers
                    </p>
                  )}
                  {s.notes && (
                    <p className="text-xs text-noir/60 mt-2 italic">{s.notes}</p>
                  )}

                  {/* Zone commentaire collapsible */}
                  {isCommentOpen && (
                    <textarea
                      className="input w-full text-sm mt-3"
                      placeholder="Ce qui a cloché (optionnel)..."
                      rows={2}
                      value={noteValue}
                      onChange={(e) => setCommentText((prev) => ({ ...prev, [s.id]: e.target.value }))}
                      autoFocus
                    />
                  )}

                  {/* Boutons feedback — texte court + couleur du status */}
                  <div className="mt-3 space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => handleFeedback(s.id, 'done')}
                        className="py-2 rounded-lg border border-vert/30 bg-vert/5 text-vert text-xs font-medium hover:bg-vert/10 transition-colors"
                        style={{ borderColor: '#3B6D11', backgroundColor: '#EAF3DE', color: '#3B6D11' }}
                      >
                        Fait
                      </button>
                      <button
                        onClick={() => handleFeedback(s.id, 'modified')}
                        className="py-2 rounded-lg text-xs font-medium transition-colors"
                        style={{ borderWidth: 1, borderColor: '#854F0B', backgroundColor: '#FAEEDA', color: '#854F0B' }}
                      >
                        Adapté
                      </button>
                      <button
                        onClick={() => handleFeedback(s.id, 'skipped')}
                        className="py-2 rounded-lg text-xs font-medium transition-colors"
                        style={{ borderWidth: 1, borderColor: '#993C1D', backgroundColor: '#FAECE7', color: '#993C1D' }}
                      >
                        Zappé
                      </button>
                    </div>
                    {!isCommentOpen ? (
                      <button
                        onClick={() => setCommentOpen((prev) => ({ ...prev, [s.id]: true }))}
                        className="text-xs text-muted underline"
                      >
                        + commenter
                      </button>
                    ) : (
                      <button
                        onClick={() => setCommentOpen((prev) => ({ ...prev, [s.id]: false }))}
                        className="text-xs text-muted underline"
                      >
                        annuler le commentaire
                      </button>
                    )}
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
