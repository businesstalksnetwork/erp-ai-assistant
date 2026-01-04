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
      bookkeeper_clients: {
        Row: {
          bookkeeper_email: string
          bookkeeper_id: string | null
          client_id: string
          created_at: string
          id: string
          status: Database["public"]["Enums"]["bookkeeper_status"]
          updated_at: string
        }
        Insert: {
          bookkeeper_email: string
          bookkeeper_id?: string | null
          client_id: string
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["bookkeeper_status"]
          updated_at?: string
        }
        Update: {
          bookkeeper_email?: string
          bookkeeper_id?: string | null
          client_id?: string
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["bookkeeper_status"]
          updated_at?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          address: string | null
          client_type: Database["public"]["Enums"]["client_type"]
          company_id: string
          created_at: string
          id: string
          maticni_broj: string | null
          name: string
          pib: string | null
        }
        Insert: {
          address?: string | null
          client_type?: Database["public"]["Enums"]["client_type"]
          company_id: string
          created_at?: string
          id?: string
          maticni_broj?: string | null
          name: string
          pib?: string | null
        }
        Update: {
          address?: string | null
          client_type?: Database["public"]["Enums"]["client_type"]
          company_id?: string
          created_at?: string
          id?: string
          maticni_broj?: string | null
          name?: string
          pib?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string
          bank_account: string | null
          created_at: string
          id: string
          is_active: boolean
          logo_url: string | null
          maticni_broj: string
          name: string
          pib: string
          sef_api_key: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address: string
          bank_account?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          maticni_broj: string
          name: string
          pib: string
          sef_api_key?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string
          bank_account?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          maticni_broj?: string
          name?: string
          pib?: string
          sef_api_key?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      fiscal_daily_summary: {
        Row: {
          company_id: string
          created_at: string
          id: string
          kpo_entry_id: string | null
          refunds_amount: number
          sales_amount: number
          summary_date: string
          total_amount: number
          year: number
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          kpo_entry_id?: string | null
          refunds_amount?: number
          sales_amount?: number
          summary_date: string
          total_amount?: number
          year: number
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          kpo_entry_id?: string | null
          refunds_amount?: number
          sales_amount?: number
          summary_date?: string
          total_amount?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_daily_summary_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_daily_summary_kpo_entry_id_fkey"
            columns: ["kpo_entry_id"]
            isOneToOne: false
            referencedRelation: "kpo_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_entries: {
        Row: {
          amount: number
          business_name: string | null
          company_id: string
          created_at: string
          entry_date: string
          id: string
          receipt_number: string
          transaction_type: string
          year: number
        }
        Insert: {
          amount: number
          business_name?: string | null
          company_id: string
          created_at?: string
          entry_date: string
          id?: string
          receipt_number: string
          transaction_type: string
          year: number
        }
        Update: {
          amount?: number
          business_name?: string | null
          company_id?: string
          created_at?: string
          entry_date?: string
          id?: string
          receipt_number?: string
          transaction_type?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          created_at: string
          description: string
          id: string
          invoice_id: string
          item_type: Database["public"]["Enums"]["invoice_item_type"]
          quantity: number
          total_amount: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          item_type?: Database["public"]["Enums"]["invoice_item_type"]
          quantity?: number
          total_amount: number
          unit_price: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          item_type?: Database["public"]["Enums"]["invoice_item_type"]
          quantity?: number
          total_amount?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          advance_status: string | null
          client_address: string | null
          client_id: string | null
          client_maticni_broj: string | null
          client_name: string
          client_pib: string | null
          client_type: Database["public"]["Enums"]["client_type"]
          company_id: string
          converted_from_proforma: string | null
          created_at: string
          description: string
          exchange_rate: number | null
          foreign_amount: number | null
          foreign_currency: string | null
          id: string
          invoice_number: string
          invoice_type: string | null
          is_proforma: boolean
          issue_date: string
          item_type: Database["public"]["Enums"]["invoice_item_type"]
          linked_advance_id: string | null
          note: string | null
          payment_deadline: string | null
          payment_method: string | null
          quantity: number
          sef_error: string | null
          sef_invoice_id: string | null
          sef_sent_at: string | null
          sef_status: string | null
          service_date: string | null
          total_amount: number
          unit_price: number
          year: number
        }
        Insert: {
          advance_status?: string | null
          client_address?: string | null
          client_id?: string | null
          client_maticni_broj?: string | null
          client_name: string
          client_pib?: string | null
          client_type?: Database["public"]["Enums"]["client_type"]
          company_id: string
          converted_from_proforma?: string | null
          created_at?: string
          description: string
          exchange_rate?: number | null
          foreign_amount?: number | null
          foreign_currency?: string | null
          id?: string
          invoice_number: string
          invoice_type?: string | null
          is_proforma?: boolean
          issue_date?: string
          item_type?: Database["public"]["Enums"]["invoice_item_type"]
          linked_advance_id?: string | null
          note?: string | null
          payment_deadline?: string | null
          payment_method?: string | null
          quantity?: number
          sef_error?: string | null
          sef_invoice_id?: string | null
          sef_sent_at?: string | null
          sef_status?: string | null
          service_date?: string | null
          total_amount: number
          unit_price: number
          year?: number
        }
        Update: {
          advance_status?: string | null
          client_address?: string | null
          client_id?: string | null
          client_maticni_broj?: string | null
          client_name?: string
          client_pib?: string | null
          client_type?: Database["public"]["Enums"]["client_type"]
          company_id?: string
          converted_from_proforma?: string | null
          created_at?: string
          description?: string
          exchange_rate?: number | null
          foreign_amount?: number | null
          foreign_currency?: string | null
          id?: string
          invoice_number?: string
          invoice_type?: string | null
          is_proforma?: boolean
          issue_date?: string
          item_type?: Database["public"]["Enums"]["invoice_item_type"]
          linked_advance_id?: string | null
          note?: string | null
          payment_deadline?: string | null
          payment_method?: string | null
          quantity?: number
          sef_error?: string | null
          sef_invoice_id?: string | null
          sef_sent_at?: string | null
          sef_status?: string | null
          service_date?: string | null
          total_amount?: number
          unit_price?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_converted_from_proforma_fkey"
            columns: ["converted_from_proforma"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_linked_advance_id_fkey"
            columns: ["linked_advance_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      kpo_entries: {
        Row: {
          company_id: string
          created_at: string
          description: string
          document_date: string | null
          id: string
          invoice_id: string | null
          ordinal_number: number
          products_amount: number
          services_amount: number
          total_amount: number
          year: number
        }
        Insert: {
          company_id: string
          created_at?: string
          description: string
          document_date?: string | null
          id?: string
          invoice_id?: string | null
          ordinal_number: number
          products_amount?: number
          services_amount?: number
          total_amount: number
          year: number
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string
          document_date?: string | null
          id?: string
          invoice_id?: string | null
          ordinal_number?: number
          products_amount?: number
          services_amount?: number
          total_amount?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "kpo_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpo_entries_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: true
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_reminders: {
        Row: {
          amount: number | null
          attachment_url: string | null
          company_id: string
          created_at: string
          description: string | null
          due_date: string
          id: string
          is_completed: boolean
          payment_code: string | null
          payment_model: string | null
          payment_reference: string | null
          recipient_account: string | null
          recipient_name: string | null
          recurrence_day: number | null
          recurrence_type: string | null
          reminder_date: string | null
          title: string
        }
        Insert: {
          amount?: number | null
          attachment_url?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          due_date: string
          id?: string
          is_completed?: boolean
          payment_code?: string | null
          payment_model?: string | null
          payment_reference?: string | null
          recipient_account?: string | null
          recipient_name?: string | null
          recurrence_day?: number | null
          recurrence_type?: string | null
          reminder_date?: string | null
          title: string
        }
        Update: {
          amount?: number | null
          attachment_url?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          due_date?: string
          id?: string
          is_completed?: boolean
          payment_code?: string | null
          payment_model?: string | null
          payment_reference?: string | null
          recipient_account?: string | null
          recipient_name?: string | null
          recurrence_day?: number | null
          recurrence_type?: string | null
          reminder_date?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_reminders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          status: Database["public"]["Enums"]["approval_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          status?: Database["public"]["Enums"]["approval_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          status?: Database["public"]["Enums"]["approval_status"]
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_next_invoice_number: {
        Args: { p_company_id: string; p_is_proforma: boolean; p_year: number }
        Returns: string
      }
      get_next_invoice_number_by_type: {
        Args: { p_company_id: string; p_invoice_type: string; p_year: number }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_approved: { Args: { _user_id: string }; Returns: boolean }
      is_bookkeeper_for: { Args: { client_user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
      approval_status: "pending" | "approved" | "rejected"
      bookkeeper_status: "pending" | "accepted" | "rejected"
      client_type: "domestic" | "foreign"
      invoice_item_type: "products" | "services"
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
      app_role: ["admin", "user"],
      approval_status: ["pending", "approved", "rejected"],
      bookkeeper_status: ["pending", "accepted", "rejected"],
      client_type: ["domestic", "foreign"],
      invoice_item_type: ["products", "services"],
    },
  },
} as const
