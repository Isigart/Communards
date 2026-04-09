'use client';

import { useState } from 'react';

const SECTIONS = ['profil', 'quotidien', 'galeres', 'vision'] as const;

export default function EnquetePage() {
  const [current, setCurrent] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({
    role: '', taille: '', type: '',
    qui: '', orga: '', budget: '', clash: '',
    galere: [], outil: [], cherche: '',
    vision: '', prix: '', autre: '',
  });

  const setAnswer = (key: string, value: string | string[]) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  };

  const toggleChip = (key: string, value: string, multi: boolean) => {
    if (multi) {
      const arr = (answers[key] as string[]) || [];
      const next = arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
      setAnswer(key, next);
    } else {
      setAnswer(key, value);
    }
  };

  const isSelected = (key: string, value: string) => {
    const v = answers[key];
    if (Array.isArray(v)) return v.includes(value);
    return v === value;
  };

  const next = () => {
    if (current < SECTIONS.length - 1) {
      setCurrent(current + 1);
      window.scrollTo(0, 0);
    } else {
      submit();
    }
  };

  const prev = () => {
    if (current > 0) {
      setCurrent(current - 1);
      window.scrollTo(0, 0);
    }
  };

  const submit = async () => {
    setSubmitted(true);
    window.scrollTo(0, 0);
    try {
      await fetch('https://formspree.io/f/meepbjqa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(answers),
      });
    } catch (err) {
      console.error('Erreur envoi:', err);
    }
  };

  const Chips = ({ name, multi = false, options }: { name: string; multi?: boolean; options: { value: string; label: string }[] }) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => toggleChip(name, opt.value, multi)}
          style={{
            padding: '8px 14px',
            border: isSelected(name, opt.value) ? '1.5px solid #E07B2A' : '1.5px solid #E8DDD0',
            borderRadius: 100,
            fontSize: 13,
            fontWeight: isSelected(name, opt.value) ? 500 : 400,
            color: isSelected(name, opt.value) ? 'white' : '#6B5A42',
            background: isSelected(name, opt.value) ? '#E07B2A' : 'white',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );

  const progress = (current / SECTIONS.length) * 100;

  if (submitted) {
    const summaryItems = [
      { key: 'role', label: 'Role' },
      { key: 'taille', label: 'Etablissement' },
      { key: 'orga', label: 'Organisation' },
      { key: 'galere', label: 'Principale galere' },
      { key: 'prix', label: 'Budget mensuel acceptable' },
      { key: 'vision', label: 'Ce que ca ressemblerait' },
    ];

    return (
      <div style={{ fontFamily: "'DM Sans', sans-serif", background: '#FAF6F1', minHeight: '100vh' }}>
        <div style={{ background: '#E07B2A', padding: '32px 24px 28px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>Enquete — Terminee</div>
          <h1 style={{ fontSize: 26, color: 'white', lineHeight: 1.2, margin: 0 }}>Merci !</h1>
          <div style={{ height: 3, background: 'rgba(255,255,255,0.2)', marginTop: 20, borderRadius: 2 }}>
            <div style={{ height: '100%', background: 'white', borderRadius: 2, width: '100%' }} />
          </div>
        </div>
        <div style={{ maxWidth: 480, margin: '0 auto', padding: '60px 16px', textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, background: '#FFF5EB', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', fontSize: 28 }}>🙏</div>
          <h2 style={{ fontSize: 24, marginBottom: 12, color: '#1A1208' }}>Merci, vraiment.</h2>
          <p style={{ fontSize: 15, color: '#6B5A42', lineHeight: 1.6 }}>Tes reponses sont precieuses. Tu m&apos;as donne 10 minutes de ton temps — c&apos;est exactement ce dont j&apos;avais besoin.</p>

          <div style={{ marginTop: 32, textAlign: 'left', background: 'white', border: '1.5px solid #E8DDD0', borderRadius: 16, padding: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#E07B2A', marginBottom: 16 }}>Tes reponses</div>
            {summaryItems.map(({ key, label }) => {
              const val = answers[key];
              if (!val || (Array.isArray(val) && val.length === 0)) return null;
              const display = Array.isArray(val) ? val.join(', ') : val;
              return (
                <div key={key} style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, color: '#6B5A42', marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#1A1208' }}>{display}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: '#FAF6F1', minHeight: '100vh', paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ background: '#E07B2A', padding: '32px 24px 28px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>Enquete — 10 minutes</div>
        <h1 style={{ fontSize: 26, color: 'white', lineHeight: 1.2, marginBottom: 12 }}>Le repas du personnel, c&apos;est quoi chez toi ?</h1>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5, fontWeight: 300, margin: 0 }}>Pas de pitch, pas de vente. Juste des vraies questions sur le quotidien en cuisine.</p>
        <div style={{ height: 3, background: 'rgba(255,255,255,0.2)', marginTop: 20, borderRadius: 2 }}>
          <div style={{ height: '100%', background: 'white', borderRadius: 2, width: `${progress}%`, transition: 'width 0.4s ease' }} />
        </div>
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 16px' }}>
        {/* Section 0: Profil */}
        {current === 0 && (
          <div>
            <div style={{ padding: '28px 0 4px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#E07B2A', marginBottom: 6 }}>01 — Profil</div>
              <div style={{ fontSize: 20, color: '#1A1208', lineHeight: 1.3, fontWeight: 600 }}>Qui t&apos;es dans ce metier ?</div>
            </div>
            <div style={{ marginTop: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 10 }}>Ton role <span style={{ color: '#E07B2A' }}>*</span></div>
              <Chips name="role" options={[
                { value: 'chef', label: 'Chef' }, { value: 'cuisinier', label: 'Cuisinier' },
                { value: 'patron', label: 'Patron / Gerant' }, { value: 'patissier', label: 'Patissier' },
                { value: 'salle', label: 'Salle' }, { value: 'autre', label: 'Autre' },
              ]} />
            </div>
            <div style={{ marginTop: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 10 }}>Taille de l&apos;etablissement <span style={{ color: '#E07B2A' }}>*</span></div>
              <Chips name="taille" options={[
                { value: '1-5', label: '1-5 pers.' }, { value: '6-15', label: '6-15 pers.' },
                { value: '16-40', label: '16-40 pers.' }, { value: '+40', label: '+40 pers.' },
              ]} />
            </div>
            <div style={{ marginTop: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 10 }}>Type d&apos;etablissement</div>
              <Chips name="type" options={[
                { value: 'brasserie', label: 'Brasserie' }, { value: 'gastro', label: 'Gastro' },
                { value: 'hotel', label: 'Hotel-resto' }, { value: 'collectivite', label: 'Collectivite' },
                { value: 'autre', label: 'Autre' },
              ]} />
            </div>
          </div>
        )}

        {/* Section 1: Quotidien */}
        {current === 1 && (
          <div>
            <div style={{ padding: '28px 0 4px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#E07B2A', marginBottom: 6 }}>02 — Quotidien</div>
              <div style={{ fontSize: 20, color: '#1A1208', lineHeight: 1.3, fontWeight: 600 }}>Comment ca se passe concretement ?</div>
            </div>
            <div style={{ marginTop: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 10 }}>Qui s&apos;occupe du repas du personnel ? <span style={{ color: '#E07B2A' }}>*</span></div>
              <Chips name="qui" options={[
                { value: 'chef', label: 'Le chef' }, { value: 'cuisinier', label: 'Un cuisinier' },
                { value: 'tourne', label: 'Ca tourne' }, { value: 'personne', label: 'Personne vraiment' },
              ]} />
            </div>
            <div style={{ marginTop: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 10 }}>Comment c&apos;est organise ? <span style={{ color: '#E07B2A' }}>*</span></div>
              <Chips name="orga" options={[
                { value: 'improvise', label: 'Improvise au dernier moment' }, { value: 'planifie', label: 'Planifie a l\'avance' },
                { value: 'restes', label: 'On mange les restes' }, { value: 'depend', label: 'Ca depend des jours' },
              ]} />
            </div>
            <div style={{ marginTop: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 10 }}>Le budget repas du perso est suivi comment ?</div>
              <Chips name="budget" options={[
                { value: 'precis', label: 'Precisement' }, { value: 'vague', label: 'Vaguement' },
                { value: 'jamais', label: 'Jamais' }, { value: 'sais-pas', label: 'Je sais pas' },
              ]} />
            </div>
            <div style={{ marginTop: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 10 }}>T&apos;as deja eu un clash autour du repas du perso ?</div>
              <textarea
                rows={3}
                value={answers.clash as string}
                onChange={(e) => setAnswer('clash', e.target.value)}
                placeholder="Budget, repetitivite, qui decide, qualite..."
                style={{ width: '100%', padding: 14, border: '1.5px solid #E8DDD0', borderRadius: 12, fontSize: 14, fontFamily: 'inherit', resize: 'none', outline: 'none', lineHeight: 1.5 }}
              />
            </div>
          </div>
        )}

        {/* Section 2: Galeres */}
        {current === 2 && (
          <div>
            <div style={{ padding: '28px 0 4px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#E07B2A', marginBottom: 6 }}>03 — Les galeres</div>
              <div style={{ fontSize: 20, color: '#1A1208', lineHeight: 1.3, fontWeight: 600 }}>Ce qui coince vraiment.</div>
            </div>
            <div style={{ marginTop: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 10 }}>C&apos;est quoi la principale prise de tete ? <span style={{ color: '#E07B2A' }}>*</span></div>
              <Chips name="galere" multi options={[
                { value: 'temps', label: 'Manque de temps' }, { value: 'budget', label: 'Budget pas clair' },
                { value: 'repetitif', label: 'C\'est repetitif' }, { value: 'stock', label: 'Pas de stock adapte' },
                { value: 'motivation', label: 'Pas motivant a cuisiner' }, { value: 'decision', label: 'Qui decide ?' },
                { value: 'rien', label: 'Pas de probleme' },
              ]} />
            </div>
            <div style={{ marginTop: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 10 }}>Vous utilisez quoi pour vous organiser ?</div>
              <Chips name="outil" multi options={[
                { value: 'whatsapp', label: 'WhatsApp' }, { value: 'cahier', label: 'Cahier / papier' },
                { value: 'tete', label: 'De tete' }, { value: 'tableau', label: 'Tableau blanc' },
                { value: 'rien', label: 'Rien' }, { value: 'autre', label: 'Autre' },
              ]} />
            </div>
            <div style={{ marginTop: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 10 }}>T&apos;as deja cherche un outil pour ca ?</div>
              <Chips name="cherche" options={[
                { value: 'oui', label: 'Oui' }, { value: 'non', label: 'Non' },
                { value: 'pas-pense', label: 'Meme pas pense a chercher' },
              ]} />
            </div>
          </div>
        )}

        {/* Section 3: Vision */}
        {current === 3 && (
          <div>
            <div style={{ padding: '28px 0 4px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#E07B2A', marginBottom: 6 }}>04 — Ta vision</div>
              <div style={{ fontSize: 20, color: '#1A1208', lineHeight: 1.3, fontWeight: 600 }}>Si ca existait vraiment.</div>
            </div>
            <div style={{ marginTop: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 10 }}>Si quelqu&apos;un reglait ce probleme proprement, ca ressemblerait a quoi pour toi ? <span style={{ color: '#E07B2A' }}>*</span></div>
              <textarea
                rows={5}
                value={answers.vision as string}
                onChange={(e) => setAnswer('vision', e.target.value)}
                placeholder="Decris avec tes mots, sans filtre..."
                style={{ width: '100%', padding: 14, border: '1.5px solid #E8DDD0', borderRadius: 12, fontSize: 14, fontFamily: 'inherit', resize: 'none', outline: 'none', lineHeight: 1.5 }}
              />
            </div>
            <div style={{ marginTop: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 10 }}>Combien tu paierais par mois pour ca ?</div>
              <Chips name="prix" options={[
                { value: '0', label: 'Rien, jamais' }, { value: '10-20', label: '10-20 €' },
                { value: '20-50', label: '20-50 €' }, { value: '50+', label: '+50 €' },
                { value: 'depends', label: 'Ca depend de ce que ca fait' },
              ]} />
            </div>
            <div style={{ marginTop: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 10 }}>Autre chose a ajouter ?</div>
              <textarea
                rows={3}
                value={answers.autre as string}
                onChange={(e) => setAnswer('autre', e.target.value)}
                placeholder="Tout ce qui n'a pas ete couvert..."
                style={{ width: '100%', padding: 14, border: '1.5px solid #E8DDD0', borderRadius: 12, fontSize: 14, fontFamily: 'inherit', resize: 'none', outline: 'none', lineHeight: 1.5 }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'white', borderTop: '1px solid #E8DDD0', padding: '12px 16px', zIndex: 100 }}>
        <div style={{ maxWidth: 480, margin: '0 auto', display: 'flex', gap: 10 }}>
          {current > 0 && (
            <button onClick={prev} style={{ padding: '14px 20px', border: '1.5px solid #E8DDD0', borderRadius: 12, background: 'transparent', fontSize: 14, fontWeight: 500, color: '#6B5A42', cursor: 'pointer', fontFamily: 'inherit' }}>
              ←
            </button>
          )}
          <button onClick={next} style={{ flex: 1, padding: 14, background: '#E07B2A', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, color: 'white', cursor: 'pointer', fontFamily: 'inherit' }}>
            {current === SECTIONS.length - 1 ? 'Envoyer ✓' : 'Continuer →'}
          </button>
        </div>
      </div>
    </div>
  );
}
