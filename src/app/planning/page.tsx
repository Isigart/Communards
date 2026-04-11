'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import type { Suggestion, SupplySpan, Establishment } from '@/lib/types';

export default function PlanningPage() {
  const [establishment, setEstablishment] = useState<Establishment | null>(null);
  const [span, setSpan] = useState<SupplySpan | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [briefCode, setBriefCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPlanning();
  }, []);

  async function loadPlanning() {
    const supabase = createBrowserClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      window.location.href = '/';
      return;
    }
    const token = session.access_token;

    const [estRes, sugRes] = await Promise.all([
      fetch('/api/establishment', { headers: { Authorization: `Bearer ${token}` } }),
      fetch('/api/suggestions', { headers: { Authorization: `Bearer ${token}` } }),
    ]);

    if (estRes.ok) setEstablishment(await estRes.json());
    if (sugRes.ok) {
      const data = await sugRes.json();
      setSpan(data.span);
      setSuggestions(data.suggestions);
    }
    setLoading(false);
  }

  async function generateBriefCode() {
    const supabase = createBrowserClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !span) return;

    const res = await fetch('/api/brief', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ span_id: span.id }),
    });

    if (res.ok) {
      const data = await res.json();
      setBriefCode(data.code);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Chargement...</p>
      </div>
    );
  }

  const today = new Date().toISOString().split('T')[0];
  const futureSuggestions = suggestions.filter((s) => s.meal_date >= today);
  const grouped = futureSuggestions.reduce<Record<string, Suggestion[]>>((acc, s) => {
    if (!acc[s.meal_date]) acc[s.meal_date] = [];
    acc[s.meal_date].push(s);
    return acc;
  }, {});

  return (
    <div className="min-h-screen p-4 max-w-lg mx-auto space-y-6">
      <header className="flex items-center justify-between no-print">
        <div>
          <a href="/dashboard" className="text-sm text-brand-500">← Dashboard</a>
          <h1 className="text-xl font-bold mt-1">Planning</h1>
        </div>
        <div className="flex gap-2">
          <a href="/planning/print" className="btn-secondary text-sm">Imprimer</a>
          <button onClick={generateBriefCode} className="btn-primary text-sm">
            Briefing
          </button>
        </div>
      </header>

      {briefCode && (
        <div className="card bg-brand-50 border-brand-200">
          <p className="text-sm font-medium">Code briefing equipe :</p>
          <p className="text-2xl font-bold text-brand-600 mt-1">{briefCode}</p>
          <p className="text-xs text-gray-500 mt-1">
            {typeof window !== 'undefined' ? window.location.origin : ''}/brief/{briefCode}
          </p>
        </div>
      )}

      {span && (
        <div className="card">
          <p className="text-sm text-gray-500">
            Span : {span.start_date} → {span.end_date} ({span.day_count} jours)
          </p>
        </div>
      )}

      {Object.entries(grouped)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, meals]) => (
          <div key={date}>
            <h2 className="font-semibold text-gray-700 mb-2">
              {date === today && <span className="text-brand-500 mr-1">Aujourd&apos;hui —</span>}
              {new Date(date + 'T00:00:00').toLocaleDateString('fr-FR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </h2>
            <div className="space-y-2">
              {meals.map((s) => (
                <div key={s.id} className="card">
                  <span className="text-xs font-medium uppercase text-brand-500">
                    {s.meal_type === 'lunch' ? 'Dejeuner' : 'Diner'}
                  </span>
                  <div className="mt-1">
                    {s.ingredients.map((ing, i) => (
                      <span key={i} className="inline-block text-sm bg-gray-100 rounded px-2 py-0.5 mr-1 mb-1">
                        {ing.name}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
    </div>
  );
}
