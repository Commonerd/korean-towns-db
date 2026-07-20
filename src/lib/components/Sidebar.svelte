<script>
	import { escapeHtml } from '$lib/util.js';
	import { renderPrecisionChip, renderAddressHtml } from '$lib/map/htmlBits.js';
	import YearSlider from './YearSlider.svelte';

	let {
		rawData = [],
		filteredData = [],
		selectedTownName = null,
		filter = 'all',
		search = '',
		loading = true,
		yearEnabled = false,
		yearMin = 1860,
		yearMax = 2026,
		yearRangeMin = 1860,
		yearRangeMax = 2026,
		collapsed = false,
		onSearch = () => {},
		onFilterChange = () => {},
		onYearToggle = () => {},
		onYearChange = () => {},
		onFocus = () => {},
		onAskAI = () => {},
		onClearSelection = () => {},
		onCollapse = () => {}
	} = $props();

	const filters = [
		{ type: 'all', label: '전체보기', icon: null, iconColor: '' },
		{ type: '마을', label: '마을', icon: 'fa-house', iconColor: 'text-orange-600' },
		{ type: '조직', label: '조직', icon: 'fa-users', iconColor: 'text-blue-600' },
		{ type: '인물', label: '인물', icon: 'fa-user', iconColor: 'text-green-600' }
	];

	// 표시 목록 (기존 renderSidebar 의 displayData 로직 이식)
	const displayData = $derived.by(() => {
		let list = [...filteredData];
		if (selectedTownName && filter === 'all') {
			const townItem = rawData.find((d) => d.type === '마을' && d.name === selectedTownName);
			const children = rawData.filter((d) => d.type !== '마을' && d.relatedTown === selectedTownName);
			list = list.filter((d) => d.name !== selectedTownName && d.relatedTown !== selectedTownName);
			if (townItem) list.unshift(townItem, ...children);
		}
		return list;
	});

	function badgeColor(item) {
		if (item.type === '마을') return 'bg-orange-100 text-orange-800 border-orange-200';
		if (item.type === '조직') return 'bg-blue-100 text-blue-800 border-blue-200';
		return 'bg-green-100 text-green-800 border-green-200';
	}
	function displayType(item) {
		if (item.type === '마을') return item.settlementType === '빌리지' ? '빌리지' : '타운';
		return item.type;
	}

	// 칩 묶음 HTML (countChip + extraChips + precisionChip)
	function chipsHtml(item) {
		let out = '';
		if (item.type === '마을') {
			const cnt = rawData.filter((d) => d.type !== '마을' && d.relatedTown === item.name).length;
			if (cnt > 0)
				out += `<span class="meta-chip" style="background:#fff7ed; color:#9a3412; border-color:#fed7aa;"><i class="fa-solid fa-diagram-project"></i> ${cnt}개 연결</span>`;
		}
		if (item.type === '조직' && item.orgType) {
			out += `<span class="meta-chip" style="background:#eff6ff; color:#1e40af; border-color:#bfdbfe;"><i class="fa-solid fa-tag"></i> ${escapeHtml(item.orgType)}</span>`;
		}
		if (item.type === '인물') {
			if (item.nationality)
				out += `<span class="meta-chip" style="background:#f0fdf4; color:#166534; border-color:#bbf7d0;"><i class="fa-solid fa-flag"></i> ${escapeHtml(item.nationality)}</span>`;
			if (item.job)
				out += `<span class="meta-chip" style="background:#fdf4ff; color:#86198f; border-color:#f5d0fe;"><i class="fa-solid fa-briefcase"></i> ${escapeHtml(item.job)}</span>`;
		}
		out += renderPrecisionChip(item);
		return out;
	}

	function isChildOf(item) {
		return selectedTownName && item.type !== '마을' && item.relatedTown === selectedTownName;
	}
	function isSelected(item) {
		return item.name === selectedTownName && item.type === '마을';
	}
</script>

<aside
	class="w-full md:w-96 bg-white border-r border-slate-200 flex flex-col z-10 shadow-[4px_0_15px_-3px_rgba(0,0,0,0.1)] h-[40vh] md:h-full transition-[width,min-width] duration-[250ms] ease-in-out"
	class:sidebar-collapsed={collapsed}
