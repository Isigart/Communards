import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { getCached, setCache } from '@/lib/redis';
import type { Suggestion, SupplySpan } from '@/lib/types';

// Format YYYY-MM-DD en heure LOCALE (jamais toISOString — convertit en UTC et décale les dates en CEST)
function formatDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  const supabase = createServerClient();
  const today = formatDate(new Date());

  // Stratégie : on cherche le span le plus pertinent pour aujourd'hui
  // Priorité : (1) span actif AVEC suggestions, (2) span futur le plus proche AVEC suggestions,
  // (3) span actif sans suggestions, (4) tout span le plus récent en fallback
  const { data: allSpans } = await supabase
    .from('supply_spans')
    .select('*, suggestions(id)')
    .eq('establishment_id', auth.establishment.id)
    .order('start_date', { ascending: true });

  type SpanWithSugs = SupplySpan & { suggestions: { id: string }[] };
  const spans = (allSpans as SpanWithSugs[] | null) || [];

  // Span actif avec suggestions
  let span: SupplySpan | null = spans.find(
    (s) => s.start_date <= today && s.end_date >= today && s.suggestions.length > 0
  ) || null;

  // Sinon, span futur le plus proche avec suggestions
  if (!span) {
    span = spans.find(
      (s) => s.start_date > today && s.suggestions.length > 0
    ) || null;
  }

  // Sinon, span actif même vide (pour pouvoir générer)
  if (!span) {
    span = spans.find(
      (s) => s.start_date <= today && s.end_date >= today
    ) || null;
  }

  // Sinon, dernier span créé en fallback ultime
  if (!span && spans.length > 0) {
    span = spans[spans.length - 1];
  }

  if (!span) {
    return NextResponse.json({ span: null, suggestions: [], status: 'empty' });
  }

  // Cache
  const cacheKey = `suggestions:${auth.establishment.id}:${span.id}`;
  try {
    const cached = await getCached<Suggestion[]>(cacheKey);
    if (cached) {
      return NextResponse.json({ span, suggestions: cached, status: 'ready' });
    }
  } catch { /* skip */ }

  // Fetch from DB
  const { data: suggestions } = await supabase
    .from('suggestions')
    .select('*')
    .eq('span_id', span.id)
    .order('meal_date', { ascending: true })
    .order('meal_type', { ascending: true });

  if (suggestions && suggestions.length > 0) {
    try { await setCache(cacheKey, suggestions, 3600); } catch { /* skip */ }
    return NextResponse.json({ span, suggestions, status: 'ready' });
  }

  return NextResponse.json({ span, suggestions: [], status: 'pending' });
}

export async function POST(req: NextRequest) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  const supabase = createServerClient();

  // Check if regeneration is requested
  let forceRegenerate = false;
  try {
    const body = await req.json();
    forceRegenerate = body?.regenerate === true;
  } catch { /* no body */ }

  // Get primary supplier
  const { data: supplier } = await supabase
    .from('suppliers')
    .select('*')
    .eq('establishment_id', auth.establishment.id)
    .eq('is_primary', true)
    .single();

  if (!supplier) {
    return NextResponse.json({ error: 'No primary supplier configured' }, { status: 400 });
  }

  const planningDays = auth.establishment.planning_days || 7;
  const orderDays: number[] = supplier.delivery_days || [];

  if (orderDays.length === 0) {
    return NextResponse.json({ error: 'No order days configured' }, { status: 400 });
  }

  // === Logique span v2 ===
  // Le span DOIT démarrer aujourd'hui (ou demain si aujourd'hui est jour de commande,
  // parce qu'on attend la livraison). Et finir au prochain jour de commande qui couvre
  // au moins planningDays jours. Comme ça le user voit immédiatement le menu du jour.
  const today = new Date();
  today.setHours(12, 0, 0, 0); // midi pour éviter tout décalage TZ

  const startDate = new Date(today);
  // Si today est un jour de commande, démarrer demain (livraison + cuisson)
  if (orderDays.includes(startDate.getDay())) {
    startDate.setDate(startDate.getDate() + 1);
  }

  // End = on couvre au moins planningDays, puis on étend jusqu'au prochain jour de commande inclus
  const endDate = new Date(startDate);
  let coveredDays = 1;
  while (coveredDays < planningDays) {
    endDate.setDate(endDate.getDate() + 1);
    coveredDays++;
  }
  // Si on a couvert assez de jours mais qu'on n'est pas sur un jour de commande,
  // continuer jusqu'au prochain jour de commande pour fermer proprement
  while (!orderDays.includes(endDate.getDay())) {
    endDate.setDate(endDate.getDate() + 1);
    coveredDays++;
  }

  const currentSpanDef = {
    start_date: formatDate(startDate),
    end_date: formatDate(endDate),
    day_count: coveredDays,
  };

  // === Cleanup en mode regenerate ===
  // On vire TOUS les anciens spans + leurs suggestions de cet établissement
  // (l'ancien comportement ne supprimait que le span qui matchait exactement le start_date,
  // ce qui laissait des spans orphelins qui polluaient la lecture côté planning)
  if (forceRegenerate) {
    const { data: allOldSpans } = await supabase
      .from('supply_spans')
      .select('id')
      .eq('establishment_id', auth.establishment.id);

    if (allOldSpans && allOldSpans.length > 0) {
      const ids = allOldSpans.map((s) => s.id);
      await supabase.from('suggestions').delete().in('span_id', ids);
      await supabase.from('supply_spans').delete().in('id', ids);
    }

    // Clear cache
    try {
      const { invalidateCache } = await import('@/lib/redis');
      await invalidateCache(`suggestions:${auth.establishment.id}:*`);
    } catch { /* skip */ }
  }

  // Check if span already exists with suggestions (mode non-regenerate)
  const { data: existingSpan } = await supabase
    .from('supply_spans')
    .select('*')
    .eq('establishment_id', auth.establishment.id)
    .eq('start_date', currentSpanDef.start_date)
    .maybeSingle();

  if (existingSpan) {
    const { data: existingSuggestions } = await supabase
      .from('suggestions')
      .select('*')
      .eq('span_id', existingSpan.id);

    if (existingSuggestions && existingSuggestions.length > 0) {
      return NextResponse.json({ span: existingSpan, status: 'ready' });
    }
    return NextResponse.json({ span: existingSpan, status: 'pending' });
  }

  // Create new span
  const { data: newSpan, error: spanError } = await supabase
    .from('supply_spans')
    .insert({
      establishment_id: auth.establishment.id,
      supplier_id: supplier.id,
      start_date: currentSpanDef.start_date,
      end_date: currentSpanDef.end_date,
      day_count: currentSpanDef.day_count,
    })
    .select()
    .single();

  if (spanError || !newSpan) {
    return NextResponse.json({ error: 'Failed to create span' }, { status: 500 });
  }

  return NextResponse.json({ span: newSpan, status: 'pending' });
}
