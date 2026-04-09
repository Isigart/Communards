import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .eq('establishment_id', auth.establishment.id)
    .order('is_primary', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('suppliers')
    .insert({
      establishment_id: auth.establishment.id,
      name: body.name,
      delivery_days: body.delivery_days,
      category: body.category || 'general',
      is_primary: body.is_primary || false,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  if (!body.id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 });
  }

  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('suppliers')
    .update({
      name: body.name,
      delivery_days: body.delivery_days,
      category: body.category,
      is_primary: body.is_primary,
    })
    .eq('id', body.id)
    .eq('establishment_id', auth.establishment.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 });
  }

  const supabase = createServerClient();

  const { error } = await supabase
    .from('suppliers')
    .delete()
    .eq('id', id)
    .eq('establishment_id', auth.establishment.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
