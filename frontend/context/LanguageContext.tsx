"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { translations, type Locale } from "@/lib/translations";

type LanguageContextType = {
  locale: Locale;
  t: (key: string) => string;
  toggleLocale: () => void;
  setLocale: (l: Locale) => void;
};

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("vi");

  // Restore from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("app-locale");
      if (stored === "en" || stored === "vi") {
        setLocaleState(stored);
      }
    } catch {
      // localStorage unavailable (SSR or privacy mode)
    }
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem("app-locale", l);
    } catch {}
  }, []);

  const toggleLocale = useCallback(() => {
    setLocale(locale === "en" ? "vi" : "en");
  }, [locale, setLocale]);

  const t = useCallback(
    (key: string): string => {
      // key format: "section.key" e.g. "nav.home"
      const parts = key.split(".");
      if (parts.length !== 2) return key;
      const [section, field] = parts;
      return translations[locale]?.[section]?.[field] ?? key;
    },
    [locale]
  );

  return (
    <LanguageContext.Provider value={{ locale, t, toggleLocale, setLocale }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used inside LanguageProvider");
  return ctx;
}
