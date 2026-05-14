/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 言語切替ストア。日本語 (ja) / English (en) / Монгол (mn) の 3 言語を管理。
 *
 * 使い方:
 *   const { lang, setLang } = useLanguage();
 *   const t = useT();              // 翻訳関数
 *   <h1>{t('nav.dashboard')}</h1>  // → 'ダッシュボード' / 'Dashboard' / 'Хяналтын самбар'
 */

import { useSyncExternalStore } from 'react';
import { translations, type TranslationKey } from '@/src/constants/translations';

export type Language = 'ja' | 'en' | 'mn';

export const LANGUAGE_LABELS: Record<Language, { native: string; english: string; flag: string }> = {
  ja: { native: '日本語', english: 'Japanese', flag: '🇯🇵' },
  en: { native: 'English', english: 'English', flag: '🇺🇸' },
  mn: { native: 'Монгол', english: 'Mongolian', flag: '🇲🇳' },
};

let currentLang: Language = (() => {
  if (typeof window !== 'undefined') {
    try {
      const saved = window.localStorage?.getItem('app_lang');
      if (saved === 'ja' || saved === 'en' || saved === 'mn') return saved;
    } catch {
      // ignore
    }
  }
  return 'ja';
})();

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const getSnapshot = () => currentLang;

export function useLanguage(): { lang: Language; setLang: (l: Language) => void } {
  const lang = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return { lang, setLang: setLanguage };
}

export function getLanguage(): Language {
  return currentLang;
}

export function setLanguage(lang: Language) {
  currentLang = lang;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage?.setItem('app_lang', lang);
    } catch {
      // ignore
    }
  }
  emit();
}

/** 翻訳関数フック。lang が変わると自動再描画 */
export function useT() {
  const { lang } = useLanguage();
  return (key: TranslationKey): string => {
    const dict = translations[lang];
    return dict?.[key] ?? translations.ja[key] ?? key;
  };
}

/** 非フック文脈用（コンポーネント外で使う場合） */
export function t(key: TranslationKey): string {
  const dict = translations[currentLang];
  return dict?.[key] ?? translations.ja[key] ?? key;
}
