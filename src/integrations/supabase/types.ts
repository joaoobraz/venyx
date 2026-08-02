export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      backup_verification_runs: {
        Row: {
          backup_provider: string;
          backup_reference: string;
          completed_at: string;
          created_at: string;
          id: string;
          note: string;
          restore_environment: string;
          row_count_checks: Json;
          source_environment: string;
          started_at: string;
          status: string;
          storage_checks: Json;
          verified_by: string;
        };
        Insert: {
          backup_provider: string;
          backup_reference: string;
          completed_at: string;
          created_at?: string;
          id?: string;
          note: string;
          restore_environment: string;
          row_count_checks?: Json;
          source_environment: string;
          started_at: string;
          status: string;
          storage_checks?: Json;
          verified_by: string;
        };
        Update: {
          backup_provider?: string;
          backup_reference?: string;
          completed_at?: string;
          created_at?: string;
          id?: string;
          note?: string;
          restore_environment?: string;
          row_count_checks?: Json;
          source_environment?: string;
          started_at?: string;
          status?: string;
          storage_checks?: Json;
          verified_by?: string;
        };
        Relationships: [];
      };
      admin_access_audit: {
        Row: {
          created_at: string;
          granted: boolean;
          id: string;
          ip_address: string | null;
          path: string | null;
          reason: string | null;
          user_agent: string | null;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          granted?: boolean;
          id?: string;
          ip_address?: string | null;
          path?: string | null;
          reason?: string | null;
          user_agent?: string | null;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          granted?: boolean;
          id?: string;
          ip_address?: string | null;
          path?: string | null;
          reason?: string | null;
          user_agent?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      admin_action_audit: {
        Row: {
          action_type: string;
          admin_id: string;
          created_at: string;
          id: string;
          metadata: Json;
          target_id: string | null;
          target_type: string;
          target_user_id: string | null;
        };
        Insert: {
          action_type: string;
          admin_id: string;
          created_at?: string;
          id?: string;
          metadata?: Json;
          target_id?: string | null;
          target_type: string;
          target_user_id?: string | null;
        };
        Update: {
          action_type?: string;
          admin_id?: string;
          created_at?: string;
          id?: string;
          metadata?: Json;
          target_id?: string | null;
          target_type?: string;
          target_user_id?: string | null;
        };
        Relationships: [];
      };
      affiliate_codes: {
        Row: {
          code: string;
          commission_pct: number;
          created_at: string;
          id: string;
          total_clicks: number;
          user_id: string;
        };
        Insert: {
          code: string;
          commission_pct?: number;
          created_at?: string;
          id?: string;
          total_clicks?: number;
          user_id: string;
        };
        Update: {
          code?: string;
          commission_pct?: number;
          created_at?: string;
          id?: string;
          total_clicks?: number;
          user_id?: string;
        };
        Relationships: [];
      };
      affiliate_referrals: {
        Row: {
          ambassador_id: string;
          code: string;
          commission_cents: number;
          converted_at: string | null;
          created_at: string;
          id: string;
          referred_user_id: string;
        };
        Insert: {
          ambassador_id: string;
          code: string;
          commission_cents?: number;
          converted_at?: string | null;
          created_at?: string;
          id?: string;
          referred_user_id: string;
        };
        Update: {
          ambassador_id?: string;
          code?: string;
          commission_cents?: number;
          converted_at?: string | null;
          created_at?: string;
          id?: string;
          referred_user_id?: string;
        };
        Relationships: [];
      };
      chat_link_clicks: {
        Row: {
          click_type: string;
          clicked_at: string;
          creator_id: string;
          id: string;
          message_id: string;
          user_id: string;
        };
        Insert: {
          click_type?: string;
          clicked_at?: string;
          creator_id: string;
          id?: string;
          message_id: string;
          user_id: string;
        };
        Update: {
          click_type?: string;
          clicked_at?: string;
          creator_id?: string;
          id?: string;
          message_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "chat_link_clicks_message_id_fkey";
            columns: ["message_id"];
            isOneToOne: false;
            referencedRelation: "chat_messages";
            referencedColumns: ["id"];
          },
        ];
      };
      chat_messages: {
        Row: {
          body: string | null;
          campaign_id: string | null;
          created_at: string;
          edited_at: string | null;
          id: string;
          media_path: string | null;
          mime_type: string | null;
          ppv_price_cents: number;
          read_at: string | null;
          sender_id: string;
          subscribers_only: boolean;
          thread_id: string;
        };
        Insert: {
          body?: string | null;
          campaign_id?: string | null;
          created_at?: string;
          edited_at?: string | null;
          id?: string;
          media_path?: string | null;
          mime_type?: string | null;
          ppv_price_cents?: number;
          read_at?: string | null;
          sender_id: string;
          subscribers_only?: boolean;
          thread_id: string;
        };
        Update: {
          body?: string | null;
          campaign_id?: string | null;
          created_at?: string;
          edited_at?: string | null;
          id?: string;
          media_path?: string | null;
          mime_type?: string | null;
          ppv_price_cents?: number;
          read_at?: string | null;
          sender_id?: string;
          subscribers_only?: boolean;
          thread_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "chat_messages_thread_id_fkey";
            columns: ["thread_id"];
            isOneToOne: false;
            referencedRelation: "chat_threads";
            referencedColumns: ["id"];
          },
        ];
      };
      chat_ppv_unlocks: {
        Row: {
          amount_cents: number;
          message_id: string;
          unlocked_at: string;
          user_id: string;
        };
        Insert: {
          amount_cents: number;
          message_id: string;
          unlocked_at?: string;
          user_id: string;
        };
        Update: {
          amount_cents?: number;
          message_id?: string;
          unlocked_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "chat_ppv_unlocks_message_id_fkey";
            columns: ["message_id"];
            isOneToOne: false;
            referencedRelation: "chat_messages";
            referencedColumns: ["id"];
          },
        ];
      };
      chat_threads: {
        Row: {
          created_at: string;
          id: string;
          last_message_at: string;
          user_a: string;
          user_b: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          last_message_at?: string;
          user_a: string;
          user_b: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          last_message_at?: string;
          user_a?: string;
          user_b?: string;
        };
        Relationships: [];
      };
      account_recovery_requests: {
        Row: {
          admin_notes: string | null;
          contact_email: string;
          created_at: string;
          details: string;
          id: string;
          issue_type: string;
          login_email: string;
          protocol: string;
          request_ip_hash: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          admin_notes?: string | null;
          contact_email: string;
          created_at?: string;
          details: string;
          id?: string;
          issue_type: string;
          login_email: string;
          protocol?: string;
          request_ip_hash: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          admin_notes?: string | null;
          contact_email?: string;
          created_at?: string;
          details?: string;
          id?: string;
          issue_type?: string;
          login_email?: string;
          protocol?: string;
          request_ip_hash?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      content_reports: {
        Row: {
          assigned_to: string | null;
          created_at: string;
          details: string | null;
          escalated_at: string | null;
          id: string;
          priority: string;
          reason: string;
          reported_user_id: string | null;
          reporter_id: string;
          resolution_note: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          sla_due_at: string | null;
          status: string;
          target_id: string;
          target_type: string;
          updated_at: string;
        };
        Insert: {
          assigned_to?: string | null;
          created_at?: string;
          details?: string | null;
          escalated_at?: string | null;
          id?: string;
          priority?: string;
          reason: string;
          reported_user_id?: string | null;
          reporter_id: string;
          resolution_note?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          sla_due_at?: string | null;
          status?: string;
          target_id: string;
          target_type: string;
          updated_at?: string;
        };
        Update: {
          assigned_to?: string | null;
          created_at?: string;
          details?: string | null;
          escalated_at?: string | null;
          id?: string;
          priority?: string;
          reason?: string;
          reported_user_id?: string | null;
          reporter_id?: string;
          resolution_note?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          sla_due_at?: string | null;
          status?: string;
          target_id?: string;
          target_type?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      coupon_redemptions: {
        Row: {
          coupon_id: string;
          id: string;
          redeemed_at: string;
          user_id: string;
        };
        Insert: {
          coupon_id: string;
          id?: string;
          redeemed_at?: string;
          user_id: string;
        };
        Update: {
          coupon_id?: string;
          id?: string;
          redeemed_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "coupon_redemptions_coupon_id_fkey";
            columns: ["coupon_id"];
            isOneToOne: false;
            referencedRelation: "subscription_coupons";
            referencedColumns: ["id"];
          },
        ];
      };
      creator_moderation_rules: {
        Row: {
          blocked_user_id: string | null;
          created_at: string;
          creator_id: string;
          id: string;
          is_active: boolean;
          kind: string;
          value: string | null;
        };
        Insert: {
          blocked_user_id?: string | null;
          created_at?: string;
          creator_id: string;
          id?: string;
          is_active?: boolean;
          kind: string;
          value?: string | null;
        };
        Update: {
          blocked_user_id?: string | null;
          created_at?: string;
          creator_id?: string;
          id?: string;
          is_active?: boolean;
          kind?: string;
          value?: string | null;
        };
        Relationships: [];
      };
      creator_gift_contributions: {
        Row: {
          amount_cents: number;
          created_at: string;
          creator_id: string;
          id: string;
          item_id: string;
          message: string | null;
          paid_at: string;
          pix_charge_id: string;
          supporter_id: string;
        };
        Insert: {
          amount_cents: number;
          created_at?: string;
          creator_id: string;
          id?: string;
          item_id: string;
          message?: string | null;
          paid_at?: string;
          pix_charge_id: string;
          supporter_id: string;
        };
        Update: {
          amount_cents?: number;
          created_at?: string;
          creator_id?: string;
          id?: string;
          item_id?: string;
          message?: string | null;
          paid_at?: string;
          pix_charge_id?: string;
          supporter_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "creator_gift_contributions_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "creator_gift_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "creator_gift_contributions_pix_charge_id_fkey";
            columns: ["pix_charge_id"];
            isOneToOne: true;
            referencedRelation: "pix_charges";
            referencedColumns: ["id"];
          },
        ];
      };
      creator_gift_items: {
        Row: {
          category: string;
          created_at: string;
          creator_id: string;
          description: string;
          emoji: string;
          id: string;
          is_active: boolean;
          position: number;
          received_cents: number;
          received_count: number;
          title: string;
          updated_at: string;
          value_cents: number;
        };
        Insert: {
          category: string;
          created_at?: string;
          creator_id: string;
          description?: string;
          emoji?: string;
          id?: string;
          is_active?: boolean;
          position?: number;
          received_cents?: number;
          received_count?: number;
          title: string;
          updated_at?: string;
          value_cents: number;
        };
        Update: {
          category?: string;
          created_at?: string;
          creator_id?: string;
          description?: string;
          emoji?: string;
          id?: string;
          is_active?: boolean;
          position?: number;
          received_cents?: number;
          received_count?: number;
          title?: string;
          updated_at?: string;
          value_cents?: number;
        };
        Relationships: [];
      };
      creator_gift_settings: {
        Row: {
          created_at: string;
          creator_id: string;
          intro: string;
          is_published: boolean;
          thank_you_message: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          creator_id: string;
          intro?: string;
          is_published?: boolean;
          thank_you_message?: string;
          title?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          creator_id?: string;
          intro?: string;
          is_published?: boolean;
          thank_you_message?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      creator_link_events: {
        Row: {
          created_at: string;
          event_day: string;
          event_type: string;
          id: string;
          link_id: string | null;
          page_owner_id: string;
          visitor_hash: string;
        };
        Insert: {
          created_at?: string;
          event_day?: string;
          event_type: string;
          id?: string;
          link_id?: string | null;
          page_owner_id: string;
          visitor_hash: string;
        };
        Update: {
          created_at?: string;
          event_day?: string;
          event_type?: string;
          id?: string;
          link_id?: string | null;
          page_owner_id?: string;
          visitor_hash?: string;
        };
        Relationships: [
          {
            foreignKeyName: "creator_link_events_link_id_fkey";
            columns: ["link_id"];
            isOneToOne: false;
            referencedRelation: "creator_links";
            referencedColumns: ["id"];
          },
        ];
      };
      creator_link_pages: {
        Row: {
          avatar_url: string | null;
          background_color: string | null;
          bio: string | null;
          button_style: string;
          cover_url: string | null;
          created_at: string;
          is_published: boolean;
          show_avatar: boolean;
          text_color: string | null;
          theme: string;
          updated_at: string;
          user_id: string;
          views_count: number;
        };
        Insert: {
          avatar_url?: string | null;
          background_color?: string | null;
          bio?: string | null;
          button_style?: string;
          cover_url?: string | null;
          created_at?: string;
          is_published?: boolean;
          show_avatar?: boolean;
          text_color?: string | null;
          theme?: string;
          updated_at?: string;
          user_id: string;
          views_count?: number;
        };
        Update: {
          avatar_url?: string | null;
          background_color?: string | null;
          bio?: string | null;
          button_style?: string;
          cover_url?: string | null;
          created_at?: string;
          is_published?: boolean;
          show_avatar?: boolean;
          text_color?: string | null;
          theme?: string;
          updated_at?: string;
          user_id?: string;
          views_count?: number;
        };
        Relationships: [];
      };
      creator_links: {
        Row: {
          clicks_count: number;
          created_at: string;
          icon: string | null;
          id: string;
          is_active: boolean;
          is_featured: boolean;
          position: number;
          title: string;
          updated_at: string;
          url: string;
          user_id: string;
        };
        Insert: {
          clicks_count?: number;
          created_at?: string;
          icon?: string | null;
          id?: string;
          is_active?: boolean;
          is_featured?: boolean;
          position?: number;
          title: string;
          updated_at?: string;
          url: string;
          user_id: string;
        };
        Update: {
          clicks_count?: number;
          created_at?: string;
          icon?: string | null;
          id?: string;
          is_active?: boolean;
          is_featured?: boolean;
          position?: number;
          title?: string;
          updated_at?: string;
          url?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      creator_onboarding: {
        Row: {
          dismissed: boolean;
          has_avatar: boolean;
          has_bio: boolean;
          has_cover: boolean;
          has_first_post: boolean;
          has_price: boolean;
          has_shared_link: boolean;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          dismissed?: boolean;
          has_avatar?: boolean;
          has_bio?: boolean;
          has_cover?: boolean;
          has_first_post?: boolean;
          has_price?: boolean;
          has_shared_link?: boolean;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          dismissed?: boolean;
          has_avatar?: boolean;
          has_bio?: boolean;
          has_cover?: boolean;
          has_first_post?: boolean;
          has_price?: boolean;
          has_shared_link?: boolean;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      creator_payout_keys: {
        Row: {
          created_at: string;
          holder_document: string;
          holder_name: string;
          pix_key: string;
          pix_key_type: Database["public"]["Enums"]["pix_key_type"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          holder_document: string;
          holder_name: string;
          pix_key: string;
          pix_key_type: Database["public"]["Enums"]["pix_key_type"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          holder_document?: string;
          holder_name?: string;
          pix_key?: string;
          pix_key_type?: Database["public"]["Enums"]["pix_key_type"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      dm_templates: {
        Row: {
          body: string;
          created_at: string;
          creator_id: string;
          default_ppv_price_cents: number;
          id: string;
          name: string;
          updated_at: string;
          uses_count: number;
        };
        Insert: {
          body: string;
          created_at?: string;
          creator_id: string;
          default_ppv_price_cents?: number;
          id?: string;
          name: string;
          updated_at?: string;
          uses_count?: number;
        };
        Update: {
          body?: string;
          created_at?: string;
          creator_id?: string;
          default_ppv_price_cents?: number;
          id?: string;
          name?: string;
          updated_at?: string;
          uses_count?: number;
        };
        Relationships: [];
      };
      dmca_reports: {
        Row: {
          admin_notes: string | null;
          created_at: string;
          creator_id: string;
          description: string | null;
          evidence_path: string | null;
          id: string;
          leaked_url: string;
          status: Database["public"]["Enums"]["dmca_status"];
          updated_at: string;
        };
        Insert: {
          admin_notes?: string | null;
          created_at?: string;
          creator_id: string;
          description?: string | null;
          evidence_path?: string | null;
          id?: string;
          leaked_url: string;
          status?: Database["public"]["Enums"]["dmca_status"];
          updated_at?: string;
        };
        Update: {
          admin_notes?: string | null;
          created_at?: string;
          creator_id?: string;
          description?: string | null;
          evidence_path?: string | null;
          id?: string;
          leaked_url?: string;
          status?: Database["public"]["Enums"]["dmca_status"];
          updated_at?: string;
        };
        Relationships: [];
      };
      follows: {
        Row: {
          created_at: string;
          followee_id: string;
          follower_id: string;
        };
        Insert: {
          created_at?: string;
          followee_id: string;
          follower_id: string;
        };
        Update: {
          created_at?: string;
          followee_id?: string;
          follower_id?: string;
        };
        Relationships: [];
      };
      identity_verifications: {
        Row: {
          birth_date: string;
          country: string;
          cpf: string;
          created_at: string;
          full_name: string;
          id: string;
          method: string;
          status: string;
          updated_at: string;
          user_id: string;
          verified_at: string | null;
        };
        Insert: {
          birth_date: string;
          country?: string;
          cpf: string;
          created_at?: string;
          full_name: string;
          id?: string;
          method?: string;
          status?: string;
          updated_at?: string;
          user_id: string;
          verified_at?: string | null;
        };
        Update: {
          birth_date?: string;
          country?: string;
          cpf?: string;
          created_at?: string;
          full_name?: string;
          id?: string;
          method?: string;
          status?: string;
          updated_at?: string;
          user_id?: string;
          verified_at?: string | null;
        };
        Relationships: [];
      };
      kyc_requests: {
        Row: {
          created_at: string;
          document_back_url: string | null;
          document_front_url: string;
          document_type: string;
          id: string;
          rejection_reason: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          selfie_url: string;
          status: Database["public"]["Enums"]["kyc_status"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          document_back_url?: string | null;
          document_front_url: string;
          document_type: string;
          id?: string;
          rejection_reason?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          selfie_url: string;
          status?: Database["public"]["Enums"]["kyc_status"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          document_back_url?: string | null;
          document_front_url?: string;
          document_type?: string;
          id?: string;
          rejection_reason?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          selfie_url?: string;
          status?: Database["public"]["Enums"]["kyc_status"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      loyalty_ledger: {
        Row: {
          created_at: string;
          creator_id: string;
          id: string;
          points_delta: number;
          reason: string;
          ref_id: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          creator_id: string;
          id?: string;
          points_delta: number;
          reason: string;
          ref_id?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          creator_id?: string;
          id?: string;
          points_delta?: number;
          reason?: string;
          ref_id?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      loyalty_points: {
        Row: {
          creator_id: string;
          points: number;
          tier: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          creator_id: string;
          points?: number;
          tier?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          creator_id?: string;
          points?: number;
          tier?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      mass_dm_campaigns: {
        Row: {
          body: string | null;
          created_at: string;
          creator_id: string;
          filter_last_chat_within_hours: number | null;
          filter_link_clicked: boolean;
          id: string;
          media_path: string | null;
          mime_type: string | null;
          ppv_price_cents: number;
          recipients_count: number;
          scheduled_at: string | null;
          segment: Database["public"]["Enums"]["mass_dm_segment"];
          sent_count: number;
          status: string;
          tag_id: string | null;
          template_id: string | null;
          total_failed: number;
          total_pending: number;
        };
        Insert: {
          body?: string | null;
          created_at?: string;
          creator_id: string;
          filter_last_chat_within_hours?: number | null;
          filter_link_clicked?: boolean;
          id?: string;
          media_path?: string | null;
          mime_type?: string | null;
          ppv_price_cents?: number;
          recipients_count?: number;
          scheduled_at?: string | null;
          segment: Database["public"]["Enums"]["mass_dm_segment"];
          sent_count?: number;
          status?: string;
          tag_id?: string | null;
          template_id?: string | null;
          total_failed?: number;
          total_pending?: number;
        };
        Update: {
          body?: string | null;
          created_at?: string;
          creator_id?: string;
          filter_last_chat_within_hours?: number | null;
          filter_link_clicked?: boolean;
          id?: string;
          media_path?: string | null;
          mime_type?: string | null;
          ppv_price_cents?: number;
          recipients_count?: number;
          scheduled_at?: string | null;
          segment?: Database["public"]["Enums"]["mass_dm_segment"];
          sent_count?: number;
          status?: string;
          tag_id?: string | null;
          template_id?: string | null;
          total_failed?: number;
          total_pending?: number;
        };
        Relationships: [
          {
            foreignKeyName: "mass_dm_campaigns_tag_id_fkey";
            columns: ["tag_id"];
            isOneToOne: false;
            referencedRelation: "subscriber_tags";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "mass_dm_campaigns_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "dm_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      mass_dm_jobs: {
        Row: {
          attempts: number;
          body: string | null;
          campaign_id: string;
          created_at: string;
          creator_id: string;
          error_reason: string | null;
          id: string;
          media_path: string | null;
          mime_type: string | null;
          ppv_price_cents: number;
          processed_at: string | null;
          recipient_id: string;
          scheduled_at: string;
          status: Database["public"]["Enums"]["mass_dm_job_status"];
        };
        Insert: {
          attempts?: number;
          body?: string | null;
          campaign_id: string;
          created_at?: string;
          creator_id: string;
          error_reason?: string | null;
          id?: string;
          media_path?: string | null;
          mime_type?: string | null;
          ppv_price_cents?: number;
          processed_at?: string | null;
          recipient_id: string;
          scheduled_at?: string;
          status?: Database["public"]["Enums"]["mass_dm_job_status"];
        };
        Update: {
          attempts?: number;
          body?: string | null;
          campaign_id?: string;
          created_at?: string;
          creator_id?: string;
          error_reason?: string | null;
          id?: string;
          media_path?: string | null;
          mime_type?: string | null;
          ppv_price_cents?: number;
          processed_at?: string | null;
          recipient_id?: string;
          scheduled_at?: string;
          status?: Database["public"]["Enums"]["mass_dm_job_status"];
        };
        Relationships: [
          {
            foreignKeyName: "mass_dm_jobs_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "mass_dm_campaigns";
            referencedColumns: ["id"];
          },
        ];
      };
      moderation_decisions: {
        Row: {
          decided_at: string;
          decided_by: string;
          decision: string;
          log_id: string;
          note: string;
        };
        Insert: {
          decided_at?: string;
          decided_by: string;
          decision: string;
          log_id: string;
          note: string;
        };
        Update: {
          decided_at?: string;
          decided_by?: string;
          decision?: string;
          log_id?: string;
          note?: string;
        };
        Relationships: [
          {
            foreignKeyName: "moderation_decisions_log_id_fkey";
            columns: ["log_id"];
            isOneToOne: true;
            referencedRelation: "moderation_logs";
            referencedColumns: ["id"];
          },
        ];
      };
      moderation_logs: {
        Row: {
          ai_response: Json | null;
          category: string;
          created_at: string;
          file_size_bytes: number | null;
          id: string;
          mime_type: string | null;
          reason: string | null;
          surface: string;
          user_id: string;
        };
        Insert: {
          ai_response?: Json | null;
          category: string;
          created_at?: string;
          file_size_bytes?: number | null;
          id?: string;
          mime_type?: string | null;
          reason?: string | null;
          surface: string;
          user_id: string;
        };
        Update: {
          ai_response?: Json | null;
          category?: string;
          created_at?: string;
          file_size_bytes?: number | null;
          id?: string;
          mime_type?: string | null;
          reason?: string | null;
          surface?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      notification_mutes: {
        Row: {
          created_at: string;
          id: string;
          target_id: string;
          target_type: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          target_id: string;
          target_type: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          target_id?: string;
          target_type?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          body: string | null;
          created_at: string;
          id: string;
          link: string | null;
          metadata: Json;
          read_at: string | null;
          title: string;
          type: string;
          user_id: string;
        };
        Insert: {
          body?: string | null;
          created_at?: string;
          id?: string;
          link?: string | null;
          metadata?: Json;
          read_at?: string | null;
          title: string;
          type: string;
          user_id: string;
        };
        Update: {
          body?: string | null;
          created_at?: string;
          id?: string;
          link?: string | null;
          metadata?: Json;
          read_at?: string | null;
          title?: string;
          type?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      financial_reconciliation_issues: {
        Row: {
          attempt_count: number;
          charge_id: string;
          created_at: string;
          details: Json;
          first_detected_at: string;
          gateway_status: string | null;
          id: string;
          issue_code: string;
          last_detected_at: string;
          local_status: string;
          resolution_note: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          severity: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          attempt_count?: number;
          charge_id: string;
          created_at?: string;
          details?: Json;
          first_detected_at?: string;
          gateway_status?: string | null;
          id?: string;
          issue_code: string;
          last_detected_at?: string;
          local_status: string;
          resolution_note?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          severity?: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          attempt_count?: number;
          charge_id?: string;
          created_at?: string;
          details?: Json;
          first_detected_at?: string;
          gateway_status?: string | null;
          id?: string;
          issue_code?: string;
          last_detected_at?: string;
          local_status?: string;
          resolution_note?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          severity?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      financial_reconciliation_runs: {
        Row: {
          completed_at: string | null;
          created_at: string;
          error_code: string | null;
          expired_count: number;
          id: string;
          issue_count: number;
          recovered_count: number;
          scanned_count: number;
          source: string;
          started_at: string;
          status: string;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          error_code?: string | null;
          expired_count?: number;
          id?: string;
          issue_count?: number;
          recovered_count?: number;
          scanned_count?: number;
          source: string;
          started_at?: string;
          status: string;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          error_code?: string | null;
          expired_count?: number;
          id?: string;
          issue_count?: number;
          recovered_count?: number;
          scanned_count?: number;
          source?: string;
          started_at?: string;
          status?: string;
        };
        Relationships: [];
      };
      operational_alerts: {
        Row: {
          acknowledged_at: string | null;
          acknowledged_by: string | null;
          created_at: string;
          event_id: string;
          id: string;
          resolution_note: string | null;
          resolved_at: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          acknowledged_at?: string | null;
          acknowledged_by?: string | null;
          created_at?: string;
          event_id: string;
          id?: string;
          resolution_note?: string | null;
          resolved_at?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          acknowledged_at?: string | null;
          acknowledged_by?: string | null;
          created_at?: string;
          event_id?: string;
          id?: string;
          resolution_note?: string | null;
          resolved_at?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      operational_events: {
        Row: {
          anonymous_id_hash: string | null;
          created_at: string;
          device_family: string | null;
          event_kind: string;
          event_name: string;
          fingerprint: string | null;
          id: string;
          metadata: Json;
          route: string | null;
          severity: string;
          user_id: string | null;
        };
        Insert: {
          anonymous_id_hash?: string | null;
          created_at?: string;
          device_family?: string | null;
          event_kind: string;
          event_name: string;
          fingerprint?: string | null;
          id?: string;
          metadata?: Json;
          route?: string | null;
          severity?: string;
          user_id?: string | null;
        };
        Update: {
          anonymous_id_hash?: string | null;
          created_at?: string;
          device_family?: string | null;
          event_kind?: string;
          event_name?: string;
          fingerprint?: string | null;
          id?: string;
          metadata?: Json;
          route?: string | null;
          severity?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      pix_charges: {
        Row: {
          amount_cents: number;
          created_at: string;
          expires_at: string | null;
          external_id: string;
          gateway_transaction_id: string | null;
          id: string;
          metadata: Json;
          paid_at: string | null;
          payee_id: string;
          payer_id: string;
          purpose: Database["public"]["Enums"]["pix_charge_purpose"];
          qr_code: string | null;
          qr_code_base64: string | null;
          reference_id: string | null;
          status: Database["public"]["Enums"]["pix_charge_status"];
          updated_at: string;
        };
        Insert: {
          amount_cents: number;
          created_at?: string;
          expires_at?: string | null;
          external_id: string;
          gateway_transaction_id?: string | null;
          id?: string;
          metadata?: Json;
          paid_at?: string | null;
          payee_id: string;
          payer_id: string;
          purpose: Database["public"]["Enums"]["pix_charge_purpose"];
          qr_code?: string | null;
          qr_code_base64?: string | null;
          reference_id?: string | null;
          status?: Database["public"]["Enums"]["pix_charge_status"];
          updated_at?: string;
        };
        Update: {
          amount_cents?: number;
          created_at?: string;
          expires_at?: string | null;
          external_id?: string;
          gateway_transaction_id?: string | null;
          id?: string;
          metadata?: Json;
          paid_at?: string | null;
          payee_id?: string;
          payer_id?: string;
          purpose?: Database["public"]["Enums"]["pix_charge_purpose"];
          qr_code?: string | null;
          qr_code_base64?: string | null;
          reference_id?: string | null;
          status?: Database["public"]["Enums"]["pix_charge_status"];
          updated_at?: string;
        };
        Relationships: [];
      };
      platform_settings: {
        Row: {
          hold_days: number;
          id: number;
          min_withdrawal_cents: number;
          platform_fee_pct: number;
          updated_at: string;
        };
        Insert: {
          hold_days?: number;
          id?: number;
          min_withdrawal_cents?: number;
          platform_fee_pct?: number;
          updated_at?: string;
        };
        Update: {
          hold_days?: number;
          id?: number;
          min_withdrawal_cents?: number;
          platform_fee_pct?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      post_goal_contributions: {
        Row: {
          amount_cents: number;
          created_at: string;
          id: string;
          pix_charge_id: string | null;
          post_id: string;
          user_id: string;
        };
        Insert: {
          amount_cents: number;
          created_at?: string;
          id?: string;
          pix_charge_id?: string | null;
          post_id: string;
          user_id: string;
        };
        Update: {
          amount_cents?: number;
          created_at?: string;
          id?: string;
          pix_charge_id?: string | null;
          post_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "post_goal_contributions_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
        ];
      };
      post_goals: {
        Row: {
          created_at: string;
          id: string;
          is_unlocked: boolean;
          post_id: string;
          raised_cents: number;
          target_cents: number;
          unlock_price_cents: number;
          unlocked_at: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_unlocked?: boolean;
          post_id: string;
          raised_cents?: number;
          target_cents: number;
          unlock_price_cents: number;
          unlocked_at?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_unlocked?: boolean;
          post_id?: string;
          raised_cents?: number;
          target_cents?: number;
          unlock_price_cents?: number;
          unlocked_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "post_goals_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: true;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
        ];
      };
      post_comments: {
        Row: {
          body: string;
          created_at: string;
          id: string;
          mentioned_user_ids: string[];
          parent_comment_id: string | null;
          post_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          body: string;
          created_at?: string;
          id?: string;
          mentioned_user_ids?: string[];
          parent_comment_id?: string | null;
          post_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          id?: string;
          mentioned_user_ids?: string[];
          parent_comment_id?: string | null;
          post_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "post_comments_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "post_comments_parent_comment_id_fkey";
            columns: ["parent_comment_id"];
            isOneToOne: false;
            referencedRelation: "post_comments";
            referencedColumns: ["id"];
          },
        ];
      };
      post_likes: {
        Row: {
          created_at: string;
          id: string;
          post_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          post_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          post_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
        ];
      };
      post_media: {
        Row: {
          cover_storage_path: string | null;
          created_at: string;
          id: string;
          mime_type: string;
          position: number;
          post_id: string;
          storage_path: string;
        };
        Insert: {
          cover_storage_path?: string | null;
          created_at?: string;
          id?: string;
          mime_type: string;
          position?: number;
          post_id: string;
          storage_path: string;
        };
        Update: {
          cover_storage_path?: string | null;
          created_at?: string;
          id?: string;
          mime_type?: string;
          position?: number;
          post_id?: string;
          storage_path?: string;
        };
        Relationships: [
          {
            foreignKeyName: "post_media_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
        ];
      };
      posts: {
        Row: {
          body: string | null;
          comments_count: number;
          created_at: string;
          creator_id: string;
          id: string;
          likes_count: number;
          price_cents: number;
          unlocks_count: number;
          updated_at: string;
          visibility: Database["public"]["Enums"]["post_visibility"];
        };
        Insert: {
          body?: string | null;
          comments_count?: number;
          created_at?: string;
          creator_id: string;
          id?: string;
          likes_count?: number;
          price_cents?: number;
          unlocks_count?: number;
          updated_at?: string;
          visibility?: Database["public"]["Enums"]["post_visibility"];
        };
        Update: {
          body?: string | null;
          comments_count?: number;
          created_at?: string;
          creator_id?: string;
          id?: string;
          likes_count?: number;
          price_cents?: number;
          unlocks_count?: number;
          updated_at?: string;
          visibility?: Database["public"]["Enums"]["post_visibility"];
        };
        Relationships: [];
      };
      ppv_unlocks: {
        Row: {
          amount_cents: number;
          created_at: string;
          id: string;
          post_id: string;
          user_id: string;
        };
        Insert: {
          amount_cents: number;
          created_at?: string;
          id?: string;
          post_id: string;
          user_id: string;
        };
        Update: {
          amount_cents?: number;
          created_at?: string;
          id?: string;
          post_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ppv_unlocks_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
        ];
      };
      privacy_requests: {
        Row: {
          admin_notes: string | null;
          completed_at: string | null;
          created_at: string;
          download_expires_at: string | null;
          download_path: string | null;
          id: string;
          protocol: string;
          request_type: string;
          retention_exceptions: Json;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: string;
          updated_at: string;
          user_id: string;
          user_note: string | null;
        };
        Insert: {
          admin_notes?: string | null;
          completed_at?: string | null;
          created_at?: string;
          download_expires_at?: string | null;
          download_path?: string | null;
          id?: string;
          protocol?: string;
          request_type: string;
          retention_exceptions?: Json;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: string;
          updated_at?: string;
          user_id: string;
          user_note?: string | null;
        };
        Update: {
          admin_notes?: string | null;
          completed_at?: string | null;
          created_at?: string;
          download_expires_at?: string | null;
          download_path?: string | null;
          id?: string;
          protocol?: string;
          request_type?: string;
          retention_exceptions?: Json;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: string;
          updated_at?: string;
          user_id?: string;
          user_note?: string | null;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          bio: string | null;
          cover_url: string | null;
          created_at: string;
          display_name: string | null;
          id: string;
          is_verified: boolean;
          language: string;
          links: Json | null;
          location: string | null;
          subscription_price_cents: number | null;
          trial_days: number;
          trial_days_enabled: boolean;
          updated_at: string;
          user_id: string;
          username: string;
          watermark_opacity: number;
          watermark_position: string;
        };
        Insert: {
          avatar_url?: string | null;
          bio?: string | null;
          cover_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          id?: string;
          is_verified?: boolean;
          language?: string;
          links?: Json | null;
          location?: string | null;
          subscription_price_cents?: number | null;
          trial_days?: number;
          trial_days_enabled?: boolean;
          updated_at?: string;
          user_id: string;
          username: string;
          watermark_opacity?: number;
          watermark_position?: string;
        };
        Update: {
          avatar_url?: string | null;
          bio?: string | null;
          cover_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          id?: string;
          is_verified?: boolean;
          language?: string;
          links?: Json | null;
          location?: string | null;
          subscription_price_cents?: number | null;
          trial_days?: number;
          trial_days_enabled?: boolean;
          updated_at?: string;
          user_id?: string;
          username?: string;
          watermark_opacity?: number;
          watermark_position?: string;
        };
        Relationships: [];
      };
      security_settings: {
        Row: {
          backup_codes_hash: string[] | null;
          mfa_enabled: boolean;
          mfa_required_for_withdraw: boolean;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          backup_codes_hash?: string[] | null;
          mfa_enabled?: boolean;
          mfa_required_for_withdraw?: boolean;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          backup_codes_hash?: string[] | null;
          mfa_enabled?: boolean;
          mfa_required_for_withdraw?: boolean;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      stories: {
        Row: {
          created_at: string;
          creator_id: string;
          expires_at: string;
          id: string;
          media_path: string;
          mime_type: string;
          views_count: number;
          visibility: Database["public"]["Enums"]["story_visibility"];
        };
        Insert: {
          created_at?: string;
          creator_id: string;
          expires_at?: string;
          id?: string;
          media_path: string;
          mime_type: string;
          views_count?: number;
          visibility?: Database["public"]["Enums"]["story_visibility"];
        };
        Update: {
          created_at?: string;
          creator_id?: string;
          expires_at?: string;
          id?: string;
          media_path?: string;
          mime_type?: string;
          views_count?: number;
          visibility?: Database["public"]["Enums"]["story_visibility"];
        };
        Relationships: [];
      };
      story_views: {
        Row: {
          story_id: string;
          viewed_at: string;
          viewer_id: string;
        };
        Insert: {
          story_id: string;
          viewed_at?: string;
          viewer_id: string;
        };
        Update: {
          story_id?: string;
          viewed_at?: string;
          viewer_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "story_views_story_id_fkey";
            columns: ["story_id"];
            isOneToOne: false;
            referencedRelation: "stories";
            referencedColumns: ["id"];
          },
        ];
      };
      subscriber_tags: {
        Row: {
          color: string;
          created_at: string;
          creator_id: string;
          description: string | null;
          id: string;
          name: string;
        };
        Insert: {
          color?: string;
          created_at?: string;
          creator_id: string;
          description?: string | null;
          id?: string;
          name: string;
        };
        Update: {
          color?: string;
          created_at?: string;
          creator_id?: string;
          description?: string | null;
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      support_requests: {
        Row: {
          admin_notes: string | null;
          assigned_to: string | null;
          category: string;
          created_at: string;
          id: string;
          message: string;
          priority: string;
          protocol: string;
          resolved_at: string | null;
          status: string;
          subject: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          admin_notes?: string | null;
          assigned_to?: string | null;
          category: string;
          created_at?: string;
          id?: string;
          message: string;
          priority?: string;
          protocol?: string;
          resolved_at?: string | null;
          status?: string;
          subject: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          admin_notes?: string | null;
          assigned_to?: string | null;
          category?: string;
          created_at?: string;
          id?: string;
          message?: string;
          priority?: string;
          protocol?: string;
          resolved_at?: string | null;
          status?: string;
          subject?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      subscription_coupons: {
        Row: {
          code: string;
          created_at: string;
          creator_id: string;
          discount_pct: number | null;
          duration_months: number;
          id: string;
          is_active: boolean;
          max_uses: number;
          trial_days: number | null;
          uses_count: number;
        };
        Insert: {
          code: string;
          created_at?: string;
          creator_id: string;
          discount_pct?: number | null;
          duration_months?: number;
          id?: string;
          is_active?: boolean;
          max_uses?: number;
          trial_days?: number | null;
          uses_count?: number;
        };
        Update: {
          code?: string;
          created_at?: string;
          creator_id?: string;
          discount_pct?: number | null;
          duration_months?: number;
          id?: string;
          is_active?: boolean;
          max_uses?: number;
          trial_days?: number | null;
          uses_count?: number;
        };
        Relationships: [];
      };
      subscription_plans: {
        Row: {
          created_at: string;
          creator_id: string;
          discount_pct: number;
          id: string;
          is_active: boolean;
          months: number;
          price_cents: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          creator_id: string;
          discount_pct?: number;
          id?: string;
          is_active?: boolean;
          months: number;
          price_cents: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          creator_id?: string;
          discount_pct?: number;
          id?: string;
          is_active?: boolean;
          months?: number;
          price_cents?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      subscription_trials_used: {
        Row: {
          creator_id: string;
          used_at: string;
          user_id: string;
        };
        Insert: {
          creator_id: string;
          used_at?: string;
          user_id: string;
        };
        Update: {
          creator_id?: string;
          used_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      safety_incident_evidence: {
        Row: {
          chain_of_custody: Json;
          created_at: string;
          id: string;
          legal_hold: boolean;
          preserved_at: string;
          report_id: string;
          retention_until: string;
          snapshot: Json;
          target_id: string;
          target_type: string;
        };
        Insert: {
          chain_of_custody?: Json;
          created_at?: string;
          id?: string;
          legal_hold?: boolean;
          preserved_at?: string;
          report_id: string;
          retention_until?: string;
          snapshot?: Json;
          target_id: string;
          target_type: string;
        };
        Update: {
          chain_of_custody?: Json;
          created_at?: string;
          id?: string;
          legal_hold?: boolean;
          preserved_at?: string;
          report_id?: string;
          retention_until?: string;
          snapshot?: Json;
          target_id?: string;
          target_type?: string;
        };
        Relationships: [];
      };
      subscription_renewal_reminders: {
        Row: {
          days_before: number;
          id: string;
          period_end: string;
          sent_at: string;
          subscriber_id: string;
          subscription_id: string;
        };
        Insert: {
          days_before: number;
          id?: string;
          period_end: string;
          sent_at?: string;
          subscriber_id: string;
          subscription_id: string;
        };
        Update: {
          days_before?: number;
          id?: string;
          period_end?: string;
          sent_at?: string;
          subscriber_id?: string;
          subscription_id?: string;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean;
          cancel_requested_at: string | null;
          cancellation_reason: string | null;
          created_at: string;
          creator_id: string;
          current_period_start: string | null;
          current_period_end: string | null;
          id: string;
          is_trial: boolean;
          months: number | null;
          plan_id: string | null;
          price_cents: number;
          status: Database["public"]["Enums"]["subscription_status"];
          subscriber_id: string;
          updated_at: string;
        };
        Insert: {
          cancel_at_period_end?: boolean;
          cancel_requested_at?: string | null;
          cancellation_reason?: string | null;
          created_at?: string;
          creator_id: string;
          current_period_start?: string | null;
          current_period_end?: string | null;
          id?: string;
          is_trial?: boolean;
          months?: number | null;
          plan_id?: string | null;
          price_cents: number;
          status?: Database["public"]["Enums"]["subscription_status"];
          subscriber_id: string;
          updated_at?: string;
        };
        Update: {
          cancel_at_period_end?: boolean;
          cancel_requested_at?: string | null;
          cancellation_reason?: string | null;
          created_at?: string;
          creator_id?: string;
          current_period_start?: string | null;
          current_period_end?: string | null;
          id?: string;
          is_trial?: boolean;
          months?: number | null;
          plan_id?: string | null;
          price_cents?: number;
          status?: Database["public"]["Enums"]["subscription_status"];
          subscriber_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      transactions: {
        Row: {
          amount_cents: number;
          created_at: string;
          gateway: string | null;
          gateway_ref: string | null;
          id: string;
          idempotency_key: string | null;
          metadata: Json | null;
          payee_id: string | null;
          payer_id: string | null;
          reference_id: string | null;
          status: Database["public"]["Enums"]["tx_status"];
          type: Database["public"]["Enums"]["tx_type"];
          updated_at: string;
        };
        Insert: {
          amount_cents: number;
          created_at?: string;
          gateway?: string | null;
          gateway_ref?: string | null;
          id?: string;
          idempotency_key?: string | null;
          metadata?: Json | null;
          payee_id?: string | null;
          payer_id?: string | null;
          reference_id?: string | null;
          status?: Database["public"]["Enums"]["tx_status"];
          type: Database["public"]["Enums"]["tx_type"];
          updated_at?: string;
        };
        Update: {
          amount_cents?: number;
          created_at?: string;
          gateway?: string | null;
          gateway_ref?: string | null;
          id?: string;
          idempotency_key?: string | null;
          metadata?: Json | null;
          payee_id?: string | null;
          payer_id?: string | null;
          reference_id?: string | null;
          status?: Database["public"]["Enums"]["tx_status"];
          type?: Database["public"]["Enums"]["tx_type"];
          updated_at?: string;
        };
        Relationships: [];
      };
      upsell_offers: {
        Row: {
          created_at: string;
          creator_id: string;
          description: string | null;
          id: string;
          is_active: boolean;
          kind: Database["public"]["Enums"]["upsell_offer_kind"];
          media_post_id: string | null;
          position: number;
          price_cents: number;
          title: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          creator_id: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          kind: Database["public"]["Enums"]["upsell_offer_kind"];
          media_post_id?: string | null;
          position?: number;
          price_cents: number;
          title: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          creator_id?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          kind?: Database["public"]["Enums"]["upsell_offer_kind"];
          media_post_id?: string | null;
          position?: number;
          price_cents?: number;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      upsell_purchases: {
        Row: {
          amount_cents: number;
          buyer_id: string;
          created_at: string;
          creator_id: string;
          id: string;
          offer_id: string;
          origin: string;
          paid_at: string | null;
          parent_charge_id: string | null;
          pix_charge_id: string | null;
          status: string;
        };
        Insert: {
          amount_cents: number;
          buyer_id: string;
          created_at?: string;
          creator_id: string;
          id?: string;
          offer_id: string;
          origin: string;
          paid_at?: string | null;
          parent_charge_id?: string | null;
          pix_charge_id?: string | null;
          status?: string;
        };
        Update: {
          amount_cents?: number;
          buyer_id?: string;
          created_at?: string;
          creator_id?: string;
          id?: string;
          offer_id?: string;
          origin?: string;
          paid_at?: string | null;
          parent_charge_id?: string | null;
          pix_charge_id?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "upsell_purchases_offer_id_fkey";
            columns: ["offer_id"];
            isOneToOne: false;
            referencedRelation: "upsell_offers";
            referencedColumns: ["id"];
          },
        ];
      };
      user_blocks: {
        Row: {
          blocked_id: string;
          blocker_id: string;
          created_at: string;
        };
        Insert: {
          blocked_id: string;
          blocker_id: string;
          created_at?: string;
        };
        Update: {
          blocked_id?: string;
          blocker_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      user_mutes: {
        Row: {
          created_at: string;
          muted_user_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          muted_user_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          muted_user_id?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_consents: {
        Row: {
          accepted_at: string;
          consent_type: string;
          created_at: string;
          document_version: string;
          evidence: Json;
          id: string;
          ip_address: unknown | null;
          user_agent_hash: string | null;
          user_id: string;
        };
        Insert: {
          accepted_at?: string;
          consent_type: string;
          created_at?: string;
          document_version: string;
          evidence?: Json;
          id?: string;
          ip_address?: unknown | null;
          user_agent_hash?: string | null;
          user_id: string;
        };
        Update: {
          accepted_at?: string;
          consent_type?: string;
          created_at?: string;
          document_version?: string;
          evidence?: Json;
          id?: string;
          ip_address?: unknown | null;
          user_agent_hash?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      user_tag_assignments: {
        Row: {
          assigned_at: string;
          creator_id: string;
          tag_id: string;
          user_id: string;
        };
        Insert: {
          assigned_at?: string;
          creator_id: string;
          tag_id: string;
          user_id: string;
        };
        Update: {
          assigned_at?: string;
          creator_id?: string;
          tag_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_tag_assignments_tag_id_fkey";
            columns: ["tag_id"];
            isOneToOne: false;
            referencedRelation: "subscriber_tags";
            referencedColumns: ["id"];
          },
        ];
      };
      wishlists: {
        Row: {
          created_at: string;
          id: string;
          target_id: string;
          target_type: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          target_id: string;
          target_type: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          target_id?: string;
          target_type?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      withdrawal_requests: {
        Row: {
          admin_notes: string | null;
          amount_cents: number;
          created_at: string;
          creator_id: string;
          holder_document: string;
          holder_name: string;
          id: string;
          paid_at: string | null;
          pix_key: string;
          pix_key_type: Database["public"]["Enums"]["pix_key_type"];
          receipt_url: string | null;
          rejection_reason: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: Database["public"]["Enums"]["withdrawal_status"];
          updated_at: string;
        };
        Insert: {
          admin_notes?: string | null;
          amount_cents: number;
          created_at?: string;
          creator_id: string;
          holder_document: string;
          holder_name: string;
          id?: string;
          paid_at?: string | null;
          pix_key: string;
          pix_key_type: Database["public"]["Enums"]["pix_key_type"];
          receipt_url?: string | null;
          rejection_reason?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: Database["public"]["Enums"]["withdrawal_status"];
          updated_at?: string;
        };
        Update: {
          admin_notes?: string | null;
          amount_cents?: number;
          created_at?: string;
          creator_id?: string;
          holder_document?: string;
          holder_name?: string;
          id?: string;
          paid_at?: string | null;
          pix_key?: string;
          pix_key_type?: Database["public"]["Enums"]["pix_key_type"];
          receipt_url?: string | null;
          rejection_reason?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: Database["public"]["Enums"]["withdrawal_status"];
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      creator_balances: {
        Row: {
          available_cents: number | null;
          creator_id: string | null;
          gross_lifetime_cents: number | null;
          in_flight_cents: number | null;
          net_lifetime_cents: number | null;
          pending_cents: number | null;
          total_withdrawn_cents: number | null;
        };
        Relationships: [];
      };
      profiles_public: {
        Row: {
          avatar_url: string | null;
          bio: string | null;
          cover_url: string | null;
          created_at: string | null;
          display_name: string | null;
          is_verified: boolean | null;
          language: string | null;
          links: Json | null;
          location: string | null;
          subscription_price_cents: number | null;
          user_id: string | null;
          username: string | null;
          watermark_opacity: number | null;
          watermark_position: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          bio?: string | null;
          cover_url?: string | null;
          created_at?: string | null;
          display_name?: string | null;
          is_verified?: boolean | null;
          language?: string | null;
          links?: Json | null;
          location?: string | null;
          subscription_price_cents?: number | null;
          user_id?: string | null;
          username?: string | null;
          watermark_opacity?: number | null;
          watermark_position?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          bio?: string | null;
          cover_url?: string | null;
          created_at?: string | null;
          display_name?: string | null;
          is_verified?: boolean | null;
          language?: string | null;
          links?: Json | null;
          location?: string | null;
          subscription_price_cents?: number | null;
          user_id?: string | null;
          username?: string | null;
          watermark_opacity?: number | null;
          watermark_position?: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      award_loyalty_points: {
        Args: {
          _creator_id: string;
          _delta: number;
          _reason: string;
          _ref_id?: string;
          _user_id: string;
        };
        Returns: undefined;
      };
      activate_coupon_trial: {
        Args: {
          _coupon_id: string;
          _creator_id: string;
          _subscriber_id: string;
        };
        Returns: Json;
      };
      calc_loyalty_tier: { Args: { _points: number }; Returns: string };
      can_view_post: {
        Args: { _post_id: string; _viewer_id: string };
        Returns: boolean;
      };
      can_view_story_path: {
        Args: { _path: string; _viewer: string };
        Returns: boolean;
      };
      cleanup_expired_stories: {
        Args: never;
        Returns: {
          deleted_paths: string[];
        }[];
      };
      create_account_recovery_request: {
        Args: {
          _contact_email: string;
          _details: string;
          _issue_type: string;
          _login_email: string;
          _request_ip_hash: string;
        };
        Returns: string;
      };
      creator_onboarding_status: {
        Args: { _user_id: string };
        Returns: {
          consent_complete: boolean;
          first_post_created: boolean;
          kyc_approved: boolean;
          monetization_ready: boolean;
          payout_key_configured: boolean;
          price_configured: boolean;
          profile_complete: boolean;
        }[];
      };
      assert_creator_monetization_ready: {
        Args: { _creator_id: string };
        Returns: undefined;
      };
      fulfill_symbolic_gift: {
        Args: {
          _amount_cents: number;
          _charge_id: string;
          _creator_id: string;
          _item_id: string;
          _message?: string | null;
          _supporter_id: string;
        };
        Returns: boolean;
      };
      record_creator_consents: {
        Args: {
          _creator_policy_version: string;
          _ip_address?: string | null;
          _privacy_version: string;
          _source?: string;
          _terms_version: string;
          _user_agent_hash?: string | null;
          _user_id: string;
        };
        Returns: number;
      };
      submit_creator_kyc_with_consent: {
        Args: {
          _creator_policy_version: string;
          _document_back_url: string | null;
          _document_front_url: string;
          _document_type: string;
          _ip_address?: string | null;
          _privacy_version: string;
          _selfie_url: string;
          _terms_version: string;
          _user_agent_hash?: string | null;
          _user_id: string;
        };
        Returns: string;
      };
      enqueue_mass_dm: {
        Args: {
          _body: string;
          _filter_hours: number;
          _filter_link_clicked: boolean;
          _media_path: string;
          _mime_type: string;
          _ppv_price_cents: number;
          _scheduled_at: string;
          _segment: Database["public"]["Enums"]["mass_dm_segment"];
          _tag_id: string;
          _template_id: string;
        };
        Returns: {
          campaign_id: string;
          recipients: number;
        }[];
      };
      expire_due_subscriptions: {
        Args: never;
        Returns: {
          expired_count: number;
        }[];
      };
      dispatch_subscription_renewal_reminders: {
        Args: never;
        Returns: number;
      };
      report_financial_reconciliation_issue: {
        Args: {
          _charge_id: string;
          _details?: Json;
          _gateway_status: string | null;
          _issue_code: string;
          _local_status: string;
          _severity: string;
        };
        Returns: string;
      };
      record_operational_event: {
        Args: {
          _anonymous_id_hash: string | null;
          _device_family: string | null;
          _event_kind: string;
          _event_name: string;
          _fingerprint: string | null;
          _metadata: Json;
          _route: string | null;
          _severity: string;
          _user_id: string | null;
        };
        Returns: string;
      };
      review_safety_report: {
        Args: {
          _note?: string | null;
          _report_id: string;
          _reviewer_id: string;
          _status: string;
        };
        Returns: boolean;
      };
      resolve_financial_reconciliation_issues_for_charge: {
        Args: { _charge_id: string; _note?: string };
        Returns: number;
      };
      get_platform_fee_pct: { Args: never; Returns: number };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      fulfill_subscription_payment: {
        Args: {
          _amount_cents: number;
          _charge_id: string;
          _coupon_id: string | null;
          _creator_id: string;
          _gateway_ref: string;
          _is_trial: boolean;
          _months: number;
          _subscriber_id: string;
          _trial_days: number;
        };
        Returns: string;
      };
      schedule_my_subscription_cancellation: {
        Args: { _reason?: string | null; _subscription_id: string };
        Returns: Json;
      };
      undo_my_subscription_cancellation: {
        Args: { _subscription_id: string };
        Returns: Json;
      };
      reconcile_pix_refund: {
        Args: {
          _amount_cents: number;
          _charge_id: string;
          _gateway_reference: string;
          _refunded_at: string;
        };
        Returns: Json;
      };
      is_age_verified: {
        Args: { _user_id: string };
        Returns: boolean;
      };
      users_are_blocked: {
        Args: { _user_a: string; _user_b: string };
        Returns: boolean;
      };
      list_feed_posts: {
        Args: { _creator_id?: string; _limit?: number; _viewer_id?: string };
        Returns: {
          body: string;
          comments_count: number;
          created_at: string;
          creator_id: string;
          has_access: boolean;
          id: string;
          likes_count: number;
          media_id: string;
          media_mime: string;
          media_path: string;
          price_cents: number;
          visibility: Database["public"]["Enums"]["post_visibility"];
        }[];
      };
      list_thread_messages: {
        Args: { _thread_id: string };
        Returns: {
          body: string;
          campaign_id: string;
          created_at: string;
          id: string;
          media_path: string;
          mime_type: string;
          ppv_price_cents: number;
          read_at: string;
          sender_id: string;
          subscribers_only: boolean;
          thread_id: string;
          unlocked: boolean;
        }[];
      };
      list_thread_messages_verified: {
        Args: { _thread_id: string };
        Returns: {
          body: string;
          campaign_id: string;
          created_at: string;
          id: string;
          media_path: string;
          mime_type: string;
          ppv_price_cents: number;
          read_at: string;
          sender_id: string;
          subscribers_only: boolean;
          thread_id: string;
          unlocked: boolean;
        }[];
      };
      lookup_affiliate_code: {
        Args: { _code: string };
        Returns: {
          commission_pct: number;
          user_id: string;
        }[];
      };
      mass_dm_campaign_revenue: {
        Args: { _creator_id: string };
        Returns: {
          campaign_id: string;
          revenue_cents: number;
          unlocks_count: number;
        }[];
      };
      mass_send_dm: {
        Args: {
          _body: string;
          _media_path: string;
          _mime_type: string;
          _ppv_price_cents: number;
          _segment: Database["public"]["Enums"]["mass_dm_segment"];
          _tag_id: string;
        };
        Returns: {
          campaign_id: string;
          sent: number;
        }[];
      };
      preview_mass_dm_recipients: {
        Args: {
          _filter_hours: number;
          _filter_link_clicked: boolean;
          _segment: Database["public"]["Enums"]["mass_dm_segment"];
          _tag_id: string;
        };
        Returns: {
          display_name: string;
          has_thread: boolean;
          is_active_sub: boolean;
          is_expired_sub: boolean;
          last_chat_at: string;
          tags: string[];
          user_id: string;
          username: string;
        }[];
      };
      process_mass_dm_batch: {
        Args: { _limit?: number };
        Returns: {
          failed: number;
          processed: number;
          sent: number;
        }[];
      };
      start_creator_trial: {
        Args: { _creator_id: string; _subscriber_id: string };
        Returns: Json;
      };
      create_withdrawal_request: {
        Args: { _amount_cents: number; _creator_id: string };
        Returns: string;
      };
      storage_path_to_post_id: { Args: { _path: string }; Returns: string };
      subscriptions_expiring_in: {
        Args: { _days?: number };
        Returns: {
          creator_id: string;
          current_period_end: string;
          id: string;
          subscriber_id: string;
        }[];
      };
      validate_coupon: {
        Args: { _code: string; _creator_id: string };
        Returns: {
          discount_pct: number;
          duration_months: number;
          id: string;
          trial_days: number;
        }[];
      };
    };
    Enums: {
      app_role: "subscriber" | "creator" | "admin" | "ambassador" | "seller";
      dmca_status: "pending" | "notified" | "resolved" | "rejected";
      kyc_status: "pending" | "approved" | "rejected";
      mass_dm_job_status: "pending" | "processing" | "sent" | "failed" | "cancelled";
      mass_dm_segment:
        "active_subscribers" | "expired_subscribers" | "non_subscribers" | "all_contacts" | "tag";
      pix_charge_purpose: "subscription" | "ppv" | "tip" | "goal" | "chat_ppv" | "upsell";
      pix_charge_status: "pending" | "processing" | "paid" | "expired" | "cancelled" | "refunded";
      pix_key_type: "cpf" | "cnpj" | "email" | "phone" | "random";
      post_visibility: "public" | "subscribers" | "ppv" | "goal";
      story_visibility: "public" | "subscribers";
      subscription_status: "active" | "canceled" | "expired";
      tx_status: "pending" | "paid" | "failed" | "refunded";
      tx_type: "ppv" | "subscription" | "tip" | "withdrawal" | "affiliate_commission" | "chat_ppv";
      upsell_offer_kind: "order_bump" | "post_purchase_upsell";
      withdrawal_status: "pending" | "approved" | "processing" | "paid" | "rejected" | "canceled";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["subscriber", "creator", "admin", "ambassador", "seller"],
      dmca_status: ["pending", "notified", "resolved", "rejected"],
      kyc_status: ["pending", "approved", "rejected"],
      mass_dm_job_status: ["pending", "processing", "sent", "failed", "cancelled"],
      mass_dm_segment: [
        "active_subscribers",
        "expired_subscribers",
        "non_subscribers",
        "all_contacts",
        "tag",
      ],
      pix_charge_purpose: ["subscription", "ppv", "tip", "goal", "chat_ppv", "upsell"],
      pix_charge_status: ["pending", "paid", "expired", "cancelled", "refunded"],
      pix_key_type: ["cpf", "cnpj", "email", "phone", "random"],
      post_visibility: ["public", "subscribers", "ppv", "goal"],
      story_visibility: ["public", "subscribers"],
      subscription_status: ["active", "canceled", "expired"],
      tx_status: ["pending", "paid", "failed", "refunded"],
      tx_type: ["ppv", "subscription", "tip", "withdrawal", "affiliate_commission", "chat_ppv"],
      upsell_offer_kind: ["order_bump", "post_purchase_upsell"],
      withdrawal_status: ["pending", "approved", "processing", "paid", "rejected", "canceled"],
    },
  },
} as const;
