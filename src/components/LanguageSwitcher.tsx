/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 言語切替コンポーネント。3 つの言語ボタンを横並びにシンプルに表示。
 * （base-ui の Menu の挙動依存を避けるため、独自の Popover-less 実装に切替）
 */

import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useLanguage,
  LANGUAGE_LABELS,
  type Language,
} from '@/src/stores/i18nStore';

const LANGS: Language[] = ['ja', 'en', 'mn'];

export function LanguageSwitcher({
  variant = 'header',
}: {
  variant?: 'header' | 'standalone';
}) {
  const { lang, setLang } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  // 外側クリックでメニューを閉じる
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const triggerCls =
    variant === 'standalone'
      ? 'h-9 gap-1.5 px-3 text-xs font-bold bg-white shadow-sm border border-slate-200 rounded-lg'
      : 'h-8 gap-1.5 px-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-md';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((p) => !p);
        }}
        className={cn(
          'inline-flex items-center transition-colors',
          triggerCls,
        )}
      >
        <Globe className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">{LANGUAGE_LABELS[lang].native}</span>
        <span className="sm:hidden text-base leading-none">{LANGUAGE_LABELS[lang].flag}</span>
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-[1000] min-w-[160px] bg-white rounded-lg shadow-xl ring-1 ring-slate-200 overflow-hidden"
        >
          <div className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
            Language / 言語 / Хэл
          </div>
          {LANGS.map((l) => (
            <button
              key={l}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setLang(l);
                setOpen(false);
              }}
              className={cn(
                'w-full text-left text-xs font-bold px-3 py-2.5 cursor-pointer transition-colors flex items-center gap-2 border-b border-slate-50 last:border-0',
                lang === l ? 'text-blue-600 bg-blue-50' : 'text-slate-700 hover:bg-slate-50',
              )}
            >
              <span className="text-base leading-none">{LANGUAGE_LABELS[l].flag}</span>
              <span>{LANGUAGE_LABELS[l].native}</span>
              {lang === l && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-600" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
