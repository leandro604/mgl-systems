import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

type Obj = Record<string, unknown>

function object(value: unknown): value is Obj {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

async function hmac(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)))
}

function constantTimeHexEqual(expected: string, actual: string): boolean {
  if (expected.length !== actual.length) return false
  let difference = 0
  for (let index = 0; index < expected.length; index += 1) {
    difference |= expected.charCodeAt(index) ^ actual.charCodeAt(index)
  }
  return difference === 0
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method_not_allowed', { status: 405 })

  const secret = Deno.env.get('INTIFACT_WEBHOOK_SECRET')
  if (!secret) return new Response('webhook_not_configured', { status: 503 })

  const signature = req.headers.get('x-facturacion-signature') ?? ''
  const timestamp = req.headers.get('x-facturacion-timestamp') ?? ''
  const timestampMs = Number(timestamp)
  const raw = await req.text()

  if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > 5 * 60 * 1000) {
    return new Response('expired_timestamp', { status: 401 })
  }

  const expected = await hmac(secret, `${timestamp}.${raw}`)
  if (!constantTimeHexEqual(expected, signature.toLowerCase())) {
    return new Response('invalid_signature', { status: 401 })
  }

  let payload: unknown
  try {
    payload = JSON.parse(raw)
  } catch {
    return new Response('invalid_payload', { status: 400 })
  }

  if (!object(payload)) return new Response('invalid_payload', { status: 400 })
  const data = object(payload.data) ? payload.data : payload
  const event = typeof payload.event === 'string' ? payload.event : ''

  const documentId =
    typeof data.id === 'string'
      ? data.id
      : typeof data.documentId === 'string'
        ? data.documentId
        : typeof data.document_id === 'string'
          ? data.document_id
          : null
  if (!documentId) return new Response('ok', { status: 200 })

  const statusRaw =
    typeof data.estado === 'string'
      ? data.estado
      : event === 'document.accepted'
        ? 'ACEPTADO'
        : event === 'document.rejected'
          ? 'RECHAZADO'
          : event === 'document.queue_failed'
            ? 'COLA_FALLIDA'
            : 'UNKNOWN'

  const url = Deno.env.get('SUPABASE_URL')
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY')
  if (!url || !service) return new Response('server_config_error', { status: 500 })

  const db = createClient(url, service, { auth: { persistSession: false } })
  const upper = statusRaw.toUpperCase()
  const status = upper.includes('ACEPT')
    ? 'accepted'
    : upper.includes('RECHAZ')
      ? 'rejected'
      : upper.includes('ANUL')
        ? 'voided'
        : upper.includes('ENCOL') || upper.includes('ENVIANDO') || upper.includes('PROCES')
          ? 'submitted'
          : 'unknown'

  let cdrCode =
    typeof data.codigoRespuesta === 'string'
      ? data.codigoRespuesta
      : typeof data.cdrCode === 'string'
        ? data.cdrCode
        : typeof data.cdr_code === 'string'
          ? data.cdr_code
          : null
  const cdrXml =
    typeof data.cdrXml === 'string'
      ? data.cdrXml
      : typeof data.cdr_xml === 'string'
        ? data.cdr_xml
        : null
  const pdfUrl =
    typeof data.pdfUrl === 'string'
      ? data.pdfUrl
      : typeof data.pdf_url === 'string'
        ? data.pdf_url
        : null

  if (status === 'accepted' && !cdrCode) cdrCode = '0'

  const lastError =
    status === 'rejected' || upper.includes('FALLIDA')
      ? typeof data.descripcionRespuesta === 'string'
        ? data.descripcionRespuesta
        : typeof data.ultimoError === 'string'
          ? data.ultimoError
          : 'Intifact reportó un error de procesamiento'
      : null

  const { error } = await db
    .from('invoices')
    .update({
      status,
      emission_provider: 'intifact',
      provider_status: statusRaw,
      cdr_code: cdrCode,
      cdr_xml: cdrXml,
      pdf_url: pdfUrl,
      accepted_at: status === 'accepted' ? new Date().toISOString() : null,
      pse_response: payload,
      last_error: lastError,
      updated_at: new Date().toISOString(),
      mutation_id: crypto.randomUUID(),
    })
    .eq('intifact_document_id', documentId)

  return new Response(error ? 'db_error' : 'ok', { status: error ? 500 : 200 })
})
