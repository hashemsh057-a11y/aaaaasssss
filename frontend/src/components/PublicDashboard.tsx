"use client";

import {
  AlertTriangle,
  Banknote,
  BarChart3,
  Building2,
  CheckCircle2,
  ClipboardList,
  Globe2,
  HardHat,
  FileSpreadsheet,
  FileText,
  LayoutDashboard,
  Loader2,
  LogOut,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Play,
  PlayCircle,
  RefreshCw,
  Save,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  Wrench,
  XCircle
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import {
  BackendUpgradeRequiredError,
  adminTransitionRequest,
  createPublicEngineer,
  deletePublicEngineer,
  getReportUrl,
  getPublicCompanies,
  getPublicEngineers,
  getPublicImpactStatistics,
  getPublicRequestsList,
  setRequestCost,
  updatePublicEngineer
} from "@/src/lib/api";
import { copy, getPriorityLabel, getSpecialtyLabel, languages, statusLabels } from "@/src/lib/i18n";
import { getGoogleMapsSearchUrl } from "@/src/lib/maps";
import {
  clearEngineerManagementSession,
  loadEngineerManagementSession
} from "@/src/lib/engineerSession";
import { DashboardLogin, useDashboardSession } from "./DashboardLogin";
import type {
  Language,
  MaintenanceSpecialty,
  MaintenanceStatus,
  PublicCompany,
  PublicEngineer,
  PublicEngineerPayload,
  PublicImpactStatistics,
  PublicTrackedRequest,
  ReportKind
} from "@/src/lib/types";
import { EngineerAvatar } from "./EngineerAvatar";
import { ImageLightbox } from "./ImageLightbox";

type FetchState = "idle" | "loading" | "ready" | "error";
type DashboardView = "overview" | "requests" | "engineers" | "companies" | "reports";

const SPECIALTY_OPTIONS: MaintenanceSpecialty[] = [
  "ELECTRICITY",
  "NETWORKS",
  "HVAC",
  "PLUMBING",
  "MEDICAL_DEVICES",
  "SURVEILLANCE",
  "SOFTWARE",
  "SERVERS",
  "CYBERSECURITY"
];

// Visual stepper stages in display order. REJECTED/CLOSED are surfaced as
// extra terminal states alongside the linear path.
const WORKFLOW_STAGES: MaintenanceStatus[] = [
  "NEW",
  "UNDER_REVIEW",
  "ASSIGNED",
  "IN_PROGRESS",
  "COMPLETED"
];

function stageIndex(status: MaintenanceStatus): number {
  const i = WORKFLOW_STAGES.indexOf(status);
  if (i >= 0) return i;
  if (status === "CLOSED") return WORKFLOW_STAGES.length - 1;
  if (status === "REJECTED") return -1;
  if (status === "WAITING_SPARE_PARTS") return WORKFLOW_STAGES.indexOf("IN_PROGRESS");
  return -1;
}

function stageTimestamp(request: PublicTrackedRequest, stage: MaintenanceStatus): string | null {
  switch (stage) {
    case "NEW":
      return request.created_at;
    case "UNDER_REVIEW":
      return null; // model has no dedicated timestamp; we infer from updated_at if needed
    case "ASSIGNED":
      return request.assigned_at;
    case "IN_PROGRESS":
      return request.in_progress_at;
    case "COMPLETED":
      return request.completed_at;
    default:
      return null;
  }
}

async function fetchWithRetry<T>(operation: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 400 * (attempt + 1)));
      }
    }
  }
  throw lastError;
}

