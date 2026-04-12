'use client';

import { useEffect, useState, useCallback } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import type { Suggestion, SupplySpan } from '@/lib/types';

interface PrepTask {
  id: string;
  span_id: string;
  suggestion_id: string | null;
  label: string;
  for_meal: string | null;
  scheduled_day: string | null;
  scheduled_slot: string | null;
  done: boolean;
}

export default function PlanningPage() {
  const [span, setSpan] = useState<SupplySpan | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [prepTasks, setPrepTasks] = useState<PrepTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [draftNote, setDraftNote] = useState('');
  const [newTaskLabel, setNewTaskLabel] = useState('');
  const [newTaskDay, setNewTaskDay] = useState('');
  const [newTaskSlot, setNewTaskSlot] = useState('matin');

  useEffect(() => { loadPlanning(); }, []);

  async function getToken() {
    const supabase = createBrowserClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = '/'; return null; }
    return session.access_token;
  }

  async function loadPlanning() {
    const t = await getToken();
    if (!t) return;
    setToken(t);
    const [sugRes, prepRes] = await Promise.all([
      fetch('/api/suggestions', { headers: { Authorization: `Bearer ${t}` } }),
      fetch('/api/prep-tasks', { headers: { Authorization: `Bearer ${t}` } }),
    ]);
    if (sugRes.ok) {
      const data = await sugRes.json();
      setSpan(data.span);
      setSuggestions(data.suggestions || []);
    }
    if (prepRes.ok) setPrepTasks(await prepRes.json());
    setLoading(false);
  }

  async function saveNote(suggestionId: string) {
    if (!token) return;
    await fetch('/api/suggestions/notes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ suggestion_id: suggestionId, notes: draftNote.trim() || null }),
    });
    setSuggestions((prev) =>
      prev.map((s) => s.id === suggestionId ? { ...s, notes: draftNote.trim() || null } : s)
    );
    setEditingNote(null);
    setDraftNote('');
  }

  const addPrepTask = useCallback(async () => {
    if (!newTaskLabel.trim() || !token || !span) return;
    const res = await fetch('/api/prep-tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        span_id: span.id,
        label: newTaskLabel.trim(),
        scheduled_day: newTaskDay || null,
        scheduled_slot: newTaskSlot || null,
      }),
    });
    if (res.ok) setPrepTasks((prev) => [...prev, await res.json()]);
    setNewTaskLabel('');
  }, [newTaskLabel, newTaskDay, newTaskSlot, token, span]);

  async function deleteTask(taskId: string) {
    if (!token) return;
    await fetch(`/api/prep-tasks?id=${taskId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    setPrepTasks((prev) => prev.filter((t) => t.id !== taskId));
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Chargement...</p>
      </div>
    );
  }

  const today = new Date().toISOString().split('T')[0];

  // Grouper les suggestions par date
  const grouped = suggestions.reduce<Record<string, Suggestion[]>>((acc, s) => {
    if (!acc[s.meal_date]) acc[s.meal_date] = [];
    acc[s.meal_date].push(s);
    return acc;
  }, {});

  // Toutes les dates du span
  const allDates: string[] = [];
  if (span) {
    const start = new Date(span.start_date + 'T00:00:00');
    const end = new Date(span.end_date + 'T00:00:00');
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      allDates.push(d.toISOString().split('T')[0]);
    }
  }

  const formatDay = (date: string) =>
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
    <div className="min-h-screen p-4 max-w-lg mx-auto space-y-6 pb-24">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Planning</h1>
        {span && (
          <span className="text-xs text-gray-400">
            {formatShort(span.start_date)} → {formatShort(span.end_date)}
          </span>
        )}
      </header>

      {/* ===== VUE PAR JOUR ===== */}
      {allDates.map((date) => {
        const isPast = date < today;
        const isToday = date === today;
        const meals = grouped[date] || [];
        const dayPrepsMatin = prepTasks.filter((t) => t.scheduled_day === date && t.scheduled_slot === 'matin');
        const dayPrepsAprem = prepTasks.filter((t) => t.scheduled_day === date && t.scheduled_slot === 'aprem');
        const hasPreps = dayPrepsMatin.length > 0 || dayPrepsAprem.length > 0;

        return (
          <div key={date} className={isPast ? 'opacity-40' : ''}>
            {/* En-tete du jour */}
            <h2 className={`font-semibold mb-2 capitalize ${isToday ? 'text-brand-600' : 'text-gray-700'}`}>
              {isToday && 'Aujourd\u2019hui — '}
              {formatDay(date)}
            </h2>

            <div className="space-y-2">
              {/* === REPAS === */}
              {meals.map((s) => (
                <div key={s.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-semibold uppercase text-brand-500">
                      {s.meal_type === 'lunch' ? 'Dejeuner' : 'Diner'}
                    </span>
                    {s.estimated_cost && (
                      <span className="text-xs text-gray-400">~{s.estimated_cost} EUR</span>
                    )}
                  </div>

                  {/* Ingredients */}
                  <div className="flex flex-wrap gap-1 mb-1">
                    {s.ingredients.map((ing, i) => (
                      <span key={i} className="text-sm bg-brand-50 text-brand-700 rounded-full px-2.5 py-0.5">
                        {ing.name} <span className="opacity-50 text-xs">{ing.quantity}{ing.unit}</span>
                      </span>
                    ))}
                  </div>

                  {/* Note du chef */}
                  {s.notes && editingNote !== s.id && (
                    <div
                      className="mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex justify-between items-start cursor-pointer"
                      onClick={() => { setEditingNote(s.id); setDraftNote(s.notes || ''); }}
                    >
                      <p className="text-sm text-amber-800">{s.notes}</p>
                      <span className="text-xs text-amber-400 ml-2 shrink-0">modifier</span>
                    </div>
                  )}

                  {editingNote === s.id ? (
                    <div className="mt-2 space-y-2">
                      <textarea
                        className="input text-sm"
                        rows={2}
                        placeholder="Note du chef..."
                        value={draftNote}
                        onChange={(e) => setDraftNote(e.target.value)}
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button onClick={() => saveNote(s.id)} className="text-sm py-1 px-3 rounded-lg bg-brand-500 text-white">OK</button>
                        <button onClick={() => { setEditingNote(null); setDraftNote(''); }} className="text-sm py-1 px-3 rounded-lg bg-gray-100 text-gray-500">Annuler</button>
                      </div>
                    </div>
                  ) : !s.notes && !isPast && (
                    <button
                      onClick={() => { setEditingNote(s.id); setDraftNote(''); }}
                      className="mt-1 text-xs text-gray-400 hover:text-brand-500"
                    >
                      + note du chef
                    </button>
                  )}
                </div>
              ))}

              {/* === PREPS DU JOUR (couleur violette) === */}
              {hasPreps && (
                <div className="bg-violet-50 rounded-xl border border-violet-200 p-3">
                  <span className="text-xs font-semibold uppercase text-violet-500 mb-2 block">Preps</span>

                  {dayPrepsMatin.length > 0 && (
                    <div className="mb-2">
                      <span className="text-xs text-violet-400">Matin</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {dayPrepsMatin.map((task) => (
                          <span key={task.id} className="text-sm bg-violet-100 text-violet-700 border border-violet-200 rounded-full px-2.5 py-0.5 inline-flex items-center">
                            {task.label}
                            {!isPast && (
                              <button onClick={() => deleteTask(task.id)} className="ml-1.5 text-violet-400 hover:text-red-500 text-xs">x</button>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {dayPrepsAprem.length > 0 && (
                    <div>
                      <span className="text-xs text-violet-400">Apres-midi</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {dayPrepsAprem.map((task) => (
                          <span key={task.id} className="text-sm bg-violet-100 text-violet-700 border border-violet-200 rounded-full px-2.5 py-0.5 inline-flex items-center">
                            {task.label}
                            {!isPast && (
                              <button onClick={() => deleteTask(task.id)} className="ml-1.5 text-violet-400 hover:text-red-500 text-xs">x</button>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Pas de repas ce jour */}
              {meals.length === 0 && !hasPreps && (
                <p className="text-xs text-gray-300 italic">Pas de repas prevu</p>
              )}
            </div>
          </div>
        );
      })}

      {/* ===== AJOUTER UNE PREP ===== */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3">
        <div className="max-w-lg mx-auto flex gap-2">
          <input
            className="input text-sm flex-1"
            placeholder="Nouvelle prep..."
            value={newTaskLabel}
            onChange={(e) => setNewTaskLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addPrepTask()}
          />
          <select
            className="input text-sm w-24"
            value={newTaskDay}
            onChange={(e) => setNewTaskDay(e.target.value)}
          >
            <option value="">Jour</option>
            {allDates.filter((d) => d >= today).map((d) => (
              <option key={d} value={d}>{formatShort(d)}</option>
            ))}
          </select>
          <select
            className="input text-sm w-20"
            value={newTaskSlot}
            onChange={(e) => setNewTaskSlot(e.target.value)}
          >
            <option value="matin">Matin</option>
            <option value="aprem">Aprem</option>
          </select>
          <button
            onClick={addPrepTask}
            className="bg-violet-500 hover:bg-violet-600 text-white text-sm font-semibold px-3 rounded-lg"
            disabled={!newTaskLabel.trim()}
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}
