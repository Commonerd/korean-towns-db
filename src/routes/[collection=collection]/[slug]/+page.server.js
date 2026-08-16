import { allNodeEntries, loadNodePage } from '$lib/server/archive.js';

export const prerender = true;

/* 프리렌더 대상: 모든 노드의 상세 페이지 (한국어).
   loadNodeIndex() 가 메모이즈되어 있어 시트는 빌드당 1회만 내려받는다.
   다른 언어는 /[lang]/[collection]/[slug]/ 라우트가 담당한다. */
export async function entries() {
	return allNodeEntries();
}

export async function load({ params }) {
	return loadNodePage(params.collection, params.slug, 'ko');
}
