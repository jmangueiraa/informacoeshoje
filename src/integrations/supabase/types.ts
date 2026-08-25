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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      clicks: {
        Row: {
          approximate_location: Json | null
          browser: string | null
          clicked_at: string
          device_type: string | null
          id: string
          ip_address: string | null
          link_id: string
          operating_system: string | null
          referrer: string | null
          slug: string | null
          user_agent: string | null
        }
        Insert: {
          approximate_location?: Json | null
          browser?: string | null
          clicked_at?: string
          device_type?: string | null
          id?: string
          ip_address?: string | null
          link_id: string
          operating_system?: string | null
          referrer?: string | null
          slug?: string | null
          user_agent?: string | null
        }
        Update: {
          approximate_location?: Json | null
          browser?: string | null
          clicked_at?: string
          device_type?: string | null
          id?: string
          ip_address?: string | null
          link_id?: string
          operating_system?: string | null
          referrer?: string | null
          slug?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clicks_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "links"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          created_at: string
          id: string
          last_send: string | null
          name: string
          needs_review: boolean | null
          phone_normalized: string
          raw_data: Json | null
          review_reason: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_send?: string | null
          name: string
          needs_review?: boolean | null
          phone_normalized: string
          raw_data?: Json | null
          review_reason?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_send?: string | null
          name?: string
          needs_review?: boolean | null
          phone_normalized?: string
          raw_data?: Json | null
          review_reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      links: {
        Row: {
          affiliate_url: string
          clicks_count: number | null
          created_at: string
          custom_domain: string | null
          domain_id: string | null
          expires_at: string | null
          id: string
          slug: string
          status: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          affiliate_url: string
          clicks_count?: number | null
          created_at?: string
          custom_domain?: string | null
          domain_id?: string | null
          expires_at?: string | null
          id?: string
          slug: string
          status?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          affiliate_url?: string
          clicks_count?: number | null
          created_at?: string
          custom_domain?: string | null
          domain_id?: string | null
          expires_at?: string | null
          id?: string
          slug?: string
          status?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "links_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "user_domains"
            referencedColumns: ["id"]
          },
        ]
      }
      news_projects: {
        Row: {
          author_name: string | null
          category: string | null
          content: string | null
          created_at: string
          id: string
          layout_color: string | null
          main_image: string | null
          portal_logo: string | null
          portal_name: string
          publish_date: string
          subtitle: string | null
          template_id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          author_name?: string | null
          category?: string | null
          content?: string | null
          created_at?: string
          id?: string
          layout_color?: string | null
          main_image?: string | null
          portal_logo?: string | null
          portal_name?: string
          publish_date?: string
          subtitle?: string | null
          template_id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          author_name?: string | null
          category?: string | null
          content?: string | null
          created_at?: string
          id?: string
          layout_color?: string | null
          main_image?: string | null
          portal_logo?: string | null
          portal_name?: string
          publish_date?: string
          subtitle?: string | null
          template_id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      plans: {
        Row: {
          active: boolean | null
          created_at: string
          features: Json | null
          id: string
          max_clicks: number
          max_links: number
          name: string
          price: number
        }
        Insert: {
          active?: boolean | null
          created_at?: string
          features?: Json | null
          id?: string
          max_clicks?: number
          max_links?: number
          name: string
          price?: number
        }
        Update: {
          active?: boolean | null
          created_at?: string
          features?: Json | null
          id?: string
          max_clicks?: number
          max_links?: number
          name?: string
          price?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          custom_domain: string | null
          full_name: string | null
          id: string
          plan_id: string | null
          shopee_api_key: string | null
          shopee_app_id: string | null
          shopee_app_secret: string | null
          status: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          custom_domain?: string | null
          full_name?: string | null
          id: string
          plan_id?: string | null
          shopee_api_key?: string | null
          shopee_app_id?: string | null
          shopee_app_secret?: string | null
          status?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          custom_domain?: string | null
          full_name?: string | null
          id?: string
          plan_id?: string | null
          shopee_api_key?: string | null
          shopee_app_id?: string | null
          shopee_app_secret?: string | null
          status?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          plan_id: string
          started_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          plan_id: string
          started_at?: string
          status: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          plan_id?: string
          started_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      trending_topics: {
        Row: {
          created_at: string | null
          id: string
          image_url: string | null
          mentions: number | null
          source: string | null
          source_url: string | null
          subject: string
          suggested_title: string | null
          trending_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          image_url?: string | null
          mentions?: number | null
          source?: string | null
          source_url?: string | null
          subject: string
          suggested_title?: string | null
          trending_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          image_url?: string | null
          mentions?: number | null
          source?: string | null
          source_url?: string | null
          subject?: string
          suggested_title?: string | null
          trending_at?: string | null
        }
        Relationships: []
      }
      user_domains: {
        Row: {
          created_at: string
          domain: string
          domain_type: string | null
          id: string
          is_primary: boolean | null
          is_verified: boolean | null
          updated_at: string | null
          user_id: string
          verification_status: string | null
        }
        Insert: {
          created_at?: string
          domain: string
          domain_type?: string | null
          id?: string
          is_primary?: boolean | null
          is_verified?: boolean | null
          updated_at?: string | null
          user_id: string
          verification_status?: string | null
        }
        Update: {
          created_at?: string
          domain?: string
          domain_type?: string | null
          id?: string
          is_primary?: boolean | null
          is_verified?: boolean | null
          updated_at?: string | null
          user_id?: string
          verification_status?: string | null
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
      viral_contents: {
        Row: {
          category: string
          created_at: string | null
          id: string
          image_url: string | null
          mentions: number | null
          score: number | null
          source: string | null
          source_url: string | null
          subject: string
          suggested_title: string | null
          type: string
          updated_at: string | null
          video_url: string | null
        }
        Insert: {
          category?: string
          created_at?: string | null
          id?: string
          image_url?: string | null
          mentions?: number | null
          score?: number | null
          source?: string | null
          source_url?: string | null
          subject: string
          suggested_title?: string | null
          type: string
          updated_at?: string | null
          video_url?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          id?: string
          image_url?: string | null
          mentions?: number | null
          score?: number | null
          source?: string | null
          source_url?: string | null
          subject?: string
          suggested_title?: string | null
          type?: string
          updated_at?: string | null
          video_url?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_link_clicks: {
        Args: { link_id: string; visitor_ip?: string }
        Returns: undefined
      }
      incrementar_clique: { Args: { link_slug: string }; Returns: string }
      normalize_contact_phone: { Args: { raw_phone: string }; Returns: string }
      sync_all_link_clicks: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
