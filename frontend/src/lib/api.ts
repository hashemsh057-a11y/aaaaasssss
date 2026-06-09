import type {
  AdminTransitionPayload,
  AuthTokens,
  DashboardStatistics,
  EngineerProfile,
  MaintenanceRequest,
  MaintenanceStatus,
  PublicCompany,
  PublicContactPayload,
  PublicEngineer,
  PublicEngineerPayload,
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
    throw new Error(message || response.statusText);
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

export function createPublicEngineer(payload: PublicEngineerPayload) {
  return apiFetch<PublicEngineer>("/public/engineers/", {
    method: "POST",
    body: JSON.stringify(payload)
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
