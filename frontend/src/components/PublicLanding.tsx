"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
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
  UserPlus,
  Users,
  ShieldAlert,
  Wrench,
  X,
  Zap,
  type LucideIcon
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import {
  BackendUpgradeRequiredError,
  createPublicEngineer,
  getPublicEngineerDeviceSession,
  getPublicEngineers,
  getPublicImpactStatistics,
  linkPublicEngineerDevice,
  setPublicEngineerAvailability,
  submitPublicMaintenanceRequest,
  trackPublicRequest
} from "@/src/lib/api";
import { getOrCreateDeviceIdentity } from "@/src/lib/deviceIdentity";
import { getGoogleMapsSearchUrl } from "@/src/lib/maps";
import {
  clearEngineerManagementSession,
  loadEngineerManagementSession,
  saveEngineerManagementSession
} from "@/src/lib/engineerSession";
import type {
  Language,
  MaintenanceSpecialty,
  MaintenanceStatus,
  Priority,
  PublicEngineer,
  PublicImpactStatistics,
  PublicMaintenanceRequestPayload,
  PublicTrackedRequest
} from "@/src/lib/types";
import { EngineerAvatar } from "./EngineerAvatar";
import { ImageLightbox } from "./ImageLightbox";

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
    noActivity: string;
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
    email: string;
    department: string;
    specialty: string;
    profession: string;
    experience: string;
    photo: string;
    submit: string;
    submitting: string;
    listTitle: string;
    countLabel: string;
    empty: string;
    remove: string;
    error: string;
    countHeadline: string;
    countCaption: string;
    privacyNote: string;
    available: string;
    unavailable: string;
    availabilityTitle: string;
    availabilityDescription: string;
    availabilityError: string;
    markAvailable: string;
    markUnavailable: string;
    currentAvailability: string;
    backendUpgradeError: string;
    recognizedDevice: string;
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
    openMaps: string;
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
        "ادخل إلى حساب شركتك لتسجيل البلاغ، وسيصل مباشرة إلى فريق العمل مع متابعة حالته لحظة بلحظة حتى الإنجاز.",
      primary: "دخول حساب الشركة",
      secondary: "تتبع طلب سابق",
      dashboardTitle: "لوحة المتابعة المباشرة",
      live: "متصل",
      ticketsToday: "طلبات اليوم",
      avgResponse: "متوسط الاستجابة",
      quality: "مراجعة الجودة",
      noActivity: "لا توجد طلبات مسجّلة بعد"
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
      title: "مساحة عمل المهندس",
      description: "سجّل حسابك أو ادخل إلى لوحة المهندس لمتابعة المهام وتحديث حالة التوفر وإرسال الملاحظات الفنية.",
      name: "اسم المهندس",
      phone: "رقم الهاتف",
      email: "البريد الإلكتروني",
      department: "القسم",
      specialty: "التخصص",
      profession: "المهنة",
      experience: "سنوات الخبرة",
      photo: "صورة المهندس",
      submit: "إضافة المهندس",
      submitting: "جارٍ الحفظ...",
      listTitle: "إحصائية الفريق",
      countLabel: "مهندس",
      empty: "لا يوجد مهندسون مسجّلون بعد. ابدأ بإضافة أول مهندس إلى الفريق.",
      remove: "حذف المهندس",
      error: "تعذّر حفظ البيانات. تحقق من الاتصال وحاول مرة أخرى.",
      countHeadline: "عضو في فريق الصيانة",
      countCaption: "مهندسون وفنيون متعدّدو التخصصات جاهزون لاستلام البلاغات.",
      privacyNote: "التفاصيل الكاملة لا تُعرض على الصفحة العامة، وتبقى متاحة فقط للمسؤولين عبر لوحة المتابعة.",
      available: "متوفر للعمل",
      unavailable: "غير متوفر حالياً",
      availabilityTitle: "حالة توفرك",
      availabilityDescription: "حدّث حالتك حتى يعرف فريق التشغيل إمكانية تعيينك للطلبات الجديدة.",
      availabilityError: "تعذّر تحديث حالة التوفر. حاول مرة أخرى.",
      markAvailable: "تغيير الحالة إلى متوفر",
      markUnavailable: "تغيير الحالة إلى غير متوفر",
      currentAvailability: "الحالة الحالية",
      backendUpgradeError: "الخادم لم يُحدّث بعد لدعم الصورة وحالة التوفر. حدّث PythonAnywhere ثم أعد التسجيل.",
      recognizedDevice: "تم التعرف على هذا الجهاز وربطه بحسابك"
    },
    request: {
      eyebrow: "تقديم طلب جديد",
      title: "بوابة طلبات الشركة",
      description:
        "أدخل بيانات شركتك وتفاصيل العطل، وسيتم تسجيل الطلب تلقائيًا في المنظومة وتعيين رقم تذكرة لمتابعته.",
      companyName: "اسم الشركة",
      contactName: "اسم المسؤول",
      commercialRegister: "السجل التجاري",
      email: "البريد الإلكتروني",
      phone: "رقم الهاتف",
      address: "عنوان الشركة",
      openMaps: "فتح خرائط Google لتحديد العنوان",
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
        "Open your company account to submit a maintenance request and follow every update through completion.",
      primary: "Company portal",
      secondary: "Track a request",
      dashboardTitle: "Live operations view",
      live: "Live",
      ticketsToday: "Today's tickets",
      avgResponse: "Avg response",
      quality: "Quality review",
      noActivity: "No requests recorded yet"
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
      title: "Engineer workspace",
      description: "Create an engineer account or sign in to manage assignments, availability, and field notes.",
      name: "Engineer name",
      phone: "Phone number",
      email: "Email",
      department: "Department",
      specialty: "Specialty",
      profession: "Profession",
      experience: "Years of experience",
      photo: "Engineer photo",
      submit: "Add engineer",
      submitting: "Saving...",
      listTitle: "Team headcount",
      countLabel: "engineers",
      empty: "No engineers registered yet. Add the first engineer to the team.",
      remove: "Remove engineer",
      error: "Could not save. Check your connection and try again.",
      countHeadline: "members on the maintenance team",
      countCaption: "Multi-disciplinary engineers and technicians ready to take on reports.",
      privacyNote: "Full profile details are not shown publicly. They remain available to administrators in the operations dashboard.",
      available: "Available for work",
      unavailable: "Currently unavailable",
      availabilityTitle: "Your availability",
      availabilityDescription: "Keep your status current so operations can assign you to new requests.",
      availabilityError: "Could not update availability. Please try again.",
      markAvailable: "Set status to available",
      markUnavailable: "Set status to unavailable",
      currentAvailability: "Current status",
      backendUpgradeError: "The server has not been updated for photos and availability yet. Update PythonAnywhere, then register again.",
      recognizedDevice: "This device is recognized and linked to your account"
    },
    request: {
      eyebrow: "New request",
      title: "Company request portal",
      description:
        "Enter your company details and describe the issue. A ticket number will be assigned automatically for tracking.",
      companyName: "Company name",
      contactName: "Contact person",
      commercialRegister: "Commercial register",
      email: "Email",
      phone: "Phone",
      address: "Company address",
      openMaps: "Open Google Maps to select the address",
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
    const refreshImpact = () => {
      getPublicImpactStatistics()
        .then(setImpactStats)
        .catch(() => setImpactStats(null));
    };
    refreshImpact();
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") refreshImpact();
    }, 54_000);
    return () => window.clearInterval(intervalId);
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
    { href: "#stats", label: t.nav.stats }
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
      className="min-h-screen overflow-x-hidden bg-[#f7fbf8] text-[#15294d] selection:bg-[#bfd2ee] selection:text-[#15294d]"
    >
      <nav className="sticky top-0 z-50 border-b border-white/70 bg-[#fbfdff]/80 backdrop-blur-2xl">
        <div dir="ltr" className="container mx-auto flex min-h-[72px] items-center justify-between gap-4 px-4 sm:px-6">
          <a href="/" className="flex min-w-0 items-center no-underline">
            <BrandWordmark />
          </a>

          <div className="hidden items-center gap-8 text-sm font-bold text-[#5b6b85] md:flex">
            {navLinks.map((link) => (
              <a key={link.href} href={link.href} className="no-underline transition-colors hover:text-[#1567c6]">
                {link.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setLanguage(language === "ar" ? "en" : "ar")}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-white/80 px-4 text-sm font-bold text-[#5b6b85] shadow-sm transition-all hover:-translate-y-0.5 hover:bg-[#e3edfb]"
            >
              <Globe2 className="h-4 w-4" aria-hidden="true" />
              {t.nav.language}
            </button>
            <a
              href="/company"
              className="hidden h-11 items-center gap-2 rounded-lg bg-[#1769aa] px-5 text-sm font-extrabold text-white no-underline transition-colors hover:bg-[#12598f] sm:inline-flex"
            >
              {t.hero.primary}
            </a>
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="grid h-11 w-11 place-items-center rounded-full bg-white/80 text-[#1c3263] shadow-sm md:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </nav>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div className="fixed inset-0 z-[70] bg-[#15294d]/35 backdrop-blur-sm md:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.aside
              initial={{ x: isRtl ? 320 : -320 }}
              animate={{ x: 0 }}
              exit={{ x: isRtl ? 320 : -320 }}
              transition={{ type: "spring", stiffness: 260, damping: 28 }}
              className={`absolute top-0 h-full w-[min(86vw,320px)] bg-[#fbfdff] p-5 shadow-2xl ${isRtl ? "right-0" : "left-0"}`}
            >
              <div className="mb-8 flex items-center justify-between">
                <BrandWordmark />
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="grid h-10 w-10 place-items-center rounded-full bg-[#e3edfb] text-[#1c3263]"
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
                    className="rounded-2xl bg-[#eef8f6] px-4 py-4 text-base font-extrabold text-[#1c3263] no-underline"
                  >
                    {link.label}
                  </a>
                ))}
                <a
                  href="/company"
                  onClick={() => setMobileOpen(false)}
                  className="mt-2 rounded-lg bg-[#1769aa] px-4 py-4 text-center font-extrabold text-white no-underline"
                >
                  {t.hero.primary}
                </a>
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      <main>
        <section className="relative overflow-hidden border-b border-[#dce4ec] bg-[#f5f8fb] py-16 sm:py-20">
          <div className="container relative mx-auto grid items-center gap-14 px-4 sm:px-6 md:grid-cols-2">
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }} className={isRtl ? "text-right" : "text-left"}>
              <span className="mb-5 inline-flex rounded-full bg-white/75 px-4 py-2 text-sm font-extrabold text-[#1567c6] shadow-sm">
                {t.hero.eyebrow}
              </span>
              <h1 className="max-w-2xl text-4xl font-extrabold leading-tight tracking-normal text-[#15294d] md:text-5xl">
                {t.hero.titleA}{" "}
                {t.hero.titleAccent && (
                  <>
                    <span className="bg-gradient-to-r from-[#1f86ec] to-[#4aa9c1] bg-clip-text text-transparent">
                      {t.hero.titleAccent}
                    </span>{" "}
                  </>
                )}
                {t.hero.titleB}
              </h1>
              <p className="mt-6 max-w-xl text-base leading-8 text-[#5b6b85] md:text-lg">{t.hero.description}</p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <a
                  href="/company"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#1769aa] px-6 text-sm font-extrabold text-white no-underline transition-colors hover:bg-[#12598f]"
                >
                  {t.hero.primary}
                  <DirectionArrow className="h-4 w-4" aria-hidden="true" />
                </a>
                <button
                  type="button"
                  onClick={() => setTrackOpen(true)}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-[#cbd7e4] bg-white px-6 text-sm font-extrabold text-[#1c3263] transition-colors hover:bg-[#eaf1f8]"
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
              <div className="relative rounded-lg border border-[#d7e0e9] bg-white p-5 shadow-[0_16px_40px_rgba(23,63,115,0.10)]">
                <div className="mb-6 flex items-center justify-between gap-4">
                  <div>
                    <p className="m-0 text-sm font-extrabold text-[#5b6b85]">{t.hero.dashboardTitle}</p>
                    <h2 className="m-0 mt-1 text-2xl font-extrabold text-[#15294d]">Ops Console</h2>
                  </div>
                  <span className="inline-flex items-center gap-2 rounded-full bg-[#e3edfb] px-3 py-2 text-xs font-extrabold text-[#1567c6]">
                    <span className="h-2 w-2 rounded-full bg-[#1f86ec]" />
                    {t.hero.live}
                  </span>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  {[
                    { label: t.stats.total, value: impactStats ? numberFormat.format(impactStats.total_requests) : "—" },
                    { label: t.stats.open, value: impactStats ? numberFormat.format(impactStats.total_open_requests) : "—" },
                    { label: t.stats.rate, value: impactStats ? `${numberFormat.format(impactStats.completion_rate)}%` : "—" }
                  ].map((item) => (
                    <div key={item.label} className="rounded-lg border border-[#e0e7ee] bg-[#f6f8fa] px-4 py-5">
                      <p className="m-0 truncate text-xs font-bold text-[#7088a0]">{item.label}</p>
                      <strong className="mt-3 block text-3xl font-extrabold text-[#1567c6]">{item.value}</strong>
                    </div>
                  ))}
                </div>

                <div className="mt-6 grid gap-4">
                  {(() => {
                    const issues = impactStats?.top_recurring_maintenance_issues ?? [];
                    if (issues.length === 0) {
                      return (
                        <p className="m-0 rounded-lg bg-[#fbfdff] p-6 text-center text-sm font-bold text-[#7088a0]">
                          {t.hero.noActivity}
                        </p>
                      );
                    }
                    const maxTotal = Math.max(...issues.map((issue) => issue.total), 1);
                    return issues.slice(0, 3).map((issue) => (
                      <div key={issue.issue_type} className="rounded-lg border border-[#e5eaf0] bg-[#fbfdff] p-4">
                        <div className="mb-3 flex items-center justify-between text-sm font-extrabold text-[#1c3263]">
                          <span>{getSpecialtyName(issue.issue_type, language)}</span>
                          <span className="text-[#7088a0]">{numberFormat.format(issue.total)}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-[#e3eeee]">
                          <span
                            className="block h-full rounded-full bg-[#1f86ec]"
                            style={{ width: `${Math.round((issue.total / maxTotal) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <section id="services" className="bg-[#fbfdff] py-20 sm:py-24">
          <div className="container mx-auto px-4 sm:px-6">
            <div className="mx-auto mb-14 max-w-3xl text-center">
              <span className="text-sm font-extrabold text-[#1567c6]">{t.services.eyebrow}</span>
              <h2 className="mt-4 text-3xl font-extrabold leading-tight text-[#15294d] md:text-4xl">{t.services.title}</h2>
              <p className="mt-4 text-base leading-8 text-[#5b6b85]">{t.services.description}</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {specialties.map((service) => {
                const Icon = service.icon;
                return (
                  <motion.article
                    key={service.specialty}
                    whileHover={{ y: -3 }}
                    className="relative overflow-hidden rounded-lg border border-[#dbe3eb] bg-white p-6 shadow-[0_8px_24px_rgba(23,63,115,0.06)] transition-all hover:border-[#8bb3d6] hover:shadow-[0_12px_30px_rgba(23,63,115,0.11)]"
                  >
                    <span className="absolute inset-x-0 top-0 h-1 bg-[#1769aa]" />
                    <span className="mb-6 grid h-12 w-12 place-items-center rounded-lg border border-[#cfe0ef] bg-[#edf4fa] text-[#1769aa]">
                      <Icon className="h-6 w-6" strokeWidth={1.8} aria-hidden="true" />
                    </span>
                    <h3 className="text-xl font-extrabold text-[#15294d]">{getServiceTitle(service, language)}</h3>
                    <p className="mt-3 text-sm leading-7 text-[#5b6b85]">{getServiceDescription(service, language)}</p>
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
                <span className="text-sm font-extrabold text-[#1567c6]">{t.workflow.eyebrow}</span>
                <h2 className="mt-4 text-3xl font-extrabold leading-tight text-[#15294d] md:text-4xl">{t.workflow.title}</h2>
              </div>
              <p className="text-base leading-8 text-[#5b6b85]">{t.workflow.description}</p>
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
                    <span className="mb-6 grid h-14 w-14 place-items-center rounded-full bg-[#e3edfb] text-[#1567c6] shadow-sm">
                      <Icon className="h-7 w-7" aria-hidden="true" />
                    </span>
                    <span className="text-sm font-extrabold text-[#7088a0]">{String(index + 1).padStart(2, "0")}</span>
                    <h3 className="mt-3 text-xl font-extrabold text-[#15294d]">{getWorkflowTitle(item, language)}</h3>
                    <p className="mt-3 text-sm leading-7 text-[#5b6b85]">{getWorkflowDescription(item, language)}</p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        <PortalAccessSection copy={t} language={language} />

        <section id="stats" className="bg-[#eef7f6] py-20">
          <div className="container mx-auto px-4 sm:px-6">
            <div className="mb-12 max-w-2xl">
              <span className="text-sm font-extrabold text-[#1567c6]">{t.stats.eyebrow}</span>
              <h2 className="mt-4 text-3xl font-extrabold text-[#15294d] md:text-4xl">{t.stats.title}</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {statItems.map((item) => (
                <div key={item.label} className="rounded-lg border border-[#d9e2e9] bg-white p-6">
                  <p className="m-0 text-sm font-bold text-[#5b6b85]">{item.label}</p>
                  <strong className="mt-4 block text-3xl font-extrabold text-[#1567c6]">{item.value}</strong>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="request" className="hidden">
          <div className="container mx-auto grid gap-12 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
            <div className={isRtl ? "text-right" : "text-left"}>
              <span className="text-sm font-extrabold text-[#1567c6]">{t.request.eyebrow}</span>
              <h2 className="mt-4 text-3xl font-extrabold leading-tight text-[#15294d] md:text-4xl">{t.request.title}</h2>
              <p className="mt-5 text-base leading-8 text-[#5b6b85]">{t.request.description}</p>

              {createdTicket && (
                <div className="mt-8 rounded-[2rem] bg-[#e3edfb] p-5 text-[#15294d]">
                  <p className="m-0 text-sm font-bold text-[#1567c6]">{t.request.success}</p>
                  <strong className="mt-3 block text-3xl font-extrabold">
                    {t.request.ticket}: #{createdTicket.id}
                  </strong>
                </div>
              )}
            </div>

            <form
              onSubmit={handleRequestSubmit}
              className="rounded-lg border border-[#d7e4f5] bg-white p-5 shadow-xl shadow-[#a8c2e6]/15 sm:p-7"
            >
              <div className="mb-6 flex items-center gap-3 border-b border-[#d7e4f5] pb-5">
                <span className="grid h-11 w-11 place-items-center rounded-lg bg-[#dde9f9] text-[#1567c6]">
                  <ClipboardList className="h-5 w-5" aria-hidden="true" />
                </span>
                <strong className="text-lg text-[#15294d]">{t.request.title}</strong>
              </div>
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
                  <div className="grid gap-2">
                    <input
                      required
                      value={requestForm.address}
                      onChange={(event) => setRequestForm({ ...requestForm, address: event.target.value })}
                      className="public-input"
                    />
                    <a
                      href={getGoogleMapsSearchUrl(requestForm.address)}
                      target="_blank"
                      rel="noreferrer"
                      className="public-action border border-[#bfd2ee] bg-[#f4f8fd] text-[#1567c6] no-underline transition-colors hover:bg-[#e3edfb]"
                    >
                      <MapPin className="h-4 w-4" aria-hidden="true" />
                      {t.request.openMaps}
                    </a>
                  </div>
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
                  <span className="mb-2 block text-sm font-extrabold text-[#5b6b85]">{t.request.details}</span>
                  <textarea
                    required
                    rows={5}
                    value={requestForm.description}
                    onChange={(event) => setRequestForm({ ...requestForm, description: event.target.value })}
                    className="public-input min-h-[130px] resize-y"
                  />
                </label>
                <label className="flex items-center gap-3 text-sm font-extrabold text-[#5b6b85] md:col-span-2">
                  <input
                    type="checkbox"
                    checked={requestForm.is_hazardous}
                    onChange={(event) => setRequestForm({ ...requestForm, is_hazardous: event.target.checked })}
                    className="h-5 w-5 accent-[#1f86ec]"
                  />
                  {t.request.hazardous}
                </label>
              </div>

              {requestError && <p className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{requestError}</p>}

              <button
                type="submit"
                disabled={requestState === "submitting"}
                className="public-action mt-6 w-full bg-[#1f86ec] text-white shadow-xl shadow-[#1f86ec]/20 transition-all hover:-translate-y-0.5 hover:bg-[#1567c6] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {requestState === "submitting" && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
                {requestState === "submitting" ? t.request.submitting : t.request.submit}
              </button>
            </form>
          </div>
        </section>
      </main>

      <footer className="bg-[#fbfdff] py-8">
        <div className="container mx-auto flex flex-col items-center justify-between gap-3 px-4 text-center text-sm text-[#5b6b85] sm:px-6 md:flex-row md:text-start">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#7088a0]">{t.tagline}</span>
          <p className="m-0 max-w-md">{t.footer}</p>
        </div>
      </footer>

      <AnimatePresence>
        {trackOpen && (
          <motion.div
            className="fixed inset-0 z-[80] grid place-items-center bg-[#15294d]/40 px-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
              className="w-full max-w-md rounded-[2rem] bg-[#fbfdff] p-6 text-[#15294d] shadow-2xl"
            >
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <h2 className="m-0 text-2xl font-extrabold">{t.track.title}</h2>
                  <p className="m-0 mt-2 text-sm leading-6 text-[#5b6b85]">{t.track.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setTrackOpen(false);
                    setTrackedRequest(null);
                    setTrackError(null);
                  }}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#eef8f6] text-[#1c3263]"
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
                  onChange={(event) => setTicketNumber(event.target.value.replace(/\D/g, ""))}
                  placeholder={t.track.ticketPlaceholder}
                  className="public-input"
                />
                <button
                  type="submit"
                  disabled={trackLoading}
                  className="public-action bg-[#1f86ec] text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {trackLoading && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
                  {trackLoading ? t.track.loading : t.track.submit}
                </button>
              </form>

              {trackError && <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{trackError}</p>}
              {trackedRequest && (
                <div className="mt-5 rounded-[1.5rem] bg-[#eef8f6] p-4 text-sm text-[#5b6b85]">
                  <strong className="block text-2xl text-[#15294d]">#{trackedRequest.id}</strong>
                  <p className="m-0 mt-2">{trackedRequest.client_company_name}</p>
                  <p className="m-0 mt-1">{getSpecialtyName(trackedRequest.issue_type, language)}</p>
                  <p className="m-0 mt-3 font-extrabold text-[#1567c6]">
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

function BrandWordmark() {
  // Image lives in /frontend/public/engiflow-logo.png and is served from the
  // site root. The logo already contains the full "EngiFlow" wordmark, so we
  // do not render any text alongside it.
  return (
    <span dir="ltr" className="flex items-center">
      <img
        src="/engiflow-logo.png"
        alt="EngiFlow"
        width={56}
        height={56}
        className="h-14 w-14 object-contain sm:h-16 sm:w-16"
      />
    </span>
  );
}

function PortalAccessSection({ copy: t, language }: { copy: Copy; language: Language }) {
  const [engineerCount, setEngineerCount] = useState<number | null>(null);

  useEffect(() => {
    getPublicEngineers()
      .then((engineers) => setEngineerCount(engineers.length))
      .catch(() => setEngineerCount(null));
  }, []);

  const ar = language === "ar";
  const entries = [
    {
      href: "/company",
      icon: Building2,
      title: ar ? "حساب الشركة" : "Company account",
      description: ar
        ? "إنشاء حساب، تقديم الطلبات، ومتابعة الأعمال الحالية والسابقة والمهندس المعيّن."
        : "Create an account, submit requests, and follow current and previous maintenance work.",
      action: ar ? "دخول أو إنشاء حساب شركة" : "Open company portal",
      tone: "bg-[#1769aa] text-white hover:bg-[#12598f]"
    },
    {
      href: "/engineer",
      icon: HardHat,
      title: t.engineers.title,
      description: t.engineers.description,
      action: ar ? "دخول أو تسجيل مهندس" : "Open engineer portal",
      tone: "bg-[#27364a] text-white hover:bg-[#1d2938]"
    }
  ];

  return (
    <section id="engineers" className="border-y border-[#dce4ec] bg-[#f7f9fb] py-16 sm:py-20">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <span className="text-sm font-extrabold text-[#1769aa]">
              {ar ? "بوابات المستخدمين" : "User portals"}
            </span>
            <h2 className="mt-3 text-3xl font-extrabold leading-tight text-[#15294d]">
              {ar ? "مساحة مستقلة لكل طرف في عملية الصيانة" : "A dedicated workspace for every maintenance role"}
            </h2>
          </div>
          {engineerCount !== null && (
            <div className="flex items-center gap-3 rounded-lg border border-[#d7e0e9] bg-white px-4 py-3">
              <Users className="h-5 w-5 text-[#1769aa]" aria-hidden="true" />
              <span className="text-sm font-bold text-[#536174]">
                {new Intl.NumberFormat(ar ? "ar-LY" : "en-US").format(engineerCount)}{" "}
                {ar ? "مهندس مسجّل" : "registered engineers"}
              </span>
            </div>
          )}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {entries.map((entry) => {
            const Icon = entry.icon;
            return (
              <article key={entry.href} className="rounded-lg border border-[#d9e1e9] bg-white p-6">
                <span className="grid h-12 w-12 place-items-center rounded-lg border border-[#cfe0ef] bg-[#edf4fa] text-[#1769aa]">
                  <Icon className="h-6 w-6" strokeWidth={1.8} aria-hidden="true" />
                </span>
                <h3 className="mt-5 text-xl font-extrabold text-[#17233a]">{entry.title}</h3>
                <p className="mt-2 min-h-14 text-sm leading-7 text-[#66758a]">{entry.description}</p>
                <a
                  href={entry.href}
                  className={`mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-bold no-underline transition-colors ${entry.tone}`}
                >
                  {entry.action}
                  {ar ? <ArrowLeft className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
                </a>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function EngineersSection({ copy: t, language }: { copy: Copy; language: Language }) {
  const [engineers, setEngineers] = useState<PublicEngineer[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [department, setDepartment] = useState("");
  const [specialty, setSpecialty] = useState<MaintenanceSpecialty>("ELECTRICITY");
  const [profession, setProfession] = useState("");
  const [experienceYears, setExperienceYears] = useState("0");
  const [avatar, setAvatar] = useState<File | null>(null);
  const [avatarInputKey, setAvatarInputKey] = useState(0);
  const [managedEngineer, setManagedEngineer] = useState<PublicEngineer | null>(null);
  const [availabilityToken, setAvailabilityToken] = useState<string | null>(null);
  const [availabilityBusy, setAvailabilityBusy] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justAdded, setJustAdded] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ src: string; alt: string } | null>(null);
  const numberFormat = useMemo(
    () => new Intl.NumberFormat(language === "ar" ? "ar-LY" : "en-US"),
    [language]
  );

  useEffect(() => {
    let active = true;
    getPublicEngineers()
      .then((data) => {
        if (active) {
          setEngineers(data);
          const session = loadEngineerManagementSession();
          if (session) {
            const engineer = data.find((item) => item.id === session.id);
            if (engineer) {
              setManagedEngineer(engineer);
              setAvailabilityToken(session.token);
              if (!engineer.device_label) {
                const device = getOrCreateDeviceIdentity();
                linkPublicEngineerDevice(engineer.id, device.id, device.label)
                  .then((linked) => {
                    if (!active) return;
                    setManagedEngineer(linked);
                    setEngineers((current) =>
                      current.map((item) => (item.id === linked.id ? linked : item))
                    );
                  })
                  .catch(() => {
                    /* The existing local management session remains usable. */
                  });
              }
            } else {
              clearEngineerManagementSession();
            }
          } else {
            const device = getOrCreateDeviceIdentity();
            getPublicEngineerDeviceSession(device.id)
              .then((restored) => {
                if (!active) return;
                setManagedEngineer(restored);
                setAvailabilityToken(restored.availability_token);
                saveEngineerManagementSession({
                  id: restored.id,
                  token: restored.availability_token
                });
                setEngineers((current) =>
                  current.map((item) => (item.id === restored.id ? restored : item))
                );
              })
              .catch(() => {
                /* This device has not registered an engineer yet. */
              });
          }
        }
      })
      .catch(() => {
        /* ignore load errors (e.g. backend not yet reachable) */
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    if (!trimmedName || !trimmedPhone || !email.trim() || !department.trim() || !profession.trim()) {
      return;
    }
    setSubmitting(true);
    setError(null);
    setJustAdded(false);
    try {
      const device = getOrCreateDeviceIdentity();
      const created = await createPublicEngineer({
        name: trimmedName,
        phone: trimmedPhone,
        email: email.trim(),
        department: department.trim(),
        specialty,
        profession: profession.trim(),
        experience_years: Number(experienceYears),
        avatar,
        device_id: device.id,
        device_label: device.label
      });
      setEngineers((current) => [created, ...current]);
      setManagedEngineer(created);
      setAvailabilityToken(created.availability_token);
      saveEngineerManagementSession({ id: created.id, token: created.availability_token });
      setName("");
      setPhone("");
      setEmail("");
      setDepartment("");
      setProfession("");
      setExperienceYears("0");
      setAvatar(null);
      setAvatarInputKey((key) => key + 1);
      setJustAdded(true);
    } catch (caught) {
      setError(
        caught instanceof BackendUpgradeRequiredError
          ? t.engineers.backendUpgradeError
          : t.engineers.error
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleAvailability() {
    if (!managedEngineer || !availabilityToken) return;
    setAvailabilityBusy(true);
    setAvailabilityError(null);
    try {
      const updated = await setPublicEngineerAvailability(
        managedEngineer.id,
        availabilityToken,
        !managedEngineer.is_available
      );
      setManagedEngineer(updated);
      setEngineers((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } catch {
      setAvailabilityError(t.engineers.availabilityError);
    } finally {
      setAvailabilityBusy(false);
    }
  }

  return (
    <>
      <section id="engineers" className="bg-[#fbfdff] py-20 sm:py-24">
        <div className="container mx-auto px-4 sm:px-6">
        <div className="mx-auto mb-12 max-w-3xl text-center">
          <span className="text-sm font-extrabold text-[#1567c6]">{t.engineers.eyebrow}</span>
          <h2 className="mt-4 text-3xl font-extrabold leading-tight text-[#15294d] md:text-4xl">{t.engineers.title}</h2>
          <p className="mt-4 text-base leading-8 text-[#5b6b85]">{t.engineers.description}</p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
          <form
            onSubmit={handleAdd}
            className="rounded-lg border border-[#d7e4f5] bg-white p-6 shadow-xl shadow-[#a8c2e6]/15 sm:p-7"
          >
            <div className="mb-6 flex items-center gap-3 border-b border-[#d7e4f5] pb-5">
              <span className="grid h-11 w-11 place-items-center rounded-lg bg-[#dde9f9] text-[#1567c6]">
                <UserPlus className="h-5 w-5" aria-hidden="true" />
              </span>
              <strong className="text-lg text-[#15294d]">{t.engineers.title}</strong>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
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
              <Field label={t.engineers.email} icon={Mail}>
                <input
                  required
                  type="email"
                  dir="ltr"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="public-input text-start"
                />
              </Field>
              <Field label={t.engineers.department} icon={Building2}>
                <input
                  required
                  value={department}
                  onChange={(event) => setDepartment(event.target.value)}
                  className="public-input"
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
              <Field label={t.engineers.profession} icon={Wrench}>
                <input
                  required
                  value={profession}
                  onChange={(event) => setProfession(event.target.value)}
                  className="public-input"
                />
              </Field>
              <Field label={t.engineers.experience} icon={CalendarClock}>
                <input
                  required
                  type="number"
                  min="0"
                  max="60"
                  value={experienceYears}
                  onChange={(event) => setExperienceYears(event.target.value)}
                  className="public-input"
                />
              </Field>
              <Field label={t.engineers.photo} icon={HardHat}>
                <input
                  key={avatarInputKey}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                  onChange={(event) => setAvatar(event.target.files?.[0] ?? null)}
                  className="public-input file:me-3 file:border-0 file:bg-transparent file:font-bold file:text-[#1567c6]"
                />
              </Field>
            </div>

            {error && (
              <p className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="public-action mt-6 w-full bg-[#1f86ec] text-white shadow-xl shadow-[#1f86ec]/20 transition-all hover:-translate-y-0.5 hover:bg-[#1567c6] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              ) : (
                <UserPlus className="h-5 w-5" aria-hidden="true" />
              )}
              {submitting ? t.engineers.submitting : t.engineers.submit}
            </button>
          </form>

          <div className="grid gap-5">
            {managedEngineer && (
              <div className="rounded-[2rem] bg-white/76 p-6 shadow-2xl shadow-[#a8c2e6]/20 backdrop-blur-xl">
                <div className="flex items-center gap-4">
                  <EngineerAvatar
                    src={managedEngineer.avatar}
                    alt={managedEngineer.name}
                    onPreview={(src) => setPreviewImage({ src, alt: managedEngineer.name })}
                  />
                  <div className="min-w-0">
                    <h3 className="m-0 truncate text-lg font-extrabold text-[#15294d]">
                      {managedEngineer.name}
                    </h3>
                    <p className="m-0 mt-1 truncate text-sm text-[#5b6b85]">
                      {managedEngineer.profession} · {managedEngineer.department}
                    </p>
                    {managedEngineer.device_label && (
                      <p className="m-0 mt-2 text-xs font-bold text-[#2c8b4b]">
                        {t.engineers.recognizedDevice}
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-5">
                  <h3 className="m-0 text-base font-extrabold text-[#15294d]">
                    {t.engineers.availabilityTitle}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-[#5b6b85]">
                    {t.engineers.availabilityDescription}
                  </p>
                  <div
                    className={`mt-4 flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm font-extrabold ${
                      managedEngineer.is_available
                        ? "bg-[#e3f3e7] text-[#236e3c]"
                        : "bg-[#eef3f1] text-[#46556b]"
                    }`}
                  >
                    <span>{t.engineers.currentAvailability}</span>
                    <span>
                      {managedEngineer.is_available
                        ? t.engineers.available
                        : t.engineers.unavailable}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={toggleAvailability}
                    disabled={availabilityBusy}
                    className={`public-action mt-4 w-full text-white ${
                      managedEngineer.is_available
                        ? "bg-[#5b6b85] hover:bg-[#46556b]"
                        : "bg-[#2c8b4b] hover:bg-[#236e3c]"
                    }`}
                  >
                    {availabilityBusy ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : managedEngineer.is_available ? (
                      <X className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    )}
                    {managedEngineer.is_available
                      ? t.engineers.markUnavailable
                      : t.engineers.markAvailable}
                  </button>
                  {availabilityError && (
                    <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                      {availabilityError}
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="rounded-[2rem] bg-white/72 p-8 shadow-2xl shadow-[#a8c2e6]/20 backdrop-blur-xl sm:p-10">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm font-extrabold uppercase tracking-wider text-[#1567c6]">
                  {t.engineers.listTitle}
                </span>
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#dde9f9] text-[#1567c6] shadow-sm">
                  <Users className="h-6 w-6" aria-hidden="true" />
                </span>
              </div>
              <div className="mt-6 flex items-baseline gap-3">
                <strong className="text-6xl font-extrabold text-[#1567c6] md:text-7xl">
                  {numberFormat.format(engineers.length)}
                </strong>
                <span className="text-base font-bold text-[#5b6b85] md:text-lg">{t.engineers.countHeadline}</span>
              </div>
              <p className="mt-4 text-sm leading-7 text-[#5b6b85]">{t.engineers.countCaption}</p>
              {justAdded && (
                <p className="mt-4 rounded-2xl bg-[#e3edfb] px-4 py-3 text-sm font-bold text-[#1567c6]">
                  {t.engineers.submit} ✓
                </p>
              )}
            </div>

            <div className="flex items-start gap-3 rounded-3xl border border-dashed border-[#bfd2ee] bg-[#f4f8fd] p-5 text-sm leading-7 text-[#5b6b85]">
              <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#e3edfb] text-[#1567c6]">
                <ShieldAlert className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="m-0">{t.engineers.privacyNote}</p>
            </div>
          </div>
        </div>
        </div>
      </section>
      {previewImage && (
        <ImageLightbox
          src={previewImage.src}
          alt={previewImage.alt}
          onClose={() => setPreviewImage(null)}
        />
      )}
    </>
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
      <span className="mb-2 flex items-center gap-2 text-sm font-extrabold text-[#5b6b85]">
        {Icon && <Icon className="h-4 w-4 text-[#1567c6]" aria-hidden="true" />}
        {label}
      </span>
      {children}
    </label>
  );
}

export default PublicLanding;
