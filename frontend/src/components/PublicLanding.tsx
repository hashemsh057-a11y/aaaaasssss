"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Cog,
  Globe2,
  HardHat,
  Loader2,
  Mail,
  MapPin,
  Menu,
  Network,
  Phone,
  Search,
  ShieldCheck,
  Snowflake,
  Trash2,
  UserPlus,
  Wrench,
  X,
  Zap,
  type LucideIcon
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import {
  getPublicImpactStatistics,
  submitPublicMaintenanceRequest,
  trackPublicRequest
} from "@/src/lib/api";
import type {
  Language,
  MaintenanceSpecialty,
  MaintenanceStatus,
  Priority,
  PublicImpactStatistics,
  PublicMaintenanceRequestPayload,
  PublicTrackedRequest
} from "@/src/lib/types";

type RequestFormState = Omit<PublicMaintenanceRequestPayload, "preferred_date"> & {
  preferred_date: string;
};

type Copy = {
  dir: "rtl" | "ltr";
  brand: string;
  tagline: string;
  nav: {
    services: string;
    workflow: string;
    request: string;
    stats: string;
    engineers: string;
    login: string;
    language: string;
  };
  hero: {
    eyebrow: string;
    titleA: string;
    titleAccent: string;
    titleB: string;
    description: string;
    primary: string;
    secondary: string;
    dashboardTitle: string;
    live: string;
    ticketsToday: string;
    avgResponse: string;
    quality: string;
  };
  services: {
    eyebrow: string;
    title: string;
    description: string;
  };
  workflow: {
    eyebrow: string;
    title: string;
    description: string;
  };
  stats: {
    eyebrow: string;
    title: string;
    total: string;
    open: string;
    completed: string;
    rate: string;
  };
  engineers: {
    eyebrow: string;
    title: string;
    description: string;
    name: string;
    phone: string;
    specialty: string;
    submit: string;
    listTitle: string;
    countLabel: string;
    empty: string;
    remove: string;
  };
  request: {
    eyebrow: string;
    title: string;
    description: string;
    companyName: string;
    contactName: string;
    commercialRegister: string;
    email: string;
    phone: string;
    address: string;
    issueType: string;
    priority: string;
    location: string;
    preferredDate: string;
    details: string;
    hazardous: string;
    submit: string;
    submitting: string;
    success: string;
    ticket: string;
    error: string;
  };
  track: {
    title: string;
    description: string;
    ticketPlaceholder: string;
    submit: string;
    loading: string;
    error: string;
    status: string;
  };
  footer: string;
};

type ServiceItem = {
  specialty: MaintenanceSpecialty;
  icon: LucideIcon;
  arTitle: string;
  enTitle: string;
  arDesc: string;
  enDesc: string;
};

type WorkflowItem = {
  icon: LucideIcon;
  arTitle: string;
  enTitle: string;
  arDesc: string;
  enDesc: string;
};

