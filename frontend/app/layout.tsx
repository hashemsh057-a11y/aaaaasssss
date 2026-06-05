import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Smart Maintenance Platform",
  description: "Public website and dashboard for smart maintenance workflow management"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
