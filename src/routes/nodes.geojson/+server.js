import { absUrl } from '$lib/config.js';
import { nodeHref } from '$lib/data/collections.js';
import { loadNodeIndex } from '$lib/server/nodes.js';

export const prerender = true;
// 루트 레이아웃의 trailingSlash:'always' 가 파일형 엔드포인트에 붙지 않도록 명시 (sitemap.xml 참고)
export const trailingSlash = 'never';

/* location_precision 등급별 근사 불확실성 반경(m). GIS 사용자가 좌표를 버퍼/신뢰구간으로
   다룰 수 있게 하는 값이며, exact 는 0, unknown 은 반경을 특정할 수 없어 null. */
const PRECISION_RADIUS_M = {
	exact: 0,
	street: 200,
	village: 2000,
	town: 10000,
	city: 30000,
	region: 100000,
	unknown: null
};

function omitEmpty(obj) {
	return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== '' && v != null));
}

export async function GET() {
	const { nodes } = await loadNodeIndex();

	const features = nodes
		.filter((n) => n.lat && n.lng)
		.map((n) => ({
			type: 'Feature',
			geometry: { type: 'Point', coordinates: [n.lng, n.lat] },
			properties: omitEmpty({
				id: n.id,
				type: n.type,
				name: n.name,
				settlementType: n.settlementType,
				founded: n.founded,
				dissolved: n.dissolved,
				address: n.address,
				relatedTown: n.relatedTownAll || n.relatedTown,
				source: n.source,
				locationPrecision: n.locationPrecision,
				locationPrecisionRadiusM: PRECISION_RADIUS_M[n.locationPrecision] ?? null,
				certaintyScore: n.certaintyScore,
				url: nodeHref(n) ? absUrl(nodeHref(n)) : null
			})
		}));

	// GeoJSON(RFC 7946)은 좌표계를 WGS84(EPSG:4326)로 고정하므로 별도 CRS 명시가 불필요하다.
	const body = {
		type: 'FeatureCollection',
		properties: {
			license: 'CC BY 4.0 — https://creativecommons.org/licenses/by/4.0/',
			attribution: '코리아타운 DB (Korean Diaspora Research Team)',
			source: absUrl('/'),
			generated: new Date().toISOString().slice(0, 10)
		},
		features
	};

	return new Response(JSON.stringify(body), {
		headers: {
			'content-type': 'application/geo+json; charset=utf-8',
			'cache-control': 'public, max-age=3600'
		}
	});
}
