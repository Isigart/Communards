'use client';

import { useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';

export default function Home() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

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

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-brand-600">Communard</h1>
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
