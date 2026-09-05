<script>
	import { onMount } from 'svelte';
	import { reveal } from '$lib/actions/reveal.js';
	import { absUrl } from '$lib/config.js';
	import { track } from '$lib/track.js';
	import { t, getLocale } from '$lib/i18n/store.svelte.js';
	import LanguageSwitcher from '$lib/components/LanguageSwitcher.svelte';
	import { COLLECTIONS } from '$lib/data/collections.js';
	import { localeCollectionHref, collectionTitle } from '$lib/data/locales.js';

	let { data } = $props();

	let navOpen = $state(false);
	let year = $state('');

	// 캐러셀
	const slides = [
		'/resources/images/koreantown1.png',
		'/resources/images/koreantown2.png',
		'/resources/images/koreantown3.png',
		'/resources/images/koreantown4.png',
		'/resources/images/koreantown5.png'
	];
	let current = $state(0);
	const next = () => (current = (current + 1) % slides.length);
	const prev = () => (current = (current - 1 + slides.length) % slides.length);

	onMount(() => {
		year = String(new Date().getFullYear());
		const timer = setInterval(next, 1500);
		return () => clearInterval(timer);
	});

	function closeNav() {
		navOpen = false;
	}

	/* GeoJSON URL 복사 — kepler.gl 처럼 "URL 붙여넣기"를 지원하는 도구용.
	   복사할 값은 공개 절대 URL 이어야 하므로 absUrl 을 쓴다(로컬 주소를 주면 안 됨). */
	let copied = $state(false);
	async function copyGeojsonUrl() {
		// 클릭했다는 사실은 클립보드 결과와 무관하게 기록한다.
		// (writeText 가 NotAllowedError 등으로 실패하면 이 함수 자체가 중단돼
		//  트래킹까지 같이 유실되는 버그가 있었다 — 분리해서 항상 기록되게 한다)
		track('copy-url');
		try {
			await navigator.clipboard.writeText(absUrl('/nodes.geojson'));
			copied = true;
			setTimeout(() => (copied = false), 2400);
		} catch {
			/* 클립보드 권한이 없으면(비 HTTPS 등) 조용히 무시 */
		}
	}
</script>

<svelte:head>
	<title>{t('home.title')}</title>
	<meta name="description" content={t('home.desc')} />
	<meta name="keywords" content="코리아타운, 한인마을, 재외동포, 지도, 역사, 데이터베이스, Koreatown, Korean diaspora" />
	<link rel="canonical" href="https://korean-towns-db.vercel.app/" />
	<meta property="og:type" content="website" />
	<meta property="og:locale" content={getLocale()} />
	<meta property="og:site_name" content={t('brand.name')} />
	<meta property="og:title" content={t('home.title')} />
	<meta property="og:description" content={t('home.desc')} />
	<meta property="og:url" content="https://korean-towns-db.vercel.app/" />
	<meta property="og:image" content="https://korean-towns-db.vercel.app/resources/images/koreantown1.png" />
	<meta property="og:image:alt" content={t('brand.name')} />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={t('brand.name')} />
	<meta name="twitter:description" content={t('home.desc')} />
	<meta name="twitter:image" content="https://korean-towns-db.vercel.app/resources/images/koreantown1.png" />
	{@html `<script type="application/ld+json">${JSON.stringify({
		'@context': 'https://schema.org',
		'@type': 'WebSite',
		name: t('brand.name'),
		url: 'https://korean-towns-db.vercel.app/',
		description: t('home.desc'),
		inLanguage: getLocale()
	})}<\/script>`}
</svelte:head>

<header class="site-header" class:nav-open={navOpen}>
	<div class="wrap">
		<div class="brand">
			<img class="brand-mark" src="/favicon.png" alt={t('brand.logoAlt')} />
			<div class="brand-text">
				<h2>{t('brand.name')}</h2>
				<span>{t('brand.tagline')}</span>
			</div>
		</div>

		<nav class="main-nav">
			<ul>
				<li><a href="#project" onclick={closeNav}>{t('nav.project')}</a></li>
				<li><a href="#features" onclick={closeNav}>{t('nav.features')}</a></li>
				<li><a href="#roadmap" onclick={closeNav}>{t('nav.roadmap')}</a></li>
				<li><a href="#log" onclick={closeNav}>{t('nav.log')}</a></li>
				<li><a href="#data" onclick={closeNav}>{t('nav.data')}</a></li>
				<li><a href="#team" onclick={closeNav}>{t('nav.team')}</a></li>
				<li><a href="#join" onclick={closeNav}>{t('nav.join')}</a></li>
			</ul>
		</nav>

		<div class="nav-actions">
			<LanguageSwitcher variant="light" />
			<a class="btn btn--coffee btn--sm" href="https://buymeacoffee.com/koreatowndb">
				<i class="fa-solid fa-mug-hot"></i><span class="long">&nbsp;{t('btn.donate')}</span>
			</a>
			<a class="btn btn--primary btn--sm" href="/map/">
				<i class="fa-solid fa-map-location-dot"></i><span class="long">&nbsp;{t('btn.viewMap')}</span>
			</a>
			<button
				class="nav-toggle"
				aria-label={t('btn.openMenu')}
				aria-expanded={navOpen}
				onclick={() => (navOpen = !navOpen)}
			>
				<i class="fa-solid fa-bars"></i>
			</button>
		</div>
	</div>
</header>

