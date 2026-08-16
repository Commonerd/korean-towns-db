<script>
	import ArchiveShell from '$lib/components/ArchiveShell.svelte';
	import { absUrl } from '$lib/config.js';
	import { jsonLdScript } from '$lib/util.js';

	let { data } = $props();

	const canonical = absUrl('/license/');
	const title = '이용약관 및 데이터 라이선스 | 코리아타운 DB';
	const description =
		'코리아타운 DB 의 데이터는 CC BY 4.0 으로 공개됩니다. 출처를 표시하면 공유·변경·상업적 이용이 모두 가능합니다. 원사료 출처와 제3자 권리 안내를 함께 제공합니다.';

	/* 검색엔진이 "이 데이터셋은 CC BY 4.0" 이라는 사실을 구조화 데이터로 읽게 한다.
	   Google Dataset Search 의 수집 대상이기도 하다. */
	const datasetLd = {
		'@context': 'https://schema.org',
		'@type': 'Dataset',
		name: '코리아타운 DB',
		alternateName: 'Koreatown DB',
		description:
			'세계 각지 한인 마을과 그에 결부된 조직·인물·사건의 위치와 연혁을 사료 기반으로 기록한 재외동포 역사 데이터베이스.',
		url: absUrl('/'),
		license: 'https://creativecommons.org/licenses/by/4.0/',
		inLanguage: 'ko',
		keywords: ['코리아타운', '한인 마을', '재외동포', '코리안 디아스포라', 'Koreatown', 'Korean diaspora'],
		creator: {
			'@type': 'Organization',
			name: '코리안 디아스포라 연구팀',
			email: 'koreantowndb@gmail.com'
		}
	};

	const sources = [
		{
			name: '독립기념관 국외사적지 데이터셋',
			href: 'https://www.data.go.kr/data/15070379/fileData.do',
			tag: 'data.go.kr',
			terms: '이용허락범위 제한 없음'
		},
		{
			name: '국사편찬위원회 한국사데이터베이스',
			href: 'https://db.history.go.kr/',
			tag: 'db.history.go.kr',
			terms: '인용 사료는 일제강점기 문서로 저작권 보호기간 만료'
		},
		{
			name: '미국 국립문서기록관리청(NARA) 인구총조사',
			href: 'https://www.archives.gov/research/census/online-resources',
			tag: 'archives.gov',
			terms: '미국 연방정부 저작물 — 퍼블릭 도메인'
		},
		{
			name: '러시아 대통령도서관',
			href: 'https://www.prlib.ru/item/686907',
			tag: 'prlib.ru',
			terms: '보호기간 만료. 스캔 이미지는 재배포하지 않고 링크만 제공'
		},
		{
			name: '세계한민족문화대전',
			href: 'https://www.okpedia.kr/',
			tag: 'okpedia.kr',
			terms: '참고 자료. 인용 시 해당 기관의 이용조건 확인 필요'
		}
	];

	const excluded = [
		['소스 코드', 'MIT 라이선스가 적용됩니다.'],
		['지도 배경 타일', '© OpenStreetMap contributors / © CARTO. 각 제공자의 라이선스를 따릅니다.'],
		['사이트 이미지', '각 이미지의 출처와 권리를 별도로 확인하세요.'],
		[
			'AI 해설 텍스트',
			'생성형 AI 의 출력물이며 사료 검증을 거치지 않았습니다. 검증된 DB 항목이 아니므로 인용하지 마세요.'
		],
		['원사료 자체', '각 소장 기관의 이용조건을 직접 확인하셔야 합니다.']
	];
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	<link rel="canonical" href={canonical} />
	<meta property="og:type" content="article" />
	<meta property="og:locale" content="ko_KR" />
	<meta property="og:site_name" content="코리아타운 DB" />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={canonical} />
	{@html jsonLdScript(datasetLd)}
</svelte:head>

