import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';

export async function PATCH(req: NextRequest) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  const { suggestion_id, notes } = await req.json();
  if (!suggestion_id) {
    return NextResponse.json({ error: 'suggestion_id required' }, { status: 400 });
  }

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('suggestions')
    .update({ notes: notes || null })
    .eq('id', suggestion_id)
    .eq('establishment_id', auth.establishment.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
