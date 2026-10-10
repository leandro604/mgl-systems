// MGL Systems · Tarea 9
// Worker idempotente para notification_deliveries (email + Web Push).
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

type Delivery = {
  id: string
  company_id: string
  notification_id: string
  recipient_id: string
  channel: 'email' | 'push'
  status: 'pending' | 'scheduled' | 'sent' | 'skipped' | 'failed'
  attempt_count: number
}

type NotificationRow = {
  id: string
  recipient_id: string
  title: string
  body: string
  action_url: string | null
  read_at: string | null
  deleted_at: string | null
}

const jsonHeaders = { 'content-type': 'application/json; charset=utf-8' }

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders })
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function safeActionUrl(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/notificaciones'
  return value
}

function absoluteActionUrl(value: string | null): string | null {
  const base = Deno.env.get('MGL_APP_URL')?.replace(/\/$/, '')
  return base ? `${base}${safeActionUrl(value)}` : null
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const workerToken = Deno.env.get('MGL_NOTIFICATION_WORKER_TOKEN')
  if (!workerToken) return json({ error: 'worker_not_configured' }, 503)
  if (req.headers.get('x-mgl-worker-token') !== workerToken) return json({ error: 'unauthorized' }, 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) return json({ error: 'supabase_worker_env_missing' }, 500)

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: claimed, error: claimError } = await supabase.rpc('claim_notification_deliveries', { p_limit: 25 })
  if (claimError) return json({ error: 'claim_failed', detail: claimError.message }, 500)

  const deliveries = (Array.isArray(claimed) ? claimed : []) as Delivery[]
  const counters = { claimed: deliveries.length, sent: 0, skipped: 0, failed: 0, retried: 0 }

  async function finish(
    delivery: Delivery,
    status: 'sent' | 'skipped' | 'failed',
    providerMessageId: string | null,
    error: string | null,
    retrySeconds: number | null = null,
  ) {
    const { error: finishError } = await supabase.rpc('finish_notification_delivery', {
      p_delivery_id: delivery.id,
      p_status: status,
      p_provider_message_id: providerMessageId,
      p_error: error,
      p_retry_after_seconds: retrySeconds,
    })
    if (finishError) throw finishError
    if (retrySeconds !== null) counters.retried += 1
    else counters[status] += 1
  }

  async function retryOrFail(delivery: Delivery, message: string, retrySeconds = 300) {
    if (delivery.attempt_count >= 6) await finish(delivery, 'failed', null, message)
    else await finish(delivery, 'failed', null, message, retrySeconds)
  }

  for (const delivery of deliveries) {
    try {
      const { data: notification, error: notificationError } = await supabase
        .from('notifications')
        .select('id,recipient_id,title,body,action_url,read_at,deleted_at')
        .eq('id', delivery.notification_id)
        .eq('recipient_id', delivery.recipient_id)
        .maybeSingle()

      if (notificationError) throw notificationError
      const notice = notification as NotificationRow | null
      if (!notice || notice.deleted_at) {
        await finish(delivery, 'skipped', null, 'notification_unavailable')
        continue
      }
      if (notice.read_at) {
        await finish(delivery, 'skipped', null, 'read_in_app_before_delivery')
        continue
      }

      if (delivery.channel === 'email') {
        const resendKey = Deno.env.get('RESEND_API_KEY')
        const from = Deno.env.get('RESEND_FROM_EMAIL')
        if (!resendKey || !from) {
          await retryOrFail(delivery, 'resend_not_configured', 3600)
          continue
        }

        const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(delivery.recipient_id)
        if (authError) throw authError
        const email = authUser.user?.email
        if (!email) {
          await finish(delivery, 'skipped', null, 'recipient_email_unavailable')
          continue
        }

        const href = absoluteActionUrl(notice.action_url)
        const actionHtml = href
          ? `<p style="margin:24px 0 0"><a href="${escapeHtml(href)}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600">Abrir en MGL Systems</a></p>`
          : ''
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            authorization: `Bearer ${resendKey}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            from,
            to: [email],
            subject: notice.title,
            html: `<div style="font-family:Inter,Arial,sans-serif;max-width:600px;color:#0f172a"><h2 style="font-size:20px;margin:0 0 12px">${escapeHtml(notice.title)}</h2><p style="font-size:14px;line-height:1.6;color:#475569">${escapeHtml(notice.body)}</p>${actionHtml}<p style="margin-top:28px;font-size:12px;color:#94a3b8">MGL Systems · aviso automático</p></div>`,
          }),
        })
        const body = await response.json().catch(() => ({})) as { id?: string; message?: string }
        if (response.ok) {
          await finish(delivery, 'sent', typeof body.id === 'string' ? body.id : null, null)
        } else if (response.status === 429 || response.status >= 500) {
          await retryOrFail(delivery, `resend_${response.status}:${body.message ?? 'temporary_error'}`, response.status === 429 ? 600 : 300)
        } else {
          await finish(delivery, 'failed', null, `resend_${response.status}:${body.message ?? 'provider_error'}`)
        }
        continue
      }

      const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY')
      const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY')
      const vapidSubject = Deno.env.get('VAPID_SUBJECT')
      if (!vapidPublic || !vapidPrivate || !vapidSubject) {
        await retryOrFail(delivery, 'vapid_not_configured', 3600)
        continue
      }
      webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate)

      const { data: subscriptions, error: subscriptionsError } = await supabase
        .from('push_subscriptions')
        .select('id,endpoint,p256dh,auth_key')
        .eq('company_id', delivery.company_id)
        .eq('user_id', delivery.recipient_id)
        .eq('enabled', true)
        .is('deleted_at', null)
      if (subscriptionsError) throw subscriptionsError
      if (!subscriptions?.length) {
        await finish(delivery, 'skipped', null, 'no_active_push_subscription')
        continue
      }

      const payload = JSON.stringify({
        notification_id: notice.id,
        title: notice.title,
        body: notice.body,
        action_url: safeActionUrl(notice.action_url),
      })
      let successful = 0
      let transient = false

      for (const subscription of subscriptions) {
        try {
          await webpush.sendNotification({
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth_key },
          }, payload, { TTL: 300, urgency: 'normal' })
          successful += 1
        } catch (cause) {
          const statusCode = typeof cause === 'object' && cause !== null && 'statusCode' in cause
            ? Number((cause as { statusCode?: unknown }).statusCode)
            : 0
          if (statusCode === 404 || statusCode === 410) {
            await supabase.from('push_subscriptions').update({
              enabled: false,
              updated_at: new Date().toISOString(),
              mutation_id: crypto.randomUUID(),
            }).eq('id', subscription.id)
          } else {
            transient = true
          }
        }
      }

      if (successful > 0) await finish(delivery, 'sent', `webpush:${successful}`, null)
      else if (transient) await retryOrFail(delivery, 'webpush_temporary_error', 300)
      else await finish(delivery, 'skipped', null, 'push_subscriptions_expired')
    } catch (cause) {
      try {
        await retryOrFail(delivery, errorMessage(cause), 300)
      } catch {
        counters.failed += 1
      }
    }
  }

  return json(counters)
})
