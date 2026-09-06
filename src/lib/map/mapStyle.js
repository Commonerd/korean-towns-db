import { ICON_BASE_SIZE } from './iconAtlas.js';

// Optional Carto API key (set VITE_CARTO_API_KEY in .env if you have one)
const CARTO_KEY = import.meta.env.VITE_CARTO_API_KEY ?? '';

/* CARTO 는 2024년 이후 basemap 타일에 API 키를 요구한다 — 키가 없으면 지도 대신
   "API KEY REQUIRED" 라는 워터마크가 찍힌 이미지를 (에러가 아니라 200 OK 로) 그대로
   내려준다. 그래서 VITE_CARTO_API_KEY 가 비어 있으면 CARTO 소스(다크모드·라벨없음
   변형) 전부가 이 워터마크로 보인다 — .env 에 무료 CARTO 계정 키를 넣어야 한다. */
function cartoTiles(style) {
	const suffix = CARTO_KEY ? `?key=${CARTO_KEY}` : '';
	return ['a', 'b', 'c', 'd'].map(
		(sub) => `https://${sub}.basemaps.cartocdn.com/${style}/{z}/{x}/{y}.png${suffix}`
	);
}

/* MapLibre 라스터 스타일
   - osm-light : OpenStreetMap 라스터 (밝음, 지명 있음) — 키 불필요
   - carto-dark: CARTO dark_all 라스터 (어두움, 지명 있음) — ⚠️ CARTO 키 필요(위 참고)
   - light-nolabels/dark-nolabels: 위 둘의 지명 없는 CARTO 짝 — "지명·도로 표시" 토글이 꺼지면
     이 둘로 완전히 바꿔 낀다(둘을 동시에 반투명으로 겹치면 글자가 이중으로 비쳐 보이므로
     라벨 유무 두 쌍 중 한쪽은 항상 0, 다른 쪽만 라이트/다크 블렌드).
   MapView.svelte 의 applyBaseLayer 가 라이트/다크 슬라이더·라벨 토글·위성 전환을
   raster-opacity 로 종합해서 낸다.

   kt-halo/kt-icons/kt-badges/kt-labels 는 상세줌(zoom>=10)에서 마을·조직·인물을
   DOM 마커 대신 GPU 심볼/서클 레이어로 그리기 위한 소스다. text-field(라벨/뱃지 숫자)는
   style.glyphs(폰트 서버) 설정이 있어야 렌더링되는데, API 키 없이 동작시키기 위해
   glyphs 는 의도적으로 생략했다 — 대신 아이콘·라벨·뱃지 모두 iconAtlas.js 에서 캔버스로
   미리 그려 등록한 이미지를 icon-image 로 참조한다 (스프라이트/글리프 서버 불필요). */
