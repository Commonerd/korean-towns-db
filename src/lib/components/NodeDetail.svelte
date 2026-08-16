<script>
	/* 노드 상세 페이지 본문 — 한국어(/towns/<slug>/)와 언어별(/en/towns/<slug>/) 라우트가 공유한다. */
	import ArchiveShell from './ArchiveShell.svelte';
	import { absUrl } from '$lib/config.js';
	import { certaintyColor } from '$lib/data/precision.js';
	import { jsonLdScript, linkify } from '$lib/util.js';
	import { translate, translateType } from '$lib/i18n/translations.js';
	import { localeCollectionHref, PAGE_LOCALES } from '$lib/data/locales.js';

	let { data } = $props();

	const locale = $derived(data.locale);
	const node = $derived(data.node);
	const collection = $derived(data.collection);

	const tr = $derived((key, params) => translate(locale, key, params));

	/* hreflang 대응을 위해 slug 는 모든 언어가 공유한다 (한국어 이름 기준) */
	const hrefFor = $derived((l) =>
		`${l === 'ko' ? '' : `/${l}`}/${collection.slug}/${encodeURIComponent(node.slug)}/`
	);
	const canonical = $derived(absUrl(hrefFor(locale)));
	/* 헤더의 실제 언어 전환 링크 — hreflang 과 동일한 URL 을 재사용 */
	const alternates = $derived(PAGE_LOCALES.map((l) => ({ locale: l, href: hrefFor(l) })));

	const kindLabel = $derived(translateType(locale, node.type, node.settlementType));
	const title = $derived(
		`${node.name}${node.years ? ` (${node.years})` : ''} — ${kindLabel} | ${tr('brand.name')}`
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
			/* 번역본을 보고 있을 때도 한국어 원표기를 함께 알려 준다 */
			alternateName: node.nameKo !== node.name ? node.nameKo : undefined,
			description: node.summary,
			url: canonical,
			inLanguage: locale
		};
		const place = hasCoords
			? {
					'@type': 'Place',
					name: node.name,
					geo: { '@type': 'GeoCoordinates', latitude: node.lat, longitude: node.lng }
				}
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
			return {
				...base,
				nationality: node.nationality,
				jobTitle: node.job,
				homeLocation: place ?? undefined
			};
		}
		return {
			...base,
			startDate: isoYear(node.founded),
			endDate: isoYear(node.dissolved),
			location: place ?? { '@type': 'Place', name: node.address || node.name }
		};
	});

	const breadcrumbLd = $derived({
		'@context': 'https://schema.org',
		'@type': 'BreadcrumbList',
		itemListElement: [
			{ '@type': 'ListItem', position: 1, name: tr('arch.home'), item: absUrl('/') },
			{
				'@type': 'ListItem',
				position: 2,
				name: collection.title,
				item: absUrl(localeCollectionHref(locale, collection.slug))
			},
			{ '@type': 'ListItem', position: 3, name: node.name, item: canonical }
		]
	});

	const facts = $derived(
		[
			['arch.f.address', node.address],
			['arch.f.founded', node.founded],
			['arch.f.dissolved', node.dissolved],
			['arch.f.orgType', node.orgType],
			['arch.f.eventType', node.eventType],
			['arch.f.nationality', node.nationality],
			['arch.f.job', node.job],
			['arch.f.coords', hasCoords ? `${node.lat}, ${node.lng}` : ''],
			['arch.f.locationBasis', node.locationBasis],
			['arch.f.source', node.source],
			['arch.f.author', node.author],
			['arch.f.updater', node.updater],
			['arch.f.changeNote', node.changeNote]
		].filter(([, v]) => v)
	);
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={node.summary} />
	<link rel="canonical" href={canonical} />
	<meta property="og:type" content="article" />
	<meta property="og:locale" content={locale} />
	<meta property="og:site_name" content={tr('brand.name')} />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={node.summary} />
	<meta property="og:url" content={canonical} />
	<meta property="og:image" content={absUrl('/resources/images/koreantown1.png')} />
	<meta name="twitter:card" content="summary_large_image" />
	{#if hasCoords}
		<meta name="geo.position" content="{node.lat};{node.lng}" />
		<meta name="ICBM" content="{node.lat}, {node.lng}" />
	{/if}
	<!-- 같은 항목의 다른 언어판을 서로 알려 준다 -->
	{#each PAGE_LOCALES as l (l)}
		<link rel="alternate" hreflang={l} href={absUrl(hrefFor(l))} />
	{/each}
	<link rel="alternate" hreflang="x-default" href={absUrl(hrefFor('ko'))} />
	{@html jsonLdScript(entityLd)}
	{@html jsonLdScript(breadcrumbLd)}
</svelte:head>

<ArchiveShell
	{locale}
	{alternates}
	crumbs={[
		{ label: collection.title, href: localeCollectionHref(locale, collection.slug) },
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
			<p class="archive-body archive-muted">{tr('arch.noDesc')}</p>
		{/if}

		<section class="archive-certainty" aria-label={tr('arch.certainty')}>
			<div class="archive-certainty-head">
				<strong>{node.precisionLabel}</strong>
				<span style="color: {certaintyColor(certaintyPct)}"></span>
			</div>
			<div class="archive-meter" role="img" aria-label="{tr('arch.certainty')} {certaintyPct}%">
				<span style="width: {certaintyPct}%; background: {certaintyColor(certaintyPct)}"></span>
			</div>
			<p>{node.precisionDesc}</p>
		</section>

		{#if facts.length}
			<section aria-labelledby="facts-heading">
				<h2 id="facts-heading" class="archive-h2">{tr('arch.facts')}</h2>
				<dl class="archive-facts">
					{#each facts as [k, v] (k)}
						<div>
							<dt>{tr(k)}</dt>
							<dd>{@html linkify(v)}</dd>
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
								<span title={tr('arch.notInDb')}>{item.name}</span>
							{/if}
						</li>
					{/each}
				</ul>
				{#if group.more}
					<p class="archive-muted">{tr('arch.more', { n: group.more })}</p>
				{/if}
			</section>
		{/each}

		<p class="archive-cta">
			<!-- 지도는 한 페이지에서 언어를 전환하므로 접두어 없는 경로를 쓴다 -->
			<a href="/map/?focus={collection.slug}/{encodeURIComponent(node.slug)}">
				{tr('arch.mapCta', { name: node.name })}
			</a>
		</p>

		<nav class="archive-pager" aria-label={tr('arch.pagerNav', { title: collection.title })}>
			{#if data.prev}
				<a class="archive-pager-prev" href={data.prev.href}>← {data.prev.name}</a>
			{:else}
				<span></span>
			{/if}
			<a class="archive-pager-up" href={localeCollectionHref(locale, collection.slug)}>
				{tr('arch.allOf', { title: collection.title })}
			</a>
			{#if data.next}
				<a class="archive-pager-next" href={data.next.href}>{data.next.name} →</a>
			{:else}
				<span></span>
			{/if}
		</nav>
	</article>
</ArchiveShell>
