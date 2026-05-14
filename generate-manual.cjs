/**
 * サスティナブルガレージ業務管理システム 取扱説明書 生成スクリプト
 *
 * 使い方:
 *   cd ~/Downloads/source
 *   node generate-manual.cjs
 *
 * 出力: ~/Downloads/source/取扱説明書.docx
 */

const {
  Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell,
  AlignmentType, HeadingLevel, LevelFormat, BorderStyle, WidthType, ShadingType,
  PageBreak, PageNumber, Header, Footer, PageOrientation,
} = require('docx');
const fs = require('fs');
const path = require('path');

// ========================================================================
// SVG イラスト定義
// ========================================================================

const svgLogin = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
  <rect width="800" height="600" fill="#f8fafc"/>
  <rect x="200" y="100" width="400" height="450" rx="20" fill="#ffffff" stroke="#e2e8f0" stroke-width="1"/>
  <rect x="200" y="100" width="400" height="8" rx="4" fill="#2563eb"/>
  <circle cx="400" cy="190" r="32" fill="#2563eb"/>
  <text x="400" y="200" text-anchor="middle" fill="#fff" font-family="Arial" font-size="28" font-weight="bold">🔑</text>
  <text x="400" y="260" text-anchor="middle" fill="#1e293b" font-family="Arial" font-size="22" font-weight="bold">サスティナブルガレージ</text>
  <text x="400" y="285" text-anchor="middle" fill="#64748b" font-family="Arial" font-size="13">倉庫・生産管理システム</text>
  <text x="240" y="330" fill="#475569" font-family="Arial" font-size="12" font-weight="bold">メールアドレス</text>
  <rect x="240" y="340" width="320" height="42" rx="6" fill="#f8fafc" stroke="#e2e8f0"/>
  <text x="260" y="365" fill="#94a3b8" font-family="Arial" font-size="13">name@example.com</text>
  <text x="240" y="400" fill="#475569" font-family="Arial" font-size="12" font-weight="bold">パスワード</text>
  <text x="510" y="400" fill="#2563eb" font-family="Arial" font-size="11">パスワードを忘れた方</text>
  <rect x="240" y="410" width="320" height="42" rx="6" fill="#f8fafc" stroke="#e2e8f0"/>
  <text x="260" y="436" fill="#94a3b8" font-family="Arial" font-size="13">••••••••</text>
  <rect x="240" y="470" width="320" height="48" rx="6" fill="#2563eb"/>
  <text x="400" y="500" text-anchor="middle" fill="#fff" font-family="Arial" font-size="14" font-weight="bold">ログイン →</text>
  <text x="400" y="555" text-anchor="middle" fill="#94a3b8" font-family="Arial" font-size="10">DEMO</text>
  <rect x="730" y="20" width="55" height="32" rx="6" fill="#ffffff" stroke="#e2e8f0"/>
  <text x="757" y="40" text-anchor="middle" fill="#475569" font-family="Arial" font-size="11" font-weight="bold">🌐 JA</text>
</svg>`;

const svgAdminDashboard = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 720" width="1200" height="720">
  <rect width="1200" height="720" fill="#f8fafc"/>
  <rect x="0" y="0" width="240" height="720" fill="#1e293b"/>
  <text x="20" y="40" fill="#fff" font-family="Arial" font-size="14" font-weight="bold">サスティナブルガレージ</text>
  <text x="20" y="60" fill="#94a3b8" font-family="Arial" font-size="10">管理者 太郎</text>
  <rect x="10" y="90" width="220" height="38" rx="6" fill="#2563eb"/>
  <text x="40" y="114" fill="#fff" font-family="Arial" font-size="13" font-weight="bold">📊 ダッシュボード</text>
  <text x="40" y="160" fill="#cbd5e1" font-family="Arial" font-size="12">📦 在庫管理</text>
  <text x="40" y="195" fill="#cbd5e1" font-family="Arial" font-size="12">🚛 回収業務</text>
  <text x="40" y="230" fill="#cbd5e1" font-family="Arial" font-size="12">📋 作業スケジュール</text>
  <text x="40" y="265" fill="#cbd5e1" font-family="Arial" font-size="12">🛒 BANANA BAY</text>
  <text x="40" y="300" fill="#cbd5e1" font-family="Arial" font-size="12">⏱ 勤怠・給与</text>
  <text x="40" y="335" fill="#cbd5e1" font-family="Arial" font-size="12">💰 売上管理</text>
  <text x="40" y="370" fill="#cbd5e1" font-family="Arial" font-size="12">👥 従業員管理</text>
  <text x="270" y="40" fill="#1e293b" font-family="Arial" font-size="22" font-weight="bold">全体概要</text>
  <rect x="950" y="20" width="180" height="32" rx="16" fill="#dbeafe"/>
  <text x="1040" y="42" text-anchor="middle" fill="#2563eb" font-family="Arial" font-size="11" font-weight="bold">表示拠点: 大阪支店</text>
  <rect x="270" y="80" width="270" height="100" rx="8" fill="#fff" stroke="#e2e8f0"/>
  <text x="285" y="105" fill="#94a3b8" font-family="Arial" font-size="10" font-weight="bold">在庫総数</text>
  <text x="285" y="145" fill="#1e293b" font-family="Arial" font-size="28" font-weight="bold">120 件</text>
  <text x="285" y="165" fill="#64748b" font-family="Arial" font-size="10">在庫率: 98% / 出品率: 65%</text>
  <rect x="555" y="80" width="270" height="100" rx="8" fill="#fff" stroke="#fecaca"/>
  <text x="570" y="105" fill="#dc2626" font-family="Arial" font-size="10" font-weight="bold">未登録在庫</text>
  <text x="570" y="145" fill="#dc2626" font-family="Arial" font-size="28" font-weight="bold">8 件</text>
  <text x="570" y="165" fill="#64748b" font-family="Arial" font-size="10">対応待ちの仕分け</text>
  <rect x="840" y="80" width="270" height="100" rx="8" fill="#fff" stroke="#e2e8f0"/>
  <text x="855" y="105" fill="#10b981" font-family="Arial" font-size="10" font-weight="bold">本日完了タスク</text>
  <text x="855" y="145" fill="#1e293b" font-family="Arial" font-size="28" font-weight="bold">23 件</text>
  <text x="855" y="165" fill="#64748b" font-family="Arial" font-size="10">作業員 5 名稼働中</text>
  <text x="270" y="220" fill="#f59e0b" font-family="Arial" font-size="11" font-weight="bold">🛒 BANANA BAY 販売</text>
  <rect x="270" y="235" width="200" height="80" rx="8" fill="#fff" stroke="#e2e8f0"/>
  <text x="285" y="258" fill="#94a3b8" font-family="Arial" font-size="10">出品中</text>
  <text x="285" y="290" fill="#1e293b" font-family="Arial" font-size="22" font-weight="bold">45 点</text>
  <rect x="485" y="235" width="200" height="80" rx="8" fill="#fff" stroke="#e2e8f0"/>
  <text x="500" y="258" fill="#94a3b8" font-family="Arial" font-size="10">累計売却</text>
  <text x="500" y="290" fill="#10b981" font-family="Arial" font-size="22" font-weight="bold">128 点</text>
  <rect x="700" y="235" width="200" height="80" rx="8" fill="#fff" stroke="#e2e8f0"/>
  <text x="715" y="258" fill="#94a3b8" font-family="Arial" font-size="10">本日売上</text>
  <text x="715" y="290" fill="#f59e0b" font-family="Arial" font-size="20" font-weight="bold">¥45,200</text>
  <rect x="915" y="235" width="195" height="80" rx="8" fill="#fff" stroke="#e2e8f0"/>
  <text x="930" y="258" fill="#94a3b8" font-family="Arial" font-size="10">要対応</text>
  <text x="930" y="290" fill="#e11d48" font-family="Arial" font-size="22" font-weight="bold">2 点</text>
  <rect x="270" y="350" width="540" height="290" rx="8" fill="#fff" stroke="#e2e8f0"/>
  <text x="290" y="378" fill="#1e293b" font-family="Arial" font-size="14" font-weight="bold">本日の作業進捗</text>
  <line x1="290" y1="540" x2="790" y2="540" stroke="#e2e8f0"/>
  <rect x="320" y="450" width="40" height="90" fill="#2563eb"/>
  <rect x="380" y="430" width="40" height="110" fill="#2563eb"/>
  <rect x="440" y="410" width="40" height="130" fill="#2563eb"/>
  <rect x="500" y="470" width="40" height="70" fill="#10b981"/>
  <rect x="560" y="490" width="40" height="50" fill="#10b981"/>
  <rect x="620" y="500" width="40" height="40" fill="#cbd5e1"/>
  <rect x="680" y="510" width="40" height="30" fill="#cbd5e1"/>
  <rect x="740" y="520" width="40" height="20" fill="#cbd5e1"/>
  <rect x="830" y="350" width="280" height="290" rx="8" fill="#fff" stroke="#bfdbfe"/>
  <rect x="830" y="350" width="280" height="50" rx="8" fill="#2563eb"/>
  <text x="850" y="380" fill="#fff" font-family="Arial" font-size="13" font-weight="bold">🔔 受領情報 (リアルタイム)</text>
  <circle cx="1090" cy="375" r="5" fill="#34d399"/>
  <rect x="850" y="415" width="240" height="60" rx="6" fill="#f1f5f9"/>
  <text x="860" y="430" fill="#2563eb" font-family="Arial" font-size="9" font-weight="bold">RECEIVED</text>
  <text x="860" y="448" fill="#1e293b" font-family="Arial" font-size="11" font-weight="bold">佐藤 健一 様</text>
  <text x="860" y="465" fill="#64748b" font-family="Arial" font-size="10">担当: 回収員 三郎 / ¥12,500</text>
  <rect x="850" y="485" width="240" height="60" rx="6" fill="#f1f5f9"/>
  <text x="860" y="500" fill="#2563eb" font-family="Arial" font-size="9" font-weight="bold">RECEIVED</text>
  <text x="860" y="518" fill="#1e293b" font-family="Arial" font-size="11" font-weight="bold">株式会社オート 様</text>
  <text x="860" y="535" fill="#64748b" font-family="Arial" font-size="10">担当: 回収員 三郎 / ¥48,000</text>
</svg>`;

