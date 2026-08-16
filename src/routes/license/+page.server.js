import { COLLECTIONS } from '$lib/data/collections.js';
import { nodesOfType } from '$lib/data/relations.js';
import { loadNodeIndex } from '$lib/server/nodes.js';

export const prerender = true;

/* 아카이브 껍데기(ArchiveShell)의 분류별 건수 표시를 위해서만 색인을 읽는다. */
export async function load() {
	const { index } = await loadNodeIndex();
	return {
		counts: Object.fromEntries(COLLECTIONS.map((c) => [c.slug, nodesOfType(index, c.type).length]))
	};
}
