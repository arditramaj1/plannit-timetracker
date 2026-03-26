export type Role = "admin" | "user";

export type User = {
  id: number;
  username: string;
  email: string;
  display_name: string;
  role: Role;
  can_log_parallel_projects: boolean;
  is_staff: boolean;
  is_superuser: boolean;
};

export type Project = {
  id: number;
  code: string;
  name: string;
  description: string;
  color_hex: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type WorkLogEntry = {
  id: number;
  user?: number;
  user_detail: User;
  project: number;
  project_code?: string;
  project_name: string;
  project_color: string;
  work_date: string;
  hour_slot: number;
  duration_minutes: number;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type AuthPayload = {
  access: string;
  refresh: string;
  user: User;
};

export type ReportSummaryRow = {
  total_hours: number;
  [key: string]: string | number | null;
};

export type ReportTimelineRow = {
  period: string;
  total_hours: number;
};

export type ReportResponse = {
  filters: {
    user?: number;
    project?: number;
    date_from: string;
    date_to: string;
    period: "custom" | "week" | "month";
    group_by: "day" | "week" | "month";
  };
  summary: {
    total_hours: number;
    total_entries: number;
    unique_users: number;
    unique_projects: number;
    by_user: ReportSummaryRow[];
    by_project: ReportSummaryRow[];
    timeline: ReportTimelineRow[];
  };
  details: Array<{
    id: number;
    user: {
      id: number;
      username: string;
      display_name: string;
    };
    project: {
      id: number;
      code: string;
      name: string;
      color_hex: string;
    };
    work_date: string;
    hour_slot: number;
    duration_minutes: number;
    notes: string;
    created_at: string;
    updated_at: string;
  }>;
};

export type ReportFilters = {
  user?: number;
  project?: number;
  date_from?: string;
  date_to?: string;
  period?: "custom" | "week" | "month";
  reference_date?: string;
  group_by?: "day" | "week" | "month";
};
