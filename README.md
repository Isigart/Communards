# Communard — The staff meal app

Chaque jour, des combinaisons d'ingredients pour le repas du personnel.
Calees sur vos livraisons. Dans votre budget. Variees.

**Vous cuisinez. On organise.**

## Le probleme

Dans les petites et moyennes structures CHR (5-40 employes), le repas du personnel est improvise, repetitif, source de tensions, et cout mal maitrise. Le chef a le savoir-faire. Il n'a pas le temps de s'en occuper correctement.

## La philosophie

Communard ne propose pas des recettes — il propose des **combinaisons d'ingredients**. Le chef fait ce qu'il veut avec. L'IA organise, elle n'enseigne pas.

## Ce que Communard fait — V1

Quatre choses. Pas une de plus.

| Fonction | Description |
|----------|-------------|
| **Suggestions de repas** | Combinaisons d'ingredients calees sur les livraisons fournisseur |
| **Alerte fournisseur + liste** | Notification le jour de commande avec la liste indicative |
| **Feedback IA** | Fait / Modifie / Pas fait → l'IA apprend |
| **Dashboard budget** | Vue simple : budget vs estime |

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Frontend | Next.js 14 + Tailwind CSS (PWA mobile-first) |
| Backend | Next.js API Routes + TypeScript |
| DB | PostgreSQL (Supabase) |
| Cache | Upstash Redis |
| Auth | Supabase Auth |
| IA | Claude API (suggestions d'ingredients) |
| Paiements | Stripe |
| Hebergement | Vercel |

## Architecture

```
┌─────────────────┐     ┌──────────────────────┐
│  PWA Mobile     │────▶│  Next.js API Routes  │
│  (cuisine)      │◀────│  /api/*              │
└─────────────────┘     └──────┬───────────────┘
                               │
                    ┌──────────┼──────────┐
                    ▼          ▼          ▼
              ┌──────────┐ ┌───────┐ ┌────────┐
              │ Supabase │ │ Redis │ │ Claude │
              │ (PG+Auth)│ │(cache)│ │  (IA)  │
              └──────────┘ └───────┘ └────────┘
```

## Concept cle : Supply Spans

Les suggestions ne suivent pas la semaine calendaire. Elles suivent le rythme des livraisons fournisseur.

```
Metro livre Lundi + Jeudi :
  Span 1: Lun → Mer (3 jours, 6 repas)
  Span 2: Jeu → Dim (4 jours, 8 repas)
```

Chaque span = suggestions + liste de courses pour cette periode.

## Structure

```
src/
├── app/
│   ├── api/
│   │   ├── suggestions/      # Generation + recuperation
│   │   ├── feedback/         # Feedback sur les repas
│   │   ├── establishment/    # Config etablissement
│   │   ├── suppliers/        # CRUD fournisseurs
│   │   └── brief/            # Code de partage briefing
│   ├── dashboard/            # Vue principale
│   ├── onboarding/           # Config initiale (5 min)
│   ├── planning/             # Outil d'organisation du chef
│   │   └── print/            # Version imprimable A4
│   └── brief/[code]/         # Ecran briefing equipe (public)
├── lib/
│   ├── supabase.ts           # Client DB
│   ├── redis.ts              # Cache
│   ├── auth.ts               # Middleware JWT
│   ├── claude.ts             # Generation suggestions
│   ├── spans.ts              # Calcul des spans fournisseur
│   └── types.ts              # Types TypeScript
supabase/
└── schema.sql                # Schema PostgreSQL + RLS
```

## Variables d'environnement

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
ANTHROPIC_API_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Demarrage

```bash
npm install
cp .env.example .env.local
# Remplir les variables
# Supabase SQL Editor → coller supabase/schema.sql
npm run dev
# http://localhost:3000
```

## Marches

Code global, donnees locales. Une variable `market` adapte tout :

| Marche | Fournisseur ref | Devise | Langue |
|--------|----------------|--------|--------|
| fr | Metro France | EUR | fr |
| uk | Brakes UK | GBP | en |
| us | Sysco US | USD | en |
| au | Bidfood AU | AUD | en |
| ca | Sysco CA | CAD | en |

---

**Communard** — Cree par quelqu'un qui a nourri des brigades.
Fait avec passion en Dordogne.