const svgEmployeeHome = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 720" width="400" height="720">
  <rect width="400" height="720" fill="#f8fafc"/>
  <rect x="0" y="0" width="400" height="60" fill="#fff"/>
  <text x="20" y="35" fill="#1e293b" font-family="Arial" font-size="14" font-weight="bold">作業員 一郎</text>
  <text x="20" y="50" fill="#64748b" font-family="Arial" font-size="10">大阪支店</text>
  <rect x="320" y="15" width="65" height="32" rx="6" fill="#f8fafc" stroke="#e2e8f0"/>
  <text x="352" y="35" text-anchor="middle" fill="#475569" font-family="Arial" font-size="11" font-weight="bold">🌐 JA</text>
  <rect x="20" y="80" width="360" height="140" rx="16" fill="#10b981"/>
  <text x="40" y="115" fill="#fff" font-family="Arial" font-size="10" font-weight="bold">ENERGIZED</text>
  <text x="40" y="155" fill="#fff" font-family="Arial" font-size="22" font-weight="bold">Worker Dashboard</text>
  <text x="40" y="180" fill="#a7f3d0" font-family="Arial" font-size="11">稼働時間 04:32:18</text>
  <rect x="40" y="190" width="240" height="6" rx="3" fill="#065f46"/>
  <rect x="40" y="190" width="170" height="6" rx="3" fill="#fff"/>
  <text x="20" y="245" fill="#64748b" font-family="Arial" font-size="10" font-weight="bold">勤怠操作</text>
  <rect x="20" y="255" width="170" height="56" rx="12" fill="#fff" stroke="#10b981" stroke-width="2"/>
  <text x="105" y="288" text-anchor="middle" fill="#10b981" font-family="Arial" font-size="13" font-weight="bold">🟢 作業中</text>
  <rect x="210" y="255" width="170" height="56" rx="12" fill="#f59e0b"/>
  <text x="295" y="288" text-anchor="middle" fill="#fff" font-family="Arial" font-size="13" font-weight="bold">☕ 休憩</text>
  <text x="20" y="345" fill="#64748b" font-family="Arial" font-size="10" font-weight="bold">本日のタスク</text>
  <rect x="20" y="355" width="360" height="80" rx="12" fill="#fff"/>
  <rect x="20" y="355" width="6" height="80" fill="#ef4444"/>
  <text x="40" y="382" fill="#1e293b" font-family="Arial" font-size="13" font-weight="bold">商品化 トヨタ プリウス エンジン</text>
  <rect x="270" y="365" width="50" height="18" rx="4" fill="#fee2e2"/>
  <text x="295" y="377" text-anchor="middle" fill="#dc2626" font-family="Arial" font-size="9" font-weight="bold">緊急</text>
  <text x="40" y="402" fill="#64748b" font-family="Arial" font-size="10">📍 第2センター / Aブロック</text>
  <text x="40" y="420" fill="#64748b" font-family="Arial" font-size="10">⏱ 09:00〜10:00 (60分) / 数量: 1</text>
  <rect x="20" y="455" width="360" height="80" rx="12" fill="#fff"/>
  <rect x="20" y="455" width="6" height="80" fill="#2563eb"/>
  <text x="40" y="482" fill="#1e293b" font-family="Arial" font-size="13" font-weight="bold">分別 田中自動車 回収品</text>
  <text x="40" y="502" fill="#64748b" font-family="Arial" font-size="10">📍 第1センター</text>
  <text x="40" y="520" fill="#64748b" font-family="Arial" font-size="10">⏱ 10:30〜12:00 (90分) / 数量: 4</text>
  <rect x="20" y="555" width="170" height="80" rx="12" fill="#fff" stroke="#e2e8f0"/>
  <text x="105" y="578" text-anchor="middle" fill="#94a3b8" font-family="Arial" font-size="9" font-weight="bold">完了タスク</text>
  <text x="105" y="610" text-anchor="middle" fill="#10b981" font-family="Arial" font-size="22" font-weight="bold">5</text>
  <text x="105" y="628" text-anchor="middle" fill="#94a3b8" font-family="Arial" font-size="9">本日完了</text>
  <rect x="210" y="555" width="170" height="80" rx="12" fill="#fff" stroke="#e2e8f0"/>
  <text x="295" y="578" text-anchor="middle" fill="#94a3b8" font-family="Arial" font-size="9" font-weight="bold">獲得ボーナス</text>
  <text x="295" y="610" text-anchor="middle" fill="#2563eb" font-family="Arial" font-size="20" font-weight="bold">¥3,200</text>
  <text x="295" y="628" text-anchor="middle" fill="#94a3b8" font-family="Arial" font-size="9">目標まであと ¥800</text>
  <rect x="0" y="660" width="400" height="60" fill="#fff"/>
  <text x="80" y="700" text-anchor="middle" fill="#2563eb" font-family="Arial" font-size="10" font-weight="bold">🏠 ホーム</text>
  <text x="160" y="700" text-anchor="middle" fill="#94a3b8" font-family="Arial" font-size="10">📦 在庫</text>
  <text x="240" y="700" text-anchor="middle" fill="#94a3b8" font-family="Arial" font-size="10">📋 業務</text>
  <text x="320" y="700" text-anchor="middle" fill="#94a3b8" font-family="Arial" font-size="10">📅 予定</text>
</svg>`;

const svgCollectorWorkflow = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400" width="800" height="400">
  <rect width="800" height="400" fill="#f8fafc"/>
  <text x="400" y="40" text-anchor="middle" fill="#1e293b" font-family="Arial" font-size="18" font-weight="bold">回収業務 5ステップフロー</text>
  <circle cx="120" cy="200" r="40" fill="#f59e0b"/>
  <text x="120" y="208" text-anchor="middle" fill="#fff" font-family="Arial" font-size="22" font-weight="bold">1</text>
  <text x="120" y="265" text-anchor="middle" fill="#1e293b" font-family="Arial" font-size="12" font-weight="bold">案内</text>
  <text x="120" y="285" text-anchor="middle" fill="#64748b" font-family="Arial" font-size="10">Google Map</text>
  <line x1="170" y1="200" x2="220" y2="200" stroke="#cbd5e1" stroke-width="2"/>
  <polygon points="218,196 226,200 218,204" fill="#cbd5e1"/>
  <circle cx="260" cy="200" r="40" fill="#f59e0b"/>
  <text x="260" y="208" text-anchor="middle" fill="#fff" font-family="Arial" font-size="22" font-weight="bold">2</text>
  <text x="260" y="265" text-anchor="middle" fill="#1e293b" font-family="Arial" font-size="12" font-weight="bold">到着・点検</text>
  <text x="260" y="285" text-anchor="middle" fill="#64748b" font-family="Arial" font-size="10">品目チェック</text>
  <line x1="310" y1="200" x2="360" y2="200" stroke="#cbd5e1" stroke-width="2"/>
  <polygon points="358,196 366,200 358,204" fill="#cbd5e1"/>
  <circle cx="400" cy="200" r="40" fill="#f59e0b"/>
  <text x="400" y="208" text-anchor="middle" fill="#fff" font-family="Arial" font-size="22" font-weight="bold">3</text>
  <text x="400" y="265" text-anchor="middle" fill="#1e293b" font-family="Arial" font-size="12" font-weight="bold">写真撮影</text>
  <text x="400" y="285" text-anchor="middle" fill="#64748b" font-family="Arial" font-size="10">記録保存</text>
  <line x1="450" y1="200" x2="500" y2="200" stroke="#cbd5e1" stroke-width="2"/>
  <polygon points="498,196 506,200 498,204" fill="#cbd5e1"/>
  <circle cx="540" cy="200" r="40" fill="#10b981"/>
  <text x="540" y="208" text-anchor="middle" fill="#fff" font-family="Arial" font-size="22" font-weight="bold">4</text>
  <text x="540" y="265" text-anchor="middle" fill="#1e293b" font-family="Arial" font-size="12" font-weight="bold">受領書</text>
  <text x="540" y="285" text-anchor="middle" fill="#64748b" font-family="Arial" font-size="10">電子署名</text>
  <line x1="590" y1="200" x2="640" y2="200" stroke="#cbd5e1" stroke-width="2"/>
  <polygon points="638,196 646,200 638,204" fill="#cbd5e1"/>
  <circle cx="680" cy="200" r="40" fill="#10b981"/>
  <text x="680" y="208" text-anchor="middle" fill="#fff" font-family="Arial" font-size="22" font-weight="bold">5</text>
  <text x="680" y="265" text-anchor="middle" fill="#1e293b" font-family="Arial" font-size="12" font-weight="bold">完了</text>
  <text x="680" y="285" text-anchor="middle" fill="#64748b" font-family="Arial" font-size="10">次の案件へ</text>
  <text x="120" y="140" text-anchor="middle" fill="#f59e0b" font-family="Arial" font-size="36">🚛</text>
  <text x="260" y="140" text-anchor="middle" fill="#f59e0b" font-family="Arial" font-size="36">📋</text>
  <text x="400" y="140" text-anchor="middle" fill="#f59e0b" font-family="Arial" font-size="36">📷</text>
  <text x="540" y="140" text-anchor="middle" fill="#10b981" font-family="Arial" font-size="36">✍️</text>
  <text x="680" y="140" text-anchor="middle" fill="#10b981" font-family="Arial" font-size="36">✅</text>
</svg>`;

