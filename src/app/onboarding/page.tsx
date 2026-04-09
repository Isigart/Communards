'use client';

import { useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import type { Market } from '@/lib/types';
import { MARKET_CONFIG } from '@/lib/types';

interface FormData {
  name: string;
  employee_count: number;
  budget_per_meal: number;
  market: Market;
  supplier_name: string;
  delivery_days: number[];
}

const DAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<FormData>({
    name: '',
    employee_count: 10,
    budget_per_meal: 3.5,
    market: 'fr',
    supplier_name: 'Metro',
    delivery_days: [1, 4],
  });

  const toggleDay = (day: number) => {
    setForm((prev) => ({
      ...prev,
      delivery_days: prev.delivery_days.includes(day)
        ? prev.delivery_days.filter((d) => d !== day)
        : [...prev.delivery_days, day].sort((a, b) => a - b),
    }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    const supabase = createBrowserClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const res = await fetch('/api/establishment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(form),
    });

    if (res.ok) {
      window.location.href = '/dashboard';
    }
    setLoading(false);
  };

  const steps = [
    // Step 0: Establishment name
    <div key="name" className="space-y-4">
      <h2 className="text-lg font-semibold">Votre etablissement</h2>
      <input
        className="input"
        placeholder="Nom du restaurant"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
      />
      <button className="btn-primary w-full" onClick={() => setStep(1)} disabled={!form.name}>
        Suivant
      </button>
    </div>,

    // Step 1: Team size + budget
    <div key="team" className="space-y-4">
      <h2 className="text-lg font-semibold">Equipe & budget</h2>
      <div>
        <label className="block text-sm text-gray-600">Nombre d&apos;employes</label>
        <input
          type="number"
          className="input mt-1"
          value={form.employee_count}
          onChange={(e) => setForm({ ...form, employee_count: parseInt(e.target.value) || 1 })}
          min={1}
          max={100}
        />
      </div>
      <div>
        <label className="block text-sm text-gray-600">
          Budget par repas ({MARKET_CONFIG[form.market].currency})
        </label>
        <input
          type="number"
          className="input mt-1"
          value={form.budget_per_meal}
          onChange={(e) => setForm({ ...form, budget_per_meal: parseFloat(e.target.value) || 0 })}
          step={0.5}
          min={0}
        />
      </div>
      <div className="flex gap-2">
        <button className="btn-secondary flex-1" onClick={() => setStep(0)}>Retour</button>
        <button className="btn-primary flex-1" onClick={() => setStep(2)}>Suivant</button>
      </div>
    </div>,

    // Step 2: Market
    <div key="market" className="space-y-4">
      <h2 className="text-lg font-semibold">Marche</h2>
      <div className="grid grid-cols-2 gap-2">
        {(Object.keys(MARKET_CONFIG) as Market[]).map((m) => (
          <button
            key={m}
            className={`p-3 rounded-lg border text-left ${
              form.market === m ? 'border-brand-500 bg-brand-50' : 'border-gray-200'
            }`}
            onClick={() => setForm({ ...form, market: m })}
          >
            <span className="font-medium">{m.toUpperCase()}</span>
            <span className="block text-xs text-gray-500">{MARKET_CONFIG[m].supplier_ref}</span>
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <button className="btn-secondary flex-1" onClick={() => setStep(1)}>Retour</button>
        <button className="btn-primary flex-1" onClick={() => setStep(3)}>Suivant</button>
      </div>
    </div>,

    // Step 3: Supplier + delivery days
    <div key="supplier" className="space-y-4">
      <h2 className="text-lg font-semibold">Fournisseur principal</h2>
      <input
        className="input"
        placeholder="Nom du fournisseur"
        value={form.supplier_name}
        onChange={(e) => setForm({ ...form, supplier_name: e.target.value })}
      />
      <div>
        <label className="block text-sm text-gray-600 mb-2">Jours de livraison</label>
        <div className="flex gap-1">
          {DAY_LABELS.map((label, i) => (
            <button
              key={i}
              className={`flex-1 py-2 text-sm rounded-lg ${
                form.delivery_days.includes(i)
                  ? 'bg-brand-500 text-white'
                  : 'bg-gray-100 text-gray-500'
              }`}
              onClick={() => toggleDay(i)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <button className="btn-secondary flex-1" onClick={() => setStep(2)}>Retour</button>
        <button
          className="btn-primary flex-1"
          onClick={handleSubmit}
          disabled={loading || form.delivery_days.length === 0}
        >
          {loading ? 'Creation...' : 'Terminer'}
        </button>
      </div>
    </div>,
  ];

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-brand-600">Configuration</h1>
          <p className="text-sm text-gray-500 mt-1">Etape {step + 1} / 4 — 5 minutes</p>
          <div className="flex gap-1 mt-3">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`flex-1 h-1 rounded ${i <= step ? 'bg-brand-500' : 'bg-gray-200'}`}
              />
            ))}
          </div>
        </div>
        {steps[step]}
      </div>
    </main>
  );
}
