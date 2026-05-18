-- ============================================================
-- BASE INGREDIENTS — catalogue canonique (99 ingrédients)
-- ============================================================
-- Niveau de granularité : ce que le chef écrit sur sa liste de courses.
-- Pas de plats composés. Pas de variantes Metro (calibres, % MG, etc.) —
-- elles sont stockées dans `aliases`.
--
-- Protéines : 3 modes par animal quand pertinent (griller / haché / mijoter).
-- Féculents/légumes/desserts : 1 entrée par famille (toutes les pâtes
-- dans "Pâtes", tous les fromages dans "Fromages", etc.).

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

drop policy if exists "Anyone authenticated can read base_ingredients" on public.base_ingredients;
create policy "Anyone authenticated can read base_ingredients"
  on public.base_ingredients for select
  to authenticated
  using (true);

drop policy if exists "Service role can manage base_ingredients" on public.base_ingredients;
create policy "Service role can manage base_ingredients"
  on public.base_ingredients for all
  to service_role
  using (true)
  with check (true);

-- ============================================================
-- SEED — 99 ingrédients
-- ============================================================

insert into public.base_ingredients
  (name, category, saison, qty_per_person_kg, price_per_kg_ht,
   contains_porc, contains_gluten, contains_lactose, is_vegetarien, halal_compatible, aliases, notes)
