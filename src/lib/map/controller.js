import maplibregl from 'maplibre-gl';
import Supercluster from 'supercluster';
import { ZOOM_DETAIL_THRESHOLD } from './mapStyle.js';
import { createMarkerEl, createClusterEl, createLabelEl, computeMarkerVisual } from './icons.js';
import {
	iconImageId,
	ensureIconImages,
	ensureLabelImage,
	ensureBadgeImage,
	ICON_BASE_SIZE
} from './iconAtlas.js';
import { buildPopupHtml } from './popup.js';
import { filterData } from '$lib/data/filter.js';

const WORLD_BBOX = [-180, -85, 180, 85];

const GPU_SOURCE_IDS = ['kt-halo', 'kt-icons', 'kt-badges', 'kt-labels'];

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
 *
 * 저줌(zoom<10, 클러스터 상태)에서는 DOM 마커(maplibregl.Marker)를 쓰고,
 * 상세줌(zoom>=10)에서는 마을·조직·인물을 GPU 심볼/서클 레이어로 그린다.
 * 포인트 수가 많아져도 상세줌에서 팬/줌이 매끄럽도록 하기 위함이다.
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

		this._markers = []; // DOM 마커 (저줌 클러스터 상태): { marker, itemId? }
		this._positions = new Map(); // itemId -> { coord:[lng,lat], popupOffset } (DOM+GPU 공통, 라인/포커스용)
		this._activePopup = null; // GPU 클릭으로 연 팝업(마커에 바인딩되지 않음)
		this._index = null;
		this._villageMap = {};
		this._raf = null;
		this._pendingPopupId = null;
		this._dashStep = 0;
		this._dashTimer = null;
		this._lastDashTs = 0;
		this._iconsReady = false;
		this._detailDirty = true; // 마을 GPU 피처 캐시 재계산 필요 여부
		this._villageFeatures = null; // 캐시된 마을 GPU 피처 { icons, halo, badges, labels }
		this._villagePositions = null; // 캐시된 마을 위치 Map(id -> {coord, popupOffset})
		this._spider = null; // 스파이더파이 상태 { clusterId, center, entries }
		this._spiderMarkers = []; // 펼쳐진 leaf DOM 마커 (일반 렌더로 지워지지 않음)
		this._spiderAnim = null; // 펼침/접힘 애니메이션 rAF 핸들

		this._ensureLineLayer();
		this._ensureGpuLayers();

		ensureIconImages(this.map).then(() => {
			this._iconsReady = true;
			this.scheduleRender();
		});

		// 줌 변화 시에만 재렌더 (기존 zoomend 동작과 동일, 패닝 시 깜빡임 방지)
		this._onZoomEnd = () => this.scheduleRender();
		this.map.on('zoomend', this._onZoomEnd);

		// 줌 시작하면 펼쳐진 스파이더 정리
		this._onZoomStart = () => this._clearSpider();
		this.map.on('zoomstart', this._onZoomStart);

		// 빈 지도(마커 아님) 클릭 시 스파이더 정리. DOM 마커 클릭은 map 'click'을 발생시키지
		// 않으므로 펼쳐진 leaf 마커·클러스터 클릭에는 영향을 주지 않는다.
		this._onMapClick = () => {
			if (this._spider) this._clearSpider(true);
		};
		this.map.on('click', this._onMapClick);

		// GPU 아이콘 클릭/호버 (상세줌 마을·조직·인물)
		this._onIconClick = (e) => this._handleIconClick(e);
		this._onIconEnter = () => {
			this.map.getCanvas().style.cursor = 'pointer';
		};
		this._onIconLeave = () => {
			this.map.getCanvas().style.cursor = '';
		};
		this.map.on('click', 'kt-icons', this._onIconClick);
		this.map.on('mouseenter', 'kt-icons', this._onIconEnter);
		this.map.on('mouseleave', 'kt-icons', this._onIconLeave);

		// 팝업 내 "AI 해설" 버튼 위임 처리
		this._docClick = (e) => {
			const btn = e.target.closest && e.target.closest('[data-ai-id]');
			if (btn) {
				const id = parseInt(btn.dataset.aiId, 10);
				if (!Number.isNaN(id)) this.onAskAI(id);
			}
		};
		document.addEventListener('click', this._docClick);

		// 연결선 대시 + halo 펄스 애니메이션 (기존 Leaflet 지도는 reduced-motion 과
		// 무관하게 항상 애니메이션했으므로 여기서도 항상 실행한다).
		this._startAnimations();
	}

	/* ====== 외부 API ====== */
	setData(rawData) {
		this.rawData = rawData || [];
		this._rebuildIndex();
		this._detailDirty = true;
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
		if (indexDirty) this._detailDirty = true;
		if ('selectedTownName' in state && state.selectedTownName !== this.selectedTownName) {
			this.selectedTownName = state.selectedTownName;
			this._detailDirty = true;
		}
		if ('darkOpacity' in state && state.darkOpacity !== this.darkOpacity) {
			this.darkOpacity = state.darkOpacity;
			this._applyDark();
		}
		if (indexDirty) this._rebuildIndex();
		this.scheduleRender();
	}

	destroy() {
		this.map.off('zoomend', this._onZoomEnd);
		this.map.off('zoomstart', this._onZoomStart);
		this.map.off('click', this._onMapClick);
		this.map.off('click', 'kt-icons', this._onIconClick);
		this.map.off('mouseenter', 'kt-icons', this._onIconEnter);
		this.map.off('mouseleave', 'kt-icons', this._onIconLeave);
		document.removeEventListener('click', this._docClick);
		if (this._raf) cancelAnimationFrame(this._raf);
		if (this._dashTimer) cancelAnimationFrame(this._dashTimer);
		this._closeAdHocPopup();
		this._clearSpider();
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

	/* ====== 내부: 렌더 ====== */
	_render() {
		if (!this.map) return;
		// 팝업은 여기서 무조건 닫지 않는다 — 리사이즈/데이터 폴링 등 무관한 재렌더로
		// 사용자가 막 열어본 팝업이 사라지면 안 되기 때문. 새 팝업을 열 때만
		// (_openAdHocPopup 내부에서) 이전 팝업을 닫는다.
		this._clearMarkers();

		const filtered = this.getFilteredData();
		const zoom = this.map.getZoom();
		const isDetailMode = zoom >= ZOOM_DETAIL_THRESHOLD;
		const filteredOrgsPersons = filtered.filter((d) => d.type !== '마을');

		if (isDetailMode) {
			this._renderDetailGPU(filtered, filteredOrgsPersons);
		} else {
			this._positions = new Map();
			this._clearGpuLayers();
			this._renderClusteredDOM(zoom, filteredOrgsPersons, isDetailMode);
		}

		this._drawLines();
	}

	/* 마을 이름 -> 종속 조직/인물 개수. O(n) 1회 순회로 미리 계산해
	   마을 개수만큼 매번 rawData 전체를 훑는 O(n²) 비용을 피한다. */
	_buildChildCountMap() {
		const map = new Map();
		this.rawData.forEach((d) => {
			if (d.type !== '마을' && d.relatedTown) {
				map.set(d.relatedTown, (map.get(d.relatedTown) || 0) + 1);
			}
		});
		return map;
	}

	/* 저줌: 마을은 supercluster+DOM 클러스터, 조직/인물은 조건부 DOM (기존 로직) */
	_renderClusteredDOM(zoom, filteredOrgsPersons, isDetailMode) {
		const byId = new Map(this.rawData.map((d) => [d.id, d]));
		const childCountByTown = this._buildChildCountMap();

		if (this._index) {
			const clusters = this._index.getClusters(WORLD_BBOX, Math.floor(zoom));
			for (const feature of clusters) {
				const [lng, lat] = feature.geometry.coordinates;
				if (feature.properties.cluster) {
					this._addClusterMarker(lng, lat, feature.properties);
				} else {
					const item = byId.get(feature.properties.itemId);
					if (item) this._addVillageMarker(item, isDetailMode, childCountByTown);
				}
			}
		}

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
	}

	/* 마을(수백~수천 개 가능)의 GPU 피처(아이콘/halo/뱃지/라벨)와 위치를 캐시한다.
	   라벨/뱃지는 노드 좌표에 얹고 픽셀 오프셋(레이어 layout)으로 배치하므로 줌과 무관하다.
	   따라서 필터·선택 상태가 안 바뀌는 한(_detailDirty=false) 매 줌마다 다시 계산할
	   필요가 없다 — 이게 상세줌에서 체감 렉과 연결선 애니메이션 끊김의 주된 원인이었다. */
	_rebuildVillageFeatures(filtered) {
		const childCountByTown = this._buildChildCountMap();
		const filteredVillages = filtered.filter((d) => d.type === '마을' && d.lat && d.lng);

		const icons = [];
		const halo = [];
		const badges = [];
		const labels = [];
		const positions = new Map();

		for (const item of filteredVillages) {
			const childCount = childCountByTown.get(item.name) || 0;
			const isHighlighted = this.selectedTownName && item.name === this.selectedTownName;
			const v = computeMarkerVisual('마을', {
				isHighlighted,
				settlementType: item.settlementType,
				certaintyScore: item.certaintyScore,
				badgeCount: childCount
			});
			const coord = [item.lng, item.lat];
			positions.set(item.id, { coord, popupOffset: Math.round(v.size / 2 + 6) });

			icons.push({
				type: 'Feature',
				properties: {
					itemId: item.id,
					iconImageId: iconImageId('마을', item.settlementType, v.isHighlighted),
					markerSizePx: v.size,
					markerOpacity: v.markerOpacity
				},
				geometry: { type: 'Point', coordinates: coord }
			});
			if (v.showHalo) {
				halo.push({
					type: 'Feature',
					properties: { haloRadiusPx: v.haloSize / 2, haloOpacity: v.haloOpacity, color: v.color },
					geometry: { type: 'Point', coordinates: coord }
				});
			}
			if (v.badgeCount > 0) {
				badges.push({
					type: 'Feature',
					properties: { badgeImageId: ensureBadgeImage(this.map, v.badgeCount) },
					geometry: { type: 'Point', coordinates: coord }
				});
			}
			labels.push({
				type: 'Feature',
				properties: { labelImageId: ensureLabelImage(this.map, item.name) },
				geometry: { type: 'Point', coordinates: coord }
			});
		}

		this._villageFeatures = { icons, halo, badges, labels };
		this._villagePositions = positions;
	}

	/* 상세줌(zoom>=10): 클러스터가 없는 구간이므로 마을·조직·인물을 GPU 레이어로 그린다.
	   라벨/뱃지는 노드 좌표에 얹고 픽셀 오프셋(레이어 layout)으로 배치하므로 좌표가 줌과
	   무관 → 마을 피처는 통째로 캐시해두고 조직/인물만 매 렌더 재계산한다. */
	_renderDetailGPU(filtered, filteredOrgsPersons) {
		if (!this._iconsReady) return; // 아이콘 준비 완료 시 promise 콜백이 재렌더를 트리거함

		if (this._detailDirty || !this._villageFeatures) {
			this._rebuildVillageFeatures(filtered);
			this._detailDirty = false;
		}

		this._positions = new Map(this._villagePositions);
		const iconFeatures = this._villageFeatures.icons.slice();
		const haloFeatures = this._villageFeatures.halo.slice();
		const badgeFeatures = this._villageFeatures.badges.slice();
		const labelFeatures = this._villageFeatures.labels.slice();

		// 조직/인물: 개수가 적고(수십 건 수준) 선택 하이라이트가 자주 바뀌므로 매번 계산한다
		const pushEntity = (item, lng, lat, opts) => {
			const v = computeMarkerVisual(item.type, {
				isHighlighted: opts.isHighlighted,
				isFloating: !!opts.isFloating,
				settlementType: item.settlementType,
				certaintyScore: item.certaintyScore
			});
			const coord = [lng, lat];
			this._positions.set(item.id, { coord, popupOffset: Math.round(v.size / 2 + 6) });

			iconFeatures.push({
				type: 'Feature',
				properties: {
					itemId: item.id,
					iconImageId: iconImageId(item.type, item.settlementType, v.isHighlighted),
					markerSizePx: v.size,
					markerOpacity: v.markerOpacity
				},
				geometry: { type: 'Point', coordinates: coord }
			});
			if (v.showHalo) {
				haloFeatures.push({
					type: 'Feature',
					properties: { haloRadiusPx: v.haloSize / 2, haloOpacity: v.haloOpacity, color: v.color },
					geometry: { type: 'Point', coordinates: coord }
				});
			}
			labelFeatures.push({
				type: 'Feature',
				properties: { labelImageId: ensureLabelImage(this.map, item.name) },
				geometry: { type: 'Point', coordinates: coord }
			});
		};

		filteredOrgsPersons.forEach((item) => {
			if (item.isPrecise && item.lat && item.lng) {
				const isHighlighted = this.selectedTownName && item.relatedTown === this.selectedTownName;
				pushEntity(item, item.lng, item.lat, { isHighlighted });
				return;
			}

			const parentVillage = this._villageMap[item.relatedTown];
			if (!parentVillage || !parentVillage.lat || !parentVillage.lng) return;

			const siblings = this.rawData.filter(
				(d) => d.type !== '마을' && !d.isPrecise && d.relatedTown === parentVillage.name
			);
			const idx = siblings.findIndex((s) => s.id === item.id);
			const total = siblings.length || 1;
			const [flat, flng] = this._computeFloatingLatLng(parentVillage, idx, total);
			const isHighlighted = this.selectedTownName && item.relatedTown === this.selectedTownName;
			pushEntity(item, flng, flat, { isHighlighted, isFloating: true });
		});

		this._setGpuSourceData('kt-halo', haloFeatures);
		this._setGpuSourceData('kt-icons', iconFeatures);
		this._setGpuSourceData('kt-badges', badgeFeatures);
		this._setGpuSourceData('kt-labels', labelFeatures);
	}

	_handleIconClick(e) {
		const feature = e.features && e.features[0];
		if (!feature) return;
		const item = this.rawData.find((d) => d.id === feature.properties.itemId);
		if (!item) return;
		if (item.type === '마을') this.onSelectTown(item.name);
		else if (item.relatedTown) this.onSelectTown(item.relatedTown);

		// 선택 상태 변경이 트리거하는 재렌더가 방금 연 팝업을 지워버리지 않도록,
		// 팝업은 직접 열지 않고 재렌더 이후(_afterRender)에 열리도록 예약한다.
		this._pendingPopupId = item.id;
		this.scheduleRender();
	}

	_setGpuSourceData(id, features) {
		const src = this.map.getSource(id);
		if (src) src.setData({ type: 'FeatureCollection', features });
	}

	_clearGpuLayers() {
		GPU_SOURCE_IDS.forEach((id) => this._setGpuSourceData(id, []));
	}

	_addClusterMarker(lng, lat, props) {
		const el = createClusterEl(props.point_count);
		el.addEventListener('click', (e) => {
			e.stopPropagation();
			this._onClusterClick(props.cluster_id, props.point_count, [lng, lat]);
		});
		const marker = new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(this.map);
		this._markers.push({ marker });
	}

	/* 클러스터 클릭: "확대하면 실제로 쪼개지는가"를 기준으로 판단한다 (기존
	   Leaflet.markercluster 의 _zoomOrSpiderfy 동작 재현) — 단순히 멤버 개수가
	   아니라, supercluster 자체의 클러스터링 한계 줌(마을이 상세줌 GPU 모드로
	   전환되는 지점 직전, 9)까지 가도 여전히 뭉쳐 있는지를 본다.
	   - 확대하면 쪼개짐 → 확대 (실제 지리적 하위 구조를 보여주므로 더 유용)
	   - 좌표가 겹치는 등 확대해도 안 쪼개짐 → 개수가 적으면 스파이더파이로 펼치고,
	     너무 많으면(스파이더가 지저분해지므로) 그래도 확대해 상세줌 개별 마커로 넘긴다.
	   이미 펼쳐진 같은 클러스터를 다시 누르면 접는다(토글). */
	_onClusterClick(clusterId, pointCount, center) {
		if (this._spider && this._spider.clusterId === clusterId) {
			this._clearSpider(true);
			return;
		}
		this._clearSpider();

		const clusterMaxZoom = ZOOM_DETAIL_THRESHOLD - 1; // supercluster 자체 maxZoom
		const expansionZoom = this._index.getClusterExpansionZoom(clusterId);
		const willSplit = expansionZoom <= clusterMaxZoom;
		const SPIDERFY_MAX = 12;

		if (willSplit || pointCount > SPIDERFY_MAX) {
			this.map.easeTo({ center, zoom: Math.min(expansionZoom, 16) });
			return;
		}
		this._spiderfy(clusterId, center);
	}

	/* 스파이더파이: 클러스터 leaf(마을)들을 중심 주변에 원/나선으로 펼치고
	   각 leaf 를 중심과 잇는 다리(leg) 선을 그린다 (기존 Leaflet.markercluster spiderfy 재현).
	   마커·다리는 중심에서 최종 위치까지 스프링 애니메이션으로 퍼진다. */
	_spiderfy(clusterId, center) {
		const leaves = this._index.getLeaves(clusterId, Infinity);
		if (!leaves.length) return;

		const byId = new Map(this.rawData.map((d) => [d.id, d]));
		const childCountByTown = this._buildChildCountMap();
		const centerPt = this.map.project(center);
		const offsets = this._spiderPositions(leaves.length);
		const entries = [];

		leaves.forEach((leaf, i) => {
			const item = byId.get(leaf.properties.itemId);
			if (!item) return;
			const [dx, dy] = offsets[i];
			const ll = this.map.unproject([centerPt.x + dx, centerPt.y + dy]);
			const finalPos = [ll.lng, ll.lat];

			const childCount = childCountByTown.get(item.name) || 0;
			const isHighlighted = this.selectedTownName && item.name === this.selectedTownName;
			const { el } = createMarkerEl('마을', {
				isHighlighted,
				badgeCount: childCount,
				settlementType: item.settlementType,
				certaintyScore: item.certaintyScore
			});
			el.addEventListener('click', (e) => {
				e.stopPropagation();
				this.onSelectTown(item.name);
				this._openAdHocPopup(item, finalPos, Math.round(28 / 2 + 6));
			});
			// 시작 위치는 중심 — 애니메이션으로 finalPos 까지 퍼진다
			const marker = new maplibregl.Marker({ element: el }).setLngLat(center).addTo(this.map);
			const inner = el.firstElementChild;
			if (inner) inner.style.opacity = '0';
			this._spiderMarkers.push(marker);
			entries.push({ marker, finalPos, inner });
		});

		this._spider = { clusterId, center, entries };
		this._runSpiderAnim('out');
	}

	/* 스파이더 펼침('out')/접힘('in') 애니메이션. 마커 위치와 다리 선을 동시에 보간한다. */
	_runSpiderAnim(dir, onDone) {
		if (this._spiderAnim) cancelAnimationFrame(this._spiderAnim);
		const spider = this._spider;
		if (!spider) {
			if (onDone) onDone();
			return;
		}
		const { center, entries } = spider;
		const DURATION = 280;
		// easeOutBack: 살짝 튕기며 퍼짐 / easeIn(제곱): 가속하며 모임
		const easeOutBack = (t) => {
			const c1 = 1.70158;
			const c3 = c1 + 1;
			return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
		};
		let startTs = null;
		const step = (now) => {
			if (startTs === null) startTs = now;
			const p = Math.min(1, (now - startTs) / DURATION);
			const t = dir === 'out' ? easeOutBack(p) : 1 - p * p; // 위치 보간 계수 (0=중심,1=최종)
			const opacity = dir === 'out' ? p : 1 - p;

			const legs = [];
			for (const e of entries) {
				const lng = center[0] + (e.finalPos[0] - center[0]) * t;
				const lat = center[1] + (e.finalPos[1] - center[1]) * t;
				e.marker.setLngLat([lng, lat]);
				if (e.inner) e.inner.style.opacity = String(Math.max(0, Math.min(1, opacity)));
				legs.push({
					type: 'Feature',
					properties: {},
					geometry: { type: 'LineString', coordinates: [center, [lng, lat]] }
				});
			}
			this._setGpuSourceData('spider-legs', legs);

			if (p < 1) {
				this._spiderAnim = requestAnimationFrame(step);
			} else {
				this._spiderAnim = null;
				if (onDone) onDone();
			}
		};
		this._spiderAnim = requestAnimationFrame(step);
	}

	/* 스파이더파이 배치 좌표(중심 기준 픽셀 오프셋). 소수는 원, 다수는 나선. */
	_spiderPositions(count) {
		const res = [];
		if (count <= 9) {
			const radius = 26 + count * 6;
			const step = (2 * Math.PI) / count;
			for (let i = 0; i < count; i++) {
				const a = step * i - Math.PI / 2;
				res.push([Math.cos(a) * radius, Math.sin(a) * radius]);
			}
		} else {
			// 검증된 스파이더파이 나선 공식(OverlappingMarkerSpiderfier/Leaflet.markercluster 계열).
			// 시작 반지름을 작게, 성장 계수를 작게 둬야 각도가 여러 바퀴 돌면서 고르게 퍼진다.
			// 이전에 시작 반지름을 크게(20) 잡았더니 반지름이 각도보다 훨씬 빨리 커져서
			// 나선이 한 바퀴(360°)도 채 못 돌고 좁은 구간(약 138°)에만 몰려 한쪽으로
			// 쏠려 보였다 — 나선은 "몇 바퀴 도는지"가 핵심이라 계수 균형이 중요하다.
			let legLength = 11;
			let angle = 0;
			const sep = 26;
			const lengthFactor = 4;
			for (let i = 0; i < count; i++) {
				angle += sep / legLength + i * 0.0005;
				res.push([Math.cos(angle) * legLength, Math.sin(angle) * legLength]);
				legLength += (2 * Math.PI * lengthFactor) / angle;
			}
		}
		return res;
	}

	/* animate=true 면 중심으로 모이며 사라지는 애니메이션 후 제거(사용자 dismiss),
	   아니면 즉시 제거(줌 시작·컨트롤러 파괴 등). */
	_clearSpider(animate = false) {
		if (this._spiderAnim) {
			cancelAnimationFrame(this._spiderAnim);
			this._spiderAnim = null;
		}
		if (animate && this._spider && this._spider.entries.length) {
			this._runSpiderAnim('in', () => this._finishClearSpider());
		} else {
			this._finishClearSpider();
		}
	}

	_finishClearSpider() {
		if (this._spiderMarkers.length) {
			for (const m of this._spiderMarkers) m.remove();
			this._spiderMarkers = [];
		}
		this._setGpuSourceData('spider-legs', []);
		this._spider = null;
	}

	_addVillageMarker(item, isDetailMode, childCountByTown) {
		const childCount = childCountByTown ? childCountByTown.get(item.name) || 0 : 0;
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
		const marker = new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(this.map);

		el.addEventListener('click', () => {
			if (item.type === '마을') this.onSelectTown(item.name);
			else if (item.relatedTown) this.onSelectTown(item.relatedTown);
			// GPU 경로와 동일하게, 팝업은 재렌더 이후에 열리도록 예약한다 (레이스 방지).
			this._pendingPopupId = item.id;
			this.scheduleRender();
		});

		this._markers.push({ marker, itemId: item.id });
		this._positions.set(item.id, { coord: [lng, lat], popupOffset });
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
		if (this.map.getSource('network-lines')) return;
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
				'line-dasharray': [0, 4, 3]
			}
		});
		if (!this.map.getSource('spider-legs')) {
			this.map.addSource('spider-legs', {
				type: 'geojson',
				data: { type: 'FeatureCollection', features: [] }
			});
			this.map.addLayer({
				id: 'spider-legs',
				type: 'line',
				source: 'spider-legs',
				layout: { 'line-cap': 'round' },
				paint: { 'line-color': '#94a3b8', 'line-width': 1.5, 'line-opacity': 0.7 }
			});
		}
	}

	/* GPU 마커 소스/레이어 존재 보장 (createMapStyle 에 이미 포함되어 있으므로 방어용) */
	_ensureGpuLayers() {
		const defs = [
			{
				id: 'kt-halo',
				type: 'circle',
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
				layout: {
					'icon-image': ['get', 'iconImageId'],
					'icon-size': ['/', ['get', 'markerSizePx'], ICON_BASE_SIZE],
					'icon-allow-overlap': true,
					'icon-ignore-placement': true
				},
				paint: { 'icon-opacity': ['get', 'markerOpacity'] }
			},
			{
				id: 'kt-badges',
				type: 'symbol',
				layout: {
					'icon-image': ['get', 'badgeImageId'],
					'icon-offset': [14, -14],
					'icon-allow-overlap': true,
					'icon-ignore-placement': true
				}
			},
			{
				id: 'kt-labels',
				type: 'symbol',
				layout: {
					'icon-image': ['get', 'labelImageId'],
					'icon-anchor': 'top',
					'icon-offset': [0, 20],
					'icon-allow-overlap': true,
					'icon-ignore-placement': true
				}
			}
		];
		for (const def of defs) {
			if (!this.map.getSource(def.id)) {
				this.map.addSource(def.id, {
					type: 'geojson',
					data: { type: 'FeatureCollection', features: [] }
				});
			}
			if (!this.map.getLayer(def.id)) {
				this.map.addLayer({
					id: def.id,
					type: def.type,
					source: def.id,
					layout: def.layout,
					paint: def.paint
				});
			}
		}
	}

	_drawLines() {
		const posById = new Map();
		for (const [id, entry] of this._positions) posById.set(id, entry.coord);

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

	/* 연결선 대시 흐름 + halo 펄스 애니메이션.
	   - 대시: 55ms 마다 DASH_SEQUENCE 를 순환시켜 선이 흐르는 효과.
	   - halo: 매 프레임 반경을 sin 으로 부드럽게 맥동시켜 불확실성 원이 숨쉬듯 움직임. */
	_startAnimations() {
		const dashSpeed = 55; // ms/step
		const tick = (ts) => {
			this._dashTimer = requestAnimationFrame(tick);

			// 대시 흐름 (프레임 스로틀)
			if (ts - this._lastDashTs >= dashSpeed) {
				this._lastDashTs = ts;
				this._dashStep = (this._dashStep + 1) % DASH_SEQUENCE.length;
				if (this.map.getLayer && this.map.getLayer('network-lines')) {
					this.map.setPaintProperty(
						'network-lines',
						'line-dasharray',
						DASH_SEQUENCE[this._dashStep]
					);
				}
			}

			// halo 펄스 (매 프레임, 부드럽게)
			if (this.map.getLayer && this.map.getLayer('kt-halo')) {
				const pulse = 1 + 0.14 * Math.sin(ts / 600);
				this.map.setPaintProperty('kt-halo', 'circle-radius', [
					'*',
					['get', 'haloRadiusPx'],
					pulse
				]);
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
		const id = this._pendingPopupId;
		this._pendingPopupId = null;

		const pos = this._positions.get(id);
		const item = this.rawData.find((d) => d.id === id);
		if (pos && item) this._openAdHocPopup(item, pos.coord, pos.popupOffset);
	}

	/* 클릭/포커스로 여는 팝업 (DOM·GPU 마커 공통, 마커에 바인딩되지 않는다) */
	_openAdHocPopup(item, lngLat, offset) {
		this._closeAdHocPopup();
		this._activePopup = new maplibregl.Popup({
			anchor: 'bottom',
			offset,
			maxWidth: '340px',
			closeButton: true
		})
			.setLngLat(lngLat)
			.setHTML(buildPopupHtml(item, this.rawData))
			.addTo(this.map);
	}

	_closeAdHocPopup() {
		if (this._activePopup) {
			this._activePopup.remove();
			this._activePopup = null;
		}
	}

	_clearMarkers() {
		for (const m of this._markers) m.marker.remove();
		this._markers = [];
	}
}
