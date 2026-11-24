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
      account_charges: {
        Row: {
          account_id: string
          addon_id: string | null
          amount_cents: number | null
          charge_date: string
          created_at: string
          created_by: string | null
          description: string
          id: string
          kind: string
          order_id: string | null
          quantity: number
          reservation_id: string | null
          source: string
          unit_price_cents: number
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          account_id: string
          addon_id?: string | null
          amount_cents?: number | null
          charge_date?: string
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          kind: string
          order_id?: string | null
          quantity: number
          reservation_id?: string | null
          source?: string
          unit_price_cents: number
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          account_id?: string
          addon_id?: string | null
          amount_cents?: number | null
          charge_date?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          kind?: string
          order_id?: string | null
          quantity?: number
          reservation_id?: string | null
          source?: string
          unit_price_cents?: number
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: []
      }
      account_payments: {
        Row: {
          account_id: string
          amount_cents: number
          created_at: string
          id: string
          method: string
          received_by: string | null
          reference: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          account_id: string
          amount_cents: number
          created_at?: string
          id?: string
          method: string
          received_by?: string | null
          reference?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          account_id?: string
          amount_cents?: number
          created_at?: string
          id?: string
          method?: string
          received_by?: string | null
          reference?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: []
      }
      guest_reviews: {
        Row: {
          comment: string
          created_at: string
          guest_name: string
          id: string
          is_published: boolean
          location: string
          rating: number
          stay_label: string
        }
        Insert: {
          comment: string
          created_at?: string
          guest_name: string
          id?: string
          is_published?: boolean
          location?: string
          rating: number
          stay_label?: string
        }
        Update: {
          comment?: string
          created_at?: string
          guest_name?: string
          id?: string
          is_published?: boolean
          location?: string
          rating?: number
          stay_label?: string
        }
        Relationships: []
      }
      kitchen_tickets: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          items: Json
          kot_no: string
          status: string
          ticket_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          items: Json
          kot_no?: string
          status?: string
          ticket_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          items?: Json
          kot_no?: string
          status?: string
          ticket_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kitchen_tickets_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "restaurant_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          category: string
          created_at: string
          description: string
          id: string
          image_url: string
          is_available: boolean
          name: string
          price_cents: number
          sort_order: number
        }
        Insert: {
          category: string
          created_at?: string
          description?: string
          id?: string
          image_url?: string
          is_available?: boolean
          name: string
          price_cents: number
          sort_order?: number
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          id?: string
          image_url?: string
          is_available?: boolean
          name?: string
          price_cents?: number
          sort_order?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          email: string
          id: string
          phone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string
          email?: string
          id: string
          phone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          email?: string
          id?: string
          phone?: string
          updated_at?: string
        }
        Relationships: []
      }
      reservation_addons: {
        Row: {
          addon_id: string
          created_at: string
          id: string
          quantity: number
          reservation_id: string
          service_date: string | null
          total_cents: number
          unit_price_cents: number
        }
        Insert: {
          addon_id: string
          created_at?: string
          id?: string
          quantity: number
          reservation_id: string
          service_date?: string | null
          total_cents?: number
          unit_price_cents?: number
        }
        Update: {
          addon_id?: string
          created_at?: string
          id?: string
          quantity?: number
          reservation_id?: string
          service_date?: string | null
          total_cents?: number
          unit_price_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "reservation_addons_addon_id_fkey"
            columns: ["addon_id"]
            isOneToOne: false
            referencedRelation: "resort_addons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_addons_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          account_id: string | null
          booking_group: string | null
          checked_in_at: string | null
          checked_out_at: string | null
          stay_status: string
          booking_reference: string
          check_in: string
          check_out: string
          created_at: string
          guest_count: number
          guest_email: string
          guest_name: string
          guest_note: string
          guest_phone: string
          id: string
          nightly_rate_cents: number
          room_unit_id: string
          status: Database["public"]["Enums"]["reservation_status"]
          total_cents: number
          user_id: string | null
        }
        Insert: {
          account_id?: string | null
          booking_group?: string | null
          checked_in_at?: string | null
          checked_out_at?: string | null
          stay_status?: string
          booking_reference?: string
          guest_email?: string
          guest_name?: string
          guest_phone?: string
          check_in: string
          check_out: string
          created_at?: string
          guest_count?: number
          guest_note?: string
          id?: string
          nightly_rate_cents?: number
          room_unit_id: string
          status?: Database["public"]["Enums"]["reservation_status"]
          total_cents?: number
          user_id?: string | null
        }
        Update: {
          account_id?: string | null
          booking_group?: string | null
          checked_in_at?: string | null
          checked_out_at?: string | null
          stay_status?: string
          booking_reference?: string
          guest_email?: string
          guest_name?: string
          guest_phone?: string
          check_in?: string
          check_out?: string
          created_at?: string
          guest_count?: number
          guest_note?: string
          id?: string
          nightly_rate_cents?: number
          room_unit_id?: string
          status?: Database["public"]["Enums"]["reservation_status"]
          total_cents?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reservations_room_unit_id_fkey"
            columns: ["room_unit_id"]
            isOneToOne: false
            referencedRelation: "room_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_payments: {
        Row: {
          amount_cents: number
          created_at: string
          id: string
          method: string
          received_by: string | null
          reference: string
          ticket_id: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          amount_cents: number
          created_at?: string
          id?: string
          method: string
          received_by?: string | null
          reference?: string
          ticket_id: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          amount_cents?: number
          created_at?: string
          id?: string
          method?: string
          received_by?: string | null
          reference?: string
          ticket_id?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: []
      }
      restaurant_tables: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      restaurant_ticket_items: {
        Row: {
          created_at: string
          id: string
          menu_item_id: string | null
          name: string
          quantity: number
          sent_qty: number
          ticket_id: string
          unit_price_cents: number
        }
        Insert: {
          created_at?: string
          id?: string
          menu_item_id?: string | null
          name: string
          quantity: number
          sent_qty?: number
          ticket_id: string
          unit_price_cents: number
        }
        Update: {
          created_at?: string
          id?: string
          menu_item_id?: string | null
          name?: string
          quantity?: number
          sent_qty?: number
          ticket_id?: string
          unit_price_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_ticket_items_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "restaurant_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_tickets: {
        Row: {
          account_id: string | null
          cancel_reason: string | null
          closed_at: string | null
          closed_by: string | null
          id: string
          label: string
          note: string
          opened_at: string
          opened_by: string | null
          status: string
          table_id: string | null
          ticket_no: string
        }
        Insert: {
          account_id?: string | null
          cancel_reason?: string | null
          closed_at?: string | null
          closed_by?: string | null
          id?: string
          label?: string
          note?: string
          opened_at?: string
          opened_by?: string | null
          status?: string
          table_id?: string | null
          ticket_no?: string
        }
        Update: {
          account_id?: string | null
          cancel_reason?: string | null
          closed_at?: string | null
          closed_by?: string | null
          id?: string
          label?: string
          note?: string
          opened_at?: string
          opened_by?: string | null
          status?: string
          table_id?: string | null
          ticket_no?: string
        }
        Relationships: []
      }
      resort_addons: {
        Row: {
          category: Database["public"]["Enums"]["addon_category"]
          created_at: string
          description: string
          id: string
          is_active: boolean
          name: string
          price_cents: number
          sort_order: number
          unit: Database["public"]["Enums"]["addon_unit"]
        }
        Insert: {
          category: Database["public"]["Enums"]["addon_category"]
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          name: string
          price_cents: number
          sort_order?: number
          unit?: Database["public"]["Enums"]["addon_unit"]
        }
        Update: {
          category?: Database["public"]["Enums"]["addon_category"]
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          name?: string
          price_cents?: number
          sort_order?: number
          unit?: Database["public"]["Enums"]["addon_unit"]
        }
        Relationships: []
      }
      resort_content: {
        Row: {
          content_key: string
          content_value: Json
          id: string
          is_published: boolean
          updated_at: string
        }
        Insert: {
          content_key: string
          content_value?: Json
          id?: string
          is_published?: boolean
          updated_at?: string
        }
        Update: {
          content_key?: string
          content_value?: Json
          id?: string
          is_published?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      resort_gallery: {
        Row: {
          alt_text: string
          category: string
          created_at: string
          id: string
          image_url: string
          is_published: boolean
          sort_order: number
          title: string
        }
        Insert: {
          alt_text?: string
          category?: string
          created_at?: string
          id?: string
          image_url: string
          is_published?: boolean
          sort_order?: number
          title: string
        }
        Update: {
          alt_text?: string
          category?: string
          created_at?: string
          id?: string
          image_url?: string
          is_published?: boolean
          sort_order?: number
          title?: string
        }
        Relationships: []
      }
      room_types: {
        Row: {
          bed_type: string
          created_at: string
          description: string
          features: string[]
          gallery_urls: string[]
          id: string
          image_url: string
          is_active: boolean
          max_guests: number
          name: string
          nightly_rate_cents: number
          panorama_url: string
          room_size_sqft: number | null
          slug: string
          sort_order: number
          video_url: string
          view_label: string
        }
        Insert: {
          bed_type?: string
          created_at?: string
          gallery_urls?: string[]
          panorama_url?: string
          room_size_sqft?: number | null
          video_url?: string
          view_label?: string
          description?: string
          features?: string[]
          id?: string
          image_url?: string
          is_active?: boolean
          max_guests?: number
          name: string
          nightly_rate_cents: number
          slug: string
          sort_order?: number
        }
        Update: {
          bed_type?: string
          created_at?: string
          gallery_urls?: string[]
          panorama_url?: string
          room_size_sqft?: number | null
          video_url?: string
          view_label?: string
          description?: string
          features?: string[]
          id?: string
          image_url?: string
          is_active?: boolean
          max_guests?: number
          name?: string
          nightly_rate_cents?: number
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      room_units: {
        Row: {
          created_at: string
          housekeeping: string
          id: string
          is_active: boolean
          name: string
          room_type_id: string
        }
        Insert: {
          created_at?: string
          housekeeping?: string
          id?: string
          is_active?: boolean
          name: string
          room_type_id: string
        }
        Update: {
          created_at?: string
          housekeeping?: string
          id?: string
          is_active?: boolean
          name?: string
          room_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_units_room_type_id_fkey"
            columns: ["room_type_id"]
            isOneToOne: false
            referencedRelation: "room_types"
            referencedColumns: ["id"]
          },
        ]
      }
      service_order_items: {
        Row: {
          id: string
          line_total_cents: number
          menu_item_id: string | null
          name: string
          order_id: string
          quantity: number
          unit_price_cents: number
        }
        Insert: {
          id?: string
          line_total_cents: number
          menu_item_id?: string | null
          name: string
          order_id: string
          quantity: number
          unit_price_cents: number
        }
        Update: {
          id?: string
          line_total_cents?: number
          menu_item_id?: string | null
          name?: string
          order_id?: string
          quantity?: number
          unit_price_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "service_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_order_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      service_orders: {
        Row: {
          bill_status: string
          created_at: string
          delivery: string
          guest_name: string
          guest_phone: string
          id: string
          note: string
          order_number: string
          reservation_id: string | null
          room_label: string
          status: string
          subtotal_cents: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          bill_status?: string
          created_at?: string
          delivery?: string
          guest_name: string
          guest_phone: string
          id?: string
          note?: string
          order_number?: string
          reservation_id?: string | null
          room_label?: string
          status?: string
          subtotal_cents?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          bill_status?: string
          created_at?: string
          delivery?: string
          guest_name?: string
          guest_phone?: string
          id?: string
          note?: string
          order_number?: string
          reservation_id?: string | null
          room_label?: string
          status?: string
          subtotal_cents?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_orders_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      stay_accounts: {
        Row: {
          account_no: string
          booking_group: string | null
          closed_at: string | null
          closed_by: string | null
          guest_email: string
          guest_name: string
          guest_phone: string
          id: string
          note: string
          opened_at: string
          opened_by: string | null
          status: string
        }
        Insert: {
          account_no?: string
          booking_group?: string | null
          closed_at?: string | null
          closed_by?: string | null
          guest_email?: string
          guest_name: string
          guest_phone?: string
          id?: string
          note?: string
          opened_at?: string
          opened_by?: string | null
          status?: string
        }
        Update: {
          account_no?: string
          booking_group?: string | null
          closed_at?: string | null
          closed_by?: string | null
          guest_email?: string
          guest_name?: string
          guest_phone?: string
          id?: string
          note?: string
          opened_at?: string
          opened_by?: string | null
          status?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      stay_account_totals: {
        Row: {
          account_id: string | null
          balance_cents: number | null
          charges_cents: number | null
          food_cents: number | null
          paid_cents: number | null
          room_cents: number | null
          service_cents: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      pos_cancel_ticket: { Args: { p_reason: string; p_ticket: string }; Returns: undefined }
      pos_open_ticket: { Args: { p_label: string; p_table: string | null }; Returns: string }
      pos_save_table: { Args: { p_active: boolean; p_id: string | null; p_name: string }; Returns: string }
      pos_send_kot: { Args: { p_ticket: string }; Returns: string }
      pos_set_kot_status: { Args: { p_kot: string; p_status: string }; Returns: undefined }
      pos_set_web_order_status: { Args: { p_order: string; p_status: string }; Returns: undefined }
      pos_ticket_charge_room: { Args: { p_account: string; p_ticket: string }; Returns: number }
      pos_ticket_pay: { Args: { p_method: string; p_reference: string; p_ticket: string }; Returns: number }
      pos_ticket_set_item: { Args: { p_menu_item: string; p_quantity: number; p_ticket: string }; Returns: undefined }
      pos_ticket_set_note: { Args: { p_label: string; p_note: string; p_ticket: string }; Returns: undefined }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      pos_add_charge: {
        Args: {
          p_account: string
          p_description: string
          p_kind: string
          p_quantity: number
          p_source?: string
          p_unit_price_cents: number
        }
        Returns: string
      }
      pos_add_payment: {
        Args: { p_account: string; p_amount_cents: number; p_method: string; p_reference: string }
        Returns: string
      }
      pos_add_service: {
        Args: { p_account: string; p_addon_id: string; p_quantity: number }
        Returns: string
      }
      pos_add_menu_item: {
        Args: { p_account: string; p_menu_item: string; p_quantity: number }
        Returns: string
      }
      pos_end_stay_today: { Args: { p_account: string }; Returns: undefined }
      pos_change_departure: { Args: { p_account: string; p_check_out: string }; Returns: undefined }
      pos_charge_order: { Args: { p_account: string; p_order_id: string }; Returns: string }
      pos_check_in: { Args: { p_reservation_ids: string[] }; Returns: string }
      pos_check_out: { Args: { p_account: string }; Returns: undefined }
      pos_list_staff: {
        Args: never
        Returns: { display_name: string; email: string; role: string; user_id: string }[]
      }
      pos_set_housekeeping: { Args: { p_state: string; p_unit: string }; Returns: undefined }
      pos_set_staff: { Args: { p_email: string; p_is_staff: boolean }; Returns: undefined }
      pos_void_charge: { Args: { p_charge: string; p_reason: string }; Returns: undefined }
      pos_void_payment: { Args: { p_payment: string; p_reason: string }; Returns: undefined }
      pos_walk_in: {
        Args: { p_check_out: string; p_email: string; p_name: string; p_phone: string; p_rooms: Json }
        Returns: string
      }
      resort_today: { Args: never; Returns: string }
      find_order: {
        Args: { p_order_number: string; p_phone: string }
        Returns: {
          created_at: string
          delivery: string
          items: Json
          order_number: string
          room_label: string
          status: string
          subtotal_cents: number
        }[]
      }
      place_order: {
        Args: {
          p_delivery: string
          p_items: Json
          p_name: string
          p_note: string
          p_phone: string
          p_reference: string
          p_room: string
        }
        Returns: {
          order_number: string
          subtotal_cents: number
        }[]
      }
      create_booking: {
        Args: {
          p_addons: Json
          p_check_in: string
          p_check_out: string
          p_email: string
          p_guests: number
          p_name: string
          p_note: string
          p_phone: string
          p_rooms: Json
        }
        Returns: {
          reference: string
          type_name: string
          unit_name: string
        }[]
      }
      find_booking: {
        Args: { p_phone: string; p_reference: string }
        Returns: {
          check_in: string
          check_out: string
          extras: string
          extras_total_cents: number
          guest_count: number
          reference: string
          room_total_cents: number
          status: Database["public"]["Enums"]["reservation_status"]
          type_name: string
        }[]
      }
      get_available_rooms: {
        Args: { p_check_in: string; p_check_out: string }
        Returns: {
          description: string
          features: string[]
          image_url: string
          max_guests: number
          nightly_rate_cents: number
          room_name: string
          room_type_id: string
          room_unit_id: string
          type_name: string
          type_slug: string
        }[]
      }
      get_room_type_availability: {
        Args: { p_check_in: string; p_check_out: string }
        Returns: {
          available_count: number
          room_type_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      addon_category: "food" | "service" | "activity"
      addon_unit: "per_person" | "per_person_per_night" | "per_night" | "per_stay"
      app_role: "admin" | "guest" | "staff"
      reservation_status: "pending" | "confirmed" | "cancelled"
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
      addon_category: ["food", "service", "activity"],
      addon_unit: ["per_person", "per_person_per_night", "per_night", "per_stay"],
      app_role: ["admin", "guest", "staff"],
      reservation_status: ["pending", "confirmed", "cancelled"],
    },
  },
} as const
