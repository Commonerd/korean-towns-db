import maplibregl from 'maplibre-gl';
import Supercluster from 'supercluster';
import { ZOOM_DETAIL_THRESHOLD } from './mapStyle.js';
import { createMarkerEl, createClusterEl, createLabelEl } from './icons.js';
import { buildPopupHtml } from './popup.js';
import { filterData } from '$lib/data/filter.js';

const WORLD_BBOX = [-180, -85, 180, 85];
const prefersReduced =
	typeof window !== 'undefined' &&
	window.matchMedia &&
	window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* 애니메이션 대시 시퀀스 (MapLibre 공식 "animate a line" 예제 이식) */
const DASH_SEQUENCE = [
	[0, 4, 3],
	[0.5, 4, 2.5],
	[1, 4, 2],
	[1.5, 4, 1.5],
	[2, 4, 1],
	[2.5, 4, 0.5],
	[3, 4, 0],
	[0, 0.5, 3, 3.5],
	[0, 1, 3, 3],
	[0, 1.5, 3, 2.5],
	[0, 2, 3, 2],
	[0, 2.5, 3, 1.5],
	[0, 3, 3, 1],
	[0, 3.5, 3, 0.5]
];

/**
 * 지도 렌더링/상호작용을 캡슐화하는 컨트롤러.
 * Svelte 컴포넌트는 상태 변화 시 update()/setData()만 호출하고,
 * 클러스터링·마커·라인 등 명령형 로직은 여기서 처리한다.
 */
export class MapController {
	constructor(map, { onSelectTown, onAskAI } = {}) {
		this.map = map;
		this.onSelectTown = onSelectTown || (() => {});
		this.onAskAI = onAskAI || (() => {});

		this.rawData = [];
		this.filter = 'all';
		this.search = '';
		this.yearEnabled = false;
		this.yearMin = 1860;
		this.yearMax = 2026;
		this.yearRangeMin = 1860;
		this.yearRangeMax = 2026;
		this.selectedTownName = null;
		this.darkOpacity = 0;

		this._markers = []; // { marker, itemId? }
		this._index = null;
		this._villageMap = {};
		this._raf = null;
		this._pendingPopupId = null;
		this._dashStep = 0;
		this._dashTimer = null;
		this._lastDashTs = 0;

		this._ensureLineLayer();

		// 줌 변화 시에만 재렌더 (기존 zoomend 동작과 동일, 패닝 시 깜빡임 방지)
		this._onZoomEnd = () => this.scheduleRender();
		this.map.on('zoomend', this._onZoomEnd);

		// 팝업 내 "AI 해설" 버튼 위임 처리
		this._docClick = (e) => {
			const btn = e.target.closest && e.target.closest('[data-ai-id]');
			if (btn) {
				const id = parseInt(btn.dataset.aiId, 10);
				if (!Number.isNaN(id)) this.onAskAI(id);
			}
		};
		document.addEventListener('click', this._docClick);

		if (!prefersReduced) this._startDashAnimation();
	}

	/* ====== 외부 API ====== */
	setData(rawData) {
		this.rawData = rawData || [];
		this._rebuildIndex();
		this.scheduleRender();
	}

	update(state = {}) {
		let indexDirty = false;
		for (const key of [
			'filter',
			'search',
			'yearEnabled',
			'yearMin',
			'yearMax',
			'yearRangeMin',
			'yearRangeMax'
		]) {
			if (key in state && state[key] !== this[key]) {
				this[key] = state[key];
				indexDirty = true;
			}
		}
		if ('selectedTownName' in state) this.selectedTownName = state.selectedTownName;
		if ('darkOpacity' in state && state.darkOpacity !== this.darkOpacity) {
			this.darkOpacity = state.darkOpacity;
			this._applyDark();
		}
		if (indexDirty) this._rebuildIndex();
		this.scheduleRender();
	}

