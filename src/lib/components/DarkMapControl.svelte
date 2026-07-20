<script>
	let { value = 0, onChange = () => {} } = $props();
	let collapsed = $state(true);

	const dark = $derived(value > 0.5);
	const pct = $derived(Math.round(value * 100));
</script>

<div
	class="map-panel dark-control"
	class:collapsed
	class:is-dark={dark}
	style="min-width:180px;"
>
	<div class="panel-header-row">
		<span class="panel-header-label text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
			<i class="fa-solid fa-moon text-indigo-500"></i> 지도 스타일
		</span>
		<div class="flex items-center gap-1.5">
			<span class="text-[10px] text-slate-400 font-mono">{pct}%</span>
			<button
				class="panel-collapse-btn"
				onclick={() => (collapsed = !collapsed)}
				title="지도 스타일 패널 접기/펼치기"
			>
				<i class="fa-solid fa-chevron-up"></i>
			</button>
		</div>
	</div>
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
			<span>밝음</span><span>어두움</span>
		</div>
	</div>
</div>

<style>
	.dark-control {
		position: absolute;
		top: 12px;
		right: 12px;
		z-index: 500;
		background: rgba(255, 255, 255, 0.95);
		backdrop-filter: blur(4px);
		border: 1px solid #e2e8f0;
		border-radius: 12px;
		box-shadow: 0 10px 20px rgba(0, 0, 0, 0.12);
		padding: 10px 12px;
		transition:
			padding 0.2s ease,
			background 0.25s ease;
	}
	.panel-header-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		margin-bottom: 8px;
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
		cursor: pointer;
		transition:
			background 0.2s,
			color 0.2s;
		flex-shrink: 0;
		background: transparent;
		border: none;
	}
	.panel-collapse-btn:hover {
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
