export type Market = 'fr' | 'uk' | 'us' | 'au' | 'ca';
export type MealType = 'lunch' | 'dinner';
export type FeedbackStatus = 'done' | 'modified' | 'skipped';

export const BUDGET_HCR = 4.25;

export interface Establishment {
  id: string;
  user_id: string;
  name: string;
  employee_count: number;
  budget_per_meal: number;
  market: Market;
  currency: string;
  language: string;
  services: string[];
  dietary_constraints: string[];
  planning_days: number;
  created_at: string;
  updated_at: string;
}

export interface Supplier {
  id: string;
  establishment_id: string;
  name: string;
  delivery_days: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
  category: string;
  is_primary: boolean;
  created_at: string;
}

export interface SupplySpan {
  id: string;
  establishment_id: string;
  supplier_id: string;
  start_date: string;
  end_date: string;
  day_count: number;
  meal_count: number;
  created_at: string;
}

export interface Suggestion {
  id: string;
  span_id: string;
  establishment_id: string;
  day_index: number;
  meal_date: string;
  meal_type: MealType;
  ingredients: Ingredient[];
  estimated_cost: number;
  grocery_list: GroceryItem[];
  notes: string | null;
  created_at: string;
}

export interface Ingredient {
  name: string;
  quantity: string;
  unit: string;
  category: string;
}

export interface GroceryItem {
  name: string;
  quantity: string;
  unit: string;
  supplier: string;
}

export interface Feedback {
  id: string;
  suggestion_id: string;
  establishment_id: string;
  status: FeedbackStatus;
  actual_ingredients: Ingredient[] | null;
  notes: string | null;
  created_at: string;
}

export interface BriefCode {
  id: string;
  establishment_id: string;
  code: string;
  span_id: string;
  expires_at: string;
  created_at: string;
}

export const MARKET_CONFIG: Record<Market, {
  supplier_ref: string;
  currency: string;
  language: string;
  locale: string;
}> = {
  fr: { supplier_ref: 'Metro France', currency: 'EUR', language: 'fr', locale: 'fr-FR' },
  uk: { supplier_ref: 'Brakes UK', currency: 'GBP', language: 'en', locale: 'en-GB' },
  us: { supplier_ref: 'Sysco US', currency: 'USD', language: 'en', locale: 'en-US' },
  au: { supplier_ref: 'Bidfood AU', currency: 'AUD', language: 'en', locale: 'en-AU' },
  ca: { supplier_ref: 'Sysco CA', currency: 'CAD', language: 'en', locale: 'en-CA' },
};
