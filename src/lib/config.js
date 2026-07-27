// 앱 설정 — 기존 window.APP_CONFIG / env-config.js 를 대체.
// Vite 빌드 시 import.meta.env 로 주입 (미설정 시 빈 문자열).
export const spreadsheetId = import.meta.env.VITE_SPREADSHEET_ID ?? '';
export const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY ?? '';

// 정식 도메인 (canonical/og:url/sitemap 생성 기준). 커스텀 도메인으로 옮기면 여기만 바꾼다.
export const siteUrl = (
	import.meta.env.VITE_SITE_URL ?? 'https://korean-towns-db.vercel.app'
).replace(/\/$/, '');

/* 사이트 절대 URL 생성. path 는 '/map/' 처럼 슬래시로 시작. */
export function absUrl(path = '/') {
	return siteUrl + (path.startsWith('/') ? path : '/' + path);
}
