/**
 * Helpers pour gérer les push notifications côté client.
 * Web Push standard : permission browser + Service Worker + PushManager.
 *
 * iOS Safari : ne fonctionne QUE si l'app est installée sur l'écran d'accueil
 * (Add to Home Screen). Sur Android (Chrome, Firefox), fonctionne en onglet normal.
 */

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
  return output;
}

export type PushSupportStatus =
  | 'supported'
  | 'unsupported-browser'
  | 'ios-needs-install'; // iOS pas installé → push impossible

export function pushSupportStatus(): PushSupportStatus {
  if (typeof window === 'undefined') return 'unsupported-browser';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    // iOS Safari hors PWA installée renvoie ici jusqu'à 16.4. Détection iOS pour message dédié.
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
    // @ts-expect-error standalone existe sur navigator iOS en mode PWA installée
    const isStandalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
    if (isIOS && !isStandalone) return 'ios-needs-install';
    return 'unsupported-browser';
  }
  return 'supported';
}

export async function ensureServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const existing = await navigator.serviceWorker.getRegistration('/sw.js');
    if (existing) return existing;
    return await navigator.serviceWorker.register('/sw.js');
  } catch {
    return null;
  }
}

/**
 * Demande la permission au navigateur (prompt natif) et souscrit au push.
 * Renvoie la subscription JSON-serialisable, ou null si refusé/erreur.
 */
export async function subscribeToPush(): Promise<PushSubscriptionJSON | null> {
  if (!VAPID_PUBLIC_KEY) {
    console.error('NEXT_PUBLIC_VAPID_PUBLIC_KEY manquante');
    return null;
  }
  if (pushSupportStatus() !== 'supported') return null;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;

  const reg = await ensureServiceWorker();
  if (!reg) return null;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      // PushManager veut un BufferSource. On passe le buffer sous-jacent.
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
    });
  }
  return sub.toJSON();
}

/**
 * Désouscrit le device courant (supprime la subscription côté navigateur).
 * Le serveur la nettoiera côté DB via /api/push/unsubscribe.
 */
export async function unsubscribeFromPush(): Promise<string | null> {
  if (!('serviceWorker' in navigator)) return null;
  const reg = await navigator.serviceWorker.getRegistration('/sw.js');
  if (!reg) return null;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return null;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  return endpoint;
}

export async function getCurrentSubscriptionEndpoint(): Promise<string | null> {
  if (!('serviceWorker' in navigator)) return null;
  const reg = await navigator.serviceWorker.getRegistration('/sw.js');
  if (!reg) return null;
  const sub = await reg.pushManager.getSubscription();
  return sub?.endpoint ?? null;
}
