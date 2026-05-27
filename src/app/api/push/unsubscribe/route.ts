import { NextRequest, NextResponse } from 'next/server';
import { createAuthClient, createServerClient } from '@/lib/supabase';

/**
 * POST /api/push/unsubscribe
 * Body : { endpoint: string } — supprime UNE subscription précise.
 * Si endpoint absent, supprime toutes les subscriptions du user.
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Missing authorization' }, { status: 401 });
  }
  const token = authHeader.slice(7);
  const authClient = createAuthClient(token);
  const { data: { user }, error: authErr } = await authClient.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const supabase = createServerClient();

  let query = supabase.from('push_subscriptions').delete().eq('user_id', user.id);
  if (body?.endpoint) query = query.eq('endpoint', body.endpoint);

  const { error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