const copy: Record<Language, Copy> = {
  ar: {
    dir: "rtl",
    brand: "إنجي فلو",
    tagline: "خطّط. أدِر. أنجز.",
    nav: {
      services: "الخدمات",
      workflow: "المسار",
      request: "تسجيل طلب",
      stats: "المؤشرات",
      engineers: "المهندسون",
      login: "دخول النظام",
      language: "English"
    },
    hero: {
      eyebrow: "منصة صيانة تشغيلية للشركات",
      titleA: "صيانة واضحة",
      titleAccent: "",
      titleB: "من أول بلاغ حتى الإغلاق.",
      description:
        "أرسل بلاغ الصيانة من هذه الصفحة، يصل مباشرة إلى فريق العمل، وتتابع حالته لحظة بلحظة حتى الإنجاز.",
      primary: "تقديم طلب صيانة",
      secondary: "تتبع طلب سابق",
      dashboardTitle: "لوحة المتابعة المباشرة",
      live: "متصل",
      ticketsToday: "طلبات اليوم",
      avgResponse: "متوسط الاستجابة",
      quality: "مراجعة الجودة"
    },
    services: {
      eyebrow: "تخصصات موحدة",
      title: "جميع فرق الصيانة تعمل ضمن مسار واحد",
      description: "كهرباء، تكييف، شبكات، أمن سيبراني — كل طلب يُتابع بالحالة والأولوية من مكان واحد."
    },
    workflow: {
      eyebrow: "آلية العمل",
      title: "مسار منظّم من التسجيل حتى الإغلاق",
      description: "كل خطوة موثّقة، وكل طلب يحمل سجلّه الكامل من لحظة تقديمه حتى إتمامه."
    },
    stats: {
      eyebrow: "إحصائيات عامة",
      title: "نظرة سريعة على أداء المنظومة",
      total: "إجمالي الطلبات",
      open: "طلبات قيد المعالجة",
      completed: "طلبات مكتملة",
      rate: "نسبة الإنجاز"
    },
    engineers: {
      eyebrow: "فريق العمل",
      title: "إضافة مهندس إلى الفريق",
      description: "أضف بيانات المهندس الأساسية ليظهر ضمن قائمة فريق الصيانة. تُحفظ البيانات على هذا المتصفح.",
      name: "اسم المهندس",
      phone: "رقم الهاتف",
      specialty: "التخصص",
      submit: "إضافة المهندس",
      listTitle: "قائمة المهندسين",
      countLabel: "مهندس",
      empty: "لا يوجد مهندسون مضافون بعد. ابدأ بإضافة أول مهندس إلى الفريق.",
      remove: "حذف المهندس"
    },
    request: {
      eyebrow: "تقديم طلب جديد",
      title: "تقديم طلب صيانة",
      description:
        "أدخل بيانات شركتك وتفاصيل العطل، وسيتم تسجيل الطلب تلقائيًا في المنظومة وتعيين رقم تذكرة لمتابعته.",
      companyName: "اسم الشركة",
      contactName: "اسم المسؤول",
      commercialRegister: "السجل التجاري",
      email: "البريد الإلكتروني",
      phone: "رقم الهاتف",
      address: "عنوان الشركة",
      issueType: "نوع العطل",
      priority: "الأولوية",
      location: "موقع العطل",
      preferredDate: "الموعد المفضل",
      details: "تفاصيل الطلب",
      hazardous: "يتضمن هذا البلاغ خطورة تشغيلية",
      submit: "إرسال الطلب",
      submitting: "جارٍ إرسال الطلب...",
      success: "تم تسجيل طلبك بنجاح. يرجى الاحتفاظ برقم التذكرة لمتابعة حالة الطلب.",
      ticket: "رقم التذكرة",
      error: "تعذّر إرسال الطلب. يرجى التحقق من البيانات المدخلة والمحاولة مرة أخرى."
    },
    track: {
      title: "متابعة طلب سابق",
      description: "أدخل رقم التذكرة لمعرفة حالة طلبك.",
      ticketPlaceholder: "مثال: 24",
      submit: "استعلام",
      loading: "جارٍ البحث...",
      error: "لم يتم العثور على تذكرة بهذا الرقم.",
      status: "الحالة"
    },
    footer: "منصة متكاملة لإدارة طلبات الصيانة المؤسسية ومتابعتها."
  },
  en: {
    dir: "ltr",
    brand: "EngiFlow",
    tagline: "Plan. Manage. Achieve.",
    nav: {
      services: "Services",
      workflow: "Workflow",
      request: "Create Request",
      stats: "Stats",
      engineers: "Engineers",
      login: "System Login",
      language: "العربية"
    },
    hero: {
      eyebrow: "Operational maintenance platform for companies",
      titleA: "Clear maintenance",
      titleAccent: "",
      titleB: "from first report to closure.",
      description:
        "Submit your maintenance request from this page. It reaches the team instantly, and you can track its progress every step of the way.",
      primary: "Submit a request",
      secondary: "Track a request",
      dashboardTitle: "Live operations view",
      live: "Live",
      ticketsToday: "Today's tickets",
      avgResponse: "Avg response",
      quality: "Quality review"
    },
    services: {
      eyebrow: "Unified specialties",
      title: "All maintenance teams operate on a single workflow",
      description: "Electrical, HVAC, networking, cybersecurity — every request is tracked by status and priority in one place."
    },
    workflow: {
      eyebrow: "Workflow",
      title: "A structured path from submission to completion",
      description: "Every step is documented, and every request carries its full history from the moment it is submitted."
    },
    stats: {
      eyebrow: "Performance overview",
      title: "A quick look at system performance",
      total: "Total requests",
      open: "In progress",
      completed: "Completed",
      rate: "Completion rate"
    },
    engineers: {
      eyebrow: "Our team",
      title: "Add an engineer to the team",
      description: "Add an engineer's core details to list them on the maintenance team. Entries are saved on this browser.",
      name: "Engineer name",
      phone: "Phone number",
      specialty: "Specialty",
      submit: "Add engineer",
      listTitle: "Engineers list",
      countLabel: "engineers",
      empty: "No engineers added yet. Add the first engineer to the team.",
      remove: "Remove engineer"
    },
    request: {
      eyebrow: "New request",
      title: "Submit a maintenance request",
      description:
        "Enter your company details and describe the issue. A ticket number will be assigned automatically for tracking.",
      companyName: "Company name",
      contactName: "Contact person",
      commercialRegister: "Commercial register",
      email: "Email",
      phone: "Phone",
      address: "Company address",
      issueType: "Issue type",
      priority: "Priority",
      location: "Issue location",
      preferredDate: "Preferred date",
      details: "Request details",
      hazardous: "This issue involves operational risk",
      submit: "Submit request",
      submitting: "Submitting...",
      success: "Your request has been submitted successfully. Please save your ticket number for future reference.",
      ticket: "Ticket number",
      error: "Unable to submit the request. Please check your details and try again."
    },
    track: {
      title: "Track a previous request",
      description: "Enter your ticket number to check the status of your request.",
      ticketPlaceholder: "Example: 24",
      submit: "Look up",
      loading: "Searching...",
      error: "No ticket found with this number.",
      status: "Status"
    },
    footer: "An integrated platform for managing and tracking enterprise maintenance requests."
  }
};

