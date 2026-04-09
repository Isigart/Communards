'use client';

import { useState } from 'react';
import {
  establishment,
  supplier,
  currentSpan,
  suggestions,
  groceryList,
  feedbackHistory,
} from './data';

type Tab = 'dashboard' | 'planning' | 'brief';

const CATEGORY_COLORS: Record<string, string> = {
  proteine: 'bg-red-100 text-red-700',
  feculent: 'bg-amber-100 text-amber-700',
  legume: 'bg-green-100 text-green-700',
  fromage: 'bg-yellow-100 text-yellow-700',
  sauce: 'bg-orange-100 text-orange-700',
  aromate: 'bg-purple-100 text-purple-700',
};

export default function DemoPage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [feedbackGiven, setFeedbackGiven] = useState<Record<string, string>>({});

  const totalEstimated = suggestions.reduce((sum, s) => sum + s.estimated_cost, 0);
  const budgetTotal = establishment.budget_per_meal * suggestions.length;

  const todaySuggestions = suggestions.filter((s) => s.meal_date === '2026-04-07');
  const grouped = suggestions.reduce<Record<string, typeof suggestions>>((acc, s) => {
    if (!acc[s.meal_date]) acc[s.meal_date] = [];
    acc[s.meal_date].push(s);
    return acc;
  }, {});

  const formatDate = (date: string) =>
    new Date(date + 'T00:00:00').toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });

  const formatShort = (date: string) =>
    new Date(date + 'T00:00:00').toLocaleDateString('fr-FR', {
      weekday: 'short',
      day: 'numeric',
    });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Banner demo */}
      <div className="bg-brand-600 text-white text-center py-2 text-sm font-medium">
        Demo Communard — Donnees fictives
      </div>

      {/* Navigation tabs */}
      <nav className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex">
          {([
            ['dashboard', 'Dashboard'],
            ['planning', 'Planning'],
            ['brief', 'Briefing'],
          ] as [Tab, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === key
                  ? 'border-brand-500 text-brand-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </nav>

      <div className="max-w-lg mx-auto p-4 space-y-6 pb-20">
        {/* ==================== DASHBOARD ==================== */}
        {tab === 'dashboard' && (
          <>
            <header>
              <h1 className="text-xl font-bold text-brand-600">Communard</h1>
              <p className="text-sm text-gray-500">{establishment.name} — {establishment.employee_count} employes</p>
            </header>

            {/* Budget */}
            <div className="card">
              <h2 className="text-sm font-medium text-gray-500">Budget du span</h2>
              <div className="flex items-end gap-2 mt-1">
                <span className="text-3xl font-bold">{totalEstimated.toFixed(0)}</span>
                <span className="text-gray-400 text-lg">/ {budgetTotal.toFixed(0)} {establishment.currency}</span>
              </div>
              <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full"
                  style={{ width: `${Math.min((totalEstimated / budgetTotal) * 100, 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-2">
                {currentSpan.label} — {supplier.name}
              </p>
            </div>

            {/* Alerte livraison */}
            <div className="card bg-blue-50 border-blue-200">
              <p className="text-sm font-medium text-blue-800">Prochaine livraison : Jeudi 9 avril</p>
              <p className="text-xs text-blue-600 mt-1">Liste de courses prete pour le prochain span</p>
            </div>

            {/* Repas du jour */}
            <section>
              <h2 className="font-semibold text-gray-700 mb-3">Mardi 7 avril — Aujourd&apos;hui</h2>
              <div className="space-y-3">
                {todaySuggestions.map((s) => (
                  <div key={s.id} className="card">
                    <div className="flex justify-between items-start">
                      <span className="text-xs font-semibold uppercase tracking-wide text-brand-500">
                        {s.meal_type === 'lunch' ? 'Dejeuner' : 'Diner'}
                      </span>
                      <span className="text-sm font-medium text-gray-400">
                        ~{s.estimated_cost} {establishment.currency}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {s.ingredients.map((ing, i) => (
                        <span
                          key={i}
                          className={`inline-flex items-center text-sm rounded-full px-3 py-1 ${
                            CATEGORY_COLORS[ing.category] || 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {ing.name}
                          <span className="ml-1 opacity-60 text-xs">{ing.quantity} {ing.unit}</span>
                        </span>
                      ))}
                    </div>
                    {feedbackGiven[s.id] ? (
                      <div className="mt-3 text-sm text-green-600 font-medium">
                        Feedback enregistre
                      </div>
                    ) : (
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => setFeedbackGiven((p) => ({ ...p, [s.id]: 'done' }))}
                          className="flex-1 text-sm py-2 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 font-medium"
                        >
                          Fait
                        </button>
                        <button
                          onClick={() => setFeedbackGiven((p) => ({ ...p, [s.id]: 'modified' }))}
                          className="flex-1 text-sm py-2 rounded-lg bg-yellow-100 text-yellow-700 hover:bg-yellow-200 font-medium"
                        >
                          Modifie
                        </button>
                        <button
                          onClick={() => setFeedbackGiven((p) => ({ ...p, [s.id]: 'skipped' }))}
                          className="flex-1 text-sm py-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 font-medium"
                        >
                          Pas fait
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Historique feedback */}
            <section>
              <h2 className="font-semibold text-gray-700 mb-3">Historique recent</h2>
              <div className="card divide-y divide-gray-100">
                {feedbackHistory.map((f, i) => (
                  <div key={i} className="flex justify-between items-center py-2">
                    <span className="text-sm text-gray-600">{f.date} — {f.meal}</span>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        f.status === 'done'
                          ? 'bg-green-100 text-green-700'
                          : f.status === 'modified'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {f.label}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {/* ==================== PLANNING ==================== */}
        {tab === 'planning' && (
          <>
            <header>
              <h1 className="text-xl font-bold">Planning</h1>
              <p className="text-sm text-gray-500">
                {currentSpan.label} — {supplier.name}
              </p>
            </header>

            {Object.entries(grouped)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([date, meals]) => (
                <div key={date}>
                  <h2 className="font-semibold text-gray-700 mb-2 capitalize">
                    {formatDate(date)}
                  </h2>
                  <div className="space-y-2">
                    {meals.map((s) => (
                      <div key={s.id} className="card">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs font-semibold uppercase tracking-wide text-brand-500">
                            {s.meal_type === 'lunch' ? 'Dejeuner' : 'Diner'}
                          </span>
                          <span className="text-xs text-gray-400">
                            ~{s.estimated_cost} {establishment.currency}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {s.ingredients.map((ing, i) => (
                            <span
                              key={i}
                              className={`text-sm rounded-full px-2.5 py-0.5 ${
                                CATEGORY_COLORS[ing.category] || 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {ing.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

            {/* Liste de courses */}
            <section>
              <h2 className="font-semibold text-gray-700 mb-3">Liste de courses — {supplier.name}</h2>
              <div className="card">
                <div className="divide-y divide-gray-100">
                  {groceryList.map((item, i) => (
                    <div key={i} className="flex justify-between items-center py-1.5">
                      <span className="text-sm font-medium">{item.name}</span>
                      <span className="text-sm text-gray-400">{item.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </>
        )}

        {/* ==================== BRIEFING ==================== */}
        {tab === 'brief' && (
          <>
            <header className="text-center">
              <h1 className="text-xl font-bold text-brand-600">Briefing equipe</h1>
              <p className="text-sm text-gray-500">{establishment.name}</p>
              <div className="mt-3 inline-block bg-brand-50 border border-brand-200 rounded-lg px-4 py-2">
                <p className="text-xs text-gray-500">Code briefing</p>
                <p className="text-2xl font-bold text-brand-600 tracking-widest">KX7M4P</p>
                <p className="text-xs text-gray-400 mt-1">Valide 24h — partagez avec l&apos;equipe</p>
              </div>
            </header>

            <section>
              <h2 className="font-semibold text-gray-700 mb-3">Aujourd&apos;hui — Mardi 7</h2>
              <div className="space-y-3">
                {todaySuggestions.map((s) => (
                  <div key={s.id} className="card">
                    <span className="text-xs font-semibold uppercase tracking-wide text-brand-500">
                      {s.meal_type === 'lunch' ? 'Dejeuner' : 'Diner'}
                    </span>
                    <div className="mt-2 space-y-1.5">
                      {s.ingredients.map((ing, i) => (
                        <div key={i} className="flex justify-between items-center">
                          <span className="text-sm font-medium">{ing.name}</span>
                          <span className="text-sm text-gray-400">{ing.quantity} {ing.unit}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 className="font-semibold text-gray-700 mb-3">A venir</h2>
              <div className="space-y-2">
                {suggestions
                  .filter((s) => s.meal_date > '2026-04-07')
                  .map((s) => (
                    <div key={s.id} className="card py-2.5">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium capitalize">
                          {formatShort(s.meal_date)} — {s.meal_type === 'lunch' ? 'Dej' : 'Din'}
                        </span>
                        <span className="text-xs text-gray-400">
                          {s.ingredients.map((ing) => ing.name).join(', ')}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
