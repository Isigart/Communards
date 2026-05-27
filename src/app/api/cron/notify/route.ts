import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { sendPush, type PushPayload, type PushTarget } from '@/lib/push-server';

/**
 * Cron endpoint déclenché par Vercel Cron tous les matins à 07h00 (Paris).
 * Voir vercel.json — schedule: "0 5 * * *" (UTC).
 *
 * Pour chaque établissement :
 *   - Si notify_order_day=true ET aujourd'hui est dans supplier.delivery_days
 *     → push "Pense à passer la commande !"
 *   - Si notify_daily_menu=true → push "Menu du jour : <repas>"
 *
 * Auth : Vercel Cron envoie un header `Authorization: Bearer ${CRON_SECRET}`.
 * En GET (test manuel) ou POST, on accepte aussi `?key=` pour debug.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function handle(req: NextRequest): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');
  const queryKey = req.nextUrl.searchParams.get('key');
  const provided = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : queryKey;

  if (cronSecret && provided !== cronSecret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const supabase = createServerClient();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = formatDate(today);
  const dayOfWeek = today.getDay(); // 0=Dim, 1=Lun, ...

  // 1. Charger les établissements qui ont au moins une notif activée
  const { data: establishments, error: estErr } = await supabase
    .from('establishments')
    .select('id, name, user_id, notify_order_day, notify_daily_menu')
    .or('notify_order_day.eq.true,notify_daily_menu.eq.true');

  if (estErr) {
    return NextResponse.json({ error: estErr.message }, { status: 500 });
  }

  let sent = 0;
  let cleaned = 0;
  const errors: string[] = [];

  for (const est of establishments || []) {
    const messages: PushPayload[] = [];

    // ---- Order day reminder
    if (est.notify_order_day) {
      const { data: supplier } = await supabase
        .from('suppliers')
        .select('delivery_days, name')
        .eq('establishment_id', est.id)
        .eq('is_primary', true)
        .maybeSingle();

      const deliveryDays: number[] = supplier?.delivery_days || [];
      if (deliveryDays.includes(dayOfWeek)) {
        messages.push({
          title: 'Jour de commande',
          body: `Pense à passer ta commande ${supplier?.name || ''} aujourd'hui.`,
          url: '/dashboard',
          tag: `order-${est.id}-${todayStr}`,
        });
      }
    }

    // ---- Daily menu
    if (est.notify_daily_menu) {
      const { data: meals } = await supabase
        .from('suggestions')
        .select('meal_type, ingredients')
        .eq('establishment_id', est.id)
        .eq('meal_date', todayStr)
        .order('meal_type', { ascending: true });

      if (meals && meals.length > 0) {
        const body = meals.map((m) => {
          const ings = (m.ingredients as { name: string; category: string }[]) || [];
          const main = ings.find((i) => i.category === 'proteine')?.name || ings[0]?.name || '';
          return `${m.meal_type === 'lunch' ? '🥗' : '🌙'} ${main}`;
        }).join('  ·  ');

        messages.push({
          title: 'Menu du jour',
          body,
          url: '/dashboard',
          tag: `menu-${est.id}-${todayStr}`,
        });
      }
    }

    if (messages.length === 0) continue;

    // 2. Récupérer les subscriptions du user et envoyer chaque message à chaque device
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', est.user_id);

    for (const sub of (subs as PushTarget[] | null) || []) {
      for (const msg of messages) {
        const result = await sendPush(sub, msg);
        if (result.ok) sent++;
        if (result.gone) {
          // Subscription révoquée par le navigateur → nettoyer
          await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
          cleaned++;
        }
      }
    }
  }

  return NextResponse.json({
    ok: true,
    establishments_processed: establishments?.length || 0,
    notifications_sent: sent,
    subscriptions_cleaned: cleaned,
    errors,
  });
}

function formatDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export async function GET(req: NextRequest) { return handle(req); }
export async function POST(req: NextRequest) { return handle(req); }
