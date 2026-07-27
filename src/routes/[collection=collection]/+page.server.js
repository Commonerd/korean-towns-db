import { error } from '@sveltejs/kit';
import { COLLECTIONS, collectionBySlug, nodeHref } from '$lib/data/collections.js';
import { nodesOfType, summarize, yearRangeText } from '$lib/data/relations.js';
import { loadNodeIndex } from '$lib/server/nodes.js';

export const prerender = true;

/* 프리렌더 대상: towns / orgs / persons / events 색인 4장 */
export function entries() {
	return COLLECTIONS.map((c) => ({ collection: c.slug }));
}

export async function load({ params }) {
	const collection = collectionBySlug(params.collection);
	if (!collection) error(404, '없는 분류입니다.');

	const { index } = await loadNodeIndex();

	const items = nodesOfType(index, collection.type)
		.filter((n) => n.slug)
		.map((n) => ({
			slug: n.slug,
			name: n.name,
			href: nodeHref(n),
			years: yearRangeText(n),
			summary: summarize(n, 110),
			relatedTown: n.type === '마을' ? '' : n.relatedTownAll || n.relatedTown || '',
			settlementType: n.settlementType || '',
			orgType: n.orgType || '',
			job: n.job || '',
			nationality: n.nationality || '',
			eventType: n.eventType || ''
		}))
		.sort((a, b) => a.name.localeCompare(b.name, 'ko'));

	const counts = {};
	for (const c of COLLECTIONS) counts[c.slug] = nodesOfType(index, c.type).length;

	return { collection, items, counts };
}
