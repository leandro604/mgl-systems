import Link from 'next/link'
import { ArrowLeft, BadgeCheck, TriangleAlert } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FiscalSettingsForm } from '@/features/fiscal/fiscal-settings-form'
import { FiscalSeriesManager } from '@/features/fiscal/fiscal-series-manager'
import { getFiscalSettingsSummary } from '@/features/fiscal/server'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const data = await getFiscalSettingsSummary()
  if (!data.allowed) return <Card><CardHeader><CardTitle>Facturación electrónica</CardTitle><CardDescription>Solo un administrador puede configurar las credenciales tributarias.</CardDescription></CardHeader></Card>
  return <div className="mx-auto max-w-5xl space-y-6">
    <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-cyan-300">Configuración</p><h1 className="mt-2 text-2xl font-semibold tracking-tight">Facturación electrónica</h1><p className="mt-1 text-sm text-slate-500">Administra emisión SUNAT, credenciales, series y la presentación del PDF de la empresa.</p></div><Button asChild variant="secondary"><Link href="/app/configuracion"><ArrowLeft className="size-4"/>Volver</Link></Button></div>
    {data.schemaPending ? <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"><TriangleAlert className="mr-2 inline size-4"/>Aplica las migraciones <code>20261009203000_task13_sunat_direct_pdf.sql</code> y <code>20261009235500_task13_fiscal_branding.sql</code> antes de guardar esta configuración.</div> : null}
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><BadgeCheck className="size-5 text-cyan-300"/>Emisor electrónico</CardTitle><CardDescription>Los secretos se cifran con AES-256-GCM y no se exponen al navegador ni a usuarios no administradores.</CardDescription></CardHeader><CardContent><FiscalSettingsForm settings={data.settings} companyRuc={data.company.ruc}/></CardContent></Card>
    <Card><CardHeader><CardTitle>Series fiscales</CardTitle><CardDescription>Configura las series que estarán disponibles al numerar comprobantes. El correlativo queda protegido una vez creada la serie.</CardDescription></CardHeader><CardContent><FiscalSeriesManager series={data.series}/></CardContent></Card>
    <Card><CardHeader><CardTitle>Alcance SUNAT directo</CardTitle></CardHeader><CardContent className="space-y-2 text-sm leading-6 text-slate-400"><p>Esta versión implementa envío directo de <strong className="text-slate-200">facturas electrónicas (01)</strong> mediante BillService, XML UBL 2.1 firmado y recepción del CDR.</p><p>Las boletas (03) conservan el flujo por Intifact en esta etapa, porque en SEE del Contribuyente deben informarse mediante Resumen Diario.</p><p>Antes de producción valida el certificado y las credenciales en el ambiente Beta de SUNAT.</p></CardContent></Card>
  </div>
}
