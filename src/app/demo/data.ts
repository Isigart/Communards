// Donnees fictives realistes — aucune API necessaire

export const establishment = {
  name: 'Le Bistrot du Marche',
  employee_count: 12,
  budget_per_meal: 3.5,
  currency: 'EUR',
  market: 'fr' as const,
};

export const supplier = {
  name: 'Metro',
  delivery_days: [1, 4], // Lundi + Jeudi
};

export const currentSpan = {
  start_date: '2026-04-06',
  end_date: '2026-04-08',
  day_count: 3,
  label: 'Lun 6 → Mer 8 avril',
};

export const nextSpan = {
  start_date: '2026-04-09',
  end_date: '2026-04-12',
  day_count: 4,
  label: 'Jeu 9 → Dim 12 avril',
};

// Quantites calculees pour 12 personnes
// estimated_cost = cout total du repas pour 12 pers
export const suggestions = [
  {
    id: '1',
    meal_date: '2026-04-06',
    meal_type: 'lunch' as const,
    ingredients: [
      { name: 'Poulet fermier', quantity: '3', unit: 'kg', category: 'proteine' },
      { name: 'Lentilles vertes', quantity: '1.5', unit: 'kg', category: 'feculent' },
      { name: 'Carottes', quantity: '1.5', unit: 'kg', category: 'legume' },
      { name: 'Oignons', quantity: '600', unit: 'g', category: 'aromate' },
    ],
    estimated_cost: 38,
    notes: null,
  },
  {
    id: '2',
    meal_date: '2026-04-06',
    meal_type: 'dinner' as const,
    ingredients: [
      { name: 'Pennes', quantity: '1.5', unit: 'kg', category: 'feculent' },
      { name: 'Sauce tomate maison', quantity: '1.5', unit: 'L', category: 'sauce' },
      { name: 'Parmesan', quantity: '300', unit: 'g', category: 'fromage' },
      { name: 'Mesclun', quantity: '500', unit: 'g', category: 'legume' },
    ],
    estimated_cost: 28,
    notes: null,
  },
  {
    id: '3',
    meal_date: '2026-04-07',
    meal_type: 'lunch' as const,
    ingredients: [
      { name: 'Saute de porc', quantity: '2.5', unit: 'kg', category: 'proteine' },
      { name: 'Riz basmati', quantity: '1.5', unit: 'kg', category: 'feculent' },
      { name: 'Courgettes', quantity: '2', unit: 'kg', category: 'legume' },
      { name: 'Ail', quantity: '1', unit: 'tete', category: 'aromate' },
    ],
    estimated_cost: 40,
    notes: null,
  },
  {
    id: '4',
    meal_date: '2026-04-07',
    meal_type: 'dinner' as const,
    ingredients: [
      { name: 'Oeufs', quantity: '36', unit: 'pcs', category: 'proteine' },
      { name: 'Pommes de terre', quantity: '2.5', unit: 'kg', category: 'feculent' },
      { name: 'Comte', quantity: '400', unit: 'g', category: 'fromage' },
      { name: 'Salade verte', quantity: '600', unit: 'g', category: 'legume' },
    ],
    estimated_cost: 32,
    notes: null,
  },
  {
    id: '5',
    meal_date: '2026-04-08',
    meal_type: 'lunch' as const,
    ingredients: [
      { name: 'Filet de merlu', quantity: '2', unit: 'kg', category: 'proteine' },
      { name: 'Pommes de terre', quantity: '3', unit: 'kg', category: 'feculent' },
      { name: 'Epinards frais', quantity: '1.5', unit: 'kg', category: 'legume' },
      { name: 'Citron', quantity: '4', unit: 'pcs', category: 'aromate' },
    ],
    estimated_cost: 45,
    notes: null,
  },
  {
    id: '6',
    meal_date: '2026-04-08',
    meal_type: 'dinner' as const,
    ingredients: [
      { name: 'Legumes pour soupe', quantity: '3', unit: 'kg', category: 'legume' },
      { name: 'Pain de campagne', quantity: '2', unit: 'pcs', category: 'feculent' },
      { name: 'Jambon blanc', quantity: '1', unit: 'kg', category: 'proteine' },
      { name: 'Gruyere rape', quantity: '400', unit: 'g', category: 'fromage' },
    ],
    estimated_cost: 30,
    notes: null,
  },
];

// Liste de courses agregee pour le span (12 personnes, 3 jours)
export const groceryList = [
  { name: 'Poulet fermier', quantity: '3 kg', supplier: 'Metro' },
  { name: 'Saute de porc', quantity: '2.5 kg', supplier: 'Metro' },
  { name: 'Filet de merlu', quantity: '2 kg', supplier: 'Metro' },
  { name: 'Jambon blanc', quantity: '1 kg', supplier: 'Metro' },
  { name: 'Oeufs', quantity: '36 pcs', supplier: 'Metro' },
  { name: 'Lentilles vertes', quantity: '1.5 kg', supplier: 'Metro' },
  { name: 'Pennes', quantity: '1.5 kg', supplier: 'Metro' },
  { name: 'Riz basmati', quantity: '1.5 kg', supplier: 'Metro' },
  { name: 'Pommes de terre', quantity: '5.5 kg', supplier: 'Metro' },
  { name: 'Carottes', quantity: '1.5 kg', supplier: 'Metro' },
  { name: 'Courgettes', quantity: '2 kg', supplier: 'Metro' },
  { name: 'Epinards frais', quantity: '1.5 kg', supplier: 'Metro' },
  { name: 'Legumes soupe', quantity: '3 kg', supplier: 'Metro' },
  { name: 'Mesclun', quantity: '500 g', supplier: 'Metro' },
  { name: 'Salade verte', quantity: '600 g', supplier: 'Metro' },
  { name: 'Parmesan', quantity: '300 g', supplier: 'Metro' },
  { name: 'Comte', quantity: '400 g', supplier: 'Metro' },
  { name: 'Gruyere rape', quantity: '400 g', supplier: 'Metro' },
  { name: 'Sauce tomate', quantity: '1.5 L', supplier: 'Metro' },
  { name: 'Pain de campagne', quantity: '2 pcs', supplier: 'Metro' },
];

export const feedbackHistory = [
  { date: '2026-03-30', meal: 'Dejeuner', status: 'done' as const, label: 'Fait' },
  { date: '2026-03-30', meal: 'Diner', status: 'modified' as const, label: 'Modifie' },
  { date: '2026-03-31', meal: 'Dejeuner', status: 'done' as const, label: 'Fait' },
  { date: '2026-03-31', meal: 'Diner', status: 'skipped' as const, label: 'Pas fait' },
  { date: '2026-04-01', meal: 'Dejeuner', status: 'done' as const, label: 'Fait' },
];
