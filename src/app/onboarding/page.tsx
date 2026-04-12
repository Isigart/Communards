'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { BUDGET_HCR } from '@/lib/types';
import { computeSpanDefinitions } from '@/lib/spans';

type ServiceType = 'lunch' | 'dinner' | 'both';

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const DAY_VALUES = [1, 2, 3, 4, 5, 6, 0];

const CONSTRAINTS_OPTIONS = [
  { value: 'aucune', label: 'Aucune' },
  { value: 'vegetarien', label: 'Vegetarien' },
  { value: 'sans-porc', label: 'Sans porc' },
  { value: 'sans-gluten', label: 'Sans gluten' },
];

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [service, setService] = useState<ServiceType | ''>('');
  const [countLunch, setCountLunch] = useState(12);
  const [countDinner, setCountDinner] = useState(8);
  const [orderDays, setOrderDays] = useState<number[]>([]);
  const [constraints, setConstraints] = useState<string[]>([]);
  const [constraintOther, setConstraintOther] = useState('');

  useEffect(() => {
    const supabase = createBrowserClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        window.location.href = '/';
        return;
      }
      setToken(session.access_token);
    });
  }, []);

  const toggleOrderDay = (day: number) => {
    setOrderDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b)
    );
  };

  const toggleConstraint = (value: string) => {
    if (value === 'aucune') {
      setConstraints(['aucune']);
      return;
    }
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

  const handleSubmit = async () => {
    if (!token) return;
    setLoading(true);

    const employeeCount = service === 'both' ? countLunch + countDinner : countLunch;
    const services = service === 'both' ? ['lunch', 'dinner'] : service === 'dinner' ? ['dinner'] : ['lunch'];
    const allConstraints = [...constraints];
    if (constraintOther.trim()) allConstraints.push(constraintOther.trim());

    const res = await fetch('/api/establishment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
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
    });

    if (res.ok) {
      // Generer les suggestions directement apres l'onboarding
      await fetch('/api/suggestions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      window.location.href = '/dashboard';
    }
    setLoading(false);
  };

  const progress = ((step + 1) / 5) * 100;

  // Budget preview
  const budgetPreview = () => {
    if (service === 'both') {
      return (countLunch + countDinner) * BUDGET_HCR * 5;
    }
    return countLunch * BUDGET_HCR * 5;
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      <div className="max-w-md mx-auto px-4 pt-8">
        {/* Progress */}
        <div className="mb-2 flex justify-between items-center">
          <span className="text-xs text-gray-400">Etape {step + 1} / 5</span>
          <span className="text-xs text-brand-500 font-medium">La Table de l&apos;Equipe</span>
        </div>
        <div className="h-1.5 bg-gray-200 rounded-full mb-8">
          <div
            className="h-full bg-brand-500 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Step 0: Nom */}
        {step === 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-800">Comment s&apos;appelle votre etablissement ?</h2>
            <input
              type="text"
              className="input text-lg"
              placeholder="Le Bistrot du Marche"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
        )}

        {/* Step 1: Services */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-800">Quels services nourrissez-vous ?</h2>
            <div className="space-y-3">
              {([
                ['lunch', 'Dejeuner uniquement'],
                ['dinner', 'Diner uniquement'],
                ['both', 'Les deux'],
              ] as [ServiceType, string][]).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setService(value)}
                  className={`w-full p-4 rounded-xl border-2 text-left font-medium transition-colors ${
                    service === value
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
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
            <h2 className="text-xl font-bold text-gray-800">Combien de personnes par service ?</h2>
            {service === 'both' ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">Midi</label>
                  <input
                    type="number"
                    className="input text-lg text-center"
                    value={countLunch}
                    onChange={(e) => setCountLunch(Math.max(1, parseInt(e.target.value) || 1))}
                    min={1}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">Soir</label>
                  <input
                    type="number"
                    className="input text-lg text-center"
                    value={countDinner}
                    onChange={(e) => setCountDinner(Math.max(1, parseInt(e.target.value) || 1))}
                    min={1}
                  />
                </div>
              </div>
            ) : (
              <input
                type="number"
                className="input text-lg text-center"
                value={countLunch}
                onChange={(e) => setCountLunch(Math.max(1, parseInt(e.target.value) || 1))}
                min={1}
                autoFocus
              />
            )}
            <div className="card bg-brand-50 border-brand-200">
              <p className="text-sm text-brand-700">
                Budget legal HCR : {BUDGET_HCR} EUR/repas/pers
              </p>
              <p className="text-lg font-bold text-brand-600 mt-1">
                {budgetPreview().toFixed(0)} EUR / semaine
              </p>
            </div>
          </div>
        )}

        {/* Step 3: Jours de commande */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-800">Quels jours passez-vous commande ?</h2>
            <p className="text-sm text-gray-500">On organise les repas entre chaque commande. Par exemple, commande mardi et vendredi → les suggestions couvrent mar-jeu puis ven-lun.</p>
            <div className="grid grid-cols-4 gap-2">
              {DAY_LABELS.map((label, i) => {
                const dayVal = DAY_VALUES[i];
                const selected = orderDays.includes(dayVal);
                return (
                  <button
                    key={dayVal}
                    onClick={() => toggleOrderDay(dayVal)}
                    className={`py-3 rounded-xl border-2 font-medium text-sm transition-colors ${
                      selected
                        ? 'border-brand-500 bg-brand-500 text-white'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            {orderDays.length > 0 && (
              <p className="text-sm text-gray-500">
                {computeSpanDefinitions(orderDays).length} periode(s) entre commandes par semaine
              </p>
            )}
          </div>
        )}

        {/* Step 4: Contraintes alimentaires */}
        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-800">Contraintes alimentaires ?</h2>
            <div className="grid grid-cols-2 gap-2">
              {CONSTRAINTS_OPTIONS.map((opt) => {
                const selected = constraints.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    onClick={() => toggleConstraint(opt.value)}
                    className={`py-3 px-4 rounded-xl border-2 font-medium text-sm transition-colors ${
                      selected
                        ? 'border-brand-500 bg-brand-50 text-brand-700'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <input
              type="text"
              className="input"
              placeholder="Autre contrainte..."
              value={constraintOther}
              onChange={(e) => setConstraintOther(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Navigation fixe */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
        <div className="max-w-md mx-auto flex gap-3">
          {step > 0 && (
            <button onClick={() => setStep(step - 1)} className="btn-secondary px-6">
              ←
            </button>
          )}
          <button
            onClick={() => {
              if (step < 4) setStep(step + 1);
              else handleSubmit();
            }}
            disabled={!canAdvance() || loading}
            className={`flex-1 py-3 rounded-lg font-semibold transition-colors ${
              canAdvance() && !loading
                ? 'bg-brand-500 hover:bg-brand-600 text-white'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {loading ? 'Preparation de votre planning...' : step === 4 ? 'Voir mon planning' : 'Continuer'}
          </button>
        </div>
      </div>
    </div>
  );
}
