export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      documents: {
        Row: {
          id: string;
          workspace_id: string;
          created_by: string | null;
          title: string;
          content: Json | null;
          content_plain: string | null;
          embedding: string | null;
          embedding_model_version: string | null;
          detected_language: string | null;
          metadata: Json | null;
          updated_at: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["documents"]["Row"]> & {
          workspace_id: string;
          title?: string;
        };
        Update: Partial<Database["public"]["Tables"]["documents"]["Row"]>;
      };
      workspaces: {
        Row: {
          id: string;
          name: string;
          is_team_workspace: boolean | null;
          created_at: string;
        };
        Insert: {
          name: string;
          is_team_workspace?: boolean | null;
        };
        Update: Partial<Database["public"]["Tables"]["workspaces"]["Row"]>;
      };
      workspace_members: {
        Row: {
          id: string;
          workspace_id: string;
          user_id: string;
          role: string | null;
          created_at: string;
        };
        Insert: {
          workspace_id: string;
          user_id: string;
          role?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["workspace_members"]["Row"]>;
      };
      templates: {
        Row: {
          id: string;
          workspace_id: string | null;
          created_by: string | null;
          name: string;
          description: string | null;
          structure_json: Json;
          metadata: Json | null;
          is_system: boolean | null;
          is_shared: boolean | null;
          created_at: string;
        };
        Insert: {
          name: string;
          structure_json: Json;
          workspace_id?: string | null;
          description?: string | null;
          metadata?: Json | null;
          is_system?: boolean | null;
          is_shared?: boolean | null;
        };
        Update: Partial<Database["public"]["Tables"]["templates"]["Row"]>;
      };
      library_sources: {
        Row: {
          id: string;
          workspace_id: string;
          uploaded_by: string | null;
          file_name: string;
          file_path: string;
          file_type: string | null;
          summary: string | null;
          detected_language: string | null;
          metadata: Json | null;
          embedding_status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          file_name: string;
          file_path: string;
          uploaded_by?: string | null;
          file_type?: string | null;
          summary?: string | null;
          detected_language?: string | null;
          metadata?: Json | null;
          embedding_status?: string;
        };
        Update: Partial<Database["public"]["Tables"]["library_sources"]["Row"]>;
        Relationships: [];
      };
      library_source_chunks: {
        Row: {
          id: string;
          source_id: string;
          workspace_id: string;
          chunk_index: number;
          page_number: number | null;
          content_chunk: string;
          embedding: string | null;
          embedding_model_version: string | null;
          created_at: string;
        };
        Insert: {
          source_id: string;
          workspace_id: string;
          chunk_index: number;
          content_chunk: string;
          page_number?: number | null;
          embedding?: string | null;
          embedding_model_version?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["library_source_chunks"]["Row"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
    Functions: {
      match_workspace_knowledge: {
        Args: {
          query_embedding: string;
          match_threshold: number;
          match_count: number;
          target_workspace_id: string;
        };
        Returns: {
          origin_type: string;
          item_id: string;
          title: string;
          matched_text: string;
          page_ref: number | null;
          similarity: number;
        }[];
      };
    };
  };
}
