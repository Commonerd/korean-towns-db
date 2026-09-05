import { COLLECTIONS } from '$lib/data/collections.js';
import { nodesOfType } from '$lib/data/relations.js';
import { BUILD_DATE, loadNodeIndex } from '$lib/server/nodes.js';

export const prerender = true;

/* 랜딩 페이지는 크롤러의 진입점이다. 여기서 분류별 색인(/towns/ 등)으로
   실제 링크를 걸어 두어야 1000여 개 상세 페이지까지 탐색이 이어진다. */
export async function load() {
	const { index } = await loadNodeIndex();
	return {
		counts: Object.fromEntries(COLLECTIONS.map((c) => [c.slug, nodesOfType(index, c.type).length])),
		/* GeoJSON 다운로드 버튼의 파일명에 쓰는 빌드 날짜 */
		generated: BUILD_DATE
	};
}
