import { COLLECTIONS } from '$lib/data/collections.js';
import { loadCollectionPage } from '$lib/server/archive.js';

export const prerender = true;

/* 프리렌더 대상: towns / orgs / persons / events 색인 4장 (한국어).
   다른 언어는 /[lang]/[collection]/ 라우트가 담당한다. */
export function entries() {
	return COLLECTIONS.map((c) => ({ collection: c.slug }));
}

export async function load({ params }) {
	return loadCollectionPage(params.collection, 'ko');
}
