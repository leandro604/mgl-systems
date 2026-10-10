import { redirect } from 'next/navigation'
export const dynamic = 'force-dynamic'
export default async function Page({params}:{params:Promise<{id:string;itemId:string}>}) { const {id,itemId}=await params; redirect(`/app/projects/${id}/partidas/${itemId}`) }
