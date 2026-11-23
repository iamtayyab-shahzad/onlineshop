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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      addresses: {
        Row: {
          address_line: string
          area: string
          created_at: string
          id: string
          is_default: boolean
          label: string
          landmark: string | null
          phone: string
          recipient_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address_line: string
          area: string
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          landmark?: string | null
          phone: string
          recipient_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address_line?: string
          area?: string
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          landmark?: string | null
          phone?: string
          recipient_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "addresses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          is_active: boolean
          name: string
          name_urdu: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          name_urdu?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          name_urdu?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      monthly_list_items: {
        Row: {
          amount: number | null
          created_at: string
          product_id: string
          quantity: number
          user_id: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          product_id: string
          quantity?: number
          user_id: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          product_id?: string
          quantity?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_list_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_list_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_settings: {
        Row: {
          admin_whatsapp: string | null
          alerts_enabled: boolean
          id: boolean
          require_login_code: boolean
          secret_hash: string | null
          updated_at: string
        }
        Insert: {
          admin_whatsapp?: string | null
          alerts_enabled?: boolean
          id?: boolean
          require_login_code?: boolean
          secret_hash?: string | null
          updated_at?: string
        }
        Update: {
          admin_whatsapp?: string | null
          alerts_enabled?: boolean
          id?: boolean
          require_login_code?: boolean
          secret_hash?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      order_item_costs: {
        Row: {
          order_item_id: string
          supplier_line_total: number
          supplier_unit_price: number
        }
        Insert: {
          order_item_id: string
          supplier_line_total: number
          supplier_unit_price: number
        }
        Update: {
          order_item_id?: string
          supplier_line_total?: number
          supplier_unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_item_costs_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: true
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          amount_requested: number | null
          created_at: string
          id: string
          line_total: number
          order_id: string
          product_id: string | null
          product_name: string
          quantity: number
          unit_label: string
          unit_name: string | null
          unit_price: number
        }
        Insert: {
          amount_requested?: number | null
          created_at?: string
          id?: string
          line_total: number
          order_id: string
          product_id?: string | null
          product_name: string
          quantity: number
          unit_label: string
          unit_name?: string | null
          unit_price: number
        }
        Update: {
          amount_requested?: number | null
          created_at?: string
          id?: string
          line_total?: number
          order_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          unit_label?: string
          unit_name?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_notifications: {
        Row: {
          attempts: number
          claimed_at: string | null
          created_at: string
          id: string
          last_error: string | null
          order_id: string
          recipient: string
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          claimed_at?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          order_id: string
          recipient: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          claimed_at?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          order_id?: string
          recipient?: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_notifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_events: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          order_id: string
          status: Database["public"]["Enums"]["order_status"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          order_id: string
          status: Database["public"]["Enums"]["order_status"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          order_id?: string
          status?: Database["public"]["Enums"]["order_status"]
        }
        Relationships: [
          {
            foreignKeyName: "order_status_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_status_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          client_request_id: string | null
          created_at: string
          customer_note: string | null
          delivery_address: string
          delivery_area: string
          delivery_fee: number
          delivery_landmark: string | null
          delivery_name: string
          delivery_phone: string
          discount: number
          id: string
          order_number: number
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_status: Database["public"]["Enums"]["payment_status"]
          source: string
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          client_request_id?: string | null
          created_at?: string
          customer_note?: string | null
          delivery_address: string
          delivery_area: string
          delivery_fee?: number
          delivery_landmark?: string | null
          delivery_name: string
          delivery_phone: string
          discount?: number
          id?: string
          order_number?: never
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          source?: string
          status?: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total: number
          updated_at?: string
          user_id: string
        }
        Update: {
          client_request_id?: string | null
          created_at?: string
          customer_note?: string | null
          delivery_address?: string
          delivery_area?: string
          delivery_fee?: number
          delivery_landmark?: string | null
          delivery_name?: string
          delivery_phone?: string
          discount?: number
          id?: string
          order_number?: never
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          source?: string
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_proofs: {
        Row: {
          admin_note: string | null
          amount: number | null
          created_at: string
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          order_id: string
          screenshot_path: string | null
          status: Database["public"]["Enums"]["payment_proof_status"]
          submitted_by: string
          transaction_ref: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          admin_note?: string | null
          amount?: number | null
          created_at?: string
          id?: string
          method: Database["public"]["Enums"]["payment_method"]
          order_id: string
          screenshot_path?: string | null
          status?: Database["public"]["Enums"]["payment_proof_status"]
          submitted_by: string
          transaction_ref?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          admin_note?: string | null
          amount?: number | null
          created_at?: string
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          order_id?: string
          screenshot_path?: string | null
          status?: Database["public"]["Enums"]["payment_proof_status"]
          submitted_by?: string
          transaction_ref?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_proofs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_proofs_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_proofs_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_costs: {
        Row: {
          product_id: string
          supplier_price: number
          updated_at: string
        }
        Insert: {
          product_id: string
          supplier_price: number
          updated_at?: string
        }
        Update: {
          product_id?: string
          supplier_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_costs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          created_at: string
          height: number | null
          id: string
          original_name: string
          path: string
          product_id: string | null
          sha256: string
          sort_order: number
          width: number | null
        }
        Insert: {
          created_at?: string
          height?: number | null
          id?: string
          original_name: string
          path: string
          product_id?: string | null
          sha256: string
          sort_order?: number
          width?: number | null
        }
        Update: {
          created_at?: string
          height?: number | null
          id?: string
          original_name?: string
          path?: string
          product_id?: string | null
          sha256?: string
          sort_order?: number
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          in_stock: boolean
          is_active: boolean
          is_featured: boolean
          max_amount: number | null
          max_qty: number
          min_amount: number | null
          min_qty: number
          name: string
          name_urdu: string | null
          purchase_method: Database["public"]["Enums"]["purchase_method"]
          qty_step: number
          selling_price: number
          slug: string
          sort_order: number
          unit_id: string
          unit_label: string
          updated_at: string
          variant_of: string | null
        }
        Insert: {
          category_id: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          in_stock?: boolean
          is_active?: boolean
          is_featured?: boolean
          max_amount?: number | null
          max_qty?: number
          min_amount?: number | null
          min_qty?: number
          name: string
          name_urdu?: string | null
          purchase_method?: Database["public"]["Enums"]["purchase_method"]
          qty_step?: number
          selling_price: number
          slug: string
          sort_order?: number
          unit_id: string
          unit_label: string
          updated_at?: string
          variant_of?: string | null
        }
        Update: {
          category_id?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          in_stock?: boolean
          is_active?: boolean
          is_featured?: boolean
          max_amount?: number | null
          max_qty?: number
          min_amount?: number | null
          min_qty?: number
          name?: string
          name_urdu?: string | null
          purchase_method?: Database["public"]["Enums"]["purchase_method"]
          qty_step?: number
          selling_price?: number
          slug?: string
          sort_order?: number
          unit_id?: string
          unit_label?: string
          updated_at?: string
          variant_of?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_variant_of_fkey"
            columns: ["variant_of"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string
          id: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      shops: {
        Row: {
          address: string | null
          created_at: string
          id: string
          is_default: boolean
          name: string
          whatsapp_phone: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          whatsapp_phone?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          whatsapp_phone?: string | null
        }
        Relationships: []
      }
      store_settings: {
        Row: {
          bank_account_number: string | null
          bank_account_title: string | null
          bank_iban: string | null
          bank_name: string | null
          bank_qr_url: string | null
          delivery_areas: string | null
          delivery_fee: number
          delivery_hours: string | null
          easypaisa_account_name: string | null
          easypaisa_number: string | null
          easypaisa_qr_url: string | null
          id: boolean
          jazzcash_account_name: string | null
          jazzcash_number: string | null
          jazzcash_qr_url: string | null
          min_order_amount: number
          store_name: string
          support_phone: string | null
          support_whatsapp: string | null
          updated_at: string
        }
        Insert: {
          bank_account_number?: string | null
          bank_account_title?: string | null
          bank_iban?: string | null
          bank_name?: string | null
          bank_qr_url?: string | null
          delivery_areas?: string | null
          delivery_fee?: number
          delivery_hours?: string | null
          easypaisa_account_name?: string | null
          easypaisa_number?: string | null
          easypaisa_qr_url?: string | null
          id?: boolean
          jazzcash_account_name?: string | null
          jazzcash_number?: string | null
          jazzcash_qr_url?: string | null
          min_order_amount?: number
          store_name?: string
          support_phone?: string | null
          support_whatsapp?: string | null
          updated_at?: string
        }
        Update: {
          bank_account_number?: string | null
          bank_account_title?: string | null
          bank_iban?: string | null
          bank_name?: string | null
          bank_qr_url?: string | null
          delivery_areas?: string | null
          delivery_fee?: number
          delivery_hours?: string | null
          easypaisa_account_name?: string | null
          easypaisa_number?: string | null
          easypaisa_qr_url?: string | null
          id?: boolean
          jazzcash_account_name?: string | null
          jazzcash_number?: string | null
          jazzcash_qr_url?: string | null
          min_order_amount?: number
          store_name?: string
          support_phone?: string | null
          support_whatsapp?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      units: {
        Row: {
          allow_decimal: boolean
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
        }
        Insert: {
          allow_decimal?: boolean
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          allow_decimal?: boolean
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      voice_orders: {
        Row: {
          address_id: string | null
          alert_claimed_at: string | null
          alert_error: string | null
          alerted_at: string | null
          admin_note: string | null
          audio_path: string
          created_at: string
          customer_note: string | null
          duration_seconds: number | null
          id: string
          order_id: string | null
          status: Database["public"]["Enums"]["voice_order_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          address_id?: string | null
          alert_claimed_at?: string | null
          alert_error?: string | null
          alerted_at?: string | null
          admin_note?: string | null
          audio_path: string
          created_at?: string
          customer_note?: string | null
          duration_seconds?: number | null
          id?: string
          order_id?: string | null
          status?: Database["public"]["Enums"]["voice_order_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          address_id?: string | null
          alert_claimed_at?: string | null
          alert_error?: string | null
          alerted_at?: string | null
          admin_note?: string | null
          audio_path?: string
          created_at?: string
          customer_note?: string | null
          duration_seconds?: number | null
          id?: string
          order_id?: string | null
          status?: Database["public"]["Enums"]["voice_order_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_orders_address_id_fkey"
            columns: ["address_id"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_sales_report: {
        Args: { p_from: string; p_to: string }
        Returns: {
          day: string
          orders: number
          profit: number
          sales: number
          supplier_cost: number
        }[]
      }
      admin_set_order_status: {
        Args: {
          p_note?: string
          p_order_id: string
          p_status: Database["public"]["Enums"]["order_status"]
        }
        Returns: undefined
      }
      admin_create_order: {
        Args: {
          p_address_id?: string | null
          p_delivery_fee?: number | null
          p_discount?: number
          p_items: Json
          p_note?: string | null
          p_payment_method?: Database["public"]["Enums"]["payment_method"]
          p_voice_order_id: string
        }
        Returns: Json
      }
      admin_gate_status: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      admin_set_login_check: {
        Args: { p_on: boolean }
        Returns: undefined
      }
      admin_store_login_code: {
        Args: { p_code: string; p_secret: string }
        Returns: Json
      }
      admin_update_order: {
        Args: {
          p_delivery_fee?: number | null
          p_discount?: number
          p_items: Json
          p_note?: string | null
          p_order_id: string
        }
        Returns: Json
      }
      admin_verify_login_code: {
        Args: { p_code: string }
        Returns: string
      }
      claim_order_notification: {
        Args: { p_force?: boolean; p_order_id: string; p_recipient: string; p_secret: string }
        Returns: Json
      }
      claim_voice_alert: {
        Args: { p_force?: boolean; p_secret: string; p_voice_id: string }
        Returns: Json
      }
      record_voice_alert: {
        Args: { p_error?: string; p_ok: boolean; p_secret: string; p_voice_id: string }
        Returns: undefined
      }
      record_order_notification: {
        Args: { p_error?: string; p_ok: boolean; p_order_id: string; p_recipient: string; p_secret: string }
        Returns: undefined
      }
      place_order: {
        Args: {
          p_address_id: string
          p_items: Json
          p_note?: string
          p_payment_method: Database["public"]["Enums"]["payment_method"]
          p_request_id?: string
        }
        Returns: Json
      }
      set_default_address: {
        Args: { p_address_id: string }
        Returns: undefined
      }
    }
    Enums: {
      order_status:
        | "placed"
        | "confirmed"
        | "sent_to_shop"
        | "packed"
        | "out_for_delivery"
        | "delivered"
        | "cancelled"
      payment_method: "cod" | "jazzcash" | "bank_transfer" | "easypaisa"
      payment_proof_status: "submitted" | "verified" | "rejected"
      payment_status: "unpaid" | "pending_verification" | "paid" | "refunded"
      purchase_method: "quantity" | "amount" | "both"
      user_role: "customer" | "admin"
      voice_order_status: "new" | "converted" | "rejected"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      order_status: [
        "placed",
        "confirmed",
        "sent_to_shop",
        "packed",
        "out_for_delivery",
        "delivered",
        "cancelled",
      ],
      payment_method: ["cod", "jazzcash", "bank_transfer", "easypaisa"],
      payment_proof_status: ["submitted", "verified", "rejected"],
      payment_status: ["unpaid", "pending_verification", "paid", "refunded"],
      purchase_method: ["quantity", "amount", "both"],
      user_role: ["customer", "admin"],
      voice_order_status: ["new", "converted", "rejected"],
    },
  },
} as const
