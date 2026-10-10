'use client'

import type { BrowserSupabaseClient } from '@/lib/supabase/client'

function base64UrlToUint8Array(value: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  const bytes = new Uint8Array(raw.length)
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index)
  return bytes
}

function deviceId(): string {
  const key = 'mgl:push-device-id'
  try {
    const stored = window.localStorage.getItem(key)
    if (stored) return stored
    const created = crypto.randomUUID()
    window.localStorage.setItem(key, created)
    return created
  } catch {
    return crypto.randomUUID()
  }
}

export function webPushAvailable(): boolean {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window
    && Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)
}

export async function enableWebPush(client: BrowserSupabaseClient, companyId: string): Promise<void> {
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!vapidPublicKey) throw new Error('Web Push no está configurado en este entorno.')
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    throw new Error('Este navegador no soporta Web Push.')
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Permiso de notificaciones no concedido.')

  const registration = await navigator.serviceWorker.ready
  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array(vapidPublicKey),
    })
  }

  const payload = subscription.toJSON()
  const p256dh = payload.keys?.p256dh
  const authKey = payload.keys?.auth
  if (!p256dh || !authKey) throw new Error('El navegador no devolvió las claves de la suscripción push.')

  const { error } = await client.rpc('upsert_push_subscription', {
    p_company_id: companyId,
    p_endpoint: subscription.endpoint,
    p_p256dh: p256dh,
    p_auth_key: authKey,
    p_device_id: deviceId(),
    p_user_agent: navigator.userAgent,
    p_enabled: true,
  })
  if (error) throw error
}

export async function disableWebPush(client: BrowserSupabaseClient, companyId: string): Promise<void> {
  if (!('serviceWorker' in navigator)) return
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  if (!subscription) return

  const payload = subscription.toJSON()
  const p256dh = payload.keys?.p256dh ?? ''
  const authKey = payload.keys?.auth ?? ''
  if (p256dh && authKey) {
    const { error } = await client.rpc('upsert_push_subscription', {
      p_company_id: companyId,
      p_endpoint: subscription.endpoint,
      p_p256dh: p256dh,
      p_auth_key: authKey,
      p_device_id: deviceId(),
      p_user_agent: navigator.userAgent,
      p_enabled: false,
    })
    if (error) throw error
  }
  await subscription.unsubscribe()
}
