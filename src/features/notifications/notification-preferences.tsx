'use client'

import { BellRing, Clock3, Mail, Smartphone, WifiOff } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { disableWebPush, enableWebPush, webPushAvailable } from './push'
import type { ReturnTypeUseNotifications } from './view-types'

function hhmm(value: string | null, fallback: string): string {
  return value?.slice(0, 5) || fallback
}

export function NotificationPreferences({ companyId, model }: { companyId: string; model: ReturnTypeUseNotifications }) {
  const client = useMemo(() => createClient(), [])
  const pref = model.preferences
  const [emailEnabled, setEmailEnabled] = useState(pref.email_enabled)
  const [pushEnabled, setPushEnabled] = useState(pref.push_enabled)
  const [quietEnabled, setQuietEnabled] = useState(pref.quiet_hours_enabled)
  const [quietStart, setQuietStart] = useState(hhmm(pref.quiet_start, '22:00'))
  const [quietEnd, setQuietEnd] = useState(hhmm(pref.quiet_end, '07:00'))
  const [saving, setSaving] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    setEmailEnabled(pref.email_enabled)
    setPushEnabled(pref.push_enabled)
    setQuietEnabled(pref.quiet_hours_enabled)
    setQuietStart(hhmm(pref.quiet_start, '22:00'))
    setQuietEnd(hhmm(pref.quiet_end, '07:00'))
  }, [pref.email_enabled, pref.push_enabled, pref.quiet_hours_enabled, pref.quiet_start, pref.quiet_end, pref.updated_at])

  async function persist(nextPush = pushEnabled) {
    setSaving(true)
    setMessage(null)
    try {
      const synced = await model.savePreferences({
        emailEnabled,
        pushEnabled: nextPush,
        quietHoursEnabled: quietEnabled,
        quietStart: quietEnabled ? `${quietStart}:00` : null,
        quietEnd: quietEnabled ? `${quietEnd}:00` : null,
        timezone: pref.timezone,
      })
      setMessage(synced ? 'Preferencias guardadas' : 'Guardado sin conexión')
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'No se pudieron guardar las preferencias.')
    } finally {
      setSaving(false)
    }
  }

  async function togglePush() {
    setPushBusy(true)
    setMessage(null)
    try {
      const next = !pushEnabled
      if (next) await enableWebPush(client, companyId)
      else await disableWebPush(client, companyId)
      setPushEnabled(next)
      const synced = await model.savePreferences({
        emailEnabled,
        pushEnabled: next,
        quietHoursEnabled: quietEnabled,
        quietStart: quietEnabled ? `${quietStart}:00` : null,
        quietEnd: quietEnabled ? `${quietEnd}:00` : null,
        timezone: pref.timezone,
      })
      setMessage(synced
        ? (next ? 'Push activado' : 'Push desactivado')
        : 'Guardado sin conexión')
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'No se pudo cambiar Web Push.')
    } finally {
      setPushBusy(false)
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="grid size-10 place-items-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600">
          <BellRing className="size-5" strokeWidth={1.5} />
        </div>
        <div>
          <h2 className="text-lg font-medium text-slate-950">Preferencias</h2>
          <p className="mt-1 text-sm text-slate-500">In-app siempre queda activo como fuente de verdad.</p>
        </div>
      </div>

      <div className="mt-5 divide-y divide-slate-100">
        <label className="flex items-center gap-3 py-4">
          <Mail className="size-4 text-slate-500" strokeWidth={1.5} />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-slate-800">Email</span>
            <span className="mt-0.5 block text-xs text-slate-500">Se programa 5 minutos después; si lees el aviso antes, no se envía.</span>
          </span>
          <input type="checkbox" checked={emailEnabled} onChange={(event) => setEmailEnabled(event.target.checked)} className="size-4 accent-blue-600" />
        </label>

        <div className="flex items-center gap-3 py-4">
          <Smartphone className="size-4 text-slate-500" strokeWidth={1.5} />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-slate-800">Web Push</span>
            <span className="mt-0.5 block text-xs text-slate-500">
              {webPushAvailable() ? 'Opcional por dispositivo.' : 'Opcional · requiere VAPID configurado en el entorno.'}
            </span>
          </span>
          <Button type="button" variant="secondary" size="sm" disabled={pushBusy || !webPushAvailable()} onClick={() => void togglePush()}>
            {pushEnabled ? 'Desactivar' : 'Activar'}
          </Button>
        </div>

        <div className="py-4">
          <label className="flex items-center gap-3">
            <Clock3 className="size-4 text-slate-500" strokeWidth={1.5} />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-slate-800">Horas silenciosas</span>
              <span className="mt-0.5 block text-xs text-slate-500">Email y push esperan hasta que termine la ventana. Los avisos in-app siguen visibles.</span>
            </span>
            <input type="checkbox" checked={quietEnabled} onChange={(event) => setQuietEnabled(event.target.checked)} className="size-4 accent-blue-600" />
          </label>
          {quietEnabled ? (
            <div className="mt-3 grid grid-cols-2 gap-3 pl-7">
              <label className="text-xs font-medium text-slate-600">Desde
                <input type="time" value={quietStart} onChange={(event) => setQuietStart(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-blue-500" />
              </label>
              <label className="text-xs font-medium text-slate-600">Hasta
                <input type="time" value={quietEnd} onChange={(event) => setQuietEnd(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-blue-500" />
              </label>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <span className="text-xs text-slate-500">
          {!model.online ? <span className="inline-flex items-center gap-1 text-amber-700"><WifiOff className="size-3.5" />Modo offline</span> : model.preferences.pending_sync ? 'Pendiente de sincronizar' : ''}
        </span>
        <Button type="button" onClick={() => void persist()} disabled={saving}>{saving ? 'Guardando…' : 'Guardar preferencias'}</Button>
      </div>
      {message ? <p className="mt-2 text-xs text-slate-500">{message}</p> : null}
    </section>
  )
}
