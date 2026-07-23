// 다국어(i18n) 상태 및 헬퍼 — Svelte 5 runes 기반.
// 브라우저 기본 언어를 감지해 ko/en/ja/ru/zh 중 하나로 초기화하고,
// 사용자가 고른 언어는 localStorage 에 보존한다.
import { browser } from '$app/environment';
import { translations } from './translations.js';

export const SUPPORTED = ['ko', 'en', 'ja', 'ru', 'zh'];
export const DEFAULT_LOCALE = 'ko';

export const LOCALE_NAMES = {
	ko: '한국어',
	en: 'English',
	ja: '日本語',
	ru: 'Русский',
	zh: '中文'
};

const STORAGE_KEY = 'ktdb-lang';

function detectInitial() {
	if (!browser) return DEFAULT_LOCALE;
	try {
		const saved = localStorage.getItem(STORAGE_KEY);
		if (saved && SUPPORTED.includes(saved)) return saved;
	} catch {
		/* localStorage 접근 불가 시 무시 */
	}
	const navLangs = navigator.languages && navigator.languages.length
		? navigator.languages
		: [navigator.language || DEFAULT_LOCALE];
	for (const nl of navLangs) {
		const base = String(nl).toLowerCase().split('-')[0];
		if (SUPPORTED.includes(base)) return base;
	}
	return DEFAULT_LOCALE;
}

// SSR과 첫 클라이언트 렌더를 일치시키기 위해 항상 기본값(ko)으로 시작한다.
// 하이드레이션 직후 initLocale() 이 감지 언어로 전환하며, 이때 상태 변경이
// {@html} 블록까지 확실히 다시 렌더한다(하이드레이션 불일치 방지).
let locale = $state(DEFAULT_LOCALE);

export function getLocale() {
	return locale;
}

export function setLocale(next) {
	if (!SUPPORTED.includes(next)) return;
	locale = next;
	if (browser) {
		try {
			localStorage.setItem(STORAGE_KEY, next);
		} catch {
			/* 무시 */
		}
		document.documentElement.lang = next;
	}
}

// 루트 레이아웃 onMount 에서 호출 — 하이드레이션 이후 브라우저 언어로 전환.
export function initLocale() {
	if (!browser) return;
	setLocale(detectInitial());
}

/* 번역 조회. 누락 시 기본 언어 → 키 순으로 폴백.
   params 로 {name} 형태 플레이스홀더 치환 지원. */
export function t(key, params) {
	const dict = translations[locale] || translations[DEFAULT_LOCALE];
	let str = dict[key];
	if (str == null) str = translations[DEFAULT_LOCALE][key];
	if (str == null) return key;
	if (params) {
		for (const p in params) {
			str = str.split('{' + p + '}').join(String(params[p]));
		}
	}
	return str;
}

/* 데이터 내부 키(마을/조직/인물/사건)를 현재 언어 표시 라벨로.
   마을은 settlementType(타운/빌리지)에 따라 세분화 가능. */
export function typeLabel(type, settlementType) {
	if (type === '마을') {
		if (settlementType === '빌리지') return t('settlement.village');
		if (settlementType === '타운') return t('settlement.town');
		return t('type.town');
	}
	if (type === '조직') return t('type.org');
	if (type === '인물') return t('type.person');
	if (type === '사건') return t('type.event');
	return type;
}

/* 위치 확실성 등급의 표시 라벨/설명 (precision.js 의 키 기준) */
export function precisionLabel(key) {
	return t('precision.' + (key || 'unknown') + '.label');
}
export function precisionDesc(key) {
	return t('precision.' + (key || 'unknown') + '.desc');
}