	destroy() {
		this.map.off('zoomend', this._onZoomEnd);
		document.removeEventListener('click', this._docClick);
		if (this._raf) cancelAnimationFrame(this._raf);
		if (this._dashTimer) cancelAnimationFrame(this._dashTimer);
		this._clearMarkers();
	}

	/* ====== 필터 (공용 filterData 사용) ====== */
	getFilteredData() {
		return filterData(this.rawData, {
			filter: this.filter,
			search: this.search,
			yearEnabled: this.yearEnabled,
			yearMin: this.yearMin,
			yearMax: this.yearMax,
			yearRangeMin: this.yearRangeMin,
			yearRangeMax: this.yearRangeMax
		});
	}

	/* ====== 렌더 스케줄링 (zoomend/상태변경 dedupe) ====== */
	scheduleRender() {
		if (this._raf) return;
		this._raf = requestAnimationFrame(() => {
			this._raf = null;
			this._render();
			this._afterRender();
		});
	}

	/* ====== 내부: 클러스터 인덱스 ====== */
	_rebuildIndex() {
		const villagesAll = this.rawData.filter((d) => d.type === '마을');
		this._villageMap = {};
		villagesAll.forEach((v) => {
			this._villageMap[v.name] = v;
		});

		const filtered = this.getFilteredData();
		const filteredVillages = filtered.filter((d) => d.type === '마을' && d.lat && d.lng);
		const points = filteredVillages.map((v) => ({
			type: 'Feature',
			properties: { itemId: v.id },
			geometry: { type: 'Point', coordinates: [v.lng, v.lat] }
		}));
		this._index = new Supercluster({
			radius: 40,
			maxZoom: ZOOM_DETAIL_THRESHOLD - 1
		}).load(points);
	}

	/* ====== 내부: 렌더 (기존 renderMap 이식) ====== */
	_render() {
		if (!this.map) return;
		this._clearMarkers();

		const filtered = this.getFilteredData();
		const zoom = this.map.getZoom();
		const isDetailMode = zoom >= ZOOM_DETAIL_THRESHOLD;
		const filteredOrgsPersons = filtered.filter((d) => d.type !== '마을');
		const byId = new Map(this.rawData.map((d) => [d.id, d]));

		/* 1. 마을 마커 (supercluster) */
		if (this._index) {
			const clusters = this._index.getClusters(WORLD_BBOX, Math.floor(zoom));
			for (const feature of clusters) {
				const [lng, lat] = feature.geometry.coordinates;
				if (feature.properties.cluster) {
					this._addClusterMarker(lng, lat, feature.properties);
				} else {
					const item = byId.get(feature.properties.itemId);
					if (item) this._addVillageMarker(item, isDetailMode);
				}
			}
		}

		/* 2. 조직/인물 표시 (기존 로직 이식) */
		filteredOrgsPersons.forEach((item) => {
			if (item.isPrecise && item.lat && item.lng) {
				if (this.filter === 'all' && !isDetailMode) return;
				const isHighlighted = this.selectedTownName && item.relatedTown === this.selectedTownName;
				this._addItemMarker(item, item.lat, item.lng, { isHighlighted }, isDetailMode);
				return;
			}

			const showFloating = isDetailMode || this.filter === item.type;
			if (!showFloating) return;

			const parentVillage = this._villageMap[item.relatedTown];
			if (!parentVillage || !parentVillage.lat || !parentVillage.lng) return;

			const siblings = this.rawData.filter(
				(d) => d.type !== '마을' && !d.isPrecise && d.relatedTown === parentVillage.name
			);
			const idx = siblings.findIndex((s) => s.id === item.id);
			const total = siblings.length || 1;
			const [flat, flng] = this._computeFloatingLatLng(parentVillage, idx, total);
			const isHighlighted = this.selectedTownName && item.relatedTown === this.selectedTownName;
			this._addItemMarker(item, flat, flng, { isHighlighted, isFloating: true }, isDetailMode);
		});

		this._drawLines();
	}

