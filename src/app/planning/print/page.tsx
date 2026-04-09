'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import type { Suggestion, SupplySpan, Establishment } from '@/lib/types';

export default function PrintPlanningPage() {
  const [establishment, setEstablishment] = useState<Establishment | null>(null);
  const [span, setSpan] = useState<SupplySpan | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const supabase = createBrowserClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
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
    setTimeout(() => window.print(), 500);
  }

  if (loading) {
    return <p className="p-8 text-gray-500">Preparation impression...</p>;
  }

  const grouped = suggestions.reduce<Record<string, Suggestion[]>>((acc, s) => {
    if (!acc[s.meal_date]) acc[s.meal_date] = [];
    acc[s.meal_date].push(s);
    return acc;
  }, {});

  const groceryMap = new Map<string, { quantity: string; unit: string; supplier: string }>();
  for (const s of suggestions) {
    for (const item of s.grocery_list) {
      const key = item.name.toLowerCase();
      if (!groceryMap.has(key)) {
        groceryMap.set(key, { quantity: item.quantity, unit: item.unit, supplier: item.supplier });
      }
    }
  }

  return (
    <div className="p-8 max-w-[210mm] mx-auto text-sm print:p-0">
      <header className="mb-6">
        <h1 className="text-xl font-bold">{establishment?.name} — Communard</h1>
        {span && (
          <p className="text-gray-500">
            {span.start_date} → {span.end_date}
          </p>
        )}
      </header>

      <table className="w-full border-collapse mb-8">
        <thead>
          <tr className="border-b-2 border-gray-800">
            <th className="text-left py-1 w-32">Jour</th>
            <th className="text-left py-1">Dejeuner</th>
            <th className="text-left py-1">Diner</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(grouped)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, meals]) => {
              const lunch = meals.find((m) => m.meal_type === 'lunch');
              const dinner = meals.find((m) => m.meal_type === 'dinner');
              return (
                <tr key={date} className="border-b border-gray-200">
                  <td className="py-2 font-medium">
                    {new Date(date + 'T00:00:00').toLocaleDateString('fr-FR', {
                      weekday: 'short',
                      day: 'numeric',
                    })}
                  </td>
                  <td className="py-2">
                    {lunch?.ingredients.map((ing) => ing.name).join(', ') || '-'}
                  </td>
                  <td className="py-2">
                    {dinner?.ingredients.map((ing) => ing.name).join(', ') || '-'}
                  </td>
                </tr>
              );
            })}
        </tbody>
      </table>

      <section>
        <h2 className="font-bold mb-2 border-b-2 border-gray-800 pb-1">Liste de courses</h2>
        <div className="columns-2 gap-8">
          {Array.from(groceryMap.entries()).map(([name, item]) => (
            <p key={name} className="break-inside-avoid">
              <span className="font-medium">{name}</span>{' '}
              <span className="text-gray-500">{item.quantity} {item.unit}</span>
            </p>
          ))}
        </div>
      </section>
    </div>
  );
}
