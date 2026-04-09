'use client';

import { useState, useCallback } from 'react';
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
  const [chefNotes, setChefNotes] = useState<Record<string, string>>({
    '3': 'Faire un saute avec les courgettes, pas de wok',
    '5': 'Preparer la puree le matin pour le service du midi',
  });
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [draftNote, setDraftNote] = useState('');

  // Prep tasks: cartes de preparation independantes du jour du repas
  interface PrepTask {
    id: string;
    label: string;
    forMeal: string; // ex: "Mer dej" — le repas cible
    color: string;
  }
  const [prepTasks, setPrepTasks] = useState<PrepTask[]>([
    { id: 'p1', label: 'Faire mariner le poulet', forMeal: 'Lun dej', color: 'bg-red-100 text-red-700 border-red-200' },
    { id: 'p2', label: 'Eplucher carottes + oignons', forMeal: 'Lun dej', color: 'bg-green-100 text-green-700 border-green-200' },
    { id: 'p3', label: 'Sauce tomate maison', forMeal: 'Lun din', color: 'bg-orange-100 text-orange-700 border-orange-200' },
    { id: 'p4', label: 'Couper courgettes', forMeal: 'Mar dej', color: 'bg-green-100 text-green-700 border-green-200' },
    { id: 'p5', label: 'Preparer puree', forMeal: 'Mer dej', color: 'bg-amber-100 text-amber-700 border-amber-200' },
    { id: 'p6', label: 'Laver epinards', forMeal: 'Mer dej', color: 'bg-green-100 text-green-700 border-green-200' },
    { id: 'p7', label: 'Soupe de legumes', forMeal: 'Mer din', color: 'bg-green-100 text-green-700 border-green-200' },
  ]);

  // Ou chaque prep est placee: slot = "jour-creneau" ex: "lun-matin", "mar-aprem"
  const prepSlots: Record<string, string> = {
    'lun-matin': 'Lun matin',
    'lun-aprem': 'Lun aprem',
    'mar-matin': 'Mar matin',
    'mar-aprem': 'Mar aprem',
    'mer-matin': 'Mer matin',
    'mer-aprem': 'Mer aprem',
  };
  const [taskSlots, setTaskSlots] = useState<Record<string, string>>({
    // Pre-place quelques taches pour la demo
    'p1': 'lun-matin',    // Mariner poulet → lundi matin
    'p2': 'lun-matin',    // Eplucher → lundi matin
    'p3': 'lun-aprem',    // Sauce tomate → lundi aprem
    'p5': 'mer-matin',    // Puree → mercredi matin
    'p7': 'mar-aprem',    // Soupe → mardi aprem (prepa la veille)
  });

  const [dragging, setDragging] = useState<string | null>(null);
  const [newTaskLabel, setNewTaskLabel] = useState('');
  const [newTaskMeal, setNewTaskMeal] = useState('');

  const handleDragStart = useCallback((taskId: string) => {
    setDragging(taskId);
  }, []);

  const handleDrop = useCallback((slotId: string) => {
    if (dragging) {
      setTaskSlots((prev) => ({ ...prev, [dragging]: slotId }));
      setDragging(null);
    }
  }, [dragging]);

  const handleDropUnassign = useCallback(() => {
    if (dragging) {
      setTaskSlots((prev) => {
        const n = { ...prev };
        delete n[dragging];
        return n;
      });
      setDragging(null);
    }
  }, [dragging]);

  const addPrepTask = useCallback(() => {
    if (!newTaskLabel.trim()) return;
    const id = 'p' + Date.now();
    setPrepTasks((prev) => [...prev, {
      id,
      label: newTaskLabel.trim(),
      forMeal: newTaskMeal || '',
      color: 'bg-gray-100 text-gray-700 border-gray-200',
    }]);
    setNewTaskLabel('');
    setNewTaskMeal('');
  }, [newTaskLabel, newTaskMeal]);

  // Budget: cout total pour 12 pers sur 6 repas
  const totalEstimated = suggestions.reduce((sum, s) => sum + s.estimated_cost, 0);
  const budgetTotal = establishment.budget_per_meal * establishment.employee_count * suggestions.length;

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
                        ~{s.estimated_cost} {establishment.currency} ({(s.estimated_cost / establishment.employee_count).toFixed(1)}/pers)
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
            <header className="flex justify-between items-start">
              <div>
                <h1 className="text-xl font-bold">Planning</h1>
                <p className="text-sm text-gray-500">
                  {currentSpan.label} — {supplier.name}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">{totalEstimated} / {budgetTotal} {establishment.currency}</p>
                <p className="text-xs text-gray-400">{establishment.employee_count} pers.</p>
              </div>
            </header>

            {/* Grille planning — vue complete du span */}
            <div className="overflow-x-auto -mx-4 px-4">
              <table className="w-full min-w-[500px] border-collapse">
                <thead>
                  <tr>
                    <th className="text-left text-xs font-semibold text-gray-500 pb-2 w-20"></th>
                    <th className="text-left text-xs font-semibold text-brand-500 pb-2 uppercase">Dejeuner</th>
                    <th className="text-left text-xs font-semibold text-brand-500 pb-2 uppercase">Diner</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(grouped)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([date, meals]) => {
                      const lunch = meals.find((m) => m.meal_type === 'lunch');
                      const dinner = meals.find((m) => m.meal_type === 'dinner');
                      return (
                        <tr key={date} className="border-t border-gray-100">
                          <td className="py-3 pr-3 align-top">
                            <span className="text-sm font-semibold text-gray-700 capitalize">
                              {new Date(date + 'T00:00:00').toLocaleDateString('fr-FR', {
                                weekday: 'short',
                                day: 'numeric',
                              })}
                            </span>
                          </td>
                          {[lunch, dinner].map((s) => (
                            <td key={s?.id || Math.random()} className="py-3 px-2 align-top">
                              {s && (
                                <div
                                  className="bg-white rounded-lg border border-gray-100 p-2.5 hover:border-brand-300 cursor-pointer transition-colors"
                                  onClick={() => {
                                    if (editingNote !== s.id) {
                                      setEditingNote(s.id);
                                      setDraftNote(chefNotes[s.id] || '');
                                    }
                                  }}
                                >
                                  <div className="flex flex-wrap gap-1 mb-1">
                                    {s.ingredients.map((ing, i) => (
                                      <span
                                        key={i}
                                        className={`text-xs rounded-full px-2 py-0.5 ${
                                          CATEGORY_COLORS[ing.category] || 'bg-gray-100 text-gray-700'
                                        }`}
                                      >
                                        {ing.name}
                                      </span>
                                    ))}
                                  </div>
                                  <p className="text-xs text-gray-400">
                                    ~{(s.estimated_cost / establishment.employee_count).toFixed(1)} {establishment.currency}/pers
                                  </p>

                                  {/* Note du chef */}
                                  {chefNotes[s.id] && editingNote !== s.id && (
                                    <div className="mt-1.5 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                                      <p className="text-xs text-amber-800">{chefNotes[s.id]}</p>
                                    </div>
                                  )}

                                  {editingNote === s.id && (
                                    <div className="mt-1.5 space-y-1.5" onClick={(e) => e.stopPropagation()}>
                                      <textarea
                                        className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-400"
                                        rows={2}
                                        placeholder="Note du chef..."
                                        value={draftNote}
                                        onChange={(e) => setDraftNote(e.target.value)}
                                        autoFocus
                                      />
                                      <div className="flex gap-1">
                                        <button
                                          onClick={() => {
                                            if (draftNote.trim()) {
                                              setChefNotes((prev) => ({ ...prev, [s.id]: draftNote.trim() }));
                                            } else {
                                              setChefNotes((prev) => { const n = { ...prev }; delete n[s.id]; return n; });
                                            }
                                            setEditingNote(null);
                                            setDraftNote('');
                                          }}
                                          className="text-xs py-1 px-2 rounded bg-brand-500 text-white"
                                        >
                                          OK
                                        </button>
                                        <button
                                          onClick={() => { setEditingNote(null); setDraftNote(''); }}
                                          className="text-xs py-1 px-2 rounded bg-gray-100 text-gray-500"
                                        >
                                          Annuler
                                        </button>
                                      </div>
                                    </div>
                                  )}

                                  {!chefNotes[s.id] && editingNote !== s.id && (
                                    <p className="mt-1 text-xs text-gray-300 italic">+ note</p>
                                  )}
                                </div>
                              )}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            {/* ====== PREP PLANNING — Drag & Drop ====== */}
            <section>
              <h2 className="font-semibold text-gray-700 mb-1">Organisation des preps</h2>
              <p className="text-xs text-gray-400 mb-3">Glissez les cartes pour planifier les preparations</p>

              {/* Taches non placees */}
              {prepTasks.filter((t) => !taskSlots[t.id]).length > 0 && (
                <div
                  className={`mb-4 p-3 rounded-lg border-2 border-dashed transition-colors ${
                    dragging && taskSlots[dragging] ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50'
                  }`}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDropUnassign()}
                >
                  <p className="text-xs font-medium text-gray-500 mb-2">A placer</p>
                  <div className="flex flex-wrap gap-2">
                    {prepTasks.filter((t) => !taskSlots[t.id]).map((task) => (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={() => handleDragStart(task.id)}
                        className={`${task.color} border rounded-lg px-3 py-1.5 text-xs font-medium cursor-grab active:cursor-grabbing shadow-sm hover:shadow`}
                      >
                        {task.label}
                        {task.forMeal && <span className="ml-1 opacity-50">({task.forMeal})</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Grille prep: jours x matin/aprem */}
              <div className="overflow-x-auto -mx-4 px-4">
                <table className="w-full min-w-[500px] border-collapse">
                  <thead>
                    <tr>
                      <th className="w-20"></th>
                      <th className="text-xs font-semibold text-gray-500 pb-2 text-left">Matin</th>
                      <th className="text-xs font-semibold text-gray-500 pb-2 text-left">Apres-midi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {['lun', 'mar', 'mer'].map((day) => (
                      <tr key={day} className="border-t border-gray-100">
                        <td className="py-2 pr-3 align-top">
                          <span className="text-sm font-semibold text-gray-700 capitalize">{day}</span>
                        </td>
                        {['matin', 'aprem'].map((slot) => {
                          const slotId = `${day}-${slot}`;
                          const tasksInSlot = prepTasks.filter((t) => taskSlots[t.id] === slotId);
                          return (
                            <td
                              key={slotId}
                              className="py-2 px-1 align-top"
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={() => handleDrop(slotId)}
                            >
                              <div
                                className={`min-h-[48px] rounded-lg border-2 border-dashed p-1.5 transition-colors ${
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
                                        className={`${task.color} border rounded-lg px-2 py-1 text-xs font-medium cursor-grab active:cursor-grabbing`}
                                      >
                                        {task.label}
                                        {task.forMeal && <span className="ml-1 opacity-50">→ {task.forMeal}</span>}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-xs text-gray-300 text-center py-2">—</p>
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

              {/* Ajouter une tache de prep */}
              <div className="mt-3 flex gap-2">
                <input
                  className="input text-sm flex-1"
                  placeholder="Nouvelle prep..."
                  value={newTaskLabel}
                  onChange={(e) => setNewTaskLabel(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addPrepTask()}
                />
                <select
                  className="input text-sm w-28"
                  value={newTaskMeal}
                  onChange={(e) => setNewTaskMeal(e.target.value)}
                >
                  <option value="">Pour...</option>
                  <option value="Lun dej">Lun dej</option>
                  <option value="Lun din">Lun din</option>
                  <option value="Mar dej">Mar dej</option>
                  <option value="Mar din">Mar din</option>
                  <option value="Mer dej">Mer dej</option>
                  <option value="Mer din">Mer din</option>
                </select>
                <button
                  onClick={addPrepTask}
                  className="btn-primary text-sm"
                  disabled={!newTaskLabel.trim()}
                >
                  +
                </button>
              </div>
            </section>

            {/* Liste de courses */}
            <section>
              <h2 className="font-semibold text-gray-700 mb-3">Liste de courses — {supplier.name}</h2>
              <div className="card">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {groceryList.map((item, i) => (
                    <div key={i} className="flex justify-between items-center py-1">
                      <span className="text-sm font-medium">{item.name}</span>
                      <span className="text-sm text-gray-400 ml-2">{item.quantity}</span>
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

            {/* Preps du jour */}
            {(() => {
              const todayPreps = prepTasks.filter((t) => {
                const slot = taskSlots[t.id];
                return slot && slot.startsWith('mar'); // "aujourd'hui" = mardi dans la demo
              });
              return todayPreps.length > 0 ? (
                <section>
                  <h2 className="font-semibold text-gray-700 mb-3">Preps du jour</h2>
                  <div className="space-y-2">
                    {['mar-matin', 'mar-aprem'].map((slotId) => {
                      const tasks = prepTasks.filter((t) => taskSlots[t.id] === slotId);
                      if (tasks.length === 0) return null;
                      return (
                        <div key={slotId}>
                          <p className="text-xs font-medium text-gray-500 mb-1">
                            {slotId.includes('matin') ? 'Matin' : 'Apres-midi'}
                          </p>
                          {tasks.map((task) => (
                            <div key={task.id} className={`${task.color} border rounded-lg px-3 py-2 text-sm font-medium mb-1`}>
                              {task.label}
                              {task.forMeal && <span className="ml-1 opacity-50">→ {task.forMeal}</span>}
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </section>
              ) : null;
            })()}

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
                    {/* Note du chef */}
                    {chefNotes[s.id] && (
                      <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        <p className="text-sm text-amber-800">{chefNotes[s.id]}</p>
                      </div>
                    )}
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
                      {chefNotes[s.id] && (
                        <p className="text-xs text-amber-700 mt-1">{chefNotes[s.id]}</p>
                      )}
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
