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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      device_commands: {
        Row: {
          command_type: string
          created_at: string
          delivered_at: string | null
          device_id: string
          executed_at: string | null
          id: string
          payload: Json
          result: Json | null
          status: string
        }
        Insert: {
          command_type: string
          created_at?: string
          delivered_at?: string | null
          device_id: string
          executed_at?: string | null
          id?: string
          payload?: Json
          result?: Json | null
          status?: string
        }
        Update: {
          command_type?: string
          created_at?: string
          delivered_at?: string | null
          device_id?: string
          executed_at?: string | null
          id?: string
          payload?: Json
          result?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_commands_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      device_screenshots: {
        Row: {
          created_at: string
          device_id: string
          height: number | null
          id: string
          storage_path: string
          width: number | null
        }
        Insert: {
          created_at?: string
          device_id: string
          height?: number | null
          id?: string
          storage_path: string
          width?: number | null
        }
        Update: {
          created_at?: string
          device_id?: string
          height?: number | null
          id?: string
          storage_path?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "device_screenshots_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      device_telemetry: {
        Row: {
          battery_charging: boolean | null
          battery_level: number | null
          cpu_usage: number | null
          created_at: string
          current_app: string | null
          device_id: string
          id: string
          ip_address: string | null
          latitude: number | null
          longitude: number | null
          memory_total_mb: number | null
          memory_used_mb: number | null
          network_type: string | null
          storage_total_mb: number | null
          storage_used_mb: number | null
          uptime_seconds: number | null
          wifi_strength: number | null
        }
        Insert: {
          battery_charging?: boolean | null
          battery_level?: number | null
          cpu_usage?: number | null
          created_at?: string
          current_app?: string | null
          device_id: string
          id?: string
          ip_address?: string | null
          latitude?: number | null
          longitude?: number | null
          memory_total_mb?: number | null
          memory_used_mb?: number | null
          network_type?: string | null
          storage_total_mb?: number | null
          storage_used_mb?: number | null
          uptime_seconds?: number | null
          wifi_strength?: number | null
        }
        Update: {
          battery_charging?: boolean | null
          battery_level?: number | null
          cpu_usage?: number | null
          created_at?: string
          current_app?: string | null
          device_id?: string
          id?: string
          ip_address?: string | null
          latitude?: number | null
          longitude?: number | null
          memory_total_mb?: number | null
          memory_used_mb?: number | null
          network_type?: string | null
          storage_total_mb?: number | null
          storage_used_mb?: number | null
          uptime_seconds?: number | null
          wifi_strength?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "device_telemetry_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      devices: {
        Row: {
          android_version: string | null
          api_key: string
          battery_level: number | null
          created_at: string
          current_app: string | null
          device_name: string
          id: string
          kiosk_mode: boolean
          last_seen_at: string | null
          model: string | null
          policy_id: string | null
          serial_number: string | null
          status: string
          store_id: string | null
          user_id: string
        }
        Insert: {
          android_version?: string | null
          api_key?: string
          battery_level?: number | null
          created_at?: string
          current_app?: string | null
          device_name: string
          id?: string
          kiosk_mode?: boolean
          last_seen_at?: string | null
          model?: string | null
          policy_id?: string | null
          serial_number?: string | null
          status?: string
          store_id?: string | null
          user_id?: string
        }
        Update: {
          android_version?: string | null
          api_key?: string
          battery_level?: number | null
          created_at?: string
          current_app?: string | null
          device_name?: string
          id?: string
          kiosk_mode?: boolean
          last_seen_at?: string | null
          model?: string | null
          policy_id?: string | null
          serial_number?: string | null
          status?: string
          store_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "devices_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "kiosk_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devices_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      kiosk_policies: {
        Row: {
          allowed_apps: Json
          blocked_apps: Json
          created_at: string
          disable_play_store: boolean
          disable_settings: boolean
          id: string
          lock_screen: boolean
          name: string
          user_id: string
          volume_limit: number | null
        }
        Insert: {
          allowed_apps?: Json
          blocked_apps?: Json
          created_at?: string
          disable_play_store?: boolean
          disable_settings?: boolean
          id?: string
          lock_screen?: boolean
          name: string
          user_id?: string
          volume_limit?: number | null
        }
        Update: {
          allowed_apps?: Json
          blocked_apps?: Json
          created_at?: string
          disable_play_store?: boolean
          disable_settings?: boolean
          id?: string
          lock_screen?: boolean
          name?: string
          user_id?: string
          volume_limit?: number | null
        }
        Relationships: []
      }
      stores: {
        Row: {
          address: string | null
          created_at: string
          id: string
          lat: number | null
          lng: number | null
          name: string
          user_id: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          user_id?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