export function createMapStyle() {
	return {
		version: 8,
		sources: {
			'osm-light': {
				type: 'raster',
				tiles: [
					'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
					'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
					'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'
				],
				tileSize: 256,
				maxzoom: 19,
				attribution: '&copy; OpenStreetMap contributors'
			},
			'carto-dark': {
				type: 'raster',
				tiles: cartoTiles('dark_all'),
				tileSize: 256,
				maxzoom: 19,
				attribution: '&copy; <a href="https://carto.com/">CARTO</a>'
			},
			/* CARTO 의 라벨 없는(_nolabels) 변형 — osm-light 원본(OSM raw 타일)에는
			   이런 변형이 없어서, 지명·도로 표시를 끄는 용도로만 이 둘을 쓴다. 켜져 있을
			   땐 osm-light/carto-dark 와 동일한 blend 를 이 둘로 대신한다. */
			'light-nolabels': {
				type: 'raster',
				tiles: cartoTiles('light_nolabels'),
				tileSize: 256,
				maxzoom: 19,
				attribution: '&copy; <a href="https://carto.com/">CARTO</a>'
			},
			'dark-nolabels': {
				type: 'raster',
				tiles: cartoTiles('dark_nolabels'),
				tileSize: 256,
				maxzoom: 19,
				attribution: '&copy; <a href="https://carto.com/">CARTO</a>'
			},
			/* 위성/항공 사진 (키 불필요). 지도(도식) ↔ 위성 전환용 — 지형 모드와는
			   별개 축이라 osm-light/carto-dark 와 마찬가지로 raster-opacity 로 켜고 끈다. */
			satellite: {
				type: 'raster',
				tiles: [
					'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
				],
				tileSize: 256,
				maxzoom: 19,
				attribution: 'Esri, Maxar, Earthstar Geographics'
			},
			/* 위성사진 위에 지명·도로·경계선만 투명 배경으로 얹는 참조 레이어(키 불필요).
			   위성만 켜면 글자 하나 없는 항공사진이라 "하이브리드" 보기용으로 별도 토글한다. */
			'osm-labels': {
				type: 'raster',
				tiles: [
					'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'
				],
				tileSize: 256,
				maxzoom: 19,
				attribution: 'Esri'
			},
			'network-lines': {
				type: 'geojson',
				data: { type: 'FeatureCollection', features: [] }
			},
			'spider-legs': {
				type: 'geojson',
				data: { type: 'FeatureCollection', features: [] }
			},
			'kt-halo': {
				type: 'geojson',
				data: { type: 'FeatureCollection', features: [] }
			},
			'kt-icons': {
				type: 'geojson',
				data: { type: 'FeatureCollection', features: [] }
			},
			'kt-badges': {
				type: 'geojson',
				data: { type: 'FeatureCollection', features: [] }
			},
			'kt-labels': {
				type: 'geojson',
				data: { type: 'FeatureCollection', features: [] }
			}
		},
		layers: [
			{ id: 'osm-light', type: 'raster', source: 'osm-light', paint: { 'raster-opacity': 1 } },
			{ id: 'carto-dark', type: 'raster', source: 'carto-dark', paint: { 'raster-opacity': 0 } },
			{ id: 'light-nolabels', type: 'raster', source: 'light-nolabels', paint: { 'raster-opacity': 0 } },
			{ id: 'dark-nolabels', type: 'raster', source: 'dark-nolabels', paint: { 'raster-opacity': 0 } },
			{ id: 'satellite', type: 'raster', source: 'satellite', paint: { 'raster-opacity': 0 } },
			{
				id: 'osm-labels',
				type: 'raster',
				source: 'osm-labels',
				layout: { visibility: 'none' },
				paint: { 'raster-opacity': 0.9 }
			},
			{
				id: 'network-lines',
				type: 'line',
				source: 'network-lines',
				layout: { 'line-cap': 'round', 'line-join': 'round' },
				paint: {
					'line-color': ['get', 'color'],
					'line-width': 2,
					'line-opacity': 0.6,
					'line-dasharray': [0, 4, 3]
				}
			},
			{
				id: 'spider-legs',
				type: 'line',
				source: 'spider-legs',
				layout: { 'line-cap': 'round' },
				paint: {
					'line-color': '#94a3b8',
					'line-width': 1.5,
					'line-opacity': 0.7
				}
			},
			{
				id: 'kt-halo',
				type: 'circle',
				source: 'kt-halo',
				paint: {
					'circle-radius': ['get', 'haloRadiusPx'],
					'circle-color': ['get', 'color'],
					'circle-opacity': ['get', 'haloOpacity'],
					'circle-blur': 0.65
				}
			},
			{
				id: 'kt-icons',
				type: 'symbol',
				source: 'kt-icons',
				layout: {
					'icon-image': ['get', 'iconImageId'],
					'icon-size': ['/', ['get', 'markerSizePx'], ICON_BASE_SIZE],
					'icon-allow-overlap': true,
					'icon-ignore-placement': true
				},
				paint: {
					'icon-opacity': ['get', 'markerOpacity']
				}
			},
			{
				id: 'kt-badges',
				type: 'symbol',
				source: 'kt-badges',
				layout: {
					'icon-image': ['get', 'badgeImageId'],
					// 노드 좌표에 얹고 픽셀 오프셋으로 우상단에 배치 (줌 무관, 항상 붙어있음)
					'icon-offset': [14, -14],
					'icon-allow-overlap': true,
					'icon-ignore-placement': true
				}
			},
			{
				id: 'kt-labels',
				type: 'symbol',
				source: 'kt-labels',
				layout: {
					'icon-image': ['get', 'labelImageId'],
					// 노드 좌표에 얹고 아래쪽으로 픽셀 오프셋 (줌 무관, 항상 붙어있음)
					'icon-anchor': 'top',
					'icon-offset': [0, 20],
					'icon-allow-overlap': true,
					'icon-ignore-placement': true
				}
			}
		]
	};
}

/* 2계층 표시 임계 줌 (기존 ZOOM_DETAIL_THRESHOLD) */
export const ZOOM_DETAIL_THRESHOLD = 10;
