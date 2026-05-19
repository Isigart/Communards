'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { BUDGET_HCR } from '@/lib/types';
import { computeSpanDefinitions } from '@/lib/spans';

type LoadingStep = 'idle' | 'creating' | 'configuring' | 'generating';

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const DAY_VALUES = [1, 2, 3, 4, 5, 6, 0];
const ALL_DAYS: number[] = [1, 2, 3, 4, 5, 6, 0];

const CONSTRAINTS_OPTIONS = [
  { value: 'vegetarien', label: 'Végétarien' },
  { value: 'sans-porc', label: 'Sans porc' },
  { value: 'sans-gluten', label: 'Sans gluten' },
  { value: 'sans-lactose', label: 'Sans lactose' },
];

const LOADING_LABELS: Record<LoadingStep, string> = {
  idle: '',
  creating: 'on prépare votre maison...',
  configuring: 'on configure le fournisseur...',
  generating: 'on génère votre planning (ça peut prendre 30s)...',
};

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [loadingStep, setLoadingStep] = useState<LoadingStep>('idle');
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const [name, setName] = useState('');
  // lunch/dinner days = jours de la semaine cochés (0=Dim, 1=Lun, ..., 6=Sam)
  const [lunchDays, setLunchDays] = useState<number[]>(ALL_DAYS);
  const [dinnerDays, setDinnerDays] = useState<number[]>([]);
  const hasLunch = lunchDays.length > 0;
  const hasDinner = dinnerDays.length > 0;
  const [countLunch, setCountLunch] = useState(4);
  const [countDinner, setCountDinner] = useState(2);
  const [orderDays, setOrderDays] = useState<number[]>([]);
  const [includeDessert, setIncludeDessert] = useState(true);
  // Map { contrainte: nombre de personnes concernées }. Une contrainte n'est active que si count > 0.
  const [constraintCounts, setConstraintCounts] = useState<Record<string, number>>({});
  const [constraintOther, setConstraintOther] = useState('');
  const [constraintOtherCount, setConstraintOtherCount] = useState(0);

  const loading = loadingStep !== 'idle';

  useEffect(() => {
    const supabase = createBrowserClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { window.location.href = '/'; return; }
      // Si user a déjà un établissement, on redirige vers le dashboard
      // pour éviter les doublons et les "Invalid token" sur double-création
      try {
        const res = await fetch('/api/establishment', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          window.location.href = '/dashboard';
          return;
        }
      } catch { /* skip — on laisse le user continuer le onboarding */ }
      setToken(session.access_token);
    });
  }, []);

  const toggleOrderDay = (day: number) => {
    setOrderDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b)
    );
  };

  const toggleScheduleCell = (slot: 'lunch' | 'dinner', day: number) => {
    const setFn = slot === 'lunch' ? setLunchDays : setDinnerDays;
    setFn((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b)
    );
  };

  const setConstraintCount = (value: string, count: number, max: number) => {
    const clamped = Math.max(0, Math.min(max, count));
    setConstraintCounts((prev) => {
      const next = { ...prev };
      if (clamped <= 0) delete next[value];
      else next[value] = clamped;
      return next;
    });
  };

  const canAdvance = () => {
    switch (step) {
      case 0: return name.trim().length > 0;
      case 1: return hasLunch || hasDinner;
      case 2: return (!hasLunch || countLunch > 0) && (!hasDinner || countDinner > 0);
      case 3: return orderDays.length > 0;
      case 4: return true;
      default: return false;
    }
  };

  async function safeFetch(url: string, init: RequestInit, errorContext: string): Promise<Response> {
    try {
      const res = await fetch(url, init);
      if (!res.ok) {
        let msg = `Erreur ${res.status}`;
        try {
          const body = await res.json();
          if (body?.error) msg = body.error;
        } catch { /* JSON parse fail, on garde le code HTTP */ }
        throw new Error(`${errorContext} : ${msg}`);
      }
      return res;
    } catch (e) {
      if (e instanceof Error) throw e;
      throw new Error(`${errorContext} : erreur réseau`);
    }
  }

  const handleSubmit = async () => {
    if (!token) return;
    setError(null);

    const employeeCount = (hasLunch ? countLunch : 0) + (hasDinner ? countDinner : 0);
    const services = [hasLunch ? 'lunch' : null, hasDinner ? 'dinner' : null].filter(Boolean) as string[];
    // Construire dietary_counts (compte par contrainte) + dietary_constraints (clés actives)
    const dietaryCounts: Record<string, number> = { ...constraintCounts };
    if (constraintOther.trim() && constraintOtherCount > 0) {
      dietaryCounts[constraintOther.trim()] = Math.min(constraintOtherCount, employeeCount);
    }
    const dietaryConstraints = Object.keys(dietaryCounts).filter((k) => dietaryCounts[k] > 0);

    try {
      // Étape 1 : créer l'établissement + fournisseur
      setLoadingStep('creating');
      await safeFetch('/api/establishment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: name.trim(),
          employee_count: employeeCount,
          budget_per_meal: BUDGET_HCR,
          market: 'fr',
          services,
          lunch_days: lunchDays,
          dinner_days: dinnerDays,
          dietary_constraints: dietaryConstraints,
          dietary_counts: dietaryCounts,
          include_dessert: includeDessert,
          supplier_name: 'Fournisseur principal',
          delivery_days: orderDays,
        }),
      }, 'Création de la maison');

      // Étape 2 : créer le span
      setLoadingStep('configuring');
      const spanRes = await safeFetch('/api/suggestions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }, 'Configuration du planning');

      const spanData = await spanRes.json();

      // Étape 3 : générer les suggestions via Claude
      if (spanData.status === 'pending' && spanData.span) {
        setLoadingStep('generating');
        await safeFetch('/api/suggestions/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ span_id: spanData.span.id }),
        }, 'Génération du planning');
      }

      // Tout s'est bien passé → dashboard
      window.location.href = '/dashboard';
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur inconnue';
      setError(msg);
      setLoadingStep('idle');
    }
  };

  const progress = ((step + 1) / 5) * 100;

  // Budget hebdo = (jours_dej × headcount_dej + jours_din × headcount_din) × prix HCR
  const budgetPreview = () =>
    (lunchDays.length * countLunch + dinnerDays.length * countDinner) * BUDGET_HCR;

  return (
    <div className="min-h-screen pb-32">
      <div className="max-w-md mx-auto px-4 pt-8">
        {/* Progress */}
        <div className="mb-2 flex justify-between items-center">
          <span className="text-xs text-muted">Étape {step + 1} / 5</span>
          <span className="font-titre text-sm text-noir">L&apos;Ordinaire</span>
        </div>
        <div className="h-1 bg-bordure rounded-full mb-8">
          <div className="h-full bg-noir rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>

        {/* Step 0: Nom */}
        {step === 0 && (
          <div className="space-y-4">
            <h2 className="font-titre text-xl text-noir">Comment s&apos;appelle la maison ?</h2>
            <input type="text" className="input text-lg" placeholder="Le Bistrot du Marche" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
        )}

        {/* Step 1: Planning hebdo (7×2 midi/soir) + dessert */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="space-y-3">
              <h2 className="font-titre text-xl text-noir">Quels repas générer ?</h2>
              <p className="text-xs text-muted">Coche les services que tu sers chaque jour.</p>
              <div className="rounded-lg border border-bordure overflow-hidden">
                <div className="grid grid-cols-3 bg-bordure/30 text-[10px] font-data uppercase text-muted">
                  <div className="py-2 px-2"></div>
                  <div className="py-2 text-center">Midi</div>
                  <div className="py-2 text-center">Soir</div>
                </div>
                {DAY_VALUES.map((dayVal, i) => {
                  const lunchOn = lunchDays.includes(dayVal);
                  const dinnerOn = dinnerDays.includes(dayVal);
                  return (
                    <div key={dayVal} className="grid grid-cols-3 border-t border-bordure">
                      <div className="py-2 px-2 text-sm text-noir font-medium">{DAY_LABELS[i]}</div>
                      <button
                        onClick={() => toggleScheduleCell('lunch', dayVal)}
                        className={`py-3 text-sm font-data transition-colors ${
                          lunchOn ? 'bg-rouge/10 text-rouge font-semibold' : 'bg-surface text-muted/40'
                        }`}
                      >{lunchOn ? '✓' : '·'}</button>
                      <button
                        onClick={() => toggleScheduleCell('dinner', dayVal)}
                        className={`py-3 text-sm font-data transition-colors ${
                          dinnerOn ? 'bg-rouge/10 text-rouge font-semibold' : 'bg-surface text-muted/40'
                        }`}
                      >{dinnerOn ? '✓' : '·'}</button>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setLunchDays(ALL_DAYS); setDinnerDays(ALL_DAYS); }}
                  className="flex-1 py-2 rounded-lg border border-bordure text-xs font-data text-muted hover:text-noir"
                >Tous</button>
                <button
                  type="button"
                  onClick={() => { setLunchDays(ALL_DAYS); setDinnerDays([]); }}
                  className="flex-1 py-2 rounded-lg border border-bordure text-xs font-data text-muted hover:text-noir"
                >Tous les midis</button>
                <button
                  type="button"
                  onClick={() => { setLunchDays([]); setDinnerDays([]); }}
                  className="flex-1 py-2 rounded-lg border border-bordure text-xs font-data text-muted hover:text-noir"
                >Rien</button>
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="font-titre text-base text-noir">Un dessert à chaque repas ?</h3>
              <p className="text-xs text-muted">Yaourt, fruit, fromage… Si non, on s&apos;arrête à protéine + féculent + légume.</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setIncludeDessert(true)}
                  className={`p-3 rounded-lg border font-medium text-sm transition-colors ${
                    includeDessert ? 'border-rouge text-noir font-medium' : 'border-bordure bg-surface text-muted'
                  }`}
                >Oui</button>
                <button
                  onClick={() => setIncludeDessert(false)}
                  className={`p-3 rounded-lg border font-medium text-sm transition-colors ${
                    !includeDessert ? 'border-rouge text-noir font-medium' : 'border-bordure bg-surface text-muted'
                  }`}
                >Non</button>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Nombre de personnes */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="font-titre text-xl text-noir">Combien à table ?</h2>
            <p className="text-xs text-muted">À partir de 1 personne — peu importe la taille de la brigade.</p>
            <div className="space-y-4">
              {hasLunch && (
                <div>
                  <label className="block text-sm text-muted mb-2">Midi</label>
                  <input type="number" className="input text-lg text-center font-data" value={countLunch} onChange={(e) => setCountLunch(Math.max(1, parseInt(e.target.value) || 1))} min={1} autoFocus />
                </div>
              )}
              {hasDinner && (
                <div>
                  <label className="block text-sm text-muted mb-2">Soir</label>
                  <input type="number" className="input text-lg text-center font-data" value={countDinner} onChange={(e) => setCountDinner(Math.max(1, parseInt(e.target.value) || 1))} min={1} autoFocus={!hasLunch} />
                </div>
              )}
            </div>
            <div className="card">
              <p className="text-sm text-muted">Budget légal HCR : <span className="font-data">{BUDGET_HCR} €</span>/repas/pers</p>
              <p className="text-lg font-data text-noir mt-1">{budgetPreview().toFixed(0)} € / semaine</p>
            </div>
          </div>
        )}

        {/* Step 3: Jours de commande */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="font-titre text-xl text-noir">Quels jours passez-vous commande ?</h2>
            <p className="text-sm text-muted">On organise les repas entre chaque commande.</p>
            <div className="grid grid-cols-4 gap-2">
              {DAY_LABELS.map((label, i) => {
                const dayVal = DAY_VALUES[i];
                const selected = orderDays.includes(dayVal);
                return (
                  <button
                    key={dayVal}
                    onClick={() => toggleOrderDay(dayVal)}
                    className={`py-3 rounded-lg border font-medium text-sm transition-colors ${
                      selected ? 'border-rouge bg-rouge text-papier' : 'border-bordure bg-surface text-muted'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            {orderDays.length > 0 && (
              <p className="text-sm text-muted font-data">{computeSpanDefinitions(orderDays).length} {computeSpanDefinitions(orderDays).length > 1 ? 'périodes' : 'période'} entre chaque commande</p>
            )}
          </div>
        )}

        {/* Step 4: Contraintes alimentaires (par nombre de personnes concernées) */}
        {step === 4 && (() => {
          const total = (hasLunch ? countLunch : 0) + (hasDinner ? countDinner : 0);
          return (
            <div className="space-y-4">
              <h2 className="font-titre text-xl text-noir">Des contraintes à table ?</h2>
              <p className="text-xs text-muted">Combien de personnes sont concernées (sur {total}). Laisse à 0 si personne n&apos;a la contrainte.</p>
              <div className="space-y-2">
                {CONSTRAINTS_OPTIONS.map((opt) => {
                  const count = constraintCounts[opt.value] || 0;
                  const active = count > 0;
                  return (
                    <div key={opt.value} className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                      active ? 'border-rouge' : 'border-bordure bg-surface'
                    }`}>
                      <span className={`flex-1 text-sm ${active ? 'text-noir font-medium' : 'text-muted'}`}>{opt.label}</span>
                      <button
                        type="button"
                        onClick={() => setConstraintCount(opt.value, count - 1, total)}
                        className="w-7 h-7 rounded border border-bordure font-data text-sm text-noir disabled:opacity-30"
                        disabled={count <= 0}
                      >−</button>
                      <input
                        type="number"
                        value={count}
                        onChange={(e) => setConstraintCount(opt.value, parseInt(e.target.value) || 0, total)}
                        min={0}
                        max={total}
                        className="w-12 input text-center text-sm font-data py-1"
                      />
                      <button
                        type="button"
                        onClick={() => setConstraintCount(opt.value, count + 1, total)}
                        className="w-7 h-7 rounded border border-bordure font-data text-sm text-noir disabled:opacity-30"
                        disabled={count >= total}
                      >+</button>
                      <span className="text-xs text-muted w-10 text-right font-data">/ {total}</span>
                    </div>
                  );
                })}
              </div>
              <div className="space-y-2 pt-2 border-t border-bordure">
                <p className="text-xs text-muted">Autre contrainte (allergie spécifique, aversion…)</p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    className="input flex-1 text-sm"
                    placeholder="ex: sans noix"
                    value={constraintOther}
                    onChange={(e) => setConstraintOther(e.target.value)}
                  />
                  <input
                    type="number"
                    value={constraintOtherCount}
                    onChange={(e) => setConstraintOtherCount(Math.max(0, Math.min(total, parseInt(e.target.value) || 0)))}
                    min={0}
                    max={total}
                    className="w-12 input text-center text-sm font-data py-1"
                  />
                  <span className="text-xs text-muted w-10 text-right font-data">/ {total}</span>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Erreur */}
        {error && (
          <div className="mt-6 p-3 rounded-lg border border-rouge bg-rouge/5">
            <p className="text-sm text-rouge font-medium">Quelque chose a cloché.</p>
            <p className="text-xs text-rouge/80 mt-1">{error}</p>
            <p className="text-xs text-muted mt-2">Réessaie. Si ça persiste, vérifie ta connexion ou contacte-nous.</p>
          </div>
        )}
      </div>

      {/* Navigation fixe */}
      <div className="fixed bottom-0 left-0 right-0 bg-papier border-t border-bordure p-4">
        <div className="max-w-md mx-auto flex gap-3">
          {step > 0 && !loading && (
            <button onClick={() => setStep(step - 1)} className="btn-secondary px-6">←</button>
          )}
          <button
            onClick={() => { if (step < 4) setStep(step + 1); else handleSubmit(); }}
            disabled={!canAdvance() || loading}
            className={`flex-1 py-3 rounded-lg font-data text-sm tracking-wide transition-colors ${
              canAdvance() && !loading
                ? 'bg-noir text-papier' : 'bg-bordure text-muted cursor-not-allowed'
            }`}
          >
            {loading ? LOADING_LABELS[loadingStep] : step === 4 ? 'Voir mon planning →' : 'Continuer →'}
          </button>
        </div>
      </div>
    </div>
  );
}
