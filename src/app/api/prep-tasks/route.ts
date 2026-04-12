import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('prep_tasks')
    .select('*')
    .eq('establishment_id', auth.establishment.id)
    .order('created_at', { ascending: true });

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
    .from('prep_tasks')
    .insert({
      establishment_id: auth.establishment.id,
      span_id: body.span_id,
      suggestion_id: body.suggestion_id || null,
      label: body.label,
      for_meal: body.for_meal || null,
      scheduled_day: body.scheduled_day || null,
      scheduled_slot: body.scheduled_slot || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  if (!body.id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 });
  }

  const supabase = createServerClient();
  const update: Record<string, unknown> = {};
  if (body.scheduled_day !== undefined) update.scheduled_day = body.scheduled_day;
  if (body.scheduled_slot !== undefined) update.scheduled_slot = body.scheduled_slot;
  if (body.done !== undefined) update.done = body.done;
  if (body.label !== undefined) update.label = body.label;

  const { data, error } = await supabase
    .from('prep_tasks')
    .update(update)
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
    .from('prep_tasks')
    .delete()
    .eq('id', id)
    .eq('establishment_id', auth.establishment.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
