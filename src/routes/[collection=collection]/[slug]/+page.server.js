import { error } from '@sveltejs/kit';
import { COLLECTIONS, collectionBySlug, nodeHref } from '$lib/data/collections.js';
import { nodesOfType, relationsFor, summarize, yearRangeText } from '$lib/data/relations.js';
import { PRECISION_INFO } from '$lib/data/precision.js';
import { loadNodeIndex } from '$lib/server/nodes.js';

export const prerender = true;

/* 프리렌더 대상: 모든 노드의 상세 페이지.
   loadNodeIndex() 가 메모이즈되어 있어 시트는 빌드당 1회만 내려받는다. */
export async function entries() {
	const { index } = await loadNodeIndex();
	const out = [];
	for (const c of COLLECTIONS) {
		for (const n of nodesOfType(index, c.type)) {
			if (n.slug) out.push({ collection: c.slug, slug: n.slug });
		}
	}
	return out;
}

export async function load({ params }) {
	const collection = collectionBySlug(params.collection);
	if (!collection) error(404, '없는 분류입니다.');

	const { index } = await loadNodeIndex();
	const siblings = nodesOfType(index, collection.type)
		.filter((n) => n.slug)
		.sort((a, b) => a.name.localeCompare(b.name, 'ko'));

	const pos = siblings.findIndex((n) => n.slug === params.slug);
	if (pos === -1) error(404, `'${params.slug}' 항목을 찾을 수 없습니다.`);
	const node = siblings[pos];

	const precision = PRECISION_INFO[node.locationPrecision] ?? PRECISION_INFO.unknown;

	return {
		collection,
		counts: Object.fromEntries(COLLECTIONS.map((c) => [c.slug, nodesOfType(index, c.type).length])),
		node: {
			slug: node.slug,
			name: node.name,
			type: node.type,
			settlementType: node.settlementType || '',
			description: node.description || '',
			summary: summarize(node),
			years: yearRangeText(node),
			founded: node.founded || '',
			dissolved: node.dissolved || '',
			lat: node.lat || 0,
			lng: node.lng || 0,
			address: node.address || '',
			source: node.source || '',
			author: node.author || '',
			updater: node.updater || '',
			orgType: node.orgType || '',
			job: node.job || '',
			nationality: node.nationality || '',
			eventType: node.eventType || '',
			locationBasis: node.locationBasis || '',
			certaintyScore: node.certaintyScore ?? 0,
			precisionKey: node.locationPrecision || 'unknown',
			precisionLabel: precision.label,
			precisionDesc: precision.desc
		},
		relations: relationsFor(node, index),
		prev: pos > 0 ? { name: siblings[pos - 1].name, href: nodeHref(siblings[pos - 1]) } : null,
		next:
			pos < siblings.length - 1
				? { name: siblings[pos + 1].name, href: nodeHref(siblings[pos + 1]) }
				: null
	};
}
