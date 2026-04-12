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

  // Notes editing
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [draftNote, setDraftNote] = useState('');

  // Prep tasks
  const [newTaskLabel, setNewTaskLabel] = useState('');
  const [newTaskMeal, setNewTaskMeal] = useState('');
  const [dragging, setDragging] = useState<string | null>(null);

  useEffect(() => {
    loadPlanning();
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
    if (prepRes.ok) {
      setPrepTasks(await prepRes.json());
    }
    setLoading(false);
  }

  // === NOTES ===
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

  // === PREP TASKS ===
  const addPrepTask = useCallback(async () => {
    if (!newTaskLabel.trim() || !token || !span) return;
    const res = await fetch('/api/prep-tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        span_id: span.id,
        label: newTaskLabel.trim(),
        for_meal: newTaskMeal || null,
      }),
    });
    if (res.ok) {
      const task = await res.json();
      setPrepTasks((prev) => [...prev, task]);
    }
    setNewTaskLabel('');
    setNewTaskMeal('');
  }, [newTaskLabel, newTaskMeal, token, span]);

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

  const handleDragStart = useCallback((taskId: string) => {
    setDragging(taskId);
  }, []);

  const handleDrop = useCallback((day: string, slot: string) => {
    if (dragging) {
      moveTask(dragging, day, slot);
      setDragging(null);
    }
  }, [dragging]);

  const handleDropUnassign = useCallback(() => {
    if (dragging) {
      moveTask(dragging, null, null);
      setDragging(null);
    }
  }, [dragging]);

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

  const sortedDates = Object.keys(grouped).sort();
  const unassignedTasks = prepTasks.filter((t) => !t.scheduled_day);

  return (
    <div className="min-h-screen p-4 max-w-lg mx-auto space-y-6 pb-20">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Planning</h1>
        {span && (
          <span className="text-xs text-gray-400">
            {span.start_date} → {span.end_date}
          </span>
        )}
      </header>

      {/* ===== GRILLE REPAS + NOTES ===== */}
      {sortedDates.map((date) => (
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
            {grouped[date].map((s) => (
              <div key={s.id} className="card">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-semibold uppercase text-brand-500">
                    {s.meal_type === 'lunch' ? 'Dejeuner' : 'Diner'}
                  </span>
                  {s.estimated_cost && (
                    <span className="text-xs text-gray-400">~{s.estimated_cost} EUR</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1 mb-1">
                  {s.ingredients.map((ing, i) => (
                    <span key={i} className="text-sm bg-gray-100 rounded px-2 py-0.5">
                      {ing.name}
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
                    <span className="text-xs text-amber-400 ml-2">modifier</span>
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
                      <button
                        onClick={() => saveNote(s.id)}
                        className="text-sm py-1 px-3 rounded-lg bg-brand-500 text-white"
                      >
                        OK
                      </button>
                      <button
                        onClick={() => { setEditingNote(null); setDraftNote(''); }}
                        className="text-sm py-1 px-3 rounded-lg bg-gray-100 text-gray-500"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                ) : !s.notes && (
                  <button
                    onClick={() => { setEditingNote(s.id); setDraftNote(''); }}
                    className="mt-1 text-xs text-gray-400 hover:text-brand-500"
                  >
                    + note du chef
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* ===== ORGANISATION DES PREPS ===== */}
      <section>
        <h2 className="font-semibold text-gray-700 mb-1">Organisation des preps</h2>
        <p className="text-xs text-gray-400 mb-3">Glissez les cartes pour planifier les preparations</p>

        {/* Taches non placees */}
        {unassignedTasks.length > 0 && (
          <div
            className={`mb-4 p-3 rounded-lg border-2 border-dashed transition-colors ${
              dragging ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50'
            }`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDropUnassign()}
          >
            <p className="text-xs font-medium text-gray-500 mb-2">A placer</p>
            <div className="flex flex-wrap gap-2">
              {unassignedTasks.map((task) => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={() => handleDragStart(task.id)}
                  className="bg-brand-100 text-brand-700 border border-brand-200 rounded-lg px-3 py-1.5 text-xs font-medium cursor-grab active:cursor-grabbing shadow-sm"
                >
                  {task.label}
                  {task.for_meal && <span className="ml-1 opacity-50">({task.for_meal})</span>}
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }}
                    className="ml-2 text-brand-400 hover:text-red-500"
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Grille prep: jours x matin/aprem */}
        {sortedDates.length > 0 && (
          <div className="overflow-x-auto -mx-4 px-4">
            <table className="w-full min-w-[400px] border-collapse">
              <thead>
                <tr>
                  <th className="w-16"></th>
                  <th className="text-xs font-semibold text-gray-500 pb-2 text-left">Matin</th>
                  <th className="text-xs font-semibold text-gray-500 pb-2 text-left">Apres-midi</th>
                </tr>
              </thead>
              <tbody>
                {sortedDates.map((date) => (
                  <tr key={date} className="border-t border-gray-100">
                    <td className="py-2 pr-2 align-top">
                      <span className="text-sm font-semibold text-gray-700">
                        {new Date(date + 'T00:00:00').toLocaleDateString('fr-FR', {
                          weekday: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </td>
                    {['matin', 'aprem'].map((slot) => {
                      const tasksInSlot = prepTasks.filter(
                        (t) => t.scheduled_day === date && t.scheduled_slot === slot
                      );
                      return (
                        <td
                          key={slot}
                          className="py-2 px-1 align-top"
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => handleDrop(date, slot)}
                        >
                          <div
                            className={`min-h-[40px] rounded-lg border-2 border-dashed p-1.5 transition-colors ${
                              dragging ? 'border-brand-300 bg-brand-50' : 'border-transparent'
                            }`}
                          >
                            {tasksInSlot.length > 0 ? (
                              <div className="space-y-1">
                                {tasksInSlot.map((task) => (
                                  <div
                                    key={task.id}
                                    draggable
                                    onDragStart={() => handleDragStart(task.id)}
                                    className="bg-brand-100 text-brand-700 border border-brand-200 rounded-lg px-2 py-1 text-xs font-medium cursor-grab"
                                  >
                                    {task.label}
                                    {task.for_meal && <span className="ml-1 opacity-50">→ {task.for_meal}</span>}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-gray-300 text-center py-1">—</p>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Ajouter une tache */}
        <div className="mt-3 flex gap-2">
          <input
            className="input text-sm flex-1"
            placeholder="Nouvelle prep..."
            value={newTaskLabel}
            onChange={(e) => setNewTaskLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addPrepTask()}
          />
          <input
            className="input text-sm w-24"
            placeholder="Pour..."
            value={newTaskMeal}
            onChange={(e) => setNewTaskMeal(e.target.value)}
          />
          <button
            onClick={addPrepTask}
            className="btn-primary text-sm px-3"
            disabled={!newTaskLabel.trim()}
          >
            +
          </button>
        </div>
      </section>
    </div>
  );
}
