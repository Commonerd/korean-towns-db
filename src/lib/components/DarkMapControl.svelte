<script>
	import { t } from '$lib/i18n/store.svelte.js';
	let { value = 0, onChange = () => {} } = $props();
	let collapsed = $state(true);

	const dark = $derived(value > 0.5);
	const pct = $derived(Math.round(value * 100));
</script>

<div class="map-panel dark-control" class:collapsed class:is-dark={dark}>
	<button
		class="panel-header-row panel-header-btn"
		onclick={() => (collapsed = !collapsed)}
		title={t('darkmap.toggle')}
		aria-label={t('darkmap.toggle')}
		aria-expanded={!collapsed}
	>
		<span class="panel-header-label text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
			<i class="fa-solid fa-moon text-indigo-500"></i><span class="panel-label-text"
				>&nbsp;{t('darkmap.title')}</span
			>
		</span>
		<span class="flex items-center gap-1.5">
			<span class="text-[10px] text-slate-400 font-mono">{pct}%</span>
			<span class="panel-collapse-btn">
				<i class="fa-solid fa-chevron-up"></i>
			</span>
		</span>
	</button>
	<div class="panel-body">
		<div class="flex items-center gap-2">
			<i class="fa-solid fa-sun text-amber-400 text-xs flex-shrink-0"></i>
			<input
				type="range"
				min="0"
				max="1"
				step="0.01"
				{value}
				oninput={(e) => onChange(parseFloat(e.currentTarget.value))}
				class="dark-slider flex-1 h-1.5 rounded-full appearance-none cursor-pointer"
			/>
			<i class="fa-solid fa-moon text-indigo-500 text-xs flex-shrink-0"></i>
		</div>
		<div class="flex justify-between text-[9px] text-slate-400 mt-1">
			<span>{t('darkmap.light')}</span><span>{t('darkmap.dark')}</span>
		</div>
	</div>
</div>

<style>
	.dark-control {
		/* 우측 상단은 지도 헤더의 언어 전환 드롭다운이 열릴 때 그 아래로 열리는
		   영역과 겹친다(데스크톱·모바일 공통). 겹치지 않도록 좌측 하단에 배치.
		   하단 여백도 넉넉히 둬 지도 attribution(© OpenStreetMap 등) 표시와 안 겹치게 함. */
		position: absolute;
		bottom: 46px;
		left: 12px;
		z-index: 500;
		min-width: 180px;
		background: rgba(255, 255, 255, 0.95);
		backdrop-filter: blur(4px);
		border: 1px solid #e2e8f0;
		border-radius: 12px;
		box-shadow: 0 10px 20px rgba(0, 0, 0, 0.12);
		padding: 10px 12px;
		transition:
			padding 0.2s ease,
			min-width 0.2s ease,
			background 0.25s ease;
	}
	.dark-control.collapsed {
		min-width: 0;
	}
	.panel-header-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		margin-bottom: 8px;
	}
	.panel-header-btn {
		width: 100%;
		min-height: 22px;
		padding: 0;
		background: transparent;
		border: none;
		cursor: pointer;
		font: inherit;
		color: inherit;
		text-align: left;
	}
	/* 접힌 상태에서는 "지도 스타일" 같은 글자 대신 아이콘만 남긴다 */
	.map-panel.collapsed .panel-label-text {
		display: none;
	}
	.panel-collapse-btn {
		width: 22px;
		height: 22px;
		border-radius: 6px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #94a3b8;
		font-size: 11px;
		transition:
			background 0.2s,
			color 0.2s;
		flex-shrink: 0;
	}
	.panel-header-btn:hover .panel-collapse-btn {
		background: #f1f5f9;
		color: #475569;
	}
	.map-panel.collapsed .panel-body {
		display: none;
	}
	.map-panel.collapsed {
		padding: 8px 10px;
	}
	.map-panel.collapsed .panel-header-row {
		margin-bottom: 0;
	}
	.map-panel.collapsed .panel-collapse-btn :global(i) {
		transform: rotate(180deg);
	}

	.dark-control.is-dark {
		background: rgba(15, 23, 42, 0.9);
		border-color: rgba(255, 255, 255, 0.08);
	}
	.dark-control.is-dark .panel-header-label,
	.dark-control.is-dark .text-slate-400 {
		color: #94a3b8 !important;
	}

	/* 슬라이더 (기존 #darkMapSlider 스타일 이식) */
	.dark-slider {
		accent-color: #6366f1;
	}
	.dark-slider::-webkit-slider-thumb {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: #6366f1;
		border: 2px solid white;
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
		cursor: pointer;
		-webkit-appearance: none;
	}
	.dark-slider::-webkit-slider-runnable-track {
		height: 6px;
		border-radius: 4px;
		background: linear-gradient(to right, #fbbf24, #6366f1);
	}
	.dark-slider::-moz-range-thumb {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: #6366f1;
		border: 2px solid white;
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
		cursor: pointer;
	}
	.dark-slider::-moz-range-track {
		height: 6px;
		border-radius: 4px;
		background: linear-gradient(to right, #fbbf24, #6366f1);
	}
</style>
