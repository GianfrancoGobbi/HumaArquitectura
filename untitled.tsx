export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      Proyectos: {
        Row: {
          id: number;
          created_at: string;
          nombre: string | null;
          map_description: string | null;
          descripcion: string | null;
          coordinates: Json | null;
          media: Json | null;
        };
        Insert: {
          id?: number;
          created_at?: string;
          nombre: string;
          map_description?: string | null;
          descripcion?: string | null;
          coordinates?: Json | null;
          media?: Json | null;
        };
        Update: {
          id?: number;
          created_at?: string;
          nombre?: string;
          map_description?: string | null;
          descripcion?: string | null;
          coordinates?: Json | null;
          media?: Json | null;
        };
      };
    };
    Views: { [_key: string]: never };
    Functions: { [_key: string]: never };
  };
}
