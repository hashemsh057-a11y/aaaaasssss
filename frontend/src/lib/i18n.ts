import type { Language, MaintenanceSpecialty, MaintenanceStatus, Priority } from "./types";

export const languages: Record<Language, { label: string; dir: "ltr" | "rtl"; fontClass: string }> = {
  en: { label: "English", dir: "ltr", fontClass: "font-inter" },
  ar: { label: "العربية", dir: "rtl", fontClass: "font-cairo" }
};

export const specialtyOptions: Array<{ value: MaintenanceSpecialty; label: Record<Language, string> }> = [
  { value: "ELECTRICITY", label: { en: "Electricity", ar: "الكهرباء" } },
  { value: "NETWORKS", label: { en: "Networks", ar: "الشبكات" } },
  { value: "HVAC", label: { en: "HVAC", ar: "التكييف والتهوية" } },
  { value: "PLUMBING", label: { en: "Plumbing", ar: "السباكة" } },
  { value: "MEDICAL_DEVICES", label: { en: "Medical devices", ar: "الأجهزة الطبية" } },
  { value: "SURVEILLANCE", label: { en: "Surveillance", ar: "المراقبة" } },
  { value: "SOFTWARE", label: { en: "Software", ar: "البرمجيات" } },
  { value: "SERVERS", label: { en: "Servers", ar: "الخوادم" } },
  { value: "CYBERSECURITY", label: { en: "Cybersecurity", ar: "الأمن السيبراني" } }
];

export const priorityOptions: Array<{ value: Priority; label: Record<Language, string> }> = [
  { value: "LOW", label: { en: "Low", ar: "منخفضة" } },
  { value: "MEDIUM", label: { en: "Medium", ar: "متوسطة" } },
  { value: "HIGH", label: { en: "High", ar: "عالية" } },
  { value: "CRITICAL", label: { en: "Critical", ar: "حرجة" } }
];

export const statusLabels: Record<MaintenanceStatus, Record<Language, string>> = {
  NEW: { en: "New", ar: "جديد" },
  UNDER_REVIEW: { en: "Under review", ar: "قيد المراجعة" },
  ASSIGNED: { en: "Assigned", ar: "معيّن" },
  IN_PROGRESS: { en: "In progress", ar: "قيد التنفيذ" },
  WAITING_SPARE_PARTS: { en: "Waiting spare parts", ar: "بانتظار قطع الغيار" },
  COMPLETED: { en: "Completed", ar: "مكتمل" },
  REJECTED: { en: "Rejected", ar: "مرفوض" },
  CLOSED: { en: "Closed", ar: "مغلق" }
};

export const copy = {
  en: {
    appName: "Smart Maintenance",
    console: "Operations console",
    username: "Username",
    password: "Password",
    signIn: "Sign in",
    signOut: "Sign out",
    language: "Language",
    dashboard: "Dashboard",
    requests: "Requests",
    refresh: "Refresh",
    openRequests: "Open requests",
    completionRate: "Completion rate",
    avgResolution: "Avg. resolution",
    critical: "Critical",
    fastestEngineer: "Fastest engineer",
    recurringIssues: "Recurring issues",
    noFastestEngineer: "No response data",
    createRequest: "Create request",
    issueType: "Issue type",
    priority: "Priority",
    location: "Location",
    description: "Description",
    preferredDate: "Preferred date",
    hazardous: "Hazardous",
    submit: "Submit",
    status: "Status",
    company: "Company",
    engineer: "Engineer",
    created: "Created",
    updated: "Updated",
    assign: "Assign",
    move: "Move",
    underReview: "Under review",
    startWork: "Start work",
    waitParts: "Wait parts",
    complete: "Complete",
    close: "Close",
    reject: "Reject",
    assignedEngineer: "Assigned engineer",
    selectEngineer: "Select engineer",
    emptyRequests: "No requests are available for your role.",
    apiError: "The API returned an error.",
    loading: "Loading live data",
    connectedAs: "Connected as",
    seconds: "sec",
    minutes: "min"
  },
  ar: {
    appName: "الصيانة الذكية",
    console: "لوحة العمليات",
    username: "اسم المستخدم",
    password: "كلمة المرور",
    signIn: "دخول",
    signOut: "خروج",
    language: "اللغة",
    dashboard: "المؤشرات",
    requests: "الطلبات",
    refresh: "تحديث",
    openRequests: "الطلبات المفتوحة",
    completionRate: "نسبة الإنجاز",
    avgResolution: "متوسط الحل",
    critical: "الحرجة",
    fastestEngineer: "أسرع مهندس",
    recurringIssues: "الأعطال المتكررة",
    noFastestEngineer: "لا توجد بيانات استجابة",
    createRequest: "إنشاء طلب",
    issueType: "نوع العطل",
    priority: "الأولوية",
    location: "الموقع",
    description: "الوصف",
    preferredDate: "الموعد المفضل",
    hazardous: "خطر",
    submit: "إرسال",
    status: "الحالة",
    company: "الشركة",
    engineer: "المهندس",
    created: "تاريخ الإنشاء",
    updated: "آخر تحديث",
    assign: "تعيين",
    move: "نقل",
    underReview: "قيد المراجعة",
    startWork: "بدء العمل",
    waitParts: "انتظار قطع",
    complete: "إنهاء",
    close: "إغلاق",
    reject: "رفض",
    assignedEngineer: "المهندس المعيّن",
    selectEngineer: "اختر مهندساً",
    emptyRequests: "لا توجد طلبات متاحة لدورك.",
    apiError: "أرجعت الواجهة الخلفية خطأ.",
    loading: "تحميل البيانات الحية",
    connectedAs: "متصل باسم",
    seconds: "ث",
    minutes: "د"
  }
} as const;

export function formatDuration(seconds: number | null, language: Language) {
  if (seconds === null) {
    return "—";
  }
  if (seconds < 90) {
    return `${Math.round(seconds)} ${copy[language].seconds}`;
  }
  return `${Math.round(seconds / 60)} ${copy[language].minutes}`;
}

export function getSpecialtyLabel(value: MaintenanceSpecialty, language: Language) {
  return specialtyOptions.find((option) => option.value === value)?.label[language] ?? value;
}

export function getPriorityLabel(value: Priority, language: Language) {
  return priorityOptions.find((option) => option.value === value)?.label[language] ?? value;
}
