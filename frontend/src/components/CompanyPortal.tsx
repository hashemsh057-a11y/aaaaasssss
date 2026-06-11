"use client";

import {
  ArrowLeft,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  ExternalLink,
  Loader2,
  LogOut,
  Mail,
  MapPin,
  Plus,
  Search,
  ShieldCheck,
  Wrench
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import {
  COMPANY_PORTAL_TOKEN_KEY,
  createCompanyPortalRequest,
  getCompanyPortalDashboard,
  requestCompanyPortalCode,
  verifyCompanyPortalCode
} from "@/src/lib/api";
import { formatRequestActivity } from "@/src/lib/activity";
import { getGoogleMapsSearchUrl } from "@/src/lib/maps";
import { getPriorityLabel, getSpecialtyLabel, priorityOptions, specialtyOptions, statusLabels } from "@/src/lib/i18n";
import type {
  CompanyPortalDashboard,
  CompanyPortalRegistrationPayload,
  MaintenanceSpecialty,
  PortalMaintenanceRequest,
  Priority
} from "@/src/lib/types";

type AuthMode = "LOGIN" | "REGISTER";
type RequestFilter = "ACTIVE" | "COMPLETED" | "ALL";

const ACTIVE_STATUSES = new Set(["NEW", "UNDER_REVIEW", "ASSIGNED", "IN_PROGRESS", "WAITING_SPARE_PARTS"]);
const inputClass =
  "h-11 w-full rounded-lg border border-[#ccd6e2] bg-white px-3 text-sm text-[#17233a] outline-none transition focus:border-[#1769aa] focus:ring-4 focus:ring-[#1769aa]/10";

function todayValue(daysAhead = 1) {
  const date = new Date(Date.now() + daysAhead * 86400000);
  return date.toISOString().slice(0, 10);
}

function lettersOnly(value: string) {
  return value.replace(/[^A-Za-z\u0600-\u06FF .'-]/g, "");
}

function phoneOnly(value: string) {
  return value.replace(/[^0-9+()\s-]/g, "");
}

function registerOnly(value: string) {
  return value.replace(/[^A-Za-z0-9\u0600-\u06FF ./_-]/g, "");
}

export function CompanyPortal() {
  const [token, setToken] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<CompanyPortalDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<RequestFilter>("ACTIVE");
  const [showComposer, setShowComposer] = useState(false);

  const loadDashboard = useCallback(async (sessionToken: string) => {
    try {
      const data = await getCompanyPortalDashboard(sessionToken);
      setDashboard(data);
      setError(null);
    } catch {
      window.localStorage.removeItem(COMPANY_PORTAL_TOKEN_KEY);
      setToken(null);
      setDashboard(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem(COMPANY_PORTAL_TOKEN_KEY);
    if (!saved) {
      setLoading(false);
      return;
    }
    setToken(saved);
    void loadDashboard(saved);
  }, [loadDashboard]);

  function handleAuthenticated(sessionToken: string) {
    window.localStorage.setItem(COMPANY_PORTAL_TOKEN_KEY, sessionToken);
    setToken(sessionToken);
    setLoading(true);
    void loadDashboard(sessionToken);
  }

  function signOut() {
    window.localStorage.removeItem(COMPANY_PORTAL_TOKEN_KEY);
    setToken(null);
    setDashboard(null);
  }

  const visibleRequests = useMemo(() => {
    const requests = dashboard?.requests ?? [];
    if (filter === "ACTIVE") return requests.filter((item) => ACTIVE_STATUSES.has(item.status));
    if (filter === "COMPLETED") return requests.filter((item) => ["COMPLETED", "CLOSED"].includes(item.status));
    return requests;
  }, [dashboard?.requests, filter]);

  if (loading) {
    return <PortalLoading label="جارٍ فتح حساب الشركة" />;
  }

  if (!token || !dashboard) {
    return <CompanyAuth onAuthenticated={handleAuthenticated} />;
  }

  const activeCount = dashboard.requests.filter((item) => ACTIVE_STATUSES.has(item.status)).length;
  const completedCount = dashboard.requests.filter((item) => ["COMPLETED", "CLOSED"].includes(item.status)).length;

  return (
    <main dir="rtl" className="min-h-screen bg-[#f3f6f9] text-[#17233a]">
      <PortalHeader
        label="بوابة الشركة"
        accountName={dashboard.profile.company_name}
        onSignOut={signOut}
      />

      <div className="mx-auto max-w-[1240px] px-4 py-6 sm:px-6">
        <section className="mb-6 grid gap-3 sm:grid-cols-3">
          <Metric label="إجمالي الطلبات" value={dashboard.requests.length} icon={ClipboardList} />
          <Metric label="قيد التنفيذ" value={activeCount} icon={Clock3} tone="amber" />
          <Metric label="مكتملة" value={completedCount} icon={CheckCircle2} tone="green" />
        </section>

        <section className="rounded-lg border border-[#d9e0e8] bg-white">
          <div className="flex flex-col gap-4 border-b border-[#e1e6ec] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="m-0 text-xl font-bold">طلبات الصيانة</h1>
              <p className="m-0 mt-1 text-sm text-[#66758a]">كل الحالات والتحديثات المرتبطة بحساب شركتك.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowComposer((current) => !current)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#1769aa] px-4 text-sm font-bold text-white hover:bg-[#12598f]"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              طلب جديد
            </button>
          </div>

          {showComposer && token && (
            <RequestComposer
              token={token}
              onCreated={(created) => {
                setDashboard((current) =>
                  current ? { ...current, requests: [created, ...current.requests] } : current
                );
                setShowComposer(false);
                setFilter("ACTIVE");
              }}
            />
          )}

          <div className="flex flex-wrap gap-2 border-b border-[#e1e6ec] px-4 py-3">
            {([
              ["ACTIVE", "الحالية"],
              ["COMPLETED", "المنجزة"],
              ["ALL", "السجل الكامل"]
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={`h-9 rounded-lg px-4 text-sm font-bold ${
                  filter === value ? "bg-[#e8f1f9] text-[#1769aa]" : "bg-transparent text-[#66758a] hover:bg-[#f1f4f7]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="grid gap-3 p-4">
            {error && <Notice tone="error">{error}</Notice>}
            {visibleRequests.length === 0 ? (
              <div className="grid min-h-48 place-items-center rounded-lg border border-dashed border-[#cbd4df] bg-[#f8fafb] p-6 text-center">
                <div>
                  <Search className="mx-auto h-6 w-6 text-[#7b899a]" aria-hidden="true" />
                  <p className="mb-0 mt-3 text-sm font-semibold text-[#66758a]">لا توجد طلبات ضمن هذا القسم.</p>
                </div>
              </div>
            ) : (
              visibleRequests.map((request) => <CompanyRequestCard key={request.id} request={request} />)
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function CompanyAuth({ onAuthenticated }: { onAuthenticated: (token: string) => void }) {
  const [mode, setMode] = useState<AuthMode>("LOGIN");
  const [challengeId, setChallengeId] = useState<number | null>(null);
  const [debugCode, setDebugCode] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    email: "",
    company_name: "",
    contact_name: "",
    commercial_register: "",
    phone: "",
    address: ""
  });

  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload =
        mode === "LOGIN"
          ? { purpose: "LOGIN" as const, email: form.email.trim() }
          : ({
              purpose: "REGISTER",
              email: form.email.trim(),
              company_name: form.company_name.trim(),
              contact_name: form.contact_name.trim(),
              commercial_register: form.commercial_register.trim(),
              phone: form.phone.trim(),
              address: form.address.trim()
            } satisfies CompanyPortalRegistrationPayload);
      const response = await requestCompanyPortalCode(payload);
      setChallengeId(response.challenge_id);
      setDebugCode(response.debug_code ?? null);
    } catch {
      setError(
        mode === "LOGIN"
          ? "تعذر العثور على الحساب أو إرسال رمز التحقق."
          : "تعذر إنشاء الحساب. راجع الحقول أو استخدم تسجيل الدخول إذا كان البريد مسجلًا."
      );
    } finally {
      setBusy(false);
    }
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!challengeId) return;
    setBusy(true);
    setError(null);
    try {
      const response = await verifyCompanyPortalCode(challengeId, code);
      onAuthenticated(response.token);
    } catch {
      setError("رمز التحقق غير صحيح أو انتهت صلاحيته.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main dir="rtl" className="min-h-screen bg-[#eef2f6] px-4 py-8 text-[#17233a]">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-[1080px] overflow-hidden rounded-lg border border-[#d7dee7] bg-white shadow-[0_20px_60px_rgba(23,35,58,0.10)] lg:grid-cols-[0.86fr_1.14fr]">
        <aside className="bg-[#173f73] p-7 text-white sm:p-10">
          <a href="/" className="inline-flex items-center gap-2 text-sm font-bold text-white no-underline">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            الموقع الرئيسي
          </a>
          <div className="mt-16">
            <span className="grid h-12 w-12 place-items-center rounded-lg bg-white/10">
              <Building2 className="h-6 w-6" aria-hidden="true" />
            </span>
            <h1 className="mt-6 text-3xl font-bold">حساب شركتك</h1>
            <p className="mt-4 max-w-sm text-sm leading-7 text-[#d6e3f2]">
              أنشئ الطلبات، تابع المهندس المعيّن، وراجع جميع الأعمال السابقة من حساب واحد محفوظ على جهازك.
            </p>
          </div>
          <div className="mt-10 grid gap-4 text-sm text-[#e8f1f9]">
            <AuthFeature icon={ShieldCheck} text="دخول آمن برمز من 4 أرقام عبر البريد" />
            <AuthFeature icon={ClipboardList} text="سجل كامل للطلبات والحالات والملاحظات" />
            <AuthFeature icon={Wrench} text="توجيه آلي حسب التخصص والتوفر" />
          </div>
        </aside>

        <section className="p-6 sm:p-10">
          {!challengeId ? (
            <>
              <div className="mb-7 grid grid-cols-2 rounded-lg bg-[#eef2f6] p-1">
                <button
                  type="button"
                  onClick={() => {
                    setMode("LOGIN");
                    setError(null);
                  }}
                  className={`h-10 rounded-lg text-sm font-bold ${mode === "LOGIN" ? "bg-white text-[#1769aa] shadow-sm" : "bg-transparent text-[#66758a]"}`}
                >
                  تسجيل الدخول
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("REGISTER");
                    setError(null);
                  }}
                  className={`h-10 rounded-lg text-sm font-bold ${mode === "REGISTER" ? "bg-white text-[#1769aa] shadow-sm" : "bg-transparent text-[#66758a]"}`}
                >
                  إنشاء حساب شركة
                </button>
              </div>

              <form onSubmit={requestCode} className="grid gap-4">
                <PortalField label="البريد الإلكتروني" icon={Mail}>
                  <input
                    required
                    type="email"
                    dir="ltr"
                    value={form.email}
                    onChange={(event) => setForm({ ...form, email: event.target.value })}
                    className={`${inputClass} text-left`}
                    placeholder="company@example.com"
                  />
                </PortalField>

                {mode === "REGISTER" && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <PortalField label="اسم الشركة" icon={Building2}>
                      <input
                        required
                        value={form.company_name}
                        onChange={(event) => setForm({ ...form, company_name: event.target.value })}
                        className={inputClass}
                      />
                    </PortalField>
                    <PortalField label="اسم المسؤول">
                      <input
                        required
                        value={form.contact_name}
                        onChange={(event) => setForm({ ...form, contact_name: lettersOnly(event.target.value) })}
                        className={inputClass}
                      />
                    </PortalField>
                    <PortalField label="السجل التجاري">
                      <input
                        required
                        dir="ltr"
                        value={form.commercial_register}
                        onChange={(event) => setForm({ ...form, commercial_register: registerOnly(event.target.value) })}
                        className={`${inputClass} text-left`}
                      />
                    </PortalField>
                    <PortalField label="رقم الهاتف">
                      <input
                        required
                        type="tel"
                        inputMode="tel"
                        dir="ltr"
                        value={form.phone}
                        onChange={(event) => setForm({ ...form, phone: phoneOnly(event.target.value) })}
                        className={`${inputClass} text-left`}
                      />
                    </PortalField>
                    <PortalField label="عنوان الشركة" icon={MapPin} className="sm:col-span-2">
                      <div className="flex gap-2">
                        <input
                          required
                          value={form.address}
                          onChange={(event) => setForm({ ...form, address: event.target.value })}
                          className={inputClass}
                        />
                        <a
                          href={getGoogleMapsSearchUrl(form.address)}
                          target="_blank"
                          rel="noreferrer"
                          title="فتح خرائط Google"
                          className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-[#ccd6e2] bg-[#f6f8fa] text-[#1769aa]"
                        >
                          <ExternalLink className="h-4 w-4" aria-hidden="true" />
                        </a>
                      </div>
                    </PortalField>
                  </div>
                )}

                {error && <Notice tone="error">{error}</Notice>}
                <button
                  type="submit"
                  disabled={busy}
                  className="mt-2 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#1769aa] px-4 text-sm font-bold text-white hover:bg-[#12598f]"
                >
                  {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                  إرسال رمز التحقق
                </button>
              </form>
            </>
          ) : (
            <form onSubmit={verify} className="mx-auto max-w-sm py-10 text-center">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-lg bg-[#e8f1f9] text-[#1769aa]">
                <Mail className="h-6 w-6" aria-hidden="true" />
              </span>
              <h2 className="mt-5 text-2xl font-bold">تحقق من بريدك</h2>
              <p className="mt-2 text-sm leading-6 text-[#66758a]">أدخل الرمز المكوّن من 4 أرقام الذي أرسلناه إلى بريد الشركة.</p>
              <input
                required
                autoFocus
                inputMode="numeric"
                pattern="[0-9]{4}"
                maxLength={4}
                dir="ltr"
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 4))}
                className="mt-6 h-14 w-full rounded-lg border border-[#bfcbd8] bg-white text-center text-2xl font-bold tracking-[0.45em] text-[#173f73] outline-none focus:border-[#1769aa] focus:ring-4 focus:ring-[#1769aa]/10"
              />
              {debugCode && (
                <p className="mt-3 text-xs text-[#66758a]">رمز بيئة التطوير: <b dir="ltr">{debugCode}</b></p>
              )}
              {error && <div className="mt-4"><Notice tone="error">{error}</Notice></div>}
              <button
                type="submit"
                disabled={busy || code.length !== 4}
                className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#1769aa] px-4 text-sm font-bold text-white"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                فتح حساب الشركة
              </button>
              <button
                type="button"
                onClick={() => {
                  setChallengeId(null);
                  setCode("");
                  setError(null);
                }}
                className="mt-3 h-10 bg-transparent px-3 text-sm font-bold text-[#66758a]"
              >
                تعديل البريد
              </button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}

function RequestComposer({
  token,
  onCreated
}: {
  token: string;
  onCreated: (request: PortalMaintenanceRequest) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    issue_type: "NETWORKS" as MaintenanceSpecialty,
    priority: "MEDIUM" as Priority,
    location_details: "",
    description: "",
    preferred_date: todayValue(),
    preferred_time: "10:00",
    is_hazardous: false
  });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await createCompanyPortalRequest(token, {
        issue_type: form.issue_type,
        priority: form.priority,
        location_details: form.location_details.trim(),
        description: form.description.trim(),
        preferred_date: `${form.preferred_date}T${form.preferred_time}:00`,
        is_hazardous: form.is_hazardous
      });
      onCreated(created);
    } catch {
      setError("تعذر إرسال الطلب. تحقق من البيانات والتاريخ ثم حاول مجددًا.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4 border-b border-[#e1e6ec] bg-[#f8fafb] p-4 sm:grid-cols-2">
      <PortalField label="نوع العطل">
        <select
          value={form.issue_type}
          onChange={(event) => setForm({ ...form, issue_type: event.target.value as MaintenanceSpecialty })}
          className={inputClass}
        >
          {specialtyOptions.map((option) => <option key={option.value} value={option.value}>{option.label.ar}</option>)}
        </select>
      </PortalField>
      <PortalField label="الأولوية">
        <select
          value={form.priority}
          onChange={(event) => setForm({ ...form, priority: event.target.value as Priority })}
          className={inputClass}
        >
          {priorityOptions.map((option) => <option key={option.value} value={option.value}>{option.label.ar}</option>)}
        </select>
      </PortalField>
      <PortalField label="التاريخ" icon={CalendarDays}>
        <input
          required
          type="date"
          lang="en-GB"
          dir="ltr"
          min={todayValue(0)}
          value={form.preferred_date}
          onChange={(event) => setForm({ ...form, preferred_date: event.target.value })}
          className={`${inputClass} text-left`}
        />
      </PortalField>
      <PortalField label="الوقت" icon={Clock3}>
        <input
          required
          type="time"
          lang="en-GB"
          dir="ltr"
          value={form.preferred_time}
          onChange={(event) => setForm({ ...form, preferred_time: event.target.value })}
          className={`${inputClass} text-left`}
        />
      </PortalField>
      <PortalField label="موقع العطل" icon={MapPin} className="sm:col-span-2">
        <input
          required
          value={form.location_details}
          onChange={(event) => setForm({ ...form, location_details: event.target.value })}
          className={inputClass}
        />
      </PortalField>
      <PortalField label="وصف العطل" className="sm:col-span-2">
        <textarea
          required
          rows={4}
          value={form.description}
          onChange={(event) => setForm({ ...form, description: event.target.value })}
          className="min-h-28 w-full resize-y rounded-lg border border-[#ccd6e2] bg-white p-3 text-sm outline-none focus:border-[#1769aa] focus:ring-4 focus:ring-[#1769aa]/10"
        />
      </PortalField>
      <label className="flex min-h-11 items-center gap-3 text-sm font-semibold text-[#536174] sm:col-span-2">
        <input
          type="checkbox"
          checked={form.is_hazardous}
          onChange={(event) => setForm({ ...form, is_hazardous: event.target.checked })}
          className="h-5 w-5 accent-[#c84d3a]"
        />
        العطل يتضمن خطورة تشغيلية
      </label>
      {error && <div className="sm:col-span-2"><Notice tone="error">{error}</Notice></div>}
      <div className="flex justify-end sm:col-span-2">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#1769aa] px-5 text-sm font-bold text-white"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          إرسال الطلب
        </button>
      </div>
    </form>
  );
}

function CompanyRequestCard({ request }: { request: PortalMaintenanceRequest }) {
  return (
    <article className="rounded-lg border border-[#dce3ea] bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <strong className="text-base">طلب #{request.id}</strong>
          <p className="m-0 mt-1 text-sm text-[#66758a]">
            {getSpecialtyLabel(request.issue_type, "ar")} · {getPriorityLabel(request.priority, "ar")}
          </p>
        </div>
        <span className="rounded-full bg-[#e8f1f9] px-3 py-1 text-xs font-bold text-[#1769aa]">
          {statusLabels[request.status].ar}
        </span>
      </div>
      <div className="mt-4 grid gap-3 border-t border-[#e6eaef] pt-4 text-sm sm:grid-cols-3">
        <Info label="الموقع" value={request.location_details} />
        <Info label="المهندس" value={request.assigned_engineer_name ?? "لم يعيّن بعد"} />
        <Info
          label="الموعد"
          value={new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(request.preferred_date))}
          ltr
        />
      </div>
      {request.activities.length > 0 && (
        <div className="mt-4 border-t border-[#e6eaef] pt-4">
          <p className="m-0 text-xs font-bold text-[#66758a]">آخر تحديث</p>
          <p className="m-0 mt-1 text-sm text-[#17233a]">
            {formatRequestActivity(request.activities.at(-1)!, "ar")}
          </p>
        </div>
      )}
    </article>
  );
}

function PortalHeader({
  label,
  accountName,
  onSignOut
}: {
  label: string;
  accountName: string;
  onSignOut: () => void;
}) {
  return (
    <header className="border-b border-[#d9e0e8] bg-white">
      <div className="mx-auto flex min-h-16 max-w-[1240px] items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <a href="/" className="shrink-0"><img src="/engiflow-logo.png" alt="EngiFlow" className="h-11 w-11 object-contain" /></a>
          <div className="min-w-0">
            <span className="block text-xs font-bold text-[#1769aa]">{label}</span>
            <strong className="block truncate text-sm text-[#17233a]">{accountName}</strong>
          </div>
        </div>
        <button
          type="button"
          onClick={onSignOut}
          title="تسجيل الخروج"
          className="grid h-10 w-10 place-items-center rounded-lg border border-[#d5dde6] bg-white text-[#536174] hover:bg-[#f2f5f7]"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
  tone = "blue"
}: {
  label: string;
  value: number;
  icon: typeof ClipboardList;
  tone?: "blue" | "amber" | "green";
}) {
  const tones = {
    blue: "bg-[#e8f1f9] text-[#1769aa]",
    amber: "bg-[#fff3d8] text-[#9b6500]",
    green: "bg-[#e5f4eb] text-[#237348]"
  };
  return (
    <div className="flex min-h-24 items-center gap-4 rounded-lg border border-[#d9e0e8] bg-white p-4">
      <span className={`grid h-11 w-11 place-items-center rounded-lg ${tones[tone]}`}><Icon className="h-5 w-5" /></span>
      <div><span className="block text-xs font-semibold text-[#66758a]">{label}</span><strong className="mt-1 block text-2xl">{value}</strong></div>
    </div>
  );
}

function PortalField({
  label,
  icon: Icon,
  children,
  className = ""
}: {
  label: string;
  icon?: typeof Mail;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`grid gap-2 ${className}`}>
      <span className="flex items-center gap-2 text-sm font-bold text-[#536174]">
        {Icon && <Icon className="h-4 w-4 text-[#1769aa]" aria-hidden="true" />}
        {label}
      </span>
      {children}
    </label>
  );
}

function AuthFeature({ icon: Icon, text }: { icon: typeof ShieldCheck; text: string }) {
  return <div className="flex items-center gap-3"><Icon className="h-5 w-5 text-[#80b7e4]" /><span>{text}</span></div>;
}

function Info({ label, value, ltr = false }: { label: string; value: string; ltr?: boolean }) {
  return <div><span className="block text-xs font-semibold text-[#7b899a]">{label}</span><span dir={ltr ? "ltr" : undefined} className="mt-1 block font-semibold">{value}</span></div>;
}

function Notice({ children, tone }: { children: React.ReactNode; tone: "error" }) {
  return <p className="m-0 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{children}</p>;
}

function PortalLoading({ label }: { label: string }) {
  return <main dir="rtl" className="grid min-h-screen place-items-center bg-[#eef2f6]"><div className="flex items-center gap-3 text-sm font-bold text-[#536174]"><Loader2 className="h-5 w-5 animate-spin text-[#1769aa]" />{label}</div></main>;
}