<ArchiveShell crumbs={[{ label: '이용약관 및 라이선스' }]} counts={data.counts}>
	<article class="archive-detail license-page" style="--accent: #0f766e">
		<header class="archive-detail-head">
			<p class="archive-kind">이용약관</p>
			<h1>이용약관 및 데이터 라이선스</h1>
			<p class="archive-years">최종 갱신 2026-08-16</p>
		</header>

		<div class="license-badge">
			<div class="license-badge-mark" aria-hidden="true">
				<i class="fa-brands fa-creative-commons"></i>
				<i class="fa-brands fa-creative-commons-by"></i>
			</div>
			<div>
				<strong>CC BY 4.0</strong>
				<p>
					코리아타운 DB 의 데이터는
					<a
						href="https://creativecommons.org/licenses/by/4.0/deed.ko"
						target="_blank"
						rel="license noopener noreferrer"
					>
						크리에이티브 커먼즈 저작자표시 4.0 국제 라이선스
					</a>
					에 따라 이용할 수 있습니다.
				</p>
			</div>
		</div>

		<h2 class="archive-h2">허용되는 것</h2>
		<div class="archive-body">
			<p>출처를 표시하는 한, 다음이 모두 허용됩니다. 조건을 지키는 한 이 권리는 취소되지 않습니다.</p>
		</div>
		<ul class="license-allow">
			<li><strong>공유</strong> — 어떤 매체나 형식으로든 복제·재배포</li>
			<li><strong>변경</strong> — 리믹스, 변형, 2차적 저작물 작성</li>
			<li><strong>상업적 이용</strong> — 영리 목적을 포함한 모든 목적</li>
		</ul>

		<h2 class="archive-h2">지켜야 할 것 — 저작자 표시</h2>
		<div class="archive-body">
			<p>
				적절한 출처를 밝히고, 라이선스 링크를 제공하며, 변경이 있었다면 그 사실을 표시해 주세요.
				데이터를 변경해 재배포하실 때 변경 사실을 밝혀 주시는 것은, 바뀐 내용이 원본의 신뢰도로
				오인되는 것을 막기 위함입니다.
			</p>
		</div>

		<section aria-label="권장 표기 형식">
			<p class="license-cite-label">권장 표기 (한국어)</p>
			<pre class="license-cite">코리아타운 DB (코리안 디아스포라 연구팀), CC BY 4.0,
https://korean-towns-db.vercel.app/</pre>

			<p class="license-cite-label">권장 표기 (English)</p>
			<pre
				class="license-cite">Koreatown DB by the Korean Diaspora Research Team, licensed under CC BY 4.0,
https://korean-towns-db.vercel.app/</pre>

			<p class="license-cite-label">학술 인용</p>
			<pre class="license-cite">코리안 디아스포라 연구팀. 『코리아타운 DB』.
