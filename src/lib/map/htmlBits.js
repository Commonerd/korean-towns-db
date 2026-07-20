import { escapeHtml } from '$lib/util.js';
import { PRECISION_ORDER, PRECISION_INFO, getPrecisionRank, certaintyColor } from '$lib/data/precision.js';

/* 사이드바 카드용 — 짧은 칩 형태 (기존 renderPrecisionChip 이식) */
export function renderPrecisionChip(item) {
	const info = PRECISION_INFO[item.locationPrecision] || PRECISION_INFO.unknown;
	const pct = Math.round((item.certaintyScore ?? 0) * 100);
	const color = certaintyColor(pct);
	return `<span class="meta-chip" style="background:#f8fafc; color:#334155; border-color:#e2e8f0;" title="${escapeHtml(
		info.desc
	)}">
		<i class="fa-solid fa-signal" style="color:${color};"></i> ${info.label} · 확실성 ${pct}%
	</span>`;
}

/* 팝업용 — 확실성 게이지(신호 막대 형태) + 설명 (기존 renderCertaintyGaugeHtml 이식) */
export function renderCertaintyGaugeHtml(item) {
	const info = PRECISION_INFO[item.locationPrecision] || PRECISION_INFO.unknown;
	const rank = getPrecisionRank(item.locationPrecision);
	const pct = Math.round((item.certaintyScore ?? 0) * 100);
	const color = certaintyColor(pct);
	const filledCount = PRECISION_ORDER.length - rank; // Exact→7칸, Unknown→1칸 채움

	const bars = PRECISION_ORDER.map((_, i) => {
		const filled = i < filledCount;
		return `<span style="width:7px;height:7px;border-radius:50%;display:inline-block;margin-right:2px;background:${
			filled ? color : '#e2e8f0'
		};"></span>`;
	}).join('');

	return `
		<div class="text-[10.5px] bg-slate-50 text-slate-600 p-2 rounded border border-slate-200 mt-1 mb-2 leading-relaxed">
			<div class="flex items-center justify-between mb-1">
				<b class="text-slate-700"><i class="fa-solid fa-gauge-high" style="color:${color};"></i> 위치 확실성: ${info.label}</b>
				<span style="color:${color}; font-weight:700;">${pct}%</span>
			</div>
			<div class="mb-1">${bars}</div>
			<div>${escapeHtml(info.desc)}</div>
		</div>`;
}

/* 주소(텍스트 보존) 블록 (기존 renderAddressHtml 이식) */
export function renderAddressHtml(item, { compact = false } = {}) {
	if (!item.address) return '';
	if (compact) {
		return `<div class="text-[10px] text-slate-500 mb-1" title="현재 주소 체계와 다르거나 지도 좌표와 정확히 일치하지 않을 수 있으나, 사료상 주소를 텍스트로 보존합니다.">
			<i class="fa-solid fa-map-pin text-slate-400"></i> 주소: ${escapeHtml(item.address)}
		</div>`;
	}
	return `<div class="text-[11px] text-slate-600 mb-2">
		<i class="fa-solid fa-map-pin text-slate-400"></i> <b>주소:</b> ${escapeHtml(item.address)}
		<div class="text-[10px] text-slate-400 mt-0.5">사료상의 주소 표기이며, 현재 주소 체계와 다르거나 지도 좌표와 정확히 일치하지 않을 수 있습니다.</div>
	</div>`;
}
