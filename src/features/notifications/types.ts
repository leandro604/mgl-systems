import type { Database } from '@/lib/supabase/database.types'

export type NotificationRow = Database['public']['Tables']['notifications']['Row']
export type NotificationDeliveryRow = Database['public']['Tables']['notification_deliveries']['Row']
export type UserPreferenceRow = Database['public']['Tables']['user_preferences']['Row']
export type PushSubscriptionRow = Database['public']['Tables']['push_subscriptions']['Row']

export type NotificationPreferencesInput = {
  emailEnabled: boolean
  pushEnabled: boolean
  quietHoursEnabled: boolean
  quietStart: string | null
  quietEnd: string | null
  timezone: string
}
