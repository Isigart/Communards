'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import type { Suggestion, SupplySpan } from '@/lib/types';

export default function BriefingPage() {
  const [span, setSpan] = useState<SupplySpan | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [briefCode, setBriefCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function getToken() {
    const supabase = createBrowserClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = '/'; return null; }
    return session.access_token;
  }

  async function loadData() {
    const token = await getToken();
    if (!token) return;
    const res = await fetch('/api/suggestions', { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const data = await res.json();
      setSpan(data.span);
      setSuggestions(data.suggestions || []);
    }
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
  const todayMeals = suggestions.filter((s) => s.meal_date === today);
  const upcoming = suggestions.filter((s) => s.meal_date > today);

  return (
    <div className="min-h-screen p-4 max-w-lg mx-auto space-y-6">
      <header>
        <h1 className="font-titre text-lg text-noir">Briefing</h1>
        <p className="text-sm text-muted">Un code, l&apos;equipe sait quoi faire.</p>
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

      {upcoming.length > 0 && (
        <section>
          <h2 className="font-titre text-base text-noir mb-3">A venir</h2>
          <div className="space-y-2">
            {upcoming.map((s) => (
              <div key={s.id} className="card py-2.5">
                <div className="flex justify-between items-center">
                  <span className="font-titre text-sm text-noir">
                    {new Date(s.meal_date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })}
                    {' — '}{s.meal_type === 'lunch' ? 'Dej' : 'Din'}
                  </span>
                  <span className="text-xs text-muted">
                    {s.ingredients.map((ing) => ing.name).join(', ')}
                  </span>
                </div>
                {s.notes && <p className="text-xs text-noir/60 italic mt-1">{s.notes}</p>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
