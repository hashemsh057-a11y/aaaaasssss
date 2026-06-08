"use client";

import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Cog,
  HardHat,
  RefreshCw
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { getPublicEngineers, getPublicImpactStatistics, getPublicRequestsList } from "@/src/lib/api";
import { copy, getPriorityLabel, getSpecialtyLabel, languages, statusLabels } from "@/src/lib/i18n";
import type { Language, PublicEngineer, PublicImpactStatistics, PublicTrackedRequest } from "@/src/lib/types";

export function PublicDashboard() {
  const [language, setLanguage] = useState<Language>("ar");
  const [stats, setStats] = useState<PublicImpactStatistics | null>(null);
  const [engineers, setEngineers] = useState<PublicEngineer[]>([]);
  const [requests, setRequests] = useState<PublicTrackedRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const t = copy[language];
  const dir = languages[language].dir;
  const numberFormat = useMemo(
    () => new Intl.NumberFormat(language === "ar" ? "ar-LY" : "en-US"),
    [language]
  );

  const load = useCallback(async () => {
    const [statistics, engineerList, requestList] = await Promise.all([
      getPublicImpactStatistics().catch(() => null),
      getPublicEngineers().catch(() => [] as PublicEngineer[]),
      getPublicRequestsList().catch(() => [] as PublicTrackedRequest[])
    ]);
    setStats(statistics);
    setEngineers(engineerList);
    setRequests(requestList);
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
        setLoading(false);
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

  if (loading) {
    return (
      <main className="boot-screen" dir={dir}>
        <div className="boot-pulse">
          <Cog aria-hidden="true" />
        </div>
        <p>{t.loading}</p>
      </main>
    );
  }

  return (
    <div dir={dir} className="workspace" style={{ maxWidth: 1120, margin: "0 auto" }}>
      <header className="topbar">
        <div className="identity-strip">
          <span>{t.console}</span>
          <strong style={{ fontSize: 22, lineHeight: 1.1 }}>
            <span style={{ color: "#15294d" }}>Engi</span>
            <span style={{ color: "#1f86ec" }}>Flow</span>
          </strong>
        </div>
        <div className="topbar-actions">
          <div className="segmented-control" aria-label={t.language}>
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
          <button type="button" className="icon-text-button" onClick={refresh} disabled={refreshing}>
            <RefreshCw aria-hidden="true" className={refreshing ? "spin" : ""} />
            <span>{t.refresh}</span>
          </button>
        </div>
      </header>

      <main className="dashboard-surface">
        <section className="metrics-ribbon" aria-label={t.dashboard}>
          <Metric
            icon={<ClipboardList />}
            label={t.totalRequests}
            value={stats ? numberFormat.format(stats.total_requests) : "—"}
            tone="teal"
          />
          <Metric
            icon={<BarChart3 />}
            label={t.openRequests}
            value={stats ? numberFormat.format(stats.total_open_requests) : "—"}
            tone="amber"
          />
          <Metric
            icon={<CheckCircle2 />}
            label={t.completedRequests}
            value={stats ? numberFormat.format(stats.completed_tickets) : "—"}
            tone="green"
          />
          <Metric
            icon={<AlertTriangle />}
            label={t.completionRate}
            value={stats ? `${numberFormat.format(stats.completion_rate)}%` : "—"}
            tone="coral"
          />
        </section>

        <section className="issue-stream">
          <div className="section-heading">
            <BarChart3 aria-hidden="true" />
            <h2>{t.recurringIssues}</h2>
          </div>
          {recurring.length === 0 ? (
            <p className="empty-state">{t.noRequests}</p>
          ) : (
            <div className="issue-bars">
              {recurring.map((issue) => (
                <div className="issue-bar" key={issue.issue_type}>
                  <span>{getSpecialtyLabel(issue.issue_type, language)}</span>
                  <div className="bar-track">
                    <i style={{ width: `${Math.round((issue.total / maxTotal) * 100)}%` }} />
                  </div>
                  <strong>{numberFormat.format(issue.total)}</strong>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="issue-stream">
          <div className="section-heading">
            <HardHat aria-hidden="true" />
            <h2>
              {t.registeredEngineers} ({numberFormat.format(engineers.length)})
            </h2>
          </div>
          {engineers.length === 0 ? (
            <p className="empty-state">{t.noEngineers}</p>
          ) : (
            <div className="issue-bars">
              {engineers.map((engineer) => (
                <div className="issue-bar" key={engineer.id}>
                  <span>{engineer.name}</span>
                  <span>{getSpecialtyLabel(engineer.specialty, language)}</span>
                  <strong dir="ltr">{engineer.phone}</strong>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="issue-stream">
          <div className="section-heading">
            <ClipboardList aria-hidden="true" />
            <h2>
              {t.requestsList} ({numberFormat.format(requests.length)})
            </h2>
          </div>
          {requests.length === 0 ? (
            <p className="empty-state">{t.noRequests}</p>
          ) : (
            <div className="request-stack">
              {requests.map((request) => (
                <article className="request-row" key={request.id}>
                  <div className="request-main">
                    <div className="request-title-line">
                      <strong>
                        #{request.id} — {request.client_company_name}
                      </strong>
                      <span className={`status-pill status-${request.status.toLowerCase().replaceAll("_", "-")}`}>
                        {statusLabels[request.status][language]}
                      </span>
                    </div>
                    <div className="request-meta">
                      <span>{getSpecialtyLabel(request.issue_type, language)}</span>
                      <span>{getPriorityLabel(request.priority, language)}</span>
                      <span>
                        {new Date(request.created_at).toLocaleDateString(language === "ar" ? "ar-LY" : "en-GB")}
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
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

export default PublicDashboard;