const svgWorkerReport = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 720" width="400" height="720">
  <rect width="400" height="720" fill="#f8fafc"/>
  <rect x="0" y="0" width="400" height="60" fill="#fff"/>
  <text x="60" y="38" fill="#1e293b" font-family="Arial" font-size="14" font-weight="bold">作業報告</text>
  <text x="22" y="38" fill="#64748b" font-family="Arial" font-size="20">←</text>
  <rect x="20" y="80" width="170" height="44" rx="12" fill="#2563eb"/>
  <text x="105" y="108" text-anchor="middle" fill="#fff" font-family="Arial" font-size="11" font-weight="bold">📋 新規報告の作成</text>
  <rect x="210" y="80" width="170" height="44" rx="12" fill="#fff" stroke="#e2e8f0"/>
  <text x="295" y="108" text-anchor="middle" fill="#64748b" font-family="Arial" font-size="11" font-weight="bold">⚙️ 作業履歴の確認</text>
  <circle cx="80" cy="160" r="18" fill="#10b981"/>
  <text x="80" y="166" text-anchor="middle" fill="#fff" font-family="Arial" font-size="12" font-weight="bold">✓</text>
  <text x="80" y="195" text-anchor="middle" fill="#64748b" font-family="Arial" font-size="9" font-weight="bold">開始確認</text>
  <line x1="100" y1="160" x2="180" y2="160" stroke="#10b981" stroke-width="2"/>
  <circle cx="200" cy="160" r="18" fill="#2563eb"/>
  <text x="200" y="166" text-anchor="middle" fill="#fff" font-family="Arial" font-size="12" font-weight="bold">2</text>
  <text x="200" y="195" text-anchor="middle" fill="#2563eb" font-family="Arial" font-size="9" font-weight="bold">実作業</text>
  <line x1="220" y1="160" x2="300" y2="160" stroke="#e2e8f0" stroke-width="2"/>
  <circle cx="320" cy="160" r="18" fill="#e2e8f0"/>
  <text x="320" y="166" text-anchor="middle" fill="#64748b" font-family="Arial" font-size="12" font-weight="bold">3</text>
  <text x="320" y="195" text-anchor="middle" fill="#64748b" font-family="Arial" font-size="9" font-weight="bold">完了報告</text>
  <text x="20" y="240" fill="#1e293b" font-family="Arial" font-size="12" font-weight="bold">3分類設定 <tspan fill="#ef4444" font-size="10">*必須</tspan></text>
  <rect x="20" y="250" width="360" height="60" rx="12" fill="#dbeafe" stroke="#2563eb" stroke-width="2"/>
  <text x="40" y="278" fill="#1e293b" font-family="Arial" font-size="13" font-weight="bold">リユース</text>
  <text x="40" y="298" fill="#64748b" font-family="Arial" font-size="10">そのまま再利用可能な商品</text>
  <text x="350" y="282" fill="#2563eb" font-family="Arial" font-size="16">✓</text>
  <rect x="20" y="320" width="360" height="40" rx="12" fill="#fff" stroke="#e2e8f0"/>
  <text x="40" y="345" fill="#1e293b" font-family="Arial" font-size="12">資源</text>
  <rect x="20" y="370" width="360" height="40" rx="12" fill="#fff" stroke="#e2e8f0"/>
  <text x="40" y="395" fill="#1e293b" font-family="Arial" font-size="12">リビルド</text>
  <text x="20" y="440" fill="#1e293b" font-family="Arial" font-size="12" font-weight="bold">商品情報入力</text>
  <text x="20" y="460" fill="#64748b" font-family="Arial" font-size="10">買取金額 (¥)</text>
  <rect x="20" y="470" width="170" height="40" rx="6" fill="#fff" stroke="#e2e8f0"/>
  <text x="35" y="495" fill="#1e293b" font-family="Arial" font-size="13" font-weight="bold">5,000</text>
  <text x="200" y="460" fill="#64748b" font-family="Arial" font-size="10">数量 / 重量(kg)</text>
  <rect x="200" y="470" width="180" height="40" rx="6" fill="#fff" stroke="#e2e8f0"/>
  <text x="215" y="495" fill="#1e293b" font-family="Arial" font-size="13" font-weight="bold">1</text>
  <text x="350" y="495" text-anchor="middle" fill="#64748b" font-family="Arial" font-size="10">個 ▼</text>
  <rect x="20" y="640" width="360" height="56" rx="12" fill="#2563eb"/>
  <text x="200" y="675" text-anchor="middle" fill="#fff" font-family="Arial" font-size="14" font-weight="bold">実作業を完了</text>
