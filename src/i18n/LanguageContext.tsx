import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { translations, type Locale, type TranslationKey } from "./translations";

interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey | (string & {})) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(
    () => (localStorage.getItem("erp-locale") as Locale) || "en"
  );

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    localStorage.setItem("erp-locale", l);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale === "sr" ? "sr-Latn" : "en";
  }, [locale]);

  const t = useCallback(
    (key: TranslationKey) => (translations[locale] as Record<string, string>)[key] || key,
    [locale]
  );

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextType {
  const ctx = useContext(LanguageContext);
  if (ctx === undefined) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return ctx;
}
