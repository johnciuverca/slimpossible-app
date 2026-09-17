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
      weigh_ins: {
        Row: {
          created_at: string
          id: string
          note: string | null
          participant_id: string
          recorded_date: string
          updated_at: string
          weight_kg: number
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          participant_id: string
          recorded_date: string
          updated_at?: string
          weight_kg: number
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          participant_id?: string
          recorded_date?: string
          updated_at?: string
          weight_kg?: number
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
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
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
