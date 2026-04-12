'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import type { Establishment } from '@/lib/types';
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

export default function ReglagesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [service, setService] = useState<ServiceType>('lunch');
  const [employeeCount, setEmployeeCount] = useState(12);
  const [deliveryDays, setDeliveryDays] = useState<number[]>([]);
  const [constraints, setConstraints] = useState<string[]>([]);
  const [constraintOther, setConstraintOther] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    const supabase = createBrowserClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      window.location.href = '/';
      return;
    }
    setToken(session.access_token);

    const res = await fetch('/api/establishment', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    if (res.ok) {
      const est: Establishment = await res.json();
      setName(est.name);
      setEmployeeCount(est.employee_count);
      if (est.services?.includes('lunch') && est.services?.includes('dinner')) {
        setService('both');
      } else if (est.services?.includes('dinner')) {
        setService('dinner');
      } else {
        setService('lunch');
      }
      setConstraints(est.dietary_constraints?.length > 0 ? est.dietary_constraints : ['aucune']);
    }

    // Load supplier delivery days
    const supRes = await fetch('/api/suppliers', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (supRes.ok) {
      const suppliers = await supRes.json();
      const primary = suppliers.find((s: { is_primary: boolean }) => s.is_primary);
      if (primary) {
        setDeliveryDays(primary.delivery_days || []);
      }
    }

    setLoading(false);
  }

  const toggleDay = (day: number) => {
    setDeliveryDays((prev) =>
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

  async function handleSave() {
    if (!token) return;
    setSaving(true);
    setSaved(false);

    const services = service === 'both' ? ['lunch', 'dinner'] : [service];
    const dietaryConstraints = constraints.filter((c) => c !== 'aucune');
    if (constraintOther.trim()) dietaryConstraints.push(constraintOther.trim());

    await fetch('/api/establishment', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name,
        employee_count: employeeCount,
        services,
        dietary_constraints: dietaryConstraints,
      }),
    });

    // Update supplier delivery days
    await fetch('/api/suppliers', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        delivery_days: deliveryDays,
      }),
    });

    // Regenerer : etape 1 creer le span
    const spanRes = await fetch('/api/suggestions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ regenerate: true }),
    });

    if (spanRes.ok) {
      const spanData = await spanRes.json();
      if (spanData.status === 'pending' && spanData.span) {
        // Etape 2 : generer via Claude
        await fetch('/api/suggestions/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ span_id: spanData.span.id }),
        });
      }
    }

    setSaving(false);
    setSaved(true);
    window.location.href = '/dashboard';
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 max-w-lg mx-auto space-y-6 pb-24">
      <header>
        <h1 className="text-lg font-bold">Reglages</h1>
        <p className="text-sm text-gray-500">Modifiez les parametres de vos suggestions</p>
      </header>

      {/* Nom */}
      <section className="card space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Etablissement</h2>
        <input
          type="text"
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </section>

      {/* Services */}
      <section className="card space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Services</h2>
        <div className="space-y-2">
          {([
            ['lunch', 'Dejeuner uniquement'],
            ['dinner', 'Diner uniquement'],
            ['both', 'Les deux'],
          ] as [ServiceType, string][]).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setService(value)}
              className={`w-full p-3 rounded-lg border-2 text-left text-sm font-medium transition-colors ${
                service === value
                  ? 'border-brand-500 bg-brand-50 text-brand-700'
                  : 'border-gray-200 bg-white text-gray-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* Nombre de personnes */}
      <section className="card space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Nombre de personnes</h2>
        <input
          type="number"
          className="input text-center"
          value={employeeCount}
          onChange={(e) => setEmployeeCount(Math.max(1, parseInt(e.target.value) || 1))}
          min={1}
        />
        <p className="text-xs text-gray-400">
          Budget : {(employeeCount * BUDGET_HCR * 5).toFixed(0)} EUR / semaine ({BUDGET_HCR} EUR/pers/repas)
        </p>
      </section>

      {/* Jours de livraison */}
      <section className="card space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Jours de commande</h2>
        <p className="text-xs text-gray-500">Les suggestions s&apos;organisent entre vos commandes</p>
        <div className="grid grid-cols-4 gap-2">
          {DAY_LABELS.map((label, i) => {
            const dayVal = DAY_VALUES[i];
            const selected = deliveryDays.includes(dayVal);
            return (
              <button
                key={dayVal}
                onClick={() => toggleDay(dayVal)}
                className={`py-2.5 rounded-lg border-2 text-sm font-medium transition-colors ${
                  selected
                    ? 'border-brand-500 bg-brand-500 text-white'
                    : 'border-gray-200 bg-white text-gray-600'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        {deliveryDays.length > 0 && (
          <p className="text-xs text-gray-400">
            {computeSpanDefinitions(deliveryDays).length} periode(s) entre commandes par semaine
          </p>
        )}
      </section>

      {/* Contraintes */}
      <section className="card space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Contraintes alimentaires</h2>
        <div className="grid grid-cols-2 gap-2">
          {CONSTRAINTS_OPTIONS.map((opt) => {
            const selected = constraints.includes(opt.value);
            return (
              <button
                key={opt.value}
                onClick={() => toggleConstraint(opt.value)}
                className={`py-2.5 px-3 rounded-lg border-2 text-sm font-medium transition-colors ${
                  selected
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-gray-200 bg-white text-gray-600'
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
      </section>

      {/* Save button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
        <div className="max-w-lg mx-auto">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary w-full py-3"
          >
            {saving ? 'Enregistrement et regeneration...' : 'Enregistrer et regenerer'}
          </button>
        </div>
      </div>
    </div>
  );
}
