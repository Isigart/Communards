import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { getCached, setCache } from '@/lib/redis';
import { generateWeekSpans } from '@/lib/spans';
import type { Suggestion, SupplySpan } from '@/lib/types';

export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  const supabase = createServerClient();
  const today = new Date().toISOString().split('T')[0];

  // Find current or most recent span
  const { data: currentSpan } = await supabase
    .from('supply_spans')
    .select('*')
    .eq('establishment_id', auth.establishment.id)
    .lte('start_date', today)
    .gte('end_date', today)
    .single();

  const span = currentSpan || (await supabase
    .from('supply_spans')
    .select('*')
    .eq('establishment_id', auth.establishment.id)
    .order('start_date', { ascending: false })
    .limit(1)
    .single()).data;

  if (!span) {
    return NextResponse.json({ span: null, suggestions: [], status: 'empty' });
  }

  // Check cache
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

  // Generate spans for this week
  const weekStart = getWeekStart(new Date());
  const spanDefs = generateWeekSpans(supplier, weekStart);

  const today = new Date().toISOString().split('T')[0];
  const currentSpanDef = spanDefs.find(
    (s) => s.start_date <= today && s.end_date >= today
  ) || spanDefs[0];

  if (!currentSpanDef) {
    return NextResponse.json({ error: 'Could not determine current span' }, { status: 500 });
  }

  // If regenerate, clean up old data
  if (forceRegenerate) {
    const { data: oldSpan } = await supabase
      .from('supply_spans')
      .select('id')
      .eq('establishment_id', auth.establishment.id)
      .eq('start_date', currentSpanDef.start_date)
      .single();

    if (oldSpan) {
      await supabase.from('suggestions').delete().eq('span_id', oldSpan.id);
      await supabase.from('supply_spans').delete().eq('id', oldSpan.id);
    }
    // Also clear cache
    try {
      const { invalidateCache } = await import('@/lib/redis');
      await invalidateCache(`suggestions:${auth.establishment.id}:*`);
    } catch { /* skip */ }
  }

  // Check if span already exists with suggestions
  const { data: existingSpan } = await supabase
    .from('supply_spans')
    .select('*')
    .eq('establishment_id', auth.establishment.id)
    .eq('start_date', currentSpanDef.start_date)
    .single();

  if (existingSpan) {
    const { data: existingSuggestions } = await supabase
      .from('suggestions')
      .select('*')
      .eq('span_id', existingSpan.id);

    if (existingSuggestions && existingSuggestions.length > 0) {
      return NextResponse.json({ span: existingSpan, status: 'ready' });
    }
    // Span exists but no suggestions — return span_id for generation
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

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
