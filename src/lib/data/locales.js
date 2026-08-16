/* ====== 언어별 URL 규칙 ======
   서버(프리렌더 로더·sitemap)와 브라우저(컴포넌트) 양쪽에서 쓰이므로
   $lib/server/ 가 아니라 여기에 둔다. ($lib/server/ 는 브라우저 import 가 금지됨) */
import { nodeHref } from './collections.js';
import { translate } from '$lib/i18n/translations.js';

/* 한국어는 접두어 없이 기존 URL 을 그대로 쓰고(이미 색인된 URL 보존),
   나머지 언어만 /en, /ja, /ru, /zh 접두어를 붙인다. */
export const PAGE_LOCALES = ['ko', 'en', 'ja', 'ru', 'zh'];
export const PREFIXED_LOCALES = PAGE_LOCALES.filter((l) => l !== 'ko');

export function localePrefix(locale) {
	return locale === 'ko' ? '' : `/${locale}`;
}

/* 컬렉션 색인 경로 (/towns/ , /en/towns/ …) */
export function localeCollectionHref(locale, collectionSlug) {
	return `${localePrefix(locale)}/${collectionSlug}/`;
}

/* 노드 상세 경로 (/towns/<slug>/ , /en/towns/<slug>/ …).
   slug 는 한국어 이름에서 만든 값을 모든 언어가 공유한다 — 언어마다 slug 가 달라지면
   hreflang 대응 관계와 관계망 링크가 전부 깨진다. */
export function localeNodeHref(locale, node) {
	const href = nodeHref(node);
	if (!href) return null;
	return `${localePrefix(locale)}${href}`;
}

/* 컬렉션의 표시 제목·설명을 해당 언어로 */
export function collectionTitle(locale, slug) {
	return translate(locale, `arch.title.${slug}`);
}
export function collectionDesc(locale, slug) {
	return translate(locale, `arch.desc.${slug}`);
}
