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
        <p className="text-muted">On prepare le service...</p>
      </div>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="font-titre text-3xl text-noir">L&apos;Ordinaire</h1>
          <p className="mt-2 text-muted">Le repas du personnel, on s&apos;en occupe.</p>
        </div>

        {sent ? (
          <div className="card text-center">
            <p className="text-noir font-medium">C&apos;est envoye.</p>
            <p className="text-sm text-muted mt-1">Verifiez votre boite mail pour le lien de connexion.</p>
          </div>
        ) : (
          <form onSubmit={handleLogin} className="card space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm text-noir">
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
            <button type="submit" className="btn-rouge w-full" disabled={loading}>
              {loading ? 'envoi...' : 'se connecter →'}
            </button>
          </form>
        )}

        <p className="text-center text-xs text-muted">
          Premiere visite ? Un compte est cree automatiquement.
        </p>
      </div>
    </main>
  );
}
