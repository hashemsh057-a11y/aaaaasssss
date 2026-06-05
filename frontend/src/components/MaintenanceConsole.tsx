"use client";

import {
  AlertTriangle,
  ArrowRightLeft,
  BarChart3,
  CheckCircle2,
  ChevronLeft,
  ClipboardList,
  Clock3,
  LogOut,
  Menu,
  RefreshCw,
  ShieldCheck,
  UserRoundCog,
  XCircle
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import {
  clearTokens,
  createMaintenanceRequest,
  getCurrentUser,
  getDashboardStatistics,
  getEngineers,
  getMaintenanceRequests,
  loadTokens,
  login,
  transitionMaintenanceRequest
} from "@/src/lib/api";
import {
  copy,
  formatDuration,
  getPriorityLabel,
  getSpecialtyLabel,
  languages,
  priorityOptions,
  specialtyOptions,
  statusLabels
} from "@/src/lib/i18n";
import type {
  DashboardStatistics,
  EngineerProfile,
  Language,
  MaintenanceRequest,
  MaintenanceStatus,
  RequestCreatePayload,
  User,
  UserRole
} from "@/src/lib/types";

const workflowControlRoles: UserRole[] = ["ADMIN", "QUALITY_CONTROLLER"];

function hasWorkflowControl(user: User | null) {
  return user ? workflowControlRoles.includes(user.role) : false;
}

function getTomorrowLocalInputValue() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function formatDate(value: string | null, language: Language) {
  if (!value) {
    return "—";
  }
  return new Intl.DateTimeFormat(language === "ar" ? "ar-LY" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function normalizeError(error: unknown, fallback: string) {
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}

export function MaintenanceConsole() {
  const [language, setLanguage] = useState<Language>("ar");
  const [user, setUser] = useState<User | null>(null);
  const [dashboard, setDashboard] = useState<DashboardStatistics | null>(null);
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [engineers, setEngineers] = useState<EngineerProfile[]>([]);
  const [activeView, setActiveView] = useState<"dashboard" | "requests">("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const t = copy[language];
  const direction = languages[language].dir;

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = direction;
    document.body.classList.toggle("font-cairo", language === "ar");
    document.body.classList.toggle("font-inter", language === "en");
  }, [direction, language]);

  async function loadWorkspace(currentUser: User) {
    const [statistics, maintenanceRequests, engineerProfiles] = await Promise.all([
      getDashboardStatistics(),
      getMaintenanceRequests(),
      hasWorkflowControl(currentUser) ? getEngineers() : Promise.resolve([])
    ]);
    setDashboard(statistics);
    setRequests(maintenanceRequests);
    setEngineers(engineerProfiles);
  }

  useEffect(() => {
    let active = true;
    async function restoreSession() {
      if (!loadTokens()) {
        setLoading(false);
        return;
      }
      try {
        const currentUser = await getCurrentUser();
        if (!active) {
          return;
        }
        setUser(currentUser);
        await loadWorkspace(currentUser);
      } catch (sessionError) {
        clearTokens();
        if (active) {
          setError(normalizeError(sessionError, t.apiError));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }
    void restoreSession();
    return () => {
      active = false;
    };
  }, [t.apiError]);

  async function refreshWorkspace() {
    if (!user) {
      return;
    }
    setRefreshing(true);
    setError(null);
    try {
      await loadWorkspace(user);
    } catch (refreshError) {
      setError(normalizeError(refreshError, t.apiError));
    } finally {
      setRefreshing(false);
    }
  }

  async function handleAuthenticated(nextUser: User) {
    setUser(nextUser);
    setError(null);
    setLoading(true);
    try {
      await loadWorkspace(nextUser);
    } catch (workspaceError) {
      setError(normalizeError(workspaceError, t.apiError));
    } finally {
      setLoading(false);
    }
  }

  function handleSignOut() {
    clearTokens();
    setUser(null);
    setDashboard(null);
    setRequests([]);
    setEngineers([]);
    setError(null);
  }

  if (loading) {
    return (
      <main className="boot-screen">
        <div className="boot-pulse">
          <ShieldCheck aria-hidden="true" />
        </div>
        <p>{t.loading}</p>
      </main>
    );
  }

  if (!user) {
    return (
      <LoginPanel
        language={language}
        setLanguage={setLanguage}
        error={error}
        onLogin={async (username, password) => {
          await login(username, password);
          const currentUser = await getCurrentUser();
          await handleAuthenticated(currentUser);
        }}
      />
    );
  }

  return (
    <div className="app-shell" data-sidebar-collapsed={sidebarCollapsed}>
      <aside className={`sidebar ${sidebarOpen ? "is-open" : ""}`} aria-label={t.console}>
        <div className="brand-lockup">
          <div className="brand-mark">
            <ShieldCheck aria-hidden="true" />
          </div>
          <div className="brand-copy">
            <strong>{t.appName}</strong>
            <span>{t.console}</span>
          </div>
        </div>

        <nav className="side-nav">
          <button
            type="button"
            className={activeView === "dashboard" ? "active" : ""}
            onClick={() => {
              setActiveView("dashboard");
              setSidebarOpen(false);
            }}
          >
            <BarChart3 aria-hidden="true" />
            <span>{t.dashboard}</span>
          </button>
          <button
            type="button"
            className={activeView === "requests" ? "active" : ""}
            onClick={() => {
              setActiveView("requests");
              setSidebarOpen(false);
            }}
          >
            <ClipboardList aria-hidden="true" />
            <span>{t.requests}</span>
          </button>
        </nav>

        <button type="button" className="collapse-button" onClick={() => setSidebarCollapsed((value) => !value)}>
          <ChevronLeft aria-hidden="true" />
          <span>{sidebarCollapsed ? t.requests : t.console}</span>
        </button>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <button type="button" className="icon-button mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Menu">
            <Menu aria-hidden="true" />
          </button>
          <div className="identity-strip">
            <span>{t.connectedAs}</span>
            <strong title={user.email}>{user.first_name || user.username}</strong>
            <em>{user.role.replaceAll("_", " ")}</em>
          </div>
          <div className="topbar-actions">
            <LanguageToggle language={language} setLanguage={setLanguage} />
            <button type="button" className="icon-text-button" onClick={refreshWorkspace} disabled={refreshing}>
              <RefreshCw aria-hidden="true" className={refreshing ? "spin" : ""} />
              <span>{t.refresh}</span>
            </button>
            <button type="button" className="icon-button danger" onClick={handleSignOut} aria-label={t.signOut}>
              <LogOut aria-hidden="true" />
            </button>
          </div>
        </header>

        {sidebarOpen && <button type="button" className="sidebar-scrim" aria-label="Close menu" onClick={() => setSidebarOpen(false)} />}

        {error && (
          <div className="notice" role="alert">
            <AlertTriangle aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {activeView === "dashboard" ? (
          <DashboardView dashboard={dashboard} language={language} requests={requests} />
        ) : (
          <RequestsView
            user={user}
            language={language}
            requests={requests}
            engineers={engineers}
            onCreated={async () => refreshWorkspace()}
            onTransition={async (requestId, nextStatus, assignedEngineerId) => {
              setError(null);
              try {
                await transitionMaintenanceRequest(requestId, nextStatus, assignedEngineerId);
                await refreshWorkspace();
              } catch (transitionError) {
                setError(normalizeError(transitionError, t.apiError));
              }
            }}
          />
        )}
      </div>
    </div>
  );
}

function LanguageToggle({
  language,
  setLanguage
}: {
  language: Language;
  setLanguage: (language: Language) => void;
}) {
  return (
    <div className="segmented-control" aria-label={copy[language].language}>
      {(["ar", "en"] as const).map((option) => (
        <button
          type="button"
          key={option}
          className={language === option ? "selected" : ""}
          onClick={() => setLanguage(option)}
        >
          {languages[option].label}
        </button>
      ))}
    </div>
  );
}

function LoginPanel({
  language,
  setLanguage,
  error,
  onLogin
}: {
  language: Language;
  setLanguage: (language: Language) => void;
  error: string | null;
  onLogin: (username: string, password: string) => Promise<void>;
}) {
  const t = copy[language];
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(error);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setLoginError(null);
    try {
      await onLogin(username, password);
    } catch (authError) {
      setLoginError(normalizeError(authError, t.apiError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-screen">
      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-header">
          <div className="brand-mark">
            <ShieldCheck aria-hidden="true" />
          </div>
          <div>
            <h1 id="login-title">{t.appName}</h1>
            <p>{t.console}</p>
          </div>
        </div>
        <LanguageToggle language={language} setLanguage={setLanguage} />
        <form onSubmit={submit} className="login-form">
          <label>
            <span>{t.username}</span>
            <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required />
          </label>
          <label>
            <span>{t.password}</span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          {loginError && (
            <div className="notice compact" role="alert">
              <XCircle aria-hidden="true" />
              <span>{loginError}</span>
            </div>
          )}
          <button type="submit" className="primary-action" disabled={submitting}>
            <ShieldCheck aria-hidden="true" />
            <span>{t.signIn}</span>
          </button>
        </form>
      </section>
    </main>
  );
}

function DashboardView({
  dashboard,
  language,
  requests
}: {
  dashboard: DashboardStatistics | null;
  language: Language;
  requests: MaintenanceRequest[];
}) {
  const t = copy[language];
  const total = requests.length;
  const critical = requests.filter((request) => request.priority === "CRITICAL").length;

  return (
    <main className="dashboard-surface">
      <section className="metrics-ribbon" aria-label={t.dashboard}>
        <Metric icon={<ClipboardList />} label={t.openRequests} value={dashboard?.total_open_requests ?? 0} tone="teal" />
        <Metric icon={<CheckCircle2 />} label={t.completionRate} value={`${dashboard?.completion_rate ?? 0}%`} tone="green" />
        <Metric
          icon={<Clock3 />}
          label={t.avgResolution}
          value={formatDuration(dashboard?.average_resolution_seconds ?? null, language)}
          tone="amber"
        />
        <Metric icon={<AlertTriangle />} label={t.critical} value={critical} tone="coral" />
      </section>

      <section className="dashboard-flow">
        <div className="issue-stream">
          <div className="section-heading">
            <BarChart3 aria-hidden="true" />
            <h2>{t.recurringIssues}</h2>
          </div>
          <div className="issue-bars">
            {(dashboard?.top_recurring_maintenance_issues ?? []).map((issue) => {
              const width = total > 0 ? Math.max(12, Math.round((issue.total / total) * 100)) : 0;
              return (
                <div className="issue-bar" key={issue.issue_type}>
                  <span>{getSpecialtyLabel(issue.issue_type, language)}</span>
                  <div className="bar-track" aria-hidden="true">
                    <i style={{ inlineSize: `${width}%` }} />
                  </div>
                  <strong>{issue.total}</strong>
                </div>
              );
            })}
          </div>
        </div>

        <div className="response-panel">
          <div className="section-heading">
            <UserRoundCog aria-hidden="true" />
            <h2>{t.fastestEngineer}</h2>
          </div>
          {dashboard?.fastest_responding_engineer ? (
            <div className="engineer-spotlight">
              <strong>{dashboard.fastest_responding_engineer.full_name}</strong>
              <span>{dashboard.fastest_responding_engineer.employee_id}</span>
              <b>{formatDuration(dashboard.fastest_responding_engineer.average_response_seconds, language)}</b>
            </div>
          ) : (
            <p className="empty-state">{t.noFastestEngineer}</p>
          )}
        </div>
      </section>
    </main>
  );
}

function Metric({
  icon,
  label,
  value,
  tone
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  tone: "teal" | "green" | "amber" | "coral";
}) {
  return (
    <div className={`metric ${tone}`}>
      <span className="metric-icon">{icon}</span>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function RequestsView({
  user,
  language,
  requests,
  engineers,
  onCreated,
  onTransition
}: {
  user: User;
  language: Language;
  requests: MaintenanceRequest[];
  engineers: EngineerProfile[];
  onCreated: () => Promise<void>;
  onTransition: (requestId: number, status: MaintenanceStatus, assignedEngineerId?: number | null) => Promise<void>;
}) {
  const t = copy[language];
  const [assignmentByRequest, setAssignmentByRequest] = useState<Record<number, number>>({});

  const groupedRequests = useMemo(
    () =>
      [...requests].sort((left, right) => {
        const priorityWeight = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
        return priorityWeight[right.priority] - priorityWeight[left.priority] || Date.parse(right.created_at) - Date.parse(left.created_at);
      }),
    [requests]
  );

  return (
    <main className="requests-surface">
      {user.role === "CLIENT_COMPANY" && <RequestComposer language={language} onCreated={onCreated} />}

      <section className="request-stack" aria-label={t.requests}>
        {groupedRequests.length === 0 ? (
          <p className="empty-state">{t.emptyRequests}</p>
        ) : (
          groupedRequests.map((request) => {
            const specialtyEngineers = engineers.filter((engineer) => engineer.specialty === request.issue_type);
            return (
              <article className="request-row" key={request.id}>
                <div className="request-main">
                  <div className="request-title-line">
                    <span className={`status-pill status-${request.status.toLowerCase().replaceAll("_", "-")}`}>
                      {statusLabels[request.status][language]}
                    </span>
                    <strong title={request.description}>{getSpecialtyLabel(request.issue_type, language)}</strong>
                  </div>
                  <p title={request.description}>{request.description}</p>
                  <div className="request-meta">
                    <span>{getPriorityLabel(request.priority, language)}</span>
                    <span title={request.location_details}>{request.location_details}</span>
                    <span>{formatDate(request.created_at, language)}</span>
                  </div>
                </div>

                <div className="request-side">
                  <span className="company-name" title={request.client_company_name}>
                    {request.client_company_name}
                  </span>
                  <span className="engineer-name" title={request.assigned_engineer_name ?? ""}>
                    {request.assigned_engineer_name ?? t.selectEngineer}
                  </span>
                  <RequestActions
                    user={user}
                    request={request}
                    engineers={specialtyEngineers}
                    selectedEngineer={assignmentByRequest[request.id]}
                    language={language}
                    onSelectEngineer={(engineerId) =>
                      setAssignmentByRequest((current) => ({ ...current, [request.id]: engineerId }))
                    }
                    onTransition={onTransition}
                  />
                </div>
              </article>
            );
          })
        )}
      </section>
    </main>
  );
}

function RequestActions({
  user,
  request,
  engineers,
  selectedEngineer,
  language,
  onSelectEngineer,
  onTransition
}: {
  user: User;
  request: MaintenanceRequest;
  engineers: EngineerProfile[];
  selectedEngineer?: number;
  language: Language;
  onSelectEngineer: (engineerId: number) => void;
  onTransition: (requestId: number, status: MaintenanceStatus, assignedEngineerId?: number | null) => Promise<void>;
}) {
  const t = copy[language];

  if (hasWorkflowControl(user)) {
    if (request.status === "NEW") {
      return (
        <div className="action-cluster">
          <button type="button" onClick={() => onTransition(request.id, "UNDER_REVIEW")}>
            <ArrowRightLeft aria-hidden="true" />
            <span>{t.underReview}</span>
          </button>
          <button type="button" className="danger-soft" onClick={() => onTransition(request.id, "REJECTED")}>
            <XCircle aria-hidden="true" />
            <span>{t.reject}</span>
          </button>
        </div>
      );
    }
    if (request.status === "UNDER_REVIEW") {
      return (
        <div className="assignment-cluster">
          <select
            value={selectedEngineer ?? ""}
            onChange={(event) => onSelectEngineer(Number(event.target.value))}
            aria-label={t.assignedEngineer}
          >
            <option value="">{t.selectEngineer}</option>
            {engineers.map((engineer) => (
              <option key={engineer.id} value={engineer.id}>
                {engineer.full_name} · {engineer.employee_id}
              </option>
            ))}
          </select>
          <button type="button" disabled={!selectedEngineer} onClick={() => onTransition(request.id, "ASSIGNED", selectedEngineer)}>
            <UserRoundCog aria-hidden="true" />
            <span>{t.assign}</span>
          </button>
        </div>
      );
    }
    if (request.status === "IN_PROGRESS" || request.status === "WAITING_SPARE_PARTS") {
      return (
        <div className="action-cluster">
          <button type="button" onClick={() => onTransition(request.id, "COMPLETED")}>
            <CheckCircle2 aria-hidden="true" />
            <span>{t.complete}</span>
          </button>
        </div>
      );
    }
    if (request.status === "COMPLETED") {
      return (
        <div className="action-cluster">
          <button type="button" onClick={() => onTransition(request.id, "CLOSED")}>
            <ShieldCheck aria-hidden="true" />
            <span>{t.close}</span>
          </button>
        </div>
      );
    }
  }

  if (user.role === "ENGINEER") {
    if (request.status === "ASSIGNED" || request.status === "WAITING_SPARE_PARTS") {
      return (
        <div className="action-cluster">
          <button type="button" onClick={() => onTransition(request.id, "IN_PROGRESS")}>
            <ArrowRightLeft aria-hidden="true" />
            <span>{t.startWork}</span>
          </button>
        </div>
      );
    }
    if (request.status === "IN_PROGRESS") {
      return (
        <div className="action-cluster">
          <button type="button" onClick={() => onTransition(request.id, "WAITING_SPARE_PARTS")}>
            <Clock3 aria-hidden="true" />
            <span>{t.waitParts}</span>
          </button>
        </div>
      );
    }
  }

  return null;
}

function RequestComposer({ language, onCreated }: { language: Language; onCreated: () => Promise<void> }) {
  const t = copy[language];
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<RequestCreatePayload>({
    issue_type: "ELECTRICITY",
    priority: "MEDIUM",
    location_details: "",
    description: "",
    preferred_date: getTomorrowLocalInputValue(),
    is_hazardous: false
  });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createMaintenanceRequest({
        ...form,
        preferred_date: new Date(form.preferred_date).toISOString()
      });
      setForm({
        issue_type: "ELECTRICITY",
        priority: "MEDIUM",
        location_details: "",
        description: "",
        preferred_date: getTomorrowLocalInputValue(),
        is_hazardous: false
      });
      await onCreated();
    } catch (createError) {
      setError(normalizeError(createError, t.apiError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="composer" aria-labelledby="composer-title">
      <div className="section-heading">
        <ClipboardList aria-hidden="true" />
        <h2 id="composer-title">{t.createRequest}</h2>
      </div>
      <form onSubmit={submit} className="composer-form">
        <label>
          <span>{t.issueType}</span>
          <select value={form.issue_type} onChange={(event) => setForm((current) => ({ ...current, issue_type: event.target.value as RequestCreatePayload["issue_type"] }))}>
            {specialtyOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label[language]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{t.priority}</span>
          <select value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value as RequestCreatePayload["priority"] }))}>
            {priorityOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label[language]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{t.preferredDate}</span>
          <input
            type="datetime-local"
            value={form.preferred_date}
            onChange={(event) => setForm((current) => ({ ...current, preferred_date: event.target.value }))}
            required
          />
        </label>
        <label className="wide-field">
          <span>{t.location}</span>
          <input
            value={form.location_details}
            onChange={(event) => setForm((current) => ({ ...current, location_details: event.target.value }))}
            required
          />
        </label>
        <label className="wide-field">
          <span>{t.description}</span>
          <textarea
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            rows={3}
            required
          />
        </label>
        <label className="hazard-toggle">
          <input
            type="checkbox"
            checked={form.is_hazardous}
            onChange={(event) => setForm((current) => ({ ...current, is_hazardous: event.target.checked }))}
          />
          <span>{t.hazardous}</span>
        </label>
        {error && (
          <div className="notice compact wide-field" role="alert">
            <AlertTriangle aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}
        <button type="submit" className="primary-action" disabled={submitting}>
          <CheckCircle2 aria-hidden="true" />
          <span>{t.submit}</span>
        </button>
      </form>
    </section>
  );
}
