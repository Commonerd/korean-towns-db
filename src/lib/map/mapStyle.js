import { ICON_BASE_SIZE } from './iconAtlas.js';

// Optional Carto API key (set VITE_CARTO_API_KEY in .env if you have one)
const CARTO_KEY = import.meta.env.VITE_CARTO_API_KEY ?? '';

/* MapLibre 라스터 스타일 (키 불필요)
   - osm-light : OpenStreetMap 라스터 (밝음)
   - carto-dark: CARTO dark_all 라스터 (어두움)
   두 레이어의 raster-opacity 를 블렌드하여 기존 Leaflet 다크맵 슬라이더를 재현한다.

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
				tiles: CARTO_KEY
					? [
						  `https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png?apiKey=${CARTO_KEY}`,
						  `https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png?apiKey=${CARTO_KEY}`,
						  `https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png?apiKey=${CARTO_KEY}`,
						  `https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png?apiKey=${CARTO_KEY}`
					  ]
					: [
						  'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
						  'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
						  'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
						  'https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'
					  ],
				tileSize: 256,
				maxzoom: 19,
				attribution: '&copy; <a href="https://carto.com/">CARTO</a>'
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
