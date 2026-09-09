import maplibregl from 'maplibre-gl';
import Supercluster from 'supercluster';
import { ZOOM_DETAIL_THRESHOLD } from './mapStyle.js';
import { createMarkerEl, createClusterEl, createLabelEl, computeMarkerVisual } from './icons.js';
import {
	iconImageId,
	ensureIconImages,
	ensureLabelImage,
	ensureBadgeImage,
	pruneLabelImages,
	labelSizePx,
	ICON_BASE_SIZE
} from './iconAtlas.js';
import { buildPopupHtml } from './popup.js';
import { filterData } from '$lib/data/filter.js';
import { localized, translate } from '$lib/i18n/translations.js';
import { escapeHtml } from '$lib/util.js';

const WORLD_BBOX = [-180, -85, 180, 85];

/* 쉼표로 구분된 관련 대상(예: 사건의 related_person)에서 첫 값만 반환 */
function firstToken(str) {
	if (!str) return '';
	return str.split(',')[0].trim();
}

/* 두 좌표 사이 대권거리(m) — Haversine */
function haversineMeters(a, b) {
	const R = 6371000;
	const toRad = (d) => (d * Math.PI) / 180;
	const dLat = toRad(b.lat - a.lat);
	const dLng = toRad(b.lng - a.lng);
	const h =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
	return 2 * R * Math.asin(Math.sqrt(h));
}

