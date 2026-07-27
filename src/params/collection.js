import { COLLECTION_SLUGS } from '$lib/data/collections.js';

/* `/[collection=collection]/` 가 towns|orgs|persons|events 만 받도록 제한.
   (제한이 없으면 이 동적 라우트가 /map/ 같은 다른 경로까지 삼킬 수 있다) */
export function match(param) {
	return COLLECTION_SLUGS.includes(param);
}