</svg>`;

const svgTaskSchedule = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 600" width="1200" height="600">
  <rect width="1200" height="600" fill="#f8fafc"/>
  <text x="20" y="40" fill="#1e293b" font-family="Arial" font-size="20" font-weight="bold">作業スケジュール管理</text>
  <rect x="20" y="70" width="280" height="100" rx="8" fill="#fff" stroke="#e2e8f0"/>
  <text x="40" y="100" fill="#64748b" font-family="Arial" font-size="9" font-weight="bold">目標達成状況 (本日)</text>
  <text x="40" y="140" fill="#10b981" font-family="Arial" font-size="26" font-weight="bold">85.0%</text>
  <text x="40" y="160" fill="#94a3b8" font-family="Arial" font-size="10">完了 17 / 計画 20</text>
  <rect x="220" y="100" width="60" height="50" rx="4" fill="#10b981"/>
  <rect x="310" y="70" width="200" height="100" rx="8" fill="#fff" stroke="#e2e8f0"/>
  <text x="330" y="100" fill="#64748b" font-family="Arial" font-size="9" font-weight="bold">未割当タスクプール</text>
  <text x="330" y="140" fill="#1e293b" font-family="Arial" font-size="26" font-weight="bold">12 件</text>
  <circle cx="335" cy="160" r="3" fill="#ef4444"/>
  <text x="345" y="164" fill="#64748b" font-family="Arial" font-size="10">3 緊急 / 12 合計</text>
  <text x="20" y="200" fill="#94a3b8" font-family="Arial" font-size="11" font-weight="bold">TASK SELECTION POOL</text>
  <rect x="20" y="215" width="260" height="365" rx="8" fill="#fff" stroke="#e2e8f0"/>
  <rect x="30" y="230" width="50" height="22" rx="4" fill="#2563eb"/>
  <text x="55" y="246" text-anchor="middle" fill="#fff" font-family="Arial" font-size="9" font-weight="bold">全部 12</text>
  <rect x="85" y="230" width="50" height="22" rx="4" fill="#f1f5f9"/>
  <text x="110" y="246" text-anchor="middle" fill="#64748b" font-family="Arial" font-size="9" font-weight="bold">回収 4</text>
  <rect x="140" y="230" width="50" height="22" rx="4" fill="#f1f5f9"/>
  <text x="165" y="246" text-anchor="middle" fill="#64748b" font-family="Arial" font-size="9" font-weight="bold">商品化 5</text>
  <rect x="195" y="230" width="50" height="22" rx="4" fill="#fef3c7"/>
  <text x="220" y="246" text-anchor="middle" fill="#f59e0b" font-family="Arial" font-size="9" font-weight="bold">発送 3</text>
  <rect x="30" y="270" width="240" height="62" rx="6" fill="#fff" stroke="#e2e8f0"/>
  <rect x="30" y="270" width="240" height="20" rx="6" fill="#fee2e2"/>
  <text x="40" y="285" fill="#dc2626" font-family="Arial" font-size="9" font-weight="bold">緊急</text>
  <text x="40" y="306" fill="#1e293b" font-family="Arial" font-size="11" font-weight="bold">商品化 プリウス エンジン</text>
  <text x="40" y="322" fill="#64748b" font-family="Arial" font-size="9">⏱60分 / 数量: 1</text>
  <rect x="30" y="345" width="240" height="62" rx="6" fill="#fff" stroke="#e2e8f0"/>
  <text x="40" y="368" fill="#1e293b" font-family="Arial" font-size="11" font-weight="bold">分別 田中自動車 回収品</text>
  <text x="40" y="392" fill="#64748b" font-family="Arial" font-size="9">⏱90分 / 数量: 4</text>
  <text x="310" y="200" fill="#1e293b" font-family="Arial" font-size="16" font-weight="bold">📅 スケジュールボード</text>
  <rect x="800" y="190" width="80" height="28" rx="4" fill="#fff" stroke="#e2e8f0"/>
  <text x="840" y="208" text-anchor="middle" fill="#1e293b" font-family="Arial" font-size="11" font-weight="bold">Day</text>
  <rect x="890" y="190" width="80" height="28" rx="4" fill="#f1f5f9"/>
  <text x="930" y="208" text-anchor="middle" fill="#64748b" font-family="Arial" font-size="11">Week</text>
  <rect x="980" y="190" width="80" height="28" rx="4" fill="#f1f5f9"/>
  <text x="1020" y="208" text-anchor="middle" fill="#64748b" font-family="Arial" font-size="11">Month</text>
  <rect x="310" y="230" width="870" height="350" rx="8" fill="#fff" stroke="#e2e8f0"/>
  <text x="320" y="252" fill="#94a3b8" font-family="Arial" font-size="9" font-weight="bold">PERSONNEL</text>
  <text x="490" y="252" fill="#94a3b8" font-family="Arial" font-size="9" font-weight="bold">9:00</text>
  <text x="600" y="252" fill="#94a3b8" font-family="Arial" font-size="9" font-weight="bold">10:00</text>
  <text x="710" y="252" fill="#94a3b8" font-family="Arial" font-size="9" font-weight="bold">11:00</text>
  <text x="820" y="252" fill="#94a3b8" font-family="Arial" font-size="9" font-weight="bold">12:00</text>
  <text x="930" y="252" fill="#94a3b8" font-family="Arial" font-size="9" font-weight="bold">13:00</text>
  <text x="1040" y="252" fill="#94a3b8" font-family="Arial" font-size="9" font-weight="bold">14:00</text>
  <line x1="320" y1="260" x2="1170" y2="260" stroke="#e2e8f0"/>
  <text x="330" y="290" fill="#1e293b" font-family="Arial" font-size="11" font-weight="bold">作業員 一郎</text>
  <text x="330" y="305" fill="#64748b" font-family="Arial" font-size="9">大阪支店</text>
  <rect x="485" y="275" width="100" height="30" rx="6" fill="#ef4444"/>
  <text x="495" y="294" fill="#fff" font-family="Arial" font-size="9" font-weight="bold">商品化 60分</text>
  <rect x="595" y="275" width="100" height="30" rx="6" fill="#3b82f6"/>
  <text x="605" y="294" fill="#fff" font-family="Arial" font-size="9" font-weight="bold">分別 60分</text>
  <line x1="320" y1="320" x2="1170" y2="320" stroke="#e2e8f0"/>
  <text x="330" y="350" fill="#1e293b" font-family="Arial" font-size="11" font-weight="bold">作業員 太郎</text>
  <text x="330" y="365" fill="#64748b" font-family="Arial" font-size="9">大阪支店</text>
  <rect x="485" y="335" width="180" height="30" rx="6" fill="#3b82f6"/>
  <text x="495" y="354" fill="#fff" font-family="Arial" font-size="9" font-weight="bold">商品化 アクア 100分</text>
  <line x1="320" y1="380" x2="1170" y2="380" stroke="#e2e8f0"/>
  <text x="330" y="410" fill="#1e293b" font-family="Arial" font-size="11" font-weight="bold">回収員 三郎</text>
  <text x="330" y="425" fill="#64748b" font-family="Arial" font-size="9">大阪支店</text>
  <rect x="485" y="395" width="220" height="30" rx="6" fill="#10b981"/>
  <text x="495" y="414" fill="#fff" font-family="Arial" font-size="9" font-weight="bold">出張回収 120分</text>
</svg>`;

const svgBananaBay = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 600" width="1200" height="600">
  <rect width="1200" height="600" fill="#f8fafc"/>
  <text x="20" y="40" fill="#1e293b" font-family="Arial" font-size="20" font-weight="bold">🛒 BANANA BAY 出品管理</text>
  <rect x="20" y="70" width="800" height="160" rx="8" fill="#fff" stroke="#e2e8f0"/>
  <text x="40" y="100" fill="#1e293b" font-family="Arial" font-size="13" font-weight="bold">📈 出品・成約トレンド (直近7日間)</text>
  <polyline points="60,200 160,180 260,150 360,165 460,130 560,110 660,90" stroke="#94a3b8" stroke-width="2" fill="none"/>
  <polyline points="60,210 160,200 260,170 360,180 460,155 560,140 660,120" stroke="#3b82f6" stroke-width="2" fill="none"/>
  <circle cx="60" cy="200" r="3" fill="#94a3b8"/>
  <circle cx="160" cy="180" r="3" fill="#94a3b8"/>
  <circle cx="260" cy="150" r="3" fill="#94a3b8"/>
  <circle cx="360" cy="165" r="3" fill="#94a3b8"/>
  <circle cx="460" cy="130" r="3" fill="#94a3b8"/>
  <circle cx="560" cy="110" r="3" fill="#94a3b8"/>
  <circle cx="660" cy="90" r="3" fill="#94a3b8"/>
  <rect x="840" y="70" width="160" height="75" rx="8" fill="#fff" stroke="#e2e8f0"/>
  <text x="860" y="92" fill="#94a3b8" font-family="Arial" font-size="9" font-weight="bold">出品中</text>
  <text x="860" y="125" fill="#1e293b" font-family="Arial" font-size="24" font-weight="bold">45</text>
  <rect x="1010" y="70" width="170" height="75" rx="8" fill="#fff" stroke="#fecaca"/>
  <text x="1030" y="92" fill="#dc2626" font-family="Arial" font-size="9" font-weight="bold">エラー</text>
  <text x="1030" y="125" fill="#dc2626" font-family="Arial" font-size="24" font-weight="bold">2</text>
  <rect x="840" y="155" width="160" height="75" rx="8" fill="#fff" stroke="#fce7f3"/>
  <text x="860" y="177" fill="#e11d48" font-family="Arial" font-size="9" font-weight="bold">返品予約</text>
  <text x="860" y="210" fill="#1e293b" font-family="Arial" font-size="24" font-weight="bold">1</text>
  <rect x="1010" y="155" width="170" height="75" rx="8" fill="#fff" stroke="#d1fae5"/>
  <text x="1030" y="177" fill="#10b981" font-family="Arial" font-size="9" font-weight="bold">合計売上</text>
  <text x="1030" y="210" fill="#1e293b" font-family="Arial" font-size="20" font-weight="bold">¥1,250K</text>
  <rect x="20" y="250" width="1160" height="48" rx="8" fill="#fff" stroke="#e2e8f0"/>
  <rect x="40" y="262" width="240" height="24" rx="4" fill="#f1f5f9"/>
  <text x="55" y="278" fill="#94a3b8" font-family="Arial" font-size="11">🔍 出品ID、商品名、管理番号で検索...</text>
  <rect x="320" y="262" width="55" height="24" rx="12" fill="#1e293b"/>
  <text x="347" y="278" text-anchor="middle" fill="#fff" font-family="Arial" font-size="10" font-weight="bold">すべて</text>
  <rect x="385" y="262" width="65" height="24" rx="12" fill="#dcfce7"/>
  <text x="417" y="278" text-anchor="middle" fill="#10b981" font-family="Arial" font-size="10" font-weight="bold">出品中</text>
  <rect x="460" y="262" width="55" height="24" rx="12" fill="#fee2e2"/>
  <text x="487" y="278" text-anchor="middle" fill="#dc2626" font-family="Arial" font-size="10" font-weight="bold">エラー</text>
  <rect x="950" y="258" width="100" height="32" rx="6" fill="#fff" stroke="#e2e8f0"/>
  <text x="1000" y="278" text-anchor="middle" fill="#475569" font-family="Arial" font-size="11" font-weight="bold">🔄 API同期</text>
  <rect x="1060" y="258" width="120" height="32" rx="6" fill="#f97316"/>
  <text x="1120" y="278" text-anchor="middle" fill="#fff" font-family="Arial" font-size="11" font-weight="bold">🛒 新規一括出品</text>
  <rect x="20" y="320" width="1160" height="270" rx="8" fill="#fff" stroke="#e2e8f0"/>
  <rect x="20" y="320" width="1160" height="38" rx="8" fill="#f8fafc"/>
  <text x="60" y="343" fill="#94a3b8" font-family="Arial" font-size="9" font-weight="bold">出品ID / 管理番号</text>
  <text x="280" y="343" fill="#94a3b8" font-family="Arial" font-size="9" font-weight="bold">出品商品内容</text>
  <text x="650" y="343" fill="#94a3b8" font-family="Arial" font-size="9" font-weight="bold">ステータス</text>
  <text x="900" y="343" fill="#94a3b8" font-family="Arial" font-size="9" font-weight="bold">出品価格</text>
  <text x="1040" y="343" fill="#94a3b8" font-family="Arial" font-size="9" font-weight="bold">最終更新</text>
  <line x1="20" y1="358" x2="1180" y2="358" stroke="#e2e8f0"/>
  <text x="60" y="385" fill="#2563eb" font-family="Arial" font-size="11" font-weight="bold">BB-20250115-001</text>
  <text x="60" y="402" fill="#94a3b8" font-family="Arial" font-size="9">GP-20250101-001</text>
  <text x="280" y="385" fill="#1e293b" font-family="Arial" font-size="11" font-weight="bold">トヨタ プリウス エンジン</text>
  <text x="280" y="402" fill="#94a3b8" font-family="Arial" font-size="9">エンジン / Aランク</text>
  <rect x="650" y="375" width="70" height="20" rx="10" fill="#dcfce7"/>
  <text x="685" y="389" text-anchor="middle" fill="#10b981" font-family="Arial" font-size="9" font-weight="bold">出品中</text>
  <text x="900" y="385" fill="#1e293b" font-family="Arial" font-size="11" font-weight="bold">¥85,000</text>
  <text x="1040" y="385" fill="#64748b" font-family="Arial" font-size="10">2025-01-15 09:30</text>
  <line x1="20" y1="420" x2="1180" y2="420" stroke="#e2e8f0"/>
  <text x="60" y="445" fill="#2563eb" font-family="Arial" font-size="11" font-weight="bold">BB-20250114-005</text>
  <text x="60" y="462" fill="#94a3b8" font-family="Arial" font-size="9">GP-20241228-005</text>
  <text x="280" y="445" fill="#1e293b" font-family="Arial" font-size="11" font-weight="bold">アクア ドアミラー (右)</text>
  <text x="280" y="462" fill="#94a3b8" font-family="Arial" font-size="9">外装パーツ / Bランク</text>
  <rect x="650" y="435" width="70" height="20" rx="10" fill="#e0e7ff"/>
  <text x="685" y="449" text-anchor="middle" fill="#6366f1" font-family="Arial" font-size="9" font-weight="bold">売却済</text>
  <text x="900" y="445" fill="#1e293b" font-family="Arial" font-size="11" font-weight="bold">¥12,000</text>
  <text x="1040" y="445" fill="#64748b" font-family="Arial" font-size="10">2025-01-14 14:20</text>
  <line x1="20" y1="480" x2="1180" y2="480" stroke="#e2e8f0"/>
  <text x="60" y="505" fill="#2563eb" font-family="Arial" font-size="11" font-weight="bold">BB-20250113-008</text>
  <text x="280" y="505" fill="#1e293b" font-family="Arial" font-size="11" font-weight="bold">日産ノート ヘッドライト</text>
  <rect x="650" y="495" width="70" height="20" rx="10" fill="#fee2e2"/>
  <text x="685" y="509" text-anchor="middle" fill="#dc2626" font-family="Arial" font-size="9" font-weight="bold">エラー</text>
  <text x="900" y="505" fill="#1e293b" font-family="Arial" font-size="11" font-weight="bold">¥8,500</text>
  <text x="1040" y="505" fill="#64748b" font-family="Arial" font-size="10">2025-01-13 16:45</text>