const specialties: ServiceItem[] = [
  {
    specialty: "ELECTRICITY",
    icon: Zap,
    arTitle: "الكهرباء",
    enTitle: "Electricity",
    arDesc: "لوحات، إنارة، مولدات، ومخاطر تشغيلية.",
    enDesc: "Panels, lighting, generators, and operational risks."
  },
  {
    specialty: "HVAC",
    icon: Snowflake,
    arTitle: "التكييف والتهوية",
    enTitle: "HVAC",
    arDesc: "بلاغات تبريد وتهوية مرتبطة بالموقع والأولوية.",
    enDesc: "Cooling and ventilation requests linked to location and priority."
  },
  {
    specialty: "NETWORKS",
    icon: Network,
    arTitle: "الشبكات",
    enTitle: "Networks",
    arDesc: "انقطاعات، كابلات، نقاط اتصال، وغرف بيانات.",
    enDesc: "Outages, cables, access points, and data rooms."
  },
  {
    specialty: "CYBERSECURITY",
    icon: ShieldCheck,
    arTitle: "الأمن السيبراني",
    enTitle: "Cybersecurity",
    arDesc: "بلاغات أمنية مع مراجعة مضبوطة وقابلة للتوثيق.",
    enDesc: "Security reports with controlled, auditable review."
  }
];

const specialtyChoices: Array<{ value: MaintenanceSpecialty; ar: string; en: string }> = [
  { value: "ELECTRICITY", ar: "الكهرباء", en: "Electricity" },
  { value: "NETWORKS", ar: "الشبكات", en: "Networks" },
  { value: "HVAC", ar: "التكييف والتهوية", en: "HVAC" },
  { value: "PLUMBING", ar: "السباكة", en: "Plumbing" },
  { value: "MEDICAL_DEVICES", ar: "الأجهزة الطبية", en: "Medical devices" },
  { value: "SURVEILLANCE", ar: "المراقبة", en: "Surveillance" },
  { value: "SOFTWARE", ar: "البرمجيات", en: "Software" },
  { value: "SERVERS", ar: "الخوادم", en: "Servers" },
  { value: "CYBERSECURITY", ar: "الأمن السيبراني", en: "Cybersecurity" }
];

const workflowItems: WorkflowItem[] = [
  {
    icon: ClipboardList,
    arTitle: "تسجيل البلاغ",
    enTitle: "Report",
    arDesc: "الشركة تسجل بيانات العطل والأولوية.",
    enDesc: "The company submits issue details and priority."
  },
  {
    icon: Wrench,
    arTitle: "توجيه العمل",
    enTitle: "Assign",
    arDesc: "الإدارة تعين المهندس حسب التخصص.",
    enDesc: "Admins assign the right engineer by specialty."
  },
  {
    icon: CalendarClock,
    arTitle: "متابعة الحالة",
    enTitle: "Track",
    arDesc: "كل انتقال يظهر داخل الداش بورد.",
    enDesc: "Every state move is visible in the dashboard."
  },
  {
    icon: CheckCircle2,
    arTitle: "إغلاق موثق",
    enTitle: "Close",
    arDesc: "الإغلاق يتم بعد اكتمال المسار والمراجعة.",
    enDesc: "Closure happens after workflow and review are complete."
  }
];

const priorityLabels: Record<Priority, Record<Language, string>> = {
  LOW: { ar: "منخفضة", en: "Low" },
  MEDIUM: { ar: "متوسطة", en: "Medium" },
  HIGH: { ar: "عالية", en: "High" },
  CRITICAL: { ar: "حرجة", en: "Critical" }
};

const statusLabels: Record<MaintenanceStatus, Record<Language, string>> = {
  NEW: { ar: "جديد", en: "New" },
  UNDER_REVIEW: { ar: "قيد المراجعة", en: "Under review" },
  ASSIGNED: { ar: "تم التعيين", en: "Assigned" },
  IN_PROGRESS: { ar: "قيد التنفيذ", en: "In progress" },
  WAITING_SPARE_PARTS: { ar: "بانتظار قطع الغيار", en: "Waiting parts" },
  COMPLETED: { ar: "مكتمل", en: "Completed" },
  REJECTED: { ar: "مرفوض", en: "Rejected" },
  CLOSED: { ar: "مغلق", en: "Closed" }
};

type StoredEngineer = {
  id: string;
  name: string;
  phone: string;
  specialty: MaintenanceSpecialty;
};

const ENGINEERS_STORAGE_KEY = "engiflow_engineers";

function loadStoredEngineers(): StoredEngineer[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(ENGINEERS_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredEngineer[]) : [];
  } catch {
    return [];
  }
}

