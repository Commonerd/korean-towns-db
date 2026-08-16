<script>
	/* 분류 색인 페이지 본문 — 한국어(/towns/)와 언어별(/en/towns/) 라우트가 공유한다. */
	import ArchiveShell from './ArchiveShell.svelte';
	import { absUrl } from '$lib/config.js';
	import { jsonLdScript } from '$lib/util.js';
	import { translate } from '$lib/i18n/translations.js';
	import { localeCollectionHref, PAGE_LOCALES } from '$lib/data/locales.js';

	let { data } = $props();

	const locale = $derived(data.locale);
	const collection = $derived(data.collection);
	const items = $derived(data.items);

	const tr = $derived((key, params) => translate(locale, key, params));

	const canonical = $derived(absUrl(localeCollectionHref(locale, collection.slug)));
	const title = $derived(
		`${tr('arch.listTitle', { title: collection.title, n: items.length })} — ${tr('brand.name')}`
	);
	const desc = $derived(collection.desc);
	/* 헤더의 실제 언어 전환 링크 — hreflang 과 동일한 URL 을 재사용 */
	const alternates = $derived(
		PAGE_LOCALES.map((l) => ({ locale: l, href: localeCollectionHref(l, collection.slug) }))
	);

	/* 색인 페이지는 ItemList 로 표현해 하위 항목 URL 을 함께 알린다 */
	const ld = $derived({
		'@context': 'https://schema.org',
		'@type': 'CollectionPage',
		name: title,
		url: canonical,
		description: desc,
		inLanguage: locale,
		isPartOf: { '@type': 'WebSite', name: tr('brand.name'), url: absUrl('/') },
		mainEntity: {
			'@type': 'ItemList',
			numberOfItems: items.length,
			itemListElement: items.slice(0, 500).map((it, i) => ({
				'@type': 'ListItem',
				position: i + 1,
				name: it.name,
				url: absUrl(it.href)
			}))
		}
	});

	/* 첫 글자 그룹 헤딩 — 목록이 길어도 사람이 훑을 수 있게.
	   ⚠️ 같은 첫 글자가 연속으로 오지 않는 언어(일본어·중국어 정렬 등)가 있으므로
	      "연속 구간"이 아니라 Map 으로 모은다. 연속 구간으로 만들면 같은 키의 그룹이
	      여러 개 생겨 {#each} 의 키가 중복되고, 하이드레이션이 통째로 깨진다. */
	const groups = $derived.by(() => {
		const byKey = new Map();
		for (const it of items) {
			const key = initialOf(it.name);
			if (!byKey.has(key)) byKey.set(key, []);
			byKey.get(key).push(it);
		}
		return [...byKey].map(([key, groupItems]) => ({ key, items: groupItems }));
	});

	const CHO = [
		'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
		'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
	];

	function initialOf(name) {
		const ch = (name || '').trim().charAt(0);
		if (!ch) return '#';
		const code = ch.charCodeAt(0);
		if (code >= 0xac00 && code <= 0xd7a3) return CHO[Math.floor((code - 0xac00) / 588)];
		if (/[a-zA-Z]/.test(ch)) return ch.toUpperCase();
		// 키릴/가나/한자 등은 첫 글자를 그대로 그룹 키로 쓴다
		if (/[^\s\d]/.test(ch)) return ch.toUpperCase();
		return '#';
	}

	function metaOf(it) {
		return [it.settlementType, it.orgType, it.eventType, it.job, it.nationality, it.years].filter(
			Boolean
		);
	}
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={desc} />
	<link rel="canonical" href={canonical} />
	<meta property="og:type" content="website" />
	<meta property="og:locale" content={locale} />
	<meta property="og:site_name" content={tr('brand.name')} />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={desc} />
	<meta property="og:url" content={canonical} />
	<meta property="og:image" content={absUrl('/resources/images/koreantown1.png')} />
	<meta name="twitter:card" content="summary_large_image" />
	<!-- 같은 색인의 다른 언어판을 서로 알려 준다 (구글이 언어별 페이지를 묶어서 이해) -->
	{#each PAGE_LOCALES as l (l)}
		<link
			rel="alternate"
			hreflang={l}
			href={absUrl(localeCollectionHref(l, collection.slug))}
		/>
	{/each}
	<link
		rel="alternate"
		hreflang="x-default"
		href={absUrl(localeCollectionHref('ko', collection.slug))}
	/>
	{@html jsonLdScript(ld)}
</svelte:head>

<ArchiveShell
	{locale}
	{alternates}
	crumbs={[{ label: collection.title, href: localeCollectionHref(locale, collection.slug) }]}
	counts={data.counts}
	current={collection.slug}
>
	<header class="archive-hero" style="--accent: {collection.color}">
		<p class="archive-eyebrow">{collection.slug.toUpperCase()}</p>
		<h1>{collection.title}</h1>
		<p class="archive-lede">{collection.desc}</p>
		<p class="archive-count">{@html tr('arch.total', { n: items.length })}</p>
	</header>

	{#if items.length === 0}
		<p class="archive-empty">{tr('arch.empty')}</p>
	{:else}
		{#each groups as group (group.key)}
			<section class="archive-group">
				<h2 class="archive-group-key" id="group-{group.key}">{group.key}</h2>
				<ul class="archive-list">
					{#each group.items as it (it.slug)}
						<li class="archive-item" style="--accent: {collection.color}">
							<a href={it.href}>
								<span class="archive-item-name">{it.name}</span>
								{#if metaOf(it).length}
									<span class="archive-item-meta">{metaOf(it).join(' · ')}</span>
								{/if}
							</a>
							<p class="archive-item-desc">{it.summary}</p>
							{#if it.relatedTown}
								<p class="archive-item-town">{tr('arch.relTown', { name: it.relatedTown })}</p>
							{/if}
						</li>
					{/each}
				</ul>
			</section>
		{/each}
	{/if}
</ArchiveShell>
