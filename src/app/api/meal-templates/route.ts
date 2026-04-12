import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const templates = await req.json();

  if (!Array.isArray(templates)) {
    return NextResponse.json({ error: 'Expected array of templates' }, { status: 400 });
  }

  const rows = templates.map((t: Record<string, unknown>) => ({
    name: t.name,
    season: t.season,
    protein_type: t.protein_type,
    meal_type: t.meal_type,
    tags: t.tags || [],
    ingredients: t.ingredients,
    prep_notes: t.prep_notes || null,
    estimated_cost_per_person: t.estimated_cost_per_person,
    cost_level: t.cost_level || null,
  }));

  const { data, error } = await supabase
    .from('meal_templates')
    .insert(rows)
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ imported: data?.length || 0 });
}

export async function GET() {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('meal_templates')
    .select('*')
    .order('name');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
