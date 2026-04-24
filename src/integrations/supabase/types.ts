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
      affiliate_codes: {
        Row: {
          code: string
          commission_pct: number
          created_at: string
          id: string
          total_clicks: number
          user_id: string
        }
        Insert: {
          code: string
          commission_pct?: number
          created_at?: string
          id?: string
          total_clicks?: number
          user_id: string
        }
        Update: {
          code?: string
          commission_pct?: number
          created_at?: string
          id?: string
          total_clicks?: number
          user_id?: string
        }
        Relationships: []
      }
      affiliate_referrals: {
        Row: {
          ambassador_id: string
          code: string
          commission_cents: number
          converted_at: string | null
          created_at: string
          id: string
          referred_user_id: string
        }
        Insert: {
          ambassador_id: string
          code: string
          commission_cents?: number
          converted_at?: string | null
          created_at?: string
          id?: string
          referred_user_id: string
        }
        Update: {
          ambassador_id?: string
          code?: string
          commission_cents?: number
          converted_at?: string | null
          created_at?: string
          id?: string
          referred_user_id?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          body: string | null
          created_at: string
          id: string
          media_path: string | null
          mime_type: string | null
          ppv_price_cents: number
          read_at: string | null
          sender_id: string
          subscribers_only: boolean
          thread_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          media_path?: string | null
          mime_type?: string | null
          ppv_price_cents?: number
          read_at?: string | null
          sender_id: string
          subscribers_only?: boolean
          thread_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          media_path?: string | null
          mime_type?: string | null
          ppv_price_cents?: number
          read_at?: string | null
          sender_id?: string
          subscribers_only?: boolean
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_ppv_unlocks: {
        Row: {
          amount_cents: number
          message_id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          message_id: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          message_id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_ppv_unlocks_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_threads: {
        Row: {
          created_at: string
          id: string
          last_message_at: string
          user_a: string
          user_b: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string
          user_a: string
          user_b: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string
          user_a?: string
          user_b?: string
        }
        Relationships: []
      }
      coupon_redemptions: {
        Row: {
          coupon_id: string
          id: string
          redeemed_at: string
          user_id: string
        }
        Insert: {
          coupon_id: string
          id?: string
          redeemed_at?: string
          user_id: string
        }
        Update: {
          coupon_id?: string
          id?: string
          redeemed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "subscription_coupons"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_onboarding: {
        Row: {
          dismissed: boolean
          has_avatar: boolean
          has_bio: boolean
          has_cover: boolean
          has_first_post: boolean
          has_price: boolean
          has_shared_link: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          dismissed?: boolean
          has_avatar?: boolean
          has_bio?: boolean
          has_cover?: boolean
          has_first_post?: boolean
          has_price?: boolean
          has_shared_link?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          dismissed?: boolean
          has_avatar?: boolean
          has_bio?: boolean
          has_cover?: boolean
          has_first_post?: boolean
          has_price?: boolean
          has_shared_link?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      dmca_reports: {
        Row: {
          admin_notes: string | null
          created_at: string
          creator_id: string
          description: string | null
          evidence_path: string | null
          id: string
          leaked_url: string
          status: Database["public"]["Enums"]["dmca_status"]
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          creator_id: string
          description?: string | null
          evidence_path?: string | null
          id?: string
          leaked_url: string
          status?: Database["public"]["Enums"]["dmca_status"]
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          creator_id?: string
          description?: string | null
          evidence_path?: string | null
          id?: string
          leaked_url?: string
          status?: Database["public"]["Enums"]["dmca_status"]
          updated_at?: string
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          followee_id: string
          follower_id: string
        }
        Insert: {
          created_at?: string
          followee_id: string
          follower_id: string
        }
        Update: {
          created_at?: string
          followee_id?: string
          follower_id?: string
        }
        Relationships: []
      }
      kyc_requests: {
        Row: {
          created_at: string
          document_back_url: string | null
          document_front_url: string
          document_type: string
          id: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          selfie_url: string
          status: Database["public"]["Enums"]["kyc_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          document_back_url?: string | null
          document_front_url: string
          document_type: string
          id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_url: string
          status?: Database["public"]["Enums"]["kyc_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          document_back_url?: string | null
          document_front_url?: string
          document_type?: string
          id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_url?: string
          status?: Database["public"]["Enums"]["kyc_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      moderation_logs: {
        Row: {
          ai_response: Json | null
          category: string
          created_at: string
          file_size_bytes: number | null
          id: string
          mime_type: string | null
          reason: string | null
          surface: string
          user_id: string
        }
        Insert: {
          ai_response?: Json | null
          category: string
          created_at?: string
          file_size_bytes?: number | null
          id?: string
          mime_type?: string | null
          reason?: string | null
          surface: string
          user_id: string
        }
        Update: {
          ai_response?: Json | null
          category?: string
          created_at?: string
          file_size_bytes?: number | null
          id?: string
          mime_type?: string | null
          reason?: string | null
          surface?: string
          user_id?: string
        }
        Relationships: []
      }
      post_goal_contributions: {
        Row: {
          amount_cents: number
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_goal_contributions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_goals: {
        Row: {
          created_at: string
          id: string
          is_unlocked: boolean
          post_id: string
          raised_cents: number
          target_cents: number
          unlock_price_cents: number
          unlocked_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_unlocked?: boolean
          post_id: string
          raised_cents?: number
          target_cents: number
          unlock_price_cents: number
          unlocked_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_unlocked?: boolean
          post_id?: string
          raised_cents?: number
          target_cents?: number
          unlock_price_cents?: number
          unlocked_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_goals_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: true
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_media: {
        Row: {
          created_at: string
          id: string
          mime_type: string
          position: number
          post_id: string
          storage_path: string
        }
        Insert: {
          created_at?: string
          id?: string
          mime_type: string
          position?: number
          post_id: string
          storage_path: string
        }
        Update: {
          created_at?: string
          id?: string
          mime_type?: string
          position?: number
          post_id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_media_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          body: string | null
          comments_count: number
          created_at: string
          creator_id: string
          id: string
          likes_count: number
          price_cents: number
          unlocks_count: number
          updated_at: string
          visibility: Database["public"]["Enums"]["post_visibility"]
        }
        Insert: {
          body?: string | null
          comments_count?: number
          created_at?: string
          creator_id: string
          id?: string
          likes_count?: number
          price_cents?: number
          unlocks_count?: number
          updated_at?: string
          visibility?: Database["public"]["Enums"]["post_visibility"]
        }
        Update: {
          body?: string | null
          comments_count?: number
          created_at?: string
          creator_id?: string
          id?: string
          likes_count?: number
          price_cents?: number
          unlocks_count?: number
          updated_at?: string
          visibility?: Database["public"]["Enums"]["post_visibility"]
        }
        Relationships: []
      }
      ppv_unlocks: {
        Row: {
          amount_cents: number
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ppv_unlocks_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          cover_url: string | null
          created_at: string
          display_name: string | null
          id: string
          is_verified: boolean
          language: string
          links: Json | null
          location: string | null
          subscription_price_cents: number | null
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          is_verified?: boolean
          language?: string
          links?: Json | null
          location?: string | null
          subscription_price_cents?: number | null
          updated_at?: string
          user_id: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          is_verified?: boolean
          language?: string
          links?: Json | null
          location?: string | null
          subscription_price_cents?: number | null
          updated_at?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      security_settings: {
        Row: {
          backup_codes_hash: string[] | null
          mfa_enabled: boolean
          mfa_required_for_withdraw: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          backup_codes_hash?: string[] | null
          mfa_enabled?: boolean
          mfa_required_for_withdraw?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          backup_codes_hash?: string[] | null
          mfa_enabled?: boolean
          mfa_required_for_withdraw?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      stories: {
        Row: {
          created_at: string
          creator_id: string
          expires_at: string
          id: string
          media_path: string
          mime_type: string
          views_count: number
          visibility: Database["public"]["Enums"]["story_visibility"]
        }
        Insert: {
          created_at?: string
          creator_id: string
          expires_at?: string
          id?: string
          media_path: string
          mime_type: string
          views_count?: number
          visibility?: Database["public"]["Enums"]["story_visibility"]
        }
        Update: {
          created_at?: string
          creator_id?: string
          expires_at?: string
          id?: string
          media_path?: string
          mime_type?: string
          views_count?: number
          visibility?: Database["public"]["Enums"]["story_visibility"]
        }
        Relationships: []
      }
      story_views: {
        Row: {
          story_id: string
          viewed_at: string
          viewer_id: string
        }
        Insert: {
          story_id: string
          viewed_at?: string
          viewer_id: string
        }
        Update: {
          story_id?: string
          viewed_at?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_views_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_coupons: {
        Row: {
          code: string
          created_at: string
          creator_id: string
          discount_pct: number | null
          duration_months: number
          id: string
          is_active: boolean
          max_uses: number
          trial_days: number | null
          uses_count: number
        }
        Insert: {
          code: string
          created_at?: string
          creator_id: string
          discount_pct?: number | null
          duration_months?: number
          id?: string
          is_active?: boolean
          max_uses?: number
          trial_days?: number | null
          uses_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          creator_id?: string
          discount_pct?: number | null
          duration_months?: number
          id?: string
          is_active?: boolean
          max_uses?: number
          trial_days?: number | null
          uses_count?: number
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          created_at: string
          creator_id: string
          discount_pct: number
          id: string
          is_active: boolean
          months: number
          price_cents: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          creator_id: string
          discount_pct?: number
          id?: string
          is_active?: boolean
          months: number
          price_cents: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          creator_id?: string
          discount_pct?: number
          id?: string
          is_active?: boolean
          months?: number
          price_cents?: number
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          creator_id: string
          current_period_end: string | null
          id: string
          price_cents: number
          status: Database["public"]["Enums"]["subscription_status"]
          subscriber_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          creator_id: string
          current_period_end?: string | null
          id?: string
          price_cents: number
          status?: Database["public"]["Enums"]["subscription_status"]
          subscriber_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          creator_id?: string
          current_period_end?: string | null
          id?: string
          price_cents?: number
          status?: Database["public"]["Enums"]["subscription_status"]
          subscriber_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount_cents: number
          created_at: string
          gateway: string | null
          gateway_ref: string | null
          id: string
          metadata: Json | null
          payee_id: string | null
          payer_id: string | null
          reference_id: string | null
          status: Database["public"]["Enums"]["tx_status"]
          type: Database["public"]["Enums"]["tx_type"]
          updated_at: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          gateway?: string | null
          gateway_ref?: string | null
          id?: string
          metadata?: Json | null
          payee_id?: string | null
          payer_id?: string | null
          reference_id?: string | null
          status?: Database["public"]["Enums"]["tx_status"]
          type: Database["public"]["Enums"]["tx_type"]
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          gateway?: string | null
          gateway_ref?: string | null
          id?: string
          metadata?: Json | null
          payee_id?: string | null
          payer_id?: string | null
          reference_id?: string | null
          status?: Database["public"]["Enums"]["tx_status"]
          type?: Database["public"]["Enums"]["tx_type"]
          updated_at?: string
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
          role: Database["public"]["Enums"]["app_role"]
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "subscriber" | "creator" | "admin" | "ambassador"
      dmca_status: "pending" | "notified" | "resolved" | "rejected"
      kyc_status: "pending" | "approved" | "rejected"
      post_visibility: "public" | "subscribers" | "ppv" | "goal"
      story_visibility: "public" | "subscribers"
      subscription_status: "active" | "canceled" | "expired"
      tx_status: "pending" | "paid" | "failed" | "refunded"
      tx_type:
        | "ppv"
        | "subscription"
        | "tip"
        | "withdrawal"
        | "affiliate_commission"
        | "chat_ppv"
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
      app_role: ["subscriber", "creator", "admin", "ambassador"],
      dmca_status: ["pending", "notified", "resolved", "rejected"],
      kyc_status: ["pending", "approved", "rejected"],
      post_visibility: ["public", "subscribers", "ppv", "goal"],
      story_visibility: ["public", "subscribers"],
      subscription_status: ["active", "canceled", "expired"],
      tx_status: ["pending", "paid", "failed", "refunded"],
      tx_type: [
        "ppv",
        "subscription",
        "tip",
        "withdrawal",
        "affiliate_commission",
        "chat_ppv",
      ],
    },
  },
} as const