</svg>`;

// ========================================================================
// ヘルパー関数
// ========================================================================

const BORDER = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
const BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 480, after: 240 },
    children: [new TextRun({ text, bold: true, size: 36, color: '1e293b' })],
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 320, after: 160 },
    children: [new TextRun({ text, bold: true, size: 28, color: '2563eb' })],
  });
}

function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, bold: true, size: 22, color: '1e293b' })],
  });
}

function p(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text, size: 22, ...opts })],
  });
}

function bullet(text) {
  return new Paragraph({
    numbering: { reference: 'bullets', level: 0 },
    spacing: { after: 80 },
    children: [new TextRun({ text, size: 22 })],
  });
}

function numbered(text) {
  return new Paragraph({
    numbering: { reference: 'numbers', level: 0 },
    spacing: { after: 80 },
    children: [new TextRun({ text, size: 22 })],
  });
}

function caption(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 60, after: 240 },
    children: [new TextRun({ text, italics: true, size: 18, color: '64748b' })],
  });
}

function svgImage(svgString, w, h) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 160, after: 80 },
    children: [
      new ImageRun({
        type: 'svg',
        data: Buffer.from(svgString),
        fallback: { type: 'png', data: Buffer.alloc(0) },
        transformation: { width: w, height: h },
        altText: { title: 'screenshot', description: 'screenshot', name: 'screenshot' },
      }),
    ],
  });
}

function tableRow(cells, isHeader = false) {
  return new TableRow({
    tableHeader: isHeader,
    children: cells.map(text => new TableCell({
      borders: BORDERS,
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      shading: isHeader ? { fill: 'DBEAFE', type: ShadingType.CLEAR } : undefined,
      children: [new Paragraph({ children: [new TextRun({ text, bold: isHeader, size: 20 })] })],
    })),
  });
}

function simpleTable(headers, rows, colWidths) {
  const totalWidth = colWidths.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: totalWidth, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [
      tableRow(headers, true),
      ...rows.map(r => tableRow(r, false)),
    ],
  });
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

// ========================================================================
// 取扱説明書の中身を組み立てる
// ========================================================================

const children = [];

// ===== 表紙 =====
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { before: 3000, after: 240 },
  children: [new TextRun({ text: '🔑', size: 96 })],
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { before: 240, after: 120 },
  children: [new TextRun({ text: 'サスティナブルガレージ', bold: true, size: 56, color: '1e293b' })],
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { before: 60, after: 120 },
  children: [new TextRun({ text: '業務管理システム', bold: true, size: 44, color: '2563eb' })],
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { before: 480, after: 120 },
  children: [new TextRun({ text: '取扱説明書', bold: true, size: 36, color: '475569' })],
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { before: 1200, after: 120 },
  children: [new TextRun({ text: '管理者向け・作業員向け・回収員向け', size: 22, color: '64748b' })],
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { before: 240 },
  children: [new TextRun({ text: 'Version 1.0  /  ' + new Date().toLocaleDateString('ja-JP'), size: 20, color: '94a3b8' })],
}));
children.push(pageBreak());

// ===== 目次 =====
children.push(h1('目次'));
[
  '1. はじめに',
  '   1.1 システム概要',
  '   1.2 動作環境',
  '   1.3 ユーザーロール',
  '',
  '2. 共通操作',
  '   2.1 ログイン',
  '   2.2 言語切替',
  '   2.3 ログアウト',
  '',
  '3. 管理者向け機能',
  '   3.1 ダッシュボード',
  '   3.2 在庫管理',
  '   3.3 回収業務管理',
  '   3.4 作業スケジュール管理',
  '   3.5 BANANA BAY 出品管理',
  '   3.6 勤怠・給与管理',
  '   3.7 売上管理',
  '   3.8 従業員・マスタ管理',
  '   3.9 月末買取明細',
  '',
  '4. 作業員向け機能',
  '   4.1 ホーム画面・勤怠',
  '   4.2 業務報告',
  '   4.3 マイスケジュール',
  '   4.4 休日・有給申請',
  '',
  '5. 回収員向け機能',
  '   5.1 ホーム画面',
  '   5.2 回収スケジュール',
  '   5.3 回収業務フロー (5ステップ)',
  '   5.4 電子受領書発行',
  '',
  '6. デモアカウント',
  '7. トラブルシューティング',
].forEach(line => {
  children.push(new Paragraph({
    spacing: { after: 60 },
    children: [new TextRun({ text: line, size: 22 })],
  }));
});
children.push(pageBreak());

// ===== 1. はじめに =====
children.push(h1('1. はじめに'));

children.push(h2('1.1 システム概要'));
children.push(p('サスティナブルガレージは、自動車パーツのリサイクル業務を一元管理するための Web アプリケーションです。回収・分別・商品化・出品・販売の一連の業務フローを、複数の役割（管理者・作業員・回収員）で分担しながらリアルタイムに連携できます。'));
children.push(h3('主な機能'));
[
  '回収業務管理：取引先からの出張回収案件の管理、電子受領書発行',
  '在庫管理：分別後の商品を「リユース / 資源 / リビルド」の3分類で管理',
  '作業スケジュール管理：ドラッグ＆ドロップでタスクを従業員にアサイン',
  'BANANA BAY 出品管理：出品・落札・出荷・返品処理の一貫管理',
  '勤怠・給与管理：シフト・休日・有給申請の承認フロー',
  '売上管理：チャネル別・拠点別の売上可視化',
  '月末買取明細：取引先別の月次明細書を PDF / Excel で出力',
  '多言語対応：日本語 / English / Монгол の3言語切替',
].forEach(t => children.push(bullet(t)));

children.push(h2('1.2 動作環境'));
children.push(simpleTable(
  ['項目', '推奨環境'],
  [
    ['ブラウザ', 'Google Chrome 最新版 / Safari 最新版'],
    ['画面解像度', '管理者: 1280×800 以上 / モバイル: スマートフォン 全般'],
    ['ネットワーク', 'インターネット接続必須 (Firebase Firestore 利用)'],
    ['認証', 'Firebase Authentication (メール + パスワード)'],
  ],
  [3000, 6360],
));

children.push(h2('1.3 ユーザーロール'));
children.push(simpleTable(
  ['ロール', '主な役割'],
  [
    ['管理者 (admin)', '全機能アクセス。ダッシュボード・在庫・スケジュール・売上等を統括管理'],
    ['作業員 (worker)', '商品化・分別作業の実施と作業報告。マイスケジュール確認'],
    ['回収員 (collector)', '出張回収業務の実施。電子受領書の発行・ルート案内'],
  ],
  [2500, 6860],
));
children.push(pageBreak());

// ===== 2. 共通操作 =====
children.push(h1('2. 共通操作'));

children.push(h2('2.1 ログイン'));
children.push(p('ブラウザでシステムの URL にアクセスすると、ログイン画面が表示されます。'));
children.push(svgImage(svgLogin, 480, 360));
children.push(caption('図 2-1: ログイン画面'));

children.push(h3('ログイン手順'));
[
  'メールアドレス欄に登録済みのメールアドレスを入力します。',
  'パスワード欄にパスワードを入力します。',
  '「ログイン →」ボタンをクリックします。',
  '認証に成功すると、ロールに応じたホーム画面に自動遷移します。',
].forEach(t => children.push(numbered(t)));

children.push(h3('パスワードを忘れた場合'));
[
  'ログイン画面の「パスワードを忘れた方」リンクをクリック。',
  'メールアドレスを入力し「再設定メールを送信」をクリック。',
  '登録メールアドレス宛にパスワード再設定リンクが届きます。',
  'リンクから新しいパスワードを設定してください。',
].forEach(t => children.push(numbered(t)));

children.push(h3('デモログイン (開発用)'));
children.push(p('ログイン画面下部の「DEMO」セクションには、デモアカウントへのワンクリックログインボタンが用意されています。「管理者でログイン」「作業員でログイン」「小田 でログイン」の3種類があります。'));

children.push(h2('2.2 言語切替'));
children.push(p('画面右上の言語スイッチャー（🌐 アイコン）から、以下3言語を切り替えできます:'));
[
  '🇯🇵 日本語 (デフォルト)',
  '🇺🇸 English',
  '🇲🇳 Монгол',
].forEach(t => children.push(bullet(t)));
children.push(p('選択した言語はブラウザの localStorage に保存され、次回ログイン時にも自動適用されます。'));

children.push(h2('2.3 ログアウト'));
children.push(p('管理者画面: 左サイドバーの下部「ログアウト」ボタンをクリック。'));
children.push(p('作業員・回収員画面: 「マイページ」タブ → 一番下の赤い「ログアウト」項目をタップ。'));
children.push(pageBreak());

// ===== 3. 管理者向け機能 =====
children.push(h1('3. 管理者向け機能'));

children.push(h2('3.1 ダッシュボード'));
children.push(p('管理者ホーム画面。全体概要 / 拠点データ比較 の 2 タブで構成され、リアルタイムに業務状況を把握できます。'));
children.push(svgImage(svgAdminDashboard, 600, 360));
children.push(caption('図 3-1: 管理者ダッシュボード（全体概要）'));

children.push(h3('表示される情報'));
[
  '滞留商品の警告: 5日以上ステータスが変わらない在庫の通知',
  '在庫・業務指標: 在庫総数 / 未登録在庫 / 本日完了タスク',
  'BANANA BAY 販売: 出品中・累計売却・本日売上・要対応の件数',
  '受領情報 (リアルタイム): 回収員から発行された電子受領書の最新一覧',
  '本日の作業進捗: 時間帯別の完了タスク数を棒グラフで表示',
  '在庫ステータス内訳: 未登録 / 商品化中 / 在庫あり / 販売済み の比率',
  'BANANA BAY 出品・成約トレンド: 直近7日間の折れ線グラフ',
  '直近のアクティビティ: 落札・出品・返品等の最新6件',
  '従業員稼働状況: 各従業員の進捗率・現在のタスクをリアルタイム表示',
  'メッセージ・業務連絡: 全体ブロードキャストまたは個別 DM',
].forEach(t => children.push(bullet(t)));

children.push(h3('拠点フィルタ'));
children.push(p('画面上部のドロップダウンで拠点を選択すると、選択した拠点のデータのみに絞り込まれます (例: 大阪支店)。'));

children.push(pageBreak());

children.push(h2('3.2 在庫管理'));
children.push(p('回収後に分別された商品を一元管理します。「リユース / 資源 / リビルド」の3分類で登録されます。'));

children.push(h3('画面構成'));
[
  '上部 KPI カード: 総在庫数 / BANANA BAY 出品中 / 未登録 / 売却済み (クリックで絞り込み)',
  '検索バー: 商品名・管理番号・部品番号・車種・型式 で検索',
  'ステータスフィルタ: 未登録 / 商品化中 / 在庫あり / 販売済み',
  '在庫テーブル: 管理番号・商品名・カテゴリ・ステータス・棚位置等を一覧表示',
  '操作ボタン: 在庫追加 / 編集 / 削除 / 詳細表示 / 一括CSV読込 / Excel出力',
].forEach(t => children.push(bullet(t)));

children.push(h3('在庫の新規登録'));
[
  '右上「新規登録」ボタンをクリック。',
  '管理番号は自動採番（GP-YYYYMMDD-NNN）。',
  '商品名・カテゴリ・棚位置・買取金額・品質ランク等を入力。',
  '「保存」をクリックして登録完了。',
].forEach(t => children.push(numbered(t)));

children.push(h3('在庫ステータスの遷移'));
children.push(p('未登録 → 商品化中（分別作業完了時）→ 在庫あり（商品化作業完了時）→ 販売済み（BANANA BAY で落札時）の順に自動遷移します。'));

children.push(h2('3.3 回収業務管理'));
children.push(p('取引先からの回収案件を管理します。「日次回収管理 / 月末締め・明細送付」の2モードあり。'));

children.push(h3('日次回収管理'));
[
  '本日の回収予定 / 受領完了（今月） / 未発行明細 の KPI 表示',
  '回収案件テーブル: 回収番号・顧客名・回収日・担当回収員・ステータス・書類発行・合計金額',
  '操作: 新規回収登録 / 回収完了マーク / 受領書・買取明細書プレビュー / 在庫登録 / Excel出力',
].forEach(t => children.push(bullet(t)));

children.push(h3('月末締め・明細送付'));
[
  '対象月を選択 (例: 2025年1月)。',
  '取引先別に集計された明細プレビューを確認。',
  '買取金額が未確定の品目があれば、その場で価格編集が可能。',
  '「一括メール送付」で全取引先に PDF 添付メールを送信（送付済みの取引先はスキップ）。',
  'Excel 出力で月次サマリ + 各取引先シートをまとめてダウンロード可能。',
].forEach(t => children.push(numbered(t)));

children.push(h2('3.4 作業スケジュール管理'));
children.push(p('未割当タスクを従業員にドラッグ＆ドロップで割り当て、リアルタイムでガントチャート風のボードに表示します。'));
children.push(svgImage(svgTaskSchedule, 600, 300));
children.push(caption('図 3-2: 作業スケジュール管理画面'));

children.push(h3('画面構成'));
[
  '上部 KPI: 目標達成状況 / 未割当タスクプール / 進捗予測グラフ',
  '左パネル: 未割当タスクプール (全部 / 回収品 / 未登録 / 商品化 / 発送 でフィルタ)',
  '右パネル: スケジュールボード (Day / Week / Month 切替可能)',
  '右上アクション: 通知送信 / 解析出力',
].forEach(t => children.push(bullet(t)));

children.push(h3('タスク割当の流れ'));
[
  '左の未割当タスクプールから、割り当てたいタスクをドラッグ。',
  '右のスケジュールボード上の従業員 × 時間帯のセルにドロップ。',
  '自動的にタスクのステータスが「割当済」になり、対象従業員のホーム画面にも反映。',
  '既に配置済みのタスクは、クリックで編集（時間変更）またはドラッグで再配置可能。',
].forEach(t => children.push(numbered(t)));

children.push(h3('自由タスク追加'));
children.push(p('左パネル下部「自由タスク追加」ボタンから、在庫に紐付かないカスタムタスクを作成できます。担当者・日時・所要時間を指定して直接派遣することも、未割当プールに追加することも可能です。'));

children.push(pageBreak());

children.push(h2('3.5 BANANA BAY 出品管理'));
children.push(p('外部マーケットプレイス「BANANA BAY」への出品・落札・出荷・返品処理を一元管理します。'));
children.push(svgImage(svgBananaBay, 600, 300));
children.push(caption('図 3-3: BANANA BAY 出品管理画面'));

children.push(h3('タブ構成'));
[
  '出品管理: 出品中・売却済・エラー・返品 を一覧管理',
  '出荷管理: 落札済み案件の出荷タスクを管理',
].forEach(t => children.push(bullet(t)));

children.push(h3('API同期 (落札取込み)'));
[
  '画面右上「🔄 API同期」ボタンをクリック。',
  '約 1.2 秒の擬似ネットワーク遅延後、BANANA BAY API から落札情報を取得。',
  '新規落札があれば、発送先情報と出荷タスクを自動生成。',
  '取り込み件数と例（商品名）がトースト通知で表示されます。',
].forEach(t => children.push(numbered(t)));

children.push(h3('落札処理 (個別)'));
children.push(p('出品中のアイテムを手動で「落札処理」する場合は、アクションメニュー（⋮）から「落札処理」を選択。発送先情報がモックデータから自動付与され、出荷業務タスクが生成されます。'));

children.push(h3('返品処理'));
[
  '売却済みアイテムの「アクション」メニュー → 「返品を受け付ける」を選択。',
  '返品理由 (商品不具合・破損 / 注文と異なる / 記載と相違 / お客様都合 / その他) を選択。',
  '備考と返送時の追跡番号を入力し「登録」。',
  '在庫が「返品受付」状態になり、後日「返品処理を進める」で在庫戻しを完了。',
].forEach(t => children.push(numbered(t)));

children.push(h2('3.6 勤怠・給与管理'));
children.push(p('従業員の出勤状況・シフト・給与集計を管理します。'));

children.push(h3('タブ構成'));
[
  'シフト・カレンダー: 月次カレンダーで各日の出勤予定者・休日者を表示。日付セルをクリックで休日追加',
  'シフト管理: 申告された休日・有給・シフト変更を承認/却下',
  '出退勤履歴: 各従業員の打刻記録（出勤・退勤・休憩・実働）',
  '給与・統計集計: 締め期間ごとの給与計算サマリ・人件費構成比・拠点効率',
].forEach(t => children.push(bullet(t)));

children.push(h3('締め期間'));
children.push(p('給与計算の締め日は「前月21日〜当月20日」の月次サイクルで自動算出されます。'));

children.push(h2('3.7 売上管理'));
children.push(p('チャネル別・拠点別・カテゴリ別の売上を可視化します。'));
[
  'KPI: 今月の売上高 / 売上総利益 / 未入金合計 / 販売済み点数',
  'タブ: 利益・推移分析 / 販売履歴 / 見積・請求',
  '売上記録: 在庫商品から販売品を選択し、価格 + チャネルを入力して登録',
  '月次決算報告: 過去4ヶ月の売上 vs 利益の推移グラフと、月次 Excel エクスポート',
].forEach(t => children.push(bullet(t)));

children.push(h2('3.8 従業員・マスタ管理'));
children.push(p('従業員・拠点・業務マスタ・取引先マスタを統合管理します。'));

children.push(h3('タブ構成'));
[
  '従業員一覧: 名前 / 役職 / 所属拠点 / 就業時間 / ステータス',
  '拠点一覧: 各拠点の基本情報と所属従業員数',
  '評価・モチベーション: 従業員の作業効率・モチベーションスコア',
  '作業マスタ: タスクの種類 (tm6 分別 / tm7 出張回収 / tm8 商品化 / tm9 出荷) と標準時間・基本料金',
  '取引先マスタ: 引取先企業の連絡先・送料設定',
].forEach(t => children.push(bullet(t)));

children.push(h3('従業員の新規登録'));
[
  '右上「従業員登録・修正」ボタンをクリック。',
  '名前・電話番号・メール・役割 (worker/collector/admin)・入社日・所属拠点を入力。',
  '就業時間（平日・土曜・日曜の開始/終了時刻 + 出勤スイッチ）を設定。',
  '「登録する」をクリックして完了。',
].forEach(t => children.push(numbered(t)));

children.push(h2('3.9 月末買取明細'));
children.push(p('月末締めで取引先別に買取明細書を発行・メール送付します。'));
[
  '対象月を選択 (yyyy-mm 形式の月選択カレンダー)。',
  '集計サマリ: 取引先数 / 未発送件数 / 当月買取総額',
  '取引先別の明細プレビュー: 全品目の買取金額が確定済みなら発行可能',
  'インライン価格編集: プレビュー右上「価格を編集」ボタンで未確定品目の金額を直接入力',
  '送付方法: 個別メール送付 / 一括メール送付 / PDF ダウンロード / CSV ダウンロード',
  '請求書モード: 差引額がマイナスの場合は自動的に「ご請求書」として出力',
].forEach(t => children.push(bullet(t)));
children.push(pageBreak());

// ===== 4. 作業員向け機能 =====
children.push(h1('4. 作業員向け機能'));

children.push(h2('4.1 ホーム画面・勤怠'));
children.push(p('作業員ログイン後の最初の画面。本日のタスクと勤怠操作にすぐアクセスできます。'));
children.push(svgImage(svgEmployeeHome, 320, 576));
children.push(caption('図 4-1: 作業員ホーム画面'));

children.push(h3('勤怠操作'));
[
  '緑のグラデーションヘッダーに本日の稼働時間が表示されます。',
  '「🟢 出勤 / 作業中」ボタン: 出勤打刻 → 作業中状態に切替',
  '「☕ 休憩」ボタン: 休憩状態に切替（稼働時間が一時停止）',
  '「業務再開」ボタン: 休憩から復帰',
  '「退勤」ボタン: 退勤打刻',
].forEach(t => children.push(bullet(t)));

children.push(h3('本日のタスク'));
children.push(p('管理者から割り当てられたタスクが時系列で表示されます。各タスクには以下が表示されます:'));
[
  '優先度を示す色付きのサイドバー (赤=緊急 / 青=中 / グレー=低)',
  'タスク名 (例: 商品化 トヨタ プリウス エンジン)',
  '場所 (例: 第2センター / Aブロック)',
  '時間帯と所要時間 (例: 09:00〜10:00 (60分))',
  '数量',
  '「詳細を確認」ボタン: タスク詳細ダイアログを開く',
].forEach(t => children.push(bullet(t)));

children.push(h3('完了タスク・獲得ボーナス'));
children.push(p('画面下部のカードに、本日完了したタスク数と獲得したボーナス額、目標までの残額が表示されます。'));

children.push(pageBreak());

children.push(h2('4.2 業務報告'));
children.push(p('完了したタスクの作業内容を3ステップで報告します。'));
children.push(svgImage(svgWorkerReport, 320, 576));
children.push(caption('図 4-2: 業務報告画面 (ステップ 2 - 実作業)'));

children.push(h3('Step 1: 開始確認'));
[
  '報告する業務タイプを選択: 回収業務 / 荷下・分別 / 商品化作業',
  '対象在庫の情報（商品名・管理番号・優先度）を確認',
  '「作業を開始する」ボタンで次へ',
].forEach(t => children.push(numbered(t)));

children.push(h3('Step 2: 実作業'));
children.push(p('業務タイプにより入力項目が変わります:'));
children.push(p('【回収業務の場合】顧客名 / 回収実費 / 品目数 / 回収場所の詳細を入力。', { bold: true }));
children.push(p('【荷下・分別の場合】3分類設定 (リユース / 資源 / リビルド) → 商品情報 (買取金額 / 数量 or 重量)。', { bold: true }));
children.push(p('【商品化作業の場合】商品化チェックリスト (清掃 / 検品 / 写真撮影 / 梱包) → 品質ランク (S/A/B/C) + 保管棚番号。', { bold: true }));

children.push(h3('Step 3: 完了報告'));
[
  '完了写真を撮影 (タップで撮影モック)',
  '獲得見込評価額が自動表示されます',
  '「報告を送信して完了」で完了',
  'ホーム画面のステータスが「完了」に更新',
].forEach(t => children.push(numbered(t)));

children.push(h3('作業履歴の確認・編集'));
children.push(p('上部「作業履歴の確認・編集」タブから、過去の報告を確認できます。「承認済み」のステータスは管理者承認済み。「確認中」は未承認状態。「内容を修正」ボタンで再編集可能です。'));

children.push(h2('4.3 マイスケジュール'));
children.push(p('自分の出勤予定とタスク予定を確認できる画面です。'));
[
  '週表示 / 月表示 切替',
  '日付選択で当日のタスク一覧を表示',
  '当日の出勤ステータス表示: シフト承認済 / 休日承認済 / 祝日 / 通常出勤',
  '想定総作業時間と評価見込額のサマリ',
  '申告履歴: 過去の休日・有給・シフト申告とそのステータス（承認待ち / 承認済 / 却下）',
].forEach(t => children.push(bullet(t)));

children.push(h2('4.4 休日・有給申請'));
children.push(p('マイスケジュール画面上部の「休日申請」「有給申請」ボタンから申請できます。'));

children.push(h3('休日申請の手順'));
[
  '対象日を選択。',
  '「休日申請」ボタンをタップ。',
  'ダイアログで対象日を確認、理由（任意）を入力。',
  '「申請する」をタップ → 承認待ち状態で送信。',
  '管理者が承認するとシフトが取り消されます。',
].forEach(t => children.push(numbered(t)));

children.push(h3('有給申請の手順'));
children.push(p('「有給申請」ボタンから同様の流れで申請。承認されると有給休暇として記録されます。'));

children.push(h3('申告の取り下げ'));
children.push(p('申告履歴の各項目右側の 🗑 アイコンで、承認待ちの申告を取り下げできます。承認済みの場合は管理者経由でのみ取消可能。'));
children.push(pageBreak());

// ===== 5. 回収員向け機能 =====
children.push(h1('5. 回収員向け機能'));

children.push(h2('5.1 ホーム画面'));
children.push(p('回収員ログイン後のホーム画面。作業員と同じく勤怠操作と本日の案件一覧が表示されます。'));

children.push(h2('5.2 回収スケジュール'));
children.push(p('本日担当する回収案件をリスト/マップで確認します。'));
[
  '拠点起点の選択 (大阪支店 / 和歌山支店 / 滋賀支店)',
  '週/月カレンダーで日付選択',
  '最適ルート: 起点からの最短経路を貪欲法で算出 → Google Map で一括案内',
  '想定走行距離・件数を表示',
  '休日申請 / 有給申請ボタン',
].forEach(t => children.push(bullet(t)));

children.push(h3('リスト表示'));
children.push(p('各案件カードには以下が表示されます: 順番（1, 2, 3...）/ 顧客名 / 回収番号 / 住所 / 電話番号 / 品目数 / 送料あり/なし。'));
children.push(p('各カードには「Map」（個別ルート案内）「作業開始」（5ステップワークフロー開始）の2ボタン。'));

children.push(h3('マップ表示'));
children.push(p('地図上に各案件のピンと番号を表示。ピンをタップすると詳細ポップアップが出て、そこから直接「作業開始」「ルート案内」を呼び出せます。'));

children.push(h2('5.3 回収業務フロー (5ステップ)'));
children.push(p('案件カードの「作業開始」ボタンから始まる、5ステップの統合ワークフロー画面です。'));
children.push(svgImage(svgCollectorWorkflow, 600, 300));
children.push(caption('図 5-1: 回収業務 5ステップフロー'));

children.push(h3('Step 1: 目的地への案内'));
[
  '回収先の地図 (Google Maps 埋め込み) を表示',
  '回収住所・電話番号を表示',
  '「Google Mapで案内開始」ボタン: 外部 Google Maps アプリでナビ開始',
  '「現場に到着確認」ボタン: 到着を記録してステータスを「受領」に変更',
].forEach(t => children.push(bullet(t)));

children.push(h3('Step 2: 回収品目チェック'));
[
  '事前登録された回収品目を一覧表示',
  '各品目をその場で編集可能（商品名・数量・重量・備考）',
  '「品目を追加」ボタンで新規追加',
  '「点検完了・次へ」で次のステップへ',
].forEach(t => children.push(bullet(t)));

children.push(h3('Step 3: 写真撮影'));
[
  'タップで擬似撮影 (実機ではカメラ起動)',
  '撮影した写真は受領書に添付されます',
  '複数枚撮影可能',
  '「撮影完了・次へ」で次のステップへ',
].forEach(t => children.push(bullet(t)));

children.push(h3('Step 4: 電子受領書・署名'));
[
  '受領書プレビュー: 回収番号 / 回収日時 / 合計品目 / 合計重量',
  '※ 買取金額は拠点での分別作業完了後に確定するため、ここでは記載されません',
  'お客様氏名を入力',
  '署名エリアをタップして電子署名を取得',
  '「電子受領書を発行」で発行 → 管理者画面の「受領情報」に即時反映',
].forEach(t => children.push(bullet(t)));

children.push(h3('Step 5: 回収完了'));
[
  '電子受領書発行完了の確認画面',
  'ステータスが「回収完了」に更新',
  '「次の案件へ」ボタンで次の回収先へ',
].forEach(t => children.push(bullet(t)));

children.push(h2('5.4 電子受領書発行'));
children.push(p('Step 4 で発行された電子受領書は、以下の場所から確認・印刷できます:'));
[
  '回収員側: ワークフロー Step 4 のプレビュー（リアルタイム）',
  '管理者側: 管理者ダッシュボード「受領情報 (リアルタイム)」カード',
  '管理者側: 回収業務管理 → 「電子受領書 (N)」ボタンから全件一覧',
].forEach(t => children.push(bullet(t)));
children.push(p('受領書には金額は記載されません。買取金額は拠点での分別作業完了時に確定し、後日「買取明細書」として別途発行されます。', { italics: true, color: '64748b' }));
children.push(pageBreak());

// ===== 6. デモアカウント =====
children.push(h1('6. デモアカウント'));
children.push(p('開発・検証用に以下のデモアカウントが用意されています:'));
children.push(simpleTable(
  ['ロール', 'メールアドレス', 'ログイン方法'],
  [
    ['管理者', 'admin@example.com', 'ログイン画面の「管理者でログイン」ボタン'],
    ['作業員', 'worker1@example.com', 'ログイン画面の「作業員でログイン」ボタン'],
    ['作業員 (小田)', 'herlen0976@banana-official.com', 'ログイン画面の緑の「小田 でログイン」ボタン'],
  ],
  [2200, 4500, 2660],
));
children.push(p('本番環境では、これらのデモボタンを無効化してください。', { bold: true, color: 'dc2626' }));
children.push(pageBreak());

// ===== 7. トラブルシューティング =====
children.push(h1('7. トラブルシューティング'));

children.push(h2('7.1 よくある質問'));

children.push(h3('Q. ログインできない'));
[
  'メールアドレス・パスワードのスペルを確認してください',
  'Firebase Authentication で承認済みドメインが許可されているか確認 (Firebase Console)',
  'ブラウザのキャッシュ・Cookie をクリアして再試行',
  'パスワードを忘れた場合は「パスワードを忘れた方」リンクから再設定',
].forEach(t => children.push(bullet(t)));

children.push(h3('Q. データが反映されない'));
[
  'インターネット接続を確認',
  'ブラウザを再読み込み (Cmd + R / Ctrl + R)',
  'Firebase Console で Firestore に書き込みエラーが出ていないか確認',
].forEach(t => children.push(bullet(t)));

children.push(h3('Q. 言語切替が効かない'));
[
  '画面右上の 🌐 アイコンをクリックしてから言語を選択',
  'ブラウザの localStorage が無効化されていないか確認 (プライベートブラウジングでは保存されません)',
].forEach(t => children.push(bullet(t)));

children.push(h3('Q. スケジュール画面でドラッグできない'));
[
  'デスクトップ環境では問題なく動作します',
  'モバイル端末では現在ドラッグ操作は非対応です。「自由タスク追加」から直接担当者指定で派遣してください',
].forEach(t => children.push(bullet(t)));

children.push(h3('Q. 電子受領書がプリントできない'));
[
  '電子受領書プレビューで右上の印刷アイコンをクリック',
  'ブラウザの印刷ダイアログで「PDFに保存」を選択するとPDF化できます',
].forEach(t => children.push(bullet(t)));

children.push(h2('7.2 サポート連絡先'));
children.push(p('システムに関するお問い合わせは、以下までご連絡ください:'));
[
  'メール: support@sustainable-garage.example.com',
  '電話: 各拠点の管理者まで',
  '受付時間: 平日 9:00 - 18:00',
].forEach(t => children.push(bullet(t)));

children.push(new Paragraph({
  spacing: { before: 480, after: 240 },
  alignment: AlignmentType.CENTER,
  children: [new TextRun({ text: '— 取扱説明書 終わり —', size: 22, italics: true, color: '94a3b8' })],
}));

// ========================================================================
// ドキュメント生成
// ========================================================================

const doc = new Document({
  creator: 'Sustainable Garage',
  title: '取扱説明書',
  description: '業務管理システム取扱説明書',
  styles: {
    default: {
      document: {
        run: { font: 'メイリオ', size: 22 },
      },
    },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 36, bold: true, font: 'メイリオ', color: '1e293b' },
        paragraph: { spacing: { before: 480, after: 240 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 28, bold: true, font: 'メイリオ', color: '2563eb' },
        paragraph: { spacing: { before: 320, after: 160 }, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 22, bold: true, font: 'メイリオ', color: '1e293b' },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 2 } },
    ],
  },
  numbering: {
    config: [
      { reference: 'bullets',
        levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: 'numbers',
        levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    ],
  },
  sections: [{
    properties: {
      page: {
        size: { width: 11906, height: 16838 }, // A4
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
      },
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: 'サスティナブルガレージ業務管理システム  取扱説明書', size: 18, color: '94a3b8' })],
        })],
      }),
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: '- ', size: 18, color: '94a3b8' }),
            new TextRun({ children: [PageNumber.CURRENT], size: 18, color: '94a3b8' }),
            new TextRun({ text: ' -', size: 18, color: '94a3b8' }),
          ],
        })],
      }),
    },
    children,
  }],
});

const outputPath = path.join(__dirname, '取扱説明書.docx');
Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(outputPath, buf);
  console.log('✅ 取扱説明書を生成しました:', outputPath);
  console.log('   ファイルを開く: open "' + outputPath + '"');
}).catch(err => {
  console.error('❌ エラー:', err);
  process.exit(1);
});
