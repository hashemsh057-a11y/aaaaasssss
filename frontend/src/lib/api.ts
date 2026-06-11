import type {
  AdminTransitionPayload,
  AuthTokens,
  DashboardStatistics,
  EngineerProfile,
  MaintenanceRequest,
  MaintenanceStatus,
  PublicCompany,
  CompanyPortalDashboard,
  CompanyPortalRegistrationPayload,
  EngineerPortalDashboard,
  PortalCodeResponse,
  PortalMaintenanceRequest,
  PortalVerifyResponse,
  PublicCapabilities,
  PublicContactPayload,
  PublicEngineer,
  PublicEngineerPayload,
  PublicEngineerRegistration,
  PublicImpactStatistics,
  PublicMaintenanceRequestPayload,
  PublicTrackedRequest,
  ReportFormat,
  ReportKind,
  RequestCreatePayload,
  User
} from "./types";

/**
 * Sanitize the configured API base URL so a markdown-formatted value like
 * "[https://host/api](https://host/api)" — which is exactly what got pasted
 * into Cloudflare Pages env vars at one point — still resolves to the real
 * https URL instead of producing a 404 for every request.
 */
function sanitizeApiBaseUrl(raw: string | undefined): string {
  if (!raw) return "https://aaaaasssss.pythonanywhere.com/api";
  const trimmed = raw.trim();
  // Markdown-link form: [text](url) — extract the inner URL.
  const markdownMatch = trimmed.match(/^\[[^\]]*\]\((https?:\/\/[^)]+)\)$/);
  if (markdownMatch) return markdownMatch[1];
  // First valid http(s) URL inside the value (handles pasted "[url](url)" too).
  const urlMatch = trimmed.match(/https?:\/\/[A-Za-z0-9._:/-]+/);
  if (urlMatch) return urlMatch[0];
  return trimmed;
}

const rawApiBaseUrl = sanitizeApiBaseUrl(
  process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL
);
const API_BASE_URL = rawApiBaseUrl.replace(/\/+$/, "");
const ACCESS_TOKEN_KEY = "maintenance_access_token";
const REFRESH_TOKEN_KEY = "maintenance_refresh_token";
export const COMPANY_PORTAL_TOKEN_KEY = "engiflow_company_portal_token";
export const ENGINEER_PORTAL_TOKEN_KEY = "engiflow_engineer_portal_token";

export function normalizeOtpInput(value: string): string {
  const arabicDigits = "٠١٢٣٤٥٦٧٨٩";
  const persianDigits = "۰۱۲۳۴۵۶۷۸۹";
  return Array.from(value)
    .map((character) => {
      const arabicIndex = arabicDigits.indexOf(character);
      if (arabicIndex >= 0) return String(arabicIndex);
      const persianIndex = persianDigits.indexOf(character);
      if (persianIndex >= 0) return String(persianIndex);
      return character;
    })
    .join("")
    .replace(/\D/g, "")
    .slice(0, 4);
}

export function canShowPortalDebugCode(): boolean {
  if (typeof window === "undefined") return false;
  return ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
}

export class BackendUpgradeRequiredError extends Error {
  constructor() {
    super("The backend does not support the current engineer profile API.");
    this.name = "BackendUpgradeRequiredError";
  }
}

export class ApiRequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

export function getApiAssetUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  if (/^(https?:|blob:|data:)/i.test(value)) return value;
  const apiUrl = new URL(API_BASE_URL);
  return new URL(value, apiUrl.origin).toString();
}

/**
 * Ensures every Django endpoint URL ends with a trailing slash.
 * Django's APPEND_SLASH + SECURE_SSL_REDIRECT will issue a 301 redirect
 * when a slash is missing, which converts POST -> GET on the redirected
 * request and yields a 405 Method Not Allowed on create endpoints.
 */
function withTrailingSlash(path: string): string {
  const [pathname, query = ""] = path.split("?");
  if (pathname.endsWith("/")) {
    return path;
  }
  const normalized = `${pathname}/`;
  return query ? `${normalized}?${query}` : normalized;
}

type RequestOptions = RequestInit & {
  retryOnUnauthorized?: boolean;
};

export function loadTokens(): AuthTokens | null {
  if (typeof window === "undefined") {
    return null;
  }
  const access = window.localStorage.getItem(ACCESS_TOKEN_KEY);
  const refresh = window.localStorage.getItem(REFRESH_TOKEN_KEY);
  return access && refresh ? { access, refresh } : null;
}

export function saveTokens(tokens: AuthTokens) {
  window.localStorage.setItem(ACCESS_TOKEN_KEY, tokens.access);
  window.localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh);
}

export function clearTokens() {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
}

async function parseResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    const message = typeof payload === "string" ? payload : JSON.stringify(payload);
    throw new ApiRequestError(response.status, message || response.statusText);
  }
  return payload as T;
}

