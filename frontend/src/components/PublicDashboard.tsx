"use client";

import {
  AlertTriangle,
  BarChart3,
  Building2,
  CheckCircle2,
  ClipboardList,
  Globe2,
  HardHat,
  Loader2,
  LogOut,
  Mail,
  MapPin,
  Phone,
  Play,
  PlayCircle,
  RefreshCw,
  UserCheck,
  UserPlus,
  Users,
  Wrench,
  XCircle
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import {
  adminTransitionRequest,
  createPublicEngineer,
  getPublicCompanies,
  getPublicEngineers,
  getPublicImpactStatistics,
  getPublicRequestsList
} from "@/src/lib/api";
import { copy, getPriorityLabel, getSpecialtyLabel, languages, statusLabels } from "@/src/lib/i18n";
import { DashboardLogin, useDashboardSession } from "./DashboardLogin";
import type {
  Language,
  MaintenanceSpecialty,
  MaintenanceStatus,
  PublicCompany,
  PublicEngineer,
  PublicImpactStatistics,
  PublicTrackedRequest
} from "@/src/lib/types";

type FetchState = "idle" | "loading" | "ready" | "error";

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

export function PublicDashboard() {
  const [language, setLanguage] = useState<Language>("ar");
  const session = useDashboardSession();
  const [stats, setStats] = useState<PublicImpactStatistics | null>(null);
  const [engineers, setEngineers] = useState<PublicEngineer[]>([]);
  const [companies, setCompanies] = useState<PublicCompany[]>([]);
  const [requests, setRequests] = useState<PublicTrackedRequest[]>([]);
  const [state, setState] = useState<FetchState>("loading");
  const [errors, setErrors] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const t = copy[language];
  const dir = languages[language].dir;
  const isRtl = dir === "rtl";
  const numberFormat = useMemo(
    () => new Intl.NumberFormat(language === "ar" ? "ar-LY" : "en-US"),
    [language]
  );

  const load = useCallback(async () => {
    const failures: string[] = [];
    const [statsResult, engineersResult, companiesResult, requestsResult] = await Promise.allSettled([
      getPublicImpactStatistics(),
      getPublicEngineers(),
      getPublicCompanies(),
      getPublicRequestsList()
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

  // Gate: show login until the operator authenticates (client-side check).
  if (session.authenticated === null || state === "loading") {
    return (
      <main
        dir={dir}
        className="grid min-h-screen place-items-center bg-[linear-gradient(135deg,#eef4fc_0%,#dde9f9_55%,#f0f5fc_100%)] px-4"
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
      className="min-h-screen bg-[linear-gradient(135deg,#f8fff9_0%,#edf9fb_45%,#fffaf2_100%)] pb-16 text-[#15294d]"
    >
      <header className="sticky top-0 z-40 border-b border-white/70 bg-[#fbfdff]/85 backdrop-blur-xl">
        <div className="container mx-auto flex min-h-[72px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <span dir="ltr" className="flex items-center gap-3">
            <img
              src="/engiflow-logo.png"
              alt="EngiFlow"
              width={56}
              height={56}
              className="h-14 w-14 object-contain"
            />
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#7088a0]">
              {t.console}
            </span>
          </span>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setLanguage(language === "ar" ? "en" : "ar")}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-white/85 px-4 text-sm font-bold text-[#5b6b85] shadow-sm transition-all hover:-translate-y-0.5 hover:bg-[#e3edfb]"
            >
              <Globe2 className="h-4 w-4" aria-hidden="true" />
              {language === "ar" ? "English" : "العربية"}
            </button>
            <button
              type="button"
              onClick={refresh}
              disabled={refreshing}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-[#1f86ec] px-5 text-sm font-extrabold text-white shadow-lg shadow-[#1f86ec]/20 transition-all hover:-translate-y-0.5 hover:bg-[#1567c6] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" />
              {t.refresh}
            </button>
            <button
              type="button"
              onClick={session.signOut}
              title={language === "ar" ? "خروج" : "Sign out"}
              aria-label={language === "ar" ? "خروج" : "Sign out"}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/85 text-[#d9534f] shadow-sm transition-all hover:-translate-y-0.5 hover:bg-red-50"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto grid gap-8 px-4 py-8 sm:px-6 lg:py-12">
        {errors.length > 0 && (
          <div className="flex items-start gap-3 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <span>
              {t.dataLoadError} ({errors.join(", ")})
            </span>
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label={t.dashboard}>
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

        <section className="rounded-[2rem] bg-white/76 p-6 shadow-2xl shadow-[#a8c2e6]/20 backdrop-blur-xl sm:p-7">
          <div className="mb-5 flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#dde9f9] text-[#1567c6]">
              <BarChart3 className="h-6 w-6" aria-hidden="true" />
            </span>
            <h2 className="m-0 text-xl font-extrabold text-[#15294d]">{t.recurringIssues}</h2>
          </div>
          {recurring.length === 0 ? (
            <p className="m-0 rounded-2xl border border-dashed border-[#bfd2ee] bg-[#f0f5fc] p-6 text-center text-sm text-[#5b6b85]">
              {t.noRequests}
            </p>
          ) : (
            <div className="grid gap-4">
              {recurring.map((issue) => (
                <div key={issue.issue_type} className="rounded-3xl bg-[#fbfdff] p-4">
                  <div className="mb-3 flex items-center justify-between text-sm font-extrabold text-[#1c3263]">
                    <span>{getSpecialtyLabel(issue.issue_type, language)}</span>
                    <span className="text-[#7088a0]">{numberFormat.format(issue.total)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#e3eeee]">
                    <span
                      className="block h-full rounded-full bg-[#1f86ec]"
                      style={{ width: `${Math.round((issue.total / maxTotal) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <AddEngineerCard
          language={language}
          t={t}
          onAdded={(engineer) => setEngineers((current) => [engineer, ...current])}
        />

        <section className="rounded-[2rem] bg-white/76 p-6 shadow-2xl shadow-[#a8c2e6]/20 backdrop-blur-xl sm:p-7">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#dde9f9] text-[#1567c6]">
                <HardHat className="h-6 w-6" aria-hidden="true" />
              </span>
              <h2 className="m-0 text-xl font-extrabold text-[#15294d]">{t.registeredEngineers}</h2>
            </div>
            <span className="rounded-full bg-[#e3edfb] px-3 py-1 text-sm font-extrabold text-[#1567c6]">
              {numberFormat.format(engineers.length)}
            </span>
          </div>

          {engineers.length === 0 ? (
            <p className="m-0 rounded-2xl border border-dashed border-[#bfd2ee] bg-[#f0f5fc] p-6 text-center text-sm text-[#5b6b85]">
              {t.noEngineers}
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {engineers.map((engineer) => (
                <article
                  key={engineer.id}
                  className="rounded-3xl bg-[#f4f8fd] p-4 transition-colors hover:bg-[#e3edfb]"
                >
                  <div className="flex items-center gap-3">
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#dde9f9] text-[#1567c6] shadow-sm">
                      <HardHat className="h-6 w-6" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <strong className="block truncate text-base text-[#15294d]">{engineer.name}</strong>
                      <span className="block truncate text-sm text-[#5b6b85]">
                        {getSpecialtyLabel(engineer.specialty, language)}
                      </span>
                    </div>
                  </div>
                  <div
                    className={`mt-3 flex items-center gap-2 text-sm font-bold text-[#1567c6] ${isRtl ? "justify-end" : "justify-start"}`}
                  >
                    <Phone className="h-4 w-4" aria-hidden="true" />
                    <span dir="ltr">{engineer.phone}</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-[2rem] bg-white/76 p-6 shadow-2xl shadow-[#a8c2e6]/20 backdrop-blur-xl sm:p-7">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#dde9f9] text-[#1567c6]">
                <Building2 className="h-6 w-6" aria-hidden="true" />
              </span>
              <h2 className="m-0 text-xl font-extrabold text-[#15294d]">{t.registeredCompanies}</h2>
            </div>
            <span className="rounded-full bg-[#e3edfb] px-3 py-1 text-sm font-extrabold text-[#1567c6]">
              {numberFormat.format(companies.length)}
            </span>
          </div>

          {companies.length === 0 ? (
            <p className="m-0 rounded-2xl border border-dashed border-[#bfd2ee] bg-[#f0f5fc] p-6 text-center text-sm text-[#5b6b85]">
              {t.noCompanies}
            </p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {companies.map((company) => (
                <article key={company.id} className="rounded-3xl bg-[#f4f8fd] p-5">
                  <div className="flex items-start gap-3">
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#dde9f9] text-[#1567c6] shadow-sm">
                      <Building2 className="h-6 w-6" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <strong className="block truncate text-lg text-[#15294d]">{company.company_name}</strong>
                      {company.contact_name && (
                        <span className="block truncate text-sm text-[#5b6b85]">{company.contact_name}</span>
                      )}
                    </div>
                  </div>
                  <dl className="mt-4 grid gap-2 text-sm">
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
                      {company.address || "—"}
                    </Row>
                  </dl>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-[2rem] bg-white/76 p-6 shadow-2xl shadow-[#a8c2e6]/20 backdrop-blur-xl sm:p-7">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#dde9f9] text-[#1567c6]">
                <ClipboardList className="h-6 w-6" aria-hidden="true" />
              </span>
              <h2 className="m-0 text-xl font-extrabold text-[#15294d]">{t.requestsList}</h2>
            </div>
            <span className="rounded-full bg-[#e3edfb] px-3 py-1 text-sm font-extrabold text-[#1567c6]">
              {numberFormat.format(requests.length)}
            </span>
          </div>

          {requests.length === 0 ? (
            <p className="m-0 rounded-2xl border border-dashed border-[#bfd2ee] bg-[#f0f5fc] p-6 text-center text-sm text-[#5b6b85]">
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
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
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
  const [specialty, setSpecialty] = useState<MaintenanceSpecialty>("ELECTRICITY");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    if (!trimmedName || !trimmedPhone) return;
    setSubmitting(true);
    setError(null);
    setSuccess(false);
    try {
      const created = await createPublicEngineer({ name: trimmedName, phone: trimmedPhone, specialty });
      onAdded(created);
      setName("");
      setPhone("");
      setSuccess(true);
    } catch {
      setError(t.engineerAddError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-[2rem] bg-white/76 p-6 shadow-2xl shadow-[#a8c2e6]/20 backdrop-blur-xl sm:p-7">
      <div className="mb-5 flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#dde9f9] text-[#1567c6]">
          <UserPlus className="h-6 w-6" aria-hidden="true" />
        </span>
        <h2 className="m-0 text-xl font-extrabold text-[#15294d]">{t.addEngineerHere}</h2>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-3">
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

        <div className="md:col-span-3">
          {error && (
            <p className="mt-1 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p>
          )}
          {success && !error && (
            <p className="mt-1 rounded-2xl bg-[#e3edfb] px-4 py-3 text-sm font-bold text-[#1567c6]">
              {t.addEngineer} ✓
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#1f86ec] px-6 py-3 text-sm font-extrabold text-white shadow-lg shadow-[#1f86ec]/20 transition-all hover:-translate-y-0.5 hover:bg-[#1567c6] disabled:cursor-not-allowed disabled:opacity-60"
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

function RequestCard({
  request,
  engineers,
  language,
  t,
  onTransition
}: {
  request: PublicTrackedRequest;
  engineers: PublicEngineer[];
  language: Language;
  t: (typeof copy)[Language];
  onTransition: (id: number, status: MaintenanceStatus, engineerId?: number) => Promise<void>;
}) {
  const [selectedEngineer, setSelectedEngineer] = useState<number | "">(
    request.assigned_public_engineer ?? ""
  );
  const [busy, setBusy] = useState<MaintenanceStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Engineers that match this request's specialty (the only valid assignees).
  const matchingEngineers = useMemo(
    () => engineers.filter((e) => e.specialty === request.issue_type),
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

  const currentStageIdx = stageIndex(request.status);
  const isRejected = request.status === "REJECTED";
  const isClosed = request.status === "CLOSED";
  const isTerminal = isClosed || isRejected || request.status === "COMPLETED";

  return (
    <article className="rounded-3xl bg-[#f4f8fd] p-5">
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
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm">
          <UserCheck className="h-4 w-4 text-[#1567c6]" aria-hidden="true" />
          <span className="font-extrabold text-[#15294d]">{request.assigned_engineer_name}</span>
          {request.assigned_engineer_phone && (
            <span dir="ltr" className="text-[#1567c6]">
              · {request.assigned_engineer_phone}
            </span>
          )}
        </div>
      )}

      {!isTerminal && (
        <div className="mt-4 grid gap-3 rounded-2xl border border-dashed border-[#bfd2ee] bg-white p-4">
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
            <p className="m-0 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p>
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
      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-extrabold text-white shadow-sm transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 ${tones[tone]}`}
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
    <div className="rounded-[2rem] bg-white/80 p-5 shadow-xl shadow-[#a8c2e6]/15 backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <p className="m-0 truncate text-xs font-extrabold uppercase tracking-wider text-[#7088a0]">{label}</p>
        <span className={`grid h-10 w-10 place-items-center rounded-2xl ${t.bg} ${t.text}`}>{icon}</span>
      </div>
      <strong className={`mt-4 block text-4xl font-extrabold ${t.text}`}>{value}</strong>
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