function createEngineerId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `eng-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function defaultPreferredDate() {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function initialRequestForm(): RequestFormState {
  return {
    company_name: "",
    contact_name: "",
    commercial_register: "",
    email: "",
    phone: "",
    address: "",
    issue_type: "HVAC",
    priority: "MEDIUM",
    location_details: "",
    description: "",
    preferred_date: defaultPreferredDate(),
    is_hazardous: false
  };
}

function getServiceTitle(service: ServiceItem, language: Language) {
  return language === "ar" ? service.arTitle : service.enTitle;
}

function getServiceDescription(service: ServiceItem, language: Language) {
  return language === "ar" ? service.arDesc : service.enDesc;
}

function getWorkflowTitle(item: WorkflowItem, language: Language) {
  return language === "ar" ? item.arTitle : item.enTitle;
}

function getWorkflowDescription(item: WorkflowItem, language: Language) {
  return language === "ar" ? item.arDesc : item.enDesc;
}

function getSpecialtyName(value: MaintenanceSpecialty, language: Language) {
  const specialty = specialtyChoices.find((item) => item.value === value);
  if (!specialty) {
    return value;
  }
  return language === "ar" ? specialty.ar : specialty.en;
}

export function PublicLanding() {
  const [language, setLanguage] = useState<Language>("ar");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [trackOpen, setTrackOpen] = useState(false);
  const [ticketNumber, setTicketNumber] = useState("");
  const [trackedRequest, setTrackedRequest] = useState<PublicTrackedRequest | null>(null);
  const [trackError, setTrackError] = useState<string | null>(null);
  const [trackLoading, setTrackLoading] = useState(false);
  const [impactStats, setImpactStats] = useState<PublicImpactStatistics | null>(null);
  const [requestForm, setRequestForm] = useState<RequestFormState>(() => initialRequestForm());
  const [requestState, setRequestState] = useState<"idle" | "submitting" | "created">("idle");
  const [createdTicket, setCreatedTicket] = useState<PublicTrackedRequest | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);

  const t = copy[language];
  const isRtl = t.dir === "rtl";
  const numberFormat = useMemo(() => new Intl.NumberFormat(language === "ar" ? "ar-LY" : "en-US"), [language]);
  const DirectionArrow = isRtl ? ArrowLeft : ArrowRight;

  useEffect(() => {
    getPublicImpactStatistics()
      .then(setImpactStats)
      .catch(() => setImpactStats(null));
  }, []);

  async function handleTrackSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTrackLoading(true);
    setTrackError(null);
    setTrackedRequest(null);

    try {
      const request = await trackPublicRequest(ticketNumber.trim());
      setTrackedRequest(request);
    } catch {
      setTrackError(t.track.error);
    } finally {
      setTrackLoading(false);
    }
  }

  async function handleRequestSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRequestState("submitting");
    setRequestError(null);
    setCreatedTicket(null);

    try {
      const payload: PublicMaintenanceRequestPayload = {
        ...requestForm,
        preferred_date: new Date(requestForm.preferred_date).toISOString()
      };
      const created = await submitPublicMaintenanceRequest(payload);
      setCreatedTicket(created);
      setTicketNumber(String(created.id));
      setRequestForm(initialRequestForm());
      setRequestState("created");
    } catch {
      setRequestError(t.request.error);
      setRequestState("idle");
    }
  }

  const navLinks = [
    { href: "#services", label: t.nav.services },
    { href: "#workflow", label: t.nav.workflow },
    { href: "#engineers", label: t.nav.engineers },
    { href: "#stats", label: t.nav.stats },
    { href: "#request", label: t.nav.request }
  ];

  const statItems = [
    { label: t.stats.total, value: impactStats ? numberFormat.format(impactStats.total_requests) : "-" },
    { label: t.stats.open, value: impactStats ? numberFormat.format(impactStats.total_open_requests) : "-" },
    { label: t.stats.completed, value: impactStats ? numberFormat.format(impactStats.completed_tickets) : "-" },
    { label: t.stats.rate, value: impactStats ? `${numberFormat.format(impactStats.completion_rate)}%` : "-" }
  ];

  return (
    <div
      dir={t.dir}
      className="min-h-screen overflow-x-hidden bg-[#f7fbf8] text-[#1b2b27] selection:bg-[#c7eef0] selection:text-[#123532]"
    >
      <nav className="sticky top-0 z-50 border-b border-white/70 bg-[#fbfdf9]/80 backdrop-blur-2xl">
        <div className="container mx-auto flex min-h-[72px] items-center justify-between gap-4 px-4 sm:px-6">
          <a href="/" className="flex min-w-0 items-center no-underline">
            <BrandWordmark language={language} />
          </a>

          <div className="hidden items-center gap-8 text-sm font-bold text-[#61736e] md:flex">
            {navLinks.map((link) => (
              <a key={link.href} href={link.href} className="no-underline transition-colors hover:text-[#0d827a]">
                {link.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setLanguage(language === "ar" ? "en" : "ar")}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-white/80 px-4 text-sm font-bold text-[#46635d] shadow-sm transition-all hover:-translate-y-0.5 hover:bg-[#edf8f7]"
            >
              <Globe2 className="h-4 w-4" aria-hidden="true" />
              {t.nav.language}
            </button>
            <a
              href="#request"
              className="hidden h-11 items-center gap-2 rounded-full bg-[#0f8d86] px-5 text-sm font-extrabold text-white no-underline shadow-lg shadow-[#0f8d86]/20 transition-all hover:-translate-y-0.5 hover:bg-[#0d7b75] sm:inline-flex"
            >
              {t.hero.primary}
            </a>
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="grid h-11 w-11 place-items-center rounded-full bg-white/80 text-[#24433d] shadow-sm md:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </nav>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div className="fixed inset-0 z-[70] bg-[#17312d]/35 backdrop-blur-sm md:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.aside
              initial={{ x: isRtl ? 320 : -320 }}
              animate={{ x: 0 }}
              exit={{ x: isRtl ? 320 : -320 }}
              transition={{ type: "spring", stiffness: 260, damping: 28 }}
              className={`absolute top-0 h-full w-[min(86vw,320px)] bg-[#fbfdf9] p-5 shadow-2xl ${isRtl ? "right-0" : "left-0"}`}
            >
              <div className="mb-8 flex items-center justify-between">
                <BrandWordmark language={language} />
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="grid h-10 w-10 place-items-center rounded-full bg-[#edf8f7] text-[#24433d]"
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
              <div className="grid gap-3">
                {navLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className="rounded-2xl bg-[#eef8f6] px-4 py-4 text-base font-extrabold text-[#24433d] no-underline"
                  >
                    {link.label}
                  </a>
                ))}
                <a
                  href="#request"
                  onClick={() => setMobileOpen(false)}
                  className="mt-2 rounded-2xl bg-[#0f8d86] px-4 py-4 text-center font-extrabold text-white no-underline"
                >
                  {t.hero.primary}
                </a>
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      <main>
        <section className="relative overflow-hidden bg-[linear-gradient(135deg,#f8fff9_0%,#edf9fb_45%,#fffaf2_100%)] py-20 sm:py-24">
          <div className="absolute right-[-8rem] top-[-10rem] h-80 w-80 rounded-full bg-[#bfecef]/45 blur-3xl" />
          <div className="absolute bottom-[-12rem] left-[-10rem] h-96 w-96 rounded-full bg-[#f5ead6]/70 blur-3xl" />
          <div className="container relative mx-auto grid items-center gap-14 px-4 sm:px-6 md:grid-cols-2">
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }} className={isRtl ? "text-right" : "text-left"}>
              <span className="mb-5 inline-flex rounded-full bg-white/75 px-4 py-2 text-sm font-extrabold text-[#0d827a] shadow-sm">
                {t.hero.eyebrow}
              </span>
              <h1 className="max-w-2xl text-4xl font-extrabold leading-tight tracking-normal text-[#17312d] md:text-5xl">
                {t.hero.titleA}{" "}
                {t.hero.titleAccent && (
                  <>
                    <span className="bg-gradient-to-r from-[#0f8d86] to-[#4aa9c1] bg-clip-text text-transparent">
                      {t.hero.titleAccent}
                    </span>{" "}
                  </>
                )}
                {t.hero.titleB}
              </h1>
              <p className="mt-6 max-w-xl text-base leading-8 text-[#5d716b] md:text-lg">{t.hero.description}</p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <a
                  href="#request"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#0f8d86] px-6 text-sm font-extrabold text-white no-underline shadow-xl shadow-[#0f8d86]/20 transition-all hover:-translate-y-1 hover:bg-[#0d7b75]"
                >
                  {t.hero.primary}
                  <DirectionArrow className="h-4 w-4" aria-hidden="true" />
                </a>
                <button
                  type="button"
                  onClick={() => setTrackOpen(true)}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-white/80 px-6 text-sm font-extrabold text-[#24433d] shadow-sm transition-all hover:-translate-y-1 hover:bg-[#edf8f7]"
                >
                  <Search className="h-4 w-4" aria-hidden="true" />
                  {t.hero.secondary}
                </button>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.08 }}
              className="relative"
            >
              <div className="absolute inset-6 rounded-[3rem] bg-[#bde9ec]/45 blur-3xl" />
              <div className="relative rounded-[2.25rem] bg-white/72 p-5 shadow-2xl shadow-[#7ebcc1]/20 backdrop-blur-xl">
                <div className="mb-6 flex items-center justify-between gap-4">
                  <div>
                    <p className="m-0 text-sm font-extrabold text-[#70827d]">{t.hero.dashboardTitle}</p>
                    <h2 className="m-0 mt-1 text-2xl font-extrabold text-[#17312d]">Ops Console</h2>
                  </div>
                  <span className="inline-flex items-center gap-2 rounded-full bg-[#e5f7f6] px-3 py-2 text-xs font-extrabold text-[#0d827a]">
                    <span className="h-2 w-2 rounded-full bg-[#0f8d86]" />
                    {t.hero.live}
                  </span>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  {[
                    { label: t.hero.ticketsToday, value: "18" },
                    { label: t.hero.avgResponse, value: "24m" },
                    { label: t.hero.quality, value: "96%" }
                  ].map((item) => (
                    <div key={item.label} className="rounded-3xl bg-[#f6fbfa] px-4 py-5">
                      <p className="m-0 truncate text-xs font-bold text-[#73847f]">{item.label}</p>
                      <strong className="mt-3 block text-3xl font-extrabold text-[#0d827a]">{item.value}</strong>
                    </div>
                  ))}
                </div>

                <div className="mt-6 grid gap-4">
                  {specialties.slice(0, 3).map((service, index) => {
                    const width = ["w-10/12", "w-8/12", "w-6/12"][index];
                    return (
                      <div key={service.specialty} className="rounded-3xl bg-[#fbfdf9] p-4">
                        <div className="mb-3 flex items-center justify-between text-sm font-extrabold text-[#24433d]">
                          <span>{getServiceTitle(service, language)}</span>
                          <span className="text-[#8da09a]">0{index + 1}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-[#e3eeee]">
                          <span className={`block h-full rounded-full bg-[#0f8d86] ${width}`} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <section id="services" className="bg-[#fbfdf9] py-20 sm:py-24">
          <div className="container mx-auto px-4 sm:px-6">
            <div className="mx-auto mb-14 max-w-3xl text-center">
              <span className="text-sm font-extrabold text-[#0d827a]">{t.services.eyebrow}</span>
              <h2 className="mt-4 text-3xl font-extrabold leading-tight text-[#17312d] md:text-4xl">{t.services.title}</h2>
              <p className="mt-4 text-base leading-8 text-[#657872]">{t.services.description}</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {specialties.map((service) => {
                const Icon = service.icon;
                return (
                  <motion.article
                    key={service.specialty}
                    whileHover={{ y: -6 }}
                    className="rounded-[2rem] bg-[#f4faf8] p-6 transition-colors hover:bg-[#eef8f7]"
                  >
                    <span className="mb-6 grid h-14 w-14 place-items-center rounded-full bg-[#e1f4f3] text-[#0d827a] shadow-sm">
                      <Icon className="h-7 w-7" aria-hidden="true" />
                    </span>
                    <h3 className="text-xl font-extrabold text-[#17312d]">{getServiceTitle(service, language)}</h3>
                    <p className="mt-3 text-sm leading-7 text-[#657872]">{getServiceDescription(service, language)}</p>
                  </motion.article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="workflow" className="bg-[#f7fbf8] py-20 sm:py-24">
          <div className="container mx-auto px-4 sm:px-6">
            <div className="mb-16 grid gap-6 md:grid-cols-[0.8fr_1.2fr] md:items-end">
              <div className={isRtl ? "text-right" : "text-left"}>
                <span className="text-sm font-extrabold text-[#0d827a]">{t.workflow.eyebrow}</span>
                <h2 className="mt-4 text-3xl font-extrabold leading-tight text-[#17312d] md:text-4xl">{t.workflow.title}</h2>
              </div>
              <p className="text-base leading-8 text-[#657872]">{t.workflow.description}</p>
            </div>

            <div className="grid gap-8 md:grid-cols-4">
              {workflowItems.map((item, index) => {
                const Icon = item.icon;
                return (
                  <motion.div
                    key={item.arTitle}
                    initial={{ opacity: 0, y: 18 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-80px" }}
                    transition={{ delay: index * 0.06 }}
                    className="relative"
                  >
                    <span className="mb-6 grid h-14 w-14 place-items-center rounded-full bg-[#e5f7f6] text-[#0d827a] shadow-sm">
                      <Icon className="h-7 w-7" aria-hidden="true" />
                    </span>
                    <span className="text-sm font-extrabold text-[#9aaba5]">{String(index + 1).padStart(2, "0")}</span>
                    <h3 className="mt-3 text-xl font-extrabold text-[#17312d]">{getWorkflowTitle(item, language)}</h3>
                    <p className="mt-3 text-sm leading-7 text-[#657872]">{getWorkflowDescription(item, language)}</p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        <EngineersSection copy={t} language={language} />

        <section id="stats" className="bg-[#eef7f6] py-20">
          <div className="container mx-auto px-4 sm:px-6">
            <div className="mb-12 max-w-2xl">
              <span className="text-sm font-extrabold text-[#0d827a]">{t.stats.eyebrow}</span>
              <h2 className="mt-4 text-3xl font-extrabold text-[#17312d] md:text-4xl">{t.stats.title}</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {statItems.map((item) => (
                <div key={item.label} className="rounded-[2rem] bg-white/70 p-6">
                  <p className="m-0 text-sm font-bold text-[#657872]">{item.label}</p>
                  <strong className="mt-4 block text-3xl font-extrabold text-[#0d827a]">{item.value}</strong>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="request" className="bg-[linear-gradient(135deg,#fffdf7_0%,#f2fbfa_100%)] py-20 sm:py-24">
          <div className="container mx-auto grid gap-12 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
            <div className={isRtl ? "text-right" : "text-left"}>
              <span className="text-sm font-extrabold text-[#0d827a]">{t.request.eyebrow}</span>
              <h2 className="mt-4 text-3xl font-extrabold leading-tight text-[#17312d] md:text-4xl">{t.request.title}</h2>
              <p className="mt-5 text-base leading-8 text-[#657872]">{t.request.description}</p>

              {createdTicket && (
                <div className="mt-8 rounded-[2rem] bg-[#e5f7f6] p-5 text-[#17312d]">
                  <p className="m-0 text-sm font-bold text-[#0d827a]">{t.request.success}</p>
                  <strong className="mt-3 block text-3xl font-extrabold">
                    {t.request.ticket}: #{createdTicket.id}
                  </strong>
                </div>
              )}
            </div>

            <form onSubmit={handleRequestSubmit} className="rounded-[2rem] bg-white/76 p-5 shadow-2xl shadow-[#a5ccd0]/20 backdrop-blur-xl sm:p-7">
              <div className="grid gap-5 md:grid-cols-2">
                <Field label={t.request.companyName}>
                  <input
                    required
                    value={requestForm.company_name}
                    onChange={(event) => setRequestForm({ ...requestForm, company_name: event.target.value })}
                    className="public-input"
                  />
                </Field>
                <Field label={t.request.contactName}>
                  <input
                    required
                    value={requestForm.contact_name}
                    onChange={(event) => setRequestForm({ ...requestForm, contact_name: event.target.value })}
                    className="public-input"
                  />
                </Field>
                <Field label={t.request.commercialRegister}>
                  <input
                    required
                    value={requestForm.commercial_register}
                    onChange={(event) => setRequestForm({ ...requestForm, commercial_register: event.target.value })}
                    className="public-input"
                  />
                </Field>
                <Field label={t.request.email} icon={Mail}>
                  <input
                    required
                    type="email"
                    value={requestForm.email}
                    onChange={(event) => setRequestForm({ ...requestForm, email: event.target.value })}
                    className="public-input"
                  />
                </Field>
                <Field label={t.request.phone} icon={Phone}>
                  <input
                    required
                    type="tel"
                    value={requestForm.phone}
                    onChange={(event) => setRequestForm({ ...requestForm, phone: event.target.value })}
                    className="public-input"
                  />
                </Field>
                <Field label={t.request.address} icon={Building2}>
                  <input
                    required
                    value={requestForm.address}
                    onChange={(event) => setRequestForm({ ...requestForm, address: event.target.value })}
                    className="public-input"
                  />
                </Field>
                <Field label={t.request.issueType}>
                  <select
                    value={requestForm.issue_type}
                    onChange={(event) => setRequestForm({ ...requestForm, issue_type: event.target.value as MaintenanceSpecialty })}
                    className="public-input"
                  >
                    {specialtyChoices.map((specialty) => (
                      <option key={specialty.value} value={specialty.value}>
                        {language === "ar" ? specialty.ar : specialty.en}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t.request.priority}>
                  <select
                    value={requestForm.priority}
                    onChange={(event) => setRequestForm({ ...requestForm, priority: event.target.value as Priority })}
                    className="public-input"
                  >
                    {(Object.keys(priorityLabels) as Priority[]).map((priority) => (
                      <option key={priority} value={priority}>
                        {priorityLabels[priority][language]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t.request.location} icon={MapPin}>
                  <input
                    required
                    value={requestForm.location_details}
                    onChange={(event) => setRequestForm({ ...requestForm, location_details: event.target.value })}
                    className="public-input"
                  />
                </Field>
                <Field label={t.request.preferredDate}>
                  <input
                    required
                    type="datetime-local"
                    value={requestForm.preferred_date}
                    onChange={(event) => setRequestForm({ ...requestForm, preferred_date: event.target.value })}
                    className="public-input"
                  />
                </Field>
                <label className="md:col-span-2">
                  <span className="mb-2 block text-sm font-extrabold text-[#5f746e]">{t.request.details}</span>
                  <textarea
                    required
                    rows={5}
                    value={requestForm.description}
                    onChange={(event) => setRequestForm({ ...requestForm, description: event.target.value })}
                    className="public-input min-h-[130px] resize-y"
                  />
                </label>
                <label className="flex items-center gap-3 text-sm font-extrabold text-[#5f746e] md:col-span-2">
                  <input
                    type="checkbox"
                    checked={requestForm.is_hazardous}
                    onChange={(event) => setRequestForm({ ...requestForm, is_hazardous: event.target.checked })}
                    className="h-5 w-5 accent-[#0f8d86]"
                  />
                  {t.request.hazardous}
                </label>
              </div>

              {requestError && <p className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{requestError}</p>}

              <button
                type="submit"
                disabled={requestState === "submitting"}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#0f8d86] px-6 py-4 font-extrabold text-white shadow-xl shadow-[#0f8d86]/20 transition-all hover:-translate-y-1 hover:bg-[#0d7b75] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {requestState === "submitting" && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
                {requestState === "submitting" ? t.request.submitting : t.request.submit}
              </button>
            </form>
          </div>
        </section>
      </main>

      <footer className="bg-[#fbfdf9] py-10">
        <div className="container mx-auto flex flex-col items-start justify-between gap-5 px-4 text-sm text-[#657872] sm:px-6 md:flex-row md:items-center">
          <div className="flex flex-col gap-1">
            <BrandWordmark language={language} />
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#9aaba5]">{t.tagline}</span>
          </div>
          <p className="m-0 max-w-md">{t.footer}</p>
        </div>
      </footer>

      <AnimatePresence>
        {trackOpen && (
          <motion.div
            className="fixed inset-0 z-[80] grid place-items-center bg-[#17312d]/40 px-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
              className="w-full max-w-md rounded-[2rem] bg-[#fbfdf9] p-6 text-[#17312d] shadow-2xl"
            >
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <h2 className="m-0 text-2xl font-extrabold">{t.track.title}</h2>
                  <p className="m-0 mt-2 text-sm leading-6 text-[#657872]">{t.track.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setTrackOpen(false);
                    setTrackedRequest(null);
                    setTrackError(null);
                  }}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#eef8f6] text-[#24433d]"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>

              <form onSubmit={handleTrackSubmit} className="grid gap-4">
                <input
                  required
                  inputMode="numeric"
                  value={ticketNumber}
                  onChange={(event) => setTicketNumber(event.target.value)}
                  placeholder={t.track.ticketPlaceholder}
                  className="public-input"
                />
                <button
                  type="submit"
                  disabled={trackLoading}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#0f8d86] px-6 py-4 font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {trackLoading && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
                  {trackLoading ? t.track.loading : t.track.submit}
                </button>
              </form>

              {trackError && <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{trackError}</p>}
              {trackedRequest && (
                <div className="mt-5 rounded-[1.5rem] bg-[#eef8f6] p-4 text-sm text-[#50635e]">
                  <strong className="block text-2xl text-[#17312d]">#{trackedRequest.id}</strong>
                  <p className="m-0 mt-2">{trackedRequest.client_company_name}</p>
                  <p className="m-0 mt-1">{getSpecialtyName(trackedRequest.issue_type, language)}</p>
                  <p className="m-0 mt-3 font-extrabold text-[#0d827a]">
                    {t.track.status}: {statusLabels[trackedRequest.status][language]}
                  </p>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function BrandWordmark({ language }: { language: Language }) {
  return (
    <span className="flex items-center gap-2.5 text-start">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#15294d] via-[#1b3a6b] to-[#1f86ec] text-white shadow-sm">
        <Cog className="h-6 w-6" aria-hidden="true" />
      </span>
      <span className="leading-none">
        <span className="block text-xl font-extrabold tracking-tight sm:text-2xl">
          <span className="text-[#15294d]">Engi</span>
          <span className="text-[#1f86ec]">Flow</span>
        </span>
        {language === "ar" && (
          <span className="mt-1 block text-[11px] font-bold tracking-wide text-[#7088a0]">إنجي فلو</span>
        )}
      </span>
    </span>
  );
}

function EngineersSection({ copy: t, language }: { copy: Copy; language: Language }) {
  const isRtl = t.dir === "rtl";
  const [engineers, setEngineers] = useState<StoredEngineer[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [specialty, setSpecialty] = useState<MaintenanceSpecialty>("ELECTRICITY");

  useEffect(() => {
    setEngineers(loadStoredEngineers());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) {
      return;
    }
    try {
      window.localStorage.setItem(ENGINEERS_STORAGE_KEY, JSON.stringify(engineers));
    } catch {
      /* ignore storage write failures */
    }
  }, [engineers, loaded]);

  function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    if (!trimmedName || !trimmedPhone) {
      return;
    }
    setEngineers((previous) => [
      { id: createEngineerId(), name: trimmedName, phone: trimmedPhone, specialty },
      ...previous
    ]);
    setName("");
    setPhone("");
  }

  function handleRemove(id: string) {
    setEngineers((previous) => previous.filter((engineer) => engineer.id !== id));
  }

  return (
    <section id="engineers" className="bg-[#fbfdf9] py-20 sm:py-24">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="mx-auto mb-12 max-w-3xl text-center">
          <span className="text-sm font-extrabold text-[#0d827a]">{t.engineers.eyebrow}</span>
          <h2 className="mt-4 text-3xl font-extrabold leading-tight text-[#17312d] md:text-4xl">{t.engineers.title}</h2>
          <p className="mt-4 text-base leading-8 text-[#657872]">{t.engineers.description}</p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <form
            onSubmit={handleAdd}
            className="rounded-[2rem] bg-white/76 p-6 shadow-2xl shadow-[#a5ccd0]/20 backdrop-blur-xl sm:p-7"
          >
            <div className="grid gap-5">
              <Field label={t.engineers.name} icon={HardHat}>
                <input
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="public-input"
                />
              </Field>
              <Field label={t.engineers.phone} icon={Phone}>
                <input
                  required
                  type="tel"
                  dir="ltr"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  className="public-input text-start"
                />
              </Field>
              <Field label={t.engineers.specialty} icon={Wrench}>
                <select
                  value={specialty}
                  onChange={(event) => setSpecialty(event.target.value as MaintenanceSpecialty)}
                  className="public-input"
                >
                  {specialtyChoices.map((choice) => (
                    <option key={choice.value} value={choice.value}>
                      {language === "ar" ? choice.ar : choice.en}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <button
              type="submit"
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#0f8d86] px-6 py-4 font-extrabold text-white shadow-xl shadow-[#0f8d86]/20 transition-all hover:-translate-y-1 hover:bg-[#0d7b75]"
            >
              <UserPlus className="h-5 w-5" aria-hidden="true" />
              {t.engineers.submit}
            </button>
          </form>

          <div>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-lg font-extrabold text-[#17312d]">{t.engineers.listTitle}</h3>
              <span className="rounded-full bg-[#e5f7f6] px-3 py-1 text-sm font-extrabold text-[#0d827a]">
                {engineers.length} {t.engineers.countLabel}
              </span>
            </div>

            {engineers.length === 0 ? (
              <div className="rounded-[2rem] border border-dashed border-[#cfe6e3] bg-[#f4faf8] p-10 text-center text-sm leading-7 text-[#657872]">
                {t.engineers.empty}
              </div>
            ) : (
              <div className="grid gap-3">
                {engineers.map((engineer) => (
                  <div
                    key={engineer.id}
                    className="flex items-center justify-between gap-4 rounded-3xl bg-[#f4faf8] p-4 transition-colors hover:bg-[#eef8f7]"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#e1f4f3] text-[#0d827a] shadow-sm">
                        <HardHat className="h-6 w-6" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <strong className="block truncate text-[#17312d]">{engineer.name}</strong>
                        <span className="block truncate text-sm text-[#657872]">
                          {getSpecialtyName(engineer.specialty, language)}
                        </span>
                        <span dir="ltr" className={`block truncate text-sm font-bold text-[#0d827a] ${isRtl ? "text-right" : "text-left"}`}>
                          {engineer.phone}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemove(engineer.id)}
                      aria-label={t.engineers.remove}
                      title={t.engineers.remove}
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-[#c84d3a] shadow-sm transition-colors hover:bg-[#fdecea]"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Field({
  label,
  icon: Icon,
  children
}: {
  label: string;
  icon?: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <label>
      <span className="mb-2 flex items-center gap-2 text-sm font-extrabold text-[#5f746e]">
        {Icon && <Icon className="h-4 w-4 text-[#0d827a]" aria-hidden="true" />}
        {label}
      </span>
      {children}
    </label>
  );
}

export default PublicLanding;
