import { NextRequest, NextResponse } from 'next/server';
import { authenticate, type AuthContext } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { getCached, setCache } from '@/lib/redis';
import { generateSuggestions } from '@/lib/claude';
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

  // If no span covers today, get the most recent one
  const span = currentSpan || (await supabase
    .from('supply_spans')
    .select('*')
    .eq('establishment_id', auth.establishment.id)
    .order('start_date', { ascending: false })
    .limit(1)
    .single()).data;

  if (!span) {
    return NextResponse.json({ span: null, suggestions: [] });
  }

  // Check cache
  const cacheKey = `suggestions:${auth.establishment.id}:${span.id}`;
  try {
    const cached = await getCached<Suggestion[]>(cacheKey);
    if (cached) {
      return NextResponse.json({ span, suggestions: cached });
    }
  } catch {
    // Redis error, skip cache
  }

  // Fetch from DB
  const { data: suggestions } = await supabase
    .from('suggestions')
    .select('*')
    .eq('span_id', span.id)
    .order('meal_date', { ascending: true })
    .order('meal_type', { ascending: true });

  if (suggestions && suggestions.length > 0) {
    try { await setCache(cacheKey, suggestions, 3600); } catch { /* skip */ }
    return NextResponse.json({ span, suggestions });
  }

  return NextResponse.json({ span, suggestions: [] });
}

export async function POST(req: NextRequest) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  const supabase = createServerClient();

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

  // Find span that covers today, or use the first one
  const today = new Date().toISOString().split('T')[0];
  const currentSpanDef = spanDefs.find(
    (s) => s.start_date <= today && s.end_date >= today
  ) || spanDefs[0];

  if (!currentSpanDef) {
    return NextResponse.json({ error: 'Could not determine current span' }, { status: 500 });
  }

  // Check if span already exists
  const { data: existingSpan } = await supabase
    .from('supply_spans')
    .select('*')
    .eq('establishment_id', auth.establishment.id)
    .eq('start_date', currentSpanDef.start_date)
    .single();

  let span: SupplySpan;

  // Check if regeneration is requested
  let forceRegenerate = false;
  try {
    const body = await req.json();
    forceRegenerate = body?.regenerate === true;
  } catch {
    // No body or invalid JSON, that's fine
  }

  if (existingSpan) {
    span = existingSpan as SupplySpan;

    if (forceRegenerate) {
      // Delete old suggestions for this span
      await supabase.from('suggestions').delete().eq('span_id', span.id);
      // Delete the span itself to recreate
      await supabase.from('supply_spans').delete().eq('id', span.id);
      // Create new span
      const { data: newSpan } = await supabase
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
      if (!newSpan) {
        return NextResponse.json({ error: 'Failed to recreate span' }, { status: 500 });
      }
      span = newSpan as SupplySpan;
      return await generateAndStore(supabase, auth, span);
    }

    // Check if suggestions already exist for this span
    const { data: existingSuggestions } = await supabase
      .from('suggestions')
      .select('*')
      .eq('span_id', span.id);

    if (existingSuggestions && existingSuggestions.length > 0) {
      return NextResponse.json({ span, suggestions: existingSuggestions });
    }
  } else {
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
      return NextResponse.json({ error: 'Failed to create span: ' + (spanError?.message || 'unknown') }, { status: 500 });
    }
    span = newSpan as SupplySpan;
  }

  return await generateAndStore(supabase, auth, span);
}

async function generateAndStore(
  supabase: ReturnType<typeof createServerClient>,
  auth: AuthContext,
  span: SupplySpan,
) {
  // Get recent feedback for learning
  const { data: feedback } = await supabase
    .from('feedback')
    .select('*')
    .eq('establishment_id', auth.establishment.id)
    .order('created_at', { ascending: false })
    .limit(20);

  // Generate suggestions via Claude
  const generated = await generateSuggestions({
    establishment: auth.establishment,
    span,
    pastFeedback: feedback || [],
  });

  // Store suggestions
  const rows = generated.map((s) => ({
    ...s,
    span_id: span.id,
    establishment_id: auth.establishment.id,
  }));

  const { data: suggestions, error } = await supabase
    .from('suggestions')
    .insert(rows)
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Cache (ignore errors)
  const cacheKey = `suggestions:${auth.establishment.id}:${span.id}`;
  try { await setCache(cacheKey, suggestions, 3600); } catch { /* skip */ }

  return NextResponse.json({ span, suggestions }, { status: 201 });
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