values
-- ============================================================
-- PROTÉINES (26)
-- ============================================================
-- Bœuf : 3 modes (griller / haché / mijoter)
('Steak',                 'proteine', '{toutes}', 0.150, 22.00, false, false, false, false, true,  '{"Filet de bœuf","Bavette","Onglet","Faux-filet","Rumsteak","Entrecôte","Pavé de bœuf","Émincé de bœuf"}', 'À griller / poêler'),
('Viande hachée',         'proteine', '{toutes}', 0.150, 18.00, false, false, false, false, true,  '{"STEAKS HACHES 15% MATIERE GRASSE UE","BOULE DE BOEUF 51% MINIMUM DE VIANDE HACHEE 15% MG UE","BOULE DE VEAU 70% MINIMUM DE VIANDE HACHEE 15% MG UE","Steak haché 15% MG","Boule de bœuf 51% VBF","Boule de veau 70% VBF"}', null),
('Bœuf à mijoter',        'proteine', '{toutes}', 0.180, 17.00, false, false, false, false, true,  '{"ASSORTIMENT POUR BOURGUIGNON SANS OS COUPE COUTEAU","ASSORTIMENT POUR BOURGUIGNON SANS OS  COUPE COUTEAU","Bourguignon sans os","Paleron","Gîte","Joue de bœuf","Rôti de bœuf"}', 'Morceaux à ragoût / braiser'),
-- Veau
('Veau à mijoter',        'proteine', '{toutes}', 0.180, 18.00, false, false, false, false, true,  '{"Sauté de veau","Blanquette","Veau Marengo","Tendrons de veau"}', null),
-- Porc
('Côtes de porc',         'proteine', '{toutes}', 0.150, 10.50, true,  false, false, false, false, '{"Échine de porc","Côte échine","Côtes de porc échine"}', 'À griller'),
('Porc à mijoter',        'proteine', '{toutes}', 0.150, 12.60, true,  false, false, false, false, '{"SAUTE DE PORC SANS OS SCIE","ROTI DE PORC ECHINE","Sauté de porc","Rôti de porc échine","Filet mignon de porc","Joue de porc"}', null),
-- Charcuterie
('Saucisses de Toulouse', 'proteine', '{toutes}', 0.150, 12.50, true,  false, false, false, false, '{}', null),
('Chipolatas',            'proteine', '{toutes}', 0.150, 11.00, true,  false, false, false, false, '{}', null),
('Jambon blanc',          'proteine', '{toutes}', 0.100, 14.00, true,  false, false, false, false, '{}', null),
-- Volaille (poulet : 3 cuts par cuisson)
('Cuisses de poulet',     'proteine', '{toutes}', 0.180, 8.00,  false, false, false, false, true,  '{"CUISSES DE POULET 180/220gr ou 220/260gr DEUX LAMES APD UE","CUISSES DE POULET 180/220gr ou 220/260gr UNE LAME APD UE","CUISSES DE POULET 180/220gr,  DEJOINTEES UE","HAUTS DE CUISSE DE POULET 120/180gr UE","Hauts de cuisse de poulet 120/180gr UE","PILONS DE POULET A SEC UE","Hauts de cuisse de poulet","Pilons de poulet"}', null),
('Blancs de poulet',      'proteine', '{toutes}', 0.150, 14.80, false, false, false, false, true,  '{"FILETS OU BLANCS DE POULETS A SEC UE","Filets de poulet"}', null),
('Sauté de poulet',       'proteine', '{toutes}', 0.160, 13.40, false, false, false, false, true,  '{"SAUTE DE POULET A SEC COUPE COUTEAU UE"}', null),
-- Dinde
('Sauté de dinde',        'proteine', '{toutes}', 0.150, 14.70, false, false, false, false, true,  '{"SAUTE DE DINDONNEAU SANS OS, SANS PEAU, A SEC, COUPE COUTEAU UE","Sauté de dindonneau"}', null),
('Rôti de dinde',         'proteine', '{toutes}', 0.150, 12.60, false, false, false, false, true,  '{"ROTI DE DINDONNEAU A SEC 50/50 UE","Rôti de dindonneau"}', null),
-- Canard
('Cuisses de canard',     'proteine', '{automne,hiver}', 0.175, 11.50, false, false, false, false, true,  '{"CUISSES DE CANARD  UE"}', null),
('Sauté de canard',       'proteine', '{toutes}', 0.155, 15.80, false, false, false, false, true,  '{"SAUTE DE CANARD COUPE COUTEAU FRANCE"}', null),
-- Autres volailles
('Pintade',               'proteine', '{automne,hiver}', 0.180, 12.00, false, false, false, false, true,  '{"PINTADE  A ROTIR PAC CLASSE A, A SEC  FRANCE","CUISSES DE PINTADE FRANCE","Pintade à rôtir","Cuisses de pintade"}', null),
('Lapin',                 'proteine', '{toutes}', 0.170, 15.00, false, false, false, false, true,  '{"CUISSES DE LAPINS FRANCE","SAUTE DE LAPIN DE CHINE COUPE COUTEAU","Cuisses de lapin","Sauté de lapin"}', null),
-- Poissons (par espèce, filets/dos collapsés)
('Saumon',                'proteine', '{toutes}', 0.130, 23.60, false, false, false, false, true,  '{"FILET DE SAUMON SALMO SALAR","Filet de saumon","Dos de saumon","Pavé de saumon"}', null),
('Cabillaud',             'proteine', '{toutes}', 0.150, 24.70, false, false, false, false, true,  '{"DOS DE CABILLAUD","Dos de cabillaud"}', null),
('Colin',                 'proteine', '{toutes}', 0.150, 11.50, false, false, false, false, true,  '{"FILETS DECOUPES CALIBRES DE COLIN D''ALASKA","FILETS DE COLIN D'' ALASKA","PORTIONS NATURE CRUES DE FILETS DE COLIN D''ALASKA SANS ARETE","FILETS DE COLIN (LIEU )","DOS DE COLIN D''ALASKA","DOS DE COLIN LIEU SIMPLE CONGELATION","LIEU noir","FILETS DE MERLU BLANC","CUBES DE POISSON BLANC CRUS SANS ARETES","Filets de colin d''Alaska","Dos de colin d''Alaska","Lieu noir","Filets de merlu blanc","Cubes de poisson blanc"}', null),
('Maquereau',             'proteine', '{printemps,ete}', 0.150, 6.50,  false, false, false, false, true,  '{"MAQUEREAU de ligne France : le kg","MAQUEREAU de chalut moyen France : le kg"}', null),
('Sardines fraîches',     'proteine', '{ete}',    0.150, 7.50,  false, false, false, false, true,  '{}', null),
('Truite',                'proteine', '{toutes}', 0.150, 14.00, false, false, false, false, true,  '{"Filet de truite"}', null),
-- Œufs + végétal
('Œufs',                  'proteine', '{toutes}', 0.130, 7.30,  false, false, false, true,  true,  '{"OEUF coquille plein air M(53-63g) France les","OEUF dur écalé","OEUF dur écalé <","OEUF liquide entier France","Œufs coquille","Œufs liquides entiers"}', null),
('Tofu nature',           'proteine', '{toutes}', 0.120, 9.50,  false, false, false, true,  true,  '{}', null),

