import { COLLECTIONS } from '$lib/data/collections.js';
import { loadCollectionPage, PREFIXED_LOCALES } from '$lib/server/archive.js';

export const prerender = true;

/* 프리렌더 대상: (en|ja|ru|zh) × 분류 4장 = 16장 */
export function entries() {
	const out = [];
	for (const lang of PREFIXED_LOCALES) {
		for (const c of COLLECTIONS) out.push({ lang, collection: c.slug });
	}
	return out;
}

export async function load({ params }) {
	return loadCollectionPage(params.collection, params.lang);
}
