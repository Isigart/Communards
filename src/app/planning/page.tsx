'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import type { Suggestion, SupplySpan } from '@/lib/types';
import { getToken, fetchSuggestions, fetchSuppliers, fetchPrepTasks, invalidatePrepTasks, invalidateSuggestions } from '@/lib/cache';

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
  const [expandedMeal, setExpandedMeal] = useState<string | null>(null);

  // Ajout de prep
  const [newTaskLabel, setNewTaskLabel] = useState('');
  const [newTaskDay, setNewTaskDay] = useState('');
  const [newTaskSlot, setNewTaskSlot] = useState('matin');

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadPlanning(); }, []);

  useEffect(() => {
    if (!loading && scrollRef.current) {
      const todayEl = scrollRef.current.querySelector('[data-today="true"]');
      if (todayEl) todayEl.scrollIntoView({ inline: 'start', block: 'nearest' });
    }
  }, [loading]);

  async function loadPlanning() {
    const t = await getToken();
    if (!t) return;
    setToken(t);

    const [sugData, suppliers, preps] = await Promise.all([
      fetchSuggestions(),
      fetchSuppliers(),
      fetchPrepTasks(true), // force refresh pour avoir les derniers placements
    ]);

    setSpan(sugData.span);
    setSuggestions(sugData.suggestions);
    setPrepTasks(preps as unknown as PrepTask[]);
    const primary = suppliers.find((s) => s.is_primary);
    if (primary) setDeliveryDays((primary.delivery_days as number[]) || []);
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
    invalidateSuggestions();
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
        scheduled_slot: newTaskDay ? newTaskSlot : null,
      }),
    });
    if (res.ok) {
      const task = await res.json();
      setPrepTasks((prev) => [...prev, task]);
      invalidatePrepTasks();
    }
    setNewTaskLabel('');
  }, [newTaskLabel, newTaskDay, newTaskSlot, token, span]);

  async function deleteTask(taskId: string) {
    if (!token) return;
    await fetch(`/api/prep-tasks?id=${taskId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    setPrepTasks((prev) => prev.filter((t) => t.id !== taskId));
    invalidatePrepTasks();
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><p className="text-muted">On prepare le planning...</p></div>;
  }

  const today = new Date().toISOString().split('T')[0];

  const allDates: string[] = [];
  if (span) {
    const start = new Date(span.start_date + 'T00:00:00');
    start.setDate(start.getDate() - 2);
    const end = new Date(span.end_date + 'T00:00:00');
    end.setDate(end.getDate() + 1);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      allDates.push(d.toISOString().split('T')[0]);
    }
  }

  // Jours du span uniquement (pour le select)
  const spanDates: string[] = [];
  if (span) {
    const start = new Date(span.start_date + 'T00:00:00');
    const end = new Date(span.end_date + 'T00:00:00');
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      spanDates.push(d.toISOString().split('T')[0]);
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

  const formatDay = (date: string) => {
    const d = new Date(date + 'T00:00:00');
    const day = d.toLocaleDateString('fr-FR', { weekday: 'short' });
    return { day: day.charAt(0).toUpperCase() + day.slice(1), num: d.getDate() };
  };

  const formatShort = (date: string) =>
    new Date(date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });

  const COL_WIDTH = 150;

  const shortName = (name: string) => name.split(/\s+(surgelé|qualité|boîte|UE|France|Import|IQF|DD|en rondelles|en branches|très fins|coupés|émincés|précuit)/i)[0].trim();

  const renderMealCell = (meal: Suggestion | undefined, isPast: boolean) => {
    if (!meal) return null;
    const isExpanded = expandedMeal === meal.id;
    const isEditing = editingNote === meal.id;

    if (!isExpanded) {
      return (
        <div
          className="bg-surface rounded border border-bordure px-1.5 py-1 mb-1 cursor-pointer hover:border-noir/30 transition-colors"
          onClick={() => setExpandedMeal(meal.id)}
        >
          <p className="text-[11px] text-noir leading-snug">
            <span className="font-data text-muted">{meal.meal_type === 'lunch' ? 'dej' : 'din'}</span>
            {' '}
            {meal.ingredients.slice(0, 3).map((ing) => shortName(ing.name)).join(', ')}
          </p>
          {meal.notes && <p className="text-[10px] text-noir/50 italic truncate">{meal.notes}</p>}
        </div>
      );
    }

    return (
      <div className="bg-surface rounded-lg border border-noir/20 p-2 mb-1">
        <div className="flex justify-between items-center mb-1">
          <span className="font-data text-[10px] text-muted">{meal.meal_type === 'lunch' ? 'dej' : 'din'}</span>
          <button onClick={() => { setExpandedMeal(null); setEditingNote(null); }} className="text-[10px] text-muted">fermer</button>
        </div>
        {meal.ingredients.map((ing, i) => (
          <div key={i} className="flex justify-between text-[11px] leading-tight">
            <span className="text-noir">{shortName(ing.name)}</span>
            <span className="font-data text-muted ml-1">{ing.quantity}{ing.unit}</span>
          </div>
        ))}
        {meal.estimated_cost && (
          <p className="font-data text-[10px] text-muted mt-1">~{meal.estimated_cost} EUR</p>
        )}
        {meal.notes && !isEditing && (
          <p className="text-[10px] text-noir/60 italic mt-1 cursor-pointer" onClick={() => { setEditingNote(meal.id); setDraftNote(meal.notes || ''); }}>
            {meal.notes}
          </p>
        )}
        {isEditing ? (
          <div className="mt-1">
            <input
              className="w-full border border-noir/30 rounded text-[11px] px-1 py-0.5 bg-surface"
              placeholder="Note du chef..."
              value={draftNote}
              onChange={(e) => setDraftNote(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveNote(meal.id); if (e.key === 'Escape') setEditingNote(null); }}
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          </div>
        ) : !meal.notes && !isPast && (
          <button className="text-[10px] text-muted mt-1" onClick={() => { setEditingNote(meal.id); setDraftNote(''); }}>
            + note
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen pb-32 p-4 max-w-lg mx-auto">
      <header className="flex items-center justify-between mb-3">
        <h1 className="font-titre text-lg text-noir">Planning</h1>
        <span className="text-xs text-muted">← Swipe →</span>
      </header>

      <div className="relative">
        {/* Labels fixes */}
        <div className="absolute left-0 top-0 z-10 bg-papier w-12">
          <div className="h-20 border-b border-bordure"></div>
          <div className="h-44 flex items-center justify-center border-b border-bordure">
            <span className="text-xs font-medium text-muted -rotate-90 whitespace-nowrap">Matin</span>
          </div>
          <div className="h-44 flex items-center justify-center">
            <span className="text-xs font-medium text-muted -rotate-90 whitespace-nowrap">Soir</span>
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
              const isOutsideSpan = span ? (date < span.start_date || date > span.end_date) : false;
              const { day, num } = formatDay(date);
              const lunch = getMeal(date, 'lunch');
              const dinner = getMeal(date, 'dinner');
              const prepsMatin = getPreps(date, 'matin');
              const prepsSoir = getPreps(date, 'soir');

              return (
                <div
                  key={date}
                  data-today={isToday || undefined}
                  className={`flex-shrink-0 border-r border-bordure ${isOutsideSpan ? 'opacity-25' : isPast ? 'opacity-40' : ''}`}
                  style={{ width: COL_WIDTH, scrollSnapAlign: 'start' }}
                >
                  {/* Header jour */}
                  <div className={`h-20 flex flex-col items-center justify-end pb-1.5 border-b ${
                    isToday ? 'bg-noir/5 border-noir/20' : 'border-bordure'
                  }`}>
                    {isDeliveryDay(date) && (
                      <span className="text-[9px] font-data uppercase bg-rouge text-white px-1.5 py-0.5 rounded-full mb-0.5">Commande</span>
                    )}
                    <span className={`text-[10px] uppercase ${isToday ? 'text-noir font-bold' : 'text-muted'}`}>
                      {isToday ? 'Auj.' : day}
                    </span>
                    <span className={`text-lg font-titre ${isToday ? 'text-noir' : 'text-noir/70'}`}>{num}</span>
                  </div>

                  {/* MATIN */}
                  <div className="h-44 p-1 border-b border-bordure overflow-y-auto">
                    {renderMealCell(lunch, isPast)}
                    {prepsMatin.map((task) => (
                      <div key={task.id} className="bg-noir/5 text-noir border border-bordure rounded px-1.5 py-0.5 text-[11px] font-data mb-0.5 flex items-center justify-between">
                        <span className="truncate">{task.label}</span>
                        {!isPast && <button onClick={() => deleteTask(task.id)} className="text-muted hover:text-rouge ml-1 text-[10px] shrink-0">x</button>}
                      </div>
                    ))}
                  </div>

                  {/* SOIR */}
                  <div className="h-44 p-1 overflow-y-auto">
                    {renderMealCell(dinner, isPast)}
                    {prepsSoir.map((task) => (
                      <div key={task.id} className="bg-noir/5 text-noir border border-bordure rounded px-1.5 py-0.5 text-[11px] font-data mb-0.5 flex items-center justify-between">
                        <span className="truncate">{task.label}</span>
                        {!isPast && <button onClick={() => deleteTask(task.id)} className="text-muted hover:text-rouge ml-1 text-[10px] shrink-0">x</button>}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* AJOUTER UNE PREP */}
      <div className="mt-4 space-y-2">
        <h2 className="font-titre text-sm text-noir">Ajouter une prep</h2>
        <div className="flex gap-2">
          <input
            className="input text-sm flex-1"
            placeholder="Ex: puree, marinade..."
            value={newTaskLabel}
            onChange={(e) => setNewTaskLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addPrepTask()}
          />
        </div>
        <div className="flex gap-2">
          <select
            className="input text-sm flex-1"
            value={newTaskDay}
            onChange={(e) => setNewTaskDay(e.target.value)}
          >
            <option value="">Jour</option>
            {spanDates.map((d) => (
              <option key={d} value={d}>{formatShort(d)}</option>
            ))}
          </select>
          <select
            className="input text-sm w-24"
            value={newTaskSlot}
            onChange={(e) => setNewTaskSlot(e.target.value)}
          >
            <option value="matin">Matin</option>
            <option value="soir">Soir</option>
          </select>
          <button
            onClick={addPrepTask}
            className="btn-rouge text-sm px-4"
            disabled={!newTaskLabel.trim()}
          >
            +
          </button>
        </div>
      </div>

      {/* LISTE DE COURSES */}
      {suggestions.length > 0 && (() => {
        const agg: Record<string, { quantity: number; unit: string }> = {};
        suggestions.forEach((s) => {
          s.ingredients.forEach((ing) => {
            const key = shortName(ing.name);
            const qty = parseFloat(ing.quantity) || 0;
            if (agg[key]) {
              agg[key].quantity += qty;
            } else {
              agg[key] = { quantity: qty, unit: ing.unit };
            }
          });
        });
        const sorted = Object.entries(agg).sort(([a], [b]) => a.localeCompare(b));
        return (
          <section className="mt-6">
            <h2 className="font-titre text-base text-noir mb-3">Liste de courses</h2>
            <div className="card">
              <div className="space-y-1">
                {sorted.map(([name, { quantity, unit }]) => (
                  <div key={name} className="flex justify-between items-center py-0.5">
                    <span className="text-sm text-noir">{name}</span>
                    <span className="font-data text-sm text-muted">{quantity.toFixed(1)} {unit}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        );
      })()}
    </div>
  );
}
