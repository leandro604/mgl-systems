'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from './button'
import { Drawer } from './drawer'

export function FormDrawerTrigger({ title, label, children }: { title: string; label: string; children: React.ReactNode }) {
  const [open,setOpen]=useState(false)
  return <><Button type="button" onClick={()=>setOpen(true)}><Plus/>{label}</Button><Drawer open={open} onOpenChange={setOpen} title={title}>{children}</Drawer></>
}
