import { allNodeEntries, loadNodePage, PREFIXED_LOCALES } from '$lib/server/archive.js';

export const prerender = true;

/* 프리렌더 대상: (en|ja|ru|zh) × 전체 노드.
   노드가 1,100여 개이므로 여기서만 4,400여 장이 생성된다. */
export async function entries() {
	const nodes = await allNodeEntries();
	const out = [];
	for (const lang of PREFIXED_LOCALES) {
		for (const n of nodes) out.push({ lang, ...n });
	}
	return out;
}

export async function load({ params }) {
	return loadNodePage(params.collection, params.slug, params.lang);
}
