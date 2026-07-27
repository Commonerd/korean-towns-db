import { COLLECTIONS } from '$lib/data/collections.js';
import { nodesOfType } from '$lib/data/relations.js';
import { loadNodeIndex } from '$lib/server/nodes.js';

export const prerender = true;

/* 지도 페이지의 초기 데이터를 프리렌더 시점에 구워 넣는다.
   - 첫 화면에서 구글 시트 CSV 4장을 기다리지 않아도 마커가 바로 뜬다.
   - 30초 폴링(+page.svelte)이 이후의 최신화를 계속 담당한다. */
export async function load() {
	const { nodes, index } = await loadNodeIndex();
	const counts = Object.fromEntries(COLLECTIONS.map((c) => [c.slug, nodesOfType(index, c.type).length]));
	return { nodes, counts };
}
