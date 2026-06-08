import { PublicDashboard } from "@/src/components/PublicDashboard";

// Login is disabled: the dashboard opens directly as a read-only public view.
// The authenticated console (MaintenanceConsole) remains in the repo but is not routed.
export default function DashboardPage() {
  return <PublicDashboard />;
}
