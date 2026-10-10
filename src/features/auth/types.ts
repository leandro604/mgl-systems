export type FormActionState = {
  status: 'idle' | 'error' | 'success'
  message: string
}

export const initialFormState: FormActionState = { status: 'idle', message: '' }
