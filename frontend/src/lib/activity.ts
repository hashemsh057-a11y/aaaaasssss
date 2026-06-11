import { statusLabels } from "./i18n";
import type { Language, MaintenanceStatus, PortalRequestActivity } from "./types";

const knownStatuses = new Set<MaintenanceStatus>([
  "NEW",
  "UNDER_REVIEW",
  "ASSIGNED",
  "IN_PROGRESS",
  "WAITING_SPARE_PARTS",
  "COMPLETED",
  "REJECTED",
  "CLOSED"
]);

export function formatRequestActivity(activity: PortalRequestActivity, language: Language) {
  if (activity.event_type === "NOTE") return activity.message;
  if (activity.event_type === "AUTO_ASSIGNED") {
    return language === "ar"
      ? "تم تعيين المهندس تلقائيًا حسب التخصص وحجم العمل الحالي."
      : "Engineer assigned automatically by specialty and current workload.";
  }
  if (activity.event_type === "ACCEPTED") {
    return language === "ar"
      ? "قبل المهندس الطلب وبدأ العمل."
      : "The engineer accepted the request and started work.";
  }

  const match = activity.message.match(/\b([A-Z_]+)\b(?=\.?$)/);
  const status = match?.[1] as MaintenanceStatus | undefined;
  if (status && knownStatuses.has(status)) {
    return language === "ar"
      ? `تم تحديث حالة الطلب إلى: ${statusLabels[status].ar}.`
      : `Request status updated to: ${statusLabels[status].en}.`;
  }
  return activity.message;
}
