'use client';

import { useEffect, useState } from 'react';
import type { Establishment } from '@/lib/types';
import { BUDGET_HCR } from '@/lib/types';
import { computeSpanDefinitions } from '@/lib/spans';
import { createBrowserClient } from '@/lib/supabase';
import { getToken, fetchEstablishment, fetchSuppliers, invalidateEstablishment, invalidateSuppliers, invalidateSuggestions } from '@/lib/cache';

type ServiceType = 'lunch' | 'dinner' | 'both';
type SavingStep = 'idle' | 'updating' | 'configuring' | 'generating';

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const DAY_VALUES = [1, 2, 3, 4, 5, 6, 0];

const CONSTRAINTS_OPTIONS = [
  { value: 'aucune', label: 'Aucune' },
  { value: 'vegetarien', label: 'Vegetarien' },
  { value: 'sans-porc', label: 'Sans porc' },
  { value: 'sans-gluten', label: 'Sans gluten' },
];

const SAVING_LABELS: Record<SavingStep, string> = {
  idle: 'enregistrer et regenerer →',
  updating: 'on enregistre les réglages...',
  configuring: 'on prépare le nouveau planning...',
  generating: 'on génère votre planning (ça peut prendre 30s)...',
};

export default function ReglagesPage() {
  const [loading, setLoading] = useState(true);
  const [savingStep, setSavingStep] = useState<SavingStep>('idle');
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [service, setService] = useState<ServiceType>('lunch');
  const [employeeCount, setEmployeeCount] = useState(12);
  const [deliveryDays, setDeliveryDays] = useState<number[]>([]);
  const [planningDays, setPlanningDays] = useState(7);
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [constraints, setConstraints] = useState<string[]>([]);
  const [constraintOther, setConstraintOther] = useState('');

  const saving = savingStep !== 'idle';

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
      setPlanningDays(est.planning_days || 7);
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

  async function safeFetch(url: string, init: RequestInit, errorContext: string): Promise<Response> {
    try {
      const res = await fetch(url, init);
      if (!res.ok) {
        let msg = `Erreur ${res.status}`;
        try {
          const body = await res.json();
          if (body?.error) msg = body.error;
        } catch { /* skip */ }
        throw new Error(`${errorContext} : ${msg}`);
      }
      return res;
    } catch (e) {
      if (e instanceof Error) throw e;
      throw new Error(`${errorContext} : erreur réseau`);
    }
  }

  async function handleSave() {
    if (!token) return;
    setError(null);

    const services = service === 'both' ? ['lunch', 'dinner'] : [service];
    const dietaryConstraints = constraints.filter((c) => c !== 'aucune');
    if (constraintOther.trim()) dietaryConstraints.push(constraintOther.trim());

    try {
      // Étape 1 : update établissement + supplier
      setSavingStep('updating');
      await safeFetch('/api/establishment', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, employee_count: employeeCount, services, dietary_constraints: dietaryConstraints, planning_days: planningDays }),
      }, 'Mise à jour de la maison');

      if (supplierId) {
        await safeFetch('/api/suppliers', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ id: supplierId, delivery_days: deliveryDays }),
        }, 'Mise à jour du fournisseur');
      }

      // Étape 2 : régénérer le span
      setSavingStep('configuring');
      const spanRes = await safeFetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ regenerate: true }),
      }, 'Préparation du nouveau planning');

      const spanData = await spanRes.json();

      // Étape 3 : générer les suggestions
      if (spanData.status === 'pending' && spanData.span) {
        setSavingStep('generating');
        await safeFetch('/api/suggestions/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ span_id: spanData.span.id }),
        }, 'Génération du planning');
      }

      // Tout OK → invalidation cache + dashboard
      invalidateEstablishment();
      invalidateSuppliers();
      invalidateSuggestions();
      window.location.href = '/dashboard';
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur inconnue';
      setError(msg);
      setSavingStep('idle');
    }
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
        <h2 className="font-titre text-sm text-noir">Duree du planning</h2>
        <p className="text-xs text-muted">Combien de jours de repas generer ?</p>
        <div className="flex gap-2">
          {[7, 14, 21].map((d) => (
            <button
              key={d}
              onClick={() => setPlanningDays(d)}
              className={`flex-1 py-2.5 rounded-lg border text-sm font-data transition-colors ${
                planningDays === d ? 'border-rouge bg-rouge text-papier' : 'border-bordure bg-surface text-muted'
              }`}
            >
              {d}j
            </button>
          ))}
        </div>
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

      <section className="card space-y-3">
        <h2 className="font-titre text-sm text-noir">Compte</h2>
        <div className="flex gap-3 text-xs">
          <a href="/confidentialite" className="text-muted underline">Confidentialite</a>
          <a href="/mentions-legales" className="text-muted underline">Mentions legales</a>
        </div>

        <button
          onClick={async () => {
            const supabase = createBrowserClient();
            await supabase.auth.signOut();
            window.location.href = '/';
          }}
          className="block text-sm text-noir underline"
        >
          Se déconnecter
        </button>

        <button
          onClick={async () => {
            if (!confirm('Supprimer definitivement votre compte et toutes vos donnees ? Cette action est irreversible.')) return;
            if (!token) return;
            const res = await fetch('/api/account', {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
              const supabase = createBrowserClient();
              await supabase.auth.signOut();
              window.location.href = '/';
            } else {
              alert('Quelque chose a cloche. Reessaie.');
            }
          }}
          className="block text-xs text-rouge underline"
        >
          Supprimer mon compte et toutes mes donnees
        </button>
      </section>

      {/* Erreur */}
      {error && (
        <div className="p-3 rounded-lg border border-rouge bg-rouge/5">
          <p className="text-sm text-rouge font-medium">Quelque chose a cloché.</p>
          <p className="text-xs text-rouge/80 mt-1">{error}</p>
          <p className="text-xs text-muted mt-2">Réessaie. Si ça persiste, vérifie ta connexion.</p>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 bg-papier border-t border-bordure p-4">
        <div className="max-w-lg mx-auto">
          <button onClick={handleSave} disabled={saving} className="btn-rouge w-full">
            {SAVING_LABELS[savingStep]}
          </button>
        </div>
      </div>
    </div>
  );
}
