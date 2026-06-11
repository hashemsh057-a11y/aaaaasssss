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
  assigned_engineer_name: string | null;
  assigned_engineer_phone: string | null;
  assigned_public_engineer: number | null;
  assigned_at: string | null;
  in_progress_at: string | null;
  waiting_spare_parts_at: string | null;
  completed_at: string | null;
  closed_at: string | null;
  rejected_at: string | null;
  created_at: string;
  updated_at: string;
  cost: string | null;
  activities?: PortalRequestActivity[];
};

export type AdminTransitionPayload = {
  status: MaintenanceStatus;
  assigned_public_engineer_id?: number;
};

export type ReportKind = "monthly" | "company" | "engineer" | "recurring" | "cost";
export type ReportFormat = "pdf" | "xlsx";

export type PublicContactPayload = {
  contact_name: string;
  company_name: string;
  email: string;
  phone: string;
  message: string;
};

export type PublicEngineer = {
  id: number;
  name: string;
  phone: string;
  email: string;
  department: string;
  specialty: MaintenanceSpecialty;
  specialty_display: string;
  profession: string;
  avatar: string | null;
  experience_years: number;
  is_available: boolean;
  device_label: string;
  device_last_seen_at: string | null;
  created_at: string;
};

export type PublicEngineerPayload = {
  name: string;
  phone: string;
  email: string;
  department: string;
  specialty: MaintenanceSpecialty;
  profession: string;
  experience_years: number;
  avatar?: File | null;
  device_id?: string;
  device_label?: string;
};

export type PublicEngineerRegistration = PublicEngineer & {
  availability_token: string;
};

export type PublicCapabilities = {
  engineer_profile_version: number;
  engineer_avatar_webp: boolean;
  engineer_availability: boolean;
  engineer_device_identity: boolean;
  engineer_profile_editing: boolean;
};

export type PublicCompany = {
  id: number;
  company_name: string;
  commercial_register: string;
  contact_phone: string;
  address: string;
  contact_name: string;
  email: string;
  is_archived: boolean;
};

export type PortalRequestActivity = {
  id: number;
  event_type: "NOTE" | "STATUS" | "ACCEPTED" | "AUTO_ASSIGNED";
  message: string;
  engineer_name: string | null;
  created_at: string;
};

export type PortalMaintenanceRequest = PublicTrackedRequest & {
  location_details: string;
  description: string;
  is_hazardous: boolean;
  activities: PortalRequestActivity[];
};

export type PortalCodeResponse = {
  challenge_id: number;
  expires_in_seconds: number;
  debug_code?: string;
};

export type CompanyPortalRegistrationPayload = {
  purpose: "REGISTER";
  email: string;
  company_name: string;
  contact_name: string;
  commercial_register: string;
  phone: string;
  address: string;
};

export type CompanyPortalDashboard = {
  profile: PublicCompany;
  requests: PortalMaintenanceRequest[];
};

export type EngineerPortalDashboard = {
  profile: PublicEngineer;
  requests: PortalMaintenanceRequest[];
};

export type PortalVerifyResponse<T> = {
  token: string;
  profile: T;
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
