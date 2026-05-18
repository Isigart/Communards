-- ============================================================
-- BASE INGREDIENTS — catalogue canonique (200 = 50 par catégorie)
-- ============================================================
-- 1 ligne = 1 ingrédient "standard" (ex: "Haricots verts").
-- Les variantes Metro (HARICOTS VERTS EXTRA FINS, TRES FINS, ...)
-- sont stockées dans le tableau `aliases`.
-- Source de vérité pour Claude lors de la génération des repas.

create table if not exists public.base_ingredients (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  category text not null check (category in ('proteine','feculent','legume','dessert')),
  saison text[] not null default '{toutes}',
  qty_per_person_kg numeric(5,3) not null,
  price_per_kg_ht numeric(6,2),
  contains_porc boolean not null default false,
  contains_gluten boolean not null default false,
  contains_lactose boolean not null default false,
  is_vegetarien boolean not null default false,
  halal_compatible boolean not null default true,
  aliases text[] not null default '{}',
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_base_ingredients_category on public.base_ingredients(category);
create index if not exists idx_base_ingredients_active on public.base_ingredients(active);

alter table public.base_ingredients enable row level security;

-- Lecture pour tout user authentifié (catalogue partagé entre établissements)
drop policy if exists "Anyone authenticated can read base_ingredients" on public.base_ingredients;
create policy "Anyone authenticated can read base_ingredients"
  on public.base_ingredients for select
  to authenticated
  using (true);

-- Écriture : uniquement via service_role (admin)
drop policy if exists "Service role can manage base_ingredients" on public.base_ingredients;
create policy "Service role can manage base_ingredients"
  on public.base_ingredients for all
  to service_role
  using (true)
  with check (true);

-- ============================================================
-- SEED
-- ============================================================
-- Colonnes : name, category, saison, qty/pers, prix HT/kg,
--           porc, gluten, lactose, vege, halal, aliases, notes

insert into public.base_ingredients
  (name, category, saison, qty_per_person_kg, price_per_kg_ht,
   contains_porc, contains_gluten, contains_lactose, is_vegetarien, halal_compatible, aliases, notes)
values
-- ============================================================
-- PROTÉINES (50)
-- ============================================================
-- Œufs / produits laitiers cuisinés
('Œufs coquille',                 'proteine', '{toutes}', 0.130, 7.30,  false, false, false, true,  true,  '{"OEUF coquille plein air M(53-63g) France les","OEUF dur écalé"}', null),
('Œufs liquides entiers',         'proteine', '{toutes}', 0.150, 8.80,  false, false, false, true,  true,  '{"OEUF liquide entier France"}', null),
('Omelette nature',               'proteine', '{toutes}', 0.150, 14.00, false, false, true,  true,  true,  '{"OMELETTE fraîche nature poules au sol ou plein air","OMELETTE fraîche nature biologique"}', null),
-- Bœuf
('Steak haché 15% MG',            'proteine', '{toutes}', 0.150, 22.00, false, false, false, false, true,  '{"STEAKS HACHES 15% MATIERE GRASSE UE"}', null),
('Boule de bœuf 51% VBF',         'proteine', '{toutes}', 0.150, 15.30, false, false, false, false, true,  '{"BOULE DE BOEUF 51% MINIMUM DE VIANDE HACHEE 15% MG UE"}', null),
('Boule de veau 70% VBF',         'proteine', '{toutes}', 0.150, 15.90, false, false, false, false, true,  '{"BOULE DE VEAU 70% MINIMUM DE VIANDE HACHEE 15% MG UE"}', null),
('Bourguignon sans os',           'proteine', '{automne,hiver}', 0.180, 17.80, false, false, false, false, true,  '{"ASSORTIMENT POUR BOURGUIGNON SANS OS COUPE COUTEAU","ASSORTIMENT POUR BOURGUIGNON SANS OS  COUPE COUTEAU"}', null),
('Émincé de bœuf',                'proteine', '{toutes}', 0.150, 18.50, false, false, false, false, true,  '{}', null),
('Rôti de bœuf',                  'proteine', '{toutes}', 0.150, 22.00, false, false, false, false, true,  '{}', null),
-- Porc
('Rôti de porc échine',           'proteine', '{toutes}', 0.140, 12.60, true,  false, false, false, false, '{"ROTI DE PORC ECHINE"}', null),
('Sauté de porc',                 'proteine', '{toutes}', 0.150, 12.60, true,  false, false, false, false, '{"SAUTE DE PORC SANS OS SCIE"}', null),
('Côtes de porc échine',          'proteine', '{toutes}', 0.150, 10.50, true,  false, false, false, false, '{}', null),
('Filet mignon de porc',          'proteine', '{toutes}', 0.140, 18.00, true,  false, false, false, false, '{}', null),
('Saucisses de Toulouse',         'proteine', '{toutes}', 0.150, 12.50, true,  false, false, false, false, '{}', null),
('Chipolatas',                    'proteine', '{toutes}', 0.150, 11.00, true,  false, false, false, false, '{}', null),
('Jambon blanc',                  'proteine', '{toutes}', 0.100, 14.00, true,  false, false, false, false, '{}', null),
-- Volaille
('Cuisses de poulet',             'proteine', '{toutes}', 0.180, 6.80,  false, false, false, false, true,  '{"CUISSES DE POULET 180/220gr ou 220/260gr DEUX LAMES APD UE","CUISSES DE POULET 180/220gr ou 220/260gr UNE LAME APD UE","CUISSES DE POULET 180/220gr,  DEJOINTEES UE"}', null),
('Hauts de cuisse de poulet',     'proteine', '{toutes}', 0.160, 9.00,  false, false, false, false, true,  '{"HAUTS DE CUISSE DE POULET 120/180gr UE","Hauts de cuisse de poulet 120/180gr UE"}', null),
('Filets de poulet',              'proteine', '{toutes}', 0.150, 14.80, false, false, false, false, true,  '{"FILETS OU BLANCS DE POULETS A SEC UE"}', null),
('Sauté de poulet',               'proteine', '{toutes}', 0.160, 13.40, false, false, false, false, true,  '{"SAUTE DE POULET A SEC COUPE COUTEAU UE"}', null),
('Pilons de poulet',              'proteine', '{toutes}', 0.180, 8.80,  false, false, false, false, true,  '{"PILONS DE POULET A SEC UE"}', null),
('Ailes de poulet marinées',      'proteine', '{ete}',    0.170, 13.00, false, false, false, false, true,  '{"AILES DE POULET CUITES MARINEES (WINGS)"}', null),
-- Dindonneau
('Sauté de dindonneau',           'proteine', '{toutes}', 0.150, 14.70, false, false, false, false, true,  '{"SAUTE DE DINDONNEAU SANS OS, SANS PEAU, A SEC, COUPE COUTEAU UE"}', null),
('Rôti de dindonneau',            'proteine', '{toutes}', 0.150, 12.60, false, false, false, false, true,  '{"ROTI DE DINDONNEAU A SEC 50/50 UE"}', null),
('Brochettes de dindonneau',      'proteine', '{ete}',    0.165, 14.65, false, false, false, false, true,  '{"BROCHETTES DE DINDONNEAU NATURES  UE"}', null),
('Paupiettes de dindonneau',      'proteine', '{toutes}', 0.170, 11.40, false, false, false, false, true,  '{"PAUPIETTES DE DINDONNEAU  UE"}', null),
-- Canard / pintade / lapin
('Cuisses de canard',             'proteine', '{automne,hiver}', 0.175, 11.50, false, false, false, false, true,  '{"CUISSES DE CANARD  UE"}', null),
('Sauté de canard',               'proteine', '{toutes}', 0.155, 15.80, false, false, false, false, true,  '{"SAUTE DE CANARD COUPE COUTEAU FRANCE"}', null),
('Cuisses de pintade',            'proteine', '{automne,hiver}', 0.180, 12.40, false, false, false, false, true,  '{"CUISSES DE PINTADE FRANCE"}', null),
('Pintade à rôtir',               'proteine', '{automne,hiver}', 0.170, 11.65, false, false, false, false, true,  '{"PINTADE  A ROTIR PAC CLASSE A, A SEC  FRANCE"}', null),
('Cuisses de lapin',              'proteine', '{toutes}', 0.180, 16.80, false, false, false, false, true,  '{"CUISSES DE LAPINS FRANCE"}', null),
('Sauté de lapin',                'proteine', '{toutes}', 0.165, 13.70, false, false, false, false, true,  '{"SAUTE DE LAPIN DE CHINE COUPE COUTEAU"}', null),
-- Poissons
('Maquereau',                     'proteine', '{printemps,ete}', 0.150, 6.50,  false, false, false, false, true,  '{"MAQUEREAU de ligne France : le kg","MAQUEREAU de chalut moyen France : le kg"}', null),
('Sardines fraîches',             'proteine', '{ete}',    0.150, 7.50,  false, false, false, false, true,  '{}', null),
('Filets de merlu blanc',         'proteine', '{toutes}', 0.155, 12.10, false, false, false, false, true,  '{"FILETS DE MERLU BLANC"}', null),
('Filets de colin d''Alaska',     'proteine', '{toutes}', 0.150, 11.00, false, false, false, false, true,  '{"FILETS DECOUPES CALIBRES DE COLIN D''ALASKA","FILETS DE COLIN D'' ALASKA","PORTIONS NATURE CRUES DE FILETS DE COLIN D''ALASKA SANS ARETE","FILETS DE COLIN (LIEU )"}', null),
('Dos de colin d''Alaska',        'proteine', '{toutes}', 0.150, 14.00, false, false, false, false, true,  '{"DOS DE COLIN D''ALASKA","DOS DE COLIN LIEU SIMPLE CONGELATION"}', null),
('Dos de cabillaud',              'proteine', '{toutes}', 0.150, 24.70, false, false, false, false, true,  '{"DOS DE CABILLAUD"}', null),
('Filet de saumon',               'proteine', '{toutes}', 0.130, 23.60, false, false, false, false, true,  '{"FILET DE SAUMON SALMO SALAR"}', null),
('Lieu noir',                     'proteine', '{toutes}', 0.150, 8.40,  false, false, false, false, true,  '{"LIEU noir"}', null),
('Paupiettes de poisson blanc',   'proteine', '{toutes}', 0.160, 10.80, false, false, false, false, true,  '{"PAUPIETTE DE POISSON BLANC"}', null),
('Cubes de poisson blanc',        'proteine', '{toutes}', 0.150, 11.80, false, false, false, false, true,  '{"CUBES DE POISSON BLANC CRUS SANS ARETES"}', null),
('Filet de poisson meunière',     'proteine', '{toutes}', 0.130, 16.00, false, true,  false, false, true,  '{"FILET DE POISSON BLANC MEUNIERE"}', null),
-- Plats viande/poisson
('Lasagnes de saumon',            'proteine', '{toutes}', 0.180, 7.90,  false, true,  true,  false, true,  '{"LASAGNES DE SAUMON"}', null),
('Lasagnes bolognaises VBF',      'proteine', '{toutes}', 0.180, 9.70,  false, true,  true,  false, true,  '{"LASAGNES BOLOGNAISES VBF"}', null),
-- Volaille panée / vege
('Nuggets de volaille',           'proteine', '{toutes}', 0.150, 9.20,  false, true,  false, false, true,  '{"NUGGETS (beignets) DE VOLAILLE UE"}', null),
('Nuggets végétal',               'proteine', '{toutes}', 0.150, 12.50, false, true,  false, true,  true,  '{"NUGGETS VEGETAL"}', null),
('Égrené végétal nature',         'proteine', '{toutes}', 0.110, 14.60, false, false, false, true,  true,  '{"EGRENE VEGETAL NATURE"}', null),
('Tofu nature',                   'proteine', '{toutes}', 0.120, 9.50,  false, false, false, true,  true,  '{}', null),
('Galette céréales-légumineuses', 'proteine', '{toutes}', 0.130, 10.00, false, true,  false, true,  true,  '{}', null),

-- ============================================================
-- FÉCULENTS (50)
-- ============================================================
-- Riz
('Riz long',                          'feculent', '{toutes}', 0.090, 2.80, false, false, false, true, true, '{"Riz long indica étuve"}', null),
('Riz basmati',                       'feculent', '{toutes}', 0.090, 3.20, false, false, false, true, true, '{}', null),
('Riz thaï',                          'feculent', '{toutes}', 0.090, 3.50, false, false, false, true, true, '{}', null),
('Riz complet',                       'feculent', '{toutes}', 0.090, 3.80, false, false, false, true, true, '{}', null),
('Riz arborio',                       'feculent', '{toutes}', 0.090, 4.50, false, false, false, true, true, '{}', null),
('Riz sauvage',                       'feculent', '{toutes}', 0.090, 8.00, false, false, false, true, true, '{}', null),
-- Pâtes (gluten +)
('Coquillettes',                      'feculent', '{toutes}', 0.090, 2.30, false, true,  false, true, true, '{"Coquillette Qualité Supérieure","Coquillette Bio"}', null),
('Penne',                             'feculent', '{toutes}', 0.090, 2.50, false, true,  false, true, true, '{}', null),
('Tagliatelles',                      'feculent', '{toutes}', 0.090, 2.80, false, true,  false, true, true, '{}', null),
('Fusilli',                           'feculent', '{toutes}', 0.090, 2.50, false, true,  false, true, true, '{}', null),
('Farfalle',                          'feculent', '{toutes}', 0.090, 2.50, false, true,  false, true, true, '{}', null),
('Spaghetti',                         'feculent', '{toutes}', 0.090, 2.40, false, true,  false, true, true, '{}', null),
('Macaronis',                         'feculent', '{toutes}', 0.090, 2.30, false, true,  false, true, true, '{}', null),
('Plaques de lasagnes',               'feculent', '{toutes}', 0.110, 3.00, false, true,  false, true, true, '{}', null),
('Gnocchis',                          'feculent', '{toutes}', 0.150, 4.20, false, true,  true,  true, true, '{}', null),
-- Pommes de terre / tubercules
('Pommes de terre Charlotte',         'feculent', '{toutes}', 0.200, 1.50, false, false, false, true, true, '{"Pomme de terre Charlotte"}', null),
('Pommes de terre grenaille',         'feculent', '{toutes}', 0.200, 2.20, false, false, false, true, true, '{}', null),
('Pommes de terre Ratte',             'feculent', '{toutes}', 0.200, 3.50, false, false, false, true, true, '{}', null),
('Pommes de terre Bintje',            'feculent', '{toutes}', 0.200, 1.40, false, false, false, true, true, '{}', null),
('Patate douce',                      'feculent', '{automne,hiver}', 0.180, 2.50, false, false, false, true, true, '{}', null),
('Frites',                            'feculent', '{toutes}', 0.150, 3.80, false, false, false, true, true, '{"FRITES 9/9 PRE FRITES LONGUES","FRITES LONGUES AU FOUR"}', null),
('Purée de pommes de terre',          'feculent', '{toutes}', 0.150, 3.80, false, false, true,  true, true, '{"Purée Pomme de Terre Flocon Complet à froid","PUREE DE POMMES DE TERRE"}', null),
-- Céréales
('Boulgour',                          'feculent', '{toutes}', 0.090, 3.20, false, true,  false, true, true, '{}', null),
('Semoule de blé',                    'feculent', '{toutes}', 0.090, 3.30, false, true,  false, true, true, '{"Semoule"}', null),
('Couscous moyen',                    'feculent', '{toutes}', 0.090, 2.70, false, true,  false, true, true, '{"Couscous moyen"}', null),
('Couscous fin',                      'feculent', '{toutes}', 0.090, 2.70, false, true,  false, true, true, '{}', null),
('Couscous gros',                     'feculent', '{toutes}', 0.090, 2.80, false, true,  false, true, true, '{}', null),
('Blé précuit',                       'feculent', '{toutes}', 0.090, 3.20, false, true,  false, true, true, '{"blé dur","blé dur bio","blé dur pécuit"}', null),
('Polenta',                           'feculent', '{toutes}', 0.090, 2.80, false, false, false, true, true, '{}', null),
('Sarrasin (kasha)',                  'feculent', '{toutes}', 0.090, 4.50, false, false, false, true, true, '{}', null),
('Quinoa',                            'feculent', '{toutes}', 0.090, 5.30, false, false, false, true, true, '{"Quinoa"}', null),
('Orge perlé',                        'feculent', '{toutes}', 0.090, 3.20, false, true,  false, true, true, '{}', null),
('Épeautre',                          'feculent', '{toutes}', 0.090, 4.50, false, true,  false, true, true, '{}', null),
('Millet',                            'feculent', '{toutes}', 0.090, 3.80, false, false, false, true, true, '{}', null),
('Avoine flocons',                    'feculent', '{toutes}', 0.060, 3.20, false, true,  false, true, true, '{}', null),
-- Légumineuses
('Lentilles vertes',                  'feculent', '{toutes}', 0.090, 2.90, false, false, false, true, true, '{"Lentille Verte","Lentilles"}', null),
('Lentilles corail',                  'feculent', '{toutes}', 0.090, 3.50, false, false, false, true, true, '{}', null),
('Lentilles beluga',                  'feculent', '{toutes}', 0.090, 5.50, false, false, false, true, true, '{}', null),
('Haricots blancs lingots',           'feculent', '{toutes}', 0.090, 3.50, false, false, false, true, true, '{"Haricot coco"}', null),
('Haricots rouges',                   'feculent', '{toutes}', 0.090, 3.50, false, false, false, true, true, '{}', null),
('Pois chiches',                      'feculent', '{toutes}', 0.090, 3.20, false, false, false, true, true, '{}', null),
('Pois cassés',                       'feculent', '{toutes}', 0.090, 2.80, false, false, false, true, true, '{"Pois cassés"}', null),
('Flageolets',                        'feculent', '{toutes}', 0.090, 3.40, false, false, false, true, true, '{}', null),
('Fèves',                             'feculent', '{printemps}', 0.120, 4.20, false, false, false, true, true, '{}', null),
('Haricots de Soissons',              'feculent', '{toutes}', 0.090, 4.50, false, false, false, true, true, '{}', null),
-- Pains
('Pain de campagne',                  'feculent', '{toutes}', 0.080, 4.00, false, true,  false, true, true, '{}', null),
('Pain complet',                      'feculent', '{toutes}', 0.080, 4.50, false, true,  false, true, true, '{}', null),
('Baguette',                          'feculent', '{toutes}', 0.080, 4.00, false, true,  false, true, true, '{}', null),
('Pain de mie',                       'feculent', '{toutes}', 0.060, 5.20, false, true,  true,  true, true, '{}', null),
-- Autres
('Tapioca',                           'feculent', '{toutes}', 0.060, 4.80, false, false, false, true, true, '{}', null),

-- ============================================================
-- LÉGUMES (50)
-- ============================================================
-- Légumes courants
('Haricots verts',                    'legume', '{ete,automne}', 0.140, 3.80, false, false, false, true, true, '{"HARICOTS VERTS EXTRA FINS","HARICOTS VERTS TRES FINS","Haricot vert frais"}', null),
('Haricots beurre',                   'legume', '{ete,automne}', 0.140, 2.70, false, false, false, true, true, '{"HARICOTS BEURRE  FINS"}', null),
('Poireaux',                          'legume', '{automne,hiver,printemps}', 0.140, 2.60, false, false, false, true, true, '{"POIREAUX COUPES EN RONDELLES"}', null),
('Choux de Bruxelles',                'legume', '{automne,hiver}', 0.140, 2.80, false, false, false, true, true, '{"CHOUX DE BRUXELLES"}', null),
('Courgettes',                        'legume', '{printemps,ete}', 0.140, 5.60, false, false, false, true, true, '{"COURGETTES BIO EN RONDELLES","Courgette"}', null),
('Aubergines',                        'legume', '{ete}', 0.150, 4.80, false, false, false, true, true, '{}', null),
('Épinards',                          'legume', '{printemps,automne}', 0.140, 5.60, false, false, false, true, true, '{"EPINARDS BIO EN BRANCHES","Épinard frais"}', null),
('Champignons de Paris',              'legume', '{toutes}', 0.140, 3.20, false, false, false, true, true, '{"CHAMPIGNONS EMINCES","CHAMPIGNONS MINIATURES"}', null),
('Petits pois',                       'legume', '{printemps,ete}', 0.140, 5.10, false, false, false, true, true, '{"PETITS POIS DOUX BIO"}', null),
('Carottes',                          'legume', '{toutes}', 0.135, 1.80, false, false, false, true, true, '{"CAROTTES EN RONDELLES","JEUNES CAROTTES TRES FINES","Carotte fraîche","PUREE DE CAROTTES"}', null),
('Poivrons rouges',                   'legume', '{ete,automne}', 0.130, 4.20, false, false, false, true, true, '{}', null),
('Poivrons verts',                    'legume', '{ete,automne}', 0.130, 4.20, false, false, false, true, true, '{}', null),
('Poivrons jaunes',                   'legume', '{ete,automne}', 0.130, 4.20, false, false, false, true, true, '{"POIVRONS VERTS ET ROUGES EN LANIERES"}', null),
('Brocolis',                          'legume', '{automne,hiver}', 0.140, 5.10, false, false, false, true, true, '{"CHOUX  BROCOLIS EN FLEURETTES","Brocoli frais"}', null),
('Chou-fleur',                        'legume', '{automne,hiver,printemps}', 0.140, 2.90, false, false, false, true, true, '{"CHOUX  FLEURS EN FLEURETTES (40/60)"}', null),
('Courge butternut',                  'legume', '{automne,hiver}', 0.150, 2.80, false, false, false, true, true, '{"CUBES DE COURGES / BUTTERNUT"}', null),
('Potimarron',                        'legume', '{automne,hiver}', 0.150, 2.80, false, false, false, true, true, '{}', null),
('Potiron',                           'legume', '{automne,hiver}', 0.150, 2.00, false, false, false, true, true, '{}', null),
('Tomates rondes',                    'legume', '{ete}', 0.150, 2.50, false, false, false, true, true, '{"Tomate ronde"}', null),
('Tomates cerises',                   'legume', '{ete}', 0.100, 6.50, false, false, false, true, true, '{}', null),
('Tomates concassées',                'legume', '{toutes}', 0.135, 2.90, false, false, false, true, true, '{"TOMATES EN DES"}', null),
('Fenouil',                           'legume', '{automne,hiver,printemps}', 0.130, 3.00, false, false, false, true, true, '{"Fenouil"}', null),
('Oignons jaunes',                    'legume', '{toutes}', 0.080, 1.20, false, false, false, true, true, '{"Oignon jaune"}', null),
('Oignons rouges',                    'legume', '{toutes}', 0.080, 1.80, false, false, false, true, true, '{}', null),
('Échalotes',                         'legume', '{toutes}', 0.040, 4.50, false, false, false, true, true, '{}', null),
('Ail',                               'legume', '{toutes}', 0.010, 12.00, false, false, false, true, true, '{}', null),
-- Salades / crudités
('Salade laitue',                     'legume', '{printemps,ete,automne}', 0.080, 4.00, false, false, false, true, true, '{}', null),
('Salade batavia',                    'legume', '{printemps,ete,automne}', 0.080, 3.80, false, false, false, true, true, '{}', null),
('Mâche',                             'legume', '{automne,hiver}', 0.060, 12.00, false, false, false, true, true, '{}', null),
('Roquette',                          'legume', '{printemps,automne}', 0.050, 14.00, false, false, false, true, true, '{}', null),
('Endives',                           'legume', '{automne,hiver}', 0.120, 2.80, false, false, false, true, true, '{}', null),
('Salade frisée',                     'legume', '{automne,hiver}', 0.080, 3.50, false, false, false, true, true, '{}', null),
-- Choux
('Chou rouge',                        'legume', '{automne,hiver}', 0.130, 2.20, false, false, false, true, true, '{}', null),
('Chou vert',                         'legume', '{automne,hiver}', 0.130, 1.80, false, false, false, true, true, '{}', null),
('Chou frisé (kale)',                 'legume', '{automne,hiver}', 0.120, 4.50, false, false, false, true, true, '{}', null),
('Chou chinois',                      'legume', '{automne,hiver}', 0.130, 3.20, false, false, false, true, true, '{}', null),
('Chou-rave',                         'legume', '{automne,hiver}', 0.130, 3.40, false, false, false, true, true, '{}', null),
-- Racines / tubercules
('Navets',                            'legume', '{automne,hiver}', 0.140, 1.80, false, false, false, true, true, '{}', null),
('Panais',                            'legume', '{automne,hiver}', 0.140, 3.50, false, false, false, true, true, '{}', null),
('Betteraves rouges (cuites)',        'legume', '{automne,hiver}', 0.120, 3.20, false, false, false, true, true, '{}', null),
('Céleri-rave',                       'legume', '{automne,hiver}', 0.130, 2.50, false, false, false, true, true, '{}', null),
('Céleri branche',                    'legume', '{toutes}', 0.100, 2.80, false, false, false, true, true, '{}', null),
('Topinambour',                       'legume', '{automne,hiver}', 0.140, 3.80, false, false, false, true, true, '{}', null),
('Radis roses',                       'legume', '{printemps,ete}', 0.080, 3.20, false, false, false, true, true, '{}', null),
-- Autres
('Concombre',                         'legume', '{ete}', 0.150, 2.20, false, false, false, true, true, '{}', null),
('Asperges vertes',                   'legume', '{printemps}', 0.130, 8.50, false, false, false, true, true, '{}', null),
('Artichauts',                        'legume', '{printemps,ete}', 0.150, 5.20, false, false, false, true, true, '{}', null),
('Blettes',                           'legume', '{printemps,automne}', 0.130, 3.50, false, false, false, true, true, '{}', null),
('Maïs doux (grains)',                'legume', '{toutes}', 0.080, 3.20, false, false, false, true, true, '{}', null),
('Crudités râpées',                   'legume', '{toutes}', 0.100, 4.50, false, false, false, true, true, '{}', null),

-- ============================================================
-- DESSERTS (50)
-- ============================================================
-- Laitages
('Fromage blanc nature',              'dessert', '{toutes}', 0.120, 3.60, false, false, true, true, true, '{"FROMAGE BLANC nature battu"}', null),
('Fromage blanc aux fruits',          'dessert', '{toutes}', 0.120, 4.50, false, false, true, true, true, '{}', null),
('Yaourt nature',                     'dessert', '{toutes}', 0.125, 3.80, false, false, true, true, true, '{"YAOURT nature basique demi écrémé pot"}', null),
('Yaourt sucré',                      'dessert', '{toutes}', 0.125, 3.80, false, false, true, true, true, '{}', null),
('Yaourt vanille',                    'dessert', '{toutes}', 0.125, 4.20, false, false, true, true, true, '{}', null),
('Yaourt aux fruits',                 'dessert', '{toutes}', 0.125, 4.50, false, false, true, true, true, '{}', null),
('Petit suisse',                      'dessert', '{toutes}', 0.120, 5.20, false, false, true, true, true, '{}', null),
('Lait fermenté bifidus',             'dessert', '{toutes}', 0.120, 7.00, false, false, true, true, true, '{"LAIT FERMENTÉ nature au bifidus lait entier pot"}', null),
-- Crèmes et entremets
('Mousse chocolat',                   'dessert', '{toutes}', 0.115, 6.30, false, false, true, true, true, '{"MOUSSE CHOCOLAT pot"}', null),
('Crème dessert chocolat',            'dessert', '{toutes}', 0.115, 4.50, false, false, true, true, true, '{"CRÈME DESSERT lait entier crème frai. choco. pot"}', null),
('Crème dessert vanille',             'dessert', '{toutes}', 0.115, 4.50, false, false, true, true, true, '{}', null),
('Crème dessert caramel',             'dessert', '{toutes}', 0.115, 4.50, false, false, true, true, true, '{}', null),
('Crème anglaise',                    'dessert', '{toutes}', 0.100, 2.80, false, false, true, true, true, '{"CRÈME ANGLAISE"}', null),
('Lait gélifié chocolat',             'dessert', '{toutes}', 0.120, 3.60, false, false, true, true, true, '{"LAIT GÉLIFIÉ chocolat pot"}', null),
('Liégeois chocolat',                 'dessert', '{toutes}', 0.120, 4.80, false, false, true, true, true, '{}', null),
('Flan nappé caramel',                'dessert', '{toutes}', 0.120, 4.20, false, false, true, true, true, '{}', null),
('Riz au lait',                       'dessert', '{toutes}', 0.130, 3.80, false, false, true, true, true, '{}', null),
('Semoule au lait',                   'dessert', '{toutes}', 0.130, 3.80, false, true,  true, true, true, '{}', null),
-- Compotes
('Compote de pomme',                  'dessert', '{toutes}', 0.115, 2.30, false, false, false, true, true, '{"Compote de pomme  allégée en sucre en coupelle","Compote de pomme  allégée en sucre"}', null),
('Compote pomme-poire',               'dessert', '{toutes}', 0.115, 2.50, false, false, false, true, true, '{}', null),
('Compote pomme-fraise',              'dessert', '{toutes}', 0.115, 2.80, false, false, false, true, true, '{}', null),
-- Fromages
('Camembert',                         'dessert', '{toutes}', 0.035, 13.00, false, false, true, true, true, '{"CAMEMBERT"}', null),
('Emmental',                          'dessert', '{toutes}', 0.035, 15.90, false, false, true, true, true, '{"EMMENTAL"}', null),
('Comté',                             'dessert', '{toutes}', 0.035, 24.00, false, false, true, true, true, '{"COMTÉ bande verte (+4 mois)"}', null),
('Brie',                              'dessert', '{toutes}', 0.035, 13.50, false, false, true, true, true, '{}', null),
('Tomme',                             'dessert', '{toutes}', 0.035, 16.00, false, false, true, true, true, '{}', null),
('Reblochon',                         'dessert', '{toutes}', 0.035, 18.50, false, false, true, true, true, '{}', null),
('Munster',                           'dessert', '{toutes}', 0.035, 18.00, false, false, true, true, true, '{}', null),
('Cantal',                            'dessert', '{toutes}', 0.035, 17.00, false, false, true, true, true, '{}', null),
('Roquefort',                         'dessert', '{toutes}', 0.025, 25.00, false, false, true, true, true, '{}', null),
('Bûche de chèvre',                   'dessert', '{toutes}', 0.035, 16.00, false, false, true, true, true, '{}', null),
('Chèvre frais',                      'dessert', '{toutes}', 0.040, 14.00, false, false, true, true, true, '{}', null),
-- Fruits frais
('Pomme',                             'dessert', '{toutes}', 0.150, 1.80, false, false, false, true, true, '{"Pomme Golden"}', null),
('Poire',                             'dessert', '{automne,hiver}', 0.150, 2.50, false, false, false, true, true, '{"Poire Conférence"}', null),
('Banane',                            'dessert', '{toutes}', 0.150, 1.80, false, false, false, true, true, '{"Banane"}', null),
('Orange',                            'dessert', '{automne,hiver,printemps}', 0.180, 2.00, false, false, false, true, true, '{}', null),
('Clémentine',                        'dessert', '{automne,hiver}', 0.135, 3.20, false, false, false, true, true, '{"Clémentine"}', null),
('Kiwi',                              'dessert', '{automne,hiver,printemps}', 0.120, 4.50, false, false, false, true, true, '{}', null),
('Pêche',                             'dessert', '{ete}', 0.150, 3.20, false, false, false, true, true, '{}', null),
('Nectarine',                         'dessert', '{ete}', 0.150, 3.20, false, false, false, true, true, '{}', null),
('Abricot frais',                     'dessert', '{printemps,ete}', 0.150, 4.50, false, false, false, true, true, '{"Abricot frais"}', null),
('Prune',                             'dessert', '{ete,automne}', 0.150, 3.20, false, false, false, true, true, '{}', null),
('Mirabelles',                        'dessert', '{ete}', 0.130, 5.50, false, false, false, true, true, '{}', null),
('Cerises',                           'dessert', '{printemps,ete}', 0.120, 6.50, false, false, false, true, true, '{}', null),
('Fraises',                           'dessert', '{printemps,ete}', 0.120, 6.50, false, false, false, true, true, '{}', null),
('Raisin',                            'dessert', '{ete,automne}', 0.150, 3.80, false, false, false, true, true, '{"Raisin noir"}', null),
('Melon',                             'dessert', '{ete}', 0.180, 3.20, false, false, false, true, true, '{}', null),
('Pastèque',                          'dessert', '{ete}', 0.200, 1.80, false, false, false, true, true, '{}', null),
('Ananas frais',                      'dessert', '{toutes}', 0.150, 3.50, false, false, false, true, true, '{}', null),
-- Pâtisseries préparées
('Salade de fruits',                  'dessert', '{toutes}', 0.130, 4.50, false, false, false, true, true, '{}', null);
