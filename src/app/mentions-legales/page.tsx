export default function MentionsLegalesPage() {
  return (
    <div className="min-h-screen p-6 max-w-2xl mx-auto">
      <h1 className="font-titre text-2xl text-noir mb-6">Mentions legales</h1>

      <div className="space-y-6 text-sm text-noir leading-relaxed">
        <section>
          <h2 className="font-titre text-base text-noir mb-2">Editeur</h2>
          <p className="text-muted">L&apos;Ordinaire — Le repas du personnel, on s&apos;en occupe.</p>
          <p className="text-muted mt-1">Edite par Clement Puygauthier</p>
          <p className="text-muted mt-1">Email : clement.puygauthier@gmail.com</p>
        </section>

        <section>
          <h2 className="font-titre text-base text-noir mb-2">Hebergement</h2>
          <p className="text-muted">Vercel Inc. — 340 S Lemon Ave #4133, Walnut, CA 91789, Etats-Unis</p>
        </section>

        <section>
          <h2 className="font-titre text-base text-noir mb-2">Propriete intellectuelle</h2>
          <p className="text-muted">L&apos;ensemble des elements du site (textes, identite visuelle, code) est la propriete exclusive de l&apos;editeur. Toute reproduction sans autorisation est interdite.</p>
        </section>

        <section>
          <h2 className="font-titre text-base text-noir mb-2">Donnees personnelles</h2>
          <p className="text-muted">Voir la <a href="/confidentialite" className="text-rouge">politique de confidentialite</a>.</p>
        </section>
      </div>
    </div>
  );
}
