import { absUrl } from '$lib/config.js';
import { COLLECTIONS, collectionHref, nodeHref } from '$lib/data/collections.js';
import { nodesOfType } from '$lib/data/relations.js';
import { loadNodeIndex } from '$lib/server/nodes.js';

export const prerender = true;
// 루트 레이아웃의 trailingSlash:'always' 가 파일형 엔드포인트에 붙지 않도록 명시
export const trailingSlash = 'never';

export async function GET() {
	const { index } = await loadNodeIndex();
	const today = new Date().toISOString().slice(0, 10);

	const urls = [
		{ loc: absUrl('/'), priority: '1.0', changefreq: 'weekly' },
		{ loc: absUrl('/map/'), priority: '0.9', changefreq: 'weekly' },
		{ loc: absUrl('/license/'), priority: '0.3', changefreq: 'yearly' }
	];

	for (const c of COLLECTIONS) {
		urls.push({ loc: absUrl(collectionHref(c.slug)), priority: '0.8', changefreq: 'weekly' });
		for (const n of nodesOfType(index, c.type)) {
			const href = nodeHref(n);
			if (href) urls.push({ loc: absUrl(href), priority: '0.6', changefreq: 'monthly' });
		}
	}

	const body =
		'<?xml version="1.0" encoding="UTF-8"?>\n' +
		'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
		urls
			.map(
				(u) =>
					'  <url>\n' +
					`    <loc>${escapeXml(u.loc)}</loc>\n` +
					`    <lastmod>${today}</lastmod>\n` +
					`    <changefreq>${u.changefreq}</changefreq>\n` +
					`    <priority>${u.priority}</priority>\n` +
					'  </url>'
			)
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
