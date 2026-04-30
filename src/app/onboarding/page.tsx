'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { BUDGET_HCR } from '@/lib/types';
import { computeSpanDefinitions } from '@/lib/spans';

type ServiceType = 'lunch' | 'dinner' | 'both';
type LoadingStep = 'idle' | 'creating' | 'configuring' | 'generating';

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const DAY_VALUES = [1, 2, 3, 4, 5, 6, 0];

const CONSTRAINTS_OPTIONS = [
  { value: 'aucune', label: 'Aucune' },
  { value: 'vegetarien', label: 'Vegetarien' },
  { value: 'sans-porc', label: 'Sans porc' },
  { value: 'sans-gluten', label: 'Sans gluten' },
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
  const [service, setService] = useState<ServiceType | ''>('');
  const [countLunch, setCountLunch] = useState(12);
  const [countDinner, setCountDinner] = useState(8);
  const [orderDays, setOrderDays] = useState<number[]>([]);
  const [constraints, setConstraints] = useState<string[]>([]);
  const [constraintOther, setConstraintOther] = useState('');

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

  const toggleConstraint = (value: string) => {
    if (value === 'aucune') { setConstraints(['aucune']); return; }
    setConstraints((prev) => {
      const without = prev.filter((c) => c !== 'aucune');
      return without.includes(value) ? without.filter((c) => c !== value) : [...without, value];
    });
  };

  const canAdvance = () => {
    switch (step) {
      case 0: return name.trim().length > 0;
      case 1: return service !== '';
      case 2: return service === 'both' ? countLunch > 0 && countDinner > 0 : countLunch > 0;
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

    const employeeCount = service === 'both' ? countLunch + countDinner : countLunch;
    const services = service === 'both' ? ['lunch', 'dinner'] : service === 'dinner' ? ['dinner'] : ['lunch'];
    const allConstraints = [...constraints];
    if (constraintOther.trim()) allConstraints.push(constraintOther.trim());

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
          dietary_constraints: allConstraints.filter((c) => c !== 'aucune'),
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

  const budgetPreview = () => {
    if (service === 'both') return (countLunch + countDinner) * BUDGET_HCR * 5;
    return countLunch * BUDGET_HCR * 5;
  };

  return (
    <div className="min-h-screen pb-32">
      <div className="max-w-md mx-auto px-4 pt-8">
        {/* Progress */}
        <div className="mb-2 flex justify-between items-center">
          <span className="text-xs text-muted">Etape {step + 1} / 5</span>
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

        {/* Step 1: Services */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="font-titre text-xl text-noir">Quels services a nourrir ?</h2>
            <div className="space-y-3">
              {([['lunch', 'Dejeuner uniquement'], ['dinner', 'Diner uniquement'], ['both', 'Les deux']] as [ServiceType, string][]).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setService(value)}
                  className={`w-full p-4 rounded-xl border text-left font-medium transition-colors ${
                    service === value ? 'border-rouge text-noir font-medium' : 'border-bordure bg-surface text-muted'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Nombre de personnes */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="font-titre text-xl text-noir">Combien a table ?</h2>
            {service === 'both' ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-muted mb-2">Midi</label>
                  <input type="number" className="input text-lg text-center font-data" value={countLunch} onChange={(e) => setCountLunch(Math.max(1, parseInt(e.target.value) || 1))} min={1} autoFocus />
                </div>
                <div>
                  <label className="block text-sm text-muted mb-2">Soir</label>
                  <input type="number" className="input text-lg text-center font-data" value={countDinner} onChange={(e) => setCountDinner(Math.max(1, parseInt(e.target.value) || 1))} min={1} />
                </div>
              </div>
            ) : (
              <input type="number" className="input text-lg text-center font-data" value={countLunch} onChange={(e) => setCountLunch(Math.max(1, parseInt(e.target.value) || 1))} min={1} autoFocus />
            )}
            <div className="card">
              <p className="text-sm text-muted">Budget legal HCR : <span className="font-data">{BUDGET_HCR} EUR</span>/repas/pers</p>
              <p className="text-lg font-data text-noir mt-1">{budgetPreview().toFixed(0)} EUR / semaine</p>
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
              <p className="text-sm text-muted font-data">{computeSpanDefinitions(orderDays).length} {computeSpanDefinitions(orderDays).length > 1 ? 'periodes' : 'periode'} entre chaque commande</p>
            )}
          </div>
        )}

        {/* Step 4: Contraintes alimentaires */}
        {step === 4 && (
          <div className="space-y-4">
            <h2 className="font-titre text-xl text-noir">Des contraintes a table ?</h2>
            <div className="grid grid-cols-2 gap-2">
              {CONSTRAINTS_OPTIONS.map((opt) => {
                const selected = constraints.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    onClick={() => toggleConstraint(opt.value)}
                    className={`py-3 px-4 rounded-lg border font-medium text-sm transition-colors ${
                      selected ? 'border-rouge text-noir font-medium' : 'border-bordure bg-surface text-muted'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <input type="text" className="input" placeholder="Autre contrainte..." value={constraintOther} onChange={(e) => setConstraintOther(e.target.value)} />
          </div>
        )}

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
            {loading ? LOADING_LABELS[loadingStep] : step === 4 ? 'voir mon planning →' : 'continuer →'}
          </button>
        </div>
      </div>
    </div>
  );
}
