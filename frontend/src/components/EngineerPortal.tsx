"use client";

import {
  ArrowLeft,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  HardHat,
  Loader2,
  LogOut,
  Mail,
  MapPin,
  MessageSquareText,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  Send,
  ToggleLeft,
  ToggleRight,
  UserPlus,
  Wrench
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import {
  ApiRequestError,
  canShowPortalDebugCode,
  ENGINEER_PORTAL_TOKEN_KEY,
  createPublicEngineer,
  getApiAssetUrl,
  getEngineerPortalDashboard,
  normalizeOtpInput,
  requestEngineerPortalCode,
  setEngineerPortalAvailability,
  updateEngineerPortalRequest,
  verifyEngineerPortalCode
} from "@/src/lib/api";
import { formatRequestActivity } from "@/src/lib/activity";
import { getPriorityLabel, getSpecialtyLabel, specialtyOptions, statusLabels } from "@/src/lib/i18n";
import type {
  EngineerPortalDashboard,
  MaintenanceSpecialty,
  MaintenanceStatus,
  PortalMaintenanceRequest,
  PublicEngineer
} from "@/src/lib/types";
import { EngineerAvatar } from "./EngineerAvatar";

const ACTIVE_STATUSES = new Set<MaintenanceStatus>(["ASSIGNED", "IN_PROGRESS", "WAITING_SPARE_PARTS"]);

export function EngineerPortal() {
  const [token, setToken] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<EngineerPortalDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [availabilityBusy, setAvailabilityBusy] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  const loadDashboard = useCallback(async (sessionToken: string, quiet = false) => {
    if (!quiet) setRefreshing(true);
    try {
      const data = await getEngineerPortalDashboard(sessionToken);
      setDashboard(data);
      setDashboardError(null);
    } catch (caught) {
      if (caught instanceof ApiRequestError && [401, 403].includes(caught.status)) {
        window.localStorage.removeItem(ENGINEER_PORTAL_TOKEN_KEY);
        setToken(null);
        setDashboard(null);
        setDashboardError(null);
      } else {
        setDashboardError("تعذر تحميل لوحة المهندس مؤقتًا. أعد المحاولة بعد لحظات.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem(ENGINEER_PORTAL_TOKEN_KEY);
    if (!saved) {
      setLoading(false);
      return;
    }
    setToken(saved);
    void loadDashboard(saved, true);
  }, [loadDashboard]);

  useEffect(() => {
    if (!token) return;
    const refresh = () => {
      if (document.visibilityState === "visible") void loadDashboard(token, true);
    };
    const interval = window.setInterval(refresh, 20_000);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, [loadDashboard, token]);

  function authenticated(sessionToken: string) {
    window.localStorage.setItem(ENGINEER_PORTAL_TOKEN_KEY, sessionToken);
    setToken(sessionToken);
    setLoading(true);
    void loadDashboard(sessionToken, true);
  }

  function signOut() {
    window.localStorage.removeItem(ENGINEER_PORTAL_TOKEN_KEY);
    setToken(null);
    setDashboard(null);
    setDashboardError(null);
  }

  async function toggleAvailability() {
    if (!token || !dashboard) return;
    setAvailabilityBusy(true);
    try {
      const profile = await setEngineerPortalAvailability(token, !dashboard.profile.is_available);
      setDashboard({ ...dashboard, profile });
    } finally {
      setAvailabilityBusy(false);
    }
  }

  function updateRequest(updated: PortalMaintenanceRequest) {
    setDashboard((current) =>
      current
        ? {
            ...current,
            requests: current.requests.map((request) => request.id === updated.id ? updated : request)
          }
        : current
    );
  }

  const activeRequests = useMemo(
    () => dashboard?.requests.filter((request) => ACTIVE_STATUSES.has(request.status)) ?? [],
    [dashboard?.requests]
  );
  const completedRequests = useMemo(
    () => dashboard?.requests.filter((request) => ["COMPLETED", "CLOSED"].includes(request.status)) ?? [],
    [dashboard?.requests]
  );

  if (loading) return <PortalLoading />;
  if (!token) return <EngineerAuth onAuthenticated={authenticated} />;
  if (!dashboard) {
    return (
      <PortalLoadError
        message={dashboardError ?? "تعذر تحميل بيانات لوحة المهندس."}
        onRetry={() => void loadDashboard(token)}
        refreshing={refreshing}
      />
    );
  }

  return (
    <main dir="rtl" className="min-h-screen bg-[#f4f7fa] text-[#17233a]">
      <header className="sticky top-0 z-20 border-b border-[#d9e0e8] bg-white/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-[1240px] items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <EngineerAvatar
              src={getApiAssetUrl(dashboard.profile.avatar)}
              alt={dashboard.profile.name}
              className="h-11 w-11"
            />
            <div className="min-w-0">
              <span className="block text-xs font-bold text-[#1769aa]">بوابة المهندس</span>
              <strong className="block truncate text-sm">{dashboard.profile.name}</strong>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadDashboard(token)}
              disabled={refreshing}
              title="تحديث"
              className="grid h-10 w-10 place-items-center rounded-lg border border-[#d5dde6] bg-white text-[#536174] hover:bg-[#f2f5f7]"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={signOut}
              title="تسجيل الخروج"
              className="grid h-10 w-10 place-items-center rounded-lg border border-[#d5dde6] bg-white text-[#536174] hover:bg-[#f2f5f7]"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1240px] px-4 py-6 sm:px-6 lg:py-8">
        <section className="mb-6 flex flex-col gap-4 border-b border-[#dbe2e9] pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="text-xs font-bold text-[#1769aa]">مساحة العمل اليومية</span>
            <h1 className="m-0 mt-2 text-2xl font-bold sm:text-3xl">مرحبًا، {dashboard.profile.name}</h1>
            <p className="m-0 mt-2 text-sm leading-6 text-[#66758a]">
              تابع المهام المسندة إليك وحدّث تقدم العمل لتصل التفاصيل إلى الإدارة والشركة فورًا.
            </p>
          </div>
          <div className={`inline-flex h-10 items-center gap-2 self-start rounded-full border px-4 text-sm font-bold sm:self-auto ${
            dashboard.profile.is_available
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-amber-200 bg-amber-50 text-amber-700"
          }`}>
            <span className={`h-2 w-2 rounded-full ${dashboard.profile.is_available ? "bg-emerald-500" : "bg-amber-500"}`} />
            {dashboard.profile.is_available ? "متوفر لاستقبال مهام" : "غير متوفر حاليًا"}
          </div>
        </section>

        <section className="mb-6 grid gap-3 sm:grid-cols-3">
          <EngineerMetric label="المهام النشطة" value={activeRequests.length} icon={BriefcaseBusiness} />
          <EngineerMetric label="الأعمال المنجزة" value={completedRequests.length} icon={CheckCircle2} tone="green" />
          <EngineerMetric label="سنوات الخبرة" value={dashboard.profile.experience_years} icon={Clock3} tone="amber" suffix=" سنوات" />
        </section>

        <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="h-fit rounded-lg border border-[#d9e0e8] bg-white p-5 lg:sticky lg:top-24">
          <div className="flex items-center gap-3 border-b border-[#e3e8ed] pb-5">
            <EngineerAvatar
              src={getApiAssetUrl(dashboard.profile.avatar)}
              alt={dashboard.profile.name}
              className="h-16 w-16 ring-4 ring-[#eef4f9]"
            />
            <div className="min-w-0">
              <strong className="block truncate">{dashboard.profile.name}</strong>
              <span className="block truncate text-xs text-[#66758a]">{dashboard.profile.profession}</span>
              <span className="block truncate text-xs text-[#66758a]">
                {getSpecialtyLabel(dashboard.profile.specialty, "ar")}
              </span>
            </div>
          </div>

          <div className="py-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="block text-xs font-bold text-[#66758a]">حالة التوفر</span>
                <strong className={`mt-1 block text-sm ${dashboard.profile.is_available ? "text-[#237348]" : "text-[#9b6500]"}`}>
                  {dashboard.profile.is_available ? "متوفر للعمل" : "غير متوفر"}
                </strong>
              </div>
              <button
                type="button"
                disabled={availabilityBusy}
                onClick={() => void toggleAvailability()}
                title={dashboard.profile.is_available ? "تغيير إلى غير متوفر" : "تغيير إلى متوفر"}
                className={`grid h-11 w-14 place-items-center rounded-lg border ${
                  dashboard.profile.is_available ? "border-emerald-200 bg-[#e5f4eb] text-[#237348]" : "border-amber-200 bg-[#fff3d8] text-[#9b6500]"
                }`}
              >
                {availabilityBusy ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : dashboard.profile.is_available ? (
                  <ToggleRight className="h-6 w-6" />
                ) : (
                  <ToggleLeft className="h-6 w-6" />
                )}
              </button>
            </div>
          </div>

          <dl className="m-0 grid gap-3 border-t border-[#e3e8ed] pt-4 text-sm">
            <ProfileRow label="القسم" value={dashboard.profile.department} />
            <ProfileRow label="التخصص" value={getSpecialtyLabel(dashboard.profile.specialty, "ar")} />
            <ProfileRow label="الخبرة" value={`${dashboard.profile.experience_years} سنوات`} />
          </dl>
        </aside>

        <section className="min-w-0">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
            <h2 className="m-0 text-xl font-bold">المهام الحالية</h2>
            <p className="m-0 mt-1 text-sm text-[#66758a]">حدّث حالة العمل وأضف الملاحظات لتظهر فورًا في لوحة الإدارة.</p>
            </div>
            <span className="shrink-0 text-xs font-bold text-[#7b899a]">{activeRequests.length} مهام</span>
          </div>

          <div className="grid gap-4">
            {activeRequests.length === 0 ? (
              <EmptyState />
            ) : (
              activeRequests.map((request) => (
                <EngineerRequestCard
                  key={request.id}
                  token={token}
                  request={request}
                  onUpdated={updateRequest}
                />
              ))
            )}
          </div>

          {completedRequests.length > 0 && (
            <div className="mt-8">
              <h2 className="mb-3 text-base font-bold">الأعمال المنجزة</h2>
              <div className="grid gap-3">
                {completedRequests.map((request) => (
                  <article key={request.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#d9e0e8] bg-white p-4 transition hover:border-[#b8c8d8]">
                    <div>
                      <strong>طلب #{request.id} · {request.client_company_name}</strong>
                      <span className="mt-1 block text-sm text-[#66758a]">{getSpecialtyLabel(request.issue_type, "ar")}</span>
                    </div>
                    <span className="rounded-full bg-[#e5f4eb] px-3 py-1 text-xs font-bold text-[#237348]">
                      {statusLabels[request.status].ar}
                    </span>
                  </article>
                ))}
              </div>
            </div>
          )}
        </section>
        </div>
      </div>
    </main>
  );
}

function EngineerAuth({ onAuthenticated }: { onAuthenticated: (token: string) => void }) {
  const [mode, setMode] = useState<"LOGIN" | "REGISTER">("LOGIN");
  const [email, setEmail] = useState("");
  const [registration, setRegistration] = useState({
    name: "",
    phone: "",
    department: "",
    specialty: "NETWORKS" as MaintenanceSpecialty,
    profession: "",
    experience_years: "0"
  });
  const [avatar, setAvatar] = useState<File | null>(null);
  const [challengeId, setChallengeId] = useState<number | null>(null);
  const [debugCode, setDebugCode] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "REGISTER") {
        await createPublicEngineer({
          name: registration.name.trim(),
          phone: registration.phone.trim(),
          email: email.trim(),
          department: registration.department.trim(),
          specialty: registration.specialty,
          profession: registration.profession.trim(),
          experience_years: Number(registration.experience_years),
          avatar
        });
      }
      const response = await requestEngineerPortalCode(email.trim());
      setChallengeId(response.challenge_id);
      setDebugCode(canShowPortalDebugCode() ? response.debug_code ?? null : null);
    } catch (caught) {
      if (caught instanceof ApiRequestError && caught.status === 404) {
        setError(
          "خادم PythonAnywhere لم يُحدّث بعد لدعم تسجيل الدخول بالبريد. الحساب قد يكون موجودًا، لكن يجب تحديث الخادم أولًا."
        );
        setBusy(false);
        return;
      }
      if (caught instanceof ApiRequestError && caught.status === 503) {
        setError("خدمة إرسال البريد غير مهيأة على الخادم حاليًا. يلزم ضبط حساب الإرسال في PythonAnywhere.");
        setBusy(false);
        return;
      }
      if (caught instanceof ApiRequestError && caught.status === 429) {
        setError("انتظر دقيقة قبل طلب رمز تحقق جديد.");
        setBusy(false);
        return;
      }
      setError(
        mode === "REGISTER"
          ? "تعذر إنشاء الحساب. تحقق من البيانات أو استخدم تسجيل الدخول إذا كان البريد مسجلًا."
          : "لا يوجد حساب مهندس مرتبط بهذا البريد أو تعذر إرسال الرمز."
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
      const response = await verifyEngineerPortalCode(challengeId, code);
      onAuthenticated(response.token);
    } catch (caught) {
      setError(
        caught instanceof ApiRequestError && caught.status === 429
          ? "تجاوزت عدد المحاولات المسموح. اطلب رمزًا جديدًا."
          : "الرمز غير صحيح أو منتهي الصلاحية. أدخل أحدث رمز أُرسل إلى بريدك."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main dir="rtl" className="grid min-h-screen place-items-center bg-[#eef2f6] px-4 py-8 text-[#17233a]">
      <div className="grid w-full max-w-[920px] overflow-hidden rounded-lg border border-[#d7dee7] bg-white shadow-[0_20px_60px_rgba(23,35,58,0.10)] md:grid-cols-[0.9fr_1.1fr]">
        <aside className="bg-[#173f73] p-8 text-white">
          <a href="/" className="inline-flex items-center gap-2 text-sm font-bold text-white no-underline">
            <ArrowLeft className="h-4 w-4" />
            الموقع الرئيسي
          </a>
          <span className="mt-14 grid h-12 w-12 place-items-center rounded-lg bg-white/10">
            <HardHat className="h-6 w-6" />
          </span>
          <h1 className="mt-6 text-3xl font-bold">مساحة عمل المهندس</h1>
          <p className="mt-4 text-sm leading-7 text-[#d6e3f2]">
            استلم مهامك، حدّث تقدم العمل، وسجّل الملاحظات الفنية من واجهة واحدة متزامنة مع الإدارة.
          </p>
        </aside>

        <section className="p-7 sm:p-10">
          {!challengeId ? (
            <form onSubmit={requestCode} className="grid gap-5">
              <div>
                <h2 className="m-0 text-2xl font-bold">
                  {mode === "LOGIN" ? "تسجيل دخول المهندس" : "إنشاء حساب مهندس"}
                </h2>
                <p className="m-0 mt-2 text-sm text-[#66758a]">سيصل رمز من 4 أرقام إلى البريد المسجل في ملفك.</p>
              </div>
              <div className="grid grid-cols-2 rounded-lg bg-[#eef2f6] p-1">
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
                  إنشاء حساب
                </button>
              </div>
              <label className="grid gap-2">
                <span className="flex items-center gap-2 text-sm font-bold text-[#536174]">
                  <Mail className="h-4 w-4 text-[#1769aa]" />
                  البريد الإلكتروني
                </span>
                <input
                  required
                  type="email"
                  dir="ltr"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-11 rounded-lg border border-[#ccd6e2] px-3 text-left text-sm outline-none focus:border-[#1769aa] focus:ring-4 focus:ring-[#1769aa]/10"
                  placeholder="engineer@example.com"
                />
              </label>
              {mode === "REGISTER" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <AuthInput label="اسم المهندس" icon={HardHat}>
                    <input
                      required
                      value={registration.name}
                      onChange={(event) => setRegistration({
                        ...registration,
                        name: event.target.value.replace(/[^A-Za-z\u0600-\u06FF .'-]/g, "")
                      })}
                      className="h-11 rounded-lg border border-[#ccd6e2] px-3 text-sm outline-none focus:border-[#1769aa] focus:ring-4 focus:ring-[#1769aa]/10"
                    />
                  </AuthInput>
                  <AuthInput label="رقم الهاتف">
                    <input
                      required
                      type="tel"
                      inputMode="tel"
                      dir="ltr"
                      value={registration.phone}
                      onChange={(event) => setRegistration({
                        ...registration,
                        phone: event.target.value.replace(/[^0-9+()\s-]/g, "")
                      })}
                      className="h-11 rounded-lg border border-[#ccd6e2] px-3 text-left text-sm outline-none focus:border-[#1769aa] focus:ring-4 focus:ring-[#1769aa]/10"
                    />
                  </AuthInput>
                  <AuthInput label="القسم" icon={Building2}>
                    <input
                      required
                      value={registration.department}
                      onChange={(event) => setRegistration({
                        ...registration,
                        department: event.target.value.replace(/[^A-Za-z\u0600-\u06FF .&'-]/g, "")
                      })}
                      className="h-11 rounded-lg border border-[#ccd6e2] px-3 text-sm outline-none focus:border-[#1769aa] focus:ring-4 focus:ring-[#1769aa]/10"
                    />
                  </AuthInput>
                  <AuthInput label="التخصص" icon={Wrench}>
                    <select
                      value={registration.specialty}
                      onChange={(event) => setRegistration({
                        ...registration,
                        specialty: event.target.value as MaintenanceSpecialty
                      })}
                      className="h-11 rounded-lg border border-[#ccd6e2] bg-white px-3 text-sm outline-none focus:border-[#1769aa]"
                    >
                      {specialtyOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label.ar}</option>
                      ))}
                    </select>
                  </AuthInput>
                  <AuthInput label="المهنة">
                    <input
                      required
                      value={registration.profession}
                      onChange={(event) => setRegistration({
                        ...registration,
                        profession: event.target.value.replace(/[^A-Za-z\u0600-\u06FF .&'-]/g, "")
                      })}
                      className="h-11 rounded-lg border border-[#ccd6e2] px-3 text-sm outline-none focus:border-[#1769aa] focus:ring-4 focus:ring-[#1769aa]/10"
                    />
                  </AuthInput>
                  <AuthInput label="سنوات الخبرة">
                    <input
                      required
                      type="number"
                      min="0"
                      max="60"
                      inputMode="numeric"
                      value={registration.experience_years}
                      onChange={(event) => setRegistration({
                        ...registration,
                        experience_years: event.target.value.replace(/\D/g, "").slice(0, 2)
                      })}
                      className="h-11 rounded-lg border border-[#ccd6e2] px-3 text-sm outline-none focus:border-[#1769aa] focus:ring-4 focus:ring-[#1769aa]/10"
                    />
                  </AuthInput>
                  <AuthInput label="الصورة الشخصية" icon={Camera} className="sm:col-span-2">
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                      onChange={(event) => setAvatar(event.target.files?.[0] ?? null)}
                      className="h-11 rounded-lg border border-[#ccd6e2] bg-white px-3 py-2 text-sm file:me-3 file:border-0 file:bg-transparent file:font-bold file:text-[#1769aa]"
                    />
                  </AuthInput>
                </div>
              )}
              {error && <ErrorNotice>{error}</ErrorNotice>}
              <button type="submit" disabled={busy} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#1769aa] px-4 text-sm font-bold text-white">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "REGISTER" ? <UserPlus className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
                {mode === "REGISTER" ? "إنشاء الحساب وإرسال الرمز" : "إرسال رمز التحقق"}
              </button>
            </form>
          ) : (
            <form onSubmit={verify} className="grid gap-5 text-center">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-lg bg-[#e8f1f9] text-[#1769aa]">
                <Mail className="h-6 w-6" />
              </span>
              <div>
                <h2 className="m-0 text-2xl font-bold">أدخل رمز التحقق</h2>
                <p className="m-0 mt-2 text-sm text-[#66758a]">الرمز صالح لفترة محدودة ويُستخدم مرة واحدة.</p>
              </div>
              <input
                required
                autoFocus
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{4}"
                maxLength={4}
                dir="ltr"
                value={code}
                onChange={(event) => setCode(normalizeOtpInput(event.target.value))}
                className="h-14 rounded-lg border border-[#bfcbd8] text-center text-2xl font-bold tracking-[0.45em] outline-none focus:border-[#1769aa] focus:ring-4 focus:ring-[#1769aa]/10"
              />
              {debugCode && <p className="m-0 text-xs text-[#66758a]">رمز بيئة التطوير: <b dir="ltr">{debugCode}</b></p>}
              {error && <ErrorNotice>{error}</ErrorNotice>}
              <button type="submit" disabled={busy || code.length !== 4} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#1769aa] px-4 text-sm font-bold text-white">
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                فتح لوحة المهندس
              </button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}

function AuthInput({
  label,
  icon: Icon,
  children,
  className = ""
}: {
  label: string;
  icon?: typeof HardHat;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`grid gap-2 ${className}`}>
      <span className="flex items-center gap-2 text-sm font-bold text-[#536174]">
        {Icon && <Icon className="h-4 w-4 text-[#1769aa]" />}
        {label}
      </span>
      {children}
    </label>
  );
}

function PortalLoadError({
  message,
  onRetry,
  refreshing
}: {
  message: string;
  onRetry: () => void;
  refreshing: boolean;
}) {
  return (
    <main dir="rtl" className="grid min-h-screen place-items-center bg-[#eef2f6] px-4 text-[#17233a]">
      <section className="w-full max-w-md rounded-lg border border-[#d7dee7] bg-white p-8 text-center shadow-[0_20px_60px_rgba(23,35,58,0.10)]">
        <RefreshCw className={`mx-auto h-8 w-8 text-[#1769aa] ${refreshing ? "animate-spin" : ""}`} />
        <h1 className="mt-4 text-xl font-bold">تعذر فتح لوحة المهندس</h1>
        <p className="mt-2 text-sm leading-6 text-[#66758a]">{message}</p>
        <button
          type="button"
          disabled={refreshing}
          onClick={onRetry}
          className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#1769aa] px-5 text-sm font-bold text-white"
        >
          إعادة المحاولة
        </button>
      </section>
    </main>
  );
}

function EngineerRequestCard({
  token,
  request,
  onUpdated
}: {
  token: string;
  request: PortalMaintenanceRequest;
  onUpdated: (request: PortalMaintenanceRequest) => void;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function update(payload: { status?: "IN_PROGRESS" | "WAITING_SPARE_PARTS" | "COMPLETED"; note?: string }) {
    setBusy(true);
    setError(null);
    try {
      const updated = await updateEngineerPortalRequest(token, request.id, payload);
      onUpdated(updated);
      setNote("");
    } catch {
      setError("تعذر تحديث الطلب. أعد المحاولة بعد تحديث الصفحة.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="overflow-hidden rounded-lg border border-[#d9e0e8] bg-white transition hover:border-[#b8c8d8] hover:shadow-[0_12px_28px_rgba(23,35,58,0.06)]">
      <div className="h-1 bg-[#1769aa]" />
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#e3e8ed] p-4 sm:p-5">
        <div>
          <span className="text-xs font-bold text-[#1769aa]">طلب #{request.id}</span>
          <strong className="mt-1 block text-base">{request.client_company_name}</strong>
          <p className="m-0 mt-1 text-sm text-[#66758a]">
            {getSpecialtyLabel(request.issue_type, "ar")} · {getPriorityLabel(request.priority, "ar")}
          </p>
        </div>
        <span className="rounded-full bg-[#e8f1f9] px-3 py-1 text-xs font-bold text-[#1769aa]">
          {statusLabels[request.status].ar}
        </span>
      </div>

      <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
        <TaskInfo icon={MapPin} label="الموقع" value={request.location_details} />
        <TaskInfo
          icon={CalendarDays}
          label="الموعد"
          value={new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(request.preferred_date))}
          ltr
        />
        <div className="sm:col-span-2">
          <span className="block text-xs font-bold text-[#7b899a]">وصف العطل</span>
          <p className="m-0 mt-1 text-sm leading-6">{request.description}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-y border-[#e3e8ed] bg-[#f7f9fb] p-4 sm:px-5">
        {request.status === "ASSIGNED" && (
          <TaskButton icon={PlayCircle} disabled={busy} onClick={() => void update({ status: "IN_PROGRESS" })}>
            قبول وبدء العمل
          </TaskButton>
        )}
        {request.status === "IN_PROGRESS" && (
          <>
            <TaskButton icon={PauseCircle} tone="neutral" disabled={busy} onClick={() => void update({ status: "WAITING_SPARE_PARTS" })}>
              انتظار قطع غيار
            </TaskButton>
            <TaskButton icon={CheckCircle2} tone="success" disabled={busy} onClick={() => void update({ status: "COMPLETED" })}>
              إنهاء العمل
            </TaskButton>
          </>
        )}
        {request.status === "WAITING_SPARE_PARTS" && (
          <>
            <TaskButton icon={PlayCircle} disabled={busy} onClick={() => void update({ status: "IN_PROGRESS" })}>
              استئناف العمل
            </TaskButton>
            <TaskButton icon={CheckCircle2} tone="success" disabled={busy} onClick={() => void update({ status: "COMPLETED" })}>
              إنهاء العمل
            </TaskButton>
          </>
        )}
        {busy && <Loader2 className="h-5 w-5 animate-spin self-center text-[#1769aa]" />}
      </div>

      <div className="p-4 sm:p-5">
        <label className="grid gap-2">
          <span className="flex items-center gap-2 text-sm font-bold text-[#536174]">
            <MessageSquareText className="h-4 w-4 text-[#1769aa]" />
            ملاحظة فنية
          </span>
          <div className="flex gap-2">
            <textarea
              rows={2}
              maxLength={2000}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="اكتب ما تم فحصه أو تنفيذه..."
              className="min-h-20 flex-1 resize-y rounded-lg border border-[#ccd6e2] p-3 text-sm outline-none focus:border-[#1769aa] focus:ring-4 focus:ring-[#1769aa]/10"
            />
            <button
              type="button"
              disabled={busy || !note.trim()}
              onClick={() => void update({ note: note.trim() })}
              title="إرسال الملاحظة"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[#1769aa] text-white disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </label>
        {error && <div className="mt-3"><ErrorNotice>{error}</ErrorNotice></div>}
        {request.activities.length > 0 && (
          <div className="mt-4 grid gap-2 border-t border-[#e3e8ed] pt-4">
            <span className="text-xs font-bold text-[#7b899a]">سجل التحديثات</span>
            {request.activities.slice(-4).reverse().map((activity) => (
              <div key={activity.id} className="flex items-start gap-3 text-sm">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#1769aa]" />
                <div>
                  <p className="m-0">{formatRequestActivity(activity, "ar")}</p>
                  <span dir="ltr" className="mt-1 block text-xs text-[#7b899a]">
                    {new Intl.DateTimeFormat("en-GB", { dateStyle: "short", timeStyle: "short" }).format(new Date(activity.created_at))}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

function TaskButton({
  icon: Icon,
  children,
  onClick,
  disabled,
  tone = "primary"
}: {
  icon: typeof PlayCircle;
  children: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
  tone?: "primary" | "neutral" | "success";
}) {
  const tones = {
    primary: "bg-[#1769aa] text-white hover:bg-[#12598f]",
    neutral: "bg-[#e9edf1] text-[#455468] hover:bg-[#dce2e8]",
    success: "bg-[#237348] text-white hover:bg-[#1d603c]"
  };
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-bold ${tones[tone]}`}>
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-3"><dt className="text-[#66758a]">{label}</dt><dd className="m-0 max-w-[150px] text-left font-bold">{value || "—"}</dd></div>;
}

function TaskInfo({ label, value, ltr = false, icon: Icon }: { label: string; value: string; ltr?: boolean; icon: typeof MapPin }) {
  return <div className="flex min-w-0 gap-2"><Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#7990a7]" /><div className="min-w-0"><span className="block text-xs font-bold text-[#7b899a]">{label}</span><span dir={ltr ? "ltr" : undefined} className="mt-1 block break-words text-sm font-semibold">{value}</span></div></div>;
}

function EngineerMetric({
  label,
  value,
  icon: Icon,
  tone = "blue",
  suffix = ""
}: {
  label: string;
  value: number;
  icon: typeof BriefcaseBusiness;
  tone?: "blue" | "green" | "amber";
  suffix?: string;
}) {
  const tones = {
    blue: "bg-[#e8f1f9] text-[#1769aa]",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700"
  };
  return (
    <div className="flex min-h-24 items-center gap-4 rounded-lg border border-[#d9e0e8] bg-white p-4 shadow-[0_6px_18px_rgba(23,35,58,0.04)]">
      <span className={`grid h-11 w-11 place-items-center rounded-lg ${tones[tone]}`}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div>
        <span className="block text-xs font-semibold text-[#66758a]">{label}</span>
        <strong className="mt-1 block text-2xl">{value}<small className="text-sm font-semibold text-[#66758a]">{suffix}</small></strong>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="grid min-h-56 place-items-center rounded-lg border border-dashed border-[#cbd4df] bg-white p-6 text-center">
      <div>
        <ClipboardCheck className="mx-auto h-7 w-7 text-[#7b899a]" />
        <p className="m-0 mt-3 font-bold">لا توجد مهام نشطة حاليًا</p>
        <span className="mt-1 block text-sm text-[#66758a]">ستظهر هنا الطلبات التي يتم توجيهها إليك.</span>
      </div>
    </div>
  );
}

function ErrorNotice({ children }: { children: React.ReactNode }) {
  return <p className="m-0 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{children}</p>;
}

function PortalLoading() {
  return (
    <main dir="rtl" className="grid min-h-screen place-items-center bg-[#eef2f6]">
      <div className="flex items-center gap-3 text-sm font-bold text-[#536174]">
        <Loader2 className="h-5 w-5 animate-spin text-[#1769aa]" />
        جارٍ فتح لوحة المهندس
      </div>
    </main>
  );
}
