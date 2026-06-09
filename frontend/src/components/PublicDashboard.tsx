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
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Users
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import {
  getPublicCompanies,
  getPublicEngineers,
  getPublicImpactStatistics,
  getPublicRequestsList
} from "@/src/lib/api";
import { copy, getPriorityLabel, getSpecialtyLabel, languages, statusLabels } from "@/src/lib/i18n";
import type {
  Language,
  PublicCompany,
  PublicEngineer,
  PublicImpactStatistics,
  PublicTrackedRequest
} from "@/src/lib/types";

type FetchState = "idle" | "loading" | "ready" | "error";

export function PublicDashboard() {
  const [language, setLanguage] = useState<Language>("ar");
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

    if (statsResult.status === "fulfilled") {
      setStats(statsResult.value);
    } else {
      failures.push("impact");
    }
    if (engineersResult.status === "fulfilled") {
      setEngineers(engineersResult.value);
    } else {
      failures.push("engineers");
    }
    if (companiesResult.status === "fulfilled") {
      setCompanies(companiesResult.value);
    } else {
      failures.push("companies");
    }
    if (requestsResult.status === "fulfilled") {
      setRequests(requestsResult.value);
    } else {
      failures.push("requests");
    }

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
      if (active) {
        setState("ready");
      }
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

  if (state === "loading") {
    return (
      <main
        dir={dir}
        className="grid min-h-screen place-items-center bg-[linear-gradient(135deg,#f8fff9_0%,#edf9fb_45%,#fffaf2_100%)] px-4"
      >
        <div className="flex flex-col items-center gap-4 text-[#0d827a]">
          <Loader2 className="h-10 w-10 animate-spin" aria-hidden="true" />
          <p className="m-0 text-base font-bold">{t.loading}</p>
        </div>
      </main>
    );
  }

  return (
    <div
      dir={dir}
      className="min-h-screen bg-[linear-gradient(135deg,#f8fff9_0%,#edf9fb_45%,#fffaf2_100%)] pb-16 text-[#1b2b27]"
    >
      <header className="sticky top-0 z-40 border-b border-white/70 bg-[#fbfdf9]/85 backdrop-blur-xl">
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
              className="inline-flex h-11 items-center gap-2 rounded-full bg-white/85 px-4 text-sm font-bold text-[#46635d] shadow-sm transition-all hover:-translate-y-0.5 hover:bg-[#edf8f7]"
            >
              <Globe2 className="h-4 w-4" aria-hidden="true" />
              {language === "ar" ? "English" : "العربية"}
            </button>
            <button
              type="button"
              onClick={refresh}
              disabled={refreshing}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-[#0f8d86] px-5 text-sm font-extrabold text-white shadow-lg shadow-[#0f8d86]/20 transition-all hover:-translate-y-0.5 hover:bg-[#0d7b75] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" />
              {t.refresh}
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

        <section className="rounded-[2rem] bg-white/76 p-6 shadow-2xl shadow-[#a5ccd0]/20 backdrop-blur-xl sm:p-7">
          <div className="mb-5 flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#e1f4f3] text-[#0d827a]">
              <BarChart3 className="h-6 w-6" aria-hidden="true" />
            </span>
            <h2 className="m-0 text-xl font-extrabold text-[#17312d]">{t.recurringIssues}</h2>
          </div>
          {recurring.length === 0 ? (
            <p className="m-0 rounded-2xl border border-dashed border-[#cfe6e3] bg-[#f4faf8] p-6 text-center text-sm text-[#657872]">
              {t.noRequests}
            </p>
          ) : (
            <div className="grid gap-4">
              {recurring.map((issue) => (
                <div key={issue.issue_type} className="rounded-3xl bg-[#fbfdf9] p-4">
                  <div className="mb-3 flex items-center justify-between text-sm font-extrabold text-[#24433d]">
                    <span>{getSpecialtyLabel(issue.issue_type, language)}</span>
                    <span className="text-[#8da09a]">{numberFormat.format(issue.total)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#e3eeee]">
                    <span
                      className="block h-full rounded-full bg-[#0f8d86]"
                      style={{ width: `${Math.round((issue.total / maxTotal) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-[2rem] bg-white/76 p-6 shadow-2xl shadow-[#a5ccd0]/20 backdrop-blur-xl sm:p-7">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#e1f4f3] text-[#0d827a]">
                <HardHat className="h-6 w-6" aria-hidden="true" />
              </span>
              <h2 className="m-0 text-xl font-extrabold text-[#17312d]">{t.registeredEngineers}</h2>
            </div>
            <span className="rounded-full bg-[#e5f7f6] px-3 py-1 text-sm font-extrabold text-[#0d827a]">
              {numberFormat.format(engineers.length)}
            </span>
          </div>

          {engineers.length === 0 ? (
            <p className="m-0 rounded-2xl border border-dashed border-[#cfe6e3] bg-[#f4faf8] p-6 text-center text-sm text-[#657872]">
              {t.noEngineers}
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {engineers.map((engineer) => (
                <article
                  key={engineer.id}
                  className="rounded-3xl bg-[#f6fbfa] p-4 transition-colors hover:bg-[#eef8f7]"
                >
                  <div className="flex items-center gap-3">
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#e1f4f3] text-[#0d827a] shadow-sm">
                      <HardHat className="h-6 w-6" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <strong className="block truncate text-base text-[#17312d]">{engineer.name}</strong>
                      <span className="block truncate text-sm text-[#5d716b]">
                        {getSpecialtyLabel(engineer.specialty, language)}
                      </span>
                    </div>
                  </div>
                  <div className={`mt-3 flex items-center gap-2 text-sm font-bold text-[#0d827a] ${isRtl ? "justify-end" : "justify-start"}`}>
                    <Phone className="h-4 w-4" aria-hidden="true" />
                    <span dir="ltr">{engineer.phone}</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-[2rem] bg-white/76 p-6 shadow-2xl shadow-[#a5ccd0]/20 backdrop-blur-xl sm:p-7">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#e1f4f3] text-[#0d827a]">
                <Building2 className="h-6 w-6" aria-hidden="true" />
              </span>
              <h2 className="m-0 text-xl font-extrabold text-[#17312d]">{t.registeredCompanies}</h2>
            </div>
            <span className="rounded-full bg-[#e5f7f6] px-3 py-1 text-sm font-extrabold text-[#0d827a]">
              {numberFormat.format(companies.length)}
            </span>
          </div>

          {companies.length === 0 ? (
            <p className="m-0 rounded-2xl border border-dashed border-[#cfe6e3] bg-[#f4faf8] p-6 text-center text-sm text-[#657872]">
              {t.noCompanies}
            </p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {companies.map((company) => (
                <article key={company.id} className="rounded-3xl bg-[#f6fbfa] p-5">
                  <div className="flex items-start gap-3">
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#e1f4f3] text-[#0d827a] shadow-sm">
                      <Building2 className="h-6 w-6" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <strong className="block truncate text-lg text-[#17312d]">{company.company_name}</strong>
                      {company.contact_name && (
                        <span className="block truncate text-sm text-[#5d716b]">{company.contact_name}</span>
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

        <section className="rounded-[2rem] bg-white/76 p-6 shadow-2xl shadow-[#a5ccd0]/20 backdrop-blur-xl sm:p-7">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#e1f4f3] text-[#0d827a]">
                <ClipboardList className="h-6 w-6" aria-hidden="true" />
              </span>
              <h2 className="m-0 text-xl font-extrabold text-[#17312d]">{t.requestsList}</h2>
            </div>
            <span className="rounded-full bg-[#e5f7f6] px-3 py-1 text-sm font-extrabold text-[#0d827a]">
              {numberFormat.format(requests.length)}
            </span>
          </div>

          {requests.length === 0 ? (
            <p className="m-0 rounded-2xl border border-dashed border-[#cfe6e3] bg-[#f4faf8] p-6 text-center text-sm text-[#657872]">
              {t.noRequests}
            </p>
          ) : (
            <div className="grid gap-3">
              {requests.map((request) => (
                <article key={request.id} className="rounded-3xl bg-[#f6fbfa] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <strong className="block truncate text-base text-[#17312d]">
                        #{request.id} — {request.client_company_name}
                      </strong>
                      <span className="block truncate text-sm text-[#5d716b]">
                        {getSpecialtyLabel(request.issue_type, language)} ·{" "}
                        {getPriorityLabel(request.priority, language)}
                      </span>
                    </div>
                    <span className="rounded-full bg-[#e5f7f6] px-3 py-1 text-xs font-extrabold text-[#0d827a]">
                      {statusLabels[request.status][language]}
                    </span>
                  </div>
                  <p className="m-0 mt-3 text-xs text-[#7d8d88]">
                    {new Date(request.created_at).toLocaleDateString(language === "ar" ? "ar-LY" : "en-GB", {
                      year: "numeric",
                      month: "short",
                      day: "numeric"
                    })}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
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
    teal: { bg: "bg-[#e1f4f3]", text: "text-[#0d827a]" },
    green: { bg: "bg-[#e3f3e7]", text: "text-[#2c8b4b]" },
    amber: { bg: "bg-[#f7ecd6]", text: "text-[#b87512]" },
    coral: { bg: "bg-[#fbe5e0]", text: "text-[#c84d3a]" }
  };
  const t = tints[tint];
  return (
    <div className="rounded-[2rem] bg-white/80 p-5 shadow-xl shadow-[#a5ccd0]/15 backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <p className="m-0 truncate text-xs font-extrabold uppercase tracking-wider text-[#73847f]">{label}</p>
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
      <dt className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#7d8d88]">
        {icon}
        {label}
      </dt>
      <dd
        dir={ltr ? "ltr" : undefined}
        className="m-0 min-w-0 max-w-[60%] truncate text-end text-sm font-bold text-[#17312d]"
      >
        {children}
      </dd>
    </div>
  );
}

export default PublicDashboard;
