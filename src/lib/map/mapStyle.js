/* MapLibre 라스터 스타일 (키 불필요)
   - osm-light : OpenStreetMap 라스터 (밝음)
   - carto-dark: CARTO dark_all 라스터 (어두움)
   두 레이어의 raster-opacity 를 블렌드하여 기존 Leaflet 다크맵 슬라이더를 재현한다.
   심볼/텍스트 레이어를 쓰지 않으므로 glyphs/sprite(=API 키)가 필요 없다. */
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
				tiles: [
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
			}
		]
	};
}

/* 2계층 표시 임계 줌 (기존 ZOOM_DETAIL_THRESHOLD) */
export const ZOOM_DETAIL_THRESHOLD = 10;
