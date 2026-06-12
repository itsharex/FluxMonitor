import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import os from "os";
import { translations, Language, SUPPORTED_LANGUAGES } from "@/lib/translations";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const cookieList = await cookies();
  const langTag = cookieList.get('app-language')?.value as Language | 'auto' | undefined;

  let effectiveLang: Language = 'zh';

  if (langTag && langTag !== 'auto') {
    effectiveLang = langTag as Language;
  } else {
    // 兜底策略：服务端检测 Accept-Language
  const headerList = await headers();
    const acceptLang = headerList.get('accept-language')?.toLowerCase() || '';
    
    // 匹配第一个受支持的语言
    const preferredLangs = acceptLang.split(',').map(l => l.split(';')[0].trim().split('-')[0]);
    effectiveLang = preferredLangs.find((l): l is Language => SUPPORTED_LANGUAGES.includes(l as Language)) || 'zh';
  }

  const t = translations[effectiveLang] || translations.zh;

  return {
    title: `${t.appTitle} - ${os.hostname()}`,
    description: t.appDesc,
    robots: {
      index: false,
      follow: false,
    },
  };
}

import { LanguageProvider } from "@/lib/LanguageContext";
import { ThemeProvider } from "@/lib/ThemeContext";
import { SettingsProvider } from "@/lib/SettingsContext";
import { AnalyticsProvider } from "@/components/AnalyticsProvider";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // 服务端检测语言用于设置 html lang 标签
  const cookieList = await cookies();
  const langTag = cookieList.get('app-language')?.value as Language | 'auto' | undefined;
  const initialLang = (langTag && (langTag === 'auto' || SUPPORTED_LANGUAGES.includes(langTag as Language))) ? langTag : 'auto';
  
  let effectiveLang: Language = 'zh';
  if (langTag && langTag !== 'auto' && SUPPORTED_LANGUAGES.includes(langTag as Language)) {
    effectiveLang = langTag as Language;
  } else {
    const headerList = await headers();
    const acceptLang = headerList.get('accept-language')?.toLowerCase() || '';
    const preferredLangs = acceptLang.split(',').map(l => l.split(';')[0].trim().split('-')[0]);
    effectiveLang = preferredLangs.find((l): l is Language => SUPPORTED_LANGUAGES.includes(l as Language)) || 'zh';
  }

  return (
    <html lang={effectiveLang} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ThemeProvider>
          <SettingsProvider>
            <LanguageProvider initialLanguage={initialLang} initialSystemLang={effectiveLang}>
              <AnalyticsProvider>
                {children}
              </AnalyticsProvider>
            </LanguageProvider>
          </SettingsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

