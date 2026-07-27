/* ====== 아카이브 컬렉션 정의 ======
   데이터 내부 타입 키('마을'/'조직'/'인물'/'사건')와 URL 세그먼트를 잇는 단일 출처.
   프리렌더 라우트 `/[collection=collection]/[slug]/` 와 sitemap 이 이 표를 공유한다.
   ⚠️ slug 를 바꾸면 이미 색인된 URL 이 전부 깨지므로 변경 금지. */
export const COLLECTIONS = [
	{
		slug: 'towns',
		type: '마을',
		label: '마을',
		labelEn: 'Towns',
		title: '한인 마을',
		desc: '세계 각지에 형성된 한인 마을(코리아타운·빌리지)의 위치와 연혁 기록입니다.',
		color: '#ea580c',
		icon: 'fa-location-dot',
		schemaType: 'Place'
	},
	{
		slug: 'orgs',
		type: '조직',
		label: '조직',
		labelEn: 'Organizations',
		title: '한인 조직',
		desc: '한인 마을을 기반으로 활동한 단체·학교·교회·언론 등 조직의 기록입니다.',
		color: '#2563eb',
		icon: 'fa-sitemap',
		schemaType: 'Organization'
	},
	{
		slug: 'persons',
		type: '인물',
		label: '인물',
		labelEn: 'People',
		title: '한인 인물',
		desc: '한인 마을과 조직에서 활동한 인물의 기록입니다.',
		color: '#16a34a',
		icon: 'fa-user',
		schemaType: 'Person'
	},
	{
		slug: 'events',
		type: '사건',
		label: '사건',
		labelEn: 'Events',
		title: '한인 사건',
		desc: '한인 마을·조직·인물과 관련된 역사적 사건의 기록입니다.',
		color: '#9333ea',
		icon: 'fa-bolt',
		schemaType: 'Event'
	}
];

export const COLLECTION_SLUGS = COLLECTIONS.map((c) => c.slug);

const BY_SLUG = new Map(COLLECTIONS.map((c) => [c.slug, c]));
const BY_TYPE = new Map(COLLECTIONS.map((c) => [c.type, c]));

export function collectionBySlug(slug) {
	return BY_SLUG.get(slug) ?? null;
}

export function collectionByType(type) {
	return BY_TYPE.get(type) ?? null;
}

/* 노드 → 상세 페이지 경로 (trailingSlash: 'always' 규칙에 맞춤).
   slug 가 없는(= 이름이 빈) 노드는 링크를 만들지 않는다. */
export function nodeHref(node) {
	if (!node) return null;
	const c = collectionByType(node.type);
	if (!c || !node.slug) return null;
	return `/${c.slug}/${encodeURIComponent(node.slug)}/`;
}

export function collectionHref(slug) {
	return `/${slug}/`;
}
