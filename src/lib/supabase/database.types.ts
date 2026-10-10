/**
 * Narrow generated-compatible snapshot for the Supabase schema used through Fase 8.
 * Source project: MGL Systems (vscwajxzjnqlcdulfqzl), 2026-09-24.
 * Regenerate from Supabase after any schema change before expanding later phases.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: { PostgrestVersion: '14.5' }
  public: {
    Tables: {
      companies: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          server_updated_at: string
          mutation_id: string
          deleted_at: string | null
          legal_name: string
          ruc: string
          timezone: string
          currency: string
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          server_updated_at?: string
          mutation_id?: string
          deleted_at?: string | null
          legal_name: string
          ruc: string
          timezone?: string
          currency?: string
        }
        Update: Partial<Database['public']['Tables']['companies']['Insert']>
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          server_updated_at: string
          mutation_id: string
          deleted_at: string | null
          company_id: string
          user_id: string
          full_name: string
          role: Database['public']['Enums']['app_role']
          google_refresh_token_enc: string | null
          microsoft_refresh_token_enc: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          server_updated_at?: string
          mutation_id?: string
          deleted_at?: string | null
          company_id: string
          user_id: string
          full_name: string
          role?: Database['public']['Enums']['app_role']
          google_refresh_token_enc?: string | null
          microsoft_refresh_token_enc?: string | null
        }
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
        Relationships: []
      }
      company_fiscal_settings: {
        Row: {
          company_id: string
          created_at: string
          updated_at: string
          server_updated_at: string
          mutation_id: string
          provider: string
          environment: string
          trade_name: string
          issuer_address: string
          ubigeo: string
          department: string
          province: string
          district: string
          establishment_code: string
          sol_user_enc: string | null
          sol_password_enc: string | null
          certificate_pfx_enc: string | null
          certificate_password_enc: string | null
          certificate_name: string | null
          certificate_uploaded_at: string | null
          contact_phones: Json
          contact_emails: Json
          logo_path: string | null
          logo_name: string | null
          logo_mime: string | null
          logo_uploaded_at: string | null
          pdf_thank_you_message: string
          pdf_additional_message: string
          bank_accounts: Json
          digital_wallets: Json
          configured_by: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          updated_at?: string
          server_updated_at?: string
          mutation_id?: string
          provider?: string
          environment?: string
          trade_name?: string
          issuer_address?: string
          ubigeo?: string
          department?: string
          province?: string
          district?: string
          establishment_code?: string
          sol_user_enc?: string | null
          sol_password_enc?: string | null
          certificate_pfx_enc?: string | null
          certificate_password_enc?: string | null
          certificate_name?: string | null
          certificate_uploaded_at?: string | null
          contact_phones?: Json
          contact_emails?: Json
          logo_path?: string | null
          logo_name?: string | null
          logo_mime?: string | null
          logo_uploaded_at?: string | null
          pdf_thank_you_message?: string
          pdf_additional_message?: string
          bank_accounts?: Json
          digital_wallets?: Json
          configured_by?: string | null
        }
        Update: Partial<Database['public']['Tables']['company_fiscal_settings']['Insert']>
        Relationships: []
      }
      cloud_accounts: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          server_updated_at: string
          mutation_id: string
          deleted_at: string | null
          company_id: string
          user_id: string
          provider: string
          refresh_token_enc: string
          provider_account_id: string | null
          account_email: string | null
          account_name: string | null
          avatar_url: string | null
          connected_at: string
          last_token_refresh_at: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          server_updated_at?: string
          mutation_id?: string
          deleted_at?: string | null
          company_id: string
          user_id: string
          provider: string
          refresh_token_enc: string
          provider_account_id?: string | null
          account_email?: string | null
          account_name?: string | null
          avatar_url?: string | null
          connected_at?: string
          last_token_refresh_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['cloud_accounts']['Insert']>
        Relationships: []
      }
      project_cloud_drives: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          server_updated_at: string
          mutation_id: string
          deleted_at: string | null
          company_id: string
          project_id: string
          provider: string
          cloud_account_id: string
          provider_account_id: string | null
          root_folder_id: string
          root_folder_name: string
          root_folder_url: string
          stage_folder_map: Json
          sync_enabled: boolean
          sync_status: string
          last_sync_at: string | null
          sync_error: string | null
          watch_channel_id: string | null
          watch_resource_id: string | null
          watch_expires_at: string | null
          delta_cursor: string | null
          created_by: string
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          server_updated_at?: string
          mutation_id?: string
          deleted_at?: string | null
          company_id: string
          project_id: string
          provider: string
          cloud_account_id: string
          provider_account_id?: string | null
          root_folder_id: string
          root_folder_name: string
          root_folder_url?: string
          stage_folder_map?: Json
          sync_enabled?: boolean
          sync_status?: string
          last_sync_at?: string | null
          sync_error?: string | null
          watch_channel_id?: string | null
          watch_resource_id?: string | null
          watch_expires_at?: string | null
          delta_cursor?: string | null
          created_by?: string
        }
        Update: Partial<Database['public']['Tables']['project_cloud_drives']['Insert']>
        Relationships: []
      }
      projects: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          server_updated_at: string
          mutation_id: string
          deleted_at: string | null
          company_id: string
          code: string
          name: string
          description: string
          status: string
          starts_on: string | null
          ends_on: string | null
          created_by: string
          cost_alert_minor_max_pct: number
          cost_alert_major_max_pct: number
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          server_updated_at?: string
          mutation_id?: string
          deleted_at?: string | null
          company_id: string
          code: string
          name: string
          description?: string
          status?: string
          starts_on?: string | null
          ends_on?: string | null
          created_by?: string
          cost_alert_minor_max_pct?: number
          cost_alert_major_max_pct?: number
        }
        Update: Partial<Database['public']['Tables']['projects']['Insert']>
        Relationships: []
      }
      project_members: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          server_updated_at: string
          mutation_id: string
          deleted_at: string | null
          company_id: string
          project_id: string
          user_id: string
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          server_updated_at?: string
          mutation_id?: string
          deleted_at?: string | null
          company_id: string
          project_id: string
          user_id: string
        }
        Update: Partial<Database['public']['Tables']['project_members']['Insert']>
        Relationships: []
      }
      tasks: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          server_updated_at: string
          mutation_id: string
          deleted_at: string | null
          company_id: string
          project_id: string
          title: string
          description: string
          status: Database['public']['Enums']['task_status']
          priority: number
          assignee_id: string | null
          created_by: string
          starts_on: string | null
          due_on: string | null
          progress: number
          position: number
          wbs_code: string
          task_type: string
          parent_task_id: string | null
          planned_weight: number
          budget_item_id: string | null
          stage_id: string
          version: number
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          server_updated_at?: string
          mutation_id?: string
          deleted_at?: string | null
          company_id: string
          project_id: string
          title: string
          description?: string
          status?: Database['public']['Enums']['task_status']
          priority?: number
          assignee_id?: string | null
          created_by?: string
          starts_on?: string | null
          due_on?: string | null
          progress?: number
          position?: number
          wbs_code?: string
          task_type?: string
          parent_task_id?: string | null
          planned_weight?: number
          budget_item_id?: string | null
          stage_id?: string
          version?: number
        }
        Update: Partial<Database['public']['Tables']['tasks']['Insert']>
        Relationships: []
      }
      project_stages: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          server_updated_at: string
          mutation_id: string
          version: number
          deleted_at: string | null
          company_id: string
          project_id: string
          stage_type: Database['public']['Enums']['project_stage']
          code: string
          name: string
          sort_order: number
          is_locked: boolean
          created_by: string
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          server_updated_at?: string
          mutation_id?: string
          version?: number
          deleted_at?: string | null
          company_id: string
          project_id: string
          stage_type: Database['public']['Enums']['project_stage']
          code: string
          name: string
          sort_order?: number
          is_locked?: boolean
          created_by?: string
        }
        Update: Partial<Database['public']['Tables']['project_stages']['Insert']>
        Relationships: []
      }
      notifications: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          server_updated_at: string
          mutation_id: string
          version: number
          deleted_at: string | null
          company_id: string
          project_id: string | null
          recipient_id: string
          actor_id: string | null
          kind: string
          title: string
          body: string
          entity_type: string | null
          entity_id: string | null
          action_url: string | null
          metadata: Json
          read_at: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          server_updated_at?: string
          mutation_id?: string
          version?: number
          deleted_at?: string | null
          company_id: string
          project_id?: string | null
          recipient_id: string
          actor_id?: string | null
          kind: string
          title: string
          body?: string
          entity_type?: string | null
          entity_id?: string | null
          action_url?: string | null
          metadata?: Json
          read_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['notifications']['Insert']>
        Relationships: []
      }
      notification_deliveries: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          server_updated_at: string
          mutation_id: string
          version: number
          deleted_at: string | null
          company_id: string
          notification_id: string
          recipient_id: string
          channel: 'in_app' | 'email' | 'push'
          status: 'pending' | 'scheduled' | 'sent' | 'skipped' | 'failed'
          scheduled_for: string
          attempted_at: string | null
          sent_at: string | null
          attempt_count: number
          provider_message_id: string | null
          last_error: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          server_updated_at?: string
          mutation_id?: string
          version?: number
          deleted_at?: string | null
          company_id: string
          notification_id: string
          recipient_id: string
          channel: 'in_app' | 'email' | 'push'
          status?: 'pending' | 'scheduled' | 'sent' | 'skipped' | 'failed'
          scheduled_for?: string
          attempted_at?: string | null
          sent_at?: string | null
          attempt_count?: number
          provider_message_id?: string | null
          last_error?: string | null
        }
        Update: Partial<Database['public']['Tables']['notification_deliveries']['Insert']>
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          server_updated_at: string
          mutation_id: string
          version: number
          deleted_at: string | null
          company_id: string
          user_id: string
          endpoint: string
          p256dh: string
          auth_key: string
          device_id: string
          user_agent: string
          enabled: boolean
          last_seen_at: string
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          server_updated_at?: string
          mutation_id?: string
          version?: number
          deleted_at?: string | null
          company_id: string
          user_id: string
          endpoint: string
          p256dh: string
          auth_key: string
          device_id?: string
          user_agent?: string
          enabled?: boolean
          last_seen_at?: string
        }
        Update: Partial<Database['public']['Tables']['push_subscriptions']['Insert']>
        Relationships: []
      }
      user_preferences: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          server_updated_at: string
          mutation_id: string
          version: number
          deleted_at: string | null
          company_id: string
          user_id: string
          in_app_enabled: boolean
          email_enabled: boolean
          push_enabled: boolean
          quiet_hours_enabled: boolean
          quiet_start: string | null
          quiet_end: string | null
          timezone: string
          sidebar_collapsed: boolean
          compact_mode: boolean
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          server_updated_at?: string
          mutation_id?: string
          version?: number
          deleted_at?: string | null
          company_id: string
          user_id: string
          in_app_enabled?: boolean
          email_enabled?: boolean
          push_enabled?: boolean
          quiet_hours_enabled?: boolean
          quiet_start?: string | null
          quiet_end?: string | null
          timezone?: string
          sidebar_collapsed?: boolean
          compact_mode?: boolean
        }
        Update: Partial<Database['public']['Tables']['user_preferences']['Insert']>
        Relationships: []
      }
      task_dependencies: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          server_updated_at: string
          mutation_id: string
          deleted_at: string | null
          company_id: string
          project_id: string
          task_id: string
          depends_on_task_id: string
          dependency_type: string
          lag_days: number
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          server_updated_at?: string
          mutation_id?: string
          deleted_at?: string | null
          company_id: string
          project_id: string
          task_id: string
          depends_on_task_id: string
          dependency_type?: string
          lag_days?: number
        }
        Update: Partial<Database['public']['Tables']['task_dependencies']['Insert']>
        Relationships: []
      }
      documents: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          server_updated_at: string
          mutation_id: string
          deleted_at: string | null
          company_id: string
          project_id: string
          name: string
          provider: string
          provider_account_id: string
          external_file_id: string
          web_url: string
          mime_type: string
          size_bytes: number
          sha256: string | null
          uploaded_by: string
          description: string
          folder_path: string
          stage_id: string
          version: number
          search_vector: unknown
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          server_updated_at?: string
          mutation_id?: string
          deleted_at?: string | null
          company_id: string
          project_id: string
          name: string
          provider: string
          provider_account_id: string
          external_file_id: string
          web_url: string
          mime_type: string
          size_bytes: number
          sha256?: string | null
          uploaded_by?: string
          description?: string
          folder_path?: string
          stage_id: string
          version?: number
          search_vector?: unknown
        }
        Update: Partial<Database['public']['Tables']['documents']['Insert']>
        Relationships: []
      }
      sst_records: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          server_updated_at: string
          mutation_id: string
          deleted_at: string | null
          company_id: string
          project_id: string
          record_type: string
          title: string
          occurred_at: string
          details: Json
          document_id: string | null
          recorded_by: string
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          server_updated_at?: string
          mutation_id?: string
          deleted_at?: string | null
          company_id: string
          project_id: string
          record_type: string
          title: string
          occurred_at: string
          details?: Json
          document_id?: string | null
          recorded_by?: string
        }
        Update: Partial<Database['public']['Tables']['sst_records']['Insert']>
        Relationships: []
      }
      suppliers: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          server_updated_at: string
          mutation_id: string
          deleted_at: string | null
          company_id: string
          legal_name: string
          ruc: string | null
          contact_name: string
          email: string
          phone: string
          address: string
          currency: string
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          server_updated_at?: string
          mutation_id?: string
          deleted_at?: string | null
          company_id: string
          legal_name: string
          ruc?: string | null
          contact_name?: string
          email?: string
          phone?: string
          address?: string
          currency?: string
        }
        Update: Partial<Database['public']['Tables']['suppliers']['Insert']>
        Relationships: []
      }
      fiscal_series: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          server_updated_at: string
          mutation_id: string
          deleted_at: string | null
          company_id: string
          document_type: string
          series: string
          next_number: number
          active: boolean
          last_issued_at: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          server_updated_at?: string
          mutation_id?: string
          deleted_at?: string | null
          company_id: string
          document_type: string
          series: string
          next_number?: number
          active?: boolean
          last_issued_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['fiscal_series']['Insert']>
        Relationships: []
      }
      purchase_orders: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          server_updated_at: string
          mutation_id: string
          deleted_at: string | null
          company_id: string
          project_id: string
          number: string
          supplier_id: string | null
          supplier_name: string
          supplier_ruc: string | null
          currency: string
          status: string
          ordered_on: string
          expected_on: string | null
          received_on: string | null
          notes: string
          created_by: string
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          server_updated_at?: string
          mutation_id?: string
          deleted_at?: string | null
          company_id: string
          project_id: string
          number: string
          supplier_id?: string | null
          supplier_name: string
          supplier_ruc?: string | null
          currency?: string
          status?: string
          ordered_on?: string
          expected_on?: string | null
          received_on?: string | null
          notes?: string
          created_by?: string
        }
        Update: Partial<Database['public']['Tables']['purchase_orders']['Insert']>
        Relationships: []
      }
      purchase_order_items: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          server_updated_at: string
          mutation_id: string
          deleted_at: string | null
          company_id: string
          project_id: string
          purchase_order_id: string
          budget_item_id: string | null
          material_id: string | null
          line_number: number
          description: string
          unit_code: string
          quantity: number
          unit_price: number
          tax_rate: number
          tax_affectation_code: string
          net_amount: number | null
          tax_amount: number | null
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          server_updated_at?: string
          mutation_id?: string
          deleted_at?: string | null
          company_id: string
          project_id: string
          purchase_order_id: string
          budget_item_id?: string | null
          material_id?: string | null
          line_number: number
          description: string
          unit_code?: string
          quantity: number
          unit_price: number
          tax_rate?: number
          tax_affectation_code?: string
          net_amount?: number | null
          tax_amount?: number | null
        }
        Update: Partial<Database['public']['Tables']['purchase_order_items']['Insert']>
        Relationships: []
      }
      materials: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          server_updated_at: string
          mutation_id: string
          deleted_at: string | null
          company_id: string
          sku: string
          name: string
          category: string
          unit_code: string
          min_stock: number
          notes: string
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          server_updated_at?: string
          mutation_id?: string
          deleted_at?: string | null
          company_id: string
          sku: string
          name: string
          category?: string
          unit_code?: string
          min_stock?: number
          notes?: string
        }
        Update: Partial<Database['public']['Tables']['materials']['Insert']>
        Relationships: []
      }
      warehouses: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          server_updated_at: string
          mutation_id: string
          deleted_at: string | null
          company_id: string
          project_id: string
          code: string
          name: string
          location: string
          responsible_id: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          server_updated_at?: string
          mutation_id?: string
          deleted_at?: string | null
          company_id: string
          project_id: string
          code: string
          name: string
          location?: string
          responsible_id?: string | null
        }
        Update: Partial<Database['public']['Tables']['warehouses']['Insert']>
        Relationships: []
      }
      material_requests: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          server_updated_at: string
          mutation_id: string
          deleted_at: string | null
          company_id: string
          project_id: string
          number: string
          needed_on: string | null
          status: string
          notes: string
          requested_by: string
          approved_by: string | null
          approved_at: string | null
          workflow_status: Database['public']['Enums']['material_request_status']
          approver_id: string | null
          priority: Database['public']['Enums']['material_request_priority']
          stage_id: string
          budget_item_id: string | null
          version: number
          title: string
          rejection_reason: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          server_updated_at?: string
          mutation_id?: string
          deleted_at?: string | null
          company_id: string
          project_id: string
          number: string
          needed_on?: string | null
          status?: string
          notes?: string
          requested_by?: string
          approved_by?: string | null
          approved_at?: string | null
          workflow_status?: Database['public']['Enums']['material_request_status']
          approver_id?: string | null
          priority?: Database['public']['Enums']['material_request_priority']
          stage_id: string
          budget_item_id?: string | null
          version?: number
          title: string
          rejection_reason?: string | null
        }
        Update: Partial<Database['public']['Tables']['material_requests']['Insert']>
        Relationships: []
      }
      material_request_items: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          server_updated_at: string
          mutation_id: string
          deleted_at: string | null
          company_id: string
          project_id: string
          request_id: string
          material_id: string
          budget_item_id: string | null
          quantity: number
          notes: string
          estimated_unit_price: number
          estimated_amount: number | null
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          server_updated_at?: string
          mutation_id?: string
          deleted_at?: string | null
          company_id: string
          project_id: string
          request_id: string
          material_id: string
          budget_item_id?: string | null
          quantity: number
          notes?: string
          estimated_unit_price?: number
        }
        Update: Partial<Database['public']['Tables']['material_request_items']['Insert']>
        Relationships: []
      }
      inventory_transactions: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          server_updated_at: string
          mutation_id: string
          deleted_at: string | null
          company_id: string
          project_id: string
          number: string
          movement_type: string
          status: string
          source_warehouse_id: string | null
          target_warehouse_id: string | null
          material_request_id: string | null
          purchase_order_id: string | null
          occurred_at: string
          notes: string
          created_by: string
          posted_at: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          server_updated_at?: string
          mutation_id?: string
          deleted_at?: string | null
          company_id: string
          project_id: string
          number: string
          movement_type: string
          status?: string
          source_warehouse_id?: string | null
          target_warehouse_id?: string | null
          material_request_id?: string | null
          purchase_order_id?: string | null
          occurred_at?: string
          notes?: string
          created_by?: string
          posted_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['inventory_transactions']['Insert']>
        Relationships: []
      }
      inventory_transaction_items: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          server_updated_at: string
          mutation_id: string
          deleted_at: string | null
          company_id: string
          project_id: string
          transaction_id: string
          material_id: string
          request_item_id: string | null
          purchase_order_item_id: string | null
          budget_item_id: string | null
          quantity: number
          unit_cost: number
          line_value: number | null
          notes: string
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          server_updated_at?: string
          mutation_id?: string
          deleted_at?: string | null
          company_id: string
          project_id: string
          transaction_id: string
          material_id: string
          request_item_id?: string | null
          purchase_order_item_id?: string | null
          budget_item_id?: string | null
          quantity: number
          unit_cost?: number
          line_value?: number | null
          notes?: string
        }
        Update: Partial<Database['public']['Tables']['inventory_transaction_items']['Insert']>
        Relationships: []
      }
      project_budgets: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          server_updated_at: string
          mutation_id: string
          deleted_at: string | null
          company_id: string
          project_id: string
          version_no: number
          name: string
          currency: string
          status: string
          notes: string
          baseline_at: string | null
          created_by: string
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          server_updated_at?: string
          mutation_id?: string
          deleted_at?: string | null
          company_id: string
          project_id: string
          version_no: number
          name: string
          currency?: string
          status?: string
          notes?: string
          baseline_at?: string | null
          created_by?: string
        }
        Update: Partial<Database['public']['Tables']['project_budgets']['Insert']>
        Relationships: []
      }
      budget_commitments: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          server_updated_at: string
          mutation_id: string
          version: number
          deleted_at: string | null
          company_id: string
          project_id: string
          budget_item_id: string
          commitment_type: Database['public']['Enums']['budget_commitment_type']
          source_entity: string
          source_id: string
          amount: number
          currency: string
          status: Database['public']['Enums']['budget_commitment_status']
          committed_at: string
          executed_at: string | null
          cancelled_at: string | null
          metadata: Json
          device_id: string
          created_by: string
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          server_updated_at?: string
          mutation_id?: string
          version?: number
          deleted_at?: string | null
          company_id: string
          project_id: string
          budget_item_id: string
          commitment_type: Database['public']['Enums']['budget_commitment_type']
          source_entity: string
          source_id: string
          amount: number
          currency?: string
          status?: Database['public']['Enums']['budget_commitment_status']
          committed_at?: string
          executed_at?: string | null
          cancelled_at?: string | null
          metadata?: Json
          device_id?: string
          created_by?: string
        }
        Update: Partial<Database['public']['Tables']['budget_commitments']['Insert']>
        Relationships: []
      }
      budget_items: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          server_updated_at: string
          mutation_id: string
          deleted_at: string | null
          company_id: string
          project_id: string
          budget_id: string
          parent_id: string | null
          code: string
          description: string
          item_type: string
          unit_code: string
          quantity: number
          unit_price: number
          budget_amount: number | null
          sort_order: number
          stage_id: string
          qty_actual: number
          unit_price_actual: number
          qty_quoted: number | null
          unit_price_quoted: number | null
          actual_amount: number | null
          deviation_amount: number | null
          deviation_pct: number | null
          cost_status: Database['public']['Enums']['cost_status']
          version: number
          committed_amount: number
          executed_amount: number
          available_amount: number | null
          over_budget: boolean | null
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          server_updated_at?: string
          mutation_id?: string
          deleted_at?: string | null
          company_id: string
          project_id: string
          budget_id: string
          parent_id?: string | null
          code: string
          description: string
          item_type?: string
          unit_code?: string
          quantity?: number
          unit_price?: number
          budget_amount?: number | null
          sort_order?: number
          stage_id?: string
          qty_actual?: number
          unit_price_actual?: number
          qty_quoted?: number | null
          unit_price_quoted?: number | null
          actual_amount?: number | null
          deviation_amount?: number | null
          deviation_pct?: number | null
          cost_status?: Database['public']['Enums']['cost_status']
          version?: number
          committed_amount?: number
          executed_amount?: number
          available_amount?: number | null
          over_budget?: boolean | null
        }
        Update: Partial<Database['public']['Tables']['budget_items']['Insert']>
        Relationships: []
      }
      progress_records: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          server_updated_at: string
          mutation_id: string
          deleted_at: string | null
          company_id: string
          project_id: string
          budget_item_id: string
          progress_on: string
          quantity: number
          notes: string
          created_by: string
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          server_updated_at?: string
          mutation_id?: string
          deleted_at?: string | null
          company_id: string
          project_id: string
          budget_item_id: string
          progress_on?: string
          quantity: number
          notes?: string
          created_by?: string
        }
        Update: Partial<Database['public']['Tables']['progress_records']['Insert']>
        Relationships: []
      }
      valuations: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          server_updated_at: string
          mutation_id: string
          deleted_at: string | null
          company_id: string
          project_id: string
          budget_id: string
          number: number
          period_start: string
          period_end: string
          status: string
          notes: string
          submitted_at: string | null
          approved_at: string | null
          created_by: string
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          server_updated_at?: string
          mutation_id?: string
          deleted_at?: string | null
          company_id: string
          project_id: string
          budget_id: string
          number: number
          period_start: string
          period_end: string
          status?: string
          notes?: string
          submitted_at?: string | null
          approved_at?: string | null
          created_by?: string
        }
        Update: Partial<Database['public']['Tables']['valuations']['Insert']>
        Relationships: []
      }
      valuation_items: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          server_updated_at: string
          mutation_id: string
          deleted_at: string | null
          company_id: string
          project_id: string
          valuation_id: string
          budget_item_id: string
          quantity: number
          unit_price: number
          amount: number | null
          notes: string
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          server_updated_at?: string
          mutation_id?: string
          deleted_at?: string | null
          company_id: string
          project_id: string
          valuation_id: string
          budget_item_id: string
          quantity: number
          unit_price?: number
          amount?: number | null
          notes?: string
        }
        Update: Partial<Database['public']['Tables']['valuation_items']['Insert']>
        Relationships: []
      }
      invoices: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          server_updated_at: string
          mutation_id: string
          deleted_at: string | null
          company_id: string
          project_id: string
          document_type: string
          series: string | null
          number: number | null
          issued_on: string
          currency: string
          customer_document_type: string
          customer_document_number: string
          customer_name: string
          customer_address: string
          status: Database['public']['Enums']['invoice_status']
          pse_request_id: string | null
          pse_response: Json | null
          cdr_url: string | null
          cdr_code: string | null
          accepted_at: string | null
          last_error: string | null
          created_by: string
          intifact_idempotency_hash: string | null
          intifact_document_id: string | null
          cdr_xml: string | null
          pdf_url: string | null
          provider_status: string | null
          emission_provider: string | null
          sunat_xml: string | null
          sunat_cdr_zip_base64: string | null
          sunat_digest: string | null
          sunat_response_description: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          server_updated_at?: string
          mutation_id?: string
          deleted_at?: string | null
          company_id: string
          project_id: string
          document_type?: string
          series?: string | null
          number?: number | null
          issued_on?: string
          currency?: string
          customer_document_type: string
          customer_document_number: string
          customer_name: string
          customer_address?: string
          status?: Database['public']['Enums']['invoice_status']
          pse_request_id?: string | null
          pse_response?: Json | null
          cdr_url?: string | null
          cdr_code?: string | null
          accepted_at?: string | null
          last_error?: string | null
          created_by?: string
          intifact_idempotency_hash?: string | null
          intifact_document_id?: string | null
          cdr_xml?: string | null
          pdf_url?: string | null
          provider_status?: string | null
          emission_provider?: string | null
          sunat_xml?: string | null
          sunat_cdr_zip_base64?: string | null
          sunat_digest?: string | null
          sunat_response_description?: string | null
        }
        Update: Partial<Database['public']['Tables']['invoices']['Insert']>
        Relationships: []
      }
      invoice_items: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          server_updated_at: string
          mutation_id: string
          deleted_at: string | null
          company_id: string
          project_id: string
          invoice_id: string
          line_number: number
          description: string
          unit_code: string
          quantity: number
          unit_price: number
          tax_rate: number
          tax_affectation_code: string
          net_amount: number | null
          tax_amount: number | null
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          server_updated_at?: string
          mutation_id?: string
          deleted_at?: string | null
          company_id: string
          project_id: string
          invoice_id: string
          line_number: number
          description: string
          unit_code?: string
          quantity: number
          unit_price: number
          tax_rate?: number
          tax_affectation_code?: string
          net_amount?: number | null
          tax_amount?: number | null
        }
        Update: Partial<Database['public']['Tables']['invoice_items']['Insert']>
        Relationships: []
      }
      schedule_baselines: {
        Row: {
          id: string; created_at: string; updated_at: string; server_updated_at: string; mutation_id: string; deleted_at: string | null
          company_id: string; project_id: string; version_no: number; name: string; status: string; baseline_at: string; created_by: string
        }
        Insert: {
          id?: string; created_at?: string; updated_at?: string; server_updated_at?: string; mutation_id?: string; deleted_at?: string | null
          company_id: string; project_id: string; version_no: number; name: string; status?: string; baseline_at?: string; created_by?: string
        }
        Update: Partial<Database['public']['Tables']['schedule_baselines']['Insert']>
        Relationships: []
      }
      schedule_baseline_tasks: {
        Row: {
          id: string; created_at: string; updated_at: string; server_updated_at: string; mutation_id: string; deleted_at: string | null
          company_id: string; project_id: string; baseline_id: string; task_id: string; title: string; wbs_code: string; task_type: string
          parent_task_id: string | null; starts_on: string | null; due_on: string | null; planned_weight: number; budget_item_id: string | null; progress_at_baseline: number
        }
        Insert: {
          id?: string; created_at?: string; updated_at?: string; server_updated_at?: string; mutation_id?: string; deleted_at?: string | null
          company_id: string; project_id: string; baseline_id: string; task_id: string; title: string; wbs_code?: string; task_type: string
          parent_task_id?: string | null; starts_on?: string | null; due_on?: string | null; planned_weight: number; budget_item_id?: string | null; progress_at_baseline: number
        }
        Update: Partial<Database['public']['Tables']['schedule_baseline_tasks']['Insert']>
        Relationships: []
      }
      schedule_baseline_dependencies: {
        Row: {
          id: string; created_at: string; updated_at: string; server_updated_at: string; mutation_id: string; deleted_at: string | null
          company_id: string; project_id: string; baseline_id: string; dependency_id: string; task_id: string; depends_on_task_id: string; dependency_type: string; lag_days: number
        }
        Insert: {
          id?: string; created_at?: string; updated_at?: string; server_updated_at?: string; mutation_id?: string; deleted_at?: string | null
          company_id: string; project_id: string; baseline_id: string; dependency_id: string; task_id: string; depends_on_task_id: string; dependency_type: string; lag_days: number
        }
        Update: Partial<Database['public']['Tables']['schedule_baseline_dependencies']['Insert']>
        Relationships: []
      }
      task_progress_history: {
        Row: {
          id: string; created_at: string; updated_at: string; server_updated_at: string; mutation_id: string; deleted_at: string | null
          company_id: string; project_id: string; task_id: string; recorded_at: string; status: Database['public']['Enums']['task_status']; progress: number
        }
        Insert: {
          id?: string; created_at?: string; updated_at?: string; server_updated_at?: string; mutation_id?: string; deleted_at?: string | null
          company_id: string; project_id: string; task_id: string; recorded_at: string; status: Database['public']['Enums']['task_status']; progress: number
        }
        Update: Partial<Database['public']['Tables']['task_progress_history']['Insert']>
        Relationships: []
      }
      sync_logs: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          server_updated_at: string
          mutation_id: string
          deleted_at: string | null
          company_id: string
          project_id: string
          actor_id: string
          entity_type: string
          entity_id: string
          operation: string
          payload_hash: string
          result: string
          response: Json
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          server_updated_at?: string
          mutation_id?: string
          deleted_at?: string | null
          company_id: string
          project_id: string
          actor_id: string
          entity_type: string
          entity_id: string
          operation: string
          payload_hash: string
          result: string
          response?: Json
        }
        Update: Partial<Database['public']['Tables']['sync_logs']['Insert']>
        Relationships: []
      }
    }
    Views: {
      project_schedule_summary: {
        Row: {
          project_id: string | null
          company_id: string | null
          active_tasks: number | null
          scheduled_tasks: number | null
          overdue_tasks: number | null
          milestone_count: number | null
          next_milestone_on: string | null
          actual_progress_pct: number | null
          baseline_id: string | null
          baseline_version: number | null
          baseline_name: string | null
          baseline_at: string | null
        }
        Relationships: []
      }
      inventory_stock: {
        Row: {
          company_id: string | null
          project_id: string | null
          warehouse_id: string | null
          material_id: string | null
          quantity: number | null
          stock_value: number | null
          average_unit_cost: number | null
        }
        Relationships: []
      }
      material_request_fulfillment: {
        Row: {
          request_id: string | null
          company_id: string | null
          project_id: string | null
          number: string | null
          status: string | null
          needed_on: string | null
          requested_by: string | null
          request_item_id: string | null
          material_id: string | null
          budget_item_id: string | null
          requested_quantity: number | null
          fulfilled_quantity: number | null
          remaining_quantity: number | null
        }
        Relationships: []
      }
      project_inventory_summary: {
        Row: {
          project_id: string | null
          company_id: string | null
          stock_value: number | null
          sku_in_stock: number | null
          warehouse_count: number | null
          open_requests: number | null
          approved_requests: number | null
          low_stock_count: number | null
        }
        Relationships: []
      }
      invoice_totals: {
        Row: { id: string | null; company_id: string | null; project_id: string | null; net_amount: number | null; tax_amount: number | null; total_amount: number | null }
        Relationships: []
      }
      purchase_order_totals: {
        Row: { id: string | null; company_id: string | null; project_id: string | null; net_amount: number | null; tax_amount: number | null; total_amount: number | null }
        Relationships: []
      }
      valuation_totals: {
        Row: { id: string | null; company_id: string | null; project_id: string | null; budget_id: string | null; net_amount: number | null }
        Relationships: []
      }
      budget_item_control: {
        Row: {
          budget_item_id: string | null
          company_id: string | null
          project_id: string | null
          budget_id: string | null
          version_no: number | null
          budget_status: string | null
          currency: string | null
          parent_id: string | null
          code: string | null
          description: string | null
          item_type: string | null
          unit_code: string | null
          quantity: number | null
          unit_price: number | null
          budget_amount: number | null
          sort_order: number | null
          committed_net: number | null
          received_net: number | null
          executed_quantity: number | null
          physical_progress_pct: number | null
          approved_valuation_net: number | null
          budget_balance_net: number | null
        }
        Relationships: []
      }
      project_control_summary: {
        Row: {
          project_id: string | null
          company_id: string | null
          budget_id: string | null
          currency: string | null
          budget_total_net: number | null
          committed_cost_net: number | null
          received_cost_net: number | null
          approved_valuation_net: number | null
          physical_progress_pct: number | null
          cost_utilization_pct: number | null
          budget_balance_net: number | null
          unassigned_committed_net: number | null
        }
        Relationships: []
      }
      project_financial_summary: {
        Row: {
          project_id: string | null
          company_id: string | null
          committed_cost: number | null
          received_cost: number | null
          emitted_total: number | null
          accepted_revenue: number | null
          operational_margin: number | null
          purchase_drafts: number | null
          purchase_committed_count: number | null
          invoice_drafts: number | null
          accepted_count: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      project_cost_summary: {
        Args: { p_project_id: string }
        Returns: Json
      }
      create_schedule_baseline: {
        Args: { p_project_id: string; p_name: string }
        Returns: Json
      }
      get_project_planning_context: {
        Args: { p_project_id: string }
        Returns: Json
      }
      transition_material_request: {
        Args: { p_request_id: string; p_target_status: string }
        Returns: Json
      }
      create_inventory_movement: {
        Args: {
          p_project_id: string
          p_number: string
          p_movement_type: string
          p_source_warehouse_id: string | null
          p_target_warehouse_id: string | null
          p_material_request_id: string | null
          p_purchase_order_id: string | null
          p_material_id: string
          p_request_item_id: string | null
          p_purchase_order_item_id: string | null
          p_budget_item_id: string | null
          p_quantity: number
          p_unit_cost: number
          p_notes: string
        }
        Returns: Json
      }
      post_inventory_transaction: {
        Args: { p_transaction_id: string }
        Returns: Json
      }
      bootstrap_company: {
        Args: { p_legal_name: string; p_ruc: string; p_full_name: string }
        Returns: Json
      }
      create_workspace_invitation: {
        Args: {
          p_email: string
          p_role: Database['public']['Enums']['app_role']
          p_project_ids?: string[]
        }
        Returns: Json
      }
      list_workspace_invitations: {
        Args: never
        Returns: Json
      }
      get_my_workspace_invitation: {
        Args: { p_invitation_id?: string | null }
        Returns: Json
      }
      accept_workspace_invitation: {
        Args: { p_invitation_id: string; p_full_name?: string | null }
        Returns: Json
      }
      revoke_workspace_invitation: {
        Args: { p_invitation_id: string }
        Returns: Json
      }
      update_workspace_member_role: {
        Args: { p_user_id: string; p_role: Database['public']['Enums']['app_role'] }
        Returns: Json
      }
      create_project: {
        Args: { p_id: string; p_company_id: string; p_code: string; p_name: string }
        Returns: Database['public']['Tables']['projects']['Row']
      }
      get_workspace_context: {
        Args: never
        Returns: Json
      }
      activate_project_budget: {
        Args: { p_budget_id: string }
        Returns: Json
      }
      set_notification_read: {
        Args: { p_notification_id: string; p_read?: boolean }
        Returns: Json
      }
      mark_all_notifications_read: {
        Args: never
        Returns: number
      }
      update_notification_preferences: {
        Args: {
          p_email_enabled: boolean
          p_push_enabled: boolean
          p_quiet_hours_enabled: boolean
          p_quiet_start: string | null
          p_quiet_end: string | null
          p_timezone: string
        }
        Returns: Json
      }
      upsert_push_subscription: {
        Args: {
          p_company_id: string
          p_endpoint: string
          p_p256dh: string
          p_auth_key: string
          p_device_id: string
          p_user_agent: string
          p_enabled?: boolean
        }
        Returns: Json
      }
      transition_valuation: {
        Args: { p_valuation_id: string; p_target_status: string }
        Returns: Json
      }
      queue_invoice: {
        Args: { p_invoice_id: string; p_series: string }
        Returns: Json
      }
      transition_purchase_order: {
        Args: { p_order_id: string; p_target_status: string }
        Returns: Json
      }
      sync_budget_item_actual: {
        Args: {
          p_entity_id: string
          p_mutation_id: string
          p_operation: string
          p_payload?: Json
          p_project_id: string
          p_updated_at: string
        }
        Returns: Json
      }
      sync_mutation: {
        Args: {
          p_mutation_id: string
          p_entity_type: string
          p_entity_id: string
          p_project_id: string
          p_operation: string
          p_updated_at: string
          p_payload?: Json
        }
        Returns: Json
      }
      sync_material_mutation: {
        Args: {
          p_mutation_id: string
          p_entity_type: string
          p_entity_id: string
          p_project_id: string
          p_operation: string
          p_updated_at: string
          p_payload?: Json
        }
        Returns: Json
      }
      sync_material_request_transition: {
        Args: {
          p_mutation_id: string
          p_entity_id: string
          p_project_id: string
          p_updated_at: string
          p_payload: Json
        }
        Returns: Json
      }
      list_workspace_members: {
        Args: never
        Returns: Json
      }
      sync_task_mutation: {
        Args: {
          p_entity_id: string
          p_mutation_id: string
          p_operation: string
          p_payload?: Json
          p_project_id: string
          p_updated_at: string
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: 'admin' | 'pm' | 'supervisor' | 'field_worker'
      task_status: 'todo' | 'in_progress' | 'blocked' | 'done'
      project_stage: 'management' | 'engineering' | 'procurement' | 'field_execution' | 'finance' | 'quotation_closed' | 'execution_versioned'
      cost_status: 'dentro_presupuesto' | 'alerta_menor' | 'alerta_mayor' | 'critico'
      budget_commitment_type: 'material_request' | 'purchase_order' | 'manual_adjustment'
      budget_commitment_status: 'committed' | 'executed' | 'cancelled' | 'closed'
      invoice_status: 'draft' | 'queued' | 'processing' | 'submitted' | 'accepted' | 'rejected' | 'unknown' | 'voided'
      material_request_status: 'draft' | 'pending' | 'approved' | 'rejected' | 'delivered' | 'cancelled'
      material_request_priority: 'low' | 'normal' | 'high' | 'urgent'
    }
    CompositeTypes: Record<string, never>
  }
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type TablesInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']
