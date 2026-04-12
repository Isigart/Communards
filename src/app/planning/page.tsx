'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import type { Suggestion, SupplySpan } from '@/lib/types';

interface PrepTask {
  id: string;
  span_id: string;
  label: string;
  scheduled_day: string | null;
  scheduled_slot: string | null;
  done: boolean;
}

export default function PlanningPage() {
  const [span, setSpan] = useState<SupplySpan | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [prepTasks, setPrepTasks] = useState<PrepTask[]>([]);
  const [deliveryDays, setDeliveryDays] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [draftNote, setDraftNote] = useState('');
  const [newTaskLabel, setNewTaskLabel] = useState('');
  const [dragging, setDragging] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadPlanning(); }, []);

  useEffect(() => {
    if (!loading && scrollRef.current) {
      const todayEl = scrollRef.current.querySelector('[data-today="true"]');
      if (todayEl) todayEl.scrollIntoView({ inline: 'start', block: 'nearest' });
    }
  }, [loading]);

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
    const [sugRes, prepRes, supRes] = await Promise.all([
      fetch('/api/suggestions', { headers: { Authorization: `Bearer ${t}` } }),
      fetch('/api/prep-tasks', { headers: { Authorization: `Bearer ${t}` } }),
      fetch('/api/suppliers', { headers: { Authorization: `Bearer ${t}` } }),
    ]);
    if (sugRes.ok) {
      const data = await sugRes.json();
      setSpan(data.span);
      setSuggestions(data.suggestions || []);
    }
    if (prepRes.ok) setPrepTasks(await prepRes.json());
    if (supRes.ok) {
      const suppliers = await supRes.json();
      const primary = suppliers.find((s: { is_primary: boolean }) => s.is_primary);
      if (primary) setDeliveryDays(primary.delivery_days || []);
    }
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
    if (res.ok) {
      const task = await res.json();
      setPrepTasks((prev) => [...prev, task]);
    }
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

  const allDates: string[] = [];
  if (span) {
    const start = new Date(span.start_date + 'T00:00:00');
    const end = new Date(span.end_date + 'T00:00:00');
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      allDates.push(d.toISOString().split('T')[0]);
    }
  }

  const getMeal = (date: string, type: string) =>
    suggestions.find((s) => s.meal_date === date && s.meal_type === type);
  const isDeliveryDay = (date: string) => {
    const d = new Date(date + 'T00:00:00').getDay();
    return deliveryDays.includes(d);
  };
  const getPreps = (date: string, slot: string) =>
    prepTasks.filter((t) => t.scheduled_day === date && t.scheduled_slot === slot);
  const unassigned = prepTasks.filter((t) => !t.scheduled_day);

  const formatDay = (date: string) => {
    const d = new Date(date + 'T00:00:00');
    const day = d.toLocaleDateString('fr-FR', { weekday: 'short' });
    return { day: day.charAt(0).toUpperCase() + day.slice(1), num: d.getDate() };
  };

  // ~3 jours visibles sur mobile (ecran 375px - 48px labels = 327px / 3 ≈ 109px)
  const COL_WIDTH = 109;

  // Rendu d'une cellule repas (compact)
  const MealCell = ({ meal, isPast }: { meal: Suggestion | undefined; isPast: boolean }) => {
    if (!meal) return null;
    return (
      <div
        className="bg-white rounded-lg border border-gray-100 p-1.5 mb-1 cursor-pointer hover:border-brand-200 transition-colors"
        onClick={() => {
          if (!isPast && editingNote !== meal.id) {
            setEditingNote(meal.id);
            setDraftNote(meal.notes || '');
          }
        }}
      >
        <span className="text-[10px] font-semibold uppercase text-brand-400">
          {meal.meal_type === 'lunch' ? 'dej' : 'din'}
        </span>
        {meal.ingredients.slice(0, 3).map((ing, i) => (
          <p key={i} className="text-[11px] text-gray-700 truncate leading-tight">{ing.name}</p>
        ))}
        {meal.ingredients.length > 3 && (
          <p className="text-[10px] text-gray-400">+{meal.ingredients.length - 3}</p>
        )}
        {meal.notes && editingNote !== meal.id && (
          <p className="text-[10px] text-amber-700 bg-amber-50 rounded px-1 mt-1 truncate">{meal.notes}</p>
        )}
        {editingNote === meal.id && (
          <div className="mt-1" onClick={(e) => e.stopPropagation()}>
            <input
              className="w-full border border-brand-300 rounded text-[11px] px-1 py-0.5"
              placeholder="Note du chef..."
              value={draftNote}
              onChange={(e) => setDraftNote(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveNote(meal.id); if (e.key === 'Escape') setEditingNote(null); }}
              autoFocus
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen pb-32 p-4 max-w-lg mx-auto">
      <header className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-bold">Planning</h1>
        <span className="text-xs text-gray-400">← Swipe →</span>
      </header>

      {/* ===== TABLEAU ===== */}
      <div className="relative">
        {/* Labels fixes */}
        <div className="absolute left-0 top-0 z-10 bg-gray-50 w-12">
          <div className="h-14 border-b border-gray-200"></div>
          <div className="h-48 flex items-center justify-center border-b border-gray-200">
            <span className="text-xs font-bold text-gray-500 -rotate-90 whitespace-nowrap">Matin</span>
          </div>
          <div className="h-48 flex items-center justify-center">
            <span className="text-xs font-bold text-gray-500 -rotate-90 whitespace-nowrap">Soir</span>
          </div>
        </div>

        {/* Zone scrollable */}
        <div
          ref={scrollRef}
          className="overflow-x-auto pl-12"
          style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}
        >
          <div className="flex" style={{ width: allDates.length * COL_WIDTH }}>
            {allDates.map((date) => {
              const isPast = date < today;
              const isToday = date === today;
              const { day, num } = formatDay(date);
              const lunch = getMeal(date, 'lunch');
              const dinner = getMeal(date, 'dinner');
              const prepsMatin = getPreps(date, 'matin');
              const prepsSoir = getPreps(date, 'soir');

              return (
                <div
                  key={date}
                  data-today={isToday || undefined}
                  className={`flex-shrink-0 border-r border-gray-100 ${isPast ? 'opacity-40' : ''}`}
                  style={{ width: COL_WIDTH, scrollSnapAlign: 'start' }}
                >
                  {/* Header jour */}
                  <div className={`flex flex-col items-center justify-end pb-1 border-b ${
                    isToday ? 'bg-brand-50 border-brand-200' : 'border-gray-200'
                  }`}>
                    {isDeliveryDay(date) && (
                      <span className="text-[9px] font-bold uppercase bg-blue-500 text-white px-1.5 py-0.5 rounded-full mb-0.5">
                        Commande
                      </span>
                    )}
                    <span className={`text-[10px] uppercase ${isToday ? 'text-brand-600 font-bold' : 'text-gray-400'}`}>
                      {isToday ? 'Auj.' : day}
                    </span>
                    <span className={`text-lg font-bold ${isToday ? 'text-brand-600' : 'text-gray-700'}`}>{num}</span>
                  </div>

                  {/* === MATIN === */}
                  <div
                    className={`h-48 p-1 border-b border-gray-200 overflow-y-auto ${
                      dragging ? 'bg-violet-50/50' : ''
                    }`}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => { if (dragging) { moveTask(dragging, date, 'matin'); setDragging(null); } }}
                  >
                    {/* Repas du midi */}
                    <MealCell meal={lunch} isPast={isPast} />
                    {/* Preps du matin */}
                    {prepsMatin.map((task) => (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={() => setDragging(task.id)}
                        className="bg-violet-100 text-violet-700 rounded px-1.5 py-0.5 text-[11px] font-medium mb-0.5 cursor-grab active:cursor-grabbing flex items-center justify-between"
                      >
                        <span className="truncate">{task.label}</span>
                        {!isPast && <button onClick={() => deleteTask(task.id)} className="text-violet-400 hover:text-red-500 ml-1 text-[10px] shrink-0">x</button>}
                      </div>
                    ))}
                  </div>

                  {/* === SOIR === */}
                  <div
                    className={`h-48 p-1 overflow-y-auto ${
                      dragging ? 'bg-violet-50/50' : ''
                    }`}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => { if (dragging) { moveTask(dragging, date, 'soir'); setDragging(null); } }}
                  >
                    {/* Repas du soir */}
                    <MealCell meal={dinner} isPast={isPast} />
                    {/* Preps du soir */}
                    {prepsSoir.map((task) => (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={() => setDragging(task.id)}
                        className="bg-violet-100 text-violet-700 rounded px-1.5 py-0.5 text-[11px] font-medium mb-0.5 cursor-grab active:cursor-grabbing flex items-center justify-between"
                      >
                        <span className="truncate">{task.label}</span>
                        {!isPast && <button onClick={() => deleteTask(task.id)} className="text-violet-400 hover:text-red-500 ml-1 text-[10px] shrink-0">x</button>}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ===== PREPS NON PLACEES + AJOUT ===== */}
      <div className="space-y-3 mt-4">
        {unassigned.length > 0 && (
          <div
            className={`p-3 rounded-lg border-2 border-dashed transition-colors ${
              dragging ? 'border-red-300 bg-red-50' : 'border-violet-200 bg-violet-50'
            }`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => { if (dragging) { moveTask(dragging, null, null); setDragging(null); } }}
          >
            <p className="text-xs font-medium text-violet-500 mb-2">A placer — glisser vers un creneau</p>
            <div className="flex flex-wrap gap-2">
              {unassigned.map((task) => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={() => setDragging(task.id)}
                  className="bg-violet-100 text-violet-700 border border-violet-200 rounded-lg px-3 py-1.5 text-xs font-medium cursor-grab active:cursor-grabbing shadow-sm inline-flex items-center"
                >
                  {task.label}
                  <button onClick={() => deleteTask(task.id)} className="ml-2 text-violet-400 hover:text-red-500">x</button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <input
            className="input text-sm flex-1"
            placeholder="Nouvelle prep..."
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
