import { redirect } from 'next/navigation'
import { requireWorkspaceContext } from '@/features/auth/server'
export const dynamic = 'force-dynamic'
export default async function Page({params}:{params:Promise<{id:string}>}) { const {id}=await params; const ctx=await requireWorkspaceContext(); const {data,error}=await ctx.supabase.from('invoices').select('project_id').eq('id',id).is('deleted_at',null).maybeSingle(); if(error)throw error; if(!data)redirect('/app/finanzas'); redirect(`/app/projects/${data.project_id}/invoices/${id}`) }
