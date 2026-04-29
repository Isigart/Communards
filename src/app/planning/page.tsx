'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import type { Suggestion, SupplySpan } from '@/lib/types';
import { getToken, fetchEstablishment, fetchSuggestions, fetchSuppliers, fetchPrepTasks, invalidatePrepTasks, invalidateSuggestions } from '@/lib/cache';

interface PrepTask {
  id: string;
  span_id: string;
  label: string;
  scheduled_day: string | null;
  scheduled_slot: string | null;
  done: boolean;
}

// Mapping catégorie ingrédient → pastille colorée P/F/L/D
const CATEGORY_BADGE: Record<string, { bg: string; fg: string; label: string }> = {
  proteine: { bg: '#FAECE7', fg: '#993C1D', label: 'P' },
  feculent: { bg: '#FAEEDA', fg: '#854F0B', label: 'F' },
  legume:   { bg: '#EAF3DE', fg: '#3B6D11', label: 'L' },
  dessert:  { bg: '#FBEAF0', fg: '#993556', label: 'D' },
};

export default function PlanningPage() {
  const [span, setSpan] = useState<SupplySpan | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [prepTasks, setPrepTasks] = useState<PrepTask[]>([]);
  const [deliveryDays, setDeliveryDays] = useState<number[]>([]);
  const [employeeCount, setEmployeeCount] = useState(1);
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

    const [sugData, suppliers, preps, est] = await Promise.all([
      fetchSuggestions(),
      fetchSuppliers(),
      fetchPrepTasks(true),
      fetchEstablishment(),
    ]);

    setSpan(sugData.span);
    setSuggestions(sugData.suggestions);
    setPrepTasks(preps as unknown as PrepTask[]);
    const primary = suppliers.find((s) => s.is_primary);
    if (primary) setDeliveryDays((primary.delivery_days as number[]) || []);
    if (est?.employee_count) setEmployeeCount(est.employee_count);
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

  // shortName v3 : aggressif, sentence case, conserve le mot-clé essentiel.
  // Couvre: "MAQUEREAU de ligne" → "Maquereau", "YAOURT nature basique demi écrémé pot" → "Yaourt",
  // "COMTÉ bande verte (+4 mois)" → "Comté", "POIREAUX COUPES" → "Poireaux",
  // "HARICOTS VERTS EXTRA FINS" → "Haricots verts", "OMELETTE fraîche nature poules au sol" → "Omelette",
  // "Riz long indica étuve" → "Riz", "GALETTE A BASE DE CEREALES ET/OU LEGUMINEUSES" → "Galette céréales",
  // "MOUSSE CHOCOLAT pot" → "Mousse chocolat", "CHOUX BROCOLIS EN FLEURETTES" → "Choux brocolis"
  const shortName = (name: string) => {
    let s = (name || '').toString().trim().toLowerCase();
    if (!s) return '';

    // 1. Supprimer ce qui suit une parenthèse ou crochet
    s = s.split(/[(\[]/)[0].trim();

    // 2. Supprimer "{nom} a base de {ingrédient}..." → garde "{nom} {ingrédient}"
    const baseMatch = s.match(/^(\w[\wéèàâî']*)\s+(?:a|à)\s+base\s+de\s+(\w[\wéèàâî']*)/i);
    if (baseMatch) {
      s = `${baseMatch[1]} ${baseMatch[2]}`;
    }

    // 3. Supprimer suffixes de qualité / format / préparation
    s = s.split(/\s+(?:de\s+ligne|de\s+qualit[ée]|nature\s+basique|nature|basique|fra[îi]che|surgel[ée]e?|surgel[ée]|coup[ée]s?|coup[ée]|coupes|[ée]minc[ée]s?|[ée]minc[ée]|[ée]tuv[ée]e?|[ée]tuv[ée]|etuve|pr[ée]cuit|qualit[ée]|long\s+\w+|au\s+sol|plein\s+air|demi\s+[ée]cr[ée]m[ée]?|en\s+fleurettes|en\s+rondelles|en\s+branches|en\s+cubes|en\s+lamelles|extra\s+\w+|tr[èe]s\s+\w+|pot|bande\s+\w+|\bUE\b|\bFrance\b|\bImport\b|\bIQF\b|\bDD\b|po[êe]l[ée]e?|po[êe]l[ée])\b/i)[0].trim();

    // 4. Supprimer chiffres + unités (ex: 180/220gr, +4 mois)
    s = s.replace(/\s*[+]?\d+[\d/\-]*\s*(?:gr|g|kg|mois|cm|mm|ml|l|cl)\b.*$/gi, '').trim();

    // 5. Couper sur "et/ou", "ou", "+", "/"
    s = s.split(/\s+(?:et\/ou|ou|\+|et)\s+/i)[0].trim();
    s = s.split(/\//)[0].trim();

    // 6. Limiter à 3 mots max
    const words = s.split(/\s+/).filter(Boolean);
    if (words.length > 3) s = words.slice(0, 3).join(' ');

    // 7. Sentence case
    if (!s) return '';
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  const renderMealCell = (meal: Suggestion | undefined, isPast: boolean) => {
    if (!meal) return null;
    const isExpanded = expandedMeal === meal.id;
    const isEditing = editingNote === meal.id;
    const costPerPerson = meal.estimated_cost && employeeCount > 0
      ? (meal.estimated_cost / employeeCount)
      : null;

    if (!isExpanded) {
      return (
        <div
          className="bg-surface rounded border border-bordure px-1.5 py-1 mb-1 cursor-pointer hover:border-noir/30 transition-colors"
          onClick={() => setExpandedMeal(meal.id)}
        >
          <div className="flex justify-between items-center mb-0.5">
            <span className="font-data text-[9px] uppercase text-muted tracking-wide">
              {meal.meal_type === 'lunch' ? 'Déjeuner' : 'Dîner'}
            </span>
            {costPerPerson !== null && (
              <span className="font-data text-[9px] text-muted">
                {costPerPerson.toFixed(2).replace('.', ',')} €/tête
              </span>
            )}
          </div>
          {meal.ingredients.map((ing, i) => {
            const cat = CATEGORY_BADGE[(ing.category as string) || ''];
            return (
              <div key={i} className="flex items-center gap-1 leading-snug">
                {cat ? (
                  <span
                    style={{ background: cat.bg, color: cat.fg }}
                    className="text-[8px] font-data font-medium px-1 rounded shrink-0"
                  >
                    {cat.label}
                  </span>
                ) : (
                  <span className="w-3 shrink-0" />
                )}
                <span className="text-[11px] text-noir truncate">{shortName(ing.name)}</span>
              </div>
            );
          })}
          {meal.notes
            ? <p className="text-[10px] text-noir/50 italic truncate mt-0.5">{meal.notes}</p>
            : !isPast && <p className="text-[10px] text-muted/40 mt-0.5">+ annoter</p>
          }
        </div>
      );
    }

    return (
      <div className="bg-surface rounded-lg border border-noir/20 p-2 mb-1">
        <div className="flex justify-between items-center mb-1">
          <span className="font-data text-[10px] uppercase text-muted tracking-wide">
            {meal.meal_type === 'lunch' ? 'Déjeuner' : 'Dîner'}
          </span>
          <button onClick={() => { setExpandedMeal(null); setEditingNote(null); }} className="text-[10px] text-muted">fermer</button>
        </div>
        {meal.ingredients.map((ing, i) => {
          const cat = CATEGORY_BADGE[(ing.category as string) || ''];
          return (
            <div key={i} className="flex items-center gap-1 text-[11px] leading-tight mb-0.5">
              {cat ? (
                <span
                  style={{ background: cat.bg, color: cat.fg }}
                  className="text-[8px] font-data font-medium px-1 rounded shrink-0"
                >
                  {cat.label}
                </span>
              ) : (
                <span className="w-3 shrink-0" />
              )}
              <span className="text-noir flex-1 truncate">{shortName(ing.name)}</span>
              <span className="font-data text-muted ml-1 shrink-0">{ing.quantity}{ing.unit}</span>
            </div>
          );
        })}
        {costPerPerson !== null && (
          <p className="font-data text-[10px] text-muted mt-1">~{costPerPerson.toFixed(2).replace('.', ',')} €/tête</p>
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
          <div className="h-36 flex items-center justify-center border-b border-bordure">
            <span className="text-xs font-medium text-muted -rotate-90 whitespace-nowrap">Matin</span>
          </div>
          <div className="h-36 flex items-center justify-center border-b border-bordure">
            <span className="text-xs font-medium text-muted -rotate-90 whitespace-nowrap">Aprem</span>
          </div>
          <div className="h-36 flex items-center justify-center">
            <span className="text-xs font-medium text-muted -rotate-90 whitespace-nowrap">Soir</span>
          </div>
        </div>

        {/* Zone scrollable */}
        <div
          ref={scrollRef}
          className="overflow-x-auto pl-12"
          style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}
        >
          <div className="flex" style={{ width: spanDates.length * COL_WIDTH }}>
            {spanDates.map((date) => {
              const isPast = date < today;
              const isToday = date === today;
              const { day, num } = formatDay(date);
              const lunch = getMeal(date, 'lunch');
              const dinner = getMeal(date, 'dinner');
              const prepsMatin = getPreps(date, 'matin');
              const prepsAprem = getPreps(date, 'aprem');
              const prepsSoir = getPreps(date, 'soir');

              return (
                <div
                  key={date}
                  data-today={isToday || undefined}
                  className={`flex-shrink-0 border-r border-bordure ${isPast && !isToday ? 'opacity-40' : ''}`}
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
                  <div className="h-36 p-1 border-b border-bordure overflow-y-auto">
                    {renderMealCell(lunch, isPast)}
                    {prepsMatin.map((task) => (
                      <div key={task.id} className="bg-noir/5 text-noir border border-bordure rounded px-1.5 py-0.5 text-[11px] font-data mb-0.5 flex items-center justify-between">
                        <span className="truncate">{task.label}</span>
                        {!isPast && <button onClick={() => deleteTask(task.id)} className="text-muted hover:text-rouge ml-1 text-[10px] shrink-0">x</button>}
                      </div>
                    ))}
                  </div>

                  {/* APREM */}
                  <div className="h-36 p-1 border-b border-bordure overflow-y-auto">
                    {prepsAprem.map((task) => (
                      <div key={task.id} className="bg-noir/5 text-noir border border-bordure rounded px-1.5 py-0.5 text-[11px] font-data mb-0.5 flex items-center justify-between">
                        <span className="truncate">{task.label}</span>
                        {!isPast && <button onClick={() => deleteTask(task.id)} className="text-muted hover:text-rouge ml-1 text-[10px] shrink-0">x</button>}
                      </div>
                    ))}
                  </div>

                  {/* SOIR */}
                  <div className="h-36 p-1 overflow-y-auto">
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
            {spanDates.map((d) => {
              const diff = Math.round((new Date(d + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()) / 86400000);
              const label = diff === 0 ? 'Aujourd\'hui' : diff === 1 ? 'Demain' : `J+${diff}`;
              return <option key={d} value={d}>{label} ({formatShort(d)})</option>;
            })}
          </select>
          <select
            className="input text-sm w-28"
            value={newTaskSlot}
            onChange={(e) => setNewTaskSlot(e.target.value)}
          >
            <option value="matin">Matin</option>
            <option value="aprem">Apres-midi</option>
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

      {/* LISTES DE COURSES PAR SPAN INTER-COMMANDE */}
      {suggestions.length > 0 && deliveryDays.length > 0 && (() => {
        const orderSpans: { label: string; dates: string[] }[] = [];
        let currentDates: string[] = [];
        let currentStart = '';

        spanDates.forEach((date) => {
          if (!currentStart) currentStart = date;
          currentDates.push(date);
          const nextDate = new Date(date + 'T00:00:00');
          nextDate.setDate(nextDate.getDate() + 1);
          const nextDay = nextDate.getDay();
          if (deliveryDays.includes(nextDay) || date === spanDates[spanDates.length - 1]) {
            orderSpans.push({
              label: `${formatShort(currentStart)} → ${formatShort(date)}`,
              dates: [...currentDates],
            });
            currentDates = [];
            currentStart = '';
          }
        });

        return orderSpans.map((os, idx) => {
          const agg: Record<string, { quantity: number; unit: string }> = {};
          suggestions
            .filter((s) => os.dates.includes(s.meal_date))
            .forEach((s) => {
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
          if (sorted.length === 0) return null;
          return (
            <section key={idx} className="mt-6">
              <h2 className="font-titre text-base text-noir mb-1">Liste de courses</h2>
              <p className="text-xs font-data text-muted mb-3">{os.label}</p>
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
        });
      })()}
    </div>
  );
}