async function refreshAccessToken(): Promise<string | null> {
  const tokens = loadTokens();
  if (!tokens?.refresh) {
    return null;
  }
  const response = await fetch(`${API_BASE_URL}/auth/token/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh: tokens.refresh })
  });
  if (!response.ok) {
    clearTokens();
    return null;
  }
  const data = await response.json();
  const nextTokens = {
    access: data.access as string,
    refresh: (data.refresh as string | undefined) ?? tokens.refresh
  };
  saveTokens(nextTokens);
  return nextTokens.access;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const tokens = loadTokens();
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (tokens?.access) {
    headers.set("Authorization", `Bearer ${tokens.access}`);
  }

  const response = await fetch(`${API_BASE_URL}${withTrailingSlash(path)}`, {
    ...options,
    headers
  });

  if (response.status === 401 && options.retryOnUnauthorized !== false) {
    const refreshedAccess = await refreshAccessToken();
    if (refreshedAccess) {
      const retryHeaders = new Headers(headers);
      retryHeaders.set("Authorization", `Bearer ${refreshedAccess}`);
      return apiFetch<T>(path, { ...options, headers: retryHeaders, retryOnUnauthorized: false });
    }
  }

  return parseResponse<T>(response);
}

export async function login(username: string, password: string): Promise<AuthTokens> {
  const response = await fetch(`${API_BASE_URL}/auth/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });
  const tokens = await parseResponse<AuthTokens>(response);
  saveTokens(tokens);
  return tokens;
}

export function getCurrentUser() {
  return apiFetch<User>("/users/me/");
}

export function getDashboardStatistics() {
  return apiFetch<DashboardStatistics>("/dashboard/statistics/");
}

export function getMaintenanceRequests() {
  return apiFetch<MaintenanceRequest[]>("/maintenance-requests/");
}

export function getEngineers() {
  return apiFetch<EngineerProfile[]>("/engineers/");
}