export function PublicDashboard() {
  const [language, setLanguage] = useState<Language>("ar");
  const [activeView, setActiveView] = useState<DashboardView>("overview");
  const session = useDashboardSession();
  const [stats, setStats] = useState<PublicImpactStatistics | null>(null);
  const [engineers, setEngineers] = useState<PublicEngineer[]>([]);
  const [companies, setCompanies] = useState<PublicCompany[]>([]);
  const [requests, setRequests] = useState<PublicTrackedRequest[]>([]);
  const [state, setState] = useState<FetchState>("loading");
  const [errors, setErrors] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [editingEngineer, setEditingEngineer] = useState<PublicEngineer | null>(null);
  const [previewImage, setPreviewImage] = useState<{ src: string; alt: string } | null>(null);
  const [engineerActionError, setEngineerActionError] = useState<string | null>(null);

  const t = copy[language];
  const dir = languages[language].dir;
  const numberFormat = useMemo(
    () => new Intl.NumberFormat(language === "ar" ? "ar-LY" : "en-US"),
    [language]
  );

  const load = useCallback(async () => {
    const failures: string[] = [];
    const [statsResult, engineersResult, companiesResult, requestsResult] = await Promise.allSettled([
      fetchWithRetry(getPublicImpactStatistics),
      fetchWithRetry(getPublicEngineers),
      fetchWithRetry(getPublicCompanies),
      fetchWithRetry(getPublicRequestsList)
    ]);

    if (statsResult.status === "fulfilled") setStats(statsResult.value);
    else failures.push("impact");
    if (engineersResult.status === "fulfilled") setEngineers(engineersResult.value);
    else failures.push("engineers");
    if (companiesResult.status === "fulfilled") setCompanies(companiesResult.value);
    else failures.push("companies");
    if (requestsResult.status === "fulfilled") setRequests(requestsResult.value);
    else failures.push("requests");

    setErrors(failures);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = dir;
  }, [language, dir]);

  useEffect(() => {
    let active = true;
    (async () => {
      await load();
      if (active) setState("ready");
    })();
    return () => {
      active = false;
    };
  }, [load]);

  useEffect(() => {
    if (!session.authenticated) return;

    const refreshLiveData = () => {
      if (document.visibilityState === "visible") {
        void load();
      }
    };
    const intervalId = window.setInterval(refreshLiveData, 27_000);
    window.addEventListener("focus", refreshLiveData);
    document.addEventListener("visibilitychange", refreshLiveData);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshLiveData);
      document.removeEventListener("visibilitychange", refreshLiveData);
    };
  }, [load, session.authenticated]);

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function handleTransition(
    requestId: number,
    nextStatus: MaintenanceStatus,
    assignedPublicEngineerId?: number
  ) {
    const updated = await adminTransitionRequest(requestId, {
      status: nextStatus,
      ...(assignedPublicEngineerId ? { assigned_public_engineer_id: assignedPublicEngineerId } : {})
    });
    setRequests((current) => current.map((r) => (r.id === updated.id ? updated : r)));
  }

  async function handleCostUpdate(requestId: number, cost: string | null) {
    const updated = await setRequestCost(requestId, cost);
    setRequests((current) => current.map((request) => (request.id === updated.id ? updated : request)));
  }

  async function handleEngineerUpdate(id: number, payload: PublicEngineerPayload) {
    const updated = await updatePublicEngineer(id, payload);
    setEngineers((current) => current.map((engineer) => (engineer.id === id ? updated : engineer)));
    setEditingEngineer(null);
  }

  async function handleEngineerDelete(engineer: PublicEngineer) {
    if (!window.confirm(t.confirmDeleteEngineer)) return;
    setEngineerActionError(null);
    try {
      await deletePublicEngineer(engineer.id);
      setEngineers((current) => current.filter((item) => item.id !== engineer.id));
      if (loadEngineerManagementSession()?.id === engineer.id) {
        clearEngineerManagementSession();
      }
    } catch {
      setEngineerActionError(t.deleteEngineerError);
    }
  }

  const recurring = stats?.top_recurring_maintenance_issues ?? [];
  const maxTotal = Math.max(...recurring.map((issue) => issue.total), 1);
  const headlineMetrics = [
    {
      label: t.totalRequests,
      value: stats ? numberFormat.format(stats.total_requests) : "—",
      icon: <ClipboardList />,
      tint: "teal" as const
    },
    {
      label: t.openRequests,
      value: stats ? numberFormat.format(stats.total_open_requests) : "—",
      icon: <BarChart3 />,
      tint: "amber" as const
    },
    {
      label: t.completedRequests,
      value: stats ? numberFormat.format(stats.completed_tickets) : "—",
      icon: <CheckCircle2 />,
      tint: "green" as const
    },
    {
      label: t.completionRate,
      value: stats ? `${numberFormat.format(stats.completion_rate)}%` : "—",
      icon: <AlertTriangle />,
      tint: "coral" as const
    }
  ];
  const navigation: Array<{
    id: DashboardView;
    label: string;
    description: string;
    icon: typeof LayoutDashboard;
    count?: number;
  }> = [
    {
      id: "overview",
      label: t.overview,
      description: t.overviewDescription,
      icon: LayoutDashboard
    },
    {
      id: "requests",
      label: t.requests,
      description: t.requestsDescription,
      icon: ClipboardList,
      count: requests.length
    },
    {
      id: "engineers",
      label: t.engineers,
      description: t.engineersDescription,
      icon: HardHat,
      count: engineers.length
    },
    {
      id: "companies",
      label: t.companies,
      description: t.companiesDescription,
      icon: Building2,
      count: companies.length
    },
    {
      id: "reports",
      label: t.reports,
      description: t.reportsDescription,
      icon: FileText
    }
  ];
  const activeNavigation = navigation.find((item) => item.id === activeView) ?? navigation[0];

  // Gate: show login until the operator authenticates (client-side check).
  if (session.authenticated === null || state === "loading") {
    return (
      <main
        dir={dir}
        className="grid min-h-screen place-items-center bg-[#f4f6f8] px-4"
      >
        <div className="flex flex-col items-center gap-4 text-[#1567c6]">
          <Loader2 className="h-10 w-10 animate-spin" aria-hidden="true" />
          <p className="m-0 text-base font-bold">{t.loading}</p>
        </div>
      </main>
    );
  }

  if (!session.authenticated) {
    return (
      <DashboardLogin
        language={language}
        onLanguageChange={setLanguage}
        onAuthenticated={session.authenticate}
      />
    );
  }

  return (
    <div
      dir={dir}
      className="min-h-screen bg-[#f4f6f8] text-[#17233a] lg:grid lg:grid-cols-[248px_minmax(0,1fr)]"
    >
      <aside className="hidden h-screen flex-col border-e border-[#dfe4ea] bg-white lg:sticky lg:top-0 lg:flex">
        <div dir="ltr" className="flex h-[76px] items-center gap-3 border-b border-[#e8ecf1] px-5">
          <img
            src="/engiflow-logo.png"
            alt="EngiFlow"
            width={44}
            height={44}
            className="h-11 w-11 object-contain"
          />
          <span className="min-w-0">
            <strong className="block truncate text-base font-bold text-[#17233a]">EngiFlow</strong>
            <span className="block truncate text-xs font-medium text-[#718096]">{t.console}</span>
          </span>
        </div>

        <nav className="flex-1 space-y-1.5 overflow-y-auto p-3" aria-label={t.dashboardNavigation}>
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = item.id === activeView;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveView(item.id)}
                className={`flex h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-semibold transition-colors ${
                  active
                    ? "bg-[#eaf2fb] text-[#1769aa]"
                    : "bg-transparent text-[#536174] hover:bg-[#f2f5f8] hover:text-[#17233a]"
                }`}
              >
                <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-start">{item.label}</span>
                {item.count !== undefined && (
                  <span
                    className={`min-w-6 rounded-full px-1.5 py-0.5 text-center text-[11px] font-bold ${
                      active ? "bg-white text-[#1769aa]" : "bg-[#eef1f4] text-[#718096]"
                    }`}
                  >
                    {numberFormat.format(item.count)}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-[#e8ecf1] p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-[#536174]">
            <span className="h-2 w-2 rounded-full bg-[#2f9b61]" aria-hidden="true" />
            {t.liveData}
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-40 border-b border-[#dfe4ea] bg-white/95 backdrop-blur-md">
          <div className="flex min-h-[76px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="min-w-0">
              <h1 className="m-0 truncate text-lg font-bold text-[#17233a] sm:text-xl">
                {activeNavigation.label}
              </h1>
              <p className="m-0 mt-1 hidden truncate text-sm text-[#718096] sm:block">
                {activeNavigation.description}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <img
                src="/engiflow-logo.png"
                alt="EngiFlow"
                width={38}
                height={38}
                className="me-1 h-9 w-9 object-contain lg:hidden"
              />
            <button
              type="button"
              onClick={() => setLanguage(language === "ar" ? "en" : "ar")}
              title={t.language}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#dfe4ea] bg-white px-3 text-sm font-semibold text-[#536174] transition-colors hover:bg-[#f3f6f9]"
            >
              <Globe2 className="h-[18px] w-[18px]" aria-hidden="true" />
              <span className="hidden sm:inline">{language === "ar" ? "English" : "العربية"}</span>
            </button>
            <button
              type="button"
              onClick={refresh}
              disabled={refreshing}
              title={t.refresh}
              aria-label={t.refresh}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[#1769aa] text-white transition-colors hover:bg-[#12598f] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={`h-[18px] w-[18px] ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={session.signOut}
              title={t.signOut}
              aria-label={t.signOut}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#ead8d5] bg-white text-[#b84d3f] transition-colors hover:bg-[#fff4f2]"
            >
              <LogOut className="h-[18px] w-[18px]" aria-hidden="true" />
            </button>
          </div>
        </div>
          <nav
            className="flex gap-1 overflow-x-auto border-t border-[#edf0f3] px-3 py-2 lg:hidden"
            aria-label={t.dashboardNavigation}
          >
            {navigation.map((item) => {
              const Icon = item.icon;
              const active = item.id === activeView;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveView(item.id)}
                  className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-xs font-semibold ${
                    active ? "bg-[#eaf2fb] text-[#1769aa]" : "bg-transparent text-[#66758a]"
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </header>

        <main className="mx-auto grid w-full max-w-[1480px] gap-6 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
        {errors.length > 0 && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <span>
              {t.dataLoadError} ({errors.join(", ")})
            </span>
          </div>
        )}

        {activeView === "overview" && (
          <>
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label={t.dashboard}>
              {headlineMetrics.map((metric) => (
                <MetricCard
                  key={metric.label}
                  icon={metric.icon}
                  label={metric.label}
                  value={metric.value}
                  tint={metric.tint}
                />
              ))}
            </section>

        <section className="rounded-lg border border-[#dfe4ea] bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#eaf2fb] text-[#1769aa]">
              <BarChart3 className="h-5 w-5" aria-hidden="true" />
            </span>
            <h2 className="m-0 text-base font-bold text-[#17233a]">{t.recurringIssues}</h2>
          </div>
          {recurring.length === 0 ? (
            <p className="m-0 rounded-lg border border-dashed border-[#cfd7e1] bg-[#f8fafb] p-6 text-center text-sm text-[#66758a]">
              {t.noRequests}
            </p>
          ) : (
            <div className="grid gap-4">
              {recurring.map((issue) => (
                <div key={issue.issue_type} className="rounded-lg border border-[#edf0f3] bg-[#fbfcfd] p-4">
                  <div className="mb-3 flex items-center justify-between text-sm font-semibold text-[#344257]">
                    <span>{getSpecialtyLabel(issue.issue_type, language)}</span>
                    <span className="text-[#718096]">{numberFormat.format(issue.total)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#e3eeee]">
                    <span
                      className="block h-full rounded-full bg-[#2a75bd]"
                      style={{ width: `${Math.round((issue.total / maxTotal) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
          </>
        )}

        {activeView === "reports" && <ReportsPanel t={t} companies={companies} />}

        {activeView === "engineers" && (
          <>
        <AddEngineerCard
          language={language}
          t={t}
          onAdded={(engineer) => setEngineers((current) => [engineer, ...current])}
        />

        <section className="rounded-lg border border-[#dfe4ea] bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#eaf2fb] text-[#1769aa]">
                <HardHat className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2 className="m-0 text-base font-bold text-[#17233a]">{t.registeredEngineers}</h2>
            </div>
            <span className="rounded-full bg-[#eef2f6] px-3 py-1 text-xs font-bold text-[#536174]">
              {numberFormat.format(engineers.length)}
            </span>
          </div>

          {engineers.length === 0 ? (
            <p className="m-0 rounded-lg border border-dashed border-[#cfd7e1] bg-[#f8fafb] p-6 text-center text-sm text-[#66758a]">
              {t.noEngineers}
            </p>
          ) : (
            <>
              {engineerActionError && (
                <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                  {engineerActionError}
                </p>
              )}
              <div className="grid gap-3 xl:grid-cols-2">
              {engineers.map((engineer) => (
                <article
                  key={engineer.id}
                  className="rounded-lg border border-[#dfe4ea] bg-[#fbfcfd] p-4 transition-colors hover:border-[#b7c4d3]"
                >
                  <div className="flex items-start gap-3">
                    <EngineerAvatar
                      src={engineer.avatar}
                      alt={engineer.name}
                      onPreview={(src) => setPreviewImage({ src, alt: engineer.name })}
                    />
                    <div className="min-w-0 flex-1">
                      <strong className="block truncate text-base text-[#17233a]">{engineer.name}</strong>
                      <span className="block truncate text-sm text-[#66758a]">
                        {engineer.profession} · {getSpecialtyLabel(engineer.specialty, language)}
                      </span>
                      <span
                        className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-extrabold ${
                          engineer.is_available
                            ? "bg-[#e8f5ed] text-[#287a4e]"
                            : "bg-[#eef1f4] text-[#66758a]"
                        }`}
                      >
                        {engineer.is_available ? t.availableForWork : t.unavailableForWork}
                      </span>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => setEditingEngineer(engineer)}
                        title={t.editEngineer}
                        aria-label={t.editEngineer}
                        className="grid h-9 w-9 min-h-9 place-items-center rounded-lg border border-[#dfe4ea] bg-white text-[#1769aa] transition-colors hover:bg-[#eaf2fb]"
                      >
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleEngineerDelete(engineer)}
                        title={t.deleteEngineer}
                        aria-label={t.deleteEngineer}
                        className="grid h-9 w-9 min-h-9 place-items-center rounded-lg border border-[#ead8d5] bg-white text-[#b84d3f] transition-colors hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                  <dl className="mt-4 grid gap-2 border-t border-[#e5e9ee] pt-4 text-sm">
                    <Row label={t.departmentLabel}>{engineer.department || "—"}</Row>
                    <Row label={t.experienceYears}>
                      {numberFormat.format(engineer.experience_years)}
                    </Row>
                    <Row label={t.phone} ltr>
                      {engineer.phone}
                    </Row>
                    <Row label={t.email} ltr>
                      {engineer.email}
                    </Row>
                  </dl>
                </article>
              ))}
              </div>
            </>
          )}
        </section>
          </>
        )}

        {activeView === "companies" && (
        <section className="rounded-lg border border-[#dfe4ea] bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#eaf2fb] text-[#1769aa]">
                <Building2 className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2 className="m-0 text-base font-bold text-[#17233a]">{t.registeredCompanies}</h2>
            </div>
            <span className="rounded-full bg-[#eef2f6] px-3 py-1 text-xs font-bold text-[#536174]">
              {numberFormat.format(companies.length)}
            </span>
          </div>

          {companies.length === 0 ? (
            <p className="m-0 rounded-lg border border-dashed border-[#cfd7e1] bg-[#f8fafb] p-6 text-center text-sm text-[#66758a]">
              {t.noCompanies}
            </p>
          ) : (
            <div className="grid gap-3 xl:grid-cols-2">
              {companies.map((company) => (
                <article key={company.id} className="rounded-lg border border-[#dfe4ea] bg-[#fbfcfd] p-4">
                  <div className="flex items-start gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#eaf2fb] text-[#1769aa]">
                      <Building2 className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <strong className="block truncate text-base text-[#17233a]">{company.company_name}</strong>
                      {company.contact_name && (
                        <span className="block truncate text-sm text-[#5b6b85]">{company.contact_name}</span>
                      )}
                    </div>
                  </div>
                  <dl className="mt-4 grid gap-2 border-t border-[#e5e9ee] pt-4 text-sm">
                    <Row label={t.commercialRegister}>{company.commercial_register || "—"}</Row>
                    <Row label={t.phone} ltr>
                      {company.contact_phone || "—"}
                    </Row>
                    {company.email && (
                      <Row label={t.email} ltr icon={<Mail className="h-3.5 w-3.5" aria-hidden="true" />}>
                        {company.email}
                      </Row>
                    )}
                    <Row label={t.address} icon={<MapPin className="h-3.5 w-3.5" aria-hidden="true" />}>
                      {company.address ? (
                        <a
                          href={getGoogleMapsSearchUrl(company.address)}
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-[#1769aa] underline decoration-[#b8cee3] underline-offset-4"
                        >
                          {company.address}
                        </a>
                      ) : (
                        "—"
                      )}
                    </Row>
                  </dl>
                </article>
              ))}
            </div>
          )}
        </section>
        )}

        {activeView === "requests" && (
        <section className="rounded-lg border border-[#dfe4ea] bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#eaf2fb] text-[#1769aa]">
                <ClipboardList className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2 className="m-0 text-base font-bold text-[#17233a]">{t.requestsList}</h2>
            </div>
            <span className="rounded-full bg-[#eef2f6] px-3 py-1 text-xs font-bold text-[#536174]">
              {numberFormat.format(requests.length)}
            </span>
          </div>

          {requests.length === 0 ? (
            <p className="m-0 rounded-lg border border-dashed border-[#cfd7e1] bg-[#f8fafb] p-6 text-center text-sm text-[#66758a]">
              {t.noRequests}
            </p>
          ) : (
            <div className="grid gap-4">
              {requests.map((request) => (
                <RequestCard
                  key={request.id}
                  request={request}
                  engineers={engineers}
                  language={language}
                  t={t}
                  onTransition={handleTransition}
                  onCostUpdate={handleCostUpdate}
                />
              ))}
            </div>
          )}
        </section>
        )}
        </main>
      </div>

      {editingEngineer && (
        <EngineerEditorModal
          key={editingEngineer.id}
          engineer={editingEngineer}
          language={language}
          t={t}
          onClose={() => setEditingEngineer(null)}
          onSave={handleEngineerUpdate}
        />
      )}
      {previewImage && (
        <ImageLightbox
          src={previewImage.src}
          alt={previewImage.alt}
          onClose={() => setPreviewImage(null)}
        />
      )}
    </div>
  );
}

function ReportsPanel({
  t,
  companies
}: {
  t: (typeof copy)[Language];
  companies: PublicCompany[];
}) {
  const now = new Date();
  const [kind, setKind] = useState<ReportKind>("monthly");
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [companyId, setCompanyId] = useState("");

  const reportOptions: Array<{ value: ReportKind; label: string }> = [
    { value: "monthly", label: t.monthlyReport },
    { value: "company", label: t.companyReport },
    { value: "engineer", label: t.engineerReport },
    { value: "recurring", label: t.recurringReport },
    { value: "cost", label: t.costReport }
  ];
  const params =
    kind === "monthly"
      ? { year: Number(year), month: Number(month) }
      : kind === "company"
        ? { company_id: companyId ? Number(companyId) : undefined }
        : {};

  return (
    <section className="rounded-lg border border-[#dfe4ea] bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#eaf2fb] text-[#1769aa]">
          <FileText className="h-5 w-5" aria-hidden="true" />
        </span>
        <h2 className="m-0 text-base font-bold text-[#17233a]">{t.reports}</h2>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(220px,1.4fr)_minmax(180px,1fr)_auto] lg:items-end">
        <label className="grid gap-2 text-sm">
          <span className="font-extrabold text-[#5b6b85]">{t.reportType}</span>
          <select
            value={kind}
            onChange={(event) => setKind(event.target.value as ReportKind)}
            className="public-input"
          >
            {reportOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        {kind === "monthly" && (
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-2 text-sm">
              <span className="font-extrabold text-[#5b6b85]">{t.year}</span>
              <input
                type="number"
                min="2000"
                max="2100"
                value={year}
                onChange={(event) => setYear(event.target.value)}
                className="public-input"
              />
            </label>
            <label className="grid gap-2 text-sm">
              <span className="font-extrabold text-[#5b6b85]">{t.month}</span>
              <input
                type="number"
                min="1"
                max="12"
                value={month}
                onChange={(event) => setMonth(event.target.value)}
                className="public-input"
              />
            </label>
          </div>
        )}

        {kind === "company" && (
          <label className="grid gap-2 text-sm">
            <span className="font-extrabold text-[#5b6b85]">{t.companyName}</span>
            <select
              value={companyId}
              onChange={(event) => setCompanyId(event.target.value)}
              className="public-input"
            >
              <option value="">{t.allCompanies}</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.company_name}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="flex flex-wrap gap-2">
          <a
            href={getReportUrl(kind, "pdf", params)}
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#b84d3f] px-4 text-sm font-bold text-white transition-colors hover:bg-[#9f4035]"
            title={t.downloadPdf}
          >
            <FileText className="h-4 w-4" aria-hidden="true" />
            {t.downloadPdf}
          </a>
          <a
            href={getReportUrl(kind, "xlsx", params)}
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#2f8755] px-4 text-sm font-bold text-white transition-colors hover:bg-[#286f48]"
            title={t.downloadExcel}
          >
            <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
            {t.downloadExcel}
          </a>
        </div>
      </div>
    </section>
  );
}

function AddEngineerCard({
  language,
  t,
  onAdded
}: {
  language: Language;
  t: (typeof copy)[Language];
  onAdded: (engineer: PublicEngineer) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [department, setDepartment] = useState("");
  const [specialty, setSpecialty] = useState<MaintenanceSpecialty>("ELECTRICITY");
  const [profession, setProfession] = useState("");
  const [experienceYears, setExperienceYears] = useState("0");
  const [avatar, setAvatar] = useState<File | null>(null);
  const [avatarInputKey, setAvatarInputKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    if (!trimmedName || !trimmedPhone || !email.trim() || !department.trim() || !profession.trim()) {
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(false);
    try {
      const created = await createPublicEngineer({
        name: trimmedName,
        phone: trimmedPhone,
        email: email.trim(),
        department: department.trim(),
        specialty,
        profession: profession.trim(),
        experience_years: Number(experienceYears),
        avatar
      });
      onAdded(created);
      setName("");
      setPhone("");
      setEmail("");
      setDepartment("");
      setProfession("");
      setExperienceYears("0");
      setAvatar(null);
      setAvatarInputKey((key) => key + 1);
      setSuccess(true);
    } catch (caught) {
      setError(
        caught instanceof BackendUpgradeRequiredError
          ? language === "ar"
            ? "الخادم لم يُحدّث بعد لدعم صورة المهندس وحالة التوفر."
            : "The backend has not been updated for engineer photos and availability."
          : t.engineerAddError
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-lg border border-[#dfe4ea] bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#eaf2fb] text-[#1769aa]">
          <UserPlus className="h-5 w-5" aria-hidden="true" />
        </span>
        <h2 className="m-0 text-base font-bold text-[#17233a]">{t.addEngineerHere}</h2>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm">
          <span className="font-extrabold text-[#5b6b85]">{t.nameLabel}</span>
          <input
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="public-input"
          />
        </label>
        <label className="grid gap-2 text-sm">
          <span className="font-extrabold text-[#5b6b85]">{t.phone}</span>
          <input
            required
            type="tel"
            dir="ltr"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className="public-input text-start"
          />
        </label>
        <label className="grid gap-2 text-sm">
          <span className="font-extrabold text-[#5b6b85]">{t.email}</span>
          <input
            required
            type="email"
            dir="ltr"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="public-input text-start"
          />
        </label>
        <label className="grid gap-2 text-sm">
          <span className="font-extrabold text-[#5b6b85]">{t.departmentLabel}</span>
          <input
            required
            value={department}
            onChange={(event) => setDepartment(event.target.value)}
            className="public-input"
          />
        </label>
        <label className="grid gap-2 text-sm">
          <span className="font-extrabold text-[#5b6b85]">{t.specialtyLabel}</span>
          <select
            value={specialty}
            onChange={(event) => setSpecialty(event.target.value as MaintenanceSpecialty)}
            className="public-input"
          >
            {SPECIALTY_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {getSpecialtyLabel(value, language)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm">
          <span className="font-extrabold text-[#5b6b85]">{t.professionLabel}</span>
          <input
            required
            value={profession}
            onChange={(event) => setProfession(event.target.value)}
            className="public-input"
          />
        </label>
        <label className="grid gap-2 text-sm">
          <span className="font-extrabold text-[#5b6b85]">{t.experienceYears}</span>
          <input
            required
            type="number"
            min="0"
            max="60"
            value={experienceYears}
            onChange={(event) => setExperienceYears(event.target.value)}
            className="public-input"
          />
        </label>
        <label className="grid gap-2 text-sm">
          <span className="font-extrabold text-[#5b6b85]">{t.engineerPhoto}</span>
          <input
            key={avatarInputKey}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            onChange={(event) => setAvatar(event.target.files?.[0] ?? null)}
            className="public-input file:me-3 file:border-0 file:bg-transparent file:font-bold file:text-[#1567c6]"
          />
        </label>

        <div className="md:col-span-2">
          {error && (
            <p className="mt-1 rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>
          )}
          {success && !error && (
            <p className="mt-1 rounded-lg bg-[#eaf2fb] px-4 py-3 text-sm font-semibold text-[#1769aa]">
              {t.addEngineer} ✓
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="public-action mt-3 bg-[#1769aa] text-white transition-colors hover:bg-[#12598f] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <UserPlus className="h-4 w-4" aria-hidden="true" />
            )}
            {submitting ? t.saving : t.addEngineer}
          </button>
        </div>
      </form>
    </section>
  );
}

function EngineerEditorModal({
  engineer,
  language,
  t,
  onClose,
  onSave
}: {
  engineer: PublicEngineer;
  language: Language;
  t: (typeof copy)[Language];
  onClose: () => void;
  onSave: (id: number, payload: PublicEngineerPayload) => Promise<void>;
}) {
  const [name, setName] = useState(engineer.name);
  const [phone, setPhone] = useState(engineer.phone);
  const [email, setEmail] = useState(engineer.email);
  const [department, setDepartment] = useState(engineer.department);
  const [specialty, setSpecialty] = useState<MaintenanceSpecialty>(engineer.specialty);
  const [profession, setProfession] = useState(engineer.profession);
  const [experienceYears, setExperienceYears] = useState(String(engineer.experience_years));
  const [avatar, setAvatar] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave(engineer.id, {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        department: department.trim(),
        specialty,
        profession: profession.trim(),
        experience_years: Number(experienceYears),
        avatar
      });
    } catch {
      setError(t.editEngineerError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[90] grid place-items-center overflow-y-auto bg-[#07142c]/55 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={t.editEngineer}
    >
      <form
        onSubmit={submit}
        className="my-auto w-full max-w-3xl rounded-lg bg-white p-5 shadow-2xl sm:p-7"
      >
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <EngineerAvatar src={engineer.avatar} alt={engineer.name} className="h-14 w-14" />
            <div className="min-w-0">
              <h2 className="m-0 truncate text-xl font-extrabold text-[#15294d]">{t.editEngineer}</h2>
              <p className="m-0 mt-1 truncate text-sm text-[#5b6b85]">{engineer.name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#eef3f8] text-[#15294d]"
            aria-label={t.cancel}
          >
            <XCircle className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <EditorField label={t.nameLabel} value={name} onChange={setName} required />
          <EditorField label={t.phone} value={phone} onChange={setPhone} type="tel" dir="ltr" required />
          <EditorField label={t.email} value={email} onChange={setEmail} type="email" dir="ltr" required />
          <EditorField label={t.departmentLabel} value={department} onChange={setDepartment} required />
          <label className="grid gap-2 text-sm">
            <span className="font-extrabold text-[#5b6b85]">{t.specialtyLabel}</span>
            <select
              value={specialty}
              onChange={(event) => setSpecialty(event.target.value as MaintenanceSpecialty)}
              className="public-input"
            >
              {SPECIALTY_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {getSpecialtyLabel(value, language)}
                </option>
              ))}
            </select>
          </label>
          <EditorField label={t.professionLabel} value={profession} onChange={setProfession} required />
          <EditorField
            label={t.experienceYears}
            value={experienceYears}
            onChange={setExperienceYears}
            type="number"
            min="0"
            max="60"
            required
          />
          <label className="grid gap-2 text-sm">
            <span className="font-extrabold text-[#5b6b85]">{t.engineerPhoto}</span>
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              onChange={(event) => setAvatar(event.target.files?.[0] ?? null)}
              className="public-input file:me-3 file:border-0 file:bg-transparent file:font-bold file:text-[#1567c6]"
            />
          </label>
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p>
        )}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="public-action bg-[#eef3f8] text-[#15294d]"
          >
            {t.cancel}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="public-action bg-[#1f86ec] text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
            {saving ? t.saving : t.saveChanges}
          </button>
        </div>
      </form>
    </div>
  );
}

function EditorField({
  label,
  value,
  onChange,
  type = "text",
  dir,
  min,
  max,
  required
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  dir?: "ltr" | "rtl";
  min?: string;
  max?: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="font-extrabold text-[#5b6b85]">{label}</span>
      <input
        type={type}
        dir={dir}
        min={min}
        max={max}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="public-input"
      />
    </label>
  );
}

function RequestCard({
  request,
  engineers,
  language,
  t,
  onTransition,
  onCostUpdate
}: {
  request: PublicTrackedRequest;
  engineers: PublicEngineer[];
  language: Language;
  t: (typeof copy)[Language];
  onTransition: (id: number, status: MaintenanceStatus, engineerId?: number) => Promise<void>;
  onCostUpdate: (id: number, cost: string | null) => Promise<void>;
}) {
  const [selectedEngineer, setSelectedEngineer] = useState<number | "">(
    request.assigned_public_engineer ?? ""
  );
  const [busy, setBusy] = useState<MaintenanceStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [costValue, setCostValue] = useState(request.cost ?? "");
  const [costBusy, setCostBusy] = useState(false);
  const [costError, setCostError] = useState<string | null>(null);
  const [costSaved, setCostSaved] = useState(false);

  useEffect(() => {
    setCostValue(request.cost ?? "");
  }, [request.cost]);

  // Engineers that match this request's specialty (the only valid assignees).
  const matchingEngineers = useMemo(
    () => engineers.filter((engineer) => engineer.specialty === request.issue_type && engineer.is_available),
    [engineers, request.issue_type]
  );

  async function go(nextStatus: MaintenanceStatus, includeEngineer = false) {
    setError(null);
    setBusy(nextStatus);
    try {
      const engineerId =
        includeEngineer && typeof selectedEngineer === "number" ? selectedEngineer : undefined;
      if (includeEngineer && !engineerId) {
        setError(t.selectEngineerFirst);
        setBusy(null);
        return;
      }
      await onTransition(request.id, nextStatus, engineerId);
    } catch (transitionError) {
      setError(transitionError instanceof Error ? transitionError.message : t.transitionError);
    } finally {
      setBusy(null);
    }
  }

  async function saveCost() {
    setCostBusy(true);
    setCostError(null);
    setCostSaved(false);
    try {
      await onCostUpdate(request.id, costValue.trim() || null);
      setCostSaved(true);
    } catch {
      setCostError(t.costSaveError);
    } finally {
      setCostBusy(false);
    }
  }

  const currentStageIdx = stageIndex(request.status);
  const isRejected = request.status === "REJECTED";
  const isClosed = request.status === "CLOSED";
  const isTerminal = isClosed || isRejected || request.status === "COMPLETED";

  return (
    <article className="rounded-lg border border-[#dfe4ea] bg-[#fbfcfd] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <strong className="block truncate text-base text-[#15294d]">
            #{request.id} — {request.client_company_name}
          </strong>
          <span className="block truncate text-sm text-[#5b6b85]">
            {getSpecialtyLabel(request.issue_type, language)} ·{" "}
            {getPriorityLabel(request.priority, language)}
          </span>
        </div>
        <StatusPill status={request.status} t={t} />
      </div>

      <Stepper request={request} language={language} t={t} />

      {request.assigned_engineer_name && (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-[#e5e9ee] bg-white px-4 py-3 text-sm">
          <UserCheck className="h-4 w-4 text-[#1567c6]" aria-hidden="true" />
          <span className="font-extrabold text-[#15294d]">{request.assigned_engineer_name}</span>
          {request.assigned_engineer_phone && (
            <span dir="ltr" className="text-[#1567c6]">
              · {request.assigned_engineer_phone}
            </span>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-end gap-3 border-y border-[#d7e4f5] py-4">
        <label className="grid min-w-[180px] flex-1 gap-2 text-sm">
          <span className="flex items-center gap-2 font-extrabold text-[#5b6b85]">
            <Banknote className="h-4 w-4 text-[#1567c6]" aria-hidden="true" />
            {t.maintenanceCost}
          </span>
          <input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={costValue}
            onChange={(event) => {
              setCostValue(event.target.value);
              setCostSaved(false);
            }}
            className="public-input"
          />
        </label>
        <button
          type="button"
          onClick={saveCost}
          disabled={costBusy}
          className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#344257] px-4 text-sm font-bold text-white transition-colors hover:bg-[#273448] disabled:cursor-not-allowed disabled:opacity-60"
          title={t.save}
        >
          {costBusy ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="h-4 w-4" aria-hidden="true" />
          )}
          {costBusy ? t.saving : t.save}
        </button>
        {costSaved && <span className="text-sm font-bold text-[#2c8b4b]">{t.costSaved}</span>}
        {costError && <span className="text-sm font-bold text-[#c84d3a]">{costError}</span>}
      </div>

      {!isTerminal && (
        <div className="mt-4 grid gap-3 rounded-lg border border-[#dfe4ea] bg-white p-4">
          <p className="m-0 text-xs font-extrabold uppercase tracking-wider text-[#1567c6]">
            {t.actions}
          </p>

          {request.status === "NEW" && (
            <div className="flex flex-wrap gap-2">
              <ActionButton
                tone="primary"
                icon={<PlayCircle className="h-4 w-4" />}
                onClick={() => go("UNDER_REVIEW")}
                busy={busy === "UNDER_REVIEW"}
              >
                {t.acceptRequest}
              </ActionButton>
              <ActionButton
                tone="danger"
                icon={<XCircle className="h-4 w-4" />}
                onClick={() => go("REJECTED")}
                busy={busy === "REJECTED"}
              >
                {t.rejectRequest}
              </ActionButton>
            </div>
          )}

          {request.status === "UNDER_REVIEW" && (
            <>
              {matchingEngineers.length === 0 ? (
                <p className="m-0 text-sm text-[#8a6a18]">{t.specialtyMismatch}</p>
              ) : (
                <select
                  value={selectedEngineer}
                  onChange={(event) =>
                    setSelectedEngineer(event.target.value ? Number(event.target.value) : "")
                  }
                  className="public-input"
                >
                  <option value="">{t.assignEngineer}</option>
                  {matchingEngineers.map((engineer) => (
                    <option key={engineer.id} value={engineer.id}>
                      {engineer.name} — {engineer.phone}
                    </option>
                  ))}
                </select>
              )}
              <div className="flex flex-wrap gap-2">
                <ActionButton
                  tone="primary"
                  icon={<UserCheck className="h-4 w-4" />}
                  onClick={() => go("ASSIGNED", true)}
                  busy={busy === "ASSIGNED"}
                  disabled={matchingEngineers.length === 0}
                >
                  {t.assignEngineer}
                </ActionButton>
                <ActionButton
                  tone="danger"
                  icon={<XCircle className="h-4 w-4" />}
                  onClick={() => go("REJECTED")}
                  busy={busy === "REJECTED"}
                >
                  {t.rejectRequest}
                </ActionButton>
              </div>
            </>
          )}

          {request.status === "ASSIGNED" && (
            <div className="flex flex-wrap gap-2">
              <ActionButton
                tone="primary"
                icon={<Play className="h-4 w-4" />}
                onClick={() => go("IN_PROGRESS")}
                busy={busy === "IN_PROGRESS"}
              >
                {t.startWork}
              </ActionButton>
            </div>
          )}

          {(request.status === "IN_PROGRESS" || request.status === "WAITING_SPARE_PARTS") && (
            <div className="flex flex-wrap gap-2">
              <ActionButton
                tone="success"
                icon={<CheckCircle2 className="h-4 w-4" />}
                onClick={() => go("COMPLETED")}
                busy={busy === "COMPLETED"}
              >
                {t.markCompleted}
              </ActionButton>
              {request.status === "IN_PROGRESS" && (
                <ActionButton
                  tone="neutral"
                  icon={<Wrench className="h-4 w-4" />}
                  onClick={() => go("WAITING_SPARE_PARTS")}
                  busy={busy === "WAITING_SPARE_PARTS"}
                >
                  {t.waitParts}
                </ActionButton>
              )}
            </div>
          )}

          {error && (
            <p className="m-0 rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>
          )}
        </div>
      )}

      {request.status === "COMPLETED" && (
        <div className="mt-4 flex flex-wrap gap-2">
          <ActionButton
            tone="primary"
            icon={<CheckCircle2 className="h-4 w-4" />}
            onClick={() => go("CLOSED")}
            busy={busy === "CLOSED"}
          >
            {t.closeRequest}
          </ActionButton>
        </div>
      )}

      <p className="m-0 mt-4 text-xs text-[#7088a0]">
        {new Date(request.created_at).toLocaleDateString(language === "ar" ? "ar-LY" : "en-GB", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        })}
      </p>

      {currentStageIdx < 0 && isRejected && (
        <p className="m-0 mt-2 text-xs font-bold text-[#c84d3a]">{t.stageRejected}</p>
      )}
    </article>
  );
}

function Stepper({
  request,
  language,
  t
}: {
  request: PublicTrackedRequest;
  language: Language;
  t: (typeof copy)[Language];
}) {
  const currentIdx = stageIndex(request.status);
  const stageLabels: Record<MaintenanceStatus, string> = {
    NEW: t.stageNew,
    UNDER_REVIEW: t.stageReview,
    ASSIGNED: t.stageAssigned,
    IN_PROGRESS: t.stageProgress,
    WAITING_SPARE_PARTS: t.stageProgress,
    COMPLETED: t.stageCompleted,
    REJECTED: t.stageRejected,
    CLOSED: t.stageClosed
  };
  return (
    <div className="mt-5">
      <p className="m-0 mb-3 text-xs font-extrabold uppercase tracking-wider text-[#1567c6]">
        {t.workflow}
      </p>
      <ol className="grid grid-cols-5 gap-1">
        {WORKFLOW_STAGES.map((stage, idx) => {
          const reached = currentIdx >= idx;
          const isCurrent = currentIdx === idx;
          const ts = stageTimestamp(request, stage);
          return (
            <li key={stage} className="flex flex-col items-center gap-1 text-center">
              <span
                className={`grid h-8 w-8 place-items-center rounded-full text-xs font-extrabold transition-colors ${
                  reached
                    ? isCurrent
                      ? "bg-[#1f86ec] text-white shadow-md shadow-[#1f86ec]/30"
                      : "bg-[#bfd2ee] text-[#1567c6]"
                    : "bg-[#eef3f1] text-[#a3b1ad]"
                }`}
              >
                {idx + 1}
              </span>
              <span
                className={`text-[10px] font-bold leading-tight ${
                  reached ? "text-[#15294d]" : "text-[#a3b1ad]"
                }`}
              >
                {stageLabels[stage]}
              </span>
              {ts && reached && (
                <span className="text-[9px] text-[#7088a0]">
                  {new Date(ts).toLocaleDateString(language === "ar" ? "ar-LY" : "en-GB", {
                    month: "short",
                    day: "numeric"
                  })}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function StatusPill({ status, t }: { status: MaintenanceStatus; t: (typeof copy)[Language] }) {
  const styles: Record<MaintenanceStatus, string> = {
    NEW: "bg-[#e3edfb] text-[#1567c6]",
    UNDER_REVIEW: "bg-[#f7ecd6] text-[#b87512]",
    ASSIGNED: "bg-[#dfeefd] text-[#1f86ec]",
    IN_PROGRESS: "bg-[#dfeefd] text-[#1f86ec]",
    WAITING_SPARE_PARTS: "bg-[#f7ecd6] text-[#b87512]",
    COMPLETED: "bg-[#e3f3e7] text-[#2c8b4b]",
    REJECTED: "bg-[#fbe5e0] text-[#c84d3a]",
    CLOSED: "bg-[#eef3f1] text-[#5b6b85]"
  };
  const labels: Record<MaintenanceStatus, string> = {
    NEW: t.stageNew,
    UNDER_REVIEW: t.stageReview,
    ASSIGNED: t.stageAssigned,
    IN_PROGRESS: t.stageProgress,
    WAITING_SPARE_PARTS: t.waitParts,
    COMPLETED: t.stageCompleted,
    REJECTED: t.stageRejected,
    CLOSED: t.stageClosed
  };
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function ActionButton({
  children,
  icon,
  onClick,
  busy,
  disabled,
  tone
}: {
  children: ReactNode;
  icon: ReactNode;
  onClick: () => void;
  busy?: boolean;
  disabled?: boolean;
  tone: "primary" | "danger" | "success" | "neutral";
}) {
  const tones = {
    primary: "bg-[#1f86ec] hover:bg-[#1567c6]",
    danger: "bg-[#c84d3a] hover:bg-[#a93f2f]",
    success: "bg-[#2c8b4b] hover:bg-[#236e3c]",
    neutral: "bg-[#5b6b85] hover:bg-[#4a5b56]"
  } as const;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${tones[tone]}`}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : icon}
      {children}
    </button>
  );
}

function MetricCard({
  icon,
  label,
  value,
  tint
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tint: "teal" | "green" | "amber" | "coral";
}) {
  const tints: Record<typeof tint, { bg: string; text: string }> = {
    teal: { bg: "bg-[#dde9f9]", text: "text-[#1567c6]" },
    green: { bg: "bg-[#e3f3e7]", text: "text-[#2c8b4b]" },
    amber: { bg: "bg-[#f7ecd6]", text: "text-[#b87512]" },
    coral: { bg: "bg-[#fbe5e0]", text: "text-[#c84d3a]" }
  };
  const t = tints[tint];
  return (
    <div className="rounded-lg border border-[#dfe4ea] bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="m-0 truncate text-xs font-bold text-[#718096]">{label}</p>
        <span className={`grid h-10 w-10 place-items-center rounded-lg ${t.bg} ${t.text}`}>{icon}</span>
      </div>
      <strong className={`mt-4 block text-3xl font-bold ${t.text}`}>{value}</strong>
    </div>
  );
}

function Row({
  label,
  children,
  ltr,
  icon
}: {
  label: string;
  children: ReactNode;
  ltr?: boolean;
  icon?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#7088a0]">
        {icon}
        {label}
      </dt>
      <dd
        dir={ltr ? "ltr" : undefined}
        className="m-0 min-w-0 max-w-[60%] truncate text-end text-sm font-bold text-[#15294d]"
      >
        {children}
      </dd>
    </div>
  );
}

export default PublicDashboard;
