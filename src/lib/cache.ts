import { createBrowserClient } from './supabase';
import type { Establishment, Suggestion, SupplySpan } from './types';

// Cache en memoire — persiste tant que l'onglet est ouvert
let cachedToken: string | null = null;
let cachedEstablishment: Establishment | null = null;
let cachedSuggestions: Suggestion[] | null = null;
let cachedSpan: SupplySpan | null = null;
let cachedSuppliers: Record<string, unknown>[] | null = null;
let cachedPrepTasks: Record<string, unknown>[] | null = null;

export async function getToken(): Promise<string | null> {
  if (cachedToken) return cachedToken;
  const supabase = createBrowserClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = '/';
    return null;
  }
  cachedToken = session.access_token;
  return cachedToken;
}

export async function fetchEstablishment(force = false): Promise<Establishment | null> {
  if (cachedEstablishment && !force) return cachedEstablishment;
  const token = await getToken();
  if (!token) return null;
  const res = await fetch('/api/establishment', { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 404) { window.location.href = '/onboarding'; return null; }
  if (!res.ok) return null;
  cachedEstablishment = await res.json();
  return cachedEstablishment;
}

export async function fetchSuggestions(force = false): Promise<{ span: SupplySpan | null; suggestions: Suggestion[] }> {
  if (cachedSpan && cachedSuggestions && !force) {
    return { span: cachedSpan, suggestions: cachedSuggestions };
  }
  const token = await getToken();
  if (!token) return { span: null, suggestions: [] };
  const res = await fetch('/api/suggestions', { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return { span: null, suggestions: [] };
  const data = await res.json();
  cachedSpan = data.span;
  cachedSuggestions = data.suggestions || [];
  return { span: cachedSpan, suggestions: cachedSuggestions! };
}

export async function fetchSuppliers(force = false): Promise<Record<string, unknown>[]> {
  if (cachedSuppliers && !force) return cachedSuppliers;
  const token = await getToken();
  if (!token) return [];
  const res = await fetch('/api/suppliers', { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return [];
  cachedSuppliers = await res.json();
  return cachedSuppliers!;
}

export async function fetchPrepTasks(force = false): Promise<Record<string, unknown>[]> {
  if (cachedPrepTasks && !force) return cachedPrepTasks;
  const token = await getToken();
  if (!token) return [];
  const res = await fetch('/api/prep-tasks', { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return [];
  cachedPrepTasks = await res.json();
  return cachedPrepTasks!;
}

// Invalidation ciblee
export function invalidateSuggestions() {
  cachedSuggestions = null;
  cachedSpan = null;
}

export function invalidateEstablishment() {
  cachedEstablishment = null;
}

export function invalidateSuppliers() {
  cachedSuppliers = null;
}

export function invalidatePrepTasks() {
  cachedPrepTasks = null;
}

export function invalidateAll() {
  cachedToken = null;
  cachedEstablishment = null;
  cachedSuggestions = null;
  cachedSpan = null;
  cachedSuppliers = null;
  cachedPrepTasks = null;
}

// Prefetch tout en parallele — a appeler au premier chargement
let prefetched = false;
export async function prefetchAll(): Promise<void> {
  if (prefetched) return;
  prefetched = true;
  const token = await getToken();
  if (!token) return;
  await Promise.all([
    fetchEstablishment(),
    fetchSuggestions(),
    fetchSuppliers(),
    fetchPrepTasks(),
  ]);
}
