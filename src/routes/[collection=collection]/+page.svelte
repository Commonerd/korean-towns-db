<script>
	import ArchiveShell from '$lib/components/ArchiveShell.svelte';
	import { absUrl } from '$lib/config.js';
	import { collectionHref } from '$lib/data/collections.js';
	import { jsonLdScript } from '$lib/util.js';

	let { data } = $props();

	const collection = $derived(data.collection);
	const items = $derived(data.items);

	const canonical = $derived(absUrl(collectionHref(collection.slug)));
	const title = $derived(`${collection.title} 목록 (${items.length}건) — 코리아타운 DB`);
	const desc = $derived(`${collection.desc} 현재 ${items.length}건이 등록되어 있습니다.`);

	/* 색인 페이지는 ItemList 로 표현해 하위 항목 URL 을 함께 알린다 */
	const ld = $derived({
		'@context': 'https://schema.org',
		'@type': 'CollectionPage',
		name: title,
		url: canonical,
		description: desc,
		inLanguage: 'ko',
		isPartOf: { '@type': 'WebSite', name: '코리아타운 DB', url: absUrl('/') },
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

	/* 가나다 그룹 헤딩 — 목록이 길어도 사람이 훑을 수 있게 */
	const groups = $derived(
		items.reduce((acc, it) => {
			const key = initialOf(it.name);
			const last = acc[acc.length - 1];
			if (last && last.key === key) last.items.push(it);
			else acc.push({ key, items: [it] });
			return acc;
		}, [])
	);

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
	<meta property="og:locale" content="ko_KR" />
	<meta property="og:site_name" content="코리아타운 DB" />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={desc} />
	<meta property="og:url" content={canonical} />
	<meta property="og:image" content={absUrl('/resources/images/koreantown1.png')} />
	<meta name="twitter:card" content="summary_large_image" />
	{@html jsonLdScript(ld)}
</svelte:head>

<ArchiveShell
	crumbs={[{ label: collection.title, href: collectionHref(collection.slug) }]}
	counts={data.counts}
	current={collection.slug}
>
	<header class="archive-hero" style="--accent: {collection.color}">
		<p class="archive-eyebrow">{collection.labelEn.toUpperCase()}</p>
		<h1>{collection.title}</h1>
		<p class="archive-lede">{collection.desc}</p>
		<p class="archive-count">총 <strong>{items.length}</strong>건</p>
	</header>

	{#if items.length === 0}
		<p class="archive-empty">아직 등록된 항목이 없습니다.</p>
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
								<p class="archive-item-town">관련 마을: {it.relatedTown}</p>
							{/if}
						</li>
					{/each}
				</ul>
			</section>
		{/each}
	{/if}
</ArchiveShell>
