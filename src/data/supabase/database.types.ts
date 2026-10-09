export type Json =
  | boolean
  | { [key: string]: Json | undefined }
  | Json[]
  | null
  | number
  | string

export type Database = {
  public: {
    Tables: {
      challenges: {
        Row: {
          challenge_kind: 'personal' | 'group' | null
          created_at: string
          created_by: string
          description: string | null
          end_date: string
          id: string
          name: string
          owner_id: string
          start_date: string
          status: 'draft' | 'active' | 'completed' | 'archived'
          target_weight_kg: number | null
          updated_at: string
        }
        Insert: {
          challenge_kind?: 'personal' | 'group' | null
          created_at?: string
          created_by: string
          description?: string | null
          end_date: string
          id?: string
          name: string
          owner_id: string
          start_date: string
          status?: 'draft' | 'active' | 'completed' | 'archived'
          target_weight_kg?: number | null
          updated_at?: string
        }
        Update: {
          challenge_kind?: 'personal' | 'group' | null
          created_at?: string
          created_by?: string
          description?: string | null
          end_date?: string
          id?: string
          name?: string
          owner_id?: string
          start_date?: string
          status?: 'draft' | 'active' | 'completed' | 'archived'
          target_weight_kg?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      participants: {
        Row: {
          challenge_id: string
          created_at: string
          display_name: string
          id: string
          joined_at: string | null
          starting_weight_kg: number
          status: 'invited' | 'active' | 'completed' | 'withdrawn'
          target_weight_kg: number
          updated_at: string
          user_id: string
        }
        Insert: {
          challenge_id: string
          created_at?: string
          display_name: string
          id?: string
          joined_at?: string | null
          starting_weight_kg: number
          status?: 'invited' | 'active' | 'completed' | 'withdrawn'
          target_weight_kg: number
          updated_at?: string
          user_id: string
        }
        Update: {
          challenge_id?: string
          created_at?: string
          display_name?: string
          id?: string
          joined_at?: string | null
          starting_weight_kg?: number
          status?: 'invited' | 'active' | 'completed' | 'withdrawn'
          target_weight_kg?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      personal_weigh_ins: {
        Row: {
          id: string
          user_id: string
          recorded_date: string
          weight_kg: number
          note: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          recorded_date: string
          weight_kg: number
          note?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          recorded_date?: string
          weight_kg?: number
          note?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      personal_weigh_in_group_shares: {
        Row: {
          personal_weigh_in_id: string
          challenge_id: string
          created_at: string
        }
        Insert: {
          personal_weigh_in_id: string
          challenge_id: string
          created_at?: string
        }
        Update: {
          personal_weigh_in_id?: string
          challenge_id?: string
          created_at?: string
        }
        Relationships: []
      }
      weigh_ins: {
        Row: {
          created_at: string
          id: string
          note: string | null
          participant_id: string
          recorded_date: string
          share_with_group: boolean
          updated_at: string
          weight_kg: number
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          participant_id: string
          recorded_date: string
          share_with_group?: boolean
          updated_at?: string
          weight_kg: number
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          participant_id?: string
          recorded_date?: string
          share_with_group?: boolean
          updated_at?: string
          weight_kg?: number
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      delete_personal_weigh_in: {
        Args: { target_weigh_in_id: string }
        Returns: boolean
      }
      list_my_personal_weigh_ins: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          user_id: string
          recorded_date: string
          weight_kg: number
          note: string | null
          created_at: string
          updated_at: string
          shared_challenge_ids: string[]
        }[]
      }
      save_personal_weigh_in: {
        Args: {
          target_note: string | null
          target_recorded_date: string
          target_shared_challenge_ids: string[]
          target_weigh_in_id: string | null
          target_weight_kg: number
        }
        Returns: {
          id: string
          user_id: string
          recorded_date: string
          weight_kg: number
          note: string | null
          created_at: string
          updated_at: string
          shared_challenge_ids: string[]
        }[]
      }
      accept_challenge_invite: {
        Args: {
          invite_token: string
          participant_display_name: string
          participant_starting_weight_kg: number
          participant_target_weight_kg: number
        }
        Returns: Database['public']['Tables']['participants']['Row']
      }
      create_challenge_invite: {
        Args: {
          target_challenge_id: string
          target_expires_at: string
        }
        Returns: {
          challenge_id: string
          expires_at: string
          invite_id: string
          token: string
        }[]
      }
      get_challenge_progress_summary: {
        Args: { target_challenge_id: string }
        Returns: {
          active_participant_count: number
          challenge_id: string
          latest_recorded_date: string | null
          participants_with_recorded_weight_count: number
          total_weigh_in_count: number
        }[]
      }
      get_group_progress_summary: {
        Args: { target_challenge_id: string; target_current_sunday: string }
        Returns: {
          active_participant_count: number
          average_completion_percentage: number | null
          challenge_id: string
          current_sunday: string
          eligible_participant_count: number
          participants_with_progress_count: number
          participants_with_recorded_weight_count: number
          previous_sunday: string
          reached_target_count: number
          weekly_winner_count: number
          weekly_winner_names: string[]
        }[]
      }
      get_group_weigh_in_history: {
        Args: { target_challenge_id: string }
        Returns: {
          change_since_previous_kg: number | null
          display_name: string
          recorded_date: string
          weight_kg: number
        }[]
      }
      get_group_chart_history: {
        Args: { target_challenge_id: string }
        Returns: {
          member_key: string
          display_name: string
          recorded_date: string
          weight_kg: number
        }[]
      }
      get_provisional_group_leader_summary: {
        Args: { target_challenge_id: string; target_current_date: string }
        Returns: {
          active_participant_count: number
          challenge_id: string
          current_week_end: string
          current_week_start: string
          eligible_participant_count: number
          leader_count: number
          leader_latest_dates: string[]
          leader_names: string[]
          previous_sunday: string
          state: string
        }[]
      }
      list_challenge_invites: {
        Args: { target_challenge_id: string }
        Returns: {
          challenge_id: string
          created_at: string
          expires_at: string
          invite_id: string
          revoked_at: string | null
        }[]
      }
      preview_challenge_invite: {
        Args: { invite_token: string }
        Returns: {
          challenge_id: string
          challenge_name: string
          expires_at: string
          invite_id: string
          revoked_at: string | null
          status: string
        }[]
      }
      revoke_challenge_invite: {
        Args: { target_invite_id: string }
        Returns: boolean
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