	_addClusterMarker(lng, lat, props) {
		const el = createClusterEl(props.point_count);
		el.addEventListener('click', () => {
			const expansionZoom = Math.min(this._index.getClusterExpansionZoom(props.cluster_id), 16);
			this.map.easeTo({ center: [lng, lat], zoom: expansionZoom });
		});
		const marker = new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(this.map);
		this._markers.push({ marker });
	}

	_addVillageMarker(item, isDetailMode) {
		const childCount = this.rawData.filter(
			(d) => d.type !== '마을' && d.relatedTown === item.name
		).length;
		const isHighlighted = this.selectedTownName && item.name === this.selectedTownName;
		const { el, popupOffset } = createMarkerEl('마을', {
			isHighlighted,
			badgeCount: childCount,
			settlementType: item.settlementType,
			certaintyScore: item.certaintyScore
		});
		this._wireMarker(el, item, popupOffset, item.lat, item.lng);
		if (isDetailMode) this._addLabel(item.lat, item.lng, item.name);
	}

	_addItemMarker(item, lat, lng, opts, isDetailMode) {
		const { el, popupOffset } = createMarkerEl(item.type, {
			...opts,
			certaintyScore: item.certaintyScore
		});
		this._wireMarker(el, item, popupOffset, lat, lng);
		if (isDetailMode) this._addLabel(lat, lng, item.name);
	}

	_wireMarker(el, item, popupOffset, lat, lng) {
		const popup = new maplibregl.Popup({
			offset: popupOffset,
			maxWidth: '340px',
			closeButton: true
		}).setHTML(buildPopupHtml(item, this.rawData));

		const marker = new maplibregl.Marker({ element: el })
			.setLngLat([lng, lat])
			.setPopup(popup)
			.addTo(this.map);

		el.addEventListener('click', () => {
			if (item.type === '마을') this.onSelectTown(item.name);
			else if (item.relatedTown) this.onSelectTown(item.relatedTown);
		});

		this._markers.push({ marker, itemId: item.id });
	}

	_addLabel(lat, lng, text) {
		const el = createLabelEl(text);
		const marker = new maplibregl.Marker({ element: el, anchor: 'top', offset: [0, 6] })
			.setLngLat([lng, lat])
			.addTo(this.map);
		this._markers.push({ marker });
	}

	/* 부유 노드 좌표 (기존 computeFloatingLatLng 이식) → [lat, lng] 반환 */
	_computeFloatingLatLng(village, idx, total) {
		const zoom = this.map.getZoom();
		const baseRadiusDeg = 0.45;
		const radius = baseRadiusDeg * Math.pow(0.55, Math.max(0, zoom - 7));
		const angle = (idx / total) * Math.PI * 2 - Math.PI / 2;
		const dLat = radius * Math.sin(angle);
		const lonCorr = 1 / Math.max(0.2, Math.cos((village.lat * Math.PI) / 180));
		const dLng = radius * Math.cos(angle) * lonCorr;
		return [village.lat + dLat, village.lng + dLng];
	}

	/* ====== 네트워크 라인 (기존 drawRelationshipLines 이식) ======
	   source/layer 는 초기 스타일(createMapStyle)에 포함되어 있으므로
	   여기서는 존재를 보장하는 방어 코드만 둔다. */
	_ensureLineLayer() {
		if (this.map.getSource('network-lines')) {
			if (prefersReduced && this.map.getLayer('network-lines')) {
				this.map.setPaintProperty('network-lines', 'line-dasharray', [2, 3]);
			}
			return;
		}
		this.map.addSource('network-lines', {
			type: 'geojson',
			data: { type: 'FeatureCollection', features: [] }
		});
		this.map.addLayer({
			id: 'network-lines',
			type: 'line',
			source: 'network-lines',
			layout: { 'line-cap': 'round', 'line-join': 'round' },
			paint: {
				'line-color': ['get', 'color'],
				'line-width': 2,
				'line-opacity': 0.6,
				'line-dasharray': prefersReduced ? [2, 3] : [0, 4, 3]
			}
		});
	}

