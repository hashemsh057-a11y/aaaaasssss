"use client";

import { Loader2, Lock, LogIn, User as UserIcon } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import type { Language } from "@/src/lib/types";

const ACCEPTED_USERNAMES = ["hashem", "هاشم"];
const ACCEPTED_PASSWORD = "123456";
const STORAGE_KEY = "engiflow_dashboard_session";
const STORAGE_VALUE = "v1-open";

const COPY: Record<Language, {
  brand: string;
  brandSub: string;
  tagline: string;
  username: string;
  password: string;
  submit: string;
  submitting: string;
  invalid: string;
  switchLang: string;
}> = {
  ar: {
    brand: "EngiFlow",
    brandSub: "إنجي فلو",
    tagline: "لوحة العمليات",
    username: "اسم المستخدم",
    password: "كلمة المرور",
    submit: "دخول المنظومة",
    submitting: "جارٍ الدخول…",
    invalid: "اسم المستخدم أو كلمة المرور غير صحيحة.",
    switchLang: "English"
  },
  en: {
    brand: "EngiFlow",
    brandSub: "Operations",
    tagline: "Operations dashboard",
    username: "Username",
    password: "Password",
    submit: "Enter dashboard",
    submitting: "Signing in…",
    invalid: "Wrong username or password.",
    switchLang: "العربية"
  }
};

function hasStoredSession() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === STORAGE_VALUE;
  } catch {
    return false;
  }
}

function storeSession() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, STORAGE_VALUE);
  } catch {
    /* private mode etc. — accept the session for this tab anyway */
  }
}

export function clearDashboardSession() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function DashboardLogin({
  language,
  onLanguageChange,
  onAuthenticated
}: {
  language: Language;
  onLanguageChange: (lang: Language) => void;
  onAuthenticated: () => void;
}) {
  const t = COPY[language];
  const dir = language === "ar" ? "rtl" : "ltr";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = dir;
  }, [language, dir]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    // Tiny delay so the spinner is visible — feels intentional, not glitchy.
    setTimeout(() => {
      const u = username.trim().toLowerCase();
      const ok = ACCEPTED_USERNAMES.some((accepted) => accepted.toLowerCase() === u) &&
        password === ACCEPTED_PASSWORD;
      if (ok) {
        storeSession();
        onAuthenticated();
      } else {
        setError(t.invalid);
        setSubmitting(false);
      }
    }, 180);
  }

  return (
    <main
      dir={dir}
      className="grid min-h-screen place-items-center bg-[linear-gradient(135deg,#eef4fc_0%,#dde9f9_55%,#f0f5fc_100%)] px-4 py-10"
    >
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <img
            src="/engiflow-logo.png"
            alt="EngiFlow"
            width={96}
            height={96}
            className="h-24 w-24 object-contain drop-shadow-md"
          />
          <p className="m-0 text-sm font-bold uppercase tracking-[0.3em] text-[#7088a0]">
            {t.tagline}
          </p>
        </div>

        <form
          onSubmit={submit}
          className="rounded-[2rem] bg-white/85 p-7 shadow-2xl shadow-[#a8c2e6]/30 backdrop-blur-xl"
        >
          <div className="grid gap-5">
            <label className="grid gap-2">
              <span className="flex items-center gap-2 text-sm font-extrabold text-[#5b6b85]">
                <UserIcon className="h-4 w-4 text-[#1f86ec]" aria-hidden="true" />
                {t.username}
              </span>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoComplete="username"
                placeholder={language === "ar" ? "أدخل اسم المستخدم" : "Enter username"}
                className="min-h-12 rounded-2xl border border-[#c3d4ec] bg-white px-4 text-base font-bold text-[#15294d] outline-none transition focus:border-[#1f86ec] focus:ring-4 focus:ring-[#1f86ec]/20"
                required
              />
            </label>

            <label className="grid gap-2">
              <span className="flex items-center gap-2 text-sm font-extrabold text-[#5b6b85]">
                <Lock className="h-4 w-4 text-[#1f86ec]" aria-hidden="true" />
                {t.password}
              </span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                placeholder="••••••"
                dir="ltr"
                className="min-h-12 rounded-2xl border border-[#c3d4ec] bg-white px-4 text-base font-bold text-[#15294d] outline-none transition focus:border-[#1f86ec] focus:ring-4 focus:ring-[#1f86ec]/20"
                required
              />
            </label>
          </div>

          {error && (
            <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#1f86ec] px-6 py-4 text-base font-extrabold text-white shadow-xl shadow-[#1f86ec]/30 transition-all hover:-translate-y-0.5 hover:bg-[#1567c6] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            ) : (
              <LogIn className="h-5 w-5" aria-hidden="true" />
            )}
            {submitting ? t.submitting : t.submit}
          </button>

        </form>

        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={() => onLanguageChange(language === "ar" ? "en" : "ar")}
            className="rounded-full bg-white/85 px-5 py-2 text-sm font-bold text-[#1f86ec] shadow-sm transition-all hover:-translate-y-0.5 hover:bg-white"
          >
            {t.switchLang}
          </button>
        </div>
      </div>
    </main>
  );
}

export function useDashboardSession() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    setAuthenticated(hasStoredSession());
  }, []);

  const helpers = useMemo(
    () => ({
      authenticate: () => setAuthenticated(true),
      signOut: () => {
        clearDashboardSession();
        setAuthenticated(false);
      }
    }),
    []
  );

  return { authenticated, ...helpers };
}