<main>
	<!-- ============ HERO ============ -->
	<section class="hero" id="hero">
		<div class="wrap">
			<div class="hero-copy" use:reveal>
				<p class="eyebrow">{t('hero.eyebrow')}</p>
				<h1>{@html t('hero.title')}</h1>
				<p class="lede">
					{t('hero.lede')}
				</p>
				<div class="hero-ctas">
					<a class="btn btn--primary" href="/map/">
						{t('btn.viewMapArrow')} <i class="fa-solid fa-arrow-right"></i>
					</a>
					<a class="btn btn--ghost" href="#team">{t('btn.teamIntro')}</a>
				</div>
				<div class="stat-row">
					<div class="stat"><b>{t('hero.stat1num')}</b><span>{t('hero.stat1label')}</span></div>
					<div class="stat"><b>{t('hero.stat2num')}</b><span>{t('hero.stat2label')}</span></div>
					<div class="stat"><b>{t('hero.stat3num')}</b><span>{t('hero.stat3label')}</span></div>
				</div>
			</div>

			<figure class="hero-visual" use:reveal>
				<svg
					viewBox="0 0 560 420"
					role="img"
					aria-label={t('hero.svg.aria')}
				>
					<path class="route-line" d="M150,220 L378,86" fill="none" stroke="var(--navy)" stroke-width="2" />
					<path class="route-line" d="M150,220 L392,338" fill="none" stroke="var(--navy)" stroke-width="2" />
					<path d="M150,220 L486,178" fill="none" stroke="var(--navy)" stroke-width="1.6" />
					<path d="M150,220 L486,286" fill="none" stroke="#c7cdda" stroke-width="1.6" stroke-dasharray="3 6" />

					<circle class="node-pulse" cx="378" cy="86" r="44" fill="var(--amber)" />
					<text x="378" y="91" text-anchor="middle" font-family="Noto Sans KR" font-size="20.8" font-weight="700" fill="#fff">{t('hero.svg.russia')}</text>

					<circle class="node-pulse delay" cx="392" cy="338" r="44" fill="var(--amber)" />
					<text x="392" y="343" text-anchor="middle" font-family="Noto Sans KR" font-size="20.8" font-weight="700" fill="#fff">{t('hero.svg.usa')}</text>

					<circle class="node-pulse" cx="486" cy="178" r="44" fill="var(--amber)" />
					<text x="486" y="183" text-anchor="middle" font-family="Noto Sans KR" font-size="20.8" font-weight="700" fill="#fff">{t('hero.svg.japan')}</text>

					<circle cx="486" cy="286" r="44" fill="var(--paper-warm)" stroke="#c7cdda" stroke-width="1.6" stroke-dasharray="3 4" />
					<text x="486" y="291" text-anchor="middle" font-family="Noto Sans KR" font-size="20.8" font-weight="700" fill="var(--navy-deep)">{t('hero.svg.china')}</text>

					<circle cx="150" cy="220" r="49" fill="var(--navy)" />
					<text x="150" y="225" text-anchor="middle" font-family="Noto Serif KR" font-size="20.8" font-weight="700" fill="#fff">{t('hero.svg.korea')}</text>
				</svg>
				<div class="hero-legend">
					<span><i style="background:var(--amber)"></i>{t('hero.svg.inProgress')}</span>
					<span><i style="background:#c7cdda"></i>{t('hero.svg.next')}</span>
				</div>
			</figure>
		</div>
	</section>

	<!-- ============ PROJECT / INTRO ============ -->
	<section class="section section--border-top" id="project">
		<div class="wrap intro-grid">
			<div>
				<div class="section-head" use:reveal>
					<p class="eyebrow">{t('project.eyebrow')}</p>
					<h2>{t('project.h2')}</h2>
				</div>
				<div class="intro-copy" use:reveal>
					<p>
						{@html t('project.body')}
					</p>
				</div>
			</div>

			<div class="preview-card" use:reveal>
				<div class="preview-map carousel-container">
					<div class="carousel-track" style="transform: translateX(-{current * 100}%)">
						{#each slides as src, i (src)}
							<img {src} alt={t('project.previewAlt', { n: i + 1 })} />
						{/each}
					</div>
					<button class="carousel-prev" aria-label={t('project.prevImg')} onclick={prev}>&#10094;</button>
					<button class="carousel-next" aria-label={t('project.nextImg')} onclick={next}>&#10095;</button>
					<div class="carousel-dots">
						{#each slides as _, i (i)}
							<button
								class="dot"
								class:active={i === current}
								aria-label={t('project.gotoImg', { n: i + 1 })}
								onclick={() => (current = i)}
							></button>
						{/each}
					</div>
				</div>
				<div class="cap-row">
					<div class="cap-legend">
						<span><i style="background:var(--town)"></i>{t('type.town')}</span>
						<span><i style="background:var(--org)"></i>{t('type.org')}</span>
						<span><i style="background:var(--person)"></i>{t('type.person')}</span>
						<span><i style="background:var(--event)"></i>{t('type.event')}</span>
					</div>
				</div>
			</div>
		</div>
	</section>

	<!-- ============ FEATURES ============ -->
	<section class="section section--tint" id="features">
		<div class="wrap">
			<div class="section-head" use:reveal>
				<p class="eyebrow">{t('features.eyebrow')}</p>
				<h2>{t('features.h2')}</h2>
				<p>{t('features.p')}</p>
			</div>

			<div class="feature-grid">
				<div class="feature-card" use:reveal>
					<div class="icon"><i class="fa-solid fa-sitemap"></i></div>
					<h3>{t('features.c1.h3')}</h3>
					<p>{t('features.c1.p')}</p>
				</div>
				<div class="feature-card" use:reveal>
					<div class="icon"><i class="fa-solid fa-location-crosshairs"></i></div>
					<h3>{t('features.c2.h3')}</h3>
					<p>{t('features.c2.p')}</p>
				</div>
				<div class="feature-card" use:reveal>
					<div class="icon"><i class="fa-solid fa-clock-rotate-left"></i></div>
					<h3>{t('features.c3.h3')}</h3>
					<p>{t('features.c3.p')}</p>
				</div>
				<div class="feature-card" use:reveal>
					<div class="icon"><i class="fa-solid fa-users-gear"></i></div>
					<h3>{t('features.c4.h3')}</h3>
					<p>{t('features.c4.p')}</p>
				</div>
			</div>
		</div>
	</section>

	<!-- ============ ROADMAP ============ -->
	<section class="section" id="roadmap">
		<div class="wrap">
			<div class="section-head" use:reveal>
				<p class="eyebrow">{t('roadmap.eyebrow')}</p>
				<h2>{t('roadmap.h2')}</h2>
			</div>
			<p class="roadmap-intro" use:reveal>
				{t('roadmap.intro')}
			</p>

			<div class="phase-track">
				<div class="phase" use:reveal>
					<div class="phase-num">01</div>
					<span class="tag">{t('tag.inProgress')}</span>
					<h3>{t('roadmap.p1.h3')}</h3>
					<p>{t('roadmap.p1.p')}</p>
				</div>
				<div class="phase" use:reveal>
					<div class="phase-num">02</div>
					<span class="tag">{t('tag.inProgress')}</span>
					<h3>{t('roadmap.p2.h3')}</h3>
					<p>{t('roadmap.p2.p')}</p>
				</div>
				<div class="phase is-upcoming" use:reveal>
					<div class="phase-num">03</div>
					<span class="tag">{t('tag.planned')}</span>
					<h3>{t('roadmap.p3.h3')}</h3>
					<p>{t('roadmap.p3.p')}</p>
				</div>
				<div class="phase is-upcoming" use:reveal>
					<div class="phase-num">04</div>
					<span class="tag">{t('tag.planned')}</span>
					<h3>{t('roadmap.p4.h3')}</h3>
					<p>{t('roadmap.p4.p')}</p>
				</div>
			</div>
		</div>
	</section>

	<!-- ============ PROGRESS LOG ============ -->
	<section class="section section--tint" id="log">
		<div class="wrap">
			<div class="section-head" use:reveal>
				<p class="eyebrow">{t('log.eyebrow')}</p>
				<h2>{t('log.h2')}</h2>
			</div>

			<div class="log-list">
				<div class="log-item" use:reveal>
					<div class="log-date">2026.06.09</div>
					<div class="log-body">
						<span class="log-tag data">{t('log.tag.dataModel')}</span>
						<p>{t('log.item1.body')}</p>
					</div>
				</div>
				<div class="log-item" use:reveal>
					<div class="log-date">2026.07.09</div>
					<div class="log-body">
						<span class="log-tag data">{t('log.tag.feature')}</span>
						<p>{t('log.item2.body')}</p>
					</div>
				</div>
				<div class="log-item" use:reveal>
					<div class="log-date">2026.07.12</div>
					<div class="log-body">
						<span class="log-tag next">{t('log.tag.feature')}</span>
						<p>{t('log.item3.body')}</p>
					</div>
				</div>
				<div class="log-item" use:reveal>
					<div class="log-date">2026.07.20</div>
					<div class="log-body">
						<span class="log-tag next">{t('log.tag.feature')}</span>
						<p>{t('log.item4.body1')}</p>
						<p>{t('log.item4.body2')}</p>
					</div>
				</div>
				<div class="log-item" use:reveal>
					<div class="log-date">2026.08.16</div>
					<div class="log-body">
						<span class="log-tag data">{t('log.tag.policy')}</span>
						<p>{t('log.item5.body')}</p>
					</div>
				</div>
				<div class="log-item" use:reveal>
					<div class="log-date">2026.08.16</div>
					<div class="log-body">
						<span class="log-tag next">{t('log.tag.feature')}</span>
						<p>{t('log.item6.body')}</p>
					</div>
				</div>
				<div class="log-item" use:reveal>
					<div class="log-date">2026.09.02</div>
					<div class="log-body">
						<span class="log-tag next">{t('log.tag.feature')}</span>
						<p>{t('log.item7.body')}</p>
					</div>
				</div>
			</div>
		</div>
	</section>

	<!-- ============ DATA & METHODOLOGY ============ -->
	<section class="section" id="data">
		<div class="wrap">
			<div class="section-head" use:reveal>
				<p class="eyebrow">{t('data.eyebrow')}</p>
				<h2>{t('data.h2')}</h2>
				<p>{t('data.p')}</p>
			</div>

			<div class="data-grid">
				<div>
					<div class="model-card" use:reveal>
						<div class="dot-row"><span class="dot" style="background:var(--town)"></span><h4>{t('data.model.town')}</h4></div>
						<div class="fields">{@html t('data.model.town.fields')}</div>
					</div>
					<div class="model-card" use:reveal>
						<div class="dot-row"><span class="dot" style="background:var(--org)"></span><h4>{t('data.model.org')}</h4></div>
						<div class="fields">{@html t('data.model.org.fields')}</div>
					</div>
					<div class="model-card" use:reveal>
						<div class="dot-row"><span class="dot" style="background:var(--person)"></span><h4>{t('data.model.person')}</h4></div>
						<div class="fields">{@html t('data.model.person.fields')}</div>
					</div>
					<div class="model-card" use:reveal>
						<div class="dot-row"><span class="dot" style="background:var(--event)"></span><h4>{t('data.model.event')}</h4></div>
						<div class="fields">{@html t('data.model.event.fields')}</div>
					</div>
				</div>

				<div use:reveal>
					<ul class="source-list">
						<li>
							<a href="https://www.data.go.kr/data/15070379/fileData.do" target="_blank" rel="noopener">{t('data.source1')}</a>
							<span class="src-tag">data.go.kr</span>
						</li>
						<li>
							<a href="https://db.history.go.kr/id/haf_012_0330" target="_blank" rel="noopener">{t('data.source2')}</a>
							<span class="src-tag">db.history.go.kr</span>
						</li>
						<li>
							<a href="https://www.okpedia.kr/" target="_blank" rel="noopener">{t('data.source3')}</a>
							<span class="src-tag">okpedia.kr</span>
						</li>
						<li>
							<a href="https://www.prlib.ru/item/686907" target="_blank" rel="noopener">{t('data.source4')}</a>
							<span class="src-tag">prlib.ru</span>
						</li>
						<li>
							<a href="https://www.archives.gov/research/census/online-resources" target="_blank" rel="noopener">{t('data.source5')}</a>
							<span class="src-tag">archives.gov</span>
						</li>
					</ul>

					<div class="copyright-note">{t('data.copyright')}</div>
					<!-- download 에 파일명을 명시한다. 프리렌더된 배포본에는 +server.js 의
					     content-disposition 헤더가 남지 않으므로(본문만 정적 파일로 저장됨),
					     이 속성이 없으면 브라우저가 URL 에서 이름을 추측한다. -->
					<div class="data-export-row">
						<a
							class="btn btn--ghost btn--sm"
							href="/nodes.geojson"
							download="korean-towns-db-{data.generated}.geojson"
							data-sveltekit-reload
							onclick={() => track('download-file')}
						>
							<i class="fa-solid fa-download" aria-hidden="true"></i>
							{t('data.geojson')}
						</a>
						<button type="button" class="btn btn--ghost btn--sm" onclick={copyGeojsonUrl}>
							<i class="fa-solid {copied ? 'fa-check' : 'fa-link'}" aria-hidden="true"></i>
							{copied ? t('data.copied') : t('data.copyUrl')}
						</button>
					</div>
				</div>
			</div>

			<!-- 분류별 색인으로 나가는 실제 링크. 크롤러가 여기를 통해
			     1000여 개 상세 페이지까지 내려간다. -->
			<div class="archive-entry" use:reveal>
				<div class="archive-entry-head">
					<h3>{t('archive.title')}</h3>
					<p>{t('archive.desc')}</p>
				</div>
				<ul class="archive-entry-list">
					{#each COLLECTIONS as c (c.slug)}
						<li>
							<a href={localeCollectionHref(getLocale(), c.slug)} style="--accent: {c.color}">
								<span class="dot" style="background:{c.color}"></span>
								<strong>{collectionTitle(getLocale(), c.slug)}</strong>
								<em>{t('archive.count', { n: data.counts?.[c.slug] ?? 0 })}</em>
							</a>
						</li>
					{/each}
				</ul>
			</div>
		</div>
	</section>

	<!-- ============ TEAM ============ -->
	<section class="section section--tint" id="team">
		<div class="wrap">
			<div class="section-head" use:reveal>
				<p class="eyebrow">{t('team.eyebrow')}</p>
				<h2>{t('team.h2')}</h2>
			</div>
			<p class="team-intro" use:reveal>
				{@html t('team.intro')}
			</p>

			<div class="team-grid">
				<div class="team-card" use:reveal>
					<div class="avatar" style="background:var(--amber);">{t('team.m1.initial')}</div>
					<h3>{t('team.m1.name')}</h3>
					<p class="role">{t('team.m1.role')}</p>
					<p>{@html t('team.m1.affil')}</p>
					<p>{t('team.m1.bio')}</p>
				</div>

				<div class="team-card" use:reveal>
					<div class="avatar" style="background:var(--person);">{t('team.m2.initial')}</div>
					<h3>{t('team.m2.name')}</h3>
					<p class="role">{t('team.m2.role')}</p>
					<p>{@html t('team.m2.affil')}</p>
					<p>{t('team.m2.bio')}</p>
				</div>

				<div class="team-card" use:reveal>
					<div class="avatar" style="background:var(--navy);">{t('team.m3.initial')}</div>
					<h3>{t('team.m3.name')}</h3>
					<p class="role">{t('team.m3.role')}</p>
					<p>{@html t('team.m3.affil')}</p>
					<p>{t('team.m3.bio')}</p>
				</div>

				<div class="team-card" use:reveal>
					<div class="avatar" style="background:var(--event);">{t('team.m4.initial')}</div>
					<h3>{t('team.m4.name')}</h3>
					<p class="role">{t('team.m4.role')}</p>
					<p>{@html t('team.m4.affil')}</p>
					<p>{t('team.m4.bio')}</p>
				</div>
			</div>
		</div>
	</section>

	<!-- ============ JOIN / CONTACT ============ -->
	<section class="section" id="join">
		<div class="wrap">
			<div class="join-panel" use:reveal>
				<div>
					<p class="eyebrow">{t('join.eyebrow')}</p>
					<h2>{t('join.h2')}</h2>
					<p>{t('join.p')}</p>
					<div class="join-ctas">
						<a class="btn btn--primary" href="/map/">{t('btn.viewMap')}</a>
						<a class="btn btn--ghost" href="mailto:koreantowndb@gmail.com">{t('btn.contact')}</a>
					</div>
					<p class="contact-note">{t('join.contactNote')}</p>
				</div>

				<ul class="join-list">
					<li>
						<i class="fa-solid fa-book-bookmark"></i>
						<div><b>{t('join.i1.title')}</b>{t('join.i1.body')}</div>
					</li>
					<li>
						<i class="fa-solid fa-graduation-cap"></i>
						<div><b>{t('join.i2.title')}</b>{t('join.i2.body')}</div>
					</li>
					<li>
						<i class="fa-solid fa-mug-hot"></i>
						<div style="width: 100%;">
							<b>{t('join.i3.title')}</b>
							<p style="font-size: 0.85rem; color: rgba(255, 255, 255, 0.75); margin: 4px 0 14px 0; line-height: 1.6;">
								{t('join.i3.body')}
							</p>
							<a
								href="https://buymeacoffee.com/koreatowndb"
								target="_blank"
								rel="noopener"
								class="btn btn--primary"
								style="background:#f5c98c; color:var(--navy-deep); border:none; padding: 0.55em 1.3em; font-size: 0.85rem; display: inline-flex; align-items: center; gap: 8px; vertical-align: middle;"
							>
								<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
									<path d="M18 8h1a4 4 0 0 1 0 8h-1"></path>
									<path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path>
									<line x1="6" y1="1" x2="6" y2="4"></line>
									<line x1="10" y1="1" x2="10" y2="4"></line>
									<line x1="14" y1="1" x2="14" y2="4"></line>
								</svg>
								{t('btn.donate')}
							</a>
						</div>
					</li>
				</ul>
			</div>
		</div>
	</section>
</main>

<footer class="site-footer">
	<div class="wrap">
		<div class="footer-top">
			<div class="footer-brand">
				<div class="brand">
					<img class="brand-mark" src="/favicon.png" alt={t('brand.logoAlt')} />
					<div class="brand-text">
						<h2>{t('brand.name')}</h2>
						<span>{t('brand.tagline')}</span>
					</div>
				</div>
				<p>{t('footer.brandDesc')}</p>
			</div>

			<div class="footer-links">
				<div>
					<h5>{t('footer.quicklinks')}</h5>
					<ul>
						<li><a href="#project">{t('nav.project')}</a></li>
						<li><a href="#roadmap">{t('nav.roadmap')}</a></li>
						<li><a href="#team">{t('nav.team')}</a></li>
						<li><a href="/map/">{t('btn.viewMap')}</a></li>
						{#each COLLECTIONS as c (c.slug)}
							<li><a href={localeCollectionHref(getLocale(), c.slug)}>{collectionTitle(getLocale(), c.slug)}</a></li>
						{/each}
						<li><a href="/license/">{t('footer.license')}</a></li>
					</ul>
				</div>
				<div>
					<h5>{t('footer.refs')}</h5>
					<ul>
						<li><a href="https://www.data.go.kr/data/15070379/fileData.do" target="_blank" rel="noopener">{t('footer.source1short')}</a></li>
						<li><a href="https://db.history.go.kr/id/haf_012_0330" target="_blank" rel="noopener">{t('data.source2')}</a></li>
						<li><a href="https://www.prlib.ru/item/686907" target="_blank" rel="noopener">{t('data.source4')}</a></li>
						<li><a href="https://www.archives.gov/research/census/online-resources" target="_blank" rel="noopener">{t('data.source5')}</a></li>
					</ul>
				</div>
			</div>
		</div>

		<div class="footer-bottom">
			<span>{t('footer.copyright', { year })}</span>
			<span>{t('footer.credits')}</span>
			<span class="footer-license">{@html t('footer.licenseNote')}</span>
		</div>
	</div>
</footer>

<style>
	.wrap {
		max-width: var(--container);
		margin: 0 auto;
		padding: 0 28px;
	}

	.eyebrow {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		font-weight: 600;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--amber);
		display: inline-flex;
		align-items: center;
		gap: 0.55em;
		margin-bottom: 0.9rem;
	}
	.eyebrow::before {
		content: '';
		width: 18px;
		height: 1px;
		background: var(--amber);
		display: inline-block;
	}

	.section-head {
		max-width: 640px;
		margin-bottom: 2.6rem;
	}
	.section-head h2 {
		font-family: var(--font-display);
		font-weight: 700;
		font-size: clamp(1.6rem, 2.6vw + 1rem, 2.35rem);
		line-height: 1.3;
		letter-spacing: -0.01em;
		color: var(--navy-deep);
	}
	.section-head p {
		margin-top: 0.9rem;
		font-size: 1rem;
		line-height: 1.75;
		color: var(--ink-soft);
	}

	.section {
		padding: 96px 0;
	}
	.section--tint {
		background: var(--paper-warm);
	}
	.section--border-top {
		border-top: 1px solid var(--line);
	}

	h1,
	h2,
	h3,
	h4,
	h5,
	p {
		margin: 0;
	}
	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	a {
		color: inherit;
		text-decoration: none;
	}
	img,
	svg {
		max-width: 100%;
		display: block;
	}
	button {
		font: inherit;
		cursor: pointer;
	}
	section {
		scroll-margin-top: 76px;
	}

	/* buttons */
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.55em;
		padding: 0.85em 1.5em;
		border-radius: 999px;
		font-size: 0.92rem;
		font-weight: 600;
		border: 1px solid transparent;
		transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease, color 0.18s ease;
		white-space: nowrap;
	}
	.btn:hover {
		transform: translateY(-2px);
	}
	.btn--primary {
		background: var(--navy);
		color: #fff;
		box-shadow: var(--shadow-sm);
	}
	.btn--primary:hover {
		background: var(--navy-deep);
		box-shadow: var(--shadow-md);
	}
	.btn--ghost {
		background: transparent;
		color: var(--navy);
		border-color: var(--line);
	}
	.btn--ghost:hover {
		border-color: var(--navy);
		background: #fff;
	}
	.btn--sm {
		padding: 0.6em 1.1em;
		font-size: 0.82rem;
	}

	/* reveal-on-scroll */
	:global(.reveal) {
		opacity: 0;
		transform: translateY(18px);
		transition: opacity 0.7s ease, transform 0.7s ease;
	}
	:global(.reveal.is-visible) {
		opacity: 1;
		transform: none;
	}

	/* ============ Header ============ */
	.site-header {
		position: sticky;
		top: 0;
		z-index: 100;
		background: rgba(248, 250, 252, 0.86);
		backdrop-filter: blur(10px);
		border-bottom: 1px solid var(--line);
	}
	.site-header .wrap {
		max-width: 100%;       /* 🔥 본문 너비 제한을 풀고 화면 전체 폭 사용 */
    	padding: 24px 24px;       /* 🔥 좌우 여백을 줄여 로고를 좌측 끝으로 당김 */
		min-height: 76px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		min-width: 0;
		flex-shrink: 0;
		margin-left: -10px; /* 🔥 왼쪽으로 10px 당기기 */
	}
	.brand-text {
		min-width: 0;
	}
	.brand-mark {
		width: 38px;
		height: 38px;
		border-radius: 11px;
		object-fit: cover;
		flex-shrink: 0;
		display: block;
		box-shadow: var(--shadow-sm);
		border: 1px solid rgba(255, 255, 255, 0.18);
		background: #fff;
	}
	.brand-text h2 {
		font-family: var(--font-display);
		font-size: 1.02rem;
		font-weight: 700;
		color: var(--navy-deep);
		line-height: 1.2;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.brand-text span {
		display: block;
		font-family: var(--font-mono);
		font-size: 0.66rem;
		letter-spacing: 0.05em;
		color: var(--ink-faint);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.main-nav {
		display: flex;
		align-items: center;
		gap: 1.2rem; /* 기존 2.1rem -> 1.2rem으로 축소 */
	}
	.main-nav ul {
		display: flex;
		gap: 1.7rem;
	}
	.main-nav a {
		font-size: 0.88rem;
		font-weight: 500;
		color: var(--ink-soft);
		transition: color 0.15s ease;
		position: relative;
		white-space: nowrap; /* 🔥 텍스트가 두 줄로 깨지는 현상 방지 */
	}
	.main-nav a:hover {
		color: var(--navy);
	}

	.nav-actions {
		display: flex;
		align-items: center;
		gap: 0.8rem;
		flex-wrap: nowrap;
		flex-shrink: 0;
	}
	.nav-actions :global(.lang-switch),
	.nav-actions .btn {
		flex-shrink: 0;
	}
	.nav-toggle {
		display: none;
		width: 40px;
		height: 40px;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: 1px solid var(--line);
		border-radius: 10px;
		color: var(--navy-deep);
	}

	@media (max-width: 1024px) {
		.site-header .wrap {
			height: auto;
			min-height: 76px;
			padding-top: 10px;
			padding-bottom: 10px;
			gap: 0.4rem;
		}
		.brand {
			/* 🔥 좁은 화면에서 언어/후원 버튼이 밀려 화면 밖으로 사라지는 것을 막기 위해,
			   브랜드명이 먼저 줄어들도록 shrink 를 허용(공간이 실제로 부족할 때만 축소됨) */
			flex-shrink: 1;
			min-width: 44px;
		}
		.brand-text {
			min-width: 0;
		}
		.brand-text h2 {
			font-size: 0.95rem;
		}
		.brand-text span {
			font-size: 0.58rem;
			letter-spacing: 0.02em;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}
		.main-nav ul {
			display: none;
		}
		.nav-toggle {
			display: flex;
		}
		.site-header.nav-open .main-nav ul {
			display: flex;
			flex-direction: column;
			position: absolute;
			top: 76px;
			left: 0;
			right: 0;
			background: #fff;
			padding: 1.2rem 28px;
			gap: 1rem;
			border-bottom: 1px solid var(--line);
			box-shadow: var(--shadow-md);
		}
		.nav-actions {
			gap: 0.5rem;
		}
	}
	@media (max-width: 560px) {
		.nav-actions .btn span.long {
			display: none;
		}
		.site-header .wrap {
			padding-left: 14px;
			padding-right: 14px;
		}
		.nav-actions {
			gap: 0.35rem;
		}
		.btn--sm {
			padding: 0.55em 0.75em;
		}
	}

	/* ============ Hero ============ */
	.hero {
		padding: 88px 0 70px;
		position: relative;
		background-image: linear-gradient(
				90deg,
				var(--paper) 0%,
				rgba(248, 250, 252, 0.75) 0%,
				rgba(248, 250, 252, 0.1) 100%
			),
			url('https://upload.wikimedia.org/wikipedia/commons/e/ec/World_map_blank_without_borders.svg');
		background-position: right center;
		background-size: cover;
		background-repeat: no-repeat;
	}
	.hero .wrap {
		display: grid;
		grid-template-columns: 1.05fr 0.95fr;
		gap: 3.5rem;
		align-items: center;
		position: relative;
		z-index: 1;
	}
	.hero h1 {
		font-family: var(--font-display);
		font-weight: 700;
		font-size: clamp(2.1rem, 3.6vw + 1rem, 3.5rem);
		line-height: 1.28;
		letter-spacing: -0.01em;
		color: var(--navy-deep);
	}
	.hero h1 .accent {
		color: var(--amber);
	}
	.hero p.lede {
		margin-top: 1.4rem;
		font-size: 1.05rem;
		line-height: 1.8;
		color: var(--ink-soft);
		max-width: 52ch;
	}
	.hero-ctas {
		margin-top: 2.1rem;
		display: flex;
		flex-wrap: wrap;
		gap: 0.9rem;
	}

	.stat-row {
		margin-top: 2.6rem;
		display: flex;
		gap: 2.2rem;
		flex-wrap: wrap;
	}
	.stat-row .stat b {
		display: block;
		font-family: var(--font-mono);
		font-size: 1.5rem;
		color: var(--navy);
		font-weight: 600;
	}
	.stat-row .stat span {
		font-size: 0.8rem;
		color: var(--ink-faint);
	}

	.hero-visual {
		position: relative;
	}
	.hero-legend {
		display: flex;
		justify-content: center;
		gap: 1.4rem;
		margin-top: 1rem;
		font-size: 0.74rem;
		color: var(--ink-soft);
	}
	.hero-legend span {
		display: inline-flex;
		align-items: center;
		gap: 0.4em;
	}
	.hero-legend i {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		display: inline-block;
	}

	.route-line {
		stroke-dasharray: 6 7;
		animation: dashFlow 1.8s linear infinite;
	}
	@keyframes dashFlow {
		to {
			stroke-dashoffset: -26;
		}
	}
	.node-pulse {
		animation: pulse 2.6s ease-in-out infinite;
		transform-origin: center;
	}
	.node-pulse.delay {
		animation-delay: 0.9s;
	}
	@keyframes pulse {
		0%,
		100% {
			transform: scale(1);
			opacity: 1;
		}
		50% {
			transform: scale(1.18);
			opacity: 0.82;
		}
	}

	@media (max-width: 900px) {
		.hero {
			padding: 84px 0 72px;
			min-height: min(100svh, 860px);
			background-image: linear-gradient(
					to bottom,
					rgba(248, 250, 252, 0.8) 0%,
					rgba(248, 250, 252, 0.82) 0%,
					rgba(248, 250, 252, 0.58) 100%
				),
				url('https://upload.wikimedia.org/wikipedia/commons/e/ec/World_map_blank_without_borders.svg');
			background-position: 90% top;
			background-size: cover;
			background-repeat: no-repeat;
		}
		.hero .wrap {
			grid-template-columns: 1fr;
			gap: 2.2rem;
			align-items: start;
		}
		.hero-copy {
			max-width: 100%;
		}
		.hero h1 {
			font-size: clamp(2rem, 7vw, 2.7rem);
			line-height: 1.2;
		}
		.hero p.lede {
			font-size: 1rem;
			line-height: 1.75;
		}
		.hero-ctas {
			margin-top: 1.8rem;
			gap: 0.8rem;
		}
		.hero-ctas .btn {
			width: 100%;
			justify-content: center;
		}
		.stat-row {
			margin-top: 2rem;
			gap: 1.2rem 1.4rem;
		}
		.stat-row .stat b {
			font-size: 1.3rem;
		}
		.stat-row .stat span {
			font-size: 0.82rem;
		}
		.hero-visual {
			order: -1;
			max-width: 100%;
			margin: 0 auto 1rem;
		}
		.hero-visual svg {
			width: 100%;
			max-width: 460px;
			margin: 0 auto;
		}
		.hero-legend {
			gap: 1.1rem;
			font-size: 0.8rem;
			margin-top: 0.6rem;
		}
	}

	/* ============ Intro / project ============ */
	.intro-grid {
		display: grid;
		grid-template-columns: 1.1fr 0.9fr;
		gap: 3.2rem;
		align-items: start;
	}
	.intro-grid .section-head {
		margin-bottom: 1.6rem;
	}
	.intro-copy p {
		font-size: 1rem;
		line-height: 1.85;
		color: var(--ink-soft);
		margin-bottom: 1.2rem;
	}
	.intro-copy p:last-child {
		margin-bottom: 0;
	}
	.intro-copy strong {
		color: var(--navy-deep);
		font-weight: 600;
	}

	/* 캐러셀 */
	.carousel-container {
		position: relative;
		overflow: hidden;
		width: 100%;
		height: 100%;
	}
	.carousel-track {
		display: flex;
		transition: transform 0.5s ease-in-out;
		height: 100%;
		width: 100%;
	}
	.carousel-track img {
		min-width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.carousel-prev,
	.carousel-next {
		position: absolute;
		top: 50%;
		transform: translateY(-50%);
		background: rgba(0, 0, 0, 0.3);
		color: white;
		border: none;
		padding: 10px 15px;
		cursor: pointer;
		z-index: 10;
		border-radius: 50%;
		font-size: 18px;
	}
	.carousel-prev {
		left: 10px;
	}
	.carousel-next {
		right: 10px;
	}
	.carousel-prev:hover,
	.carousel-next:hover {
		background: rgba(0, 0, 0, 0.6);
	}
	.carousel-dots {
		position: absolute;
		bottom: 10px;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		gap: 8px;
		z-index: 10;
	}
	.dot {
		width: 8px;
		height: 8px;
		background-color: rgba(255, 255, 255, 0.5);
		border-radius: 50%;
		cursor: pointer;
		border: none;
		padding: 0;
	}
	.dot.active {
		background-color: white;
		transform: scale(1.2);
	}

	.preview-card {
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: #fff;
		padding: 18px;
		box-shadow: var(--shadow-sm);
	}
	.preview-map {
		border-radius: var(--radius-sm);
		aspect-ratio: 4/3;
		background: radial-gradient(circle at 30% 35%, rgba(30, 58, 138, 0.08), transparent 45%),
			repeating-linear-gradient(0deg, #eef1f6 0 1px, transparent 1px 26px),
			repeating-linear-gradient(90deg, #eef1f6 0 1px, transparent 1px 26px), #f4f6f9;
		position: relative;
		overflow: hidden;
	}
	.preview-card .cap-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-top: 14px;
		font-size: 0.74rem;
		color: var(--ink-faint);
	}
	.cap-legend {
		display: flex;
		gap: 0.9rem;
	}
	.cap-legend span {
		display: inline-flex;
		align-items: center;
		gap: 0.35em;
	}
	.cap-legend i {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		display: inline-block;
	}

	@media (max-width: 900px) {
		.intro-grid {
			grid-template-columns: 1fr;
		}
	}

	/* ============ Features ============ */
	.feature-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 1.4rem;
	}
	.feature-card {
		background: #fff;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		padding: 1.7rem 1.5rem;
		transition: box-shadow 0.2s ease, transform 0.2s ease;
	}
	.feature-card:hover {
		box-shadow: var(--shadow-md);
		transform: translateY(-3px);
	}
	.feature-card .icon {
		width: 42px;
		height: 42px;
		border-radius: 11px;
		background: var(--amber-soft);
		color: var(--amber);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.05rem;
		margin-bottom: 1.1rem;
	}
	.feature-card h3 {
		font-size: 1.02rem;
		font-weight: 700;
		color: var(--navy-deep);
		margin-bottom: 0.55rem;
	}
	.feature-card p {
		font-size: 0.88rem;
		line-height: 1.65;
		color: var(--ink-soft);
	}

	@media (max-width: 960px) {
		.feature-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}
	@media (max-width: 560px) {
		.feature-grid {
			grid-template-columns: 1fr;
		}
	}

	/* ============ Roadmap ============ */
	.roadmap-intro {
		max-width: 640px;
		margin-bottom: 2.6rem;
		color: var(--ink-soft);
		line-height: 1.8;
	}
	.phase-track {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0;
		position: relative;
	}
	.phase-track::before {
		content: '';
		position: absolute;
		top: 24px;
		left: 0;
		right: 0;
		height: 1px;
		background: var(--line);
	}
	.phase {
		position: relative;
		padding: 0 1.1rem 0 0;
	}
	.phase:first-child {
		padding-left: 0;
	}
	.phase-num {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		background: #fff;
		border: 2px solid var(--navy);
		color: var(--navy);
		font-family: var(--font-mono);
		font-weight: 600;
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
		z-index: 2;
		margin-bottom: 1.1rem;
	}
	.phase.is-upcoming .phase-num {
		border-color: var(--line);
		color: var(--ink-faint);
		background: var(--paper-warm);
	}
	.phase h3 {
		font-size: 1rem;
		font-weight: 700;
		color: var(--navy-deep);
		margin-bottom: 0.4rem;
	}
	.phase .tag {
		display: inline-block;
		font-family: var(--font-mono);
		font-size: 0.68rem;
		letter-spacing: 0.04em;
		padding: 0.22em 0.65em;
		border-radius: 999px;
		margin-bottom: 0.7rem;
		background: var(--amber-soft);
		color: var(--amber);
	}
	.phase.is-upcoming .tag {
		background: #eef0f4;
		color: var(--ink-faint);
	}
	.phase p {
		font-size: 0.85rem;
		line-height: 1.65;
		color: var(--ink-soft);
	}

	@media (max-width: 900px) {
		.phase-track {
			grid-template-columns: 1fr;
			gap: 2.2rem;
		}
		.phase-track::before {
			display: none;
		}
		.phase {
			padding: 0;
		}
	}

	/* ============ Progress log ============ */
	.log-list {
		max-width: 760px;
	}
	.log-item {
		display: grid;
		grid-template-columns: 120px 1fr;
		gap: 1.6rem;
		padding: 1.5rem 0;
		border-top: 1px solid var(--line);
	}
	.log-item:last-child {
		border-bottom: 1px solid var(--line);
	}
	.log-date {
		font-family: var(--font-mono);
		font-size: 0.82rem;
		color: var(--ink-faint);
		padding-top: 0.2rem;
	}
	.log-tag {
		display: inline-block;
		font-family: var(--font-mono);
		font-size: 0.66rem;
		padding: 0.2em 0.6em;
		border-radius: 6px;
		margin-bottom: 0.55rem;
		background: #eef2ff;
		color: var(--org);
	}
	.log-tag.data {
		background: #fff3e8;
		color: var(--town);
	}
	.log-tag.next {
		background: var(--amber-soft);
		color: var(--amber);
	}
	.log-body p {
		font-size: 0.92rem;
		line-height: 1.7;
		color: var(--ink-soft);
	}

	@media (max-width: 640px) {
		.log-item {
			grid-template-columns: 1fr;
			gap: 0.4rem;
		}
	}

	/* ============ Data & methodology ============ */
	.data-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 2.6rem;
	}
	.model-card {
		background: #fff;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		padding: 1.6rem 1.7rem;
		margin-bottom: 1rem;
	}
	.model-card .dot-row {
		display: flex;
		align-items: center;
		gap: 0.6em;
		margin-bottom: 0.6rem;
	}
	.model-card .dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
	}
	.model-card h4 {
		font-size: 0.98rem;
		font-weight: 700;
		color: var(--navy-deep);
	}
	.model-card .fields {
		font-family: var(--font-mono);
		font-size: 0.78rem;
		color: var(--ink-soft);
		line-height: 1.9;
	}

	.source-list li {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.95rem 0;
		border-top: 1px solid var(--line);
		font-size: 0.92rem;
	}
	.source-list li:last-child {
		border-bottom: 1px solid var(--line);
	}
	.source-list a {
		color: var(--navy);
		font-weight: 500;
	}
	.source-list a:hover {
		text-decoration: underline;
	}
	.source-list .src-tag {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		color: var(--ink-faint);
		white-space: nowrap;
	}
	.data-export-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 0.9rem;
	}
	.copyright-note {
		margin-top: 1.4rem;
		padding: 1rem 1.2rem;
		border-left: 3px solid var(--amber);
		background: var(--amber-soft);
		font-size: 0.85rem;
		line-height: 1.7;
		color: var(--navy-deep);
		border-radius: 0 8px 8px 0;
	}

	@media (max-width: 900px) {
		.data-grid {
			grid-template-columns: 1fr;
		}
	}

	/* ============ Team ============ */
	.team-intro {
		max-width: 680px;
		color: var(--ink-soft);
		line-height: 1.8;
		margin-bottom: 2.8rem;
	}
	.team-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1.6rem;
	}
	.team-card {
		background: #fff;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		padding: 1.9rem 1.7rem;
	}
	.team-card .avatar {
		width: 52px;
		height: 52px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 1.1rem;
		color: #fff;
		margin-bottom: 1.1rem;
	}
	.team-card h3 {
		font-size: 1.08rem;
		font-weight: 700;
		color: var(--navy-deep);
	}
	.team-card .role {
		font-family: var(--font-mono);
		font-size: 0.74rem;
		color: var(--amber);
		margin: 0.3rem 0 0.9rem;
	}
	.team-card p {
		font-size: 0.88rem;
		line-height: 1.7;
		color: var(--ink-soft);
		margin-bottom: 1.1rem;
	}

	@media (max-width: 900px) {
		.team-grid {
			grid-template-columns: 1fr;
		}
	}

	/* ============ Join / contact ============ */
	.join-panel {
		background: var(--navy-deep);
		border-radius: 24px;
		padding: 3.4rem 3rem;
		color: #fff;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 2.6rem;
	}
	.join-panel h2 {
		font-family: var(--font-display);
		font-weight: 700;
		font-size: clamp(1.6rem, 2.6vw + 1rem, 2.35rem);
		line-height: 1.3;
		color: #fff;
	}
	.join-panel > div > p {
		margin-top: 0.9rem;
		font-size: 1rem;
		line-height: 1.75;
		color: rgba(255, 255, 255, 0.72);
	}
	.join-panel .eyebrow {
		color: #f5c98c;
	}
	.join-panel .eyebrow::before {
		background: #f5c98c;
	}

	.join-list li {
		display: flex;
		gap: 0.9rem;
		padding: 1rem 0;
		border-top: 1px solid rgba(255, 255, 255, 0.14);
		font-size: 0.9rem;
		line-height: 1.65;
		color: rgba(255, 255, 255, 0.85);
	}
	.join-list li:last-child {
		border-bottom: 1px solid rgba(255, 255, 255, 0.14);
	}
	.join-list i {
		color: #f5c98c;
		margin-top: 0.25rem;
	}
	.join-list b {
		color: #fff;
		display: block;
		margin-bottom: 0.15rem;
	}

	.join-ctas {
		display: flex;
		flex-wrap: wrap;
		gap: 0.8rem;
		margin-top: 1.6rem;
	}
	.join-ctas .btn--ghost {
		color: #fff;
		border-color: rgba(255, 255, 255, 0.3);
	}
	.join-ctas .btn--ghost:hover {
		background: rgba(255, 255, 255, 0.08);
		border-color: #fff;
	}
	.contact-note {
		margin-top: 1rem;
		font-size: 0.76rem;
		color: rgba(255, 255, 255, 0.5);
	}

	@media (max-width: 900px) {
		.join-panel {
			grid-template-columns: 1fr;
			padding: 2.4rem 1.7rem;
		}
	}

	/* ============ Footer ============ */
	.site-footer {
		border-top: 1px solid var(--line);
		padding: 52px 0 34px;
	}
	.footer-top {
		display: flex;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 2rem;
		padding-bottom: 2rem;
		border-bottom: 1px solid var(--line);
	}
	.footer-brand p {
		margin-top: 0.8rem;
		font-size: 0.84rem;
		color: var(--ink-faint);
		max-width: 34ch;
		line-height: 1.6;
	}
	.footer-links {
		display: flex;
		gap: 3.4rem;
		flex-wrap: wrap;
	}
	.footer-links h5 {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-faint);
		margin-bottom: 0.9rem;
	}
	.footer-links li {
		margin-bottom: 0.55rem;
		font-size: 0.85rem;
	}
	.footer-links a:hover {
		color: var(--navy);
	}
	.footer-bottom {
		display: flex;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 0.6rem;
		padding-top: 1.6rem;
		font-size: 0.78rem;
		color: var(--ink-faint);
	}
	.footer-license {
		flex-basis: 100%;
		padding-top: 0.7rem;
		border-top: 1px solid var(--line);
		font-size: 0.74rem;
	}
	.footer-license :global(a) {
		color: inherit;
		text-decoration: underline;
	}
	.footer-license :global(a:hover) {
		color: var(--amber);
	}

	/* 분류별 색인 진입 블록 (#data 섹션 하단) */
	.archive-entry {
		margin-top: 44px;
		padding-top: 32px;
		border-top: 1px solid var(--line);
	}
	.archive-entry-head h3 {
		margin: 0 0 6px;
		font-family: var(--font-display);
		font-size: 21px;
		color: var(--navy-deep);
	}
	.archive-entry-head p {
		margin: 0 0 20px;
		max-width: 62ch;
		color: var(--ink-soft);
		font-size: 15px;
	}
	.archive-entry-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 12px;
		grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
	}
	.archive-entry-list a {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 14px 16px;
		background: #fff;
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
		box-shadow: var(--shadow-sm);
		text-decoration: none;
		color: var(--ink);
		transition: border-color 0.15s, transform 0.15s;
	}
	.archive-entry-list a:hover {
		border-color: var(--accent);
		transform: translateY(-2px);
	}
	.archive-entry-list .dot {
		width: 9px;
		height: 9px;
		border-radius: 50%;
		flex: none;
	}
	.archive-entry-list strong {
		font-weight: 600;
		font-size: 15px;
	}
	.archive-entry-list em {
		margin-left: auto;
		font-style: normal;
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--ink-faint);
	}
</style>
 
