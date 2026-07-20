/* ====== 아이콘 설정 (위치 확실성 그라데이션 반영) — 기존 getIcon 이식 ======
   certaintyScore(1=Exact, 0=Unknown)로 다음을 연속 변화:
     1) 마커 불투명도  2) 테두리 스타일  3) 불확실성 halo 반경/농도 */
export function buildIcon(type, opts = {}) {
	const {
		isHighlighted = false,
		badgeCount = 0,
		isFloating = false,
		settlementType = '타운',
		certaintyScore = 1
	} = opts;
	let color, iconClass;

	let size = isHighlighted ? 38 : isFloating ? 24 : 28;
	if (type === '마을') {
		size = isHighlighted
			? settlementType === '빌리지'
				? 34
				: 38
			: settlementType === '빌리지'
				? 28
				: 32;
		color = '#ea580c';
		iconClass = settlementType === '빌리지' ? 'fa-house' : 'fa-house-chimney';
	} else if (type === '조직') {
		color = '#2563eb';
		iconClass = 'fa-users';
	} else if (type === '인물') {
		color = '#16a34a';
		iconClass = 'fa-user';
	}

	const shadow = isHighlighted
		? '0 0 14px rgba(251,191,36,0.9)'
		: isFloating
			? '0 3px 10px rgba(0,0,0,0.25)'
			: '0 2px 6px rgba(0,0,0,0.3)';

	const certainty = Math.max(0, Math.min(1, certaintyScore));
	const isExact = certainty >= 0.999;
	const markerOpacity = isHighlighted ? 1 : 0.42 + 0.58 * certainty;
	const border = isHighlighted
		? '3px solid #fbbf24'
		: isExact
			? '2px solid white'
			: '2px dashed rgba(255,255,255,0.9)';

	// 불확실성이 클수록(certainty가 낮을수록) 마커 주변 halo 반경/농도가 커짐
	const haloScale = 1 - certainty;
	const haloSize = Math.round(size * (1 + haloScale * 1.1));
	const showHalo = !isHighlighted && haloScale > 0.05;
	const haloHtml = showHalo
		? `<div style="position:absolute; top:50%; left:50%; width:${haloSize}px; height:${haloSize}px; transform:translate(-50%,-50%); border-radius:50%; background:${color}; opacity:${(haloScale * 0.28).toFixed(2)}; filter: blur(1px); pointer-events:none;"></div>`
		: '';

	const badgeHtml = badgeCount > 0 ? `<div class="town-badge">${badgeCount}</div>` : '';

	const outerSize = Math.max(size + 8, haloSize);
	const html = `
		<div style="position:relative; width:${outerSize}px; height:${outerSize}px; display:flex; align-items:center; justify-content:center;">
			${haloHtml}
			<div style="position:relative; width:${size}px; height:${size}px;">
				<div style="background-color:${color}; width:${size}px; height:${size}px; border-radius:50%; display:flex; align-items:center; justify-content:center; border:${border}; box-shadow:${shadow}; opacity:${markerOpacity}; transition: all 0.25s; color:#fff;">
					<i class="fa-solid ${iconClass}" style="font-size:${Math.round(size * 0.42)}px;"></i>
				</div>
				${badgeHtml}
			</div>
		</div>`;

	return { html, size, outerSize };
}

/* MapLibre Marker 용 엘리먼트 생성 */
export function createMarkerEl(type, opts = {}) {
	const { html, size } = buildIcon(type, opts);
	const wrap = document.createElement('div');
	wrap.className = opts.isFloating ? 'floating-marker' : 'town-marker';
	wrap.innerHTML = html.trim();
	return { el: wrap, popupOffset: Math.round(size / 2 + 6) };
}

/* 클러스터 엘리먼트 (기존 iconCreateFunction 이식) */
export function createClusterEl(count) {
	let cls = 'marker-cluster-small';
	if (count >= 20) cls = 'marker-cluster-xlarge';
	else if (count >= 10) cls = 'marker-cluster-large';
	else if (count >= 5) cls = 'marker-cluster-medium';
	const el = document.createElement('div');
	el.className = `cluster-marker marker-cluster ${cls}`;
	el.innerHTML = `<div><span>${count}</span></div>`;
	return el;
}

/* 노드 라벨 엘리먼트 (기존 addNodeLabel 이식) */
export function createLabelEl(text) {
	const el = document.createElement('div');
	el.className = 'node-label';
	el.style.cssText =
		'pointer-events:none; font-size:13px; font-weight:700; color:#475569; white-space:nowrap; text-shadow: 0 0 3px #fff, 0 0 6px #fff, 0 0 8px #fff;';
	el.textContent = text;
	return el;
}
