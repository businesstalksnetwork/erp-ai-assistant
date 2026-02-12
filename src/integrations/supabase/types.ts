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
            foreignKeyName: "activities_tenant_id_fkey"
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
          messages: Json
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          messages?: Json
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          messages?: Json
          tenant_id?: string
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
          created_at: string
          details: Json
          entity_id: string | null
          entity_type: string | null
          id: string
          tenant_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          tenant_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type?: string | null
          id?: string
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
      chart_of_accounts: {
        Row: {
          account_type: string
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_system: boolean
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
      contact_company_assignments: {
        Row: {
          assigned_at: string
          company_id: string
          contact_id: string
          department: string | null
          id: string
          is_primary: boolean | null
          job_title: string | null
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
          city: string | null
          company_name: string | null
          country: string | null
          created_at: string
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
          city?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string
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
          city?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string
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
          notes: string | null
          return_case_id: string | null
          status: string
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
          notes?: string | null
          return_case_id?: string | null
          status?: string
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
          notes?: string | null
          return_case_id?: string | null
          status?: string
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
      departments: {
        Row: {
          code: string
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
            foreignKeyName: "employee_contracts_tenant_id_fkey"
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
          city: string | null
          created_at: string
          department_id: string | null
          email: string | null
          employment_type: Database["public"]["Enums"]["employment_type"]
          end_date: string | null
          full_name: string
          id: string
          jmbg: string | null
          phone: string | null
          position: string | null
          start_date: string
          status: Database["public"]["Enums"]["employee_status"]
          tenant_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          department_id?: string | null
          email?: string | null
          employment_type?: Database["public"]["Enums"]["employment_type"]
          end_date?: string | null
          full_name: string
          id?: string
          jmbg?: string | null
          phone?: string | null
          position?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["employee_status"]
          tenant_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          department_id?: string | null
          email?: string | null
          employment_type?: Database["public"]["Enums"]["employment_type"]
          end_date?: string | null
          full_name?: string
          id?: string
          jmbg?: string | null
          phone?: string | null
          position?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["employee_status"]
          tenant_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
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
      eotpremnica: {
        Row: {
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
          notes: string | null
          purchase_order_id: string | null
          receipt_number: string
          received_at: string
          received_by: string | null
          status: string
          tenant_id: string
          updated_at: string
          warehouse_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          purchase_order_id?: string | null
          receipt_number: string
          received_at?: string
          received_by?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
          warehouse_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          purchase_order_id?: string | null
          receipt_number?: string
          received_at?: string
          received_by?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goods_receipts_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
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
          partner_address: string | null
          partner_id: string | null
          partner_name: string
          partner_pib: string | null
          sef_status: string
          status: string
          subtotal: number
          tax_amount: number
          tenant_id: string
          total: number
          updated_at: string
        }
        Insert: {
          advance_amount_applied?: number
          advance_invoice_id?: string | null
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
          partner_address?: string | null
          partner_id?: string | null
          partner_name?: string
          partner_pib?: string | null
          sef_status?: string
          status?: string
          subtotal?: number
          tax_amount?: number
          tenant_id: string
          total?: number
          updated_at?: string
        }
        Update: {
          advance_amount_applied?: number
          advance_invoice_id?: string | null
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
          partner_address?: string | null
          partner_id?: string | null
          partner_name?: string
          partner_pib?: string | null
          sef_status?: string
          status?: string
          subtotal?: number
          tax_amount?: number
          tenant_id?: string
          total?: number
          updated_at?: string
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
            foreignKeyName: "invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
      locations: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          tenant_id: string
          type: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          tenant_id: string
          type?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          tenant_id?: string
          type?: string
        }
        Relationships: [
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
          id: string
          is_internal: boolean | null
          is_organizer: boolean | null
          meeting_id: string
          tenant_id: string
        }
        Insert: {
          company_id?: string | null
          contact_id?: string | null
          employee_id?: string | null
          id?: string
          is_internal?: boolean | null
          is_organizer?: boolean | null
          meeting_id: string
          tenant_id: string
        }
        Update: {
          company_id?: string | null
          contact_id?: string | null
          employee_id?: string | null
          id?: string
          is_internal?: boolean | null
          is_organizer?: boolean | null
          meeting_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_participants_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
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
          description: string | null
          duration_minutes: number | null
          id: string
          location: string | null
          meeting_type_id: string | null
          notes: string | null
          scheduled_at: string
          status: string | null
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          communication_channel?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          location?: string | null
          meeting_type_id?: string | null
          notes?: string | null
          scheduled_at: string
          status?: string | null
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          communication_channel?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          location?: string | null
          meeting_type_id?: string | null
          notes?: string | null
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
          id: string
          lead_id: string | null
          notes: string | null
          partner_id: string | null
          probability: number
          stage: string
          tenant_id: string
          title: string
          updated_at: string
          value: number
        }
        Insert: {
          assigned_to?: string | null
          closed_at?: string | null
          contact_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          expected_close_date?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          partner_id?: string | null
          probability?: number
          stage?: string
          tenant_id: string
          title: string
          updated_at?: string
          value?: number
        }
        Update: {
          assigned_to?: string | null
          closed_at?: string | null
          contact_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          expected_close_date?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          partner_id?: string | null
          probability?: number
          stage?: string
          tenant_id?: string
          title?: string
          updated_at?: string
          value?: number
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
            foreignKeyName: "opportunities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          address: string | null
          city: string | null
          contact_person: string | null
          country: string
          created_at: string
          credit_limit: number | null
          default_currency: string | null
          email: string | null
          id: string
          is_active: boolean
          maticni_broj: string | null
          name: string
          payment_terms_days: number | null
          phone: string | null
          pib: string | null
          postal_code: string | null
          tenant_id: string
          type: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          contact_person?: string | null
          country?: string
          created_at?: string
          credit_limit?: number | null
          default_currency?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          maticni_broj?: string | null
          name: string
          payment_terms_days?: number | null
          phone?: string | null
          pib?: string | null
          postal_code?: string | null
          tenant_id: string
          type?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          contact_person?: string | null
          country?: string
          created_at?: string
          credit_limit?: number | null
          default_currency?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          maticni_broj?: string | null
          name?: string
          payment_terms_days?: number | null
          phone?: string | null
          pib?: string | null
          postal_code?: string | null
          tenant_id?: string
          type?: string
          updated_at?: string
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
      payroll_items: {
        Row: {
          created_at: string
          employee_id: string
          gross_salary: number
          health_contribution: number
          id: string
          income_tax: number
          net_salary: number
          payroll_run_id: string
          pension_contribution: number
          taxable_base: number
          total_cost: number
          unemployment_contribution: number
        }
        Insert: {
          created_at?: string
          employee_id: string
          gross_salary?: number
          health_contribution?: number
          id?: string
          income_tax?: number
          net_salary?: number
          payroll_run_id: string
          pension_contribution?: number
          taxable_base?: number
          total_cost?: number
          unemployment_contribution?: number
        }
        Update: {
          created_at?: string
          employee_id?: string
          gross_salary?: number
          health_contribution?: number
          id?: string
          income_tax?: number
          net_salary?: number
          payroll_run_id?: string
          pension_contribution?: number
          taxable_base?: number
          total_cost?: number
          unemployment_contribution?: number
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
            foreignKeyName: "payroll_items_payroll_run_id_fkey"
            columns: ["payroll_run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
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
      pos_sessions: {
        Row: {
          closed_at: string | null
          closing_balance: number | null
          created_at: string
          id: string
          notes: string | null
          opened_at: string
          opened_by: string | null
          opening_balance: number
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          closing_balance?: number | null
          created_at?: string
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by?: string | null
          opening_balance?: number
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          closing_balance?: number | null
          created_at?: string
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by?: string | null
          opening_balance?: number
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_transactions: {
        Row: {
          created_at: string
          customer_name: string | null
          id: string
          items: Json
          payment_method: string
          session_id: string
          subtotal: number
          tax_amount: number
          tenant_id: string
          total: number
          transaction_number: string
        }
        Insert: {
          created_at?: string
          customer_name?: string | null
          id?: string
          items?: Json
          payment_method?: string
          session_id: string
          subtotal?: number
          tax_amount?: number
          tenant_id: string
          total?: number
          transaction_number: string
        }
        Update: {
          created_at?: string
          customer_name?: string | null
          id?: string
          items?: Json
          payment_method?: string
          session_id?: string
          subtotal?: number
          tax_amount?: number
          tenant_id?: string
          total?: number
          transaction_number?: string
        }
        Relationships: [
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
      production_orders: {
        Row: {
          actual_end: string | null
          actual_start: string | null
          bom_template_id: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          planned_end: string | null
          planned_start: string | null
          product_id: string | null
          quantity: number
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          actual_end?: string | null
          actual_start?: string | null
          bom_template_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          planned_end?: string | null
          planned_start?: string | null
          product_id?: string | null
          quantity?: number
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          actual_end?: string | null
          actual_start?: string | null
          bom_template_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          planned_end?: string | null
          planned_start?: string | null
          product_id?: string | null
          quantity?: number
          status?: string
          tenant_id?: string
          updated_at?: string
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
        ]
      }
      products: {
        Row: {
          barcode: string | null
          costing_method: string | null
          created_at: string
          default_purchase_price: number
          default_sale_price: number
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
          default_sale_price?: number
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
          default_sale_price?: number
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
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string
          expected_date?: string | null
          id?: string
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
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string
          expected_date?: string | null
          id?: string
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
        }
        Relationships: [
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
      quotes: {
        Row: {
          created_at: string
          created_by: string | null
          currency: string
          id: string
          notes: string | null
          opportunity_id: string | null
          partner_id: string | null
          partner_name: string
          quote_date: string
          quote_number: string
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
          id?: string
          notes?: string | null
          opportunity_id?: string | null
          partner_id?: string | null
          partner_name?: string
          quote_date?: string
          quote_number: string
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
          id?: string
          notes?: string | null
          opportunity_id?: string | null
          partner_id?: string | null
          partner_name?: string
          quote_date?: string
          quote_number?: string
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
            foreignKeyName: "quotes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          id: string
          invoice_id: string | null
          notes: string | null
          order_date: string
          order_number: string
          partner_id: string | null
          partner_name: string
          quote_id: string | null
          status: string
          subtotal: number
          tax_amount: number
          tenant_id: string
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          invoice_id?: string | null
          notes?: string | null
          order_date?: string
          order_number: string
          partner_id?: string | null
          partner_name?: string
          quote_id?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          tenant_id: string
          total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          invoice_id?: string | null
          notes?: string | null
          order_date?: string
          order_number?: string
          partner_id?: string | null
          partner_name?: string
          quote_id?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          tenant_id?: string
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_orders_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
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
            foreignKeyName: "sales_orders_tenant_id_fkey"
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
      calculate_payroll_for_run: {
        Args: { p_payroll_run_id: string }
        Returns: undefined
      }
      check_fiscal_period_open: {
        Args: { p_entry_date: string; p_tenant_id: string }
        Returns: string
      }
      create_journal_from_invoice: {
        Args: { p_invoice_id: string }
        Returns: string
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
      process_invoice_post: {
        Args: { p_default_warehouse_id?: string; p_invoice_id: string }
        Returns: string
      }
      seed_company_categories: {
        Args: { _tenant_id: string }
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
    },
  },
} as const
