import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { generateSuggestions } from '@/lib/claude';
import { setCache } from '@/lib/redis';
import type { SupplySpan } from '@/lib/types';

export const maxDuration = 30; // Vercel Pro: up to 60s

export async function POST(req: NextRequest) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  const { span_id } = await req.json();
  if (!span_id) {
    return NextResponse.json({ error: 'span_id required' }, { status: 400 });
  }

  const supabase = createServerClient();

  // Get span
  const { data: span } = await supabase
    .from('supply_spans')
    .select('*')
    .eq('id', span_id)
    .eq('establishment_id', auth.establishment.id)
    .single();

  if (!span) {
    return NextResponse.json({ error: 'Span not found' }, { status: 404 });
  }

  // Check if already generated
  const { data: existing } = await supabase
    .from('suggestions')
    .select('id')
    .eq('span_id', span_id)
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json({ status: 'already_generated' });
  }

  // Get recent feedback
  const { data: feedback } = await supabase
    .from('feedback')
    .select('*')
    .eq('establishment_id', auth.establishment.id)
    .order('created_at', { ascending: false })
    .limit(20);

  // Generate via Claude
  const generated = await generateSuggestions({
    establishment: auth.establishment,
    span: span as SupplySpan,
    pastFeedback: feedback || [],
  });

  // Store
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
  try { await setCache(cacheKey, suggestions, 3600); } catch { /* skip */ }

  return NextResponse.json({ status: 'generated', count: suggestions?.length || 0 });
}
