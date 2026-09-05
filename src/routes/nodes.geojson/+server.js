import { absUrl } from '$lib/config.js';
import { nodeHref } from '$lib/data/collections.js';
import { BUILD_DATE, loadNodeIndex } from '$lib/server/nodes.js';

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
			generated: BUILD_DATE,
			/* 이 파일만 따로 돌아다녀도 인용 방법이 함께 가도록 문구를 심어 둔다.
			   각 피처의 url 필드는 원본 항목 페이지를 가리키므로, GIS 도구의 팝업에
			   그 필드를 노출하면 사료 근거까지 되짚어 올 수 있다. */
			citation: `코리아타운 DB (코리안 디아스포라 연구팀), CC BY 4.0, ${absUrl('/')} (${BUILD_DATE} 스냅샷)`,
			featureUrlField: 'url'
		},
		features
	};

	return new Response(JSON.stringify(body), {
		headers: {
			'content-type': 'application/geo+json; charset=utf-8',
			'cache-control': 'public, max-age=3600',
			// content-disposition 이 없으면 브라우저가 파일을 저장하지 않고 텍스트로 열어 버린다
			// (버튼을 눌러도 "다운로드"가 아니라 새 탭에 JSON 이 뜨는 상태였음).
			// attachment 로 강제해도 QGIS/GDAL·fetch() 같은 비-브라우저 클라이언트는 이 헤더를
			// 무시하고 그대로 본문을 읽으므로, URL을 직접 데이터소스로 넣는 워크플로는 영향받지 않는다.
			'content-disposition': `attachment; filename="korean-towns-db-${BUILD_DATE}.geojson"`,
			// 공개 데이터(CC BY 4.0)이므로 geojson.io·kepler.gl 등 브라우저에서 fetch() 로
			// 이 URL을 직접 불러오는 웹 GIS 도구도 CORS 없이 쓸 수 있게 연다.
			'access-control-allow-origin': '*'
		}
	});
}
