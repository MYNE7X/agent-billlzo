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
      activity_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string | null
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
        }
        Relationships: []
      }
      office_expenses: {
        Row: {
          id: string
          title: string
          category: string
          amount: number
          expense_date: string
          month: string
          description: string | null
          paid_to: string | null
          payment_method: string | null
          receipt_url: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          category?: string
          amount: number
          expense_date: string
          month: string
          description?: string | null
          paid_to?: string | null
          payment_method?: string | null
          receipt_url?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          category?: string
          amount?: number
          expense_date?: string
          month?: string
          description?: string | null
          paid_to?: string | null
          payment_method?: string | null
          receipt_url?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      agent_documents: {
        Row: {
          agent_id: string
          category: string
          created_at: string
          file_name: string
          file_path: string | null
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          updated_at: string
          uploaded_by: string | null
          uploaded_date: string
        }
        Insert: {
          agent_id: string
          category?: string
          created_at?: string
          file_name: string
          file_path?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          updated_at?: string
          uploaded_by?: string | null
          uploaded_date?: string
        }
        Update: {
          agent_id?: string
          category?: string
          created_at?: string
          file_name?: string
          file_path?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          updated_at?: string
          uploaded_by?: string | null
          uploaded_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_documents_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_monthly_sales: {
        Row: {
          id: string
          agent_id: string
          month: string
          amount: number
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          agent_id: string
          month: string
          amount: number
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          agent_id?: string
          month?: string
          amount?: number
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_monthly_sales_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_monthly_reports: {
        Row: {
          id: string
          agent_id: string
          month: string
          base_salary: number
          bonus: number
          deduction: number
          net_salary: number
          total_sales: number
          sales_target: number
          achievement_pct: number
          performance_score: number
          behavior_score: number
          attendance_score: number
          punctuality_score: number
          overall_score: number
          days_present: number
          days_absent: number
          days_late: number
          days_leave: number
          total_hours: number
          headline: string | null
          notes: string | null
          sentiment: "praise" | "improvement" | "warning" | "neutral"
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          agent_id: string
          month: string
          base_salary?: number
          bonus?: number
          deduction?: number
          total_sales?: number
          sales_target?: number
          performance_score?: number
          behavior_score?: number
          attendance_score?: number
          punctuality_score?: number
          days_present?: number
          days_absent?: number
          days_late?: number
          days_leave?: number
          total_hours?: number
          headline?: string | null
          notes?: string | null
          sentiment?: "praise" | "improvement" | "warning" | "neutral"
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          agent_id?: string
          month?: string
          base_salary?: number
          bonus?: number
          deduction?: number
          total_sales?: number
          sales_target?: number
          performance_score?: number
          behavior_score?: number
          attendance_score?: number
          punctuality_score?: number
          days_present?: number
          days_absent?: number
          days_late?: number
          days_leave?: number
          total_hours?: number
          headline?: string | null
          notes?: string | null
          sentiment?: "praise" | "improvement" | "warning" | "neutral"
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_monthly_reports_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agents: {
        Row: {
          account_number: string | null
          account_title: string | null
          assigned_admin_id: string | null
          bank_name: string | null
          blood_group: string | null
          certifications: string | null
          city: string | null
          cnic_back_url: string | null
          cnic_front_url: string | null
          cnic_number: string | null
          country: string | null
          created_at: string
          created_by: string | null
          date_of_birth: string | null
          degree: string | null
          department_id: string | null
          designation_id: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_number: string | null
          employee_id: string
          employee_type: string | null
          father_name: string | null
          full_name: string
          gender: string | null
          highest_qualification: string | null
          home_address: string | null
          iban: string | null
          id: string
          institute_name: string | null
          joining_date: string | null
          languages: string | null
          marital_status: string | null
          notes: string | null
          passport_number: string | null
          passport_url: string | null
          phone_number: string | null
          previous_company: string | null
          previous_experience: string | null
          profile_picture_url: string | null
          province: string | null
          reference_id: string
          salary: number | null
          shift_timing: string | null
          skills: string | null
          status: Database["public"]["Enums"]["agent_status"]
          updated_at: string
          user_id: string | null
          whatsapp_number: string | null
        }
        Insert: {
          account_number?: string | null
          account_title?: string | null
          assigned_admin_id?: string | null
          bank_name?: string | null
          blood_group?: string | null
          certifications?: string | null
          city?: string | null
          cnic_back_url?: string | null
          cnic_front_url?: string | null
          cnic_number?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          degree?: string | null
          department_id?: string | null
          designation_id?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_number?: string | null
          employee_id: string
          employee_type?: string | null
          father_name?: string | null
          full_name: string
          gender?: string | null
          highest_qualification?: string | null
          home_address?: string | null
          iban?: string | null
          id?: string
          institute_name?: string | null
          joining_date?: string | null
          languages?: string | null
          marital_status?: string | null
          notes?: string | null
          passport_number?: string | null
          passport_url?: string | null
          phone_number?: string | null
          previous_company?: string | null
          previous_experience?: string | null
          profile_picture_url?: string | null
          province?: string | null
          reference_id: string
          salary?: number | null
          shift_timing?: string | null
          skills?: string | null
          status?: Database["public"]["Enums"]["agent_status"]
          updated_at?: string
          user_id?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          account_number?: string | null
          account_title?: string | null
          assigned_admin_id?: string | null
          bank_name?: string | null
          blood_group?: string | null
          certifications?: string | null
          city?: string | null
          cnic_back_url?: string | null
          cnic_front_url?: string | null
          cnic_number?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          degree?: string | null
          department_id?: string | null
          designation_id?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_number?: string | null
          employee_id?: string
          employee_type?: string | null
          father_name?: string | null
          full_name?: string
          gender?: string | null
          highest_qualification?: string | null
          home_address?: string | null
          iban?: string | null
          id?: string
          institute_name?: string | null
          joining_date?: string | null
          languages?: string | null
          marital_status?: string | null
          notes?: string | null
          passport_number?: string | null
          passport_url?: string | null
          phone_number?: string | null
          previous_company?: string | null
          previous_experience?: string | null
          profile_picture_url?: string | null
          province?: string | null
          reference_id?: string
          salary?: number | null
          shift_timing?: string | null
          skills?: string | null
          status?: Database["public"]["Enums"]["agent_status"]
          updated_at?: string
          user_id?: string | null
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agents_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agents_designation_id_fkey"
            columns: ["designation_id"]
            isOneToOne: false
            referencedRelation: "designations"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          agent_id: string
          clock_in: string | null
          clock_out: string | null
          created_at: string
          created_by: string | null
          date: string
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["attendance_status"]
          total_hours: number | null
          updated_at: string
        }
        Insert: {
          agent_id: string
          clock_in?: string | null
          clock_out?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          total_hours?: number | null
          updated_at?: string
        }
        Update: {
          agent_id?: string
          clock_in?: string | null
          clock_out?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          total_hours?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      designations: {
        Row: {
          created_at: string
          department_id: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          department_id?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "designations_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_approved: boolean
          must_change_password: boolean
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          is_approved?: boolean
          must_change_password?: boolean
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_approved?: boolean
          must_change_password?: boolean
          phone?: string | null
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
      is_staff: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      agent_status: "active" | "inactive" | "suspended" | "resigned"
      app_role: "super_admin" | "admin" | "agent"
      attendance_status:
        | "present"
        | "absent"
        | "late"
        | "half_day"
        | "leave"
        | "holiday"
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
      agent_status: ["active", "inactive", "suspended", "resigned"],
      app_role: ["super_admin", "admin", "agent"],
      attendance_status: [
        "present",
        "absent",
        "late",
        "half_day",
        "leave",
        "holiday",
      ],
    },
  },
} as const
