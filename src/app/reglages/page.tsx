'use client';

import { useEffect, useState } from 'react';
import type { Establishment } from '@/lib/types';
import { BUDGET_HCR } from '@/lib/types';
import { computeSpanDefinitions } from '@/lib/spans';
import { getToken, fetchEstablishment, fetchSuppliers, invalidateEstablishment, invalidateSuppliers, invalidateSuggestions } from '@/lib/cache';

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
  const [token, setToken] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [service, setService] = useState<ServiceType>('lunch');
  const [employeeCount, setEmployeeCount] = useState(12);
  const [deliveryDays, setDeliveryDays] = useState<number[]>([]);
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [constraints, setConstraints] = useState<string[]>([]);
  const [constraintOther, setConstraintOther] = useState('');

  useEffect(() => { loadSettings(); }, []);

  async function loadSettings() {
    const t = await getToken();
    if (!t) return;
    setToken(t);

    const est = await fetchEstablishment();
    if (est) {
      setName(est.name);
      setEmployeeCount(est.employee_count);
      if (est.services?.includes('lunch') && est.services?.includes('dinner')) setService('both');
      else if (est.services?.includes('dinner')) setService('dinner');
      else setService('lunch');
      setConstraints(est.dietary_constraints?.length > 0 ? est.dietary_constraints : ['aucune']);
    }

    const suppliers = await fetchSuppliers();
    const primary = suppliers.find((s) => s.is_primary);
    if (primary) {
      setDeliveryDays((primary.delivery_days as number[]) || []);
      setSupplierId(primary.id as string);
    }
    setLoading(false);
  }

  const toggleDay = (day: number) => {
    setDeliveryDays((prev) => prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b));
  };

  const toggleConstraint = (value: string) => {
    if (value === 'aucune') { setConstraints(['aucune']); return; }
    setConstraints((prev) => {
      const without = prev.filter((c) => c !== 'aucune');
      return without.includes(value) ? without.filter((c) => c !== value) : [...without, value];
    });
  };

  async function handleSave() {
    if (!token) return;
    setSaving(true);

    const services = service === 'both' ? ['lunch', 'dinner'] : [service];
    const dietaryConstraints = constraints.filter((c) => c !== 'aucune');
    if (constraintOther.trim()) dietaryConstraints.push(constraintOther.trim());

    await fetch('/api/establishment', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name, employee_count: employeeCount, services, dietary_constraints: dietaryConstraints }),
    });

    if (supplierId) {
      await fetch('/api/suppliers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: supplierId, delivery_days: deliveryDays }),
      });
    }

    const spanRes = await fetch('/api/suggestions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ regenerate: true }),
    });

    if (spanRes.ok) {
      const spanData = await spanRes.json();
      if (spanData.status === 'pending' && spanData.span) {
        await fetch('/api/suggestions/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ span_id: spanData.span.id }),
        });
      }
    }

    invalidateEstablishment();
    invalidateSuppliers();
    invalidateSuggestions();
    setSaving(false);
    window.location.href = '/dashboard';
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><p className="text-muted">Chargement...</p></div>;
  }

  return (
    <div className="min-h-screen p-4 max-w-lg mx-auto space-y-6 pb-24">
      <header>
        <h1 className="font-titre text-lg text-noir">Reglages</h1>
        <p className="text-sm text-muted">Modifie tes parametres, on regenere derriere.</p>
      </header>

      <section className="card space-y-3">
        <h2 className="font-titre text-sm text-noir">La maison</h2>
        <input type="text" className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </section>

      <section className="card space-y-3">
        <h2 className="font-titre text-sm text-noir">Services</h2>
        <div className="space-y-2">
          {([['lunch', 'Dejeuner uniquement'], ['dinner', 'Diner uniquement'], ['both', 'Les deux']] as [ServiceType, string][]).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setService(value)}
              className={`w-full p-3 rounded-lg border text-left text-sm transition-colors ${
                service === value ? 'border-rouge text-noir font-medium' : 'border-bordure bg-surface text-muted'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="font-titre text-sm text-noir">Combien a table ?</h2>
        <input type="number" className="input text-center font-data" value={employeeCount} onChange={(e) => setEmployeeCount(Math.max(1, parseInt(e.target.value) || 1))} min={1} />
        <p className="text-xs text-muted">
          Budget : <span className="font-data">{(employeeCount * BUDGET_HCR * 5).toFixed(0)} EUR</span> / semaine
        </p>
      </section>

      <section className="card space-y-3">
        <h2 className="font-titre text-sm text-noir">Jours de commande</h2>
        <p className="text-xs text-muted">Les repas s&apos;organisent entre chaque commande.</p>
        <div className="grid grid-cols-4 gap-2">
          {DAY_LABELS.map((label, i) => {
            const dayVal = DAY_VALUES[i];
            const selected = deliveryDays.includes(dayVal);
            return (
              <button
                key={dayVal}
                onClick={() => toggleDay(dayVal)}
                className={`py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                  selected ? 'border-rouge bg-rouge text-papier' : 'border-bordure bg-surface text-muted'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        {deliveryDays.length > 0 && (
          <p className="text-xs text-muted font-data">{computeSpanDefinitions(deliveryDays).length} {computeSpanDefinitions(deliveryDays).length > 1 ? 'periodes' : 'periode'} entre chaque commande</p>
        )}
      </section>

      <section className="card space-y-3">
        <h2 className="font-titre text-sm text-noir">Contraintes a table</h2>
        <div className="grid grid-cols-2 gap-2">
          {CONSTRAINTS_OPTIONS.map((opt) => {
            const selected = constraints.includes(opt.value);
            return (
              <button
                key={opt.value}
                onClick={() => toggleConstraint(opt.value)}
                className={`py-2.5 px-3 rounded-lg border text-sm font-medium transition-colors ${
                  selected ? 'border-rouge text-noir font-medium' : 'border-bordure bg-surface text-muted'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        <input type="text" className="input" placeholder="Autre contrainte..." value={constraintOther} onChange={(e) => setConstraintOther(e.target.value)} />
      </section>

      <div className="fixed bottom-0 left-0 right-0 bg-papier border-t border-bordure p-4">
        <div className="max-w-lg mx-auto">
          <button onClick={handleSave} disabled={saving} className="btn-rouge w-full">
            {saving ? 'on regenere le planning...' : 'enregistrer et regenerer →'}
          </button>
        </div>
      </div>
    </div>
  );
}
