<script>
	/* 아카이브(프리렌더 SEO) 페이지 공통 껍데기 — 헤더 / 빵부스러기 / 푸터.
	   지도 페이지와 달리 전부 서버에서 렌더된 정적 HTML 이라 크롤러가 그대로 읽는다.

	   ⚠️ 문구는 클라이언트 스토어(t)가 아니라 locale 인자를 받는 순수 translate 를 쓴다.
	      언어별로 각각 프리렌더되므로, 서버 렌더 시점에 그 페이지의 언어가 확정돼야 한다. */
	import { COLLECTIONS } from '$lib/data/collections.js';
	import { translate } from '$lib/i18n/translations.js';
	import { localeCollectionHref, collectionTitle } from '$lib/data/locales.js';
	import { LOCALE_NAMES } from '$lib/i18n/store.svelte.js';

	/** @type {{ locale?: string, crumbs?: {label: string, href?: string}[], counts?: Record<string, number>, current?: string, alternates?: {locale: string, href: string}[], children: import('svelte').Snippet }} */
	let {
		locale = 'ko',
		crumbs = [],
		counts = {},
		current = '',
		alternates = [],
		children
	} = $props();

	const tr = $derived((key, params) => translate(locale, key, params));
	/* 랜딩페이지는 언어별로 없고 한국어 하나뿐이라, 홈은 항상 그 페이지로 간다
	   (/en, /ja 같은 경로는 라우트가 없어 404 — 이 shell 이 담당하는 아카이브 페이지만 언어별로 존재) */
	const homeHref = '/';
</script>

<div class="archive">
	<header class="archive-top">
		<div class="archive-wrap archive-top-inner">
			<a class="archive-brand" href={homeHref}>
				{tr('brand.name')}
			</a>
			<nav class="archive-nav" aria-label={tr('arch.facts')}>
				{#each COLLECTIONS as c (c.slug)}
					<a
						href={localeCollectionHref(locale, c.slug)}
						class="archive-nav-link"
						class:is-current={current === c.slug}
						style="--dot: {c.color}"
					>
						{collectionTitle(locale, c.slug)}{#if counts[c.slug]}<em>{counts[c.slug]}</em>{/if}
					</a>
				{/each}
				<a class="archive-nav-map" href="/map/">{tr('arch.viewMap')}</a>
			</nav>
			{#if alternates.length}
				<!-- 실제 이동 가능한 링크 — head 의 hreflang 은 크롤러에게만 보이므로,
				     방문자도 언어를 바꿀 수 있고 크롤러도 sitemap 말고 페이지 자체에서
				     다른 언어판을 발견할 수 있는 경로를 하나 더 둔다. -->
				<nav class="archive-langs" aria-label={tr('lang.switch')}>
					{#each alternates as alt (alt.locale)}
						<a href={alt.href} class:is-current={alt.locale === locale} lang={alt.locale}>
							{LOCALE_NAMES[alt.locale] ?? alt.locale}
						</a>
					{/each}
				</nav>
			{/if}
		</div>
	</header>

	{#if crumbs.length}
		<nav class="archive-wrap archive-crumbs" aria-label={tr('arch.home')}>
			<ol>
				<li><a href={homeHref}>{tr('arch.home')}</a></li>
				{#each crumbs as crumb, i (crumb.label + i)}
					<li>
						{#if crumb.href && i < crumbs.length - 1}
							<a href={crumb.href}>{crumb.label}</a>
						{:else}
							<span aria-current="page">{crumb.label}</span>
						{/if}
					</li>
				{/each}
			</ol>
		</nav>
	{/if}

	<main class="archive-wrap archive-main">
		{@render children()}
	</main>

	<footer class="archive-foot">
		<div class="archive-wrap">
			<p>
				<strong>{tr('brand.name')}</strong> — {tr('arch.brandDesc')}
			</p>
			<p class="archive-foot-links">
				<a href={homeHref}>{tr('arch.footProject')}</a>
				<a href="/map/">{tr('arch.footMap')}</a>
				{#each COLLECTIONS as c (c.slug)}
					<a href={localeCollectionHref(locale, c.slug)}>{collectionTitle(locale, c.slug)}</a>
				{/each}
				<a href="/license/">{tr('arch.footLicense')}</a>
			</p>
			<p class="archive-foot-license">
				{tr('arch.footDataLicense')}:
				<a
					href="https://creativecommons.org/licenses/by/4.0/"
					target="_blank"
					rel="license noopener noreferrer">CC BY 4.0</a
				>
				· {tr('arch.footMapCredit')}: © OpenStreetMap contributors, © CARTO
			</p>
		</div>
	</footer>
</div>
