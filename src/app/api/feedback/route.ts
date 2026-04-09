import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { invalidateCache } from '@/lib/redis';

export async function POST(req: NextRequest) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  const { suggestion_id, status, actual_ingredients, notes } = await req.json();

  if (!suggestion_id || !status) {
    return NextResponse.json({ error: 'suggestion_id and status required' }, { status: 400 });
  }

  if (!['done', 'modified', 'skipped'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('feedback')
    .insert({
      suggestion_id,
      establishment_id: auth.establishment.id,
      status,
      actual_ingredients: actual_ingredients || null,
      notes: notes || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Invalidate suggestions cache so next generation considers this feedback
  await invalidateCache(`suggestions:${auth.establishment.id}:*`);

  return NextResponse.json(data, { status: 201 });
}

export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  const supabase = createServerClient();
  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get('limit') || '50');

  const { data, error } = await supabase
    .from('feedback')
    .select('*, suggestions(meal_date, meal_type, ingredients)')
    .eq('establishment_id', auth.establishment.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
