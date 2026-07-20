// 앱 설정 — 기존 window.APP_CONFIG / env-config.js 를 대체.
// Vite 빌드 시 import.meta.env 로 주입 (미설정 시 빈 문자열).
export const spreadsheetId = import.meta.env.VITE_SPREADSHEET_ID ?? '';
export const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY ?? '';
