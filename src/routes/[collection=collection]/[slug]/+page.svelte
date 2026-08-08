<script>
	import ArchiveShell from '$lib/components/ArchiveShell.svelte';
	import { absUrl } from '$lib/config.js';
	import { collectionHref, nodeHref } from '$lib/data/collections.js';
	import { certaintyColor } from '$lib/data/precision.js';
	import { jsonLdScript } from '$lib/util.js';

	let { data } = $props();

	const node = $derived(data.node);
	const collection = $derived(data.collection);

	const canonical = $derived(absUrl(nodeHref(node)));
	const kindLabel = $derived(
		node.type === '마을' && node.settlementType ? `마을 · ${node.settlementType}` : node.type
	);
	const title = $derived(
		`${node.name}${node.years ? ` (${node.years})` : ''} — ${kindLabel} | 코리아타운 DB`
	);
	const hasCoords = $derived(Boolean(node.lat && node.lng));
	const certaintyPct = $derived(Math.round(node.certaintyScore * 100));

	/* '1905' 같은 연도만 구조화 데이터의 날짜로 내보낸다 (ISO 8601 연도) */
	function isoYear(v) {
		return /^\d{4}$/.test(String(v).trim()) ? String(v).trim() : '';
	}

	/* 타입별 schema.org 매핑 */
	const entityLd = $derived.by(() => {
		const base = {
			'@context': 'https://schema.org',
			'@type': collection.schemaType,
			name: node.name,
			description: node.summary,
			url: canonical,
			inLanguage: 'ko'
		};
		const place = hasCoords
			? { '@type': 'Place', name: node.name, geo: { '@type': 'GeoCoordinates', latitude: node.lat, longitude: node.lng } }
			: null;

		if (node.type === '마을') {
			return {
				...base,
				address: node.address,
				geo: hasCoords
					? { '@type': 'GeoCoordinates', latitude: node.lat, longitude: node.lng }
					: undefined
			};
		}
		if (node.type === '조직') {
			return {
				...base,
				foundingDate: isoYear(node.founded),
				dissolutionDate: isoYear(node.dissolved),
				location: place ?? undefined
			};
		}
		if (node.type === '인물') {
			return { ...base, nationality: node.nationality, jobTitle: node.job, homeLocation: place ?? undefined };
		}
		return {
			...base,
			startDate: isoYear(node.founded),
			endDate: isoYear(node.dissolved),
			eventAttendanceMode: undefined,
			location: place ?? { '@type': 'Place', name: node.address || node.name }
		};
	});

	const breadcrumbLd = $derived({
		'@context': 'https://schema.org',
		'@type': 'BreadcrumbList',
		itemListElement: [
			{ '@type': 'ListItem', position: 1, name: '홈', item: absUrl('/') },
			{
				'@type': 'ListItem',
				position: 2,
				name: collection.title,
				item: absUrl(collectionHref(collection.slug))
			},
			{ '@type': 'ListItem', position: 3, name: node.name, item: canonical }
		]
	});

	const facts = $derived(
		[
			['어드레스', node.address],
			['성립 / 시작', node.founded],
			['소멸 / 종료', node.dissolved],
			['조직 유형', node.orgType],
			['사건 유형', node.eventType],
			['국적', node.nationality],
			['직업', node.job],
			['좌표', hasCoords ? `${node.lat}, ${node.lng}` : ''],
			['위치 근거', node.locationBasis],
			['출처', node.source],
			['작성자', node.author],
			['최종 수정자', node.updater]
		].filter(([, v]) => v)
	);
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={node.summary} />
	<link rel="canonical" href={canonical} />
	<meta property="og:type" content="article" />
	<meta property="og:locale" content="ko_KR" />
	<meta property="og:site_name" content="코리아타운 DB" />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={node.summary} />
	<meta property="og:url" content={canonical} />
	<meta property="og:image" content={absUrl('/resources/images/koreantown1.png')} />
	<meta name="twitter:card" content="summary_large_image" />
	{#if hasCoords}
		<meta name="geo.position" content="{node.lat};{node.lng}" />
		<meta name="ICBM" content="{node.lat}, {node.lng}" />
	{/if}
	{@html jsonLdScript(entityLd)}
	{@html jsonLdScript(breadcrumbLd)}
</svelte:head>

<ArchiveShell
	crumbs={[
		{ label: collection.title, href: collectionHref(collection.slug) },
		{ label: node.name }
	]}
	counts={data.counts}
	current={collection.slug}
>
	<article class="archive-detail" style="--accent: {collection.color}">
		<header class="archive-detail-head">
			<p class="archive-kind">{kindLabel}</p>
			<h1>{node.name}</h1>
			{#if node.years}<p class="archive-years">{node.years}</p>{/if}
		</header>

		{#if node.description}
			<div class="archive-body">
				{#each node.description.split(/\n+/).filter(Boolean) as para, i (i)}
					<p>{para}</p>
				{/each}
			</div>
		{:else}
			<p class="archive-body archive-muted">
				아직 상세 설명이 등록되지 않은 항목입니다. 아래 기본 정보와 관련 기록을 참고하세요.
			</p>
		{/if}

		<section class="archive-certainty" aria-label="위치 확실성">
			<div class="archive-certainty-head">
				<strong>{node.precisionLabel}</strong>
			</div>
			<p>{node.precisionDesc}</p>
		</section>

		{#if facts.length}
			<section aria-labelledby="facts-heading">
				<h2 id="facts-heading" class="archive-h2">기본 정보</h2>
				<dl class="archive-facts">
					{#each facts as [k, v] (k)}
						<div>
							<dt>{k}</dt>
							<dd>{v}</dd>
						</div>
					{/each}
				</dl>
			</section>
		{/if}

		{#each data.relations as group (group.label)}
			<section aria-label={group.label}>
				<h2 class="archive-h2">{group.label}</h2>
				<ul class="archive-chips">
					{#each group.items as item (item.type + item.name)}
						<li>
							{#if item.href}
								<a href={item.href}>{item.name}</a>
							{:else}
								<span title="아직 DB에 개별 항목으로 등록되지 않았습니다">{item.name}</span>
							{/if}
						</li>
					{/each}
				</ul>
				{#if group.more}
					<p class="archive-muted">외 {group.more}건</p>
				{/if}
			</section>
		{/each}

		<p class="archive-cta">
			<a href="/map/?focus={collection.slug}/{encodeURIComponent(node.slug)}">
				지도에서 «{node.name}» 위치 보기 →
			</a>
		</p>

		<nav class="archive-pager" aria-label="{collection.title} 목록 내 이동">
			{#if data.prev}
				<a class="archive-pager-prev" href={data.prev.href}>← {data.prev.name}</a>
			{:else}
				<span></span>
			{/if}
			<a class="archive-pager-up" href={collectionHref(collection.slug)}>
				{collection.title} 전체
			</a>
			{#if data.next}
				<a class="archive-pager-next" href={data.next.href}>{data.next.name} →</a>
			{:else}
				<span></span>
			{/if}
		</nav>
	</article>
</ArchiveShell>