export function createMaintenanceRequest(payload: RequestCreatePayload) {
  return apiFetch<MaintenanceRequest>("/maintenance-requests/", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function transitionMaintenanceRequest(
  id: number,
  status: MaintenanceStatus,
  assignedEngineerId?: number | null
) {
  const payload: Record<string, string | number> = { status };
  if (assignedEngineerId) {
    payload.assigned_engineer = assignedEngineerId;
  }
  return apiFetch<MaintenanceRequest>(`/maintenance-requests/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function getPublicImpactStatistics() {
  return apiFetch<PublicImpactStatistics>("/public/impact/");
}

export function trackPublicRequest(ticketNumber: string) {
  return apiFetch<PublicTrackedRequest>(`/public/track/${encodeURIComponent(ticketNumber)}/`);
}

export function getPublicRequestsList() {
  return apiFetch<PublicTrackedRequest[]>("/public/requests-list/");
}

export function submitPublicContactInquiry(payload: PublicContactPayload) {
  return apiFetch<{ id: number; created_at: string } & PublicContactPayload>("/public/contact/", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function submitPublicMaintenanceRequest(payload: PublicMaintenanceRequestPayload) {
  return apiFetch<PublicTrackedRequest>("/public/requests/", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function getPublicEngineers() {
  return apiFetch<PublicEngineer[]>("/public/engineers/");
}

async function portalFetch<T>(path: string, token: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  headers.set("X-Portal-Token", token);
  const response = await fetch(`${API_BASE_URL}${withTrailingSlash(path)}`, {
    ...options,
    headers
  });
  return parseResponse<T>(response);
}

export async function createPublicEngineer(payload: PublicEngineerPayload) {
  let capabilities: PublicCapabilities;
  try {
    capabilities = await apiFetch<PublicCapabilities>("/public/capabilities/");
  } catch {
    throw new BackendUpgradeRequiredError();
  }
  if (
    capabilities.engineer_profile_version < 3 ||
    !capabilities.engineer_avatar_webp ||
    !capabilities.engineer_availability ||
    !capabilities.engineer_device_identity ||
    !capabilities.engineer_profile_editing
  ) {
    throw new BackendUpgradeRequiredError();
  }

  const formData = new FormData();
  formData.append("name", payload.name);
  formData.append("phone", payload.phone);
  formData.append("email", payload.email);
  formData.append("department", payload.department);
  formData.append("specialty", payload.specialty);
  formData.append("profession", payload.profession);
  formData.append("experience_years", String(payload.experience_years));
  formData.append("is_available", "true");
  if (payload.avatar) {
    formData.append("avatar", payload.avatar);
  }
  if (payload.device_id) {
    formData.append("device_id", payload.device_id);
  }
  if (payload.device_label) {
    formData.append("device_label", payload.device_label);
  }
  const created = await apiFetch<PublicEngineerRegistration>("/public/engineers/", {
    method: "POST",
    body: formData
  });
  if (
    !created.availability_token ||
    typeof created.is_available !== "boolean" ||
    !Object.prototype.hasOwnProperty.call(created, "avatar")
  ) {
    throw new BackendUpgradeRequiredError();
  }
  return created;
}

export function getPublicEngineerDeviceSession(deviceId: string) {
  return apiFetch<PublicEngineerRegistration>("/public/engineer-device-session/", {
    method: "POST",
    body: JSON.stringify({ device_id: deviceId })
  });
}

export function updatePublicEngineer(id: number, payload: PublicEngineerPayload) {
  const formData = new FormData();
  formData.append("name", payload.name);
  formData.append("phone", payload.phone);
  formData.append("email", payload.email);
  formData.append("department", payload.department);
  formData.append("specialty", payload.specialty);
  formData.append("profession", payload.profession);
  formData.append("experience_years", String(payload.experience_years));
  if (payload.avatar) {
    formData.append("avatar", payload.avatar);
  }
  return apiFetch<PublicEngineer>(`/public/engineers/${id}/`, {
    method: "PATCH",
    body: formData
  });
}

export function linkPublicEngineerDevice(id: number, deviceId: string, deviceLabel: string) {
  const formData = new FormData();
  formData.append("device_id", deviceId);
  formData.append("device_label", deviceLabel);
  return apiFetch<PublicEngineer>(`/public/engineers/${id}/`, {
    method: "PATCH",
    body: formData
  });
}

export function setPublicEngineerAvailability(
  id: number,
  availabilityToken: string,
  isAvailable: boolean
) {
  return apiFetch<PublicEngineer>(`/public/engineers/${id}/availability/`, {
    method: "POST",
    body: JSON.stringify({
      availability_token: availabilityToken,
      is_available: isAvailable
    })
  });
}

export function deletePublicEngineer(id: number) {
  return apiFetch<void>(`/public/engineers/${id}/`, {
    method: "DELETE"
  });
}

export function adminTransitionRequest(requestId: number, payload: AdminTransitionPayload) {
  return apiFetch<PublicTrackedRequest>(`/public/admin/requests/${requestId}/transition/`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function setRequestCost(requestId: number, cost: string | null) {
  return apiFetch<PublicTrackedRequest>(`/public/admin/requests/${requestId}/cost/`, {
    method: "POST",
    body: JSON.stringify({ cost })
  });
}

export function getReportUrl(
  kind: ReportKind,
  fileFormat: ReportFormat,
  params: Record<string, string | number | undefined> = {}
) {
  const search = new URLSearchParams({ file_format: fileFormat });
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      search.set(key, String(value));
    }
  });
  return `${API_BASE_URL}/public/reports/${kind}/?${search.toString()}`;
}

export function getPublicCompanies() {
  return apiFetch<PublicCompany[]>("/public/companies-list/");
}

export function deletePublicCompany(id: number) {
  return apiFetch<void>(`/public/admin/companies/${id}/`, { method: "DELETE" });
}

export function requestCompanyPortalCode(
  payload: CompanyPortalRegistrationPayload | { purpose: "LOGIN"; email: string }
) {
  return apiFetch<PortalCodeResponse>("/public/portal/company/request-code/", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function verifyCompanyPortalCode(challengeId: number, code: string) {
  return apiFetch<PortalVerifyResponse<PublicCompany>>("/public/portal/company/verify/", {
    method: "POST",
    body: JSON.stringify({ challenge_id: challengeId, code })
  });
}

export function getCompanyPortalDashboard(token: string) {
  return portalFetch<CompanyPortalDashboard>("/public/portal/company/dashboard/", token);
}

export function createCompanyPortalRequest(
  token: string,
  payload: Omit<RequestCreatePayload, "preferred_date"> & { preferred_date: string }
) {
  return portalFetch<PortalMaintenanceRequest>("/public/portal/company/requests/", token, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function requestEngineerPortalCode(email: string) {
  return apiFetch<PortalCodeResponse>("/public/portal/engineer/request-code/", {
    method: "POST",
    body: JSON.stringify({ email })
  });
}

export function verifyEngineerPortalCode(challengeId: number, code: string) {
  return apiFetch<PortalVerifyResponse<PublicEngineer>>("/public/portal/engineer/verify/", {
    method: "POST",
    body: JSON.stringify({ challenge_id: challengeId, code })
  });
}

export function getEngineerPortalDashboard(token: string) {
  return portalFetch<EngineerPortalDashboard>("/public/portal/engineer/dashboard/", token);
}

export function setEngineerPortalAvailability(token: string, isAvailable: boolean) {
  return portalFetch<PublicEngineer>("/public/portal/engineer/availability/", token, {
    method: "POST",
    body: JSON.stringify({ is_available: isAvailable })
  });
}

export function updateEngineerPortalRequest(
  token: string,
  requestId: number,
  payload: { status?: "IN_PROGRESS" | "WAITING_SPARE_PARTS" | "COMPLETED"; note?: string }
) {
  return portalFetch<PortalMaintenanceRequest>(
    `/public/portal/engineer/requests/${requestId}/action/`,
    token,
    {
      method: "POST",
      body: JSON.stringify(payload)
    }
  );
}
