"use client";

import React, { FormEvent, useState } from "react";
import { Network, ShieldCheck, Snowflake, Zap, type LucideIcon } from "lucide-react";

import { submitPublicContactInquiry, trackPublicRequest } from "@/src/lib/api";
import { statusLabels } from "@/src/lib/i18n";
import type { PublicTrackedRequest } from "@/src/lib/types";

type ContactForm = {
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  message: string;
};

type ServiceItem = {
  title: string;
  desc: string;
  icon: LucideIcon;
  color: string;
  bg: string;
};

const serviceItems = [
  { title: "الأمن السيبراني", desc: "بلاغات أمنية ومراجعة مضبوطة.", icon: ShieldCheck, color: "text-indigo-500", bg: "bg-indigo-50" },
  { title: "الكهرباء", desc: "لوحات إنارة ومولدات تشغيلية.", icon: Zap, color: "text-blue-500", bg: "bg-blue-50" },
  { title: "التكييف والتهوية", desc: "تبريد مرتبط بالموقع بدقة.", icon: Snowflake, color: "text-sky-500", bg: "bg-sky-50" },
  { title: "الشبكات والسيرفرات", desc: "كابلات وغرف بيانات.", icon: Network, color: "text-teal-500", bg: "bg-teal-50" }
] satisfies ServiceItem[];

const workflowItems = [
  { step: "01", title: "استلام الطلب", desc: "الشركة تسجل نوع العطل والأولوية." },
  { step: "02", title: "تعيين المهندس", desc: "توجيه آلي أو يدوي حسب التخصص." },
  { step: "03", title: "توثيق الأدلة", desc: "رفع صور الموقع قبل وبعد التنفيذ." },
  { step: "04", title: "إغلاق موثق", desc: "لا يُغلق الطلب إلا بموافقة الجودة." }
];

