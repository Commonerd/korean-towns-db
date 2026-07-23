import { escapeHtml } from '$lib/util.js';
import { renderAddressHtml, renderCertaintyGaugeHtml, renderLocationBasisHtml } from './htmlBits.js';
import { t, typeLabel } from '$lib/i18n/store.svelte.js';

/* 팝업 HTML 생성 (기존 attachPopupAndEvents 의 popupContent 이식)
   AI 해설 버튼은 전역 함수 대신 data-ai-id 로 위임 처리한다. */
export function buildPopupHtml(item, rawData) {
	let extraMetaHtml = '';
	if (item.type === '조직' && item.orgType) {
		extraMetaHtml += `<span class="chip" style="background:#eff6ff; color:#1e40af; border-color:#bfdbfe;"><i class="fa-solid fa-tag"></i> ${escapeHtml(
			item.orgType
		)}</span>`;
	}
	if (item.type === '인물') {
		if (item.nationality)
			extraMetaHtml += `<span class="chip" style="background:#f0fdf4; color:#166534; border-color:#bbf7d0;"><i class="fa-solid fa-flag"></i> ${escapeHtml(
				item.nationality
			)}</span>`;
		if (item.job)
			extraMetaHtml += `<span class="chip" style="background:#fdf4ff; color:#86198f; border-color:#f5d0fe;"><i class="fa-solid fa-briefcase"></i> ${escapeHtml(
				item.job
			)}</span>`;
	}
	if (item.type === '사건' && item.eventType) {
		extraMetaHtml += `<span class="chip" style="background:#faf5ff; color:#6b21a8; border-color:#e9d5ff;"><i class="fa-solid fa-bolt"></i> ${escapeHtml(
			item.eventType
		)}</span>`;
	}

	let relationsHtml = '';
	if (item.type === '마을') {
		const subOrgs = rawData.filter((d) => d.type === '조직' && d.relatedTown === item.name);
		const subPers = rawData.filter((d) => d.type === '인물' && d.relatedTown === item.name);
		const subEvents = rawData.filter((d) => d.type === '사건' && d.relatedTown === item.name);
		if (subOrgs.length)
			relationsHtml += `<div class="text-[11px] text-blue-700 mt-1"><b><i class="fa-solid fa-users"></i> ${t('popup.relatedOrgs')}(${subOrgs.length}):</b> ${escapeHtml(
				subOrgs.map((d) => d.name).join(', ')
			)}</div>`;
		if (subPers.length)
			relationsHtml += `<div class="text-[11px] text-green-700 mt-0.5"><b><i class="fa-solid fa-user"></i> ${t('popup.relatedPersons')}(${subPers.length}):</b> ${escapeHtml(
				subPers.map((d) => d.name).join(', ')
			)}</div>`;
		if (subEvents.length)
			relationsHtml += `<div class="text-[11px] text-purple-700 mt-0.5"><b><i class="fa-solid fa-bolt"></i> ${typeLabel('사건')}(${subEvents.length}):</b> ${escapeHtml(
				subEvents.map((d) => d.name).join(', ')
			)}</div>`;
	}

	// 사건의 관련 대상(마을·조직·인물, 쉼표 다중값 허용)
	let eventRelationsHtml = '';
	if (item.type === '사건') {
		if (item.relatedPerson)
			eventRelationsHtml += `<div class="text-[11px] text-green-700 mb-1"><i class="fa-solid fa-user"></i> ${t('popup.relatedPersons')}: ${escapeHtml(
				item.relatedPerson
			)}</div>`;
		if (item.relatedOrg)
			eventRelationsHtml += `<div class="text-[11px] text-blue-700 mb-1"><i class="fa-solid fa-users"></i> ${t('popup.relatedOrgs')}: ${escapeHtml(
				item.relatedOrg
			)}</div>`;
		const towns = item.relatedTownAll || item.relatedTown;
		if (towns)
			eventRelationsHtml += `<div class="text-[11px] text-orange-700 mb-1"><i class="fa-solid fa-house-chimney"></i> ${t('popup.relatedTowns')}: ${escapeHtml(
				towns
			)}</div>`;
	}

	const addressHtml = renderAddressHtml(item);
	const uncertaintyHtml = renderCertaintyGaugeHtml(item);
	const locationBasisHtml = renderLocationBasisHtml(item);

	return `
		<div class="custom-popup max-w-[320px]">
			<div class="text-[10px] text-slate-500 mb-1">${
				item.type === '마을' ? typeLabel('마을', item.settlementType) : typeLabel(item.type)
			}${item.relatedTown && item.type !== '사건' ? ` · ${t('popup.affil')}: ${escapeHtml(item.relatedTown)}` : ''}</div>
			<div class="title">${escapeHtml(item.name)}</div>
			<div class="meta"><i class="fa-regular fa-clock"></i> ${escapeHtml(item.founded || t('common.unknown'))} ~ ${escapeHtml(
				item.dissolved || t('common.unknown')
			)}</div>
			<div class="mb-2">${extraMetaHtml}</div>
			${addressHtml}
			<div class="desc mb-2">${
				escapeHtml(item.description) || `<span class="italic text-slate-400">${t('common.noDescription')}</span>`
			}</div>
			${uncertaintyHtml}
			${locationBasisHtml}
			${
				item.relatedOrg && item.type !== '사건'
					? `<div class="text-[11px] text-purple-700 mb-1"><i class="fa-solid fa-sitemap"></i> ${t('popup.orgOf')}: ${escapeHtml(
							item.relatedOrg
						)}</div>`
					: ''
			}
			${eventRelationsHtml}
			${relationsHtml}
			<div class="text-[10px] text-slate-400 border-t pt-2 mt-2 flex flex-col gap-2">
				<div class="break-words overflow-hidden">
					<strong>${t('popup.source')}:</strong> ${escapeHtml(item.source || t('popup.selfResearch'))}<br>
					<strong>${t('popup.author')}:</strong> ${escapeHtml(item.author || t('popup.researchTeam'))}
				</div>
				<button data-ai-id="${item.id}" class="w-full bg-purple-50 text-purple-700 hover:bg-purple-100 px-2 py-1.5 rounded text-[10px] border border-purple-200 transition-colors flex-shrink-0">
					<i class="fa-solid fa-wand-magic-sparkles"></i> ${t('sidebar.aiExplain')}
				</button>
			</div>
		</div>
	`;
}
