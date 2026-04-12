'use client';

import { useEffect, useState, useCallback } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import type { Suggestion, SupplySpan } from '@/lib/types';

interface PrepTask {
  id: string;
  span_id: string;
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
  const [dragging, setDragging] = useState<string | null>(null);

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
      body: JSON.stringify({ span_id: span.id, label: newTaskLabel.trim() }),
    });
    if (res.ok) setPrepTasks((prev) => [...prev, await res.json()]);
    setNewTaskLabel('');
  }, [newTaskLabel, token, span]);

  async function moveTask(taskId: string, day: string | null, slot: string | null) {
    if (!token) return;
    await fetch('/api/prep-tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id: taskId, scheduled_day: day, scheduled_slot: slot }),
    });
    setPrepTasks((prev) =>
      prev.map((t) => t.id === taskId ? { ...t, scheduled_day: day, scheduled_slot: slot } : t)
    );
  }

  async function deleteTask(taskId: string) {
    if (!token) return;
    await fetch(`/api/prep-tasks?id=${taskId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    setPrepTasks((prev) => prev.filter((t) => t.id !== taskId));
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><p className="text-gray-500">Chargement...</p></div>;
  }

  const today = new Date().toISOString().split('T')[0];

  // Toutes les dates du span
  const allDates: string[] = [];
  if (span) {
    const start = new Date(span.start_date + 'T00:00:00');
    const end = new Date(span.end_date + 'T00:00:00');
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      allDates.push(d.toISOString().split('T')[0]);
    }
  }

  // Lookup rapide
  const getMeal = (date: string, type: string) =>
    suggestions.find((s) => s.meal_date === date && s.meal_type === type);

  const getPreps = (date: string) =>
    prepTasks.filter((t) => t.scheduled_day === date);

  const unassigned = prepTasks.filter((t) => !t.scheduled_day);

  const formatShort = (date: string) =>
    new Date(date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });

  // Lignes du tableau : Dejeuner, Diner, Preps
  const rows = ['lunch', 'dinner', 'prep'] as const;
  const rowLabels = { lunch: 'Dej', dinner: 'Din', prep: 'Preps' };

  return (
    <div className="min-h-screen p-4 max-w-4xl mx-auto pb-24">
      <header className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold">Planning</h1>
        {span && (
          <span className="text-xs text-gray-400">
            {formatShort(span.start_date)} → {formatShort(span.end_date)}
          </span>
        )}
      </header>

      {/* ===== TABLEAU PLANNING ===== */}
      <div className="overflow-x-auto -mx-4 px-4">
        <table className="w-full border-collapse min-w-[600px]">
          <thead>
            <tr>
              <th className="w-14 text-left text-xs text-gray-400 pb-2"></th>
              {allDates.map((date) => {
                const isToday = date === today;
                const isPast = date < today;
                return (
                  <th
                    key={date}
                    className={`text-center text-xs font-semibold pb-2 capitalize ${
                      isToday ? 'text-brand-600' : isPast ? 'text-gray-300' : 'text-gray-600'
                    }`}
                  >
                    {isToday && <span className="block text-brand-500 text-[10px]">Auj.</span>}
                    {formatShort(date)}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row} className="border-t border-gray-100">
                <td className={`py-2 pr-2 align-top text-xs font-semibold ${
                  row === 'prep' ? 'text-violet-500' : 'text-brand-500'
                }`}>
                  {rowLabels[row]}
                </td>
                {allDates.map((date) => {
                  const isPast = date < today;

                  if (row === 'prep') {
                    // Cellule prep — drop zone
                    const preps = getPreps(date);
                    return (
                      <td
                        key={date}
                        className={`py-2 px-1 align-top ${isPast ? 'opacity-40' : ''}`}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => {
                          if (dragging) {
                            moveTask(dragging, date, 'matin');
                            setDragging(null);
                          }
                        }}
                      >
                        <div className={`min-h-[36px] rounded-lg p-1 transition-colors ${
                          dragging ? 'border-2 border-dashed border-violet-300 bg-violet-50' : ''
                        }`}>
                          {preps.map((task) => (
                            <div
                              key={task.id}
                              draggable
                              onDragStart={() => setDragging(task.id)}
                              className="bg-violet-100 text-violet-700 border border-violet-200 rounded px-1.5 py-0.5 text-[11px] font-medium mb-0.5 cursor-grab active:cursor-grabbing flex items-center justify-between"
                            >
                              <span className="truncate">{task.label}</span>
                              {!isPast && (
                                <button onClick={() => deleteTask(task.id)} className="text-violet-400 hover:text-red-500 ml-1 text-[10px]">x</button>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>
                    );
                  }

                  // Cellule repas (dejeuner ou diner)
                  const meal = getMeal(date, row);
                  return (
                    <td key={date} className={`py-2 px-1 align-top ${isPast ? 'opacity-40' : ''}`}>
                      {meal ? (
                        <div
                          className="bg-white rounded-lg border border-gray-100 p-1.5 hover:border-brand-200 cursor-pointer transition-colors"
                          onClick={() => {
                            if (!isPast && editingNote !== meal.id) {
                              setEditingNote(meal.id);
                              setDraftNote(meal.notes || '');
                            }
                          }}
                        >
                          {/* Ingredients */}
                          {meal.ingredients.map((ing, i) => (
                            <p key={i} className="text-[11px] text-gray-700 leading-tight">
                              {ing.name}
                            </p>
                          ))}

                          {/* Note du chef */}
                          {meal.notes && editingNote !== meal.id && (
                            <p className="text-[10px] text-amber-700 bg-amber-50 rounded px-1 py-0.5 mt-1">{meal.notes}</p>
                          )}

                          {/* Edition note */}
                          {editingNote === meal.id && (
                            <div className="mt-1" onClick={(e) => e.stopPropagation()}>
                              <textarea
                                className="w-full border border-gray-300 rounded text-[11px] px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-brand-400"
                                rows={2}
                                placeholder="Note..."
                                value={draftNote}
                                onChange={(e) => setDraftNote(e.target.value)}
                                autoFocus
                              />
                              <div className="flex gap-1 mt-0.5">
                                <button onClick={() => saveNote(meal.id)} className="text-[10px] py-0.5 px-2 rounded bg-brand-500 text-white">OK</button>
                                <button onClick={() => { setEditingNote(null); setDraftNote(''); }} className="text-[10px] py-0.5 px-2 rounded bg-gray-100 text-gray-500">x</button>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-[10px] text-gray-200 text-center">—</p>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ===== ZONE NON PLACEES + AJOUT ===== */}
      <div className="mt-6 space-y-3">
        {/* Preps non placees */}
        {unassigned.length > 0 && (
          <div
            className={`p-3 rounded-lg border-2 border-dashed transition-colors ${
              dragging ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50'
            }`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragging) {
                moveTask(dragging, null, null);
                setDragging(null);
              }
            }}
          >
            <p className="text-xs font-medium text-gray-500 mb-2">Preps a placer</p>
            <div className="flex flex-wrap gap-2">
              {unassigned.map((task) => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={() => setDragging(task.id)}
                  className="bg-violet-100 text-violet-700 border border-violet-200 rounded-lg px-3 py-1.5 text-xs font-medium cursor-grab active:cursor-grabbing shadow-sm inline-flex items-center"
                >
                  {task.label}
                  <button onClick={() => deleteTask(task.id)} className="ml-2 text-violet-400 hover:text-red-500 text-xs">x</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ajouter une prep */}
        <div className="flex gap-2">
          <input
            className="input text-sm flex-1"
            placeholder="Nouvelle prep (ex: puree, marinade...)"
            value={newTaskLabel}
            onChange={(e) => setNewTaskLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addPrepTask()}
          />
          <button
            onClick={addPrepTask}
            className="bg-violet-500 hover:bg-violet-600 text-white text-sm font-semibold px-4 rounded-lg"
            disabled={!newTaskLabel.trim()}
          >
            + Prep
          </button>
        </div>
      </div>
    </div>
  );
}
