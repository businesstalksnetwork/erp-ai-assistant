export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          company_id: string | null
          contact_id: string | null
          created_at: string
          description: string | null
          id: string
          lead_id: string | null
          meeting_id: string | null
          opportunity_id: string | null
          partner_id: string | null
          tenant_id: string
          type: string
        }
        Insert: {
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          lead_id?: string | null
          meeting_id?: string | null
          opportunity_id?: string | null
          partner_id?: string | null
          tenant_id: string
          type: string
        }
        Update: {
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          lead_id?: string | null
          meeting_id?: string | null
          opportunity_id?: string | null
          partner_id?: string | null
          tenant_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      advance_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          currency: string
          id: string
          invoice_id: string | null
          journal_entry_id: string | null
          legal_entity_id: string | null
          notes: string | null
          partner_id: string | null
          received_at: string
          reference: string | null
          settled_at: string | null
          settlement_journal_entry_id: string | null
          status: string
          tax_amount: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          invoice_id?: string | null
          journal_entry_id?: string | null
          legal_entity_id?: string | null
          notes?: string | null
          partner_id?: string | null
          received_at?: string
          reference?: string | null
          settled_at?: string | null
          settlement_journal_entry_id?: string | null
          status?: string
          tax_amount?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          invoice_id?: string | null
          journal_entry_id?: string | null
          legal_entity_id?: string | null
          notes?: string | null
          partner_id?: string | null
          received_at?: string
          reference?: string | null
          settled_at?: string | null
          settlement_journal_entry_id?: string | null
          status?: string
          tax_amount?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "advance_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advance_payments_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advance_payments_legal_entity_id_fkey"
            columns: ["legal_entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advance_payments_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advance_payments_settlement_journal_entry_id_fkey"
            columns: ["settlement_journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advance_payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_action_log: {
        Row: {
          action_type: string
          ai_output: Json | null
          confidence_score: number | null
          created_at: string | null
          id: string
          input_data: Json | null
          model_version: string | null
          module: string
          reasoning: string | null
          tenant_id: string
          user_decision: string | null
          user_id: string | null
        }
        Insert: {
          action_type: string
          ai_output?: Json | null
          confidence_score?: number | null
          created_at?: string | null
          id?: string
          input_data?: Json | null
          model_version?: string | null
          module: string
          reasoning?: string | null
          tenant_id: string
          user_decision?: string | null
          user_id?: string | null
        }
        Update: {
          action_type?: string
          ai_output?: Json | null
          confidence_score?: number | null
          created_at?: string | null
          id?: string
          input_data?: Json | null
          model_version?: string | null
          module?: string
          reasoning?: string | null
          tenant_id?: string
          user_decision?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_action_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_anomaly_baselines: {
        Row: {
          id: string
          last_updated: string
          mean_value: number
          metric_key: string
          sample_count: number
          stddev_value: number
          tenant_id: string
        }
        Insert: {
          id?: string
          last_updated?: string
          mean_value?: number
          metric_key: string
          sample_count?: number
          stddev_value?: number
          tenant_id: string
        }
        Update: {
          id?: string
          last_updated?: string
          mean_value?: number
          metric_key?: string
          sample_count?: number
          stddev_value?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_anomaly_baselines_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_conversations: {
        Row: {
          created_at: string
          id: string
          is_pinned: boolean
          messages: Json
          tags: string[] | null
          tenant_id: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_pinned?: boolean
          messages?: Json
          tags?: string[] | null
          tenant_id: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_pinned?: boolean
          messages?: Json
          tags?: string[] | null
          tenant_id?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_insights_cache: {
        Row: {
          data: Json | null
          description: string
          expires_at: string
          generated_at: string
          id: string
          insight_type: string
          language: string | null
          severity: string
          tenant_id: string
          title: string
        }
        Insert: {
          data?: Json | null
          description: string
          expires_at?: string
          generated_at?: string
          id?: string
          insight_type: string
          language?: string | null
          severity?: string
          tenant_id: string
          title: string
        }
        Update: {
          data?: Json | null
          description?: string
          expires_at?: string
          generated_at?: string
          id?: string
          insight_type?: string
          language?: string | null
          severity?: string
          tenant_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_insights_cache_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_narrative_cache: {
        Row: {
          context_type: string
          created_at: string
          data_hash: string | null
          expires_at: string
          id: string
          narrative: string
          recommendations: Json
          tenant_id: string
        }
        Insert: {
          context_type: string
          created_at?: string
          data_hash?: string | null
          expires_at?: string
          id?: string
          narrative?: string
          recommendations?: Json
          tenant_id: string
        }
        Update: {
          context_type?: string
          created_at?: string
          data_hash?: string | null
          expires_at?: string
          id?: string
          narrative?: string
          recommendations?: Json
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_narrative_cache_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_rate_limits: {
        Row: {
          id: string
          request_count: number
          tenant_id: string
          user_id: string
          window_start: string
        }
        Insert: {
          id?: string
          request_count?: number
          tenant_id: string
          user_id: string
          window_start?: string
        }
        Update: {
          id?: string
          request_count?: number
          tenant_id?: string
          user_id?: string
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_rate_limits_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_token_usage: {
        Row: {
          completion_tokens: number
          created_at: string
          function_name: string
          id: string
          model: string
          prompt_tokens: number
          tenant_id: string
          total_tokens: number
          user_id: string | null
        }
        Insert: {
          completion_tokens?: number
          created_at?: string
          function_name: string
          id?: string
          model?: string
          prompt_tokens?: number
          tenant_id: string
          total_tokens?: number
          user_id?: string | null
        }
        Update: {
          completion_tokens?: number
          created_at?: string
          function_name?: string
          id?: string
          model?: string
          prompt_tokens?: number
          tenant_id?: string
          total_tokens?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_token_usage_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      allowance_types: {
        Row: {
          code: string
          id: string
          is_active: boolean
          name: string
          tenant_id: string | null
        }
        Insert: {
          code: string
          id?: string
          is_active?: boolean
          name: string
          tenant_id?: string | null
        }
        Update: {
          code?: string
          id?: string
          is_active?: boolean
          name?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "allowance_types_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      allowances: {
        Row: {
          allowance_type_id: string
          amount: number
          created_at: string
          employee_id: string
          id: string
          month: number
          tenant_id: string
          year: number
        }
        Insert: {
          allowance_type_id: string
          amount?: number
          created_at?: string
          employee_id: string
          id?: string
          month: number
          tenant_id: string
          year: number
        }
        Update: {
          allowance_type_id?: string
          amount?: number
          created_at?: string
          employee_id?: string
          id?: string
          month?: number
          tenant_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "allowances_allowance_type_id_fkey"
            columns: ["allowance_type_id"]
            isOneToOne: false
            referencedRelation: "allowance_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allowances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allowances_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      annual_leave_balances: {
        Row: {
          carried_over_days: number
          created_at: string
          employee_id: string
          entitled_days: number
          id: string
          tenant_id: string
          updated_at: string
          used_days: number
          year: number
        }
        Insert: {
          carried_over_days?: number
          created_at?: string
          employee_id: string
          entitled_days?: number
          id?: string
          tenant_id: string
          updated_at?: string
          used_days?: number
          year: number
        }
        Update: {
          carried_over_days?: number
          created_at?: string
          employee_id?: string
          entitled_days?: number
          id?: string
          tenant_id?: string
          updated_at?: string
          used_days?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "annual_leave_balances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "annual_leave_balances_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ap_aging_snapshots: {
        Row: {
          bucket_30: number
          bucket_60: number
          bucket_90: number
          bucket_current: number
          bucket_over90: number
          created_at: string
          id: string
          partner_id: string | null
          snapshot_date: string
          tenant_id: string
          total_outstanding: number
        }
        Insert: {
          bucket_30?: number
          bucket_60?: number
          bucket_90?: number
          bucket_current?: number
          bucket_over90?: number
          created_at?: string
          id?: string
          partner_id?: string | null
          snapshot_date: string
          tenant_id: string
          total_outstanding?: number
        }
        Update: {
          bucket_30?: number
          bucket_60?: number
          bucket_90?: number
          bucket_current?: number
          bucket_over90?: number
          created_at?: string
          id?: string
          partner_id?: string | null
          snapshot_date?: string
          tenant_id?: string
          total_outstanding?: number
        }
        Relationships: [
          {
            foreignKeyName: "ap_aging_snapshots_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ap_aging_snapshots_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_requests: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          requested_by: string | null
          status: string
          tenant_id: string
          updated_at: string
          workflow_id: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          requested_by?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
          workflow_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          requested_by?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_requests_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "approval_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_steps: {
        Row: {
          acted_at: string
          action: string
          approver_user_id: string
          comment: string | null
          id: string
          request_id: string
        }
        Insert: {
          acted_at?: string
          action: string
          approver_user_id: string
          comment?: string | null
          id?: string
          request_id: string
        }
        Update: {
          acted_at?: string
          action?: string
          approver_user_id?: string
          comment?: string | null
          id?: string
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_steps_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "approval_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_workflows: {
        Row: {
          created_at: string
          entity_type: string
          id: string
          is_active: boolean
          min_approvers: number
          name: string
          required_roles: string[]
          tenant_id: string
          threshold_amount: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          entity_type: string
          id?: string
          is_active?: boolean
          min_approvers?: number
          name: string
          required_roles?: string[]
          tenant_id: string
          threshold_amount?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          entity_type?: string
          id?: string
          is_active?: boolean
          min_approvers?: number
          name?: string
          required_roles?: string[]
          tenant_id?: string
          threshold_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_workflows_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ar_aging_snapshots: {
        Row: {
          bucket_30: number
          bucket_60: number
          bucket_90: number
          bucket_current: number
          bucket_over90: number
          created_at: string
          id: string
          partner_id: string | null
          snapshot_date: string
          tenant_id: string
          total_outstanding: number
        }
        Insert: {
          bucket_30?: number
          bucket_60?: number
          bucket_90?: number
          bucket_current?: number
          bucket_over90?: number
          created_at?: string
          id?: string
          partner_id?: string | null
          snapshot_date: string
          tenant_id: string
          total_outstanding?: number
        }
        Update: {
          bucket_30?: number
          bucket_60?: number
          bucket_90?: number
          bucket_current?: number
          bucket_over90?: number
          created_at?: string
          id?: string
          partner_id?: string | null
          snapshot_date?: string
          tenant_id?: string
          total_outstanding?: number
        }
        Relationships: [
          {
            foreignKeyName: "ar_aging_snapshots_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ar_aging_snapshots_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      archive_book: {
        Row: {
          category_id: string | null
          content_description: string
          created_at: string
          entry_number: number
          id: string
          notes: string | null
          quantity: number
          retention_period: string
          retention_years: number | null
          tenant_id: string
          transfer_date: string | null
          transferred_to_archive: boolean
          updated_at: string
          year_of_creation: number
        }
        Insert: {
          category_id?: string | null
          content_description: string
          created_at?: string
          entry_number: number
          id?: string
          notes?: string | null
          quantity?: number
          retention_period?: string
          retention_years?: number | null
          tenant_id: string
          transfer_date?: string | null
          transferred_to_archive?: boolean
          updated_at?: string
          year_of_creation: number
        }
        Update: {
          category_id?: string | null
          content_description?: string
          created_at?: string
          entry_number?: number
          id?: string
          notes?: string | null
          quantity?: number
          retention_period?: string
          retention_years?: number | null
          tenant_id?: string
          transfer_date?: string | null
          transferred_to_archive?: boolean
          updated_at?: string
          year_of_creation?: number
        }
        Relationships: [
          {
            foreignKeyName: "archive_book_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "document_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "archive_book_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      archiving_request_items: {
        Row: {
          archive_book_id: string
          created_at: string
          id: string
          request_id: string
          tenant_id: string
        }
        Insert: {
          archive_book_id: string
          created_at?: string
          id?: string
          request_id: string
          tenant_id: string
        }
        Update: {
          archive_book_id?: string
          created_at?: string
          id?: string
          request_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "archiving_request_items_archive_book_id_fkey"
            columns: ["archive_book_id"]
            isOneToOne: false
            referencedRelation: "archive_book"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "archiving_request_items_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "archiving_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "archiving_request_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      archiving_requests: {
        Row: {
          approval_comment: string | null
          approved_by: string | null
          created_at: string
          id: string
          reason: string | null
          request_number: string
          requested_by: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          approval_comment?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          reason?: string | null
          request_number: string
          requested_by?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          approval_comment?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          reason?: string | null
          request_number?: string
          requested_by?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "archiving_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_records: {
        Row: {
          check_in: string | null
          check_out: string | null
          created_at: string
          date: string
          employee_id: string
          hours_worked: number | null
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["attendance_status"]
          tenant_id: string
        }
        Insert: {
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          date?: string
          employee_id: string
          hours_worked?: number | null
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          tenant_id: string
        }
        Update: {
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          date?: string
          employee_id?: string
          hours_worked?: number | null
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          after_state: Json | null
          before_state: Json | null
          created_at: string
          details: Json
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: string | null
          tenant_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          tenant_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          tenant_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      bad_debt_provisions: {
        Row: {
          amount: number
          created_at: string
          id: string
          journal_entry_id: string | null
          partner_id: string | null
          provision_date: string
          reason: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          journal_entry_id?: string | null
          partner_id?: string | null
          provision_date?: string
          reason?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          journal_entry_id?: string | null
          partner_id?: string | null
          provision_date?: string
          reason?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bad_debt_provisions_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bad_debt_provisions_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bad_debt_provisions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_accounts: {
        Row: {
          account_number: string
          bank_name: string
          created_at: string
          currency: string
          id: string
          is_active: boolean
          is_primary: boolean
          legal_entity_id: string | null
          tenant_id: string
        }
        Insert: {
          account_number: string
          bank_name: string
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          is_primary?: boolean
          legal_entity_id?: string | null
          tenant_id: string
        }
        Update: {
          account_number?: string
          bank_name?: string
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          is_primary?: boolean
          legal_entity_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_legal_entity_id_fkey"
            columns: ["legal_entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_accounts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_reconciliation_lines: {
        Row: {
          confidence: number | null
          created_at: string
          id: string
          journal_entry_id: string | null
          match_type: string
          reconciliation_id: string
          statement_line_id: string | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          id?: string
          journal_entry_id?: string | null
          match_type?: string
          reconciliation_id: string
          statement_line_id?: string | null
        }
        Update: {
          confidence?: number | null
          created_at?: string
          id?: string
          journal_entry_id?: string | null
          match_type?: string
          reconciliation_id?: string
          statement_line_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_reconciliation_lines_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_reconciliation_lines_reconciliation_id_fkey"
            columns: ["reconciliation_id"]
            isOneToOne: false
            referencedRelation: "bank_reconciliations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_reconciliation_lines_statement_line_id_fkey"
            columns: ["statement_line_id"]
            isOneToOne: false
            referencedRelation: "bank_statement_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_reconciliations: {
        Row: {
          bank_account_id: string
          closing_balance: number
          created_at: string
          id: string
          notes: string | null
          opening_balance: number
          reconciled_at: string | null
          reconciled_by: string | null
          statement_id: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          bank_account_id: string
          closing_balance?: number
          created_at?: string
          id?: string
          notes?: string | null
          opening_balance?: number
          reconciled_at?: string | null
          reconciled_by?: string | null
          statement_id?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          bank_account_id?: string
          closing_balance?: number
          created_at?: string
          id?: string
          notes?: string | null
          opening_balance?: number
          reconciled_at?: string | null
          reconciled_by?: string | null
          statement_id?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_reconciliations_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_reconciliations_statement_id_fkey"
            columns: ["statement_id"]
            isOneToOne: false
            referencedRelation: "bank_statements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_reconciliations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_statement_lines: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          direction: string
          id: string
          journal_entry_id: string | null
          line_date: string
          match_status: string
          matched_invoice_id: string | null
          matched_supplier_invoice_id: string | null
          partner_account: string | null
          partner_name: string | null
          payment_purpose: string | null
          payment_reference: string | null
          statement_id: string
          tenant_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          description?: string | null
          direction?: string
          id?: string
          journal_entry_id?: string | null
          line_date: string
          match_status?: string
          matched_invoice_id?: string | null
          matched_supplier_invoice_id?: string | null
          partner_account?: string | null
          partner_name?: string | null
          payment_purpose?: string | null
          payment_reference?: string | null
          statement_id: string
          tenant_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          direction?: string
          id?: string
          journal_entry_id?: string | null
          line_date?: string
          match_status?: string
          matched_invoice_id?: string | null
          matched_supplier_invoice_id?: string | null
          partner_account?: string | null
          partner_name?: string | null
          payment_purpose?: string | null
          payment_reference?: string | null
          statement_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_statement_lines_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statement_lines_matched_invoice_id_fkey"
            columns: ["matched_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statement_lines_matched_supplier_invoice_id_fkey"
            columns: ["matched_supplier_invoice_id"]
            isOneToOne: false
            referencedRelation: "supplier_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statement_lines_statement_id_fkey"
            columns: ["statement_id"]
            isOneToOne: false
            referencedRelation: "bank_statements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statement_lines_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_statements: {
        Row: {
          bank_account_id: string
          closing_balance: number
          created_at: string
          currency: string
          id: string
          imported_at: string
          imported_by: string | null
          notes: string | null
          opening_balance: number
          statement_date: string
          statement_number: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          bank_account_id: string
          closing_balance?: number
          created_at?: string
          currency?: string
          id?: string
          imported_at?: string
          imported_by?: string | null
          notes?: string | null
          opening_balance?: number
          statement_date: string
          statement_number?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          bank_account_id?: string
          closing_balance?: number
          created_at?: string
          currency?: string
          id?: string
          imported_at?: string
          imported_by?: string | null
          notes?: string | null
          opening_balance?: number
          statement_date?: string
          statement_number?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_statements_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      bom_lines: {
        Row: {
          bom_template_id: string
          created_at: string
          id: string
          material_product_id: string
          quantity: number
          sort_order: number
          unit: string
        }
        Insert: {
          bom_template_id: string
          created_at?: string
          id?: string
          material_product_id: string
          quantity?: number
          sort_order?: number
          unit?: string
        }
        Update: {
          bom_template_id?: string
          created_at?: string
          id?: string
          material_product_id?: string
          quantity?: number
          sort_order?: number
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "bom_lines_bom_template_id_fkey"
            columns: ["bom_template_id"]
            isOneToOne: false
            referencedRelation: "bom_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_lines_material_product_id_fkey"
            columns: ["material_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      bom_templates: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          product_id: string | null
          tenant_id: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          product_id?: string | null
          tenant_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          product_id?: string | null
          tenant_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "bom_templates_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          account_id: string
          amount: number
          created_at: string | null
          fiscal_year: number
          id: string
          month: number
          tenant_id: string
        }
        Insert: {
          account_id: string
          amount?: number
          created_at?: string | null
          fiscal_year: number
          id?: string
          month: number
          tenant_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          created_at?: string | null
          fiscal_year?: number
          id?: string
          month?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      chart_of_accounts: {
        Row: {
          account_type: string
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_system: boolean
          is_variable_cost: boolean | null
          level: number
          name: string
          name_sr: string | null
          parent_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          account_type?: string
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          is_variable_cost?: boolean | null
          level?: number
          name: string
          name_sr?: string | null
          parent_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          account_type?: string
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          is_variable_cost?: boolean | null
          level?: number
          name?: string
          name_sr?: string | null
          parent_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chart_of_accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chart_of_accounts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          city: string | null
          country: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          is_internal: boolean | null
          legal_entity_id: string | null
          legal_name: string
          maticni_broj: string | null
          notes: string | null
          partner_id: string | null
          phone: string | null
          pib: string | null
          postal_code: string | null
          status: string
          tenant_id: string
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          is_internal?: boolean | null
          legal_entity_id?: string | null
          legal_name: string
          maticni_broj?: string | null
          notes?: string | null
          partner_id?: string | null
          phone?: string | null
          pib?: string | null
          postal_code?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          is_internal?: boolean | null
          legal_entity_id?: string | null
          legal_name?: string
          maticni_broj?: string | null
          notes?: string | null
          partner_id?: string | null
          phone?: string | null
          pib?: string | null
          postal_code?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_legal_entity_id_fkey"
            columns: ["legal_entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      company_categories: {
        Row: {
          code: string
          color: string | null
          created_at: string
          id: string
          is_system: boolean | null
          name: string
          name_sr: string | null
          parent_id: string | null
          sort_order: number | null
          tenant_id: string
        }
        Insert: {
          code: string
          color?: string | null
          created_at?: string
          id?: string
          is_system?: boolean | null
          name: string
          name_sr?: string | null
          parent_id?: string | null
          sort_order?: number | null
          tenant_id: string
        }
        Update: {
          code?: string
          color?: string | null
          created_at?: string
          id?: string
          is_system?: boolean | null
          name?: string
          name_sr?: string | null
          parent_id?: string | null
          sort_order?: number | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "company_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      company_category_assignments: {
        Row: {
          category_id: string
          company_id: string
          id: string
          tenant_id: string
        }
        Insert: {
          category_id: string
          company_id: string
          id?: string
          tenant_id: string
        }
        Update: {
          category_id?: string
          company_id?: string
          id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_category_assignments_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "company_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_category_assignments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_category_assignments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      confidentiality_levels: {
        Row: {
          color: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          name_sr: string
          sort_order: number
          tenant_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          name_sr: string
          sort_order?: number
          tenant_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          name_sr?: string
          sort_order?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "confidentiality_levels_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_records: {
        Row: {
          consented_at: string
          created_at: string
          id: string
          legal_basis: string | null
          purpose: string
          subject_id: string
          subject_type: string
          tenant_id: string
          withdrawn_at: string | null
        }
        Insert: {
          consented_at?: string
          created_at?: string
          id?: string
          legal_basis?: string | null
          purpose: string
          subject_id: string
          subject_type: string
          tenant_id: string
          withdrawn_at?: string | null
        }
        Update: {
          consented_at?: string
          created_at?: string
          id?: string
          legal_basis?: string | null
          purpose?: string
          subject_id?: string
          subject_type?: string
          tenant_id?: string
          withdrawn_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consent_records_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_company_assignments: {
        Row: {
          assigned_at: string
          company_id: string
          contact_id: string
          department: string | null
          id: string
          is_primary: boolean | null
          job_title: string | null
          partner_id: string | null
          role: string | null
          tenant_id: string
        }
        Insert: {
          assigned_at?: string
          company_id: string
          contact_id: string
          department?: string | null
          id?: string
          is_primary?: boolean | null
          job_title?: string | null
          partner_id?: string | null
          role?: string | null
          tenant_id: string
        }
        Update: {
          assigned_at?: string
          company_id?: string
          contact_id?: string
          department?: string | null
          id?: string
          is_primary?: boolean | null
          job_title?: string | null
          partner_id?: string | null
          role?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_company_assignments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_company_assignments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_company_assignments_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_company_assignments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          address: string | null
          anonymized_at: string | null
          city: string | null
          company_name: string | null
          country: string | null
          created_at: string
          data_retention_expiry: string | null
          email: string | null
          first_name: string
          function_area: string | null
          id: string
          last_name: string | null
          notes: string | null
          phone: string | null
          postal_code: string | null
          seniority_level: string | null
          tenant_id: string
          type: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          anonymized_at?: string | null
          city?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string
          data_retention_expiry?: string | null
          email?: string | null
          first_name: string
          function_area?: string | null
          id?: string
          last_name?: string | null
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          seniority_level?: string | null
          tenant_id: string
          type?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          anonymized_at?: string | null
          city?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string
          data_retention_expiry?: string | null
          email?: string | null
          first_name?: string
          function_area?: string | null
          id?: string
          last_name?: string | null
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          seniority_level?: string | null
          tenant_id?: string
          type?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_centers: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          tenant_id: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          tenant_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_centers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_notes: {
        Row: {
          amount: number
          created_at: string
          credit_number: string
          currency: string
          id: string
          invoice_id: string | null
          issued_at: string | null
          journal_entry_id: string | null
          legal_entity_id: string | null
          notes: string | null
          partner_id: string | null
          return_case_id: string | null
          sef_status: string | null
          status: string
          subtotal: number
          tax_amount: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          credit_number: string
          currency?: string
          id?: string
          invoice_id?: string | null
          issued_at?: string | null
          journal_entry_id?: string | null
          legal_entity_id?: string | null
          notes?: string | null
          partner_id?: string | null
          return_case_id?: string | null
          sef_status?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          credit_number?: string
          currency?: string
          id?: string
          invoice_id?: string | null
          issued_at?: string | null
          journal_entry_id?: string | null
          legal_entity_id?: string | null
          notes?: string | null
          partner_id?: string | null
          return_case_id?: string | null
          sef_status?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_notes_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_legal_entity_id_fkey"
            columns: ["legal_entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_return_case_id_fkey"
            columns: ["return_case_id"]
            isOneToOne: false
            referencedRelation: "return_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_tasks: {
        Row: {
          assigned_to: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          partner_id: string | null
          priority: string
          status: string
          task_type: string
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          partner_id?: string | null
          priority?: string
          status?: string
          task_type?: string
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          partner_id?: string | null
          priority?: string
          status?: string
          task_type?: string
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_tasks_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_tasks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      currencies: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          is_base: boolean
          name: string
          symbol: string | null
          tenant_id: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_base?: boolean
          name: string
          symbol?: string | null
          tenant_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_base?: boolean
          name?: string
          symbol?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "currencies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      data_subject_requests: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          notes: string | null
          request_type: string
          requested_at: string
          requested_by: string | null
          status: string
          subject_id: string
          subject_type: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          request_type: string
          requested_at?: string
          requested_by?: string | null
          status?: string
          subject_id: string
          subject_type: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          request_type?: string
          requested_at?: string
          requested_by?: string | null
          status?: string
          subject_id?: string
          subject_type?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_subject_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      deduction_payments: {
        Row: {
          amount: number
          created_at: string
          deduction_id: string
          id: string
          month: number
          payment_date: string
          tenant_id: string
          year: number
        }
        Insert: {
          amount?: number
          created_at?: string
          deduction_id: string
          id?: string
          month: number
          payment_date?: string
          tenant_id: string
          year: number
        }
        Update: {
          amount?: number
          created_at?: string
          deduction_id?: string
          id?: string
          month?: number
          payment_date?: string
          tenant_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "deduction_payments_deduction_id_fkey"
            columns: ["deduction_id"]
            isOneToOne: false
            referencedRelation: "deductions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deduction_payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      deductions: {
        Row: {
          created_at: string
          description: string
          employee_id: string
          end_date: string | null
          id: string
          is_active: boolean
          paid_amount: number
          start_date: string
          tenant_id: string
          total_amount: number
          type: string
        }
        Insert: {
          created_at?: string
          description?: string
          employee_id: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          paid_amount?: number
          start_date?: string
          tenant_id: string
          total_amount?: number
          type?: string
        }
        Update: {
          created_at?: string
          description?: string
          employee_id?: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          paid_amount?: number
          start_date?: string
          tenant_id?: string
          total_amount?: number
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "deductions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deductions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      deferral_schedules: {
        Row: {
          amount: number
          created_at: string
          deferral_id: string
          id: string
          journal_entry_id: string | null
          period_date: string
          status: string
          tenant_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          deferral_id: string
          id?: string
          journal_entry_id?: string | null
          period_date: string
          status?: string
          tenant_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          deferral_id?: string
          id?: string
          journal_entry_id?: string | null
          period_date?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deferral_schedules_deferral_id_fkey"
            columns: ["deferral_id"]
            isOneToOne: false
            referencedRelation: "deferrals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deferral_schedules_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deferral_schedules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      deferrals: {
        Row: {
          account_id: string | null
          created_at: string
          description: string | null
          end_date: string
          frequency: string
          id: string
          legal_entity_id: string | null
          recognized_amount: number
          source_invoice_id: string | null
          start_date: string
          status: string
          tenant_id: string
          total_amount: number
          type: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          description?: string | null
          end_date: string
          frequency?: string
          id?: string
          legal_entity_id?: string | null
          recognized_amount?: number
          source_invoice_id?: string | null
          start_date: string
          status?: string
          tenant_id: string
          total_amount?: number
          type: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          created_at?: string
          description?: string | null
          end_date?: string
          frequency?: string
          id?: string
          legal_entity_id?: string | null
          recognized_amount?: number
          source_invoice_id?: string | null
          start_date?: string
          status?: string
          tenant_id?: string
          total_amount?: number
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deferrals_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deferrals_legal_entity_id_fkey"
            columns: ["legal_entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deferrals_source_invoice_id_fkey"
            columns: ["source_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deferrals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      department_positions: {
        Row: {
          department_id: string
          headcount: number
          id: string
          position_template_id: string
        }
        Insert: {
          department_id: string
          headcount?: number
          id?: string
          position_template_id: string
        }
        Update: {
          department_id?: string
          headcount?: number
          id?: string
          position_template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "department_positions_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "department_positions_position_template_id_fkey"
            columns: ["position_template_id"]
            isOneToOne: false
            referencedRelation: "position_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          code: string
          company_id: string | null
          created_at: string
          id: string
          is_active: boolean
          manager_employee_id: string | null
          name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          code: string
          company_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          manager_employee_id?: string | null
          name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          code?: string
          company_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          manager_employee_id?: string | null
          name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_manager_employee_id_fkey"
            columns: ["manager_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_approval_rules: {
        Row: {
          created_at: string | null
          id: string
          max_discount_pct: number
          requires_approval_above: number | null
          role: string
          tenant_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          max_discount_pct?: number
          requires_approval_above?: number | null
          role: string
          tenant_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          max_discount_pct?: number
          requires_approval_above?: number | null
          role?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discount_approval_rules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      dispatch_note_lines: {
        Row: {
          created_at: string
          description: string
          dispatch_note_id: string
          id: string
          lot_number: string | null
          product_id: string | null
          quantity: number
          serial_number: string | null
          sort_order: number
          unit: string | null
        }
        Insert: {
          created_at?: string
          description: string
          dispatch_note_id: string
          id?: string
          lot_number?: string | null
          product_id?: string | null
          quantity?: number
          serial_number?: string | null
          sort_order?: number
          unit?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          dispatch_note_id?: string
          id?: string
          lot_number?: string | null
          product_id?: string | null
          quantity?: number
          serial_number?: string | null
          sort_order?: number
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dispatch_note_lines_dispatch_note_id_fkey"
            columns: ["dispatch_note_id"]
            isOneToOne: false
            referencedRelation: "dispatch_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatch_note_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      dispatch_notes: {
        Row: {
          created_at: string
          created_by: string | null
          dispatch_date: string | null
          document_date: string
          document_number: string
          driver_name: string | null
          eotpremnica_id: string | null
          eotpremnica_response: Json | null
          eotpremnica_sent_at: string | null
          eotpremnica_status: string | null
          id: string
          internal_transfer_id: string | null
          invoice_id: string | null
          legal_entity_id: string | null
          notes: string | null
          receiver_address: string | null
          receiver_city: string | null
          receiver_name: string | null
          receiver_pib: string | null
          sales_order_id: string | null
          sender_address: string | null
          sender_city: string | null
          sender_name: string | null
          sender_pib: string | null
          status: string
          tenant_id: string
          transport_reason: string | null
          updated_at: string
          vehicle_plate: string | null
          warehouse_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          dispatch_date?: string | null
          document_date?: string
          document_number: string
          driver_name?: string | null
          eotpremnica_id?: string | null
          eotpremnica_response?: Json | null
          eotpremnica_sent_at?: string | null
          eotpremnica_status?: string | null
          id?: string
          internal_transfer_id?: string | null
          invoice_id?: string | null
          legal_entity_id?: string | null
          notes?: string | null
          receiver_address?: string | null
          receiver_city?: string | null
          receiver_name?: string | null
          receiver_pib?: string | null
          sales_order_id?: string | null
          sender_address?: string | null
          sender_city?: string | null
          sender_name?: string | null
          sender_pib?: string | null
          status?: string
          tenant_id: string
          transport_reason?: string | null
          updated_at?: string
          vehicle_plate?: string | null
          warehouse_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          dispatch_date?: string | null
          document_date?: string
          document_number?: string
          driver_name?: string | null
          eotpremnica_id?: string | null
          eotpremnica_response?: Json | null
          eotpremnica_sent_at?: string | null
          eotpremnica_status?: string | null
          id?: string
          internal_transfer_id?: string | null
          invoice_id?: string | null
          legal_entity_id?: string | null
          notes?: string | null
          receiver_address?: string | null
          receiver_city?: string | null
          receiver_name?: string | null
          receiver_pib?: string | null
          sales_order_id?: string | null
          sender_address?: string | null
          sender_city?: string | null
          sender_name?: string | null
          sender_pib?: string | null
          status?: string
          tenant_id?: string
          transport_reason?: string | null
          updated_at?: string
          vehicle_plate?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dispatch_notes_internal_transfer_id_fkey"
            columns: ["internal_transfer_id"]
            isOneToOne: false
            referencedRelation: "internal_transfers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatch_notes_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatch_notes_legal_entity_id_fkey"
            columns: ["legal_entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatch_notes_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatch_notes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatch_notes_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      dispatch_receipts: {
        Row: {
          created_at: string
          dispatch_note_id: string
          goods_receipt_id: string | null
          id: string
          notes: string | null
          receipt_date: string
          receipt_number: string
          received_by: string | null
          status: string
          tenant_id: string
          updated_at: string
          warehouse_id: string | null
        }
        Insert: {
          created_at?: string
          dispatch_note_id: string
          goods_receipt_id?: string | null
          id?: string
          notes?: string | null
          receipt_date?: string
          receipt_number: string
          received_by?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
          warehouse_id?: string | null
        }
        Update: {
          created_at?: string
          dispatch_note_id?: string
          goods_receipt_id?: string | null
          id?: string
          notes?: string | null
          receipt_date?: string
          receipt_number?: string
          received_by?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dispatch_receipts_dispatch_note_id_fkey"
            columns: ["dispatch_note_id"]
            isOneToOne: false
            referencedRelation: "dispatch_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatch_receipts_goods_receipt_id_fkey"
            columns: ["goods_receipt_id"]
            isOneToOne: false
            referencedRelation: "goods_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatch_receipts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatch_receipts_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      dms_activity_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          tenant_id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          tenant_id: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          tenant_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dms_activity_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      dms_project_members: {
        Row: {
          created_at: string
          id: string
          project_id: string
          role: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          role?: string
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          role?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dms_project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "dms_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dms_project_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      dms_projects: {
        Row: {
          code: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dms_projects_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      document_access: {
        Row: {
          can_edit: boolean
          can_read: boolean
          created_at: string
          document_id: string
          granted_by: string | null
          id: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          can_edit?: boolean
          can_read?: boolean
          created_at?: string
          document_id: string
          granted_by?: string | null
          id?: string
          tenant_id: string
          user_id: string
        }
        Update: {
          can_edit?: boolean
          can_read?: boolean
          created_at?: string
          document_id?: string
          granted_by?: string | null
          id?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_access_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_access_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      document_categories: {
        Row: {
          code: string
          created_at: string
          group_name: string
          group_name_sr: string
          id: string
          is_active: boolean
          name: string
          name_sr: string
          sort_order: number
          tenant_id: string
        }
        Insert: {
          code: string
          created_at?: string
          group_name: string
          group_name_sr: string
          id?: string
          is_active?: boolean
          name: string
          name_sr: string
          sort_order?: number
          tenant_id: string
        }
        Update: {
          code?: string
          created_at?: string
          group_name?: string
          group_name_sr?: string
          id?: string
          is_active?: boolean
          name?: string
          name_sr?: string
          sort_order?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      document_projects: {
        Row: {
          created_at: string
          document_id: string
          id: string
          project_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          document_id: string
          id?: string
          project_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          document_id?: string
          id?: string
          project_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_projects_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_projects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "dms_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_projects_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      document_versions: {
        Row: {
          category_id: string | null
          change_summary: string | null
          confidentiality_level_id: string | null
          created_at: string
          created_by: string | null
          date_received: string | null
          document_id: string
          file_path: string | null
          file_size: number | null
          file_type: string | null
          id: string
          notes: string | null
          recipient: string | null
          sender: string | null
          status: string | null
          subject: string | null
          tags: string[] | null
          tenant_id: string
          valid_until: string | null
          version_number: number
        }
        Insert: {
          category_id?: string | null
          change_summary?: string | null
          confidentiality_level_id?: string | null
          created_at?: string
          created_by?: string | null
          date_received?: string | null
          document_id: string
          file_path?: string | null
          file_size?: number | null
          file_type?: string | null
          id?: string
          notes?: string | null
          recipient?: string | null
          sender?: string | null
          status?: string | null
          subject?: string | null
          tags?: string[] | null
          tenant_id: string
          valid_until?: string | null
          version_number: number
        }
        Update: {
          category_id?: string | null
          change_summary?: string | null
          confidentiality_level_id?: string | null
          created_at?: string
          created_by?: string | null
          date_received?: string | null
          document_id?: string
          file_path?: string | null
          file_size?: number | null
          file_type?: string | null
          id?: string
          notes?: string | null
          recipient?: string | null
          sender?: string | null
          status?: string | null
          subject?: string | null
          tags?: string[] | null
          tenant_id?: string
          valid_until?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_versions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "document_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_versions_confidentiality_level_id_fkey"
            columns: ["confidentiality_level_id"]
            isOneToOne: false
            referencedRelation: "confidentiality_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_versions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_versions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          category_id: string | null
          confidentiality_level_id: string | null
          created_at: string
          created_by: string | null
          current_version: number
          date_received: string | null
          entity_id: string | null
          entity_type: string | null
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          name: string
          notes: string | null
          protocol_number: string | null
          recipient: string | null
          sender: string | null
          seq_number: number | null
          status: string
          subject: string | null
          tags: string[] | null
          tenant_id: string
          updated_at: string
          uploaded_by: string | null
          valid_until: string | null
        }
        Insert: {
          category_id?: string | null
          confidentiality_level_id?: string | null
          created_at?: string
          created_by?: string | null
          current_version?: number
          date_received?: string | null
          entity_id?: string | null
          entity_type?: string | null
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          name: string
          notes?: string | null
          protocol_number?: string | null
          recipient?: string | null
          sender?: string | null
          seq_number?: number | null
          status?: string
          subject?: string | null
          tags?: string[] | null
          tenant_id: string
          updated_at?: string
          uploaded_by?: string | null
          valid_until?: string | null
        }
        Update: {
          category_id?: string | null
          confidentiality_level_id?: string | null
          created_at?: string
          created_by?: string | null
          current_version?: number
          date_received?: string | null
          entity_id?: string | null
          entity_type?: string | null
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          name?: string
          notes?: string | null
          protocol_number?: string | null
          recipient?: string | null
          sender?: string | null
          seq_number?: number | null
          status?: string
          subject?: string | null
          tags?: string[] | null
          tenant_id?: string
          updated_at?: string
          uploaded_by?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "document_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_confidentiality_level_id_fkey"
            columns: ["confidentiality_level_id"]
            isOneToOne: false
            referencedRelation: "confidentiality_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ebolovanje_claims: {
        Row: {
          amount: number | null
          claim_type: string
          confirmed_at: string | null
          created_at: string
          created_by: string | null
          diagnosis_code: string | null
          doctor_name: string | null
          employee_id: string
          end_date: string
          id: string
          legal_entity_id: string | null
          medical_facility: string | null
          notes: string | null
          rfzo_claim_number: string | null
          start_date: string
          status: string
          submitted_at: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount?: number | null
          claim_type?: string
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          diagnosis_code?: string | null
          doctor_name?: string | null
          employee_id: string
          end_date: string
          id?: string
          legal_entity_id?: string | null
          medical_facility?: string | null
          notes?: string | null
          rfzo_claim_number?: string | null
          start_date: string
          status?: string
          submitted_at?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount?: number | null
          claim_type?: string
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          diagnosis_code?: string | null
          doctor_name?: string | null
          employee_id?: string
          end_date?: string
          id?: string
          legal_entity_id?: string | null
          medical_facility?: string | null
          notes?: string | null
          rfzo_claim_number?: string | null
          start_date?: string
          status?: string
          submitted_at?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ebolovanje_claims_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ebolovanje_claims_legal_entity_id_fkey"
            columns: ["legal_entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ebolovanje_claims_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ebolovanje_connections: {
        Row: {
          certificate_data: string | null
          created_at: string
          environment: string
          euprava_password_encrypted: string | null
          euprava_username: string | null
          id: string
          is_active: boolean
          last_error: string | null
          last_sync_at: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          certificate_data?: string | null
          created_at?: string
          environment?: string
          euprava_password_encrypted?: string | null
          euprava_username?: string | null
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_sync_at?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          certificate_data?: string | null
          created_at?: string
          environment?: string
          euprava_password_encrypted?: string | null
          euprava_username?: string | null
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_sync_at?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ebolovanje_connections_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ebolovanje_doznake: {
        Row: {
          claim_id: string
          created_at: string
          doznaka_number: string | null
          id: string
          issued_date: string | null
          response_payload: Json | null
          rfzo_status: string | null
          tenant_id: string
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          claim_id: string
          created_at?: string
          doznaka_number?: string | null
          id?: string
          issued_date?: string | null
          response_payload?: Json | null
          rfzo_status?: string | null
          tenant_id: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          claim_id?: string
          created_at?: string
          doznaka_number?: string | null
          id?: string
          issued_date?: string | null
          response_payload?: Json | null
          rfzo_status?: string | null
          tenant_id?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ebolovanje_doznake_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "ebolovanje_claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ebolovanje_doznake_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_contracts: {
        Row: {
          contract_type: string
          created_at: string
          currency: string
          employee_id: string
          end_date: string | null
          gross_salary: number
          id: string
          is_active: boolean
          net_salary: number
          position_template_id: string | null
          start_date: string
          tenant_id: string
          updated_at: string
          working_hours_per_week: number
        }
        Insert: {
          contract_type?: string
          created_at?: string
          currency?: string
          employee_id: string
          end_date?: string | null
          gross_salary?: number
          id?: string
          is_active?: boolean
          net_salary?: number
          position_template_id?: string | null
          start_date?: string
          tenant_id: string
          updated_at?: string
          working_hours_per_week?: number
        }
        Update: {
          contract_type?: string
          created_at?: string
          currency?: string
          employee_id?: string
          end_date?: string | null
          gross_salary?: number
          id?: string
          is_active?: boolean
          net_salary?: number
          position_template_id?: string | null
          start_date?: string
          tenant_id?: string
          updated_at?: string
          working_hours_per_week?: number
        }
        Relationships: [
          {
            foreignKeyName: "employee_contracts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_contracts_position_template_id_fkey"
            columns: ["position_template_id"]
            isOneToOne: false
            referencedRelation: "position_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_contracts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_salaries: {
        Row: {
          amount: number
          amount_type: string
          created_at: string
          employee_id: string
          id: string
          meal_allowance: number
          regres: number
          salary_type: string
          start_date: string
          tenant_id: string
        }
        Insert: {
          amount?: number
          amount_type?: string
          created_at?: string
          employee_id: string
          id?: string
          meal_allowance?: number
          regres?: number
          salary_type?: string
          start_date?: string
          tenant_id: string
        }
        Update: {
          amount?: number
          amount_type?: string
          created_at?: string
          employee_id?: string
          id?: string
          meal_allowance?: number
          regres?: number
          salary_type?: string
          start_date?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_salaries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_salaries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          address: string | null
          annual_leave_days: number
          anonymized_at: string | null
          bank_account_iban: string | null
          bank_name: string | null
          city: string | null
          company_id: string | null
          created_at: string
          daily_work_hours: number
          data_retention_expiry: string | null
          department_id: string | null
          early_termination_date: string | null
          email: string | null
          employment_type: Database["public"]["Enums"]["employment_type"]
          end_date: string | null
          first_name: string | null
          full_name: string
          hire_date: string | null
          id: string
          is_archived: boolean
          jmbg: string | null
          last_name: string | null
          location_id: string | null
          municipal_tax_rate: number | null
          payroll_category_id: string | null
          phone: string | null
          pib: string | null
          position: string | null
          position_template_id: string | null
          recipient_code: string | null
          slava_date: string | null
          start_date: string
          status: Database["public"]["Enums"]["employee_status"]
          tenant_id: string
          termination_date: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          annual_leave_days?: number
          anonymized_at?: string | null
          bank_account_iban?: string | null
          bank_name?: string | null
          city?: string | null
          company_id?: string | null
          created_at?: string
          daily_work_hours?: number
          data_retention_expiry?: string | null
          department_id?: string | null
          early_termination_date?: string | null
          email?: string | null
          employment_type?: Database["public"]["Enums"]["employment_type"]
          end_date?: string | null
          first_name?: string | null
          full_name: string
          hire_date?: string | null
          id?: string
          is_archived?: boolean
          jmbg?: string | null
          last_name?: string | null
          location_id?: string | null
          municipal_tax_rate?: number | null
          payroll_category_id?: string | null
          phone?: string | null
          pib?: string | null
          position?: string | null
          position_template_id?: string | null
          recipient_code?: string | null
          slava_date?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["employee_status"]
          tenant_id: string
          termination_date?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          annual_leave_days?: number
          anonymized_at?: string | null
          bank_account_iban?: string | null
          bank_name?: string | null
          city?: string | null
          company_id?: string | null
          created_at?: string
          daily_work_hours?: number
          data_retention_expiry?: string | null
          department_id?: string | null
          early_termination_date?: string | null
          email?: string | null
          employment_type?: Database["public"]["Enums"]["employment_type"]
          end_date?: string | null
          first_name?: string | null
          full_name?: string
          hire_date?: string | null
          id?: string
          is_archived?: boolean
          jmbg?: string | null
          last_name?: string | null
          location_id?: string | null
          municipal_tax_rate?: number | null
          payroll_category_id?: string | null
          phone?: string | null
          pib?: string | null
          position?: string | null
          position_template_id?: string | null
          recipient_code?: string | null
          slava_date?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["employee_status"]
          tenant_id?: string
          termination_date?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_payroll_category_id_fkey"
            columns: ["payroll_category_id"]
            isOneToOne: false
            referencedRelation: "payroll_income_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_position_template_id_fkey"
            columns: ["position_template_id"]
            isOneToOne: false
            referencedRelation: "position_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      engaged_persons: {
        Row: {
          contract_expiry: string | null
          created_at: string
          first_name: string
          id: string
          is_active: boolean
          jmbg: string
          last_name: string
          tenant_id: string
        }
        Insert: {
          contract_expiry?: string | null
          created_at?: string
          first_name: string
          id?: string
          is_active?: boolean
          jmbg: string
          last_name: string
          tenant_id: string
        }
        Update: {
          contract_expiry?: string | null
          created_at?: string
          first_name?: string
          id?: string
          is_active?: boolean
          jmbg?: string
          last_name?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "engaged_persons_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      eotpremnica: {
        Row: {
          api_request_id: string | null
          api_response: Json | null
          api_status: string
          created_at: string
          created_by: string | null
          document_date: string
          document_number: string
          driver_name: string | null
          id: string
          invoice_id: string | null
          legal_entity_id: string | null
          notes: string | null
          receiver_address: string | null
          receiver_name: string
          receiver_pib: string | null
          sales_order_id: string | null
          sender_address: string | null
          sender_name: string
          sender_pib: string | null
          status: string
          tenant_id: string
          total_weight: number | null
          updated_at: string
          vehicle_plate: string | null
          warehouse_id: string | null
        }
        Insert: {
          api_request_id?: string | null
          api_response?: Json | null
          api_status?: string
          created_at?: string
          created_by?: string | null
          document_date?: string
          document_number: string
          driver_name?: string | null
          id?: string
          invoice_id?: string | null
          legal_entity_id?: string | null
          notes?: string | null
          receiver_address?: string | null
          receiver_name: string
          receiver_pib?: string | null
          sales_order_id?: string | null
          sender_address?: string | null
          sender_name: string
          sender_pib?: string | null
          status?: string
          tenant_id: string
          total_weight?: number | null
          updated_at?: string
          vehicle_plate?: string | null
          warehouse_id?: string | null
        }
        Update: {
          api_request_id?: string | null
          api_response?: Json | null
          api_status?: string
          created_at?: string
          created_by?: string | null
          document_date?: string
          document_number?: string
          driver_name?: string | null
          id?: string
          invoice_id?: string | null
          legal_entity_id?: string | null
          notes?: string | null
          receiver_address?: string | null
          receiver_name?: string
          receiver_pib?: string | null
          sales_order_id?: string | null
          sender_address?: string | null
          sender_name?: string
          sender_pib?: string | null
          status?: string
          tenant_id?: string
          total_weight?: number | null
          updated_at?: string
          vehicle_plate?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "eotpremnica_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eotpremnica_legal_entity_id_fkey"
            columns: ["legal_entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eotpremnica_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eotpremnica_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eotpremnica_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      eotpremnica_connections: {
        Row: {
          api_key_encrypted: string | null
          api_url: string | null
          created_at: string
          environment: string
          id: string
          is_active: boolean
          last_error: string | null
          last_sync_at: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          api_key_encrypted?: string | null
          api_url?: string | null
          created_at?: string
          environment?: string
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_sync_at?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          api_key_encrypted?: string | null
          api_url?: string | null
          created_at?: string
          environment?: string
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_sync_at?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "eotpremnica_connections_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      eotpremnica_lines: {
        Row: {
          description: string
          eotpremnica_id: string
          id: string
          product_id: string | null
          quantity: number
          sort_order: number
          unit: string
        }
        Insert: {
          description: string
          eotpremnica_id: string
          id?: string
          product_id?: string | null
          quantity?: number
          sort_order?: number
          unit?: string
        }
        Update: {
          description?: string
          eotpremnica_id?: string
          id?: string
          product_id?: string | null
          quantity?: number
          sort_order?: number
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "eotpremnica_lines_eotpremnica_id_fkey"
            columns: ["eotpremnica_id"]
            isOneToOne: false
            referencedRelation: "eotpremnica"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eotpremnica_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_rates: {
        Row: {
          created_at: string
          from_currency: string
          id: string
          rate: number
          rate_date: string
          source: string
          tenant_id: string
          to_currency: string
        }
        Insert: {
          created_at?: string
          from_currency: string
          id?: string
          rate: number
          rate_date: string
          source?: string
          tenant_id: string
          to_currency: string
        }
        Update: {
          created_at?: string
          from_currency?: string
          id?: string
          rate?: number
          rate_date?: string
          source?: string
          tenant_id?: string
          to_currency?: string
        }
        Relationships: [
          {
            foreignKeyName: "exchange_rates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      external_work_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          month: number
          person_id: string
          tenant_id: string
          work_type_id: string
          year: number
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          month: number
          person_id: string
          tenant_id: string
          work_type_id: string
          year: number
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          month?: number
          person_id?: string
          tenant_id?: string
          work_type_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "external_work_payments_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "engaged_persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_work_payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_work_payments_work_type_id_fkey"
            columns: ["work_type_id"]
            isOneToOne: false
            referencedRelation: "external_work_types"
            referencedColumns: ["id"]
          },
        ]
      }
      external_work_types: {
        Row: {
          code: string
          id: string
          name: string
          tenant_id: string | null
        }
        Insert: {
          code: string
          id?: string
          name: string
          tenant_id?: string | null
        }
        Update: {
          code?: string
          id?: string
          name?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "external_work_types_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_devices: {
        Row: {
          api_url: string | null
          created_at: string
          device_name: string
          device_type: string
          ib_number: string
          id: string
          is_active: boolean
          jid: string | null
          legal_entity_id: string | null
          location_address: string
          location_id: string | null
          location_name: string
          pac: string | null
          tax_label_map: Json | null
          tenant_id: string
        }
        Insert: {
          api_url?: string | null
          created_at?: string
          device_name: string
          device_type?: string
          ib_number?: string
          id?: string
          is_active?: boolean
          jid?: string | null
          legal_entity_id?: string | null
          location_address?: string
          location_id?: string | null
          location_name?: string
          pac?: string | null
          tax_label_map?: Json | null
          tenant_id: string
        }
        Update: {
          api_url?: string | null
          created_at?: string
          device_name?: string
          device_type?: string
          ib_number?: string
          id?: string
          is_active?: boolean
          jid?: string | null
          legal_entity_id?: string | null
          location_address?: string
          location_id?: string | null
          location_name?: string
          pac?: string | null
          tax_label_map?: Json | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_devices_legal_entity_id_fkey"
            columns: ["legal_entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_devices_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_devices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_periods: {
        Row: {
          created_at: string
          end_date: string
          id: string
          name: string
          start_date: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          name: string
          start_date: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          name?: string
          start_date?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_periods_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_receipts: {
        Row: {
          buyer_id: string | null
          created_at: string
          fiscal_device_id: string
          id: string
          invoice_id: string | null
          last_retry_at: string | null
          payment_method: string
          pfr_request: Json | null
          pfr_response: Json | null
          pos_transaction_id: string | null
          qr_code_url: string | null
          receipt_number: string
          receipt_type: string
          request_id: string | null
          retry_count: number
          signed_at: string | null
          tax_items: Json
          tenant_id: string
          total_amount: number
          transaction_type: string
          verification_status: string
        }
        Insert: {
          buyer_id?: string | null
          created_at?: string
          fiscal_device_id: string
          id?: string
          invoice_id?: string | null
          last_retry_at?: string | null
          payment_method?: string
          pfr_request?: Json | null
          pfr_response?: Json | null
          pos_transaction_id?: string | null
          qr_code_url?: string | null
          receipt_number?: string
          receipt_type?: string
          request_id?: string | null
          retry_count?: number
          signed_at?: string | null
          tax_items?: Json
          tenant_id: string
          total_amount?: number
          transaction_type?: string
          verification_status?: string
        }
        Update: {
          buyer_id?: string | null
          created_at?: string
          fiscal_device_id?: string
          id?: string
          invoice_id?: string | null
          last_retry_at?: string | null
          payment_method?: string
          pfr_request?: Json | null
          pfr_response?: Json | null
          pos_transaction_id?: string | null
          qr_code_url?: string | null
          receipt_number?: string
          receipt_type?: string
          request_id?: string | null
          retry_count?: number
          signed_at?: string | null
          tax_items?: Json
          tenant_id?: string
          total_amount?: number
          transaction_type?: string
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_receipts_fiscal_device_id_fkey"
            columns: ["fiscal_device_id"]
            isOneToOne: false
            referencedRelation: "fiscal_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_receipts_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_receipts_pos_transaction_id_fkey"
            columns: ["pos_transaction_id"]
            isOneToOne: false
            referencedRelation: "pos_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_receipts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fixed_asset_depreciation: {
        Row: {
          accumulated_total: number
          amount: number
          asset_id: string
          created_at: string
          id: string
          journal_entry_id: string | null
          period: string
          tenant_id: string
        }
        Insert: {
          accumulated_total?: number
          amount?: number
          asset_id: string
          created_at?: string
          id?: string
          journal_entry_id?: string | null
          period: string
          tenant_id: string
        }
        Update: {
          accumulated_total?: number
          amount?: number
          asset_id?: string
          created_at?: string
          id?: string
          journal_entry_id?: string | null
          period?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fixed_asset_depreciation_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "fixed_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_asset_depreciation_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_asset_depreciation_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fixed_assets: {
        Row: {
          account_id: string | null
          acquisition_cost: number
          acquisition_date: string
          created_at: string
          depreciation_method: string
          description: string | null
          disposal_type: string | null
          disposed_at: string | null
          id: string
          legal_entity_id: string | null
          name: string
          notes: string | null
          sale_price: number | null
          salvage_value: number
          status: string
          tenant_id: string
          updated_at: string
          useful_life_months: number
        }
        Insert: {
          account_id?: string | null
          acquisition_cost?: number
          acquisition_date?: string
          created_at?: string
          depreciation_method?: string
          description?: string | null
          disposal_type?: string | null
          disposed_at?: string | null
          id?: string
          legal_entity_id?: string | null
          name: string
          notes?: string | null
          sale_price?: number | null
          salvage_value?: number
          status?: string
          tenant_id: string
          updated_at?: string
          useful_life_months?: number
        }
        Update: {
          account_id?: string | null
          acquisition_cost?: number
          acquisition_date?: string
          created_at?: string
          depreciation_method?: string
          description?: string | null
          disposal_type?: string | null
          disposed_at?: string | null
          id?: string
          legal_entity_id?: string | null
          name?: string
          notes?: string | null
          sale_price?: number | null
          salvage_value?: number
          status?: string
          tenant_id?: string
          updated_at?: string
          useful_life_months?: number
        }
        Relationships: [
          {
            foreignKeyName: "fixed_assets_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_assets_legal_entity_id_fkey"
            columns: ["legal_entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_assets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fx_revaluation_lines: {
        Row: {
          currency: string
          difference: number
          id: string
          new_rate: number
          open_item_id: string
          original_amount_rsd: number
          original_rate: number
          revaluation_id: string
          revalued_amount_rsd: number
        }
        Insert: {
          currency: string
          difference: number
          id?: string
          new_rate: number
          open_item_id: string
          original_amount_rsd: number
          original_rate: number
          revaluation_id: string
          revalued_amount_rsd: number
        }
        Update: {
          currency?: string
          difference?: number
          id?: string
          new_rate?: number
          open_item_id?: string
          original_amount_rsd?: number
          original_rate?: number
          revaluation_id?: string
          revalued_amount_rsd?: number
        }
        Relationships: [
          {
            foreignKeyName: "fx_revaluation_lines_open_item_id_fkey"
            columns: ["open_item_id"]
            isOneToOne: false
            referencedRelation: "open_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fx_revaluation_lines_revaluation_id_fkey"
            columns: ["revaluation_id"]
            isOneToOne: false
            referencedRelation: "fx_revaluations"
            referencedColumns: ["id"]
          },
        ]
      }
      fx_revaluations: {
        Row: {
          base_currency: string
          created_at: string
          created_by: string | null
          id: string
          journal_entry_id: string | null
          legal_entity_id: string | null
          revaluation_date: string
          tenant_id: string
          total_gain: number
          total_loss: number
        }
        Insert: {
          base_currency?: string
          created_at?: string
          created_by?: string | null
          id?: string
          journal_entry_id?: string | null
          legal_entity_id?: string | null
          revaluation_date: string
          tenant_id: string
          total_gain?: number
          total_loss?: number
        }
        Update: {
          base_currency?: string
          created_at?: string
          created_by?: string | null
          id?: string
          journal_entry_id?: string | null
          legal_entity_id?: string | null
          revaluation_date?: string
          tenant_id?: string
          total_gain?: number
          total_loss?: number
        }
        Relationships: [
          {
            foreignKeyName: "fx_revaluations_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fx_revaluations_legal_entity_id_fkey"
            columns: ["legal_entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fx_revaluations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      goods_receipt_lines: {
        Row: {
          created_at: string
          goods_receipt_id: string
          id: string
          product_id: string
          quantity_ordered: number
          quantity_received: number
        }
        Insert: {
          created_at?: string
          goods_receipt_id: string
          id?: string
          product_id: string
          quantity_ordered?: number
          quantity_received?: number
        }
        Update: {
          created_at?: string
          goods_receipt_id?: string
          id?: string
          product_id?: string
          quantity_ordered?: number
          quantity_received?: number
        }
        Relationships: [
          {
            foreignKeyName: "goods_receipt_lines_goods_receipt_id_fkey"
            columns: ["goods_receipt_id"]
            isOneToOne: false
            referencedRelation: "goods_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipt_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      goods_receipts: {
        Row: {
          created_at: string
          id: string
          legal_entity_id: string | null
          notes: string | null
          purchase_order_id: string | null
          receipt_number: string
          received_at: string
          received_by: string | null
          status: string
          supplier_id: string | null
          tenant_id: string
          updated_at: string
          warehouse_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          legal_entity_id?: string | null
          notes?: string | null
          purchase_order_id?: string | null
          receipt_number: string
          received_at?: string
          received_by?: string | null
          status?: string
          supplier_id?: string | null
          tenant_id: string
          updated_at?: string
          warehouse_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          legal_entity_id?: string | null
          notes?: string | null
          purchase_order_id?: string | null
          receipt_number?: string
          received_at?: string
          received_by?: string | null
          status?: string
          supplier_id?: string | null
          tenant_id?: string
          updated_at?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goods_receipts_legal_entity_id_fkey"
            columns: ["legal_entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipts_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipts_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      holidays: {
        Row: {
          company_id: string | null
          created_at: string
          date: string
          id: string
          is_recurring: boolean
          name: string
          tenant_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          date: string
          id?: string
          is_recurring?: boolean
          name: string
          tenant_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          date?: string
          id?: string
          is_recurring?: boolean
          name?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "holidays_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holidays_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      insurance_records: {
        Row: {
          created_at: string
          employee_id: string | null
          first_name: string
          id: string
          insurance_end: string | null
          insurance_start: string
          jmbg: string
          last_name: string
          lbo: string | null
          middle_name: string | null
          registration_date: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          employee_id?: string | null
          first_name: string
          id?: string
          insurance_end?: string | null
          insurance_start: string
          jmbg: string
          last_name: string
          lbo?: string | null
          middle_name?: string | null
          registration_date?: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          employee_id?: string | null
          first_name?: string
          id?: string
          insurance_end?: string | null
          insurance_start?: string
          jmbg?: string
          last_name?: string
          lbo?: string | null
          middle_name?: string | null
          registration_date?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "insurance_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurance_records_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_goods_receipt_items: {
        Row: {
          discrepancy_notes: string | null
          id: string
          product_id: string
          quantity_expected: number
          quantity_received: number
          receipt_id: string
          transfer_item_id: string | null
        }
        Insert: {
          discrepancy_notes?: string | null
          id?: string
          product_id: string
          quantity_expected?: number
          quantity_received?: number
          receipt_id: string
          transfer_item_id?: string | null
        }
        Update: {
          discrepancy_notes?: string | null
          id?: string
          product_id?: string
          quantity_expected?: number
          quantity_received?: number
          receipt_id?: string
          transfer_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "internal_goods_receipt_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_goods_receipt_items_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "internal_goods_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_goods_receipt_items_transfer_item_id_fkey"
            columns: ["transfer_item_id"]
            isOneToOne: false
            referencedRelation: "internal_transfer_items"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_goods_receipts: {
        Row: {
          confirmed_at: string | null
          created_at: string
          id: string
          internal_transfer_id: string
          notes: string | null
          receipt_number: string
          received_by: string | null
          receiving_warehouse_id: string
          status: string
          tenant_id: string
        }
        Insert: {
          confirmed_at?: string | null
          created_at?: string
          id?: string
          internal_transfer_id: string
          notes?: string | null
          receipt_number: string
          received_by?: string | null
          receiving_warehouse_id: string
          status?: string
          tenant_id: string
        }
        Update: {
          confirmed_at?: string | null
          created_at?: string
          id?: string
          internal_transfer_id?: string
          notes?: string | null
          receipt_number?: string
          received_by?: string | null
          receiving_warehouse_id?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_goods_receipts_internal_transfer_id_fkey"
            columns: ["internal_transfer_id"]
            isOneToOne: false
            referencedRelation: "internal_transfers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_goods_receipts_receiving_warehouse_id_fkey"
            columns: ["receiving_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_goods_receipts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_order_items: {
        Row: {
          id: string
          internal_order_id: string
          product_id: string
          quantity_approved: number | null
          quantity_requested: number
        }
        Insert: {
          id?: string
          internal_order_id: string
          product_id: string
          quantity_approved?: number | null
          quantity_requested?: number
        }
        Update: {
          id?: string
          internal_order_id?: string
          product_id?: string
          quantity_approved?: number | null
          quantity_requested?: number
        }
        Relationships: [
          {
            foreignKeyName: "internal_order_items_internal_order_id_fkey"
            columns: ["internal_order_id"]
            isOneToOne: false
            referencedRelation: "internal_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_orders: {
        Row: {
          approved_by: string | null
          created_at: string
          id: string
          notes: string | null
          order_number: string
          requested_by: string | null
          requesting_location_id: string | null
          source_warehouse_id: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          order_number: string
          requested_by?: string | null
          requesting_location_id?: string | null
          source_warehouse_id?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          order_number?: string
          requested_by?: string | null
          requesting_location_id?: string | null
          source_warehouse_id?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_orders_requesting_location_id_fkey"
            columns: ["requesting_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_orders_source_warehouse_id_fkey"
            columns: ["source_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_transfer_items: {
        Row: {
          id: string
          product_id: string
          quantity_received: number | null
          quantity_sent: number
          transfer_id: string
        }
        Insert: {
          id?: string
          product_id: string
          quantity_received?: number | null
          quantity_sent?: number
          transfer_id: string
        }
        Update: {
          id?: string
          product_id?: string
          quantity_received?: number | null
          quantity_sent?: number
          transfer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_transfer_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_transfer_items_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "internal_transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_transfers: {
        Row: {
          confirmed_at: string | null
          created_at: string
          created_by: string | null
          delivered_at: string | null
          from_warehouse_id: string
          id: string
          internal_order_id: string | null
          notes: string | null
          shipped_at: string | null
          status: string
          tenant_id: string
          to_warehouse_id: string
          transfer_number: string
          updated_at: string
        }
        Insert: {
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          from_warehouse_id: string
          id?: string
          internal_order_id?: string | null
          notes?: string | null
          shipped_at?: string | null
          status?: string
          tenant_id: string
          to_warehouse_id: string
          transfer_number: string
          updated_at?: string
        }
        Update: {
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          from_warehouse_id?: string
          id?: string
          internal_order_id?: string | null
          notes?: string | null
          shipped_at?: string | null
          status?: string
          tenant_id?: string
          to_warehouse_id?: string
          transfer_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_transfers_from_warehouse_id_fkey"
            columns: ["from_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_transfers_internal_order_id_fkey"
            columns: ["internal_order_id"]
            isOneToOne: false
            referencedRelation: "internal_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_transfers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_transfers_to_warehouse_id_fkey"
            columns: ["to_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_cost_layers: {
        Row: {
          created_at: string
          id: string
          layer_date: string
          product_id: string
          quantity_remaining: number
          reference: string | null
          tenant_id: string
          unit_cost: number
          warehouse_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          layer_date: string
          product_id: string
          quantity_remaining: number
          reference?: string | null
          tenant_id: string
          unit_cost: number
          warehouse_id: string
        }
        Update: {
          created_at?: string
          id?: string
          layer_date?: string
          product_id?: string
          quantity_remaining?: number
          reference?: string | null
          tenant_id?: string
          unit_cost?: number
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_cost_layers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_cost_layers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_cost_layers_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          movement_type: string
          notes: string | null
          product_id: string
          quantity: number
          reference: string | null
          tenant_id: string
          unit_cost: number | null
          warehouse_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type?: string
          notes?: string | null
          product_id: string
          quantity?: number
          reference?: string | null
          tenant_id: string
          unit_cost?: number | null
          warehouse_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type?: string
          notes?: string | null
          product_id?: string
          quantity?: number
          reference?: string | null
          tenant_id?: string
          unit_cost?: number | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_stock: {
        Row: {
          id: string
          min_stock_level: number
          product_id: string
          quantity_on_hand: number
          quantity_reserved: number
          tenant_id: string
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          id?: string
          min_stock_level?: number
          product_id: string
          quantity_on_hand?: number
          quantity_reserved?: number
          tenant_id: string
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          id?: string
          min_stock_level?: number
          product_id?: string
          quantity_on_hand?: number
          quantity_reserved?: number
          tenant_id?: string
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_stock_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_stock_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_stock_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_lines: {
        Row: {
          created_at: string
          description: string
          id: string
          invoice_id: string
          line_total: number
          product_id: string | null
          quantity: number
          sort_order: number
          tax_amount: number
          tax_rate_id: string | null
          tax_rate_value: number
          total_with_tax: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          invoice_id: string
          line_total?: number
          product_id?: string | null
          quantity?: number
          sort_order?: number
          tax_amount?: number
          tax_rate_id?: string | null
          tax_rate_value?: number
          total_with_tax?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          line_total?: number
          product_id?: string | null
          quantity?: number
          sort_order?: number
          tax_amount?: number
          tax_rate_id?: string | null
          tax_rate_value?: number
          total_with_tax?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_lines_tax_rate_id_fkey"
            columns: ["tax_rate_id"]
            isOneToOne: false
            referencedRelation: "tax_rates"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          advance_amount_applied: number
          advance_invoice_id: string | null
          amount_paid: number
          balance_due: number | null
          created_at: string
          created_by: string | null
          currency: string
          due_date: string | null
          id: string
          invoice_date: string
          invoice_number: string
          invoice_type: string
          journal_entry_id: string | null
          legal_entity_id: string | null
          notes: string | null
          paid_at: string | null
          partner_address: string | null
          partner_id: string | null
          partner_name: string
          partner_pib: string | null
          proforma_id: string | null
          sale_type: string
          sales_channel_id: string | null
          sales_order_id: string | null
          salesperson_id: string | null
          sef_request_id: string | null
          sef_status: string
          status: string
          subtotal: number
          tax_amount: number
          tenant_id: string
          total: number
          updated_at: string
          voucher_original_invoice_id: string | null
          voucher_type: string | null
        }
        Insert: {
          advance_amount_applied?: number
          advance_invoice_id?: string | null
          amount_paid?: number
          balance_due?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string
          due_date?: string | null
          id?: string
          invoice_date?: string
          invoice_number: string
          invoice_type?: string
          journal_entry_id?: string | null
          legal_entity_id?: string | null
          notes?: string | null
          paid_at?: string | null
          partner_address?: string | null
          partner_id?: string | null
          partner_name?: string
          partner_pib?: string | null
          proforma_id?: string | null
          sale_type?: string
          sales_channel_id?: string | null
          sales_order_id?: string | null
          salesperson_id?: string | null
          sef_request_id?: string | null
          sef_status?: string
          status?: string
          subtotal?: number
          tax_amount?: number
          tenant_id: string
          total?: number
          updated_at?: string
          voucher_original_invoice_id?: string | null
          voucher_type?: string | null
        }
        Update: {
          advance_amount_applied?: number
          advance_invoice_id?: string | null
          amount_paid?: number
          balance_due?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string
          due_date?: string | null
          id?: string
          invoice_date?: string
          invoice_number?: string
          invoice_type?: string
          journal_entry_id?: string | null
          legal_entity_id?: string | null
          notes?: string | null
          paid_at?: string | null
          partner_address?: string | null
          partner_id?: string | null
          partner_name?: string
          partner_pib?: string | null
          proforma_id?: string | null
          sale_type?: string
          sales_channel_id?: string | null
          sales_order_id?: string | null
          salesperson_id?: string | null
          sef_request_id?: string | null
          sef_status?: string
          status?: string
          subtotal?: number
          tax_amount?: number
          tenant_id?: string
          total?: number
          updated_at?: string
          voucher_original_invoice_id?: string | null
          voucher_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_advance_invoice_id_fkey"
            columns: ["advance_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_legal_entity_id_fkey"
            columns: ["legal_entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_sales_channel_id_fkey"
            columns: ["sales_channel_id"]
            isOneToOne: false
            referencedRelation: "sales_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_salesperson_id_fkey"
            columns: ["salesperson_id"]
            isOneToOne: false
            referencedRelation: "salespeople"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_voucher_original_invoice_id_fkey"
            columns: ["voucher_original_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          entry_date: string
          entry_number: string
          fiscal_period_id: string | null
          id: string
          is_storno: boolean
          legal_entity_id: string | null
          posted_at: string | null
          posted_by: string | null
          reference: string | null
          source: string
          status: string
          storno_by_id: string | null
          storno_of_id: string | null
          storno_reason: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          entry_date?: string
          entry_number: string
          fiscal_period_id?: string | null
          id?: string
          is_storno?: boolean
          legal_entity_id?: string | null
          posted_at?: string | null
          posted_by?: string | null
          reference?: string | null
          source?: string
          status?: string
          storno_by_id?: string | null
          storno_of_id?: string | null
          storno_reason?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          entry_date?: string
          entry_number?: string
          fiscal_period_id?: string | null
          id?: string
          is_storno?: boolean
          legal_entity_id?: string | null
          posted_at?: string | null
          posted_by?: string | null
          reference?: string | null
          source?: string
          status?: string
          storno_by_id?: string | null
          storno_of_id?: string | null
          storno_reason?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_fiscal_period_id_fkey"
            columns: ["fiscal_period_id"]
            isOneToOne: false
            referencedRelation: "fiscal_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_legal_entity_id_fkey"
            columns: ["legal_entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_storno_by_id_fkey"
            columns: ["storno_by_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_storno_of_id_fkey"
            columns: ["storno_of_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_lines: {
        Row: {
          account_id: string
          cost_center_id: string | null
          created_at: string
          credit: number
          debit: number
          description: string | null
          id: string
          journal_entry_id: string
          sort_order: number
        }
        Insert: {
          account_id: string
          cost_center_id?: string | null
          created_at?: string
          credit?: number
          debit?: number
          description?: string | null
          id?: string
          journal_entry_id: string
          sort_order?: number
        }
        Update: {
          account_id?: string
          cost_center_id?: string | null
          created_at?: string
          credit?: number
          debit?: number
          description?: string | null
          id?: string
          journal_entry_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "journal_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      kalkulacija_items: {
        Row: {
          id: string
          kalkulacija_id: string
          markup_percent: number
          pdv_rate: number
          product_id: string
          purchase_price: number
          quantity: number
          retail_price: number
          sort_order: number
        }
        Insert: {
          id?: string
          kalkulacija_id: string
          markup_percent?: number
          pdv_rate?: number
          product_id: string
          purchase_price?: number
          quantity?: number
          retail_price?: number
          sort_order?: number
        }
        Update: {
          id?: string
          kalkulacija_id?: string
          markup_percent?: number
          pdv_rate?: number
          product_id?: string
          purchase_price?: number
          quantity?: number
          retail_price?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "kalkulacija_items_kalkulacija_id_fkey"
            columns: ["kalkulacija_id"]
            isOneToOne: false
            referencedRelation: "kalkulacije"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kalkulacija_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      kalkulacije: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          internal_receipt_id: string | null
          journal_entry_id: string | null
          kalkulacija_date: string
          kalkulacija_number: string
          notes: string | null
          status: string
          tenant_id: string
          updated_at: string
          warehouse_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          internal_receipt_id?: string | null
          journal_entry_id?: string | null
          kalkulacija_date?: string
          kalkulacija_number: string
          notes?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
          warehouse_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          internal_receipt_id?: string | null
          journal_entry_id?: string | null
          kalkulacija_date?: string
          kalkulacija_number?: string
          notes?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kalkulacije_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kalkulacije_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kalkulacije_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      kompenzacija: {
        Row: {
          created_at: string
          created_by: string | null
          document_date: string
          document_number: string
          id: string
          journal_entry_id: string | null
          legal_entity_id: string | null
          notes: string | null
          partner_id: string
          status: string
          tenant_id: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          document_date: string
          document_number: string
          id?: string
          journal_entry_id?: string | null
          legal_entity_id?: string | null
          notes?: string | null
          partner_id: string
          status?: string
          tenant_id: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          document_date?: string
          document_number?: string
          id?: string
          journal_entry_id?: string | null
          legal_entity_id?: string | null
          notes?: string | null
          partner_id?: string
          status?: string
          tenant_id?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kompenzacija_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kompenzacija_legal_entity_id_fkey"
            columns: ["legal_entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kompenzacija_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kompenzacija_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      kompenzacija_items: {
        Row: {
          amount: number
          direction: string
          id: string
          kompenzacija_id: string
          open_item_id: string
        }
        Insert: {
          amount: number
          direction: string
          id?: string
          kompenzacija_id: string
          open_item_id: string
        }
        Update: {
          amount?: number
          direction?: string
          id?: string
          kompenzacija_id?: string
          open_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kompenzacija_items_kompenzacija_id_fkey"
            columns: ["kompenzacija_id"]
            isOneToOne: false
            referencedRelation: "kompenzacija"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kompenzacija_items_open_item_id_fkey"
            columns: ["open_item_id"]
            isOneToOne: false
            referencedRelation: "open_items"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_to: string | null
          company: string | null
          contact_id: string | null
          converted_partner_id: string | null
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          job_title: string | null
          last_name: string | null
          name: string
          notes: string | null
          phone: string | null
          source: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          company?: string | null
          contact_id?: string | null
          converted_partner_id?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          job_title?: string | null
          last_name?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          source?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          company?: string | null
          contact_id?: string | null
          converted_partner_id?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          job_title?: string | null
          last_name?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          source?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_converted_partner_id_fkey"
            columns: ["converted_partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          days_count: number
          employee_id: string
          end_date: string
          id: string
          leave_type: Database["public"]["Enums"]["leave_type"]
          reason: string | null
          start_date: string
          status: Database["public"]["Enums"]["leave_status"]
          tenant_id: string
          updated_at: string
          vacation_year: number | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          days_count?: number
          employee_id: string
          end_date: string
          id?: string
          leave_type?: Database["public"]["Enums"]["leave_type"]
          reason?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["leave_status"]
          tenant_id: string
          updated_at?: string
          vacation_year?: number | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          days_count?: number
          employee_id?: string
          end_date?: string
          id?: string
          leave_type?: Database["public"]["Enums"]["leave_type"]
          reason?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["leave_status"]
          tenant_id?: string
          updated_at?: string
          vacation_year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      legacy_import_sessions: {
        Row: {
          analysis: Json | null
          confirmed_mapping: Json | null
          created_at: string
          id: string
          import_results: Json | null
          status: string
          tenant_id: string | null
          updated_at: string
          zip_filename: string | null
          zip_storage_path: string | null
        }
        Insert: {
          analysis?: Json | null
          confirmed_mapping?: Json | null
          created_at?: string
          id?: string
          import_results?: Json | null
          status?: string
          tenant_id?: string | null
          updated_at?: string
          zip_filename?: string | null
          zip_storage_path?: string | null
        }
        Update: {
          analysis?: Json | null
          confirmed_mapping?: Json | null
          created_at?: string
          id?: string
          import_results?: Json | null
          status?: string
          tenant_id?: string | null
          updated_at?: string
          zip_filename?: string | null
          zip_storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "legacy_import_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_entities: {
        Row: {
          address: string | null
          city: string | null
          country: string
          created_at: string
          id: string
          maticni_broj: string | null
          name: string
          pib: string | null
          postal_code: string | null
          settings: Json
          tenant_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          country?: string
          created_at?: string
          id?: string
          maticni_broj?: string | null
          name: string
          pib?: string | null
          postal_code?: string | null
          settings?: Json
          tenant_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          country?: string
          created_at?: string
          id?: string
          maticni_broj?: string | null
          name?: string
          pib?: string | null
          postal_code?: string | null
          settings?: Json
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_entities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_payments: {
        Row: {
          created_at: string
          id: string
          interest_amount: number
          journal_entry_id: string | null
          loan_id: string
          payment_date: string
          period_number: number
          principal_amount: number
          tenant_id: string
          total_amount: number
        }
        Insert: {
          created_at?: string
          id?: string
          interest_amount?: number
          journal_entry_id?: string | null
          loan_id: string
          payment_date?: string
          period_number: number
          principal_amount?: number
          tenant_id: string
          total_amount?: number
        }
        Update: {
          created_at?: string
          id?: string
          interest_amount?: number
          journal_entry_id?: string | null
          loan_id?: string
          payment_date?: string
          period_number?: number
          principal_amount?: number
          tenant_id?: string
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "loan_payments_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_payments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_schedules: {
        Row: {
          balance: number
          created_at: string
          due_date: string
          id: string
          interest_payment: number
          journal_entry_id: string | null
          loan_id: string
          principal_payment: number
          status: string
          tenant_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          due_date: string
          id?: string
          interest_payment?: number
          journal_entry_id?: string | null
          loan_id: string
          principal_payment?: number
          status?: string
          tenant_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          due_date?: string
          id?: string
          interest_payment?: number
          journal_entry_id?: string | null
          loan_id?: string
          principal_payment?: number
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_schedules_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_schedules_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_schedules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      loans: {
        Row: {
          created_at: string
          currency: string
          description: string | null
          id: string
          interest_rate: number
          partner_id: string | null
          principal: number
          start_date: string
          status: string
          tenant_id: string
          term_months: number
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          interest_rate?: number
          partner_id?: string | null
          principal?: number
          start_date: string
          status?: string
          tenant_id: string
          term_months?: number
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          interest_rate?: number
          partner_id?: string | null
          principal?: number
          start_date?: string
          status?: string
          tenant_id?: string
          term_months?: number
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loans_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      location_types: {
        Row: {
          code: string
          created_at: string
          has_sellers: boolean
          has_warehouse: boolean
          id: string
          is_active: boolean
          name: string
          tenant_id: string
        }
        Insert: {
          code: string
          created_at?: string
          has_sellers?: boolean
          has_warehouse?: boolean
          id?: string
          is_active?: boolean
          name: string
          tenant_id: string
        }
        Update: {
          code?: string
          created_at?: string
          has_sellers?: boolean
          has_warehouse?: boolean
          id?: string
          is_active?: boolean
          name?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_types_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          default_price_list_id: string | null
          default_warehouse_id: string | null
          id: string
          is_active: boolean
          location_type_id: string | null
          name: string
          tenant_id: string
          type: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          default_price_list_id?: string | null
          default_warehouse_id?: string | null
          id?: string
          is_active?: boolean
          location_type_id?: string | null
          name: string
          tenant_id: string
          type?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          default_price_list_id?: string | null
          default_warehouse_id?: string | null
          id?: string
          is_active?: boolean
          location_type_id?: string | null
          name?: string
          tenant_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_default_price_list_id_fkey"
            columns: ["default_price_list_id"]
            isOneToOne: false
            referencedRelation: "retail_price_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locations_default_warehouse_id_fkey"
            columns: ["default_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locations_location_type_id_fkey"
            columns: ["location_type_id"]
            isOneToOne: false
            referencedRelation: "location_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_participants: {
        Row: {
          company_id: string | null
          contact_id: string | null
          employee_id: string | null
          external_email: string | null
          external_name: string | null
          id: string
          is_internal: boolean | null
          is_organizer: boolean | null
          meeting_id: string
          partner_id: string | null
          tenant_id: string
        }
        Insert: {
          company_id?: string | null
          contact_id?: string | null
          employee_id?: string | null
          external_email?: string | null
          external_name?: string | null
          id?: string
          is_internal?: boolean | null
          is_organizer?: boolean | null
          meeting_id: string
          partner_id?: string | null
          tenant_id: string
        }
        Update: {
          company_id?: string | null
          contact_id?: string | null
          employee_id?: string | null
          external_email?: string | null
          external_name?: string | null
          id?: string
          is_internal?: boolean | null
          is_organizer?: boolean | null
          meeting_id?: string
          partner_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_participants_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_participants_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_participants_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_participants_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_participants_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_types: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          name_sr: string | null
          tenant_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          name_sr?: string | null
          tenant_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          name_sr?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_types_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          communication_channel: string | null
          created_at: string
          created_by: string | null
          description: string | null
          duration_minutes: number | null
          id: string
          location: string | null
          meeting_type_id: string | null
          next_steps: string | null
          notes: string | null
          opportunity_id: string | null
          outcome: string | null
          partner_id: string | null
          scheduled_at: string
          status: string | null
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          communication_channel?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          location?: string | null
          meeting_type_id?: string | null
          next_steps?: string | null
          notes?: string | null
          opportunity_id?: string | null
          outcome?: string | null
          partner_id?: string | null
          scheduled_at: string
          status?: string | null
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          communication_channel?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          location?: string | null
          meeting_type_id?: string | null
          next_steps?: string | null
          notes?: string | null
          opportunity_id?: string | null
          outcome?: string | null
          partner_id?: string | null
          scheduled_at?: string
          status?: string | null
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_meeting_type_id_fkey"
            columns: ["meeting_type_id"]
            isOneToOne: false
            referencedRelation: "meeting_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      module_definitions: {
        Row: {
          description: string | null
          icon: string | null
          id: string
          key: string
          name: string
          sort_order: number
        }
        Insert: {
          description?: string | null
          icon?: string | null
          id?: string
          key: string
          name: string
          sort_order?: number
        }
        Update: {
          description?: string | null
          icon?: string | null
          id?: string
          key?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      module_event_logs: {
        Row: {
          error_message: string | null
          event_id: string
          executed_at: string
          id: string
          response: Json | null
          status: string
          subscription_id: string
        }
        Insert: {
          error_message?: string | null
          event_id: string
          executed_at?: string
          id?: string
          response?: Json | null
          status: string
          subscription_id: string
        }
        Update: {
          error_message?: string | null
          event_id?: string
          executed_at?: string
          id?: string
          response?: Json | null
          status?: string
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_event_logs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "module_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_event_logs_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "module_event_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      module_event_subscriptions: {
        Row: {
          created_at: string
          event_type: string
          handler_function: string
          handler_module: string
          id: string
          is_active: boolean
        }
        Insert: {
          created_at?: string
          event_type: string
          handler_function: string
          handler_module: string
          id?: string
          is_active?: boolean
        }
        Update: {
          created_at?: string
          event_type?: string
          handler_function?: string
          handler_module?: string
          id?: string
          is_active?: boolean
        }
        Relationships: []
      }
      module_events: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          error_message: string | null
          event_type: string
          id: string
          max_retries: number
          payload: Json
          processed_at: string | null
          retry_count: number
          source_module: string
          status: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          error_message?: string | null
          event_type: string
          id?: string
          max_retries?: number
          payload?: Json
          processed_at?: string | null
          retry_count?: number
          source_module: string
          status?: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          error_message?: string | null
          event_type?: string
          id?: string
          max_retries?: number
          payload?: Json
          processed_at?: string | null
          retry_count?: number
          source_module?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      night_work_daily_entries: {
        Row: {
          created_at: string
          date: string
          employee_id: string
          hours: number
          id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          date: string
          employee_id: string
          hours?: number
          id?: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          date?: string
          employee_id?: string
          hours?: number
          id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "night_work_daily_entries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "night_work_daily_entries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      night_work_hours: {
        Row: {
          created_at: string
          employee_id: string
          hours: number
          id: string
          month: number
          tenant_id: string
          tracking_type: string
          year: number
        }
        Insert: {
          created_at?: string
          employee_id: string
          hours?: number
          id?: string
          month: number
          tenant_id: string
          tracking_type?: string
          year: number
        }
        Update: {
          created_at?: string
          employee_id?: string
          hours?: number
          id?: string
          month?: number
          tenant_id?: string
          tracking_type?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "night_work_hours_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "night_work_hours_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      nivelacija_items: {
        Row: {
          id: string
          new_retail_price: number
          nivelacija_id: string
          old_retail_price: number
          price_difference: number
          product_id: string
          quantity_on_hand: number
          sort_order: number
        }
        Insert: {
          id?: string
          new_retail_price?: number
          nivelacija_id: string
          old_retail_price?: number
          price_difference?: number
          product_id: string
          quantity_on_hand?: number
          sort_order?: number
        }
        Update: {
          id?: string
          new_retail_price?: number
          nivelacija_id?: string
          old_retail_price?: number
          price_difference?: number
          product_id?: string
          quantity_on_hand?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "nivelacija_items_nivelacija_id_fkey"
            columns: ["nivelacija_id"]
            isOneToOne: false
            referencedRelation: "nivelacije"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nivelacija_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      nivelacije: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          journal_entry_id: string | null
          nivelacija_date: string
          nivelacija_number: string
          notes: string | null
          status: string
          tenant_id: string
          updated_at: string
          warehouse_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          journal_entry_id?: string | null
          nivelacija_date?: string
          nivelacija_number: string
          notes?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
          warehouse_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          journal_entry_id?: string | null
          nivelacija_date?: string
          nivelacija_number?: string
          notes?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nivelacije_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nivelacije_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nivelacije_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          category: string
          created_at: string
          enabled: boolean
          id: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          enabled?: boolean
          id?: string
          tenant_id: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          enabled?: boolean
          id?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          category: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          is_read: boolean
          message: string
          tenant_id: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean
          message: string
          tenant_id: string
          title: string
          type?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean
          message?: string
          tenant_id?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      open_item_payments: {
        Row: {
          amount: number
          bank_statement_line_id: string | null
          created_at: string
          id: string
          journal_entry_id: string | null
          open_item_id: string
          payment_date: string
          payment_type: string
          reference: string | null
          tenant_id: string
        }
        Insert: {
          amount?: number
          bank_statement_line_id?: string | null
          created_at?: string
          id?: string
          journal_entry_id?: string | null
          open_item_id: string
          payment_date: string
          payment_type?: string
          reference?: string | null
          tenant_id: string
        }
        Update: {
          amount?: number
          bank_statement_line_id?: string | null
          created_at?: string
          id?: string
          journal_entry_id?: string | null
          open_item_id?: string
          payment_date?: string
          payment_type?: string
          reference?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "open_item_payments_bank_statement_line_id_fkey"
            columns: ["bank_statement_line_id"]
            isOneToOne: false
            referencedRelation: "bank_statement_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "open_item_payments_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "open_item_payments_open_item_id_fkey"
            columns: ["open_item_id"]
            isOneToOne: false
            referencedRelation: "open_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "open_item_payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      open_items: {
        Row: {
          closed_at: string | null
          created_at: string
          currency: string
          direction: string
          document_date: string
          document_id: string | null
          document_number: string
          document_type: string
          due_date: string | null
          id: string
          notes: string | null
          original_amount: number
          paid_amount: number
          partner_id: string | null
          remaining_amount: number
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          currency?: string
          direction?: string
          document_date: string
          document_id?: string | null
          document_number: string
          document_type: string
          due_date?: string | null
          id?: string
          notes?: string | null
          original_amount?: number
          paid_amount?: number
          partner_id?: string | null
          remaining_amount?: number
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          currency?: string
          direction?: string
          document_date?: string
          document_id?: string | null
          document_number?: string
          document_type?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          original_amount?: number
          paid_amount?: number
          partner_id?: string | null
          remaining_amount?: number
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "open_items_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "open_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunities: {
        Row: {
          assigned_to: string | null
          closed_at: string | null
          contact_id: string | null
          created_at: string
          currency: string
          description: string | null
          expected_close_date: string | null
          followup_opportunity_id: string | null
          id: string
          lead_id: string | null
          lost_amount: number | null
          lost_reason: string | null
          notes: string | null
          partner_id: string | null
          probability: number
          salesperson_id: string | null
          stage: string
          tenant_id: string
          title: string
          updated_at: string
          value: number
          won_amount: number | null
          won_reason: string | null
        }
        Insert: {
          assigned_to?: string | null
          closed_at?: string | null
          contact_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          expected_close_date?: string | null
          followup_opportunity_id?: string | null
          id?: string
          lead_id?: string | null
          lost_amount?: number | null
          lost_reason?: string | null
          notes?: string | null
          partner_id?: string | null
          probability?: number
          salesperson_id?: string | null
          stage?: string
          tenant_id: string
          title: string
          updated_at?: string
          value?: number
          won_amount?: number | null
          won_reason?: string | null
        }
        Update: {
          assigned_to?: string | null
          closed_at?: string | null
          contact_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          expected_close_date?: string | null
          followup_opportunity_id?: string | null
          id?: string
          lead_id?: string | null
          lost_amount?: number | null
          lost_reason?: string | null
          notes?: string | null
          partner_id?: string | null
          probability?: number
          salesperson_id?: string | null
          stage?: string
          tenant_id?: string
          title?: string
          updated_at?: string
          value?: number
          won_amount?: number | null
          won_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_followup_opportunity_id_fkey"
            columns: ["followup_opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_salesperson_id_fkey"
            columns: ["salesperson_id"]
            isOneToOne: false
            referencedRelation: "salespeople"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_activities: {
        Row: {
          activity_type: string
          created_at: string
          description: string
          id: string
          metadata: Json | null
          opportunity_id: string
          tenant_id: string
          user_id: string | null
        }
        Insert: {
          activity_type: string
          created_at?: string
          description: string
          id?: string
          metadata?: Json | null
          opportunity_id: string
          tenant_id: string
          user_id?: string | null
        }
        Update: {
          activity_type?: string
          created_at?: string
          description?: string
          id?: string
          metadata?: Json | null
          opportunity_id?: string
          tenant_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_activities_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_activities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_activities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          opportunity_id: string
          parent_id: string | null
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          opportunity_id: string
          parent_id?: string | null
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          opportunity_id?: string
          parent_id?: string | null
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_comments_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "opportunity_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_comments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_documents: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          opportunity_id: string
          tenant_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          opportunity_id: string
          tenant_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          opportunity_id?: string
          tenant_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_documents_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_followers: {
        Row: {
          created_at: string
          id: string
          opportunity_id: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          opportunity_id: string
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          opportunity_id?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_followers_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_followers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_followers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_partners: {
        Row: {
          created_at: string | null
          id: string
          opportunity_id: string
          partner_id: string
          role: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          opportunity_id: string
          partner_id: string
          role?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          opportunity_id?: string
          partner_id?: string
          role?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_partners_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_partners_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_partners_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_stages: {
        Row: {
          code: string
          color: string | null
          created_at: string | null
          id: string
          is_lost: boolean | null
          is_partial: boolean | null
          is_system: boolean | null
          is_won: boolean | null
          name: string
          name_sr: string | null
          sort_order: number | null
          tenant_id: string
        }
        Insert: {
          code: string
          color?: string | null
          created_at?: string | null
          id?: string
          is_lost?: boolean | null
          is_partial?: boolean | null
          is_system?: boolean | null
          is_won?: boolean | null
          name: string
          name_sr?: string | null
          sort_order?: number | null
          tenant_id: string
        }
        Update: {
          code?: string
          color?: string | null
          created_at?: string | null
          id?: string
          is_lost?: boolean | null
          is_partial?: boolean | null
          is_system?: boolean | null
          is_won?: boolean | null
          name?: string
          name_sr?: string | null
          sort_order?: number | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_stages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_tags: {
        Row: {
          color: string | null
          created_at: string
          created_by: string | null
          id: string
          opportunity_id: string
          tag: string
          tenant_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          opportunity_id: string
          tag: string
          tenant_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          opportunity_id?: string
          tag?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_tags_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_tags_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_tags_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      overtime_daily_entries: {
        Row: {
          created_at: string
          date: string
          employee_id: string
          hours: number
          id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          date: string
          employee_id: string
          hours?: number
          id?: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          date?: string
          employee_id?: string
          hours?: number
          id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "overtime_daily_entries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "overtime_daily_entries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      overtime_hours: {
        Row: {
          created_at: string
          employee_id: string
          hours: number
          id: string
          month: number
          tenant_id: string
          tracking_type: string
          year: number
        }
        Insert: {
          created_at?: string
          employee_id: string
          hours?: number
          id?: string
          month: number
          tenant_id: string
          tracking_type?: string
          year: number
        }
        Update: {
          created_at?: string
          employee_id?: string
          hours?: number
          id?: string
          month?: number
          tenant_id?: string
          tracking_type?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "overtime_hours_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "overtime_hours_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_category_assignments: {
        Row: {
          category_id: string
          id: string
          partner_id: string
          tenant_id: string
        }
        Insert: {
          category_id: string
          id?: string
          partner_id: string
          tenant_id: string
        }
        Update: {
          category_id?: string
          id?: string
          partner_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_category_assignments_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "company_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_category_assignments_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_category_assignments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          account_tier: string | null
          address: string | null
          city: string | null
          contact_person: string | null
          country: string
          created_at: string
          credit_limit: number | null
          default_currency: string | null
          display_name: string | null
          dormancy_detected_at: string | null
          dormancy_status: string | null
          email: string | null
          id: string
          is_active: boolean
          last_invoice_date: string | null
          maticni_broj: string | null
          name: string
          notes: string | null
          payment_terms_days: number | null
          phone: string | null
          pib: string | null
          postal_code: string | null
          status: string
          tenant_id: string
          tier_revenue_12m: number | null
          tier_updated_at: string | null
          type: string
          updated_at: string
          website: string | null
        }
        Insert: {
          account_tier?: string | null
          address?: string | null
          city?: string | null
          contact_person?: string | null
          country?: string
          created_at?: string
          credit_limit?: number | null
          default_currency?: string | null
          display_name?: string | null
          dormancy_detected_at?: string | null
          dormancy_status?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          last_invoice_date?: string | null
          maticni_broj?: string | null
          name: string
          notes?: string | null
          payment_terms_days?: number | null
          phone?: string | null
          pib?: string | null
          postal_code?: string | null
          status?: string
          tenant_id: string
          tier_revenue_12m?: number | null
          tier_updated_at?: string | null
          type?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          account_tier?: string | null
          address?: string | null
          city?: string | null
          contact_person?: string | null
          country?: string
          created_at?: string
          credit_limit?: number | null
          default_currency?: string | null
          display_name?: string | null
          dormancy_detected_at?: string | null
          dormancy_status?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          last_invoice_date?: string | null
          maticni_broj?: string | null
          name?: string
          notes?: string | null
          payment_terms_days?: number | null
          phone?: string | null
          pib?: string | null
          postal_code?: string | null
          status?: string
          tenant_id?: string
          tier_revenue_12m?: number | null
          tier_updated_at?: string | null
          type?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partners_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_allocations: {
        Row: {
          allocated_at: string
          amount: number
          created_at: string
          created_by: string | null
          id: string
          invoice_id: string
          journal_entry_id: string | null
          notes: string | null
          payment_method: string
          reference: string | null
          tenant_id: string
        }
        Insert: {
          allocated_at?: string
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id: string
          journal_entry_id?: string | null
          notes?: string | null
          payment_method?: string
          reference?: string | null
          tenant_id: string
        }
        Update: {
          allocated_at?: string
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id?: string
          journal_entry_id?: string | null
          notes?: string | null
          payment_method?: string
          reference?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_allocations_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_income_categories: {
        Row: {
          ben_code: string
          ben_coefficient: number
          code: string
          created_at: string
          employer_health_exempt: boolean
          employer_pio_exempt: boolean
          employer_tax_exempt: boolean
          health_employee_rate: number
          health_employer_rate: number
          id: string
          is_active: boolean
          name: string
          ola_code: string
          ovp_code: string
          pio_employee_rate: number
          pio_employer_rate: number
          subsidy_health_employee_pct: number
          subsidy_health_employer_pct: number
          subsidy_pio_employee_pct: number
          subsidy_pio_employer_pct: number
          subsidy_tax_pct: number
          tax_rate: number
          tenant_id: string
          unemployment_employee_rate: number
        }
        Insert: {
          ben_code?: string
          ben_coefficient?: number
          code: string
          created_at?: string
          employer_health_exempt?: boolean
          employer_pio_exempt?: boolean
          employer_tax_exempt?: boolean
          health_employee_rate?: number
          health_employer_rate?: number
          id?: string
          is_active?: boolean
          name: string
          ola_code?: string
          ovp_code?: string
          pio_employee_rate?: number
          pio_employer_rate?: number
          subsidy_health_employee_pct?: number
          subsidy_health_employer_pct?: number
          subsidy_pio_employee_pct?: number
          subsidy_pio_employer_pct?: number
          subsidy_tax_pct?: number
          tax_rate?: number
          tenant_id: string
          unemployment_employee_rate?: number
        }
        Update: {
          ben_code?: string
          ben_coefficient?: number
          code?: string
          created_at?: string
          employer_health_exempt?: boolean
          employer_pio_exempt?: boolean
          employer_tax_exempt?: boolean
          health_employee_rate?: number
          health_employer_rate?: number
          id?: string
          is_active?: boolean
          name?: string
          ola_code?: string
          ovp_code?: string
          pio_employee_rate?: number
          pio_employer_rate?: number
          subsidy_health_employee_pct?: number
          subsidy_health_employer_pct?: number
          subsidy_pio_employee_pct?: number
          subsidy_pio_employer_pct?: number
          subsidy_tax_pct?: number
          tax_rate?: number
          tenant_id?: string
          unemployment_employee_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "payroll_income_categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_items: {
        Row: {
          actual_working_days: number
          ben_code: string | null
          created_at: string
          dlp_amount: number
          employee_id: string
          employer_health: number | null
          employer_pio: number | null
          gross_salary: number
          health_contribution: number
          health_employer: number
          id: string
          income_tax: number
          leave_days_deducted: number
          leave_deduction_amount: number
          meal_allowance: number | null
          municipal_tax: number
          net_salary: number
          night_work_hours_count: number
          ola_code: string | null
          overtime_hours_count: number
          overtime_multiplier: number | null
          ovp_code: string | null
          payroll_category_id: string | null
          payroll_run_id: string
          pension_contribution: number
          pension_employer: number
          subsidy_amount: number
          taxable_base: number
          total_cost: number
          transport_allowance: number | null
          unemployment_contribution: number
          working_days: number
        }
        Insert: {
          actual_working_days?: number
          ben_code?: string | null
          created_at?: string
          dlp_amount?: number
          employee_id: string
          employer_health?: number | null
          employer_pio?: number | null
          gross_salary?: number
          health_contribution?: number
          health_employer?: number
          id?: string
          income_tax?: number
          leave_days_deducted?: number
          leave_deduction_amount?: number
          meal_allowance?: number | null
          municipal_tax?: number
          net_salary?: number
          night_work_hours_count?: number
          ola_code?: string | null
          overtime_hours_count?: number
          overtime_multiplier?: number | null
          ovp_code?: string | null
          payroll_category_id?: string | null
          payroll_run_id: string
          pension_contribution?: number
          pension_employer?: number
          subsidy_amount?: number
          taxable_base?: number
          total_cost?: number
          transport_allowance?: number | null
          unemployment_contribution?: number
          working_days?: number
        }
        Update: {
          actual_working_days?: number
          ben_code?: string | null
          created_at?: string
          dlp_amount?: number
          employee_id?: string
          employer_health?: number | null
          employer_pio?: number | null
          gross_salary?: number
          health_contribution?: number
          health_employer?: number
          id?: string
          income_tax?: number
          leave_days_deducted?: number
          leave_deduction_amount?: number
          meal_allowance?: number | null
          municipal_tax?: number
          net_salary?: number
          night_work_hours_count?: number
          ola_code?: string | null
          overtime_hours_count?: number
          overtime_multiplier?: number | null
          ovp_code?: string | null
          payroll_category_id?: string | null
          payroll_run_id?: string
          pension_contribution?: number
          pension_employer?: number
          subsidy_amount?: number
          taxable_base?: number
          total_cost?: number
          transport_allowance?: number | null
          unemployment_contribution?: number
          working_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "payroll_items_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_items_payroll_category_id_fkey"
            columns: ["payroll_category_id"]
            isOneToOne: false
            referencedRelation: "payroll_income_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_items_payroll_run_id_fkey"
            columns: ["payroll_run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_parameters: {
        Row: {
          created_at: string
          effective_from: string
          effective_to: string | null
          gazette_reference: string | null
          health_employee_rate: number
          health_employer_rate: number
          id: string
          max_contribution_base: number
          meal_allowance_daily: number | null
          min_contribution_base: number
          minimum_hourly_wage: number | null
          night_work_multiplier: number | null
          nontaxable_amount: number
          overtime_multiplier: number | null
          pio_employee_rate: number
          pio_employer_rate: number
          tax_rate: number
          tenant_id: string
          transport_allowance_monthly: number | null
          unemployment_employee_rate: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          effective_from: string
          effective_to?: string | null
          gazette_reference?: string | null
          health_employee_rate?: number
          health_employer_rate?: number
          id?: string
          max_contribution_base?: number
          meal_allowance_daily?: number | null
          min_contribution_base?: number
          minimum_hourly_wage?: number | null
          night_work_multiplier?: number | null
          nontaxable_amount?: number
          overtime_multiplier?: number | null
          pio_employee_rate?: number
          pio_employer_rate?: number
          tax_rate?: number
          tenant_id: string
          transport_allowance_monthly?: number | null
          unemployment_employee_rate?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          gazette_reference?: string | null
          health_employee_rate?: number
          health_employer_rate?: number
          id?: string
          max_contribution_base?: number
          meal_allowance_daily?: number | null
          min_contribution_base?: number
          minimum_hourly_wage?: number | null
          night_work_multiplier?: number | null
          nontaxable_amount?: number
          overtime_multiplier?: number | null
          pio_employee_rate?: number
          pio_employer_rate?: number
          tax_rate?: number
          tenant_id?: string
          transport_allowance_monthly?: number | null
          unemployment_employee_rate?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_parameters_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_payment_types: {
        Row: {
          affects_benefits: boolean
          code: string
          created_at: string
          id: string
          is_active: boolean
          is_hourly: boolean
          is_nontaxable: boolean
          name: string
          rate_multiplier: number
          tenant_id: string
          type: string
        }
        Insert: {
          affects_benefits?: boolean
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_hourly?: boolean
          is_nontaxable?: boolean
          name: string
          rate_multiplier?: number
          tenant_id: string
          type?: string
        }
        Update: {
          affects_benefits?: boolean
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_hourly?: boolean
          is_nontaxable?: boolean
          name?: string
          rate_multiplier?: number
          tenant_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_payment_types_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_runs: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          period_month: number
          period_year: number
          status: Database["public"]["Enums"]["payroll_status"]
          tenant_id: string
          total_contributions: number
          total_gross: number
          total_net: number
          total_taxes: number
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          period_month: number
          period_year: number
          status?: Database["public"]["Enums"]["payroll_status"]
          tenant_id: string
          total_contributions?: number
          total_gross?: number
          total_net?: number
          total_taxes?: number
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          period_month?: number
          period_year?: number
          status?: Database["public"]["Enums"]["payroll_status"]
          tenant_id?: string
          total_contributions?: number
          total_gross?: number
          total_net?: number
          total_taxes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pdv_entries: {
        Row: {
          base_amount: number
          created_at: string
          direction: string
          document_date: string
          document_id: string | null
          document_number: string
          document_type: string
          id: string
          partner_name: string | null
          partner_pib: string | null
          pdv_period_id: string
          popdv_section: string
          tenant_id: string
          vat_amount: number
          vat_rate: number
        }
        Insert: {
          base_amount?: number
          created_at?: string
          direction?: string
          document_date: string
          document_id?: string | null
          document_number: string
          document_type: string
          id?: string
          partner_name?: string | null
          partner_pib?: string | null
          pdv_period_id: string
          popdv_section: string
          tenant_id: string
          vat_amount?: number
          vat_rate?: number
        }
        Update: {
          base_amount?: number
          created_at?: string
          direction?: string
          document_date?: string
          document_id?: string | null
          document_number?: string
          document_type?: string
          id?: string
          partner_name?: string | null
          partner_pib?: string | null
          pdv_period_id?: string
          popdv_section?: string
          tenant_id?: string
          vat_amount?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "pdv_entries_pdv_period_id_fkey"
            columns: ["pdv_period_id"]
            isOneToOne: false
            referencedRelation: "pdv_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pdv_entries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pdv_periods: {
        Row: {
          created_at: string
          end_date: string
          id: string
          input_vat: number
          legal_entity_id: string | null
          notes: string | null
          output_vat: number
          period_name: string
          start_date: string
          status: string
          submitted_at: string | null
          submitted_by: string | null
          tenant_id: string
          updated_at: string
          vat_liability: number
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          input_vat?: number
          legal_entity_id?: string | null
          notes?: string | null
          output_vat?: number
          period_name: string
          start_date: string
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          tenant_id: string
          updated_at?: string
          vat_liability?: number
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          input_vat?: number
          legal_entity_id?: string | null
          notes?: string | null
          output_vat?: number
          period_name?: string
          start_date?: string
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          tenant_id?: string
          updated_at?: string
          vat_liability?: number
        }
        Relationships: [
          {
            foreignKeyName: "pdv_periods_legal_entity_id_fkey"
            columns: ["legal_entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pdv_periods_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_daily_reports: {
        Row: {
          actual_cash_count: number | null
          card_total: number
          cash_total: number
          cash_variance: number | null
          created_at: string
          fiscal_device_id: string | null
          id: string
          location_id: string | null
          net_sales: number
          opening_float: number
          other_total: number
          refund_count: number
          report_date: string
          session_id: string | null
          tax_breakdown: Json
          tenant_id: string
          total_refunds: number
          total_sales: number
          transaction_count: number
        }
        Insert: {
          actual_cash_count?: number | null
          card_total?: number
          cash_total?: number
          cash_variance?: number | null
          created_at?: string
          fiscal_device_id?: string | null
          id?: string
          location_id?: string | null
          net_sales?: number
          opening_float?: number
          other_total?: number
          refund_count?: number
          report_date: string
          session_id?: string | null
          tax_breakdown?: Json
          tenant_id: string
          total_refunds?: number
          total_sales?: number
          transaction_count?: number
        }
        Update: {
          actual_cash_count?: number | null
          card_total?: number
          cash_total?: number
          cash_variance?: number | null
          created_at?: string
          fiscal_device_id?: string | null
          id?: string
          location_id?: string | null
          net_sales?: number
          opening_float?: number
          other_total?: number
          refund_count?: number
          report_date?: string
          session_id?: string | null
          tax_breakdown?: Json
          tenant_id?: string
          total_refunds?: number
          total_sales?: number
          transaction_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "pos_daily_reports_fiscal_device_id_fkey"
            columns: ["fiscal_device_id"]
            isOneToOne: false
            referencedRelation: "fiscal_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_daily_reports_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_daily_reports_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "pos_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_daily_reports_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_sessions: {
        Row: {
          closed_at: string | null
          closing_balance: number | null
          created_at: string
          fiscal_device_id: string | null
          id: string
          location_id: string | null
          notes: string | null
          opened_at: string
          opened_by: string | null
          opening_balance: number
          salesperson_id: string | null
          status: string
          tenant_id: string
          updated_at: string
          warehouse_id: string | null
        }
        Insert: {
          closed_at?: string | null
          closing_balance?: number | null
          created_at?: string
          fiscal_device_id?: string | null
          id?: string
          location_id?: string | null
          notes?: string | null
          opened_at?: string
          opened_by?: string | null
          opening_balance?: number
          salesperson_id?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
          warehouse_id?: string | null
        }
        Update: {
          closed_at?: string | null
          closing_balance?: number | null
          created_at?: string
          fiscal_device_id?: string | null
          id?: string
          location_id?: string | null
          notes?: string | null
          opened_at?: string
          opened_by?: string | null
          opening_balance?: number
          salesperson_id?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pos_sessions_fiscal_device_id_fkey"
            columns: ["fiscal_device_id"]
            isOneToOne: false
            referencedRelation: "fiscal_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_sessions_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_sessions_salesperson_id_fkey"
            columns: ["salesperson_id"]
            isOneToOne: false
            referencedRelation: "salespeople"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_sessions_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_transactions: {
        Row: {
          buyer_id: string | null
          created_at: string
          customer_name: string | null
          fiscal_device_id: string | null
          fiscal_receipt_number: string | null
          id: string
          invoice_id: string | null
          is_fiscal: boolean
          items: Json
          journal_entry_id: string | null
          location_id: string | null
          original_transaction_id: string | null
          payment_method: string
          receipt_type: string
          salesperson_id: string | null
          session_id: string
          status: string
          subtotal: number
          tax_amount: number
          tenant_id: string
          total: number
          transaction_number: string
          voucher_original_transaction_id: string | null
          voucher_type: string | null
          warehouse_id: string | null
        }
        Insert: {
          buyer_id?: string | null
          created_at?: string
          customer_name?: string | null
          fiscal_device_id?: string | null
          fiscal_receipt_number?: string | null
          id?: string
          invoice_id?: string | null
          is_fiscal?: boolean
          items?: Json
          journal_entry_id?: string | null
          location_id?: string | null
          original_transaction_id?: string | null
          payment_method?: string
          receipt_type?: string
          salesperson_id?: string | null
          session_id: string
          status?: string
          subtotal?: number
          tax_amount?: number
          tenant_id: string
          total?: number
          transaction_number: string
          voucher_original_transaction_id?: string | null
          voucher_type?: string | null
          warehouse_id?: string | null
        }
        Update: {
          buyer_id?: string | null
          created_at?: string
          customer_name?: string | null
          fiscal_device_id?: string | null
          fiscal_receipt_number?: string | null
          id?: string
          invoice_id?: string | null
          is_fiscal?: boolean
          items?: Json
          journal_entry_id?: string | null
          location_id?: string | null
          original_transaction_id?: string | null
          payment_method?: string
          receipt_type?: string
          salesperson_id?: string | null
          session_id?: string
          status?: string
          subtotal?: number
          tax_amount?: number
          tenant_id?: string
          total?: number
          transaction_number?: string
          voucher_original_transaction_id?: string | null
          voucher_type?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pos_transactions_fiscal_device_id_fkey"
            columns: ["fiscal_device_id"]
            isOneToOne: false
            referencedRelation: "fiscal_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_transactions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_transactions_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_transactions_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_transactions_original_transaction_id_fkey"
            columns: ["original_transaction_id"]
            isOneToOne: false
            referencedRelation: "pos_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_transactions_salesperson_id_fkey"
            columns: ["salesperson_id"]
            isOneToOne: false
            referencedRelation: "salespeople"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_transactions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "pos_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_transactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_transactions_voucher_original_transaction_id_fkey"
            columns: ["voucher_original_transaction_id"]
            isOneToOne: false
            referencedRelation: "pos_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_transactions_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      position_templates: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          tenant_id: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          tenant_id: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "position_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      posting_rule_catalog: {
        Row: {
          created_at: string
          credit_account_code: string | null
          debit_account_code: string | null
          description: string
          id: string
          is_active: boolean
          rule_code: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          credit_account_code?: string | null
          debit_account_code?: string | null
          description?: string
          id?: string
          is_active?: boolean
          rule_code: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          credit_account_code?: string | null
          debit_account_code?: string | null
          description?: string
          id?: string
          is_active?: boolean
          rule_code?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "posting_rule_catalog_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      production_consumption: {
        Row: {
          created_at: string
          id: string
          product_id: string
          production_order_id: string
          quantity_consumed: number
          warehouse_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          production_order_id: string
          quantity_consumed?: number
          warehouse_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          production_order_id?: string
          quantity_consumed?: number
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_consumption_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_consumption_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_consumption_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      production_maintenance: {
        Row: {
          assigned_to: string | null
          completed_date: string | null
          cost: number | null
          created_at: string
          downtime_hours: number | null
          equipment_name: string
          id: string
          maintenance_type: string
          notes: string | null
          scheduled_date: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          completed_date?: string | null
          cost?: number | null
          created_at?: string
          downtime_hours?: number | null
          equipment_name: string
          id?: string
          maintenance_type?: string
          notes?: string | null
          scheduled_date?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          completed_date?: string | null
          cost?: number | null
          created_at?: string
          downtime_hours?: number | null
          equipment_name?: string
          id?: string
          maintenance_type?: string
          notes?: string | null
          scheduled_date?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_maintenance_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      production_orders: {
        Row: {
          actual_end: string | null
          actual_start: string | null
          bom_template_id: string | null
          completed_quantity: number
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          order_number: string | null
          planned_end: string | null
          planned_start: string | null
          priority: number | null
          product_id: string | null
          quantity: number
          status: string
          tenant_id: string
          updated_at: string
          warehouse_id: string | null
        }
        Insert: {
          actual_end?: string | null
          actual_start?: string | null
          bom_template_id?: string | null
          completed_quantity?: number
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          order_number?: string | null
          planned_end?: string | null
          planned_start?: string | null
          priority?: number | null
          product_id?: string | null
          quantity?: number
          status?: string
          tenant_id: string
          updated_at?: string
          warehouse_id?: string | null
        }
        Update: {
          actual_end?: string | null
          actual_start?: string | null
          bom_template_id?: string | null
          completed_quantity?: number
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          order_number?: string | null
          planned_end?: string | null
          planned_start?: string | null
          priority?: number | null
          product_id?: string | null
          quantity?: number
          status?: string
          tenant_id?: string
          updated_at?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "production_orders_bom_template_id_fkey"
            columns: ["bom_template_id"]
            isOneToOne: false
            referencedRelation: "bom_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_orders_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      production_scenarios: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          params: Json
          result: Json
          scenario_type: string
          status: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          params?: Json
          result?: Json
          scenario_type?: string
          status?: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          params?: Json
          result?: Json
          scenario_type?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_scenarios_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      production_waste: {
        Row: {
          created_at: string
          id: string
          product_id: string
          production_order_id: string
          quantity: number
          reason: string | null
          recorded_by: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          production_order_id: string
          quantity?: number
          reason?: string | null
          recorded_by?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          production_order_id?: string
          quantity?: number
          reason?: string | null
          recorded_by?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_waste_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_waste_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_waste_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          costing_method: string | null
          created_at: string
          default_purchase_price: number
          default_retail_price: number
          default_sale_price: number
          default_web_price: number
          description: string | null
          id: string
          is_active: boolean
          name: string
          name_sr: string | null
          sku: string | null
          tax_rate_id: string | null
          tenant_id: string
          unit_of_measure: string
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          costing_method?: string | null
          created_at?: string
          default_purchase_price?: number
          default_retail_price?: number
          default_sale_price?: number
          default_web_price?: number
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          name_sr?: string | null
          sku?: string | null
          tax_rate_id?: string | null
          tenant_id: string
          unit_of_measure?: string
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          costing_method?: string | null
          created_at?: string
          default_purchase_price?: number
          default_retail_price?: number
          default_sale_price?: number
          default_web_price?: number
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          name_sr?: string | null
          sku?: string | null
          tax_rate_id?: string | null
          tenant_id?: string
          unit_of_measure?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_tax_rate_id_fkey"
            columns: ["tax_rate_id"]
            isOneToOne: false
            referencedRelation: "tax_rates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          locale: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          locale?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          locale?: string
          updated_at?: string
        }
        Relationships: []
      }
      proforma_invoice_lines: {
        Row: {
          created_at: string
          description: string | null
          id: string
          product_id: string | null
          proforma_id: string
          quantity: number
          sort_order: number
          tax_rate: number
          total: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          product_id?: string | null
          proforma_id: string
          quantity?: number
          sort_order?: number
          tax_rate?: number
          total?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          product_id?: string | null
          proforma_id?: string
          quantity?: number
          sort_order?: number
          tax_rate?: number
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "proforma_invoice_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proforma_invoice_lines_proforma_id_fkey"
            columns: ["proforma_id"]
            isOneToOne: false
            referencedRelation: "proforma_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      proforma_invoices: {
        Row: {
          converted_invoice_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          id: string
          issue_date: string
          legal_entity_id: string | null
          notes: string | null
          partner_id: string | null
          partner_name: string | null
          proforma_number: string
          status: string
          subtotal: number
          tax_amount: number
          tenant_id: string
          total: number
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          converted_invoice_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          issue_date?: string
          legal_entity_id?: string | null
          notes?: string | null
          partner_id?: string | null
          partner_name?: string | null
          proforma_number: string
          status?: string
          subtotal?: number
          tax_amount?: number
          tenant_id: string
          total?: number
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          converted_invoice_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          issue_date?: string
          legal_entity_id?: string | null
          notes?: string | null
          partner_id?: string | null
          partner_name?: string | null
          proforma_number?: string
          status?: string
          subtotal?: number
          tax_amount?: number
          tenant_id?: string
          total?: number
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proforma_invoices_converted_invoice_id_fkey"
            columns: ["converted_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proforma_invoices_legal_entity_id_fkey"
            columns: ["legal_entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proforma_invoices_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proforma_invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_lines: {
        Row: {
          created_at: string
          description: string
          id: string
          product_id: string | null
          purchase_order_id: string
          quantity: number
          sort_order: number
          total: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          product_id?: string | null
          purchase_order_id: string
          quantity?: number
          sort_order?: number
          total?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          product_id?: string | null
          purchase_order_id?: string
          quantity?: number
          sort_order?: number
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_lines_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          created_at: string
          created_by: string | null
          currency: string
          expected_date: string | null
          id: string
          legal_entity_id: string | null
          notes: string | null
          order_date: string
          order_number: string
          status: string
          subtotal: number
          supplier_id: string | null
          supplier_name: string
          tax_amount: number
          tenant_id: string
          total: number
          updated_at: string
          warehouse_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string
          expected_date?: string | null
          id?: string
          legal_entity_id?: string | null
          notes?: string | null
          order_date?: string
          order_number: string
          status?: string
          subtotal?: number
          supplier_id?: string | null
          supplier_name?: string
          tax_amount?: number
          tenant_id: string
          total?: number
          updated_at?: string
          warehouse_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string
          expected_date?: string | null
          id?: string
          legal_entity_id?: string | null
          notes?: string | null
          order_date?: string
          order_number?: string
          status?: string
          subtotal?: number
          supplier_id?: string | null
          supplier_name?: string
          tax_amount?: number
          tenant_id?: string
          total?: number
          updated_at?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_legal_entity_id_fkey"
            columns: ["legal_entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_check_items: {
        Row: {
          actual_value: string | null
          expected_value: string | null
          id: string
          is_pass: boolean | null
          notes: string | null
          parameter_name: string
          quality_check_id: string
          sort_order: number | null
        }
        Insert: {
          actual_value?: string | null
          expected_value?: string | null
          id?: string
          is_pass?: boolean | null
          notes?: string | null
          parameter_name: string
          quality_check_id: string
          sort_order?: number | null
        }
        Update: {
          actual_value?: string | null
          expected_value?: string | null
          id?: string
          is_pass?: boolean | null
          notes?: string | null
          parameter_name?: string
          quality_check_id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quality_check_items_quality_check_id_fkey"
            columns: ["quality_check_id"]
            isOneToOne: false
            referencedRelation: "quality_checks"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_checks: {
        Row: {
          check_number: string
          check_type: string
          checked_at: string | null
          created_at: string
          defect_rate: number | null
          id: string
          inspector_id: string | null
          notes: string | null
          product_id: string | null
          production_order_id: string | null
          quantity_failed: number | null
          quantity_inspected: number | null
          quantity_passed: number | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          check_number: string
          check_type?: string
          checked_at?: string | null
          created_at?: string
          defect_rate?: number | null
          id?: string
          inspector_id?: string | null
          notes?: string | null
          product_id?: string | null
          production_order_id?: string | null
          quantity_failed?: number | null
          quantity_inspected?: number | null
          quantity_passed?: number | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          check_number?: string
          check_type?: string
          checked_at?: string | null
          created_at?: string
          defect_rate?: number | null
          id?: string
          inspector_id?: string | null
          notes?: string | null
          product_id?: string | null
          production_order_id?: string | null
          quantity_failed?: number | null
          quantity_inspected?: number | null
          quantity_passed?: number | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quality_checks_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_checks_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_checks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_lines: {
        Row: {
          created_at: string
          description: string
          id: string
          line_total: number
          product_id: string | null
          quantity: number
          quote_id: string
          sort_order: number
          tax_amount: number
          tax_rate_id: string | null
          tax_rate_value: number
          total_with_tax: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          line_total?: number
          product_id?: string | null
          quantity?: number
          quote_id: string
          sort_order?: number
          tax_amount?: number
          tax_rate_id?: string | null
          tax_rate_value?: number
          total_with_tax?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          line_total?: number
          product_id?: string | null
          quantity?: number
          quote_id?: string
          sort_order?: number
          tax_amount?: number
          tax_rate_id?: string | null
          tax_rate_value?: number
          total_with_tax?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_lines_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_lines_tax_rate_id_fkey"
            columns: ["tax_rate_id"]
            isOneToOne: false
            referencedRelation: "tax_rates"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_versions: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          notes: string | null
          quote_id: string
          snapshot: Json
          tenant_id: string
          version_number: number
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          quote_id: string
          snapshot: Json
          tenant_id: string
          version_number: number
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          quote_id?: string
          snapshot?: Json
          tenant_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_versions_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_versions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          created_at: string
          created_by: string | null
          currency: string
          current_version: number | null
          id: string
          max_discount_pct: number | null
          notes: string | null
          opportunity_id: string | null
          partner_id: string | null
          partner_name: string
          quote_date: string
          quote_number: string
          salesperson_id: string | null
          status: string
          subtotal: number
          tax_amount: number
          tenant_id: string
          total: number
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string
          current_version?: number | null
          id?: string
          max_discount_pct?: number | null
          notes?: string | null
          opportunity_id?: string | null
          partner_id?: string | null
          partner_name?: string
          quote_date?: string
          quote_number: string
          salesperson_id?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          tenant_id: string
          total?: number
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string
          current_version?: number | null
          id?: string
          max_discount_pct?: number | null
          notes?: string | null
          opportunity_id?: string | null
          partner_id?: string | null
          partner_name?: string
          quote_date?: string
          quote_number?: string
          salesperson_id?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          tenant_id?: string
          total?: number
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_salesperson_id_fkey"
            columns: ["salesperson_id"]
            isOneToOne: false
            referencedRelation: "salespeople"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      retail_price_lists: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          is_default: boolean
          location_id: string | null
          name: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          location_id?: string | null
          name: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          location_id?: string | null
          name?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "retail_price_lists_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retail_price_lists_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      retail_prices: {
        Row: {
          created_at: string
          id: string
          markup_percent: number | null
          price_list_id: string
          product_id: string
          retail_price: number
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          markup_percent?: number | null
          price_list_id: string
          product_id: string
          retail_price?: number
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          markup_percent?: number | null
          price_list_id?: string
          product_id?: string
          retail_price?: number
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "retail_prices_price_list_id_fkey"
            columns: ["price_list_id"]
            isOneToOne: false
            referencedRelation: "retail_price_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retail_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      return_cases: {
        Row: {
          case_number: string
          created_at: string
          id: string
          notes: string | null
          opened_at: string
          partner_id: string | null
          resolved_at: string | null
          return_type: string
          source_id: string
          source_type: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          case_number: string
          created_at?: string
          id?: string
          notes?: string | null
          opened_at?: string
          partner_id?: string | null
          resolved_at?: string | null
          return_type?: string
          source_id: string
          source_type?: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          case_number?: string
          created_at?: string
          id?: string
          notes?: string | null
          opened_at?: string
          partner_id?: string | null
          resolved_at?: string | null
          return_type?: string
          source_id?: string
          source_type?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "return_cases_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_cases_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      return_lines: {
        Row: {
          created_at: string
          description: string
          id: string
          inspection_status: string
          notes: string | null
          product_id: string | null
          quantity_accepted: number
          quantity_returned: number
          reason: string
          return_case_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          inspection_status?: string
          notes?: string | null
          product_id?: string | null
          quantity_accepted?: number
          quantity_returned?: number
          reason?: string
          return_case_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          inspection_status?: string
          notes?: string | null
          product_id?: string | null
          quantity_accepted?: number
          quantity_returned?: number
          reason?: string
          return_case_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "return_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_lines_return_case_id_fkey"
            columns: ["return_case_id"]
            isOneToOne: false
            referencedRelation: "return_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      role_confidentiality_access: {
        Row: {
          can_edit: boolean
          can_read: boolean
          confidentiality_level_id: string
          created_at: string
          id: string
          role: string
          tenant_id: string
        }
        Insert: {
          can_edit?: boolean
          can_read?: boolean
          confidentiality_level_id: string
          created_at?: string
          id?: string
          role: string
          tenant_id: string
        }
        Update: {
          can_edit?: boolean
          can_read?: boolean
          confidentiality_level_id?: string
          created_at?: string
          id?: string
          role?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_confidentiality_access_confidentiality_level_id_fkey"
            columns: ["confidentiality_level_id"]
            isOneToOne: false
            referencedRelation: "confidentiality_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_confidentiality_access_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_channels: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          tenant_id: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          tenant_id: string
          type?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          tenant_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_channels_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_order_lines: {
        Row: {
          created_at: string
          description: string
          id: string
          line_total: number
          product_id: string | null
          quantity: number
          sales_order_id: string
          sort_order: number
          tax_amount: number
          tax_rate_id: string | null
          tax_rate_value: number
          total_with_tax: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          line_total?: number
          product_id?: string | null
          quantity?: number
          sales_order_id: string
          sort_order?: number
          tax_amount?: number
          tax_rate_id?: string | null
          tax_rate_value?: number
          total_with_tax?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          line_total?: number
          product_id?: string | null
          quantity?: number
          sales_order_id?: string
          sort_order?: number
          tax_amount?: number
          tax_rate_id?: string | null
          tax_rate_value?: number
          total_with_tax?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_lines_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_lines_tax_rate_id_fkey"
            columns: ["tax_rate_id"]
            isOneToOne: false
            referencedRelation: "tax_rates"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_orders: {
        Row: {
          created_at: string
          created_by: string | null
          currency: string
          external_order_id: string | null
          id: string
          invoice_id: string | null
          legal_entity_id: string | null
          notes: string | null
          order_date: string
          order_number: string
          partner_id: string | null
          partner_name: string
          quote_id: string | null
          sales_channel_id: string | null
          salesperson_id: string | null
          source: string | null
          status: string
          subtotal: number
          tax_amount: number
          tenant_id: string
          total: number
          updated_at: string
          warehouse_id: string | null
          web_connection_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string
          external_order_id?: string | null
          id?: string
          invoice_id?: string | null
          legal_entity_id?: string | null
          notes?: string | null
          order_date?: string
          order_number: string
          partner_id?: string | null
          partner_name?: string
          quote_id?: string | null
          sales_channel_id?: string | null
          salesperson_id?: string | null
          source?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          tenant_id: string
          total?: number
          updated_at?: string
          warehouse_id?: string | null
          web_connection_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string
          external_order_id?: string | null
          id?: string
          invoice_id?: string | null
          legal_entity_id?: string | null
          notes?: string | null
          order_date?: string
          order_number?: string
          partner_id?: string | null
          partner_name?: string
          quote_id?: string | null
          sales_channel_id?: string | null
          salesperson_id?: string | null
          source?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          tenant_id?: string
          total?: number
          updated_at?: string
          warehouse_id?: string | null
          web_connection_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_sales_orders_web_connection"
            columns: ["web_connection_id"]
            isOneToOne: false
            referencedRelation: "web_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_legal_entity_id_fkey"
            columns: ["legal_entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_sales_channel_id_fkey"
            columns: ["sales_channel_id"]
            isOneToOne: false
            referencedRelation: "sales_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_salesperson_id_fkey"
            columns: ["salesperson_id"]
            isOneToOne: false
            referencedRelation: "salespeople"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_targets: {
        Row: {
          created_at: string
          id: string
          month: number | null
          quarter: number | null
          salesperson_id: string
          target_amount: number
          target_type: string
          tenant_id: string
          year: number
        }
        Insert: {
          created_at?: string
          id?: string
          month?: number | null
          quarter?: number | null
          salesperson_id: string
          target_amount?: number
          target_type?: string
          tenant_id: string
          year: number
        }
        Update: {
          created_at?: string
          id?: string
          month?: number | null
          quarter?: number | null
          salesperson_id?: string
          target_amount?: number
          target_type?: string
          tenant_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_targets_salesperson_id_fkey"
            columns: ["salesperson_id"]
            isOneToOne: false
            referencedRelation: "salespeople"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_targets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      salespeople: {
        Row: {
          code: string
          commission_rate: number
          created_at: string
          default_location_id: string | null
          email: string | null
          employee_id: string | null
          first_name: string
          id: string
          is_active: boolean
          last_name: string
          phone: string | null
          pos_pin: string | null
          role_type: string
          tenant_id: string
          user_id: string | null
        }
        Insert: {
          code: string
          commission_rate?: number
          created_at?: string
          default_location_id?: string | null
          email?: string | null
          employee_id?: string | null
          first_name: string
          id?: string
          is_active?: boolean
          last_name: string
          phone?: string | null
          pos_pin?: string | null
          role_type?: string
          tenant_id: string
          user_id?: string | null
        }
        Update: {
          code?: string
          commission_rate?: number
          created_at?: string
          default_location_id?: string | null
          email?: string | null
          employee_id?: string | null
          first_name?: string
          id?: string
          is_active?: boolean
          last_name?: string
          phone?: string | null
          pos_pin?: string | null
          role_type?: string
          tenant_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "salespeople_default_location_id_fkey"
            columns: ["default_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salespeople_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salespeople_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sef_connections: {
        Row: {
          api_key_encrypted: string
          api_url: string
          created_at: string
          environment: string
          id: string
          is_active: boolean
          last_error: string | null
          last_sync_at: string | null
          legal_entity_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          api_key_encrypted?: string
          api_url?: string
          created_at?: string
          environment?: string
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_sync_at?: string | null
          legal_entity_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          api_key_encrypted?: string
          api_url?: string
          created_at?: string
          environment?: string
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_sync_at?: string | null
          legal_entity_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sef_connections_legal_entity_id_fkey"
            columns: ["legal_entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sef_connections_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sef_submissions: {
        Row: {
          error_message: string | null
          id: string
          invoice_id: string
          request_payload: Json | null
          resolved_at: string | null
          response_payload: Json | null
          sef_connection_id: string
          sef_invoice_id: string | null
          status: string
          submitted_at: string
          tenant_id: string
        }
        Insert: {
          error_message?: string | null
          id?: string
          invoice_id: string
          request_payload?: Json | null
          resolved_at?: string | null
          response_payload?: Json | null
          sef_connection_id: string
          sef_invoice_id?: string | null
          status?: string
          submitted_at?: string
          tenant_id: string
        }
        Update: {
          error_message?: string | null
          id?: string
          invoice_id?: string
          request_payload?: Json | null
          resolved_at?: string | null
          response_payload?: Json | null
          sef_connection_id?: string
          sef_invoice_id?: string | null
          status?: string
          submitted_at?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sef_submissions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sef_submissions_sef_connection_id_fkey"
            columns: ["sef_connection_id"]
            isOneToOne: false
            referencedRelation: "sef_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sef_submissions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_invoices: {
        Row: {
          amount: number
          created_at: string
          currency: string
          due_date: string | null
          id: string
          invoice_date: string
          invoice_number: string
          legal_entity_id: string | null
          notes: string | null
          purchase_order_id: string | null
          status: string
          supplier_id: string | null
          supplier_name: string
          tax_amount: number
          tenant_id: string
          total: number
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          currency?: string
          due_date?: string | null
          id?: string
          invoice_date?: string
          invoice_number: string
          legal_entity_id?: string | null
          notes?: string | null
          purchase_order_id?: string | null
          status?: string
          supplier_id?: string | null
          supplier_name?: string
          tax_amount?: number
          tenant_id: string
          total?: number
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          due_date?: string | null
          id?: string
          invoice_date?: string
          invoice_number?: string
          legal_entity_id?: string | null
          notes?: string | null
          purchase_order_id?: string | null
          status?: string
          supplier_id?: string | null
          supplier_name?: string
          tax_amount?: number
          tenant_id?: string
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_invoices_legal_entity_id_fkey"
            columns: ["legal_entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_invoices_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_invoices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_return_shipments: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          purchase_order_id: string | null
          return_case_id: string | null
          shipment_number: string
          shipped_at: string | null
          status: string
          tenant_id: string
          tracking_number: string | null
          updated_at: string
          warehouse_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          purchase_order_id?: string | null
          return_case_id?: string | null
          shipment_number: string
          shipped_at?: string | null
          status?: string
          tenant_id: string
          tracking_number?: string | null
          updated_at?: string
          warehouse_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          purchase_order_id?: string | null
          return_case_id?: string | null
          shipment_number?: string
          shipped_at?: string | null
          status?: string
          tenant_id?: string
          tracking_number?: string | null
          updated_at?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_return_shipments_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_return_shipments_return_case_id_fkey"
            columns: ["return_case_id"]
            isOneToOne: false
            referencedRelation: "return_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_return_shipments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_return_shipments_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_rates: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          name_sr: string | null
          rate: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          name_sr?: string | null
          rate?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          name_sr?: string | null
          rate?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_rates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_invitations: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["app_role"]
          status: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_invitations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_members: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["membership_status"]
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_modules: {
        Row: {
          config: Json
          enabled_at: string
          id: string
          is_enabled: boolean
          module_id: string
          tenant_id: string
        }
        Insert: {
          config?: Json
          enabled_at?: string
          id?: string
          is_enabled?: boolean
          module_id: string
          tenant_id: string
        }
        Update: {
          config?: Json
          enabled_at?: string
          id?: string
          is_enabled?: boolean
          module_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_modules_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "module_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_modules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_settings: {
        Row: {
          created_at: string
          id: string
          settings: Json
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          settings?: Json
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          settings?: Json
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          id: string
          name: string
          plan: string
          settings: Json
          slug: string
          status: Database["public"]["Enums"]["tenant_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          plan?: string
          settings?: Json
          slug: string
          status?: Database["public"]["Enums"]["tenant_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          plan?: string
          settings?: Json
          slug?: string
          status?: Database["public"]["Enums"]["tenant_status"]
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      warehouses: {
        Row: {
          code: string | null
          created_at: string
          id: string
          is_active: boolean
          location_id: string | null
          name: string
          tenant_id: string
          zones: Json
        }
        Insert: {
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          location_id?: string | null
          name: string
          tenant_id: string
          zones?: Json
        }
        Update: {
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          location_id?: string | null
          name?: string
          tenant_id?: string
          zones?: Json
        }
        Relationships: [
          {
            foreignKeyName: "warehouses_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      web_connections: {
        Row: {
          access_token: string | null
          api_key: string | null
          api_secret: string | null
          created_at: string
          id: string
          is_active: boolean
          last_error: string | null
          last_sync_at: string | null
          platform: string
          store_url: string
          tenant_id: string
          webhook_secret: string | null
        }
        Insert: {
          access_token?: string | null
          api_key?: string | null
          api_secret?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_sync_at?: string | null
          platform?: string
          store_url: string
          tenant_id: string
          webhook_secret?: string | null
        }
        Update: {
          access_token?: string | null
          api_key?: string | null
          api_secret?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_sync_at?: string | null
          platform?: string
          store_url?: string
          tenant_id?: string
          webhook_secret?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "web_connections_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      web_price_lists: {
        Row: {
          created_at: string
          currency: string
          id: string
          is_active: boolean
          name: string
          tenant_id: string
          web_connection_id: string | null
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          name: string
          tenant_id: string
          web_connection_id?: string | null
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          name?: string
          tenant_id?: string
          web_connection_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "web_price_lists_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "web_price_lists_web_connection_id_fkey"
            columns: ["web_connection_id"]
            isOneToOne: false
            referencedRelation: "web_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      web_prices: {
        Row: {
          compare_at_price: number | null
          created_at: string
          id: string
          price: number
          product_id: string
          tenant_id: string
          web_price_list_id: string
        }
        Insert: {
          compare_at_price?: number | null
          created_at?: string
          id?: string
          price?: number
          product_id: string
          tenant_id: string
          web_price_list_id: string
        }
        Update: {
          compare_at_price?: number | null
          created_at?: string
          id?: string
          price?: number
          product_id?: string
          tenant_id?: string
          web_price_list_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "web_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "web_prices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "web_prices_web_price_list_id_fkey"
            columns: ["web_price_list_id"]
            isOneToOne: false
            referencedRelation: "web_price_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      web_sync_logs: {
        Row: {
          completed_at: string | null
          errors: Json | null
          id: string
          products_synced: number | null
          started_at: string
          status: string
          sync_type: string
          tenant_id: string
          web_connection_id: string
        }
        Insert: {
          completed_at?: string | null
          errors?: Json | null
          id?: string
          products_synced?: number | null
          started_at?: string
          status?: string
          sync_type?: string
          tenant_id: string
          web_connection_id: string
        }
        Update: {
          completed_at?: string | null
          errors?: Json | null
          id?: string
          products_synced?: number | null
          started_at?: string
          status?: string
          sync_type?: string
          tenant_id?: string
          web_connection_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_web_sync_logs_connection"
            columns: ["web_connection_id"]
            isOneToOne: false
            referencedRelation: "web_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "web_sync_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      wms_aisles: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          sort_order: number
          tenant_id: string
          zone_id: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          tenant_id: string
          zone_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          tenant_id?: string
          zone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wms_aisles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wms_aisles_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "wms_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      wms_bin_stock: {
        Row: {
          bin_id: string
          id: string
          lot_number: string | null
          product_id: string
          quantity: number
          received_at: string
          status: Database["public"]["Enums"]["wms_bin_stock_status"]
          tenant_id: string
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          bin_id: string
          id?: string
          lot_number?: string | null
          product_id: string
          quantity?: number
          received_at?: string
          status?: Database["public"]["Enums"]["wms_bin_stock_status"]
          tenant_id: string
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          bin_id?: string
          id?: string
          lot_number?: string | null
          product_id?: string
          quantity?: number
          received_at?: string
          status?: Database["public"]["Enums"]["wms_bin_stock_status"]
          tenant_id?: string
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wms_bin_stock_bin_id_fkey"
            columns: ["bin_id"]
            isOneToOne: false
            referencedRelation: "wms_bins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wms_bin_stock_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wms_bin_stock_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wms_bin_stock_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      wms_bins: {
        Row: {
          accessibility_score: number
          aisle_id: string | null
          bin_type: Database["public"]["Enums"]["wms_bin_type"]
          code: string
          created_at: string
          id: string
          is_active: boolean
          level: number
          max_units: number | null
          max_volume: number | null
          max_weight: number | null
          restrictions: Json | null
          sort_order: number
          tenant_id: string
          updated_at: string
          warehouse_id: string
          zone_id: string
        }
        Insert: {
          accessibility_score?: number
          aisle_id?: string | null
          bin_type?: Database["public"]["Enums"]["wms_bin_type"]
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          level?: number
          max_units?: number | null
          max_volume?: number | null
          max_weight?: number | null
          restrictions?: Json | null
          sort_order?: number
          tenant_id: string
          updated_at?: string
          warehouse_id: string
          zone_id: string
        }
        Update: {
          accessibility_score?: number
          aisle_id?: string | null
          bin_type?: Database["public"]["Enums"]["wms_bin_type"]
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          level?: number
          max_units?: number | null
          max_volume?: number | null
          max_weight?: number | null
          restrictions?: Json | null
          sort_order?: number
          tenant_id?: string
          updated_at?: string
          warehouse_id?: string
          zone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wms_bins_aisle_id_fkey"
            columns: ["aisle_id"]
            isOneToOne: false
            referencedRelation: "wms_aisles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wms_bins_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wms_bins_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wms_bins_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "wms_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      wms_cycle_count_lines: {
        Row: {
          approved_by: string | null
          bin_id: string
          count_id: string
          counted_at: string | null
          counted_by: string | null
          counted_quantity: number | null
          created_at: string
          expected_quantity: number
          id: string
          product_id: string
          status: Database["public"]["Enums"]["wms_count_line_status"]
          tenant_id: string
          variance: number | null
        }
        Insert: {
          approved_by?: string | null
          bin_id: string
          count_id: string
          counted_at?: string | null
          counted_by?: string | null
          counted_quantity?: number | null
          created_at?: string
          expected_quantity?: number
          id?: string
          product_id: string
          status?: Database["public"]["Enums"]["wms_count_line_status"]
          tenant_id: string
          variance?: number | null
        }
        Update: {
          approved_by?: string | null
          bin_id?: string
          count_id?: string
          counted_at?: string | null
          counted_by?: string | null
          counted_quantity?: number | null
          created_at?: string
          expected_quantity?: number
          id?: string
          product_id?: string
          status?: Database["public"]["Enums"]["wms_count_line_status"]
          tenant_id?: string
          variance?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "wms_cycle_count_lines_bin_id_fkey"
            columns: ["bin_id"]
            isOneToOne: false
            referencedRelation: "wms_bins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wms_cycle_count_lines_count_id_fkey"
            columns: ["count_id"]
            isOneToOne: false
            referencedRelation: "wms_cycle_counts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wms_cycle_count_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wms_cycle_count_lines_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      wms_cycle_counts: {
        Row: {
          completed_at: string | null
          count_number: string
          count_type: Database["public"]["Enums"]["wms_count_type"]
          created_at: string
          id: string
          status: Database["public"]["Enums"]["wms_count_status"]
          tenant_id: string
          warehouse_id: string
          zone_id: string | null
        }
        Insert: {
          completed_at?: string | null
          count_number?: string
          count_type?: Database["public"]["Enums"]["wms_count_type"]
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["wms_count_status"]
          tenant_id: string
          warehouse_id: string
          zone_id?: string | null
        }
        Update: {
          completed_at?: string | null
          count_number?: string
          count_type?: Database["public"]["Enums"]["wms_count_type"]
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["wms_count_status"]
          tenant_id?: string
          warehouse_id?: string
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wms_cycle_counts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wms_cycle_counts_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wms_cycle_counts_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "wms_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      wms_labor_log: {
        Row: {
          created_at: string
          duration_minutes: number | null
          ended_at: string | null
          id: string
          items_processed: number | null
          started_at: string
          task_id: string | null
          task_type: string | null
          tenant_id: string
          warehouse_id: string | null
          worker_id: string
        }
        Insert: {
          created_at?: string
          duration_minutes?: number | null
          ended_at?: string | null
          id?: string
          items_processed?: number | null
          started_at?: string
          task_id?: string | null
          task_type?: string | null
          tenant_id: string
          warehouse_id?: string | null
          worker_id: string
        }
        Update: {
          created_at?: string
          duration_minutes?: number | null
          ended_at?: string | null
          id?: string
          items_processed?: number | null
          started_at?: string
          task_id?: string | null
          task_type?: string | null
          tenant_id?: string
          warehouse_id?: string | null
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wms_labor_log_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "wms_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wms_labor_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wms_labor_log_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      wms_pick_wave_orders: {
        Row: {
          created_at: string
          id: string
          order_id: string
          status: string
          tenant_id: string
          wave_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          status?: string
          tenant_id: string
          wave_id: string
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          status?: string
          tenant_id?: string
          wave_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wms_pick_wave_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wms_pick_wave_orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wms_pick_wave_orders_wave_id_fkey"
            columns: ["wave_id"]
            isOneToOne: false
            referencedRelation: "wms_pick_waves"
            referencedColumns: ["id"]
          },
        ]
      }
      wms_pick_waves: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          status: Database["public"]["Enums"]["wms_wave_status"]
          tenant_id: string
          warehouse_id: string
          wave_number: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["wms_wave_status"]
          tenant_id: string
          warehouse_id: string
          wave_number?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["wms_wave_status"]
          tenant_id?: string
          warehouse_id?: string
          wave_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "wms_pick_waves_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wms_pick_waves_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      wms_product_stats: {
        Row: {
          avg_daily_movement: number | null
          id: string
          last_pick_date: string | null
          product_id: string
          tenant_id: string
          total_picks_90d: number | null
          updated_at: string | null
          velocity_picks_per_week: number | null
          warehouse_id: string
        }
        Insert: {
          avg_daily_movement?: number | null
          id?: string
          last_pick_date?: string | null
          product_id: string
          tenant_id: string
          total_picks_90d?: number | null
          updated_at?: string | null
          velocity_picks_per_week?: number | null
          warehouse_id: string
        }
        Update: {
          avg_daily_movement?: number | null
          id?: string
          last_pick_date?: string | null
          product_id?: string
          tenant_id?: string
          total_picks_90d?: number | null
          updated_at?: string | null
          velocity_picks_per_week?: number | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wms_product_stats_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wms_product_stats_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wms_product_stats_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      wms_putaway_rules: {
        Row: {
          created_at: string
          id: string
          priority: number
          product_category: string | null
          target_zone_id: string
          tenant_id: string
          warehouse_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          priority?: number
          product_category?: string | null
          target_zone_id: string
          tenant_id: string
          warehouse_id: string
        }
        Update: {
          created_at?: string
          id?: string
          priority?: number
          product_category?: string | null
          target_zone_id?: string
          tenant_id?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wms_putaway_rules_target_zone_id_fkey"
            columns: ["target_zone_id"]
            isOneToOne: false
            referencedRelation: "wms_zones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wms_putaway_rules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wms_putaway_rules_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      wms_return_lines: {
        Row: {
          bin_id: string | null
          condition: string | null
          disposition: string | null
          id: string
          notes: string | null
          product_id: string | null
          quantity: number
          return_id: string
          sort_order: number | null
        }
        Insert: {
          bin_id?: string | null
          condition?: string | null
          disposition?: string | null
          id?: string
          notes?: string | null
          product_id?: string | null
          quantity?: number
          return_id: string
          sort_order?: number | null
        }
        Update: {
          bin_id?: string | null
          condition?: string | null
          disposition?: string | null
          id?: string
          notes?: string | null
          product_id?: string | null
          quantity?: number
          return_id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "wms_return_lines_bin_id_fkey"
            columns: ["bin_id"]
            isOneToOne: false
            referencedRelation: "wms_bins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wms_return_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wms_return_lines_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "wms_returns"
            referencedColumns: ["id"]
          },
        ]
      }
      wms_returns: {
        Row: {
          created_at: string
          id: string
          partner_id: string | null
          reason: string | null
          received_at: string | null
          received_by: string | null
          restocked_quantity: number | null
          return_number: string
          return_type: string
          sales_order_id: string | null
          scrapped_quantity: number | null
          status: string
          tenant_id: string
          total_quantity: number | null
          updated_at: string
          warehouse_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          partner_id?: string | null
          reason?: string | null
          received_at?: string | null
          received_by?: string | null
          restocked_quantity?: number | null
          return_number: string
          return_type?: string
          sales_order_id?: string | null
          scrapped_quantity?: number | null
          status?: string
          tenant_id: string
          total_quantity?: number | null
          updated_at?: string
          warehouse_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          partner_id?: string | null
          reason?: string | null
          received_at?: string | null
          received_by?: string | null
          restocked_quantity?: number | null
          return_number?: string
          return_type?: string
          sales_order_id?: string | null
          scrapped_quantity?: number | null
          status?: string
          tenant_id?: string
          total_quantity?: number | null
          updated_at?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wms_returns_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wms_returns_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wms_returns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wms_returns_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      wms_slotting_moves: {
        Row: {
          created_at: string
          from_bin_id: string
          id: string
          priority: number
          product_id: string
          quantity: number
          scenario_id: string
          status: Database["public"]["Enums"]["wms_slotting_move_status"]
          task_id: string | null
          tenant_id: string
          to_bin_id: string
        }
        Insert: {
          created_at?: string
          from_bin_id: string
          id?: string
          priority?: number
          product_id: string
          quantity?: number
          scenario_id: string
          status?: Database["public"]["Enums"]["wms_slotting_move_status"]
          task_id?: string | null
          tenant_id: string
          to_bin_id: string
        }
        Update: {
          created_at?: string
          from_bin_id?: string
          id?: string
          priority?: number
          product_id?: string
          quantity?: number
          scenario_id?: string
          status?: Database["public"]["Enums"]["wms_slotting_move_status"]
          task_id?: string | null
          tenant_id?: string
          to_bin_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wms_slotting_moves_from_bin_id_fkey"
            columns: ["from_bin_id"]
            isOneToOne: false
            referencedRelation: "wms_bins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wms_slotting_moves_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wms_slotting_moves_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "wms_slotting_scenarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wms_slotting_moves_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "wms_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wms_slotting_moves_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wms_slotting_moves_to_bin_id_fkey"
            columns: ["to_bin_id"]
            isOneToOne: false
            referencedRelation: "wms_bins"
            referencedColumns: ["id"]
          },
        ]
      }
      wms_slotting_scenarios: {
        Row: {
          created_at: string
          created_by: string | null
          estimated_improvement: Json | null
          id: string
          name: string
          parameters: Json
          results: Json | null
          status: Database["public"]["Enums"]["wms_slotting_status"]
          tenant_id: string
          warehouse_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          estimated_improvement?: Json | null
          id?: string
          name: string
          parameters?: Json
          results?: Json | null
          status?: Database["public"]["Enums"]["wms_slotting_status"]
          tenant_id: string
          warehouse_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          estimated_improvement?: Json | null
          id?: string
          name?: string
          parameters?: Json
          results?: Json | null
          status?: Database["public"]["Enums"]["wms_slotting_status"]
          tenant_id?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wms_slotting_scenarios_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wms_slotting_scenarios_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      wms_tasks: {
        Row: {
          assigned_at: string | null
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          exception_reason: string | null
          from_bin_id: string | null
          id: string
          notes: string | null
          order_reference: string | null
          priority: number
          product_id: string | null
          quantity: number | null
          started_at: string | null
          status: Database["public"]["Enums"]["wms_task_status"]
          task_number: string
          task_type: Database["public"]["Enums"]["wms_task_type"]
          tenant_id: string
          to_bin_id: string | null
          warehouse_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          exception_reason?: string | null
          from_bin_id?: string | null
          id?: string
          notes?: string | null
          order_reference?: string | null
          priority?: number
          product_id?: string | null
          quantity?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["wms_task_status"]
          task_number?: string
          task_type: Database["public"]["Enums"]["wms_task_type"]
          tenant_id: string
          to_bin_id?: string | null
          warehouse_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          exception_reason?: string | null
          from_bin_id?: string | null
          id?: string
          notes?: string | null
          order_reference?: string | null
          priority?: number
          product_id?: string | null
          quantity?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["wms_task_status"]
          task_number?: string
          task_type?: Database["public"]["Enums"]["wms_task_type"]
          tenant_id?: string
          to_bin_id?: string | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wms_tasks_from_bin_id_fkey"
            columns: ["from_bin_id"]
            isOneToOne: false
            referencedRelation: "wms_bins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wms_tasks_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wms_tasks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wms_tasks_to_bin_id_fkey"
            columns: ["to_bin_id"]
            isOneToOne: false
            referencedRelation: "wms_bins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wms_tasks_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      wms_zones: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          pick_method: Database["public"]["Enums"]["wms_pick_method"]
          sort_order: number
          tenant_id: string
          updated_at: string
          warehouse_id: string
          zone_type: Database["public"]["Enums"]["wms_zone_type"]
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          pick_method?: Database["public"]["Enums"]["wms_pick_method"]
          sort_order?: number
          tenant_id: string
          updated_at?: string
          warehouse_id: string
          zone_type?: Database["public"]["Enums"]["wms_zone_type"]
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          pick_method?: Database["public"]["Enums"]["wms_pick_method"]
          sort_order?: number
          tenant_id?: string
          updated_at?: string
          warehouse_id?: string
          zone_type?: Database["public"]["Enums"]["wms_zone_type"]
        }
        Relationships: [
          {
            foreignKeyName: "wms_zones_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wms_zones_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      work_logs: {
        Row: {
          created_at: string
          created_by: string | null
          date: string
          employee_id: string
          hours: number
          id: string
          note: string | null
          tenant_id: string
          type: string
          vacation_year: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date: string
          employee_id: string
          hours?: number
          id?: string
          note?: string | null
          tenant_id: string
          type?: string
          vacation_year?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date?: string
          employee_id?: string
          hours?: number
          id?: string
          note?: string | null
          tenant_id?: string
          type?: string
          vacation_year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "work_logs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      adjust_inventory_stock: {
        Args: {
          p_created_by?: string
          p_movement_type?: string
          p_notes?: string
          p_product_id: string
          p_quantity: number
          p_reference?: string
          p_tenant_id: string
          p_warehouse_id: string
        }
        Returns: string
      }
      allocate_payment: {
        Args: {
          p_amount: number
          p_invoice_id: string
          p_notes?: string
          p_payment_method?: string
          p_reference?: string
          p_tenant_id: string
        }
        Returns: string
      }
      calculate_partner_tiers: {
        Args: { p_tenant_id: string }
        Returns: undefined
      }
      calculate_payroll_for_run: {
        Args: { p_payroll_run_id: string }
        Returns: undefined
      }
      check_fiscal_period_open: {
        Args: { p_entry_date: string; p_tenant_id: string }
        Returns: string
      }
      complete_production_order: {
        Args: {
          p_order_id: string
          p_quantity_to_complete?: number
          p_user_id?: string
          p_warehouse_id: string
        }
        Returns: Json
      }
      confirm_internal_receipt: {
        Args: { p_receipt_id: string }
        Returns: undefined
      }
      confirm_internal_transfer: {
        Args: { p_transfer_id: string }
        Returns: undefined
      }
      create_journal_entry_with_lines: {
        Args: {
          p_description?: string
          p_entry_date: string
          p_entry_number: string
          p_legal_entity_id?: string
          p_lines?: Json
          p_reference?: string
          p_tenant_id: string
        }
        Returns: string
      }
      create_journal_from_invoice: {
        Args: { p_invoice_id: string }
        Returns: string
      }
      dashboard_kpi_summary: {
        Args: { _tenant_id: string }
        Returns: {
          cash_balance: number
          expenses: number
          revenue: number
        }[]
      }
      dashboard_revenue_expenses_monthly: {
        Args: { _months?: number; _tenant_id: string }
        Returns: {
          expenses: number
          month_label: string
          revenue: number
        }[]
      }
      detect_partner_dormancy: {
        Args: { p_tenant_id: string }
        Returns: undefined
      }
      emit_module_event: {
        Args: {
          p_entity_id: string
          p_entity_type: string
          p_event_type: string
          p_max_retries?: number
          p_payload?: Json
          p_source_module: string
          p_tenant_id: string
        }
        Returns: string
      }
      execute_readonly_query: { Args: { query_text: string }; Returns: Json }
      expire_overdue_quotes: { Args: { p_tenant_id: string }; Returns: number }
      force_delete_journal_entries: {
        Args: { p_tenant_id: string }
        Returns: undefined
      }
      generate_opening_balance: {
        Args: {
          p_fiscal_year?: number
          p_legal_entity_id?: string
          p_tenant_id: string
        }
        Returns: string
      }
      generate_opening_balances: {
        Args: { p_fiscal_period_id: string; p_tenant_id: string }
        Returns: string
      }
      generate_protocol_number: {
        Args: { p_category_code: string; p_tenant_id: string }
        Returns: string
      }
      get_user_tenant_ids: { Args: { _user_id: string }; Returns: string[] }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      is_tenant_admin: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      perform_year_end_closing: {
        Args: {
          p_fiscal_period_id: string
          p_tenant_id: string
          p_user_id: string
        }
        Returns: string
      }
      post_kalkulacija: { Args: { p_kalkulacija_id: string }; Returns: string }
      post_nivelacija: { Args: { p_nivelacija_id: string }; Returns: string }
      process_advance_payment: {
        Args: {
          p_amount: number
          p_legal_entity_id?: string
          p_partner_id: string
          p_tenant_id: string
        }
        Returns: string
      }
      process_credit_note_post: {
        Args: { p_credit_note_id: string }
        Returns: string
      }
      process_invoice_post: {
        Args: { p_default_warehouse_id?: string; p_invoice_id: string }
        Returns: string
      }
      process_pos_sale: {
        Args: { p_tenant_id: string; p_transaction_id: string }
        Returns: string
      }
      refresh_wms_product_stats: {
        Args: { p_tenant_id: string; p_warehouse_id: string }
        Returns: undefined
      }
      release_stock_for_order: {
        Args: { p_sales_order_id: string; p_tenant_id: string }
        Returns: undefined
      }
      reserve_stock_for_order: {
        Args: { p_sales_order_id: string; p_tenant_id: string }
        Returns: undefined
      }
      run_monthly_depreciation: {
        Args: { p_month: number; p_tenant_id: string; p_year: number }
        Returns: string
      }
      seed_company_categories: {
        Args: { _tenant_id: string }
        Returns: undefined
      }
      seed_payroll_income_categories: {
        Args: { p_tenant_id: string }
        Returns: undefined
      }
      seed_payroll_payment_types: {
        Args: { p_tenant_id: string }
        Returns: undefined
      }
      seed_posting_rules_for_tenant: {
        Args: { p_tenant_id: string }
        Returns: undefined
      }
      seed_tenant_chart_of_accounts: {
        Args: { _tenant_id: string }
        Returns: undefined
      }
      seed_tenant_tax_rates: {
        Args: { _tenant_id: string }
        Returns: undefined
      }
      settle_advance_payment: {
        Args: {
          p_advance_id: string
          p_invoice_id: string
          p_settlement_amount?: number
          p_tax_rate?: number
          p_tenant_id: string
        }
        Returns: string
      }
      storno_journal_entry: {
        Args: { p_journal_entry_id: string }
        Returns: string
      }
      three_way_match: {
        Args: { p_supplier_invoice_id: string }
        Returns: Json
      }
      validate_popdv_completeness: {
        Args: { p_pdv_period_id: string; p_tenant_id: string }
        Returns: Json
      }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "admin"
        | "manager"
        | "accountant"
        | "sales"
        | "hr"
        | "user"
        | "store"
      attendance_status:
        | "present"
        | "absent"
        | "sick"
        | "vacation"
        | "holiday"
        | "remote"
      employee_status: "active" | "inactive" | "terminated"
      employment_type: "full_time" | "part_time" | "contract" | "intern"
      leave_status: "pending" | "approved" | "rejected" | "cancelled"
      leave_type:
        | "vacation"
        | "sick"
        | "personal"
        | "maternity"
        | "paternity"
        | "unpaid"
      membership_status: "active" | "invited" | "disabled"
      payroll_status: "draft" | "calculated" | "approved" | "paid"
      tenant_status: "active" | "suspended" | "trial"
      wms_bin_stock_status:
        | "available"
        | "damaged"
        | "quarantine"
        | "on_hold"
        | "allocated"
      wms_bin_type: "bin" | "shelf" | "pallet" | "flow_rack"
      wms_count_line_status: "pending" | "counted" | "recounted" | "approved"
      wms_count_status: "planned" | "in_progress" | "completed" | "reconciled"
      wms_count_type: "scheduled" | "trigger" | "abc"
      wms_pick_method: "each" | "case" | "pallet"
      wms_slotting_move_status: "proposed" | "approved" | "executed" | "skipped"
      wms_slotting_status: "draft" | "analyzing" | "completed"
      wms_task_status:
        | "pending"
        | "assigned"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "exception"
      wms_task_type:
        | "receive"
        | "putaway"
        | "pick"
        | "replenish"
        | "move"
        | "reslot"
        | "count"
        | "pack"
        | "load"
      wms_wave_status: "draft" | "released" | "in_progress" | "completed"
      wms_zone_type:
        | "receiving"
        | "reserve"
        | "forward_pick"
        | "packing"
        | "shipping"
        | "quarantine"
        | "returns"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "super_admin",
        "admin",
        "manager",
        "accountant",
        "sales",
        "hr",
        "user",
        "store",
      ],
      attendance_status: [
        "present",
        "absent",
        "sick",
        "vacation",
        "holiday",
        "remote",
      ],
      employee_status: ["active", "inactive", "terminated"],
      employment_type: ["full_time", "part_time", "contract", "intern"],
      leave_status: ["pending", "approved", "rejected", "cancelled"],
      leave_type: [
        "vacation",
        "sick",
        "personal",
        "maternity",
        "paternity",
        "unpaid",
      ],
      membership_status: ["active", "invited", "disabled"],
      payroll_status: ["draft", "calculated", "approved", "paid"],
      tenant_status: ["active", "suspended", "trial"],
      wms_bin_stock_status: [
        "available",
        "damaged",
        "quarantine",
        "on_hold",
        "allocated",
      ],
      wms_bin_type: ["bin", "shelf", "pallet", "flow_rack"],
      wms_count_line_status: ["pending", "counted", "recounted", "approved"],
      wms_count_status: ["planned", "in_progress", "completed", "reconciled"],
      wms_count_type: ["scheduled", "trigger", "abc"],
      wms_pick_method: ["each", "case", "pallet"],
      wms_slotting_move_status: ["proposed", "approved", "executed", "skipped"],
      wms_slotting_status: ["draft", "analyzing", "completed"],
      wms_task_status: [
        "pending",
        "assigned",
        "in_progress",
        "completed",
        "cancelled",
        "exception",
      ],
      wms_task_type: [
        "receive",
        "putaway",
        "pick",
        "replenish",
        "move",
        "reslot",
        "count",
        "pack",
        "load",
      ],
      wms_wave_status: ["draft", "released", "in_progress", "completed"],
      wms_zone_type: [
        "receiving",
        "reserve",
        "forward_pick",
        "packing",
        "shipping",
        "quarantine",
        "returns",
      ],
    },
  },
} as const