>
	<div class="p-4 border-b border-slate-100 bg-slate-50">
		<div class="flex items-center justify-between mb-3">
			<span class="text-xs font-bold text-slate-500 flex items-center gap-1.5">
				<i class="fa-solid fa-magnifying-glass text-primary"></i> 검색 &amp; 필터
			</span>
			<button
				onclick={onCollapse}
				title="검색 패널 숨기기"
				class="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
			>
				<i class="fa-solid fa-angles-left"></i>
			</button>
		</div>
		<div class="relative mb-3">
			<input
				type="text"
				value={search}
				oninput={(e) => onSearch(e.currentTarget.value)}
				placeholder="이름, 지역, 직업, 주소, 설명으로 검색..."
				class="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow"
			/>
			<i class="fa-solid fa-search absolute left-3 top-2.5 text-slate-400"></i>
		</div>

		<div class="flex gap-2 text-xs font-medium">
			{#each filters as f (f.type)}
				<button
					class="px-3 py-1.5 rounded-full border transition-all {filter === f.type
						? 'border-primary bg-primary text-white'
						: 'border-slate-300 bg-white text-slate-600 hover:bg-slate-100'}"
					onclick={() => onFilterChange(f.type)}
				>
					{#if f.icon}<i class="fa-solid {f.icon} {filter === f.type ? '' : f.iconColor} mr-1"></i>{/if}{f.label}
				</button>
			{/each}
		</div>

		<YearSlider
			enabled={yearEnabled}
			{yearMin}
			{yearMax}
			{yearRangeMin}
			{yearRangeMax}
			onToggle={onYearToggle}
			onChange={onYearChange}
		/>

		{#if selectedTownName}
			<div
				class="mt-3 p-2 bg-blue-50 border border-blue-200 rounded-lg text-xs flex items-center justify-between"
			>
				<span class="text-blue-800"
					><i class="fa-solid fa-circle-nodes mr-1"></i> <b>{selectedTownName}</b> 관계망 보기 중</span
				>
				<button
					onclick={onClearSelection}
					class="text-blue-600 hover:text-blue-800 hover:bg-blue-100 px-2 py-0.5 rounded"
				>
					<i class="fa-solid fa-xmark"></i> 해제
				</button>
			</div>
		{/if}
	</div>

	<div class="flex-1 overflow-y-auto p-2">
		{#if loading}
			<div
				class="p-8 text-center text-slate-400 text-sm flex flex-col gap-2 justify-center items-center h-full"
			>
				<i class="fa-solid fa-circle-notch fa-spin text-xl text-primary"></i>
				DB 데이터를 불러오는 중...
			</div>
		{:else if displayData.length === 0}
			<div class="p-8 text-center text-slate-400 text-sm">
				<i class="fa-solid fa-folder-open text-2xl mb-2 text-slate-300 block"></i>
				검색 결과가 없습니다.
			</div>
		{:else}
			{#each displayData as item (item.type + '-' + item.id)}
				<div
					class="p-3 mb-2 bg-white border border-slate-200 rounded-lg shadow-sm hover:shadow-md hover:border-primary cursor-pointer transition-all"
					class:selected-card={isSelected(item)}
					class:network-child-card={isChildOf(item)}
					onclick={() => onFocus(item)}
					role="button"
					tabindex="0"
					onkeydown={(e) => (e.key === 'Enter' ? onFocus(item) : null)}
				>
					<div class="flex justify-between items-start mb-1 gap-2">
						<h3
							class="font-bold text-slate-800 font-serif {isChildOf(item)
								? 'text-base'
								: 'text-lg'} flex-1 min-w-0 truncate"
						>
							{#if isChildOf(item)}<i
									class="fa-solid fa-arrow-turn-up rotate-90 mr-1 text-slate-400"
								></i>{/if}{item.name}
						</h3>
						<span
							class="text-[10px] px-2 py-0.5 rounded-full border font-medium flex-shrink-0 {badgeColor(
								item
							)}">{displayType(item)}</span
						>
					</div>
					<p class="text-xs text-slate-500 mb-2 line-clamp-2">
						{#if item.description}{item.description}{:else}<span class="italic text-slate-300"
								>설명 없음</span
							>{/if}
					</p>
					<div class="flex flex-wrap mb-1">{@html chipsHtml(item)}</div>
					{@html renderAddressHtml(item, { compact: true })}
					{#if item.relatedTown}
						<div class="text-[10px] text-primary font-medium mb-1">
							<i class="fa-solid fa-link"></i> 소속마을: {item.relatedTown}
						</div>
					{/if}
					{#if item.relatedOrg}
						<div class="text-[10px] text-purple-700 font-medium mb-1">
							<i class="fa-solid fa-sitemap"></i> 소속조직: {item.relatedOrg}
						</div>
					{/if}
					<div class="flex justify-between items-end text-[10px] text-slate-400 mt-1">
						<span
							><i class="fa-regular fa-clock"></i> {item.founded || '미상'} ~ {item.dissolved ||
								'미상'}</span
						>
						<button
							onclick={(e) => {
								e.stopPropagation();
								onAskAI(item.id);
							}}
							class="text-purple-600 hover:text-purple-800 hover:bg-purple-100 transition-colors bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200 mt-1"
						>
							<i class="fa-solid fa-sparkles"></i> AI 해설
						</button>
					</div>
				</div>
			{/each}
		{/if}
	</div>

	<div
		class="p-2 border-t border-slate-200 bg-slate-50 text-xs text-slate-500 flex justify-between items-center"
	>
		<span>총 {filteredData.length}건</span>
		<a
			href="https://buymeacoffee.com/koreatowndb"
			class="hover:text-amber-600 transition-colors flex items-center gap-1 opacity-80 hover:opacity-100"
			target="_blank"
			rel="noopener noreferrer"
		>
			<i class="fa-solid fa-seedling text-[10px] text-emerald-600"></i>
			<span>아카이브 후원하기</span>
		</a>
		<span>DB v2.0 (Phase 1)</span>
	</div>
</aside>

<style>
	.sidebar-collapsed {
		width: 0 !important;
		min-width: 0 !important;
		border-right-width: 0 !important;
		border-bottom-width: 0 !important;
		overflow: hidden !important;
	}
	.sidebar-collapsed > :global(*) {
		opacity: 0;
		pointer-events: none;
	}
	@media (max-width: 767px) {
		.sidebar-collapsed {
			height: 0 !important;
		}
	}
</style>
