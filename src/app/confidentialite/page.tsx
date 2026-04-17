export default function ConfidentialitePage() {
  return (
    <div className="min-h-screen p-6 max-w-2xl mx-auto">
      <h1 className="font-titre text-2xl text-noir mb-6">Politique de confidentialite</h1>

      <div className="space-y-6 text-sm text-noir leading-relaxed">
        <section>
          <h2 className="font-titre text-base text-noir mb-2">Donnees collectees</h2>
          <p>L&apos;Ordinaire collecte uniquement ce qui est necessaire pour faire fonctionner le service :</p>
          <ul className="list-disc pl-5 mt-2 space-y-1 text-muted">
            <li>Adresse email (pour la connexion)</li>
            <li>Nom de l&apos;etablissement</li>
            <li>Nombre de personnes a nourrir</li>
            <li>Services (dejeuner, diner)</li>
            <li>Jours de commande fournisseur</li>
            <li>Contraintes alimentaires</li>
            <li>Suggestions de repas, notes du chef, taches de prep, feedback</li>
          </ul>
        </section>

        <section>
          <h2 className="font-titre text-base text-noir mb-2">Pourquoi ces donnees</h2>
          <p className="text-muted">Ces donnees servent uniquement a generer et organiser vos repas du personnel. Elles ne sont jamais vendues ni utilisees pour de la publicite.</p>
        </section>

        <section>
          <h2 className="font-titre text-base text-noir mb-2">Sous-traitants</h2>
          <p className="text-muted">L&apos;Ordinaire utilise des services tiers pour fonctionner :</p>
          <ul className="list-disc pl-5 mt-2 space-y-1 text-muted">
            <li><strong>Supabase</strong> (hebergement base de donnees, authentification) — Allemagne</li>
            <li><strong>Vercel</strong> (hebergement application) — Etats-Unis</li>
            <li><strong>Anthropic</strong> (Claude API, generation de suggestions) — Etats-Unis</li>
            <li><strong>Upstash</strong> (cache Redis) — Etats-Unis</li>
          </ul>
        </section>

        <section>
          <h2 className="font-titre text-base text-noir mb-2">Duree de conservation</h2>
          <p className="text-muted">Vos donnees sont conservees tant que votre compte est actif. Vous pouvez supprimer votre compte a tout moment depuis les reglages — toutes vos donnees sont alors effacees immediatement.</p>
        </section>

        <section>
          <h2 className="font-titre text-base text-noir mb-2">Vos droits</h2>
          <p className="text-muted">Conformement au RGPD, vous avez le droit d&apos;acceder, rectifier, supprimer ou exporter vos donnees. Pour toute demande, contactez-nous (voir <a href="/mentions-legales" className="text-rouge">mentions legales</a>).</p>
        </section>

        <section>
          <h2 className="font-titre text-base text-noir mb-2">Cookies</h2>
          <p className="text-muted">L&apos;Ordinaire ne depose aucun cookie de tracking ou publicitaire. Seuls les jetons d&apos;authentification (necessaires au fonctionnement) sont stockes localement dans votre navigateur.</p>
        </section>
      </div>
    </div>
  );
}
