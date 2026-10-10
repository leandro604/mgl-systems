'use client'

import { useActionState, useEffect, useState } from 'react'
import { Camera } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getLocalDb } from '@/lib/db/dexie'
import { updateFieldProfileAction } from './profile-actions'

export function FieldProfileForm({ companyId, userId, initial }: { companyId:string; userId:string; initial: { full_name:string; dni:string|null; phone:string|null; position:string|null; emergency_contact_name:string|null; emergency_contact_phone:string|null; emergency_contact_relation:string|null } }) {
  const [, action, pending] = useActionState(async (_state: null, formData: FormData) => { await updateFieldProfileAction(formData); return null }, null)
  const [photoUrl,setPhotoUrl]=useState<string|null>(null)
  useEffect(()=>{let active=true;let url:string|null=null;void (async()=>{const row=await getLocalDb({companyId,userId}).tempBlobs.get(`profile-photo:${userId}`);if(row&&active){url=URL.createObjectURL(row.blob);setPhotoUrl(url)}})();return()=>{active=false;if(url)URL.revokeObjectURL(url)}},[companyId,userId])
  async function savePhoto(file:File|null){if(!file)return;const db=getLocalDb({companyId,userId});await db.tempBlobs.put({id:`profile-photo:${userId}`,projectId:'profile',entityId:userId,fileName:file.name,mimeType:file.type||'image/jpeg',sizeBytes:file.size,blob:file,createdAt:Date.now()});setPhotoUrl((current)=>{if(current)URL.revokeObjectURL(current);return URL.createObjectURL(file)})}
  return <form action={action} className="space-y-4"><label className="relative grid size-24 cursor-pointer place-items-center overflow-hidden rounded-full border border-slate-200 bg-white text-2xl font-semibold text-slate-500">{photoUrl?<img src={photoUrl} alt="Foto de perfil" className="size-full object-cover"/>:<>{initial.full_name.slice(0,1).toUpperCase()}<Camera className="absolute bottom-1 right-1 size-5 rounded-full bg-white p-1 text-slate-700"/></>}<input type="file" accept="image/*" className="hidden" onChange={(event)=>void savePhoto(event.target.files?.[0]??null)}/></label><Input name="full_name" defaultValue={initial.full_name} placeholder="Nombre" className="h-14 text-base"/><Input name="dni" defaultValue={initial.dni??''} placeholder="DNI" inputMode="numeric" className="h-14 text-base"/><Input name="phone" defaultValue={initial.phone??''} placeholder="Teléfono" className="h-14 text-base"/><Input name="position" defaultValue={initial.position??''} placeholder="Cargo" className="h-14 text-base"/><Input name="emergency_contact_name" defaultValue={initial.emergency_contact_name??''} placeholder="Contacto de emergencia" className="h-14 text-base"/><Input name="emergency_contact_phone" defaultValue={initial.emergency_contact_phone??''} placeholder="Teléfono de emergencia" className="h-14 text-base"/><Input name="emergency_contact_relation" defaultValue={initial.emergency_contact_relation??''} placeholder="Relación" className="h-14 text-base"/><Button type="submit" disabled={pending} className="h-14 w-full text-base">Guardar</Button></form>
}
