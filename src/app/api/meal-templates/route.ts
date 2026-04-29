import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

// v3 (29/04/2026) : 1 carte = 1 repas avec 3-5 ingredients dont dessert.
// Champs supprimés du schema : season, protein_type, meal_type
// Champs ajoutés : saison TEXT[], categorie_gemrcn, contains_porc/gluten/lactose, halal_compatible

export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const templates = await req.json();

  if (!Array.isArray(templates)) {
    return NextResponse.json({ error: 'Expected array of templates' }, { status: 400 });
  }

  const rows = templates.map((t: Record<string, unknown>) => ({
    template_type: 'repas',
    name: t.name,
    categorie_gemrcn: t.categorie_gemrcn,
    is_vegetarien: (t.is_vegetarien as boolean) ?? false,
    is_vegan: (t.is_vegan as boolean) ?? false,
    contains_porc: (t.contains_porc as boolean) ?? false,
    contains_gluten: (t.contains_gluten as boolean) ?? false,
    contains_lactose: (t.contains_lactose as boolean) ?? false,
    halal_compatible: (t.halal_compatible as boolean) ?? true,
    saison: t.saison || ['toutes'],
    tags: t.tags || [],
    ingredients: t.ingredients,
    estimated_cost_per_person: t.estimated_cost_per_person,
    cost_level: t.cost_level || 'moyen',
    source_lot: (t.source_lot as number) ?? 1,
    generation_method: (t.generation_method as string) ?? 'api_import',
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