-- ============================================================
-- FÉCULENTS (16)
-- ============================================================
('Riz',              'feculent', '{toutes}', 0.090, 3.00, false, false, false, true, true, '{"Riz long indica étuve","Riz long","Riz basmati","Riz thaï","Riz complet","Riz arborio","Riz sauvage"}', null),
('Pâtes',            'feculent', '{toutes}', 0.090, 2.50, false, true,  false, true, true, '{"Coquillette Qualité Supérieure","Coquillette Bio","Coquillettes","Penne","Tagliatelles","Fusilli","Farfalle","Spaghetti","Macaronis","Plaques de lasagnes"}', null),
('Pommes de terre',  'feculent', '{toutes}', 0.200, 1.80, false, false, false, true, true, '{"Pomme de terre Charlotte","Pommes de terre Charlotte","Pommes de terre grenaille","Pommes de terre Ratte","Pommes de terre Bintje"}', null),
('Patate douce',     'feculent', '{automne,hiver}', 0.180, 2.50, false, false, false, true, true, '{}', null),
('Semoule',          'feculent', '{toutes}', 0.090, 2.80, false, true,  false, true, true, '{"Couscous moyen","Couscous fin","Couscous gros","Semoule de blé"}', null),
('Boulgour',         'feculent', '{toutes}', 0.090, 3.20, false, true,  false, true, true, '{}', null),
('Polenta',          'feculent', '{toutes}', 0.090, 2.80, false, false, false, true, true, '{}', null),
('Sarrasin',         'feculent', '{toutes}', 0.090, 4.50, false, false, false, true, true, '{"Sarrasin (kasha)","Kasha"}', null),
('Quinoa',           'feculent', '{toutes}', 0.090, 5.30, false, false, false, true, true, '{"Quinoa"}', null),
('Blé',              'feculent', '{toutes}', 0.090, 3.20, false, true,  false, true, true, '{"blé dur","blé dur bio","blé dur pécuit","Blé précuit","Ebly"}', null),
('Lentilles',        'feculent', '{toutes}', 0.090, 3.20, false, false, false, true, true, '{"Lentille Verte","Lentilles","Lentilles vertes","Lentilles corail","Lentilles beluga"}', null),
('Pois chiches',     'feculent', '{toutes}', 0.090, 3.20, false, false, false, true, true, '{}', null),
('Haricots blancs',  'feculent', '{toutes}', 0.090, 3.80, false, false, false, true, true, '{"Haricot coco","Haricots blancs lingots","Haricots de Soissons","Flageolets"}', null),
('Haricots rouges',  'feculent', '{toutes}', 0.090, 3.50, false, false, false, true, true, '{}', null),
('Pois cassés',      'feculent', '{toutes}', 0.090, 2.80, false, false, false, true, true, '{"Pois cassés"}', null),
('Pain',             'feculent', '{toutes}', 0.080, 4.00, false, true,  false, true, true, '{"Pain de campagne","Pain complet","Baguette","Pain de mie"}', null),