function formatMeters(m) {
	return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m).toLocaleString()} m`;
}

/* 구면 다각형 면적(m²) — 구면과잉(spherical excess) 공식.
   ring 의 마지막 점이 첫 점과 같아도(닫힌 링) 그 구간은 0을 더하므로 그대로 넣어도 된다. */
function sphericalAreaM2(ring) {
	if (ring.length < 3) return 0;
	const R = 6371008.8;
	const toRad = (d) => (d * Math.PI) / 180;
	let sum = 0;
	for (let i = 0; i < ring.length; i++) {
		const a = ring[i];
		const b = ring[(i + 1) % ring.length];
		sum += toRad(b.lng - a.lng) * (2 + Math.sin(toRad(a.lat)) + Math.sin(toRad(b.lat)));
	}
	return Math.abs((sum * R * R) / 2);
}

function formatArea(m2) {
	return m2 >= 1e6
		? `${(m2 / 1e6).toFixed(2)} km²`
		: `${Math.round(m2).toLocaleString()} m²`;
}

/* 시작점 위에 다시 찍었다고 볼 화면상 거리(px) — 손으로 딱 맞추기 쉽도록 넉넉히 */
const COORD_SNAP_PX = 18;

const GPU_SOURCE_IDS = ['kt-halo', 'kt-icons', 'kt-badges', 'kt-labels'];

/* 한 화면에 동시에 그릴 라벨 수 상한. 라벨은 글자마다 이미지 1장이고 그 전부가 타일
   아이콘 아틀라스 텍스처 한 장에 팩킹되므로, 상한이 없으면 텍스처가 모바일 GPU 가
   감당 못 할 크기까지 커진다. 화면을 촘촘히 채우기엔 충분한 값. */
const MAX_VISIBLE_LABELS = 260;

/* 화면 중심으로부터의 제곱거리(도 단위) — 라벨 상한을 넘겼을 때 우선순위용 */
function distToCenterSq([lng, lat], cx, cy) {
	return (lng - cx) ** 2 + (lat - cy) ** 2;
}

/* 라벨과 점 사이 여백(px) */
const LABEL_GAP = 6;

/* 라벨 후보 자리 8방향. anchor 는 "이미지의 어느 지점을 노드 좌표에 붙일지",
   offset 은 그 뒤 화면 px 로 밀 양이다. 읽기 자연스러운 순서(아래→위→우→좌→대각)로
   시도해서 처음 비어 있는 자리를 쓴다. */
const LABEL_ANCHORS = ['top', 'bottom', 'left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right'];

/* anchor·offset 조합이 화면에서 차지할 박스를 계산한다.
   MapLibre 의 shapeIcon 과 같은 규칙: anchor 에 left/right 가 있으면 이미지가 그 방향으로
   펼쳐지고(정렬계수 0 / 1), 없으면 가운데(0.5) 정렬된다. 세로도 top/bottom 으로 동일. */
function labelCandidateBox(anchor, cx, cy, w, h, iconRadius) {
	const d = iconRadius + LABEL_GAP;
	const diag = Math.round(d * 0.72);
	const hasLeft = anchor.includes('left');
	const hasRight = anchor.includes('right');
	const hasTop = anchor.includes('top');
	const hasBottom = anchor.includes('bottom');

	let ox = 0;
	let oy = 0;
	if (hasLeft && (hasTop || hasBottom)) ox = diag;
	else if (hasRight && (hasTop || hasBottom)) ox = -diag;
	else if (hasLeft) ox = d;
	else if (hasRight) ox = -d;
	if (hasTop && (hasLeft || hasRight)) oy = diag;
	else if (hasBottom && (hasLeft || hasRight)) oy = -diag;
	else if (hasTop) oy = d;
	else if (hasBottom) oy = -d;

	const alignX = hasLeft ? 0 : hasRight ? -w : -w / 2;
	const alignY = hasTop ? 0 : hasBottom ? -h : -h / 2;
	const l = cx + ox + alignX;
	const t = cy + oy + alignY;
	return { offset: [ox, oy], l, t, r: l + w, b: t + h };
}

/* 라벨 배치 우선순위(작을수록 먼저 자리를 잡는다). 자리가 부족할 때 어떤 이름을 살릴지
   정하는 기준 — 선택된 노드 > 종속 노드가 딸린 마을 > 마을 > 조직 > 인물 > 사건. */
function labelPriority(type, isHighlighted, childCount) {
	if (isHighlighted) return 0;
	if (type === '마을') return childCount > 0 ? 1 : 2;
	if (type === '조직') return 3;
	if (type === '인물') return 4;
	return 5;
}

/* 라벨 배치용 공간 해시. 후보 박스마다 이미 놓인 것 전부를 훑지 않기 위한 것으로,
   같은 셀에 걸친 박스만 비교한다 (라벨 260개 × 8후보에서도 비용이 무시할 만하다). */
function makeBoxGrid(cell = 64) {
	const cells = new Map();
	const keysOf = (b) => {
		const out = [];
		const x1 = Math.floor(b.l / cell);
		const x2 = Math.floor(b.r / cell);
		const y1 = Math.floor(b.t / cell);
		const y2 = Math.floor(b.b / cell);
		for (let x = x1; x <= x2; x++) for (let y = y1; y <= y2; y++) out.push(x + ':' + y);
		return out;
	};
	return {
		add(b) {
			for (const k of keysOf(b)) {
				let arr = cells.get(k);
				if (!arr) cells.set(k, (arr = []));
				arr.push(b);
			}
		},
		collides(b) {
			for (const k of keysOf(b)) {
				const arr = cells.get(k);
				if (!arr) continue;
				for (const o of arr) if (b.l < o.r && o.l < b.r && b.t < o.b && o.t < b.b) return true;
			}
			return false;
		}
	};
}

/* icon-offset 은 icon-size 가 곱해진 뒤 화면에 적용된다(MapLibre shapeIcon → 렌더 시 스케일).
   kt-icons 는 icon-size = markerSizePx/ICON_BASE_SIZE 이므로, 원하는 화면 px 를 얻으려면
   미리 그 비율로 나눠 넣어야 한다. kt-badges·kt-labels 는 icon-size 가 없어 보정이 불필요. */
function scaleIconOffset(fan, markerSizePx) {
	if (!fan || (!fan[0] && !fan[1])) return [0, 0];
	const scale = markerSizePx / ICON_BASE_SIZE;
	return [fan[0] / scale, fan[1] / scale];
}

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
		this.locale = 'ko';

		this._markers = []; // DOM 마커 (저줌 클러스터 상태): { marker, itemId? }
		this._positions = new Map(); // itemId -> { coord:[lng,lat], popupOffset } (DOM+GPU 공통, 라인/포커스용)
		this._activePopup = null; // GPU 클릭으로 연 팝업(마커에 바인딩되지 않음)
		this._index = null;
		this._villageMap = {};
		this._raf = null;
		this._pendingPopupId = null;
		this._pendingPopupCenter = false;
		this._dashStep = 0;
		this._dashTimer = null;
		this._lastDashTs = 0;
		this._iconsReady = false;
		this._detailDirty = true; // 마을 GPU 피처 캐시 재계산 필요 여부
		this._villageFeatures = null; // 캐시된 마을 GPU 피처 { icons, halo, badges }
		this._villageLabelSpecs = null; // 캐시된 마을 라벨 명세 [{ coord, text }] (아직 래스터화 안 함)
		this._labelSpecs = null; // 이번 렌더의 전체 라벨 명세 (마을 + 조직/인물)
		this._fanOffsets = new Map(); // 좌표가 동일한 노드들의 화면 px 분산: itemId -> [dx, dy]
		this._labelRaf = null; // 라벨 동기화 rAF 핸들
		this._villagePositions = null; // 캐시된 마을 위치 Map(id -> {coord, popupOffset})
		this._spider = null; // 스파이더파이 상태 { clusterId, center, entries }
		this._spiderMarkers = []; // 펼쳐진 leaf DOM 마커 (일반 렌더로 지워지지 않음)
		this._spiderAnim = null; // 펼침/접힘 애니메이션 rAF 핸들
		this._coordPoints = []; // 임시 좌표 측정 점들: [{ point:{lat,lng}, marker }]
		this._coordPopup = null; // 임시 좌표 확인 팝업
		this._coordClosed = false; // 시작점에 다시 찍어 링이 닫혔는지(= 면적 표시)

		this._ensureLineLayer();
		this._ensureGpuLayers();
		this._ensureCoordLayer();

		ensureIconImages(this.map).then(() => {
			this._iconsReady = true;
			this.scheduleRender();
		});

		// 줌 변화 시에만 재렌더 (기존 zoomend 동작과 동일, 패닝 시 깜빡임 방지)
		this._onZoomEnd = () => this.scheduleRender();
		this.map.on('zoomend', this._onZoomEnd);

		// 라벨은 "화면에 들어온 것만" 래스터화하므로(_syncLabels), 줌이 아니라 단순 팬으로도
		// 새로 보이게 된 라벨을 채워야 한다. 아이콘/점은 이미 다 올라가 있어 여기서 건드리지
		// 않는다 — 팬 중 깜빡임 방지.
		this._onMoveEnd = () => {
			if (this.map.getZoom() >= ZOOM_DETAIL_THRESHOLD) this._scheduleLabelSync();
		};
		this.map.on('moveend', this._onMoveEnd);

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

		// 임시: 우클릭(모바일은 롱프레스)할 때마다 점을 이어 찍어 위경도·구간거리를 보여준다.
		// 시트에 위경도를 입력할 때 쓰는 임시 기능 — 별도 UI 없이 지도 표준 제스처만 사용.
		// ESC 로 전부 지운다.
		this._onCoordPick = (e) => this._addCoordPoint(e.lngLat);
		this.map.on('contextmenu', this._onCoordPick);
		this._onKeyDown = (e) => {
			if (e.key === 'Escape') this._clearCoordPoints();
		};
		document.addEventListener('keydown', this._onKeyDown);

		// 팝업 내 "AI 해설" 버튼 / 좌표 복사 버튼 위임 처리
		this._docClick = (e) => {
			const btn = e.target.closest && e.target.closest('[data-ai-id]');
			if (btn) {
				const id = parseInt(btn.dataset.aiId, 10);
				if (!Number.isNaN(id)) this.onAskAI(id);
			}
			const copyBtn = e.target.closest && e.target.closest('[data-copy-coord]');
			if (copyBtn) {
				navigator.clipboard?.writeText(copyBtn.dataset.copyCoord).then(() => {
					const label = copyBtn.querySelector('span');
					copyBtn.classList.add('copied');
					if (label) label.textContent = copyBtn.dataset.copiedLabel;
					clearTimeout(copyBtn._copyResetTimer);
					copyBtn._copyResetTimer = setTimeout(() => {
						copyBtn.classList.remove('copied');
						if (label) label.textContent = copyBtn.dataset.copyLabel;
					}, 1200);
				});
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
		this._buildFanOffsets();
		this._rebuildIndex();
		this._detailDirty = true;
		this.scheduleRender();
	}

	/* ====== 좌표가 사실상 동일한 노드 분산(부챗살) ======
	   좌표가 소수점 5자리(≈1 m)까지 같은 노드들은 어떤 줌으로 확대해도 분리되지 않는다.
	   그대로 두면 점 하나로 보이고, 클릭은 맨 위 하나만 잡히고, 이름도 하나만 읽힌다.
	   실제 데이터에 이런 그룹이 23개(노드 53개) 있고 대부분 location_precision='town'
	   (≈±10 km 근사)인 서로 다른 유적지다 — 즉 좌표가 같은 건 입력 오류가 아니라
	   "마을 단위까지만 안다"는 뜻이다. 그래서 원본 좌표는 건드리지 않고 화면 px 로만
	   살짝 부챗살로 벌려 각각을 보이고 누를 수 있게 한다(선언된 오차 ±10 km 안에서
	   20 px 는 무시할 수 있는 표시상의 분산이다).

	   ⚠️ 화면 px 오프셋이므로 줌과 무관하다 → 데이터가 바뀔 때 한 번만 계산해 캐시한다.
	   ⚠️ id 순으로 고정해서, 필터·언어를 바꿔도 점이 자리를 바꾸며 튀지 않게 한다. */
	_buildFanOffsets() {
		const groups = new Map();
		for (const d of this.rawData) {
			if (!d.lat || !d.lng) continue;
			/* 상세줌에서 "자기 좌표 그대로" 그려지는 노드만 센다. 조직·인물·사건 중
			   isPrecise(exact/street)가 아닌 것은 _computeFloatingLatLng 로 부모 마을 주위에
			   흩어 놓기 때문에 애초에 겹치지 않는다 — 이걸 같이 세면 실제로는 혼자 남는
			   마을에까지 부챗살 오프셋이 붙어 점이 괜히 제자리를 벗어난다. */
			if (d.type !== '마을' && !d.isPrecise) continue;
			const key = `${d.lng.toFixed(5)},${d.lat.toFixed(5)}`;
			let arr = groups.get(key);
			if (!arr) groups.set(key, (arr = []));
			arr.push(d);
		}

		const offsets = new Map();
		for (const members of groups.values()) {
			const k = members.length;
			if (k < 2) continue;
			/* 원 위에 k개를 놓을 때 이웃 간 거리는 2·R·sin(π/k) 이므로, 점(지름 ~30px)이
			   서로 겹치지 않을 최소 반경은 15/sin(π/k) 이다. 상한을 둬서 그룹이 아주 커도
			   너무 벌어지지 않게 한다 (너무 벌리면 위치 자체를 오해한다). */
			const radius = Math.min(Math.ceil(15 / Math.sin(Math.PI / k)), 30);
			// 2개면 좌우로 — 라벨이 가로로 길어서 위아래로 벌리면 라벨끼리 다시 부딪힌다.
			const start = k === 2 ? Math.PI : -Math.PI / 2;
			members.sort((a, b) => a.id - b.id);
			members.forEach((d, i) => {
				const angle = start + (i * 2 * Math.PI) / k;
				offsets.set(d.id, [
					Math.round(Math.cos(angle) * radius),
					Math.round(Math.sin(angle) * radius)
				]);
			});
		}
		this._fanOffsets = offsets;
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
		// 언어가 바뀌면 라벨·팝업 텍스트를 다시 만들어야 한다 (매칭 로직은 한국어 원문 유지)
		if ('locale' in state && state.locale !== this.locale) {
			this.locale = state.locale;
			this._detailDirty = true;
			this._closeAdHocPopup();
		}
		if (indexDirty) this._rebuildIndex();
		this.scheduleRender();
	}

	/* 화면 표시용 이름 — 매칭·slug 는 항상 item.name(한국어)을 쓰고, 이건 표시에만 쓴다 */
	_label(item) {
		return localized(item, 'name', this.locale);
	}

	destroy() {
		this.map.off('zoomend', this._onZoomEnd);
		this.map.off('moveend', this._onMoveEnd);
		this.map.off('zoomstart', this._onZoomStart);
		this.map.off('click', this._onMapClick);
		this.map.off('click', 'kt-icons', this._onIconClick);
		this.map.off('mouseenter', 'kt-icons', this._onIconEnter);
		this.map.off('mouseleave', 'kt-icons', this._onIconLeave);
		this.map.off('contextmenu', this._onCoordPick);
		document.removeEventListener('click', this._docClick);
		document.removeEventListener('keydown', this._onKeyDown);
		if (this._raf) cancelAnimationFrame(this._raf);
		if (this._labelRaf) cancelAnimationFrame(this._labelRaf);
		if (this._dashTimer) cancelAnimationFrame(this._dashTimer);
		this._closeAdHocPopup();
		this._clearCoordPoints();
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
		const labelSpecs = [];
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
			const fan = this._fanOffsets.get(item.id) || null;
			positions.set(item.id, { coord, popupOffset: Math.round(v.size / 2 + 6), fan });

			icons.push({
				type: 'Feature',
				properties: {
					itemId: item.id,
					iconImageId: iconImageId('마을', item.settlementType, v.isHighlighted),
					markerSizePx: v.size,
					markerOpacity: v.markerOpacity,
					iconOffset: scaleIconOffset(fan, v.size)
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
					properties: {
						badgeImageId: ensureBadgeImage(this.map, v.badgeCount),
						// 아이콘이 부챗살로 밀린 만큼 뱃지도 같이 밀어야 점에 붙어 있는다
						offset: [14 + (fan ? fan[0] : 0), -14 + (fan ? fan[1] : 0)]
					},
					geometry: { type: 'Point', coordinates: coord }
				});
			}
			// 라벨은 여기서 이미지로 굽지 않는다 — 텍스트/좌표만 모아두고, 실제 래스터화와
			// 자리 찾기는 화면에 들어온 것만 _syncLabels() 에서 한다 (아래 주석 참고).
			labelSpecs.push({
				coord,
				text: this._label(item),
				fan,
				iconRadius: v.size / 2,
				priority: labelPriority('마을', v.isHighlighted, childCount)
			});
		}

		this._villageFeatures = { icons, halo, badges };
		this._villageLabelSpecs = labelSpecs;
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
		const labelSpecs = this._villageLabelSpecs.slice();

		// 조직/인물: 개수가 적고(수십 건 수준) 선택 하이라이트가 자주 바뀌므로 매번 계산한다
		const pushEntity = (item, lng, lat, opts) => {
			const v = computeMarkerVisual(item.type, {
				isHighlighted: opts.isHighlighted,
				isFloating: !!opts.isFloating,
				settlementType: item.settlementType,
				certaintyScore: item.certaintyScore
			});
			const coord = [lng, lat];
			// floating 노드는 _buildFanOffsets 에서 이미 제외되지만, 좌표를 옮겨 그리는
			// 경로이므로 여기서도 한 번 더 막아 둔다.
			const fan = opts.isFloating ? null : this._fanOffsets.get(item.id) || null;
			this._positions.set(item.id, { coord, popupOffset: Math.round(v.size / 2 + 6), fan });

			iconFeatures.push({
				type: 'Feature',
				properties: {
					itemId: item.id,
					iconImageId: iconImageId(item.type, item.settlementType, v.isHighlighted),
					markerSizePx: v.size,
					markerOpacity: v.markerOpacity,
					iconOffset: scaleIconOffset(fan, v.size)
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
			labelSpecs.push({
				coord,
				text: this._label(item),
				fan,
				iconRadius: v.size / 2,
				priority: labelPriority(item.type, v.isHighlighted, 0)
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

		// 1단계 — 점(아이콘/halo/뱃지)을 먼저 즉시 올린다. 이 세 레이어가 쓰는 이미지는
		// 아이콘 10종 + 뱃지 숫자 몇 종뿐이라 이미 등록돼 있고, 아틀라스도 작아서
		// 상세줌으로 들어온 그 프레임에 바로 그려진다.
		this._setGpuSourceData('kt-halo', haloFeatures);
		this._setGpuSourceData('kt-icons', iconFeatures);
		this._setGpuSourceData('kt-badges', badgeFeatures);

		// 2단계 — 라벨은 화면에 들어온 것만 골라 다음 프레임에 굽는다 (_syncLabels 주석 참고).
		this._labelSpecs = labelSpecs;
		this._scheduleLabelSync();
	}

	/* 라벨은 "글자마다 이미지 1장"이라 마을이 1,500개면 map.addImage() 도 1,500번이다.
	   addImage() 한 번은 (a) 캔버스 래스터화 + getImageData 리드백,
	   (b) 스타일에 등록된 전체 이미지 ID 목록을 워커로 broadcast — 를 하므로,
	   N 장을 등록하면 (b) 때문에 O(N²) 비용이 든다. 게다가 등록된 라벨 중 타일이
	   참조하는 것 전부가 아이콘 아틀라스 텍스처 한 장에 팩킹되므로, 라벨 1,500장이면
	   텍스처가 수천만 픽셀(수십 MB)까지 커져 모바일 GPU 의 최대 텍스처 크기에 부딪힌다.
	   → 상세줌에 들어간 직후 점이 사라졌다가 10~15초 뒤에야 나타나던 원인.

	   그래서 라벨은 (1) 지금 화면(+여유분)에 들어온 것만, (2) MAX_VISIBLE_LABELS 까지만
	   래스터화하고, (3) 점을 올리는 프레임과 분리해 굽는다. */
	_scheduleLabelSync() {
		if (this._labelRaf) return;
		this._labelRaf = requestAnimationFrame(() => {
			this._labelRaf = null;
			this._syncLabels();
		});
	}

	_syncLabels() {
		if (!this.map || !this._labelSpecs) return;
		// 저줌(클러스터 상태)에서는 라벨 레이어를 쓰지 않는다 — _clearGpuLayers 가 이미 비웠다.
		if (this.map.getZoom() < ZOOM_DETAIL_THRESHOLD) return;

		const bounds = this.map.getBounds();
		const west = bounds.getWest();
		const east = bounds.getEast();
		const south = bounds.getSouth();
		const north = bounds.getNorth();
		// 화면 밖으로 각 변 20% 여유 — 살짝 팬했을 때 라벨이 뒤늦게 뜨는 걸 줄인다.
		const padX = (east - west) * 0.2;
		const padY = (north - south) * 0.2;
		const cx = (west + east) / 2;
		const cy = (south + north) / 2;

		const visible = this._labelSpecs.filter(
			({ coord: [lng, lat] }) =>
				lng >= west - padX && lng <= east + padX && lat >= south - padY && lat <= north + padY
		);
		// 중요한 이름부터, 같은 등급이면 화면 중앙에 가까운 것부터 자리를 잡는다.
		visible.sort(
			(a, b) =>
				a.priority - b.priority ||
				distToCenterSq(a.coord, cx, cy) - distToCenterSq(b.coord, cx, cy)
		);
		if (visible.length > MAX_VISIBLE_LABELS) visible.length = MAX_VISIBLE_LABELS;

		/* 점(아이콘) 박스를 먼저 격자에 넣는다 — 라벨이 다른 점 위에 얹히지 않게 하려는 것.
		   부챗살 오프셋을 더한 "실제로 그려지는" 위치를 쓴다. */
		const grid = makeBoxGrid();
		const screen = visible.map((spec) => {
			const p = this.map.project(spec.coord);
			return { x: p.x + (spec.fan ? spec.fan[0] : 0), y: p.y + (spec.fan ? spec.fan[1] : 0) };
		});
		visible.forEach((spec, i) => {
			const half = spec.iconRadius + 1;
			const { x, y } = screen[i];
			grid.add({ l: x - half, t: y - half, r: x + half, b: y + half });
		});

		const keepIds = new Set();
		const labelFeatures = [];
		visible.forEach((spec, i) => {
			const { width, height } = labelSizePx(spec.text);
			const { x, y } = screen[i];
			for (const anchor of LABEL_ANCHORS) {
				const box = labelCandidateBox(anchor, x, y, width, height, spec.iconRadius);
				if (grid.collides(box)) continue;

				grid.add(box);
				const labelImageId = ensureLabelImage(this.map, spec.text);
				keepIds.add(labelImageId);
				labelFeatures.push({
					type: 'Feature',
					properties: {
						labelImageId,
						anchor,
						// 라벨은 원 좌표에 얹히므로, 부챗살로 밀린 점을 따라가도록 fan 을 더한다
						offset: [
							box.offset[0] + (spec.fan ? spec.fan[0] : 0),
							box.offset[1] + (spec.fan ? spec.fan[1] : 0)
						],
						// 배열 순서 = 우선순위 순서 → MapLibre 배치기도 같은 순서로 자리를 준다
						sortKey: labelFeatures.length
					},
					geometry: { type: 'Point', coordinates: spec.coord }
				});
				return;
			}
			/* 8방향이 모두 막힌 라벨은 포기한다. 점은 그대로 보이고 눌러서 팝업으로 이름을
			   확인할 수 있으며, 조금 더 확대하면 자리가 생겨 자연히 나타난다. */
		});

		this._setGpuSourceData('kt-labels', labelFeatures);
		// 화면 밖으로 나간 라벨 이미지는 상한을 넘길 때만 정리 (지금 쓰는 건 절대 안 지움)
		pruneLabelImages(this.map, keepIds);
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
		if (isDetailMode) this._addLabel(item.lat, item.lng, this._label(item));
	}

	_addItemMarker(item, lat, lng, opts, isDetailMode) {
		const { el, popupOffset } = createMarkerEl(item.type, {
			...opts,
			certaintyScore: item.certaintyScore
		});
		this._wireMarker(el, item, popupOffset, lat, lng);
		if (isDetailMode) this._addLabel(lat, lng, this._label(item));
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
			} else if (item.type === '사건') {
				// 사건은 가장 구체적인 관련 대상(인물 → 조직 → 마을)에 연결
				const firstPerson = firstToken(item.relatedPerson);
				const firstOrg = firstToken(item.relatedOrg);
				if (firstPerson) {
					target = this.rawData.find((d) => d.type === '인물' && d.name === firstPerson);
				}
				if (!target && firstOrg) {
					target = this.rawData.find((d) => d.type === '조직' && d.name === firstOrg);
				}
				if (!target && item.relatedTown) {
					target = this.rawData.find((d) => d.type === '마을' && d.name === item.relatedTown);
				}
				color = '#9333ea';
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
		// 검색 결과 클릭 등 "포커싱" 경로로 열린 팝업은 내용 길이와 무관하게
		// 화면 중앙에 통째로 보이도록 한 번 더 보정한다 (_centerPopupInView).
		this._pendingPopupCenter = true;
		this.map.flyTo({ center: [targetLng, targetLat], zoom: targetZoom, duration: 800 });
		this.map.once('moveend', () => this.scheduleRender());
	}

	_afterRender() {
		if (this._pendingPopupId == null) return;
		const id = this._pendingPopupId;
		const centerInView = this._pendingPopupCenter;
		this._pendingPopupId = null;
		this._pendingPopupCenter = false;

		const pos = this._positions.get(id);
		const item = this.rawData.find((d) => d.id === id);
		if (pos && item)
			this._openAdHocPopup(item, pos.coord, pos.popupOffset, { centerInView, fan: pos.fan });
	}

	/* 클릭/포커스로 여는 팝업 (DOM·GPU 마커 공통, 마커에 바인딩되지 않는다) */
	_openAdHocPopup(item, lngLat, offset, { centerInView = false, fan = null } = {}) {
		this._closeAdHocPopup();
		/* anchor:'bottom' 에서 숫자 offset 은 MapLibre 가 [0, -offset] 로 바꿔 쓴다.
		   점이 부챗살로 밀려 있으면 팝업 꼬리도 그만큼 따라가야 하므로 배열로 직접 준다. */
		const popupOffset =
			fan && (fan[0] || fan[1]) ? [fan[0], fan[1] - offset] : offset;
		this._activePopup = new maplibregl.Popup({
			anchor: 'bottom',
			offset: popupOffset,
			maxWidth: '340px',
			closeButton: true
		})
			.setLngLat(lngLat)
			.setHTML(buildPopupHtml(item, this.rawData, this.locale))
			.addTo(this.map);

		if (centerInView) this._centerPopupInView();
	}

	/* 마커를 화면 중앙에 두면 팝업(anchor:'bottom')은 그 위로 떠서 열리므로,
	   설명이 길어 팝업이 커지면 위쪽이 뷰포트 밖으로 잘릴 수 있다.
	   팝업이 실제로 그려진 뒤 높이를 재서, 팝업 자체의 중심이 지도 중앙에 오도록
	   지도를 한 번 더 미세하게 이동시킨다. */
	_centerPopupInView() {
		const popup = this._activePopup;
		if (!popup) return;
		requestAnimationFrame(() => {
			if (this._activePopup !== popup) return; // 그사이 다른 팝업으로 교체됐으면 무시
			const el = popup.getElement();
			if (!el) return;
			const popupRect = el.getBoundingClientRect();
			const mapRect = this.map.getContainer().getBoundingClientRect();
			const delta = popupRect.top + popupRect.height / 2 - (mapRect.top + mapRect.height / 2);
			if (Math.abs(delta) > 4) {
				this.map.panBy([0, delta], { duration: 350 });
			}
		});
	}

	_closeAdHocPopup() {
		if (this._activePopup) {
			this._activePopup.remove();
			this._activePopup = null;
		}
	}

	/* 임시 좌표 측정 소스/레이어 존재 보장 (닫힌 면 + 구간 연결선 + 거리 라벨).
	   면 → 선 → 라벨 순으로 추가해야 나중에 추가한 쪽이 위에 그려진다. */
	_ensureCoordLayer() {
		if (!this.map.getSource('coord-fill')) {
			this.map.addSource('coord-fill', {
				type: 'geojson',
				data: { type: 'FeatureCollection', features: [] }
			});
			this.map.addLayer({
				id: 'coord-fill',
				type: 'fill',
				source: 'coord-fill',
				paint: { 'fill-color': '#dc2626', 'fill-opacity': 0.14 }
			});
		}
		if (!this.map.getSource('coord-lines')) {
			this.map.addSource('coord-lines', {
				type: 'geojson',
				data: { type: 'FeatureCollection', features: [] }
			});
			this.map.addLayer({
				id: 'coord-lines',
				type: 'line',
				source: 'coord-lines',
				layout: { 'line-cap': 'round', 'line-join': 'round' },
				paint: { 'line-color': '#dc2626', 'line-width': 2, 'line-dasharray': [2, 2] }
			});
		}
		if (!this.map.getSource('coord-distance-labels')) {
			this.map.addSource('coord-distance-labels', {
				type: 'geojson',
				data: { type: 'FeatureCollection', features: [] }
			});
			this.map.addLayer({
				id: 'coord-distance-labels',
				type: 'symbol',
				source: 'coord-distance-labels',
				layout: {
					'icon-image': ['get', 'labelImageId'],
					'icon-allow-overlap': true,
					'icon-ignore-placement': true
				}
			});
		}
	}

	/* 임시: 우클릭할 때마다 점을 이어 찍어 위경도·직전 점과의 구간거리를 핀+팝업으로 표시
	   (시트 입력용, 복사 버튼 제공). 전부 지우려면 ESC(_clearCoordPoints). */
	_addCoordPoint(lngLat) {
		// 이미 닫힌 도형에서 또 찍으면 새 측정을 시작한다 (별도 초기화 조작 없이)
		if (this._coordClosed) this._clearCoordPoints();

		let point = { lat: lngLat.lat, lng: lngLat.lng };
		// 시작점 위(화면상 COORD_SNAP_PX 이내)에 찍으면 딱 맞물려 닫고 면적을 낸다
		const first = this._coordPoints[0]?.point;
		if (first && this._coordPoints.length >= 3 && this._screenDistance(first, point) <= COORD_SNAP_PX) {
			point = { ...first };
			this._coordClosed = true;
		}

		const el = document.createElement('div');
		el.className = 'coord-pin';
		const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
			.setLngLat(point)
			.addTo(this.map);
		this._coordPoints.push({ point, marker });
		this._renderCoordLines();

		const coordText = `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`;
		const metrics = [];
		if (this._coordPoints.length > 1) {
			const prev = this._coordPoints[this._coordPoints.length - 2].point;
			metrics.push([
				translate(this.locale, 'coord.segment'),
				formatMeters(haversineMeters(prev, point))
			]);
			metrics.push([translate(this.locale, 'coord.total'), formatMeters(this._coordTotalMeters())]);
		}
		if (this._coordClosed) {
			metrics.push([
				translate(this.locale, 'coord.area'),
				formatArea(sphericalAreaM2(this._coordPoints.map((p) => p.point)))
			]);
		}
		const metricsHtml = metrics.length
			? `<div class="coord-popup-metrics">${metrics
					.map(
						([k, v], i) =>
							`<div class="coord-metric${this._coordClosed && i === metrics.length - 1 ? ' coord-metric--area' : ''}"><span>${escapeHtml(k)}</span><b>${escapeHtml(v)}</b></div>`
					)
					.join('')}</div>`
			: '';

		// 3점 이상이고 아직 안 닫혔으면 "시작점을 다시 찍으면 면적" 안내를 앞에 붙인다
		const hints = [];
		if (this._coordPoints.length >= 3 && !this._coordClosed) {
			hints.push(translate(this.locale, 'coord.closeHint'));
		}
		hints.push(translate(this.locale, 'coord.hint'));

		const copyLabel = escapeHtml(translate(this.locale, 'coord.copy'));
		const copiedLabel = escapeHtml(translate(this.locale, 'coord.copied'));

		if (this._coordPopup) this._coordPopup.remove();
		// anchor 를 고정하지 않아야 화면 위/가장자리에 찍었을 때 팝업이 알아서 반대편으로 뒤집힌다
		this._coordPopup = new maplibregl.Popup({
			offset: 12,
			closeButton: true,
			closeOnClick: false
		})
			.setLngLat(point)
			.setHTML(
				`<div class="coord-popup">
					<div class="coord-popup-label"><i class="fa-solid fa-location-crosshairs"></i> ${escapeHtml(
						translate(this.locale, 'coord.label')
					)}</div>
					<div class="coord-popup-value">${coordText}</div>
					${metricsHtml}
					<button type="button" class="coord-copy-btn" data-copy-coord="${coordText}" data-copy-label="${copyLabel}" data-copied-label="${copiedLabel}">
						<i class="fa-solid fa-copy"></i> <span>${copyLabel}</span>
					</button>
					<div class="coord-popup-hint">${escapeHtml(hints.join(' · '))}</div>
				</div>`
			)
			.addTo(this.map);
		// ⚠️ Evented#on() 은 popup(this)이 아니라 {unsubscribe} 래퍼를 반환하므로 체이닝하지 않는다.
		this._coordPopup.on('close', () => {
			this._coordPopup = null;
		});
	}

	/* 두 좌표의 화면(px) 거리 — 시작점 스냅 판정용 */
	_screenDistance(a, b) {
		const pa = this.map.project([a.lng, a.lat]);
		const pb = this.map.project([b.lng, b.lat]);
		return Math.hypot(pa.x - pb.x, pa.y - pb.y);
	}

	/* 찍은 점들을 순서대로 이은 전체 거리(m) */
	_coordTotalMeters() {
		let total = 0;
		for (let i = 1; i < this._coordPoints.length; i++) {
			total += haversineMeters(this._coordPoints[i - 1].point, this._coordPoints[i].point);
		}
		return total;
	}

	/* 점들을 순서대로 이은 구간선 + 각 구간 중점의 거리 라벨 + 닫혔으면 면을 다시 그린다 */
	_renderCoordLines() {
		const lineFeatures = [];
		const labelFeatures = [];
		for (let i = 1; i < this._coordPoints.length; i++) {
			const a = this._coordPoints[i - 1].point;
			const b = this._coordPoints[i].point;
			lineFeatures.push({
				type: 'Feature',
				properties: {},
				geometry: {
					type: 'LineString',
					coordinates: [
						[a.lng, a.lat],
						[b.lng, b.lat]
					]
				}
			});
			labelFeatures.push({
				type: 'Feature',
				properties: {
					labelImageId: ensureLabelImage(this.map, formatMeters(haversineMeters(a, b)))
				},
				geometry: { type: 'Point', coordinates: [(a.lng + b.lng) / 2, (a.lat + b.lat) / 2] }
			});
		}
		this._setGpuSourceData('coord-lines', lineFeatures);
		this._setGpuSourceData('coord-distance-labels', labelFeatures);
		this._setGpuSourceData(
			'coord-fill',
			this._coordClosed
				? [
						{
							type: 'Feature',
							properties: {},
							geometry: {
								type: 'Polygon',
								coordinates: [this._coordPoints.map((p) => [p.point.lng, p.point.lat])]
							}
						}
					]
				: []
			);

		/* 닫을 수 있는 상태(3점 이상)에서는 시작점을 은은히 맥동시켜
		   "여기를 다시 찍으면 닫힌다"를 글자 없이 알려준다. */
		const firstEl = this._coordPoints[0]?.marker.getElement();
		if (firstEl) {
			firstEl.classList.toggle(
				'coord-pin--target',
				this._coordPoints.length >= 3 && !this._coordClosed
			);
		}
	}

	/* ESC 또는 컨트롤러 파괴 시 임시 좌표 측정 상태를 전부 지운다 */
	_clearCoordPoints() {
		if (!this._coordPoints.length && !this._coordPopup) return;
		for (const p of this._coordPoints) p.marker.remove();
		this._coordPoints = [];
		this._coordClosed = false;
		this._setGpuSourceData('coord-lines', []);
		this._setGpuSourceData('coord-distance-labels', []);
		this._setGpuSourceData('coord-fill', []);
		if (this._coordPopup) {
			const popup = this._coordPopup;
			this._coordPopup = null;
			popup.remove();
		}
	}

	_clearMarkers() {
		for (const m of this._markers) m.marker.remove();
		this._markers = [];
	}
}
