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

  useEffect(() => {
    loadData();
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

  async function loadData() {
    const token = await getToken();
    if (!token) return;

    const res = await fetch('/api/suggestions', {
      headers: { Authorization: `Bearer ${token}` },
    });

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
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ span_id: span.id }),
    });

    if (res.ok) {
      const data = await res.json();
      setBriefCode(data.code);
    }
    setGenerating(false);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Chargement...</p>
      </div>
    );
  }

  const today = new Date().toISOString().split('T')[0];
  const todayMeals = suggestions.filter((s) => s.meal_date === today);
  const upcoming = suggestions.filter((s) => s.meal_date > today);

  return (
    <div className="min-h-screen p-4 max-w-lg mx-auto space-y-6">
      <header>
        <h1 className="text-lg font-bold">Briefing equipe</h1>
        <p className="text-sm text-gray-500">
          Generez un code a partager avec l&apos;equipe
        </p>
      </header>

      {/* Generate code */}
      {!briefCode ? (
        <button
          onClick={generateCode}
          disabled={generating || !span}
          className="btn-primary w-full py-3"
        >
          {generating ? 'Generation...' : 'Generer un code briefing'}
        </button>
      ) : (
        <div className="card bg-brand-50 border-brand-200 text-center">
          <p className="text-xs text-gray-500">Code briefing equipe</p>
          <p className="text-3xl font-bold text-brand-600 tracking-widest mt-1">{briefCode}</p>
          <p className="text-sm text-gray-500 mt-2">
            Partagez ce lien :
          </p>
          <p className="text-sm text-brand-600 font-medium mt-1 break-all">
            {typeof window !== 'undefined' ? window.location.origin : ''}/brief/{briefCode}
          </p>
          <p className="text-xs text-gray-400 mt-2">Valide 24h</p>
        </div>
      )}

      {/* Today's meals */}
      <section>
        <h2 className="font-semibold text-gray-700 mb-3">Aujourd&apos;hui</h2>
        {todayMeals.length === 0 ? (
          <p className="text-sm text-gray-400">Pas de repas prevu aujourd&apos;hui.</p>
        ) : (
          <div className="space-y-3">
            {todayMeals.map((s) => (
              <div key={s.id} className="card">
                <span className="text-xs font-semibold uppercase text-brand-500">
                  {s.meal_type === 'lunch' ? 'Dejeuner' : 'Diner'}
                </span>
                <div className="mt-2 space-y-1">
                  {s.ingredients.map((ing, i) => (
                    <div key={i} className="flex justify-between items-center">
                      <span className="text-sm font-medium">{ing.name}</span>
                      <span className="text-sm text-gray-400">{ing.quantity} {ing.unit}</span>
                    </div>
                  ))}
                </div>
                {s.notes && (
                  <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <p className="text-sm text-amber-800">{s.notes}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <section>
          <h2 className="font-semibold text-gray-700 mb-3">A venir</h2>
          <div className="space-y-2">
            {upcoming.map((s) => (
              <div key={s.id} className="card py-2.5">
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