-- ============================================================
-- LÉGUMES (37)
-- ============================================================
('Haricots verts',         'legume', '{ete,automne}', 0.140, 3.80, false, false, false, true, true, '{"HARICOTS VERTS EXTRA FINS","HARICOTS VERTS TRES FINS","Haricot vert frais"}', null),
('Haricots beurre',        'legume', '{ete,automne}', 0.140, 2.70, false, false, false, true, true, '{"HARICOTS BEURRE  FINS"}', null),
('Poireaux',               'legume', '{automne,hiver,printemps}', 0.140, 2.60, false, false, false, true, true, '{"POIREAUX COUPES EN RONDELLES"}', null),
('Choux de Bruxelles',     'legume', '{automne,hiver}', 0.140, 2.80, false, false, false, true, true, '{"CHOUX DE BRUXELLES"}', null),
('Courgettes',             'legume', '{printemps,ete}', 0.140, 5.60, false, false, false, true, true, '{"COURGETTES BIO EN RONDELLES","Courgette"}', null),
('Aubergines',             'legume', '{ete}', 0.150, 4.80, false, false, false, true, true, '{}', null),
('Épinards',               'legume', '{printemps,automne}', 0.140, 5.60, false, false, false, true, true, '{"EPINARDS BIO EN BRANCHES","Épinard frais"}', null),
('Champignons de Paris',   'legume', '{toutes}', 0.140, 3.20, false, false, false, true, true, '{"CHAMPIGNONS EMINCES","CHAMPIGNONS MINIATURES"}', null),
('Petits pois',            'legume', '{printemps,ete}', 0.140, 5.10, false, false, false, true, true, '{"PETITS POIS DOUX BIO"}', null),
('Carottes',               'legume', '{toutes}', 0.135, 1.80, false, false, false, true, true, '{"CAROTTES EN RONDELLES","JEUNES CAROTTES TRES FINES","Carotte fraîche","PUREE DE CAROTTES"}', null),
('Poivrons',               'legume', '{ete,automne}', 0.130, 4.20, false, false, false, true, true, '{"POIVRONS VERTS ET ROUGES EN LANIERES","Poivrons rouges","Poivrons verts","Poivrons jaunes"}', null),
('Brocolis',               'legume', '{automne,hiver}', 0.140, 5.10, false, false, false, true, true, '{"CHOUX  BROCOLIS EN FLEURETTES","Brocoli frais"}', null),
('Chou-fleur',             'legume', '{automne,hiver,printemps}', 0.140, 2.90, false, false, false, true, true, '{"CHOUX  FLEURS EN FLEURETTES (40/60)"}', null),
('Courge',                 'legume', '{automne,hiver}', 0.150, 2.50, false, false, false, true, true, '{"CUBES DE COURGES / BUTTERNUT","Courge butternut","Potimarron","Potiron"}', null),
('Tomates',                'legume', '{ete}', 0.140, 3.00, false, false, false, true, true, '{"Tomate ronde","Tomates rondes","Tomates cerises","Tomates concassées","TOMATES EN DES"}', null),
('Fenouil',                'legume', '{automne,hiver,printemps}', 0.130, 3.00, false, false, false, true, true, '{"Fenouil"}', null),
('Oignons',                'legume', '{toutes}', 0.080, 1.20, false, false, false, true, true, '{"Oignon jaune","Oignons jaunes","Oignons rouges"}', null),
('Échalotes',              'legume', '{toutes}', 0.040, 4.50, false, false, false, true, true, '{}', null),
('Ail',                    'legume', '{toutes}', 0.010, 12.00, false, false, false, true, true, '{}', null),
('Salade verte',           'legume', '{printemps,ete,automne}', 0.080, 4.00, false, false, false, true, true, '{"Salade laitue","Salade batavia","Salade frisée","laitue","batavia","frisée"}', null),
('Roquette',               'legume', '{printemps,automne}', 0.050, 14.00, false, false, false, true, true, '{}', null),
('Mâche',                  'legume', '{automne,hiver}', 0.060, 12.00, false, false, false, true, true, '{}', null),
('Endives',                'legume', '{automne,hiver}', 0.120, 2.80, false, false, false, true, true, '{}', null),
('Chou vert',              'legume', '{automne,hiver}', 0.130, 2.50, false, false, false, true, true, '{"Chou chinois","Chou-rave"}', null),
('Chou rouge',             'legume', '{automne,hiver}', 0.130, 2.20, false, false, false, true, true, '{}', null),
('Chou kale',              'legume', '{automne,hiver}', 0.120, 4.50, false, false, false, true, true, '{"Chou frisé (kale)"}', null),
('Navets',                 'legume', '{automne,hiver}', 0.140, 1.80, false, false, false, true, true, '{}', null),
('Panais',                 'legume', '{automne,hiver}', 0.140, 3.50, false, false, false, true, true, '{}', null),
('Céleri-rave',            'legume', '{automne,hiver}', 0.130, 2.50, false, false, false, true, true, '{}', null),
('Céleri branche',         'legume', '{toutes}', 0.100, 2.80, false, false, false, true, true, '{}', null),
('Topinambour',            'legume', '{automne,hiver}', 0.140, 3.80, false, false, false, true, true, '{}', null),
('Radis roses',            'legume', '{printemps,ete}', 0.080, 3.20, false, false, false, true, true, '{}', null),
('Concombre',              'legume', '{ete}', 0.150, 2.20, false, false, false, true, true, '{}', null),
('Asperges',               'legume', '{printemps}', 0.130, 8.50, false, false, false, true, true, '{"Asperges vertes"}', null),
('Artichauts',             'legume', '{printemps,ete}', 0.150, 5.20, false, false, false, true, true, '{}', null),
('Blettes',                'legume', '{printemps,automne}', 0.130, 3.50, false, false, false, true, true, '{}', null),
('Maïs doux',              'legume', '{toutes}', 0.080, 3.20, false, false, false, true, true, '{"Maïs doux (grains)"}', null),

