"use client";

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { translations, Language, TranslationKeys, SUPPORTED_LANGUAGES } from './translations';

interface LanguageContextType {
  language: Language | 'auto';
  systemLang: Language;
  effectiveLang: Language;
  setLanguage: (lang: Language | 'auto') => void;
  t: TranslationKeys;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ 
  children,
  initialLanguage = 'auto',
  initialSystemLang = 'zh'
}: { 
  children: React.ReactNode, 
  initialLanguage?: Language | 'auto',
  initialSystemLang?: Language
}) {
  const [state, setState] = useState<{
    language: Language | 'auto';
    systemLang: Language;
  }>({
    language: initialLanguage,
    systemLang: initialSystemLang
  });

  useEffect(() => {
    const getCookie = (name: string) => {
      if (typeof document === 'undefined') return null;
      const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
      return match ? match[2] : null;
    };

    const savedLang = (getCookie('app-language') || localStorage.getItem('app-language')) as Language | 'auto';
    let detected: Language = 'zh';

    if (typeof navigator !== 'undefined') {
      const systemLangs = navigator.languages;
      // First attempt to match exact or base languages from navigator
      for (const lang of systemLangs) {
        const lowerLang = lang.toLowerCase();
        if (lowerLang.startsWith('zh-tw') || lowerLang.startsWith('zh-hk') || lowerLang.startsWith('zh-hant')) {
          detected = 'zh-TW';
          break;
        }
        if (lowerLang.startsWith('zh-cn') || lowerLang.startsWith('zh-hans') || lowerLang === 'zh') {
          detected = 'zh';
          break;
        }
        const baseLang = lowerLang.split('-')[0] as Language;
        if (SUPPORTED_LANGUAGES.includes(baseLang) && baseLang !== 'zh' && baseLang !== 'zh-TW') {
          detected = baseLang;
          break;
        }
      }
    }

    const initialLang = (savedLang && SUPPORTED_LANGUAGES.includes(savedLang as Language)) ? savedLang : 'auto';

    // We use setTimeout to defer the state update.
    // This avoids the "Calling setState synchronously within an effect" warning.
    // Since we've already initialized the state with server-provided props,
    // this update will only trigger if client-side detection differs.
    setTimeout(() => {
      setState(prev => {
        if (prev.language === initialLang && prev.systemLang === detected) {
          return prev;
        }
        return {
          language: initialLang,
          systemLang: detected
        };
      });
    }, 0);
  }, []);

  const { language, systemLang } = state;

  const effectiveLang = useMemo(() => 
    language === 'auto' ? systemLang : (language as Language)
  , [language, systemLang]);

  const handleSetLanguage = useCallback((lang: Language | 'auto') => {
    setState(prev => ({ ...prev, language: lang }));
    if (lang === 'auto') {
      localStorage.removeItem('app-language');
      document.cookie = "app-language=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    } else {
      localStorage.setItem('app-language', lang);
      const date = new Date();
      date.setFullYear(date.getFullYear() + 1);
      document.cookie = `app-language=${lang}; path=/; expires=${date.toUTCString()}; samesite=lax`;
    }
    window.location.reload();
  }, []);

  const value = useMemo(() => ({
    language,
    systemLang,
    effectiveLang,
    setLanguage: handleSetLanguage,
    t: translations[effectiveLang] as TranslationKeys,
  }), [language, systemLang, effectiveLang, handleSetLanguage]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
