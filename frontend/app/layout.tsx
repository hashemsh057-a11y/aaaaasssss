import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EngiFlow — Plan. Manage. Achieve.",
  description: "EngiFlow — منصة إدارة ومتابعة طلبات الصيانة المؤسسية"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