-- ============================================================
-- DESSERTS (20) — yaourts/compotes/fromages collapsés en familles
-- ============================================================
('Yaourt',          'dessert', '{toutes}', 0.125, 4.00, false, false, true,  true, true, '{"YAOURT nature basique demi écrémé pot","LAIT FERMENTÉ nature au bifidus lait entier pot","Yaourt nature","Yaourt sucré","Yaourt vanille","Yaourt aux fruits","Lait fermenté bifidus"}', null),
('Fromage blanc',   'dessert', '{toutes}', 0.120, 3.80, false, false, true,  true, true, '{"FROMAGE BLANC nature battu","Fromage blanc nature","Fromage blanc aux fruits"}', null),
('Petit suisse',    'dessert', '{toutes}', 0.120, 5.20, false, false, true,  true, true, '{}', null),
('Compote',         'dessert', '{toutes}', 0.115, 2.50, false, false, false, true, true, '{"Compote de pomme  allégée en sucre en coupelle","Compote de pomme  allégée en sucre","Compote de pomme","Compote pomme-poire","Compote pomme-fraise"}', null),
('Fromages',        'dessert', '{toutes}', 0.035, 16.00, false, false, true, true, true, '{"CAMEMBERT","EMMENTAL","COMTÉ bande verte (+4 mois)","Camembert","Emmental","Comté","Brie","Tomme","Reblochon","Munster","Cantal","Roquefort","Bleu d''Auvergne","Bûche de chèvre","Chèvre frais"}', 'Plateau / portion individuelle — pâte molle, pressée, bleu ou chèvre selon ce que tu as'),
('Pomme',           'dessert', '{toutes}', 0.150, 1.80, false, false, false, true, true, '{"Pomme Golden"}', null),
('Poire',           'dessert', '{automne,hiver}', 0.150, 2.50, false, false, false, true, true, '{"Poire Conférence"}', null),
('Banane',          'dessert', '{toutes}', 0.150, 1.80, false, false, false, true, true, '{}', null),
('Orange',          'dessert', '{automne,hiver,printemps}', 0.180, 2.00, false, false, false, true, true, '{}', null),
('Clémentine',      'dessert', '{automne,hiver}', 0.135, 3.20, false, false, false, true, true, '{}', null),
('Kiwi',            'dessert', '{automne,hiver,printemps}', 0.120, 4.50, false, false, false, true, true, '{}', null),
('Pêches',          'dessert', '{ete}', 0.150, 3.20, false, false, false, true, true, '{"Pêche","Nectarine"}', null),
('Abricot',         'dessert', '{printemps,ete}', 0.150, 4.50, false, false, false, true, true, '{"Abricot frais"}', null),
('Prunes',          'dessert', '{ete,automne}', 0.150, 3.50, false, false, false, true, true, '{"Prune","Mirabelles"}', null),
('Cerises',         'dessert', '{printemps,ete}', 0.120, 6.50, false, false, false, true, true, '{}', null),
('Fraises',         'dessert', '{printemps,ete}', 0.120, 6.50, false, false, false, true, true, '{}', null),
('Raisin',          'dessert', '{ete,automne}', 0.150, 3.80, false, false, false, true, true, '{"Raisin noir"}', null),
('Melon',           'dessert', '{ete}', 0.180, 3.20, false, false, false, true, true, '{}', null),
('Pastèque',        'dessert', '{ete}', 0.200, 1.80, false, false, false, true, true, '{}', null),
('Ananas',          'dessert', '{toutes}', 0.150, 3.50, false, false, false, true, true, '{"Ananas frais"}', null);
