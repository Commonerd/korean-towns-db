<script>
	/* 아카이브(프리렌더 SEO) 페이지 공통 껍데기 — 헤더 / 빵부스러기 / 푸터.
	   지도 페이지와 달리 전부 서버에서 렌더된 정적 HTML 이라 크롤러가 그대로 읽는다. */
	import { COLLECTIONS, collectionHref } from '$lib/data/collections.js';

	/** @type {{ crumbs?: {label: string, href?: string}[], counts?: Record<string, number>, current?: string, children: import('svelte').Snippet }} */
	let { crumbs = [], counts = {}, current = '', children } = $props();
</script>

<div class="archive">
	<header class="archive-top">
		<div class="archive-wrap archive-top-inner">
			<a class="archive-brand" href="/">
				코리아타운 <span>DB</span>
			</a>
			<nav class="archive-nav" aria-label="아카이브 분류">
				{#each COLLECTIONS as c (c.slug)}
					<a
						href={collectionHref(c.slug)}
						class="archive-nav-link"
						class:is-current={current === c.slug}
						style="--dot: {c.color}"
					>
						{c.label}{#if counts[c.slug]}<em>{counts[c.slug]}</em>{/if}
					</a>
				{/each}
				<a class="archive-nav-map" href="/map/">지도로 보기 →</a>
			</nav>
		</div>
	</header>

	{#if crumbs.length}
		<nav class="archive-wrap archive-crumbs" aria-label="현재 위치">
			<ol>
				<li><a href="/">홈</a></li>
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
				<strong>코리아타운 DB</strong> — 코리안 디아스포라 연구팀이 수집·검증한 재외동포 역사
				데이터베이스입니다. 모든 항목은 출처를 명시합니다.
			</p>
			<p class="archive-foot-links">
				<a href="/">프로젝트 소개</a>
				<a href="/map/">인터랙티브 지도</a>
				{#each COLLECTIONS as c (c.slug)}
					<a href={collectionHref(c.slug)}>{c.title}</a>
				{/each}
				<a href="/license/">이용약관 · 라이선스</a>
			</p>
			<p class="archive-foot-license">
				데이터: <a
					href="https://creativecommons.org/licenses/by/4.0/deed.ko"
					target="_blank"
					rel="license noopener noreferrer">CC BY 4.0</a
				> · 지도: © OpenStreetMap contributors, © CARTO
			</p>
		</div>
	</footer>
</div>
