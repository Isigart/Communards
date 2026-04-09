import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/auth';
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

  // Find current span
  const { data: currentSpan } = await supabase
    .from('supply_spans')
    .select('*')
    .eq('establishment_id', auth.establishment.id)
    .lte('start_date', today)
    .gte('end_date', today)
    .single();

  if (!currentSpan) {
    return NextResponse.json({ span: null, suggestions: [] });
  }

  // Check cache
  const cacheKey = `suggestions:${auth.establishment.id}:${currentSpan.id}`;
  const cached = await getCached<Suggestion[]>(cacheKey);
  if (cached) {
    return NextResponse.json({ span: currentSpan, suggestions: cached });
  }

  // Fetch from DB
  const { data: suggestions } = await supabase
    .from('suggestions')
    .select('*')
    .eq('span_id', currentSpan.id)
    .order('meal_date', { ascending: true })
    .order('meal_type', { ascending: true });

  if (suggestions && suggestions.length > 0) {
    await setCache(cacheKey, suggestions, 3600);
    return NextResponse.json({ span: currentSpan, suggestions });
  }

  return NextResponse.json({ span: currentSpan, suggestions: [] });
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

  // Find or create the current span
  const today = new Date().toISOString().split('T')[0];
  const currentSpanDef = spanDefs.find(
    (s) => s.start_date <= today && s.end_date >= today
  ) || spanDefs[0];

  if (!currentSpanDef) {
    return NextResponse.json({ error: 'Could not determine current span' }, { status: 500 });
  }

  // Upsert span
  const { data: span, error: spanError } = await supabase
    .from('supply_spans')
    .upsert(
      {
        establishment_id: auth.establishment.id,
        supplier_id: supplier.id,
        start_date: currentSpanDef.start_date,
        end_date: currentSpanDef.end_date,
        day_count: currentSpanDef.day_count,
      },
      { onConflict: 'establishment_id,start_date' }
    )
    .select()
    .single();

  if (spanError || !span) {
    // Fallback: insert without upsert
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
      return NextResponse.json({ error: 'Failed to create span' }, { status: 500 });
    }

    return await generateAndStore(supabase, auth, newSpan, supplier);
  }

  return await generateAndStore(supabase, auth, span, supplier);
}

async function generateAndStore(
  supabase: ReturnType<typeof createServerClient>,
  auth: { establishment: { id: string } } & Record<string, unknown>,
  span: SupplySpan,
  supplier: { id: string }
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
    establishment: auth.establishment as Parameters<typeof generateSuggestions>[0]['establishment'],
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

  // Cache
  const cacheKey = `suggestions:${auth.establishment.id}:${span.id}`;
  await setCache(cacheKey, suggestions, 3600);

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
