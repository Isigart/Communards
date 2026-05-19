import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/auth';
import { createServerClient, createAuthClient } from '@/lib/supabase';
import { BUDGET_HCR } from '@/lib/types';

export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json(auth.establishment);
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Missing authorization' }, { status: 401 });
  }

  const token = authHeader.slice(7);
  const authClient = createAuthClient(token);
  const { data: { user }, error: authError } = await authClient.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const body = await req.json();
  const supabase = createServerClient();

  // dietary_counts est la source de vérité (compte par contrainte)
  // dietary_constraints est dérivé (clés actives) pour rétrocompat avec les écritures legacy
  const dietaryCounts: Record<string, number> = body.dietary_counts || {};
  const dietaryConstraints: string[] = body.dietary_constraints && body.dietary_constraints.length > 0
    ? body.dietary_constraints
    : Object.keys(dietaryCounts).filter((k) => (dietaryCounts[k] || 0) > 0);

  // lunch_days / dinner_days est la source de vérité (planning par jour).
  // services est dérivé pour rétrocompat.
  const lunchDays: number[] = Array.isArray(body.lunch_days) ? body.lunch_days : [1, 2, 3, 4, 5, 6, 0];
  const dinnerDays: number[] = Array.isArray(body.dinner_days) ? body.dinner_days : [];
  const derivedServices: string[] = body.services && body.services.length > 0
    ? body.services
    : [lunchDays.length > 0 ? 'lunch' : null, dinnerDays.length > 0 ? 'dinner' : null].filter(Boolean) as string[];

  // Create establishment with HCR budget
  const { data: establishment, error: estError } = await supabase
    .from('establishments')
    .insert({
      user_id: user.id,
      name: body.name,
      employee_count: body.employee_count || 10,
      budget_per_meal: BUDGET_HCR,
      market: body.market || 'fr',
      currency: 'EUR',
      language: 'fr',
      services: derivedServices,
      lunch_days: lunchDays,
      dinner_days: dinnerDays,
      dietary_constraints: dietaryConstraints,
      dietary_counts: dietaryCounts,
      include_dessert: typeof body.include_dessert === 'boolean' ? body.include_dessert : true,
    })
    .select()
    .single();

  if (estError) {
    return NextResponse.json({ error: estError.message }, { status: 500 });
  }

  // Create primary supplier with order/delivery days
  if (body.delivery_days && body.delivery_days.length > 0) {
    await supabase.from('suppliers').insert({
      establishment_id: establishment.id,
      name: body.supplier_name || 'Fournisseur principal',
      delivery_days: body.delivery_days,
      is_primary: true,
    });
  }

  return NextResponse.json(establishment, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('establishments')
    .update(body)
    .eq('id', auth.establishment.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
