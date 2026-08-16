import { absUrl } from '$lib/config.js';
import { COLLECTIONS } from '$lib/data/collections.js';
import { nodesOfType } from '$lib/data/relations.js';
import { loadNodeIndex } from '$lib/server/nodes.js';
import { PAGE_LOCALES, localeCollectionHref, localeNodeHref } from '$lib/data/locales.js';

export const prerender = true;
// 루트 레이아웃의 trailingSlash:'always' 가 파일형 엔드포인트에 붙지 않도록 명시
export const trailingSlash = 'never';

export async function GET() {
	const { index } = await loadNodeIndex();
	const today = new Date().toISOString().slice(0, 10);

	/* 언어별 대응 URL 을 xhtml:link 로 함께 실어, 구글이 같은 항목의 번역판을
	   하나의 묶음으로 이해하게 한다 (페이지의 <link rel="alternate"> 와 짝) */
	const urls = [
		{ loc: absUrl('/'), priority: '1.0', changefreq: 'weekly' },
		{ loc: absUrl('/map/'), priority: '0.9', changefreq: 'weekly' },
		{ loc: absUrl('/license/'), priority: '0.3', changefreq: 'yearly' }
	];

	for (const c of COLLECTIONS) {
		for (const loc of PAGE_LOCALES) {
			urls.push({
				loc: absUrl(localeCollectionHref(loc, c.slug)),
				priority: '0.8',
				changefreq: 'weekly',
				alternates: PAGE_LOCALES.map((l) => ({
					lang: l,
					href: absUrl(localeCollectionHref(l, c.slug))
				}))
			});
		}

		for (const n of nodesOfType(index, c.type)) {
			if (!n.slug) continue;
			const alternates = PAGE_LOCALES.map((l) => ({
				lang: l,
				href: absUrl(localeNodeHref(l, n))
			}));
			for (const loc of PAGE_LOCALES) {
				urls.push({
					loc: absUrl(localeNodeHref(loc, n)),
					priority: '0.6',
					changefreq: 'monthly',
					alternates
				});
			}
		}
	}

	const body =
		'<?xml version="1.0" encoding="UTF-8"?>\n' +
		'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ' +
		'xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +
		urls
			.map((u) => {
				const alt = (u.alternates ?? [])
					.map(
						(a) =>
							`    <xhtml:link rel="alternate" hreflang="${a.lang}" href="${escapeXml(a.href)}"/>\n`
					)
					.join('');
				return (
					'  <url>\n' +
					`    <loc>${escapeXml(u.loc)}</loc>\n` +
					alt +
					`    <lastmod>${today}</lastmod>\n` +
					`    <changefreq>${u.changefreq}</changefreq>\n` +
					`    <priority>${u.priority}</priority>\n` +
					'  </url>'
				);
			})
			.join('\n') +
		'\n</urlset>\n';

	return new Response(body, {
		headers: {
			'content-type': 'application/xml; charset=utf-8',
			'cache-control': 'public, max-age=3600'
		}
	});
}

function escapeXml(s) {
	return String(s).replace(
		/[&<>"']/g,
		(c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]
	);
}
