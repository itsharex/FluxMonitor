import { en } from './locales/en';
import { zh } from './locales/zh';
import { zhTW } from './locales/zh-TW';
import { ja } from './locales/ja';
import { ko } from './locales/ko';
import { es } from './locales/es';
import { de } from './locales/de';
import { fr } from './locales/fr';
import { it } from './locales/it';

export type Language = 'en' | 'zh' | 'zh-TW' | 'ja' | 'ko' | 'es' | 'de' | 'fr' | 'it';

export const translations = {
  en,
  zh,
  'zh-TW': zhTW,
  ja,
  ko,
  es,
  de,
  fr,
  it
};

export type TranslationKeys = typeof translations.zh;
export const SUPPORTED_LANGUAGES: Language[] = ['en', 'zh', 'zh-TW', 'ja', 'ko', 'es', 'de', 'fr', 'it'];

// Also define the native name for UI display
export const LANGUAGE_NAMES: Record<Language, string> = {
  'en': 'English',
  'zh': '简体中文',
  'zh-TW': '繁體中文',
  'ja': '日本語',
  'ko': '한국어',
  'es': 'Español',
  'de': 'Deutsch',
  'fr': 'Français',
  'it': 'Italiano'
};
