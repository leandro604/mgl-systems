function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

export function getSupabasePublicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  return {
    url: required(url, 'NEXT_PUBLIC_SUPABASE_URL'),
    publishableKey: required(publishableKey, 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'),
  }
}
