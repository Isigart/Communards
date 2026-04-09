import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { MARKET_CONFIG, type Market } from '@/lib/types';

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
  const supabase = createServerClient();

  // Verify user
  const { data: { user }, error: authError } = await (await import('@/lib/supabase'))
    .createAuthClient(token)
    .auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const body = await req.json();
  const market = (body.market || 'fr') as Market;
  const config = MARKET_CONFIG[market];

  // Create establishment
  const { data: establishment, error: estError } = await supabase
    .from('establishments')
    .insert({
      user_id: user.id,
      name: body.name,
      employee_count: body.employee_count || 10,
      budget_per_meal: body.budget_per_meal || 3.5,
      market,
      currency: config.currency,
      language: config.language,
    })
    .select()
    .single();

  if (estError) {
    return NextResponse.json({ error: estError.message }, { status: 500 });
  }

  // Create primary supplier
  if (body.supplier_name && body.delivery_days) {
    await supabase.from('suppliers').insert({
      establishment_id: establishment.id,
      name: body.supplier_name,
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
