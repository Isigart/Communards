/**
 * Helpers serveur pour envoyer des push notifications (web-push protocol).
 * VAPID keys lues depuis l'env. Lazy init pour éviter de planter le build
 * si les keys manquent (notification = no-op silencieux).
 */
import webpush from 'web-push';

let configured = false;

function ensureConfigured(): boolean {
  if (configured) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:noreply@example.com';
  if (!pub || !priv) {
    console.warn('VAPID keys absentes — push notifications désactivées');
    return false;
  }
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
  return true;
}

export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/**
 * Envoie une notification à un device. Renvoie true si OK,
 * false sinon (subscription expirée ou invalide → à nettoyer côté DB).
 * Codes 404/410 = subscription révoquée par le navigateur.
 */
export async function sendPush(target: PushTarget, payload: PushPayload): Promise<{ ok: boolean; gone: boolean }> {
  if (!ensureConfigured()) return { ok: false, gone: false };

  try {
    await webpush.sendNotification(
      {
        endpoint: target.endpoint,
        keys: { p256dh: target.p256dh, auth: target.auth },
      },
      JSON.stringify(payload),
      { TTL: 60 * 60 * 12 } // 12h
    );
    return { ok: true, gone: false };
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    const gone = status === 404 || status === 410;
    if (!gone) console.error('sendPush failed:', e);
    return { ok: false, gone };
  }
}
