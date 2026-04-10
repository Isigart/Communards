'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase';

export default function Home() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const supabase = createBrowserClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        // Check if establishment exists
        const res = await fetch('/api/establishment', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          window.location.href = '/dashboard';
        } else {
          window.location.href = '/onboarding';
        }
      } else {
        setChecking(false);
      }
    });
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const supabase = createBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    });
    setLoading(false);
    if (!error) setSent(true);
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-400">Chargement...</p>
      </div>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-brand-600">La Table de l&apos;Equipe</h1>
          <p className="mt-2 text-gray-600">Le repas du personnel, organise.</p>
        </div>

        {sent ? (
          <div className="card text-center">
            <p className="text-green-700 font-medium">Lien de connexion envoye !</p>
            <p className="text-sm text-gray-500 mt-1">Verifiez votre boite mail.</p>
          </div>
        ) : (
          <form onSubmit={handleLogin} className="card space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input mt-1"
                placeholder="chef@restaurant.fr"
                required
              />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? 'Envoi...' : 'Se connecter'}
            </button>
          </form>
        )}

        <p className="text-center text-xs text-gray-400">
          Premiere connexion ? Un compte est cree automatiquement.
        </p>
      </div>
    </main>
  );
}
