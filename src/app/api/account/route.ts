import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';

export async function DELETE(req: NextRequest) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  const supabase = createServerClient();

  // RLS + cascade s'occupe du reste, mais on supprime aussi le user
  // L'establishment a un on delete cascade donc tout part avec
  const { error: estError } = await supabase
    .from('establishments')
    .delete()
    .eq('user_id', auth.userId);

  if (estError) {
    return NextResponse.json({ error: estError.message }, { status: 500 });
  }

  // Supprimer le user lui-meme (auth.users)
  const { error: userError } = await supabase.auth.admin.deleteUser(auth.userId);

  if (userError) {
    return NextResponse.json({ error: userError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