https://korean-towns-db.vercel.app/ (접속일: YYYY-MM-DD).</pre>
		</section>

		<h2 class="archive-h2">이 라이선스가 적용되지 않는 것</h2>
		<dl class="archive-facts">
			{#each excluded as [k, v] (k)}
				<div>
					<dt>{k}</dt>
					<dd>{v}</dd>
				</div>
			{/each}
		</dl>

		<h2 class="archive-h2">원사료 출처 및 제3자 권리</h2>
		<div class="archive-body">
			<p>
				코리아타운 DB 는 여러 기관의 공개 자료와 연구팀의 자체 조사를 종합해 구축했습니다. 개별
				항목의 <strong>출처</strong> 필드에 근거를 명시하고 있습니다.
			</p>
		</div>
		<ul class="license-sources">
			{#each sources as s (s.href)}
				<li>
					<a href={s.href} target="_blank" rel="noopener noreferrer">{s.name}</a>
					<span class="license-src-tag">{s.tag}</span>
					<p>{s.terms}</p>
				</li>
			{/each}
		</ul>
		<div class="archive-body">
			<p class="license-caution">
				CC BY 4.0 은 코리아타운 DB 가 구축한 <strong>데이터베이스와 서술문</strong>에 적용됩니다. 위
				기관들이 보유한 <strong>원사료 자체</strong>의 권리를 이 라이선스가 처분하지 않습니다. 원문
				이미지나 원사료 전문을 이용하시려면 해당 기관의 조건을 직접 확인하세요.
			</p>
		</div>

		<h2 class="archive-h2">데이터 받기</h2>
		<div class="archive-body">
			<p>
				현재 별도의 일괄 다운로드나 API 는 제공하지 않습니다. 연구·교육·전시 목적의 데이터 제공은
				메일로 문의해 주세요. 이용 목적과 필요한 범위를 알려주시면 회신이 빠릅니다.
			</p>
		</div>
		<p class="archive-cta">
			<a href="mailto:koreantowndb@gmail.com">koreantowndb@gmail.com 으로 데이터 문의 →</a>
		</p>

		<h2 class="archive-h2">면책</h2>
		<div class="archive-body">
			<p>
				데이터는 있는 그대로 제공됩니다. 역사 기록의 특성상 좌표·연도·인구 등에 불확실성이
				존재하며, 각 항목의 <strong>위치 확실성</strong> 등급과 <strong>위치 근거</strong> 필드에 그
				수준을 표기하고 있습니다. 연구에 사용하실 때는 반드시 원사료를 함께 확인하시기 바랍니다.
			</p>
		</div>

		<h2 class="archive-h2">기여</h2>
		<div class="archive-body">
			<p>
				이 프로젝트에 데이터를 기여하시는 경우, 기여분이 위와 동일하게 <strong>CC BY 4.0</strong> 으로
				공개되는 데 동의하는 것으로 봅니다. 기여 전에 이 조건을 확인해 주세요.
			</p>
		</div>

		<h2 class="archive-h2">English Summary</h2>
		<div class="archive-body">
			<p>
				The <strong>Koreatown DB</strong> dataset — records of Korean diaspora towns, organizations,
				people, and events — is licensed under
				<a
					href="https://creativecommons.org/licenses/by/4.0/"
					target="_blank"
					rel="license noopener noreferrer">Creative Commons Attribution 4.0 International</a
				>. You are free to share and adapt the data for any purpose, including commercially, provided
				you give appropriate credit, link to the license, and indicate if changes were made.
			</p>
			<p>
				This license covers the database and the descriptive text authored by the research team. It
				does not cover the source code (MIT), the map base tiles (© OpenStreetMap contributors / ©
				CARTO), AI-generated commentary shown in the app, or the underlying archival materials held
				by the institutions cited in each record.
			</p>
			<p>
				No bulk download or API is currently offered. For research, educational, or exhibition use,
				please contact <a href="mailto:koreantowndb@gmail.com">koreantowndb@gmail.com</a>.
			</p>
		</div>
	</article>
</ArchiveShell>

<style>
	.license-page :global(.archive-h2) {
		margin-top: 40px;
	}

	.license-badge {
		display: flex;
		align-items: flex-start;
		gap: 16px;
		border: 1px solid var(--line);
		border-left: 4px solid var(--accent);
		border-radius: var(--radius-sm);
		background: #fff;
		padding: 18px 20px;
		margin-bottom: 8px;
	}
	.license-badge-mark {
		display: flex;
		gap: 4px;
		font-size: 30px;
		line-height: 1;
		color: var(--accent);
		flex-shrink: 0;
	}
	.license-badge strong {
		display: block;
		font-family: var(--font-mono);
		font-size: 17px;
		letter-spacing: 0.04em;
		color: var(--navy-deep);
		margin-bottom: 4px;
	}
	.license-badge p {
		margin: 0;
		font-size: 14.5px;
		color: var(--ink-soft);
		word-break: keep-all;
	}

	.license-allow {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 8px;
	}
	.license-allow li {
		position: relative;
		padding-left: 26px;
		font-size: 15px;
		color: var(--ink);
		word-break: keep-all;
	}
	.license-allow li::before {
		content: '✓';
		position: absolute;
		left: 4px;
		color: var(--accent);
		font-weight: 700;
	}
	.license-allow strong {
		color: var(--navy-deep);
	}

	.license-cite-label {
		margin: 20px 0 6px;
		font-family: var(--font-mono);
		font-size: 12px;
		letter-spacing: 0.1em;
		color: var(--ink-faint);
	}
	.license-cite {
		margin: 0;
		padding: 12px 14px;
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
		background: #f8fafc;
		font-family: var(--font-mono);
		font-size: 12.5px;
		line-height: 1.7;
		color: var(--ink);
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}

	.license-sources {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 10px;
	}
	.license-sources li {
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
		background: #fff;
		padding: 12px 14px;
	}
	.license-sources a {
		font-size: 15px;
		font-weight: 600;
		color: var(--navy);
		text-decoration: none;
	}
	.license-sources a:hover {
		color: var(--accent);
		text-decoration: underline;
	}
	.license-src-tag {
		display: inline-block;
		margin-left: 8px;
		padding: 2px 8px;
		border-radius: 999px;
		background: #f1f5f9;
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--ink-faint);
	}
	.license-sources p {
		margin: 6px 0 0;
		font-size: 13.5px;
		color: var(--ink-soft);
		word-break: keep-all;
	}

	.license-caution {
		border-left: 3px solid var(--accent);
		padding-left: 14px;
		margin-top: 16px;
		font-size: 14.5px;
		color: var(--ink-soft);
	}

	@media (max-width: 560px) {
		.license-badge {
			flex-direction: column;
			gap: 10px;
		}
	}
</style>
