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
      services: body.services || ['lunch'],
      dietary_constraints: body.dietary_constraints || [],
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
