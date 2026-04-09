import { NextRequest, NextResponse } from 'next/server';
import { createAuthClient, createServerClient } from './supabase';
import type { Establishment } from './types';

export interface AuthContext {
  userId: string;
  establishment: Establishment;
  supabase: ReturnType<typeof createAuthClient>;
}

export async function authenticate(req: NextRequest): Promise<AuthContext | NextResponse> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Missing authorization header' }, { status: 401 });
  }

  const token = authHeader.slice(7);
  const supabase = createAuthClient(token);

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const serverClient = createServerClient();
  const { data: establishment, error: estError } = await serverClient
    .from('establishments')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (estError || !establishment) {
    return NextResponse.json({ error: 'No establishment found' }, { status: 404 });
  }

  return {
    userId: user.id,
    establishment: establishment as Establishment,
    supabase,
  };
}
