/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 日本の国民の祝日 / 振替休日テーブル。
 * 内閣府 「国民の祝日について」(https://www8.cao.go.jp/chosei/shukujitsu/gaiyou.html) に準拠。
 * 振替休日（月曜日）も含む。
 *
 * 範囲: 2024 〜 2027（必要に応じて追加してください）
 */

export type JapaneseHoliday = {
  /** YYYY-MM-DD */
  date: string;
  /** 祝日名 */
  name: string;
  /** 振替休日 */
  isObserved?: boolean;
};

export const HOLIDAYS_JP: JapaneseHoliday[] = [
  // ---- 2024 ----
  { date: '2024-01-01', name: '元日' },
  { date: '2024-01-08', name: '成人の日' },
  { date: '2024-02-11', name: '建国記念の日' },
  { date: '2024-02-12', name: '振替休日', isObserved: true },
  { date: '2024-02-23', name: '天皇誕生日' },
  { date: '2024-03-20', name: '春分の日' },
  { date: '2024-04-29', name: '昭和の日' },
  { date: '2024-05-03', name: '憲法記念日' },
  { date: '2024-05-04', name: 'みどりの日' },
  { date: '2024-05-05', name: 'こどもの日' },
  { date: '2024-05-06', name: '振替休日', isObserved: true },
  { date: '2024-07-15', name: '海の日' },
  { date: '2024-08-11', name: '山の日' },
  { date: '2024-08-12', name: '振替休日', isObserved: true },
  { date: '2024-09-16', name: '敬老の日' },
  { date: '2024-09-22', name: '秋分の日' },
  { date: '2024-09-23', name: '振替休日', isObserved: true },
  { date: '2024-10-14', name: 'スポーツの日' },
  { date: '2024-11-03', name: '文化の日' },
  { date: '2024-11-04', name: '振替休日', isObserved: true },
  { date: '2024-11-23', name: '勤労感謝の日' },

  // ---- 2025 ----
  { date: '2025-01-01', name: '元日' },
  { date: '2025-01-13', name: '成人の日' },
  { date: '2025-02-11', name: '建国記念の日' },
  { date: '2025-02-23', name: '天皇誕生日' },
  { date: '2025-02-24', name: '振替休日', isObserved: true },
  { date: '2025-03-20', name: '春分の日' },
  { date: '2025-04-29', name: '昭和の日' },
  { date: '2025-05-03', name: '憲法記念日' },
  { date: '2025-05-04', name: 'みどりの日' },
  { date: '2025-05-05', name: 'こどもの日' },
  { date: '2025-05-06', name: '振替休日', isObserved: true },
  { date: '2025-07-21', name: '海の日' },
  { date: '2025-08-11', name: '山の日' },
  { date: '2025-09-15', name: '敬老の日' },
  { date: '2025-09-23', name: '秋分の日' },
  { date: '2025-10-13', name: 'スポーツの日' },
  { date: '2025-11-03', name: '文化の日' },
  { date: '2025-11-23', name: '勤労感謝の日' },
  { date: '2025-11-24', name: '振替休日', isObserved: true },

  // ---- 2026 ----
  { date: '2026-01-01', name: '元日' },
  { date: '2026-01-12', name: '成人の日' },
  { date: '2026-02-11', name: '建国記念の日' },
  { date: '2026-02-23', name: '天皇誕生日' },
  { date: '2026-03-20', name: '春分の日' },
  { date: '2026-04-29', name: '昭和の日' },
  { date: '2026-05-03', name: '憲法記念日' },
  { date: '2026-05-04', name: 'みどりの日' },
  { date: '2026-05-05', name: 'こどもの日' },
  { date: '2026-05-06', name: '振替休日', isObserved: true },
  { date: '2026-07-20', name: '海の日' },
  { date: '2026-08-11', name: '山の日' },
  { date: '2026-09-21', name: '敬老の日' },
  { date: '2026-09-22', name: '国民の休日' },
  { date: '2026-09-23', name: '秋分の日' },
  { date: '2026-10-12', name: 'スポーツの日' },
  { date: '2026-11-03', name: '文化の日' },
  { date: '2026-11-23', name: '勤労感謝の日' },

  // ---- 2027 ----
  { date: '2027-01-01', name: '元日' },
  { date: '2027-01-11', name: '成人の日' },
  { date: '2027-02-11', name: '建国記念の日' },
  { date: '2027-02-23', name: '天皇誕生日' },
  { date: '2027-03-21', name: '春分の日' },
  { date: '2027-03-22', name: '振替休日', isObserved: true },
  { date: '2027-04-29', name: '昭和の日' },
  { date: '2027-05-03', name: '憲法記念日' },
  { date: '2027-05-04', name: 'みどりの日' },
  { date: '2027-05-05', name: 'こどもの日' },
  { date: '2027-07-19', name: '海の日' },
  { date: '2027-08-11', name: '山の日' },
  { date: '2027-09-20', name: '敬老の日' },
  { date: '2027-09-23', name: '秋分の日' },
  { date: '2027-10-11', name: 'スポーツの日' },
  { date: '2027-11-03', name: '文化の日' },
  { date: '2027-11-23', name: '勤労感謝の日' },
];

const HOLIDAY_MAP: Record<string, JapaneseHoliday> = HOLIDAYS_JP.reduce(
  (acc, h) => {
    acc[h.date] = h;
    return acc;
  },
  {} as Record<string, JapaneseHoliday>,
);

/** YYYY-MM-DD で祝日を取得（無ければ undefined） */
export function getJapaneseHoliday(dateStr: string): JapaneseHoliday | undefined {
  return HOLIDAY_MAP[dateStr];
}

/** YYYY-MM-DD が日本の祝日（振替含む）か判定 */
export function isJapaneseHoliday(dateStr: string): boolean {
  return Boolean(HOLIDAY_MAP[dateStr]);
}

/** 祝日名を取得（無ければ undefined） */
export function getJapaneseHolidayName(dateStr: string): string | undefined {
  return HOLIDAY_MAP[dateStr]?.name;
}
