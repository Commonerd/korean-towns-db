/* ====== 아카이브 페이지 공용 로더 ======
   같은 페이지를 언어 수만큼 프리렌더하므로, 한국어 라우트(/towns/…)와
   언어별 라우트(/en/towns/… 등)가 이 모듈 하나를 공유한다.
   (로직이 두 벌로 갈라지면 언어별로 내용이 어긋나기 시작한다) */
import { error } from '@sveltejs/kit';
import { COLLECTIONS, collectionBySlug } from '$lib/data/collections.js';
import { nodesOfType, relationsFor, summarize, yearRangeText } from '$lib/data/relations.js';
import { PRECISION_INFO } from '$lib/data/precision.js';
import { loadNodeIndex } from '$lib/server/nodes.js';
import {
	translateType,
	translatePrecisionLabel,
	translatePrecisionDesc,
	localized
} from '$lib/i18n/translations.js';
import {
	PAGE_LOCALES,
	PREFIXED_LOCALES,
	localeNodeHref,
	collectionTitle,
	collectionDesc
} from '$lib/data/locales.js';

/* 라우트 파일들이 archive.js 하나만 import 해도 되도록 재수출 */
export { PAGE_LOCALES, PREFIXED_LOCALES };

/* 분류별 건수 (아카이브 헤더의 배지) */
function countsOf(index) {
	return Object.fromEntries(COLLECTIONS.map((c) => [c.slug, nodesOfType(index, c.type).length]));
}


/* ====== 색인 페이지(/towns/ 등) ====== */
export async function loadCollectionPage(collectionSlug, locale) {
	const collection = collectionBySlug(collectionSlug);
	if (!collection) error(404, '없는 분류입니다.');

	const { index } = await loadNodeIndex();

	const items = nodesOfType(index, collection.type)
		.filter((n) => n.slug)
		.map((n) => ({
			slug: n.slug,
			name: localized(n, 'name', locale),
			href: localeNodeHref(locale, n),
			years: yearRangeText(n),
			summary: summarize(n, 110, locale),
			relatedTown: n.type === '마을' ? '' : n.relatedTownAll || n.relatedTown || '',
			/* '타운/빌리지'는 데이터 내부 키라 그대로 쓰면 안 된다 — 표시 라벨로 변환 */
			settlementType: n.settlementType ? translateType(locale, '마을', n.settlementType) : '',
			orgType: n.orgType || '',
			job: n.job || '',
			nationality: n.nationality || '',
			eventType: n.eventType || ''
		}))
		.sort((a, b) => a.name.localeCompare(b.name, locale));

	return {
		locale,
		collection: {
			slug: collection.slug,
			type: collection.type,
			color: collection.color,
			schemaType: collection.schemaType,
			title: collectionTitle(locale, collection.slug),
			desc: collectionDesc(locale, collection.slug)
		},
		items,
		counts: countsOf(index)
	};
}

/* ====== 상세 페이지(/towns/<slug>/ 등) ====== */
export async function loadNodePage(collectionSlug, slug, locale) {
	const collection = collectionBySlug(collectionSlug);
	if (!collection) error(404, '없는 분류입니다.');

	const { index } = await loadNodeIndex();
	const siblings = nodesOfType(index, collection.type)
		.filter((n) => n.slug)
		.sort((a, b) => a.name.localeCompare(b.name, 'ko'));

	const pos = siblings.findIndex((n) => n.slug === slug);
	if (pos === -1) error(404, `'${slug}' 항목을 찾을 수 없습니다.`);
	const node = siblings[pos];

	const precisionKey = node.locationPrecision || 'unknown';
	// PRECISION_INFO 는 한국어 원문 사전 — 실제 표시는 언어별 번역 키를 쓴다.
	const precisionFallback = PRECISION_INFO[precisionKey] ?? PRECISION_INFO.unknown;

	return {
		locale,
		collection: {
			slug: collection.slug,
			type: collection.type,
			color: collection.color,
			schemaType: collection.schemaType,
			title: collectionTitle(locale, collection.slug)
		},
		counts: countsOf(index),
		node: {
			slug: node.slug,
			name: localized(node, 'name', locale),
			/* 한국어 원문 이름 — 지도 포커스 링크·구조화 데이터의 원표기용으로 보존 */
			nameKo: node.name,
			type: node.type,
			settlementType: node.settlementType || '',
			description: localized(node, 'description', locale),
			summary: summarize(node, 155, locale),
			years: yearRangeText(node),
			founded: node.founded || '',
			dissolved: node.dissolved || '',
			lat: node.lat || 0,
			lng: node.lng || 0,
			address: node.address || '',
			source: node.source || '',
			author: node.author || '',
			updater: node.updater || '',
			changeNote: node.changeNote || '',
			orgType: node.orgType || '',
			job: node.job || '',
			nationality: node.nationality || '',
			eventType: node.eventType || '',
			locationBasis: node.locationBasis || '',
			certaintyScore: node.certaintyScore ?? 0,
			precisionKey,
			precisionLabel: translatePrecisionLabel(locale, precisionKey) || precisionFallback.label,
			precisionDesc: translatePrecisionDesc(locale, precisionKey) || precisionFallback.desc
		},
		relations: relationsFor(node, index, locale),
		prev:
			pos > 0
				? {
						name: localized(siblings[pos - 1], 'name', locale),
						href: localeNodeHref(locale, siblings[pos - 1])
					}
				: null,
		next:
			pos < siblings.length - 1
				? {
						name: localized(siblings[pos + 1], 'name', locale),
						href: localeNodeHref(locale, siblings[pos + 1])
					}
				: null
	};
}

/* 프리렌더 대상 목록 — 모든 노드 × (해당 라우트가 담당하는 언어) */
export async function allNodeEntries() {
	const { index } = await loadNodeIndex();
	const out = [];
	for (const c of COLLECTIONS) {
		for (const n of nodesOfType(index, c.type)) {
			if (n.slug) out.push({ collection: c.slug, slug: n.slug });
		}
	}
	return out;
}