	_drawLines() {
		const posById = new Map();
		for (const m of this._markers) {
			if (m.itemId !== undefined) {
				const ll = m.marker.getLngLat();
				posById.set(m.itemId, [ll.lng, ll.lat]);
			}
		}

		const features = [];
		this.rawData.forEach((item) => {
			const from = posById.get(item.id);
			if (!from) return;

			let target = null;
			let color = '#64748b';
			if (item.type === '조직' && item.relatedTown) {
				target = this.rawData.find((d) => d.type === '마을' && d.name === item.relatedTown);
				color = '#2563eb';
			} else if (item.type === '인물') {
				if (item.relatedOrg) {
					target = this.rawData.find((d) => d.type === '조직' && d.name === item.relatedOrg);
					color = '#16a34a';
				}
				if (!target && item.relatedTown) {
					target = this.rawData.find((d) => d.type === '마을' && d.name === item.relatedTown);
					color = '#16a34a';
				}
			}
			if (!target) return;
			const to = posById.get(target.id);
			if (!to) return;

			features.push({
				type: 'Feature',
				properties: { color },
				geometry: { type: 'LineString', coordinates: [from, to] }
			});
		});

		const src = this.map.getSource('network-lines');
		if (src) src.setData({ type: 'FeatureCollection', features });
	}

	_startDashAnimation() {
		const speed = 55; // ms/step
		const tick = (ts) => {
			this._dashTimer = requestAnimationFrame(tick);
			if (ts - this._lastDashTs < speed) return;
			this._lastDashTs = ts;
			this._dashStep = (this._dashStep + 1) % DASH_SEQUENCE.length;
			if (this.map.getLayer && this.map.getLayer('network-lines')) {
				this.map.setPaintProperty('network-lines', 'line-dasharray', DASH_SEQUENCE[this._dashStep]);
			}
		};
		this._dashTimer = requestAnimationFrame(tick);
	}

	/* ====== 다크맵 블렌드 ====== */
	_applyDark() {
		if (this.map.getLayer('osm-light'))
			this.map.setPaintProperty('osm-light', 'raster-opacity', 1 - this.darkOpacity);
		if (this.map.getLayer('carto-dark'))
			this.map.setPaintProperty('carto-dark', 'raster-opacity', this.darkOpacity);
	}

	/* ====== 포커스 (기존 focusOnMap 의 지도 이동 부분 이식) ====== */
	focus(item) {
		const lat = parseFloat(item.lat);
		const lng = parseFloat(item.lng);
		let targetLat = lat,
			targetLng = lng,
			targetZoom = 8;

		if (item.type !== '마을' && !item.isPrecise) {
			const parent = this.rawData.find((d) => d.type === '마을' && d.name === item.relatedTown);
			if (parent && parent.lat && parent.lng) {
				targetLat = parent.lat;
				targetLng = parent.lng;
				targetZoom = Math.max(ZOOM_DETAIL_THRESHOLD + 1, 8);
			}
		} else if (item.type === '마을') {
			targetZoom = Math.max(ZOOM_DETAIL_THRESHOLD + 1, 8);
		} else {
			targetZoom = Math.max(ZOOM_DETAIL_THRESHOLD + 1, 9);
		}

		if (isNaN(targetLat) || isNaN(targetLng) || !targetLat || !targetLng) return;

		this._pendingPopupId = item.id;
		this.map.flyTo({ center: [targetLng, targetLat], zoom: targetZoom, duration: 800 });
		this.map.once('moveend', () => this.scheduleRender());
	}

	_afterRender() {
		if (this._pendingPopupId == null) return;
		const entry = this._markers.find((m) => m.itemId === this._pendingPopupId);
		if (entry) {
			const popup = entry.marker.getPopup();
			if (popup && !popup.isOpen()) entry.marker.togglePopup();
			this._pendingPopupId = null;
		}
	}

	_clearMarkers() {
		for (const m of this._markers) m.marker.remove();
		this._markers = [];
	}
}