export function PublicLanding() {
  const [trackOpen, setTrackOpen] = useState(false);
  const [ticketNumber, setTicketNumber] = useState("");
  const [trackedRequest, setTrackedRequest] = useState<PublicTrackedRequest | null>(null);
  const [trackError, setTrackError] = useState<string | null>(null);
  const [trackLoading, setTrackLoading] = useState(false);
  const [contactForm, setContactForm] = useState<ContactForm>({
    companyName: "",
    contactName: "",
    email: "",
    phone: "",
    message: ""
  });
  const [contactState, setContactState] = useState<"idle" | "submitting" | "sent">("idle");
  const [contactError, setContactError] = useState<string | null>(null);

  async function handleTrackSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTrackLoading(true);
    setTrackError(null);
    setTrackedRequest(null);

    try {
      const request = await trackPublicRequest(ticketNumber.trim());
      setTrackedRequest(request);
    } catch {
      setTrackError("لم يتم العثور على هذا البلاغ. تأكد من رقم التذكرة وحاول مرة أخرى.");
    } finally {
      setTrackLoading(false);
    }
  }

  async function handleContactSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setContactState("submitting");
    setContactError(null);

    try {
      await submitPublicContactInquiry({
        company_name: contactForm.companyName.trim(),
        contact_name: contactForm.contactName.trim(),
        email: contactForm.email.trim(),
        phone: contactForm.phone.trim(),
        message: contactForm.message.trim()
      });
      setContactForm({ companyName: "", contactName: "", email: "", phone: "", message: "" });
      setContactState("sent");
    } catch {
      setContactError("تعذر إرسال الطلب. تأكد من البيانات وحاول مرة أخرى.");
      setContactState("idle");
    }
  }

  return (
    <div
      className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-teal-200 selection:text-teal-900"
      dir="rtl"
    >
      <nav className="sticky top-0 z-50 bg-white/70 backdrop-blur-lg border-b border-white/50 shadow-sm">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <a href="/" className="flex items-center gap-3 no-underline text-slate-800">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-400 to-blue-500 flex items-center justify-center text-white font-bold shadow-md shadow-teal-500/20">
              ص
            </div>
            <span className="text-xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-teal-700 to-blue-700">
              الصيانة الذكية
            </span>
          </a>
          <div className="hidden md:flex items-center gap-8 text-sm font-bold text-slate-500">
            <a href="#services" className="hover:text-teal-600 transition-colors no-underline text-slate-500">
              تخصصاتنا
            </a>
            <a href="#workflow" className="hover:text-teal-600 transition-colors no-underline text-slate-500">
              مسار العمل
            </a>
            <a href="#contact" className="hover:text-teal-600 transition-colors no-underline text-slate-500">
              تواصل معنا
            </a>
          </div>
          <div className="flex items-center gap-4">
            <button type="button" className="text-sm font-bold text-slate-500 hover:text-teal-600 transition-colors">
              English
            </button>
            <a
              href="/login"
              className="px-6 py-2.5 text-sm font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-full transition-all border border-teal-100 no-underline"
            >
              دخول النظام
            </a>
          </div>
        </div>
      </nav>

      <section className="relative pt-20 pb-32 overflow-hidden">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-teal-300/20 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-blue-300/20 rounded-full blur-[100px] translate-y-1/3 -translate-x-1/3" />

        <div className="container mx-auto px-6 relative z-10 text-center max-w-4xl mt-12">
          <h1 className="text-5xl md:text-6xl font-black leading-tight text-slate-800 mb-6">
            إدارة صيانة{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-500 to-blue-600">
              دقيقة، موثقة،
            </span>{" "}
            وبدون فوضى.
          </h1>
          <p className="text-xl text-slate-500 leading-relaxed max-w-2xl mx-auto mb-10">
            منصة متكاملة لاستقبال البلاغات، توجيه المهندسين حسب التخصص، توثيق الأعطال بالصور، وإغلاق الطلبات بشفافية تامة.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <a
              href="#contact"
              className="px-8 py-4 text-base font-bold text-white bg-gradient-to-r from-teal-500 to-blue-500 rounded-full shadow-xl shadow-teal-500/30 hover:scale-105 transition-transform no-underline"
            >
              احجز عرضاً تجريبياً
            </a>
            <button
              type="button"
              onClick={() => setTrackOpen(true)}
              className="px-8 py-4 text-base font-bold text-slate-600 bg-white border border-slate-200 rounded-full shadow-sm hover:shadow-md transition-all"
            >
              تتبع بلاغ عام
            </button>
          </div>
        </div>
      </section>

      <section id="services" className="py-24 bg-white relative overflow-hidden">
        <div className="absolute inset-y-16 right-0 w-40 bg-gradient-to-l from-teal-50 to-transparent" />
        <div className="absolute inset-y-16 left-0 w-40 bg-gradient-to-r from-blue-50 to-transparent" />
        <div className="container mx-auto px-6 relative">
          <div className="grid gap-14 lg:grid-cols-[0.9fr_1.35fr] lg:items-start">
            <div className="lg:sticky lg:top-28">
              <span className="mb-4 inline-flex rounded-full bg-teal-50 px-4 py-2 text-xs font-black text-teal-700">
                التخصصات
              </span>
              <h2 className="max-w-md text-3xl font-black leading-tight text-slate-800 md:text-4xl">
                تخصصات تعمل كمنظومة واحدة
              </h2>
              <p className="mt-5 max-w-md text-slate-500 leading-relaxed">
                مهما كان العطل، النظام يقرأ نوع البلاغ ويوجهه للفريق الصحيح ضمن مسار واحد واضح.
              </p>
            </div>

            <div className="space-y-5">
            {serviceItems.map((service, index) => {
              const Icon = service.icon;
              return (
                <article
                  key={service.title}
                  className="group relative overflow-hidden rounded-[2rem] bg-slate-50/80 p-1 transition-all duration-300 hover:-translate-y-1 hover:bg-white hover:shadow-2xl hover:shadow-slate-200/70"
                >
                  <div className="absolute inset-y-0 right-0 w-1.5 bg-gradient-to-b from-teal-400 to-blue-500 opacity-70 transition-opacity group-hover:opacity-100" />
                  <div className="flex items-center gap-5 rounded-[1.8rem] px-5 py-5 sm:px-7">
                    <div
                      className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl ${service.bg} ${service.color} shadow-sm transition-transform duration-300 group-hover:scale-110`}
                    >
                      <Icon aria-hidden="true" className="h-7 w-7" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-4">
                        <h3 className="truncate text-xl font-black text-slate-800">{service.title}</h3>
                        <span className="shrink-0 text-sm font-black text-slate-300">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-slate-500">{service.desc}</p>
                    </div>
                  </div>
                </article>
              );
            })}
            </div>
          </div>
        </div>
      </section>

      <section id="workflow" className="py-24 bg-slate-50">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-20">
            <h2 className="text-3xl font-black text-slate-800 mb-4">مسار واضح من البلاغ إلى الإغلاق</h2>
            <p className="text-slate-500">لا اجتهادات عشوائية، النظام يفرض تسلسلاً دقيقاً للعمل.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 relative">
            <div className="hidden md:block absolute top-1/4 right-[10%] left-[10%] h-0.5 bg-gradient-to-r from-teal-200 to-blue-200 -z-10" />

            {workflowItems.map((flow) => (
              <div key={flow.step} className="relative text-center group">
                <div className="w-16 h-16 mx-auto bg-white border-2 border-teal-100 rounded-full flex items-center justify-center text-teal-600 font-black text-xl mb-6 shadow-lg shadow-teal-100/50 group-hover:bg-teal-500 group-hover:text-white group-hover:scale-110 transition-all duration-300">
                  {flow.step}
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-3">{flow.title}</h3>
                <p className="text-slate-500 text-sm">{flow.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="contact" className="py-24 bg-white relative overflow-hidden">
        <div className="container mx-auto px-6 max-w-5xl">
          <div className="bg-gradient-to-br from-teal-50 to-blue-50 rounded-[3rem] p-10 md:p-16 grid md:grid-cols-2 gap-16 items-center shadow-2xl shadow-teal-100/40 border border-white">
            <div>
              <h2 className="text-3xl font-black text-slate-800 mb-4">حوّل صيانة شركتك إلى نظام واضح</h2>
              <p className="text-slate-500 leading-relaxed mb-8">
                تخلص من الطلبات الورقية والاتصالات المتفرقة. أرسل بياناتك وسنرتب معك تشغيل لوحة تحكم تجمع البلاغات والمهندسين والتقارير في مكان واحد.
              </p>
              <div className="space-y-4 text-sm font-bold text-slate-600">
                <p className="flex items-center gap-3">
                  <span className="text-teal-500 text-xl">✓</span> لوحة تحكم خاصة بشركتك
                </p>
                <p className="flex items-center gap-3">
                  <span className="text-teal-500 text-xl">✓</span> تقارير إحصائية دورية
                </p>
                <p className="flex items-center gap-3">
                  <span className="text-teal-500 text-xl">✓</span> متابعة حية لحالة المهندسين
                </p>
              </div>
              {contactState === "sent" && (
                <p className="mt-8 rounded-2xl bg-teal-500/10 px-4 py-3 text-sm font-bold text-teal-700">
                  تم إرسال الطلب للإدارة بنجاح.
                </p>
              )}
            </div>

            <div className="bg-white rounded-3xl p-8 shadow-xl shadow-slate-200/50 border border-slate-100">
              <form className="space-y-5" onSubmit={handleContactSubmit}>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 px-1">اسم الشركة</label>
                  <input
                    type="text"
                    required
                    value={contactForm.companyName}
                    onChange={(event) => setContactForm({ ...contactForm, companyName: event.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-teal-200 focus:bg-white transition-all text-slate-700"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 px-1">اسم المسؤول</label>
                    <input
                      type="text"
                      required
                      value={contactForm.contactName}
                      onChange={(event) => setContactForm({ ...contactForm, contactName: event.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-teal-200 focus:bg-white transition-all text-slate-700"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 px-1">البريد الإلكتروني</label>
                    <input
                      type="email"
                      required
                      value={contactForm.email}
                      onChange={(event) => setContactForm({ ...contactForm, email: event.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-teal-200 focus:bg-white transition-all text-slate-700"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 px-1">رقم الهاتف</label>
                  <input
                    type="tel"
                    required
                    value={contactForm.phone}
                    onChange={(event) => setContactForm({ ...contactForm, phone: event.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-teal-200 focus:bg-white transition-all text-slate-700"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 px-1">تفاصيل الاحتياج</label>
                  <textarea
                    rows={3}
                    required
                    value={contactForm.message}
                    onChange={(event) => setContactForm({ ...contactForm, message: event.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-teal-200 focus:bg-white transition-all text-slate-700 resize-none"
                  />
                </div>
                {contactError && <p className="text-sm font-bold text-red-600">{contactError}</p>}
                <button
                  type="submit"
                  disabled={contactState === "submitting"}
                  className="w-full py-4 text-white font-bold bg-gradient-to-r from-teal-500 to-blue-500 rounded-xl shadow-md hover:shadow-lg hover:-translate-y-1 transition-all mt-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {contactState === "submitting" ? "جاري الإرسال..." : "إرسال طلب العرض"}
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {trackOpen && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/40 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 text-slate-800 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-black text-slate-800">تتبع بلاغ عام</h2>
              <button
                type="button"
                onClick={() => {
                  setTrackOpen(false);
                  setTrackError(null);
                  setTrackedRequest(null);
                }}
                className="h-10 w-10 rounded-full text-slate-500 hover:bg-slate-100"
                aria-label="إغلاق"
              >
                ×
              </button>
            </div>
            <form className="space-y-4" onSubmit={handleTrackSubmit}>
              <input
                type="text"
                required
                value={ticketNumber}
                onChange={(event) => setTicketNumber(event.target.value)}
                className="w-full px-4 py-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-teal-200 focus:bg-white transition-all text-slate-700"
                placeholder="رقم التذكرة"
              />
              <button
                type="submit"
                disabled={trackLoading}
                className="w-full py-4 text-white font-bold bg-gradient-to-r from-teal-500 to-blue-500 rounded-xl shadow-md disabled:cursor-not-allowed disabled:opacity-60"
              >
                {trackLoading ? "جاري التتبع..." : "تتبع الآن"}
              </button>
            </form>
            {trackError && <p className="mt-4 text-sm font-bold text-red-600">{trackError}</p>}
            {trackedRequest && (
              <div className="mt-5 space-y-2 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                <p className="font-black text-slate-900">#{trackedRequest.id}</p>
                <p>{trackedRequest.client_company_name}</p>
                <p>{trackedRequest.issue_type_display}</p>
                <p className="font-black text-teal-700">{statusLabels[trackedRequest.status].ar}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default PublicLanding;
