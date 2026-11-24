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
          total_cents: number
          unit_price_cents: number
        }
        Insert: {
          addon_id: string
          created_at?: string
          id?: string
          quantity: number
          reservation_id: string
          total_cents?: number
          unit_price_cents?: number
        }
        Update: {
          addon_id?: string
          created_at?: string
          id?: string
          quantity?: number
          reservation_id?: string
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
          booking_reference: string
          check_in: string
          check_out: string
          created_at: string
          guest_count: number
          guest_note: string
          id: string
          nightly_rate_cents: number
          room_unit_id: string
          status: Database["public"]["Enums"]["reservation_status"]
          total_cents: number
          user_id: string
        }
        Insert: {
          booking_reference?: string
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
          user_id: string
        }
        Update: {
          booking_reference?: string
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
          user_id?: string
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
          created_at: string
          description: string
          features: string[]
          id: string
          image_url: string
          is_active: boolean
          max_guests: number
          name: string
          nightly_rate_cents: number
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
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
          created_at?: string
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
          id: string
          is_active: boolean
          name: string
          room_type_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          room_type_id: string
        }
        Update: {
          created_at?: string
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
      [_ in never]: never
    }
    Functions: {
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
      app_role: "admin" | "guest"
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
      app_role: ["admin", "guest"],
      reservation_status: ["pending", "confirmed", "cancelled"],
    },
  },
} as const
