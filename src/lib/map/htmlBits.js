import { escapeHtml, linkify } from '$lib/util.js';
import { PRECISION_ORDER, getPrecisionRank, certaintyColor } from '$lib/data/precision.js';
import { t, precisionLabel, precisionDesc } from '$lib/i18n/store.svelte.js';

/* 사이드바 카드용 — 짧은 칩 형태 (기존 renderPrecisionChip 이식) */
export function renderPrecisionChip(item) {
	const key = item.locationPrecision || 'unknown';
	const pct = Math.round((item.certaintyScore ?? 0) * 100);
	const color = certaintyColor(pct);
	return `<span class="meta-chip" style="background:#f8fafc; color:#334155; border-color:#e2e8f0;" title="${escapeHtml(
		precisionDesc(key)
	)}">
		<i class="fa-solid fa-signal" style="color:${color};"></i> ${precisionLabel(key)}
	</span>`;
}

/* 팝업용 — 확실성 게이지(신호 막대 형태) + 설명 (기존 renderCertaintyGaugeHtml 이식) */
export function renderCertaintyGaugeHtml(item) {
	const key = item.locationPrecision || 'unknown';
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
				<b class="text-slate-700"><i class="fa-solid fa-gauge-high" style="color:${color};"></i> ${t('certainty.title', { label: precisionLabel(key) })}</b>
			</div>
			<div class="mb-1">${bars}</div>
			<div>${escapeHtml(precisionDesc(key))}</div>
		</div>`;
}

/* 주소(텍스트 보존) 블록 (기존 renderAddressHtml 이식) */
export function renderAddressHtml(item, { compact = false } = {}) {
	if (!item.address) return '';
	if (compact) {
		return `<div class="text-[10px] text-slate-500 mb-1" title="${escapeHtml(t('addr.compactTitle'))}">
			<i class="fa-solid fa-map-pin text-slate-400"></i> ${t('addr.label')}: ${escapeHtml(item.address)}
		</div>`;
	}
	return `<div class="text-[11px] text-slate-600 mb-2">
		<i class="fa-solid fa-map-pin text-slate-400"></i> <b>${t('addr.label')}:</b> ${escapeHtml(item.address)}
		<div class="text-[10px] text-slate-400 mt-0.5">${escapeHtml(t('addr.note'))}</div>
	</div>`;
}

/* 위치 근거(location_basis) 블록 — 왜 이 좌표로 비정했는지 사료적 근거를 보존 */
export function renderLocationBasisHtml(item) {
	if (!item.locationBasis) return '';
	return `<div class="text-[10.5px] text-slate-600 bg-slate-50 border border-slate-200 rounded p-2 mb-2 leading-relaxed">
		<b class="text-slate-700"><i class="fa-solid fa-compass-drafting text-slate-400"></i> ${t('locationBasis.title')}</b>
		<div class="mt-0.5">${linkify(item.locationBasis)}</div>
	</div>`;
}
