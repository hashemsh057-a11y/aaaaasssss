"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Login / system console is temporarily disabled.
// To re-enable, restore the original content:
//   import { MaintenanceConsole } from "@/src/components/MaintenanceConsole";
//   export default function LoginPage() { return <MaintenanceConsole />; }
export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/");
  }, [router]);

  return null;
}
