export type Language = "en" | "ar";

export type UserRole = "ADMIN" | "ENGINEER" | "CLIENT_COMPANY" | "QUALITY_CONTROLLER";

export type MaintenanceStatus =
  | "NEW"
  | "UNDER_REVIEW"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "WAITING_SPARE_PARTS"
  | "COMPLETED"
  | "REJECTED"
  | "CLOSED";

export type MaintenanceSpecialty =
  | "ELECTRICITY"
  | "NETWORKS"
  | "HVAC"
  | "PLUMBING"
  | "MEDICAL_DEVICES"
  | "SURVEILLANCE"
  | "SOFTWARE"
  | "SERVERS"
  | "CYBERSECURITY";

export type Priority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type User = {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  is_active: boolean;
};

export type EngineerProfile = {
  id: number;
  user: number;
  user_email: string;
  full_name: string;
  employee_id: string;
  department: string;
  specialty: MaintenanceSpecialty;
  phone: string;
  avatar: string | null;
  availability_status: "AVAILABLE" | "ON_SITE" | "ON_LEAVE";
  experience_years: number;
};

export type MaintenanceRequest = {
  id: number;
  client_company: number;
  client_company_name: string;
  issue_type: MaintenanceSpecialty;
  issue_type_display: string;
  priority: Priority;
  priority_display: string;
  location_details: string;
  description: string;
  preferred_date: string;
  is_hazardous: boolean;
  status: MaintenanceStatus;
  status_display: string;
  assigned_engineer: number | null;
  assigned_engineer_name: string | null;
  assigned_at: string | null;
  in_progress_at: string | null;
  waiting_spare_parts_at: string | null;
  completed_at: string | null;
  closed_at: string | null;
  rejected_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DashboardStatistics = {
  total_open_requests: number;
  completion_rate: number;
  top_recurring_maintenance_issues: Array<{
    issue_type: MaintenanceSpecialty;
    label: string;
    total: number;
  }>;
  fastest_responding_engineer: {
    engineer_id: number;
    employee_id: string;
    full_name: string;
    average_response_seconds: number | null;
    handled_requests: number;
  } | null;
  average_resolution_seconds: number | null;
};

export type PublicImpactStatistics = DashboardStatistics & {
  total_requests: number;
  completed_tickets: number;
};

export type RequestCreatePayload = {
  issue_type: MaintenanceSpecialty;
  priority: Priority;
  location_details: string;
  description: string;
  preferred_date: string;
  is_hazardous: boolean;
};

export type AuthTokens = {
  access: string;
  refresh: string;
};

export type PublicTrackedRequest = {
  id: number;
  client_company_name: string;
  issue_type: MaintenanceSpecialty;
  issue_type_display: string;
  priority: Priority;
  status: MaintenanceStatus;
  status_display: string;
  preferred_date: string;
  created_at: string;
  updated_at: string;
};

export type PublicContactPayload = {
  contact_name: string;
  company_name: string;
  email: string;
  phone: string;
  message: string;
};

export type PublicMaintenanceRequestPayload = {
  contact_name: string;
  company_name: string;
  commercial_register: string;
  email: string;
  phone: string;
  address: string;
  issue_type: MaintenanceSpecialty;
  priority: Priority;
  location_details: string;
  description: string;
  preferred_date: string;
  is_hazardous: boolean;
};
