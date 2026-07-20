<script>
	let { dark = false } = $props();
	let collapsed = $state(true);
</script>

<div class="map-legend map-panel" class:collapsed class:is-dark={dark}>
	<div class="panel-header-row">
		<span class="panel-header-label font-bold"
			><i class="fa-solid fa-map-location-dot mr-1 text-primary"></i> 범례</span
		>
		<button class="panel-collapse-btn" onclick={() => (collapsed = !collapsed)} title="범례 접기/펼치기">
			<i class="fa-solid fa-chevron-down"></i>
		</button>
	</div>
	<div class="panel-body">
		<div class="legend-row"><span class="legend-dot" style="background:#ea580c"></span> 마을 (Town)</div>
		<div class="legend-row">
			<span class="legend-dot" style="background:#2563eb"></span> 조직 (Organization)
		</div>
		<div class="legend-row"><span class="legend-dot" style="background:#16a34a"></span> 인물 (Person)</div>
		<div
			class="legend-precision text-slate-500 mt-1.5 pt-1.5 border-t border-slate-200"
			style="font-size:10px; line-height:1.5;"
		>
			<div class="font-semibold text-slate-600 mb-1">
				<i class="fa-solid fa-gauge-high text-[9px]"></i> 위치 확실성 (Exact → Unknown)
			</div>
			<div class="flex items-center gap-1 mb-1">
				<span style="width:9px;height:9px;border-radius:50%;background:#334155;display:inline-block;"></span>
				<span
					style="width:9px;height:9px;border-radius:50%;background:#334155;opacity:0.8;display:inline-block;border:1px dashed #334155;"
				></span>
				<span
					style="width:10px;height:10px;border-radius:50%;background:#334155;opacity:0.65;display:inline-block;border:1px dashed #334155;"
				></span>
				<span
					style="width:12px;height:12px;border-radius:50%;background:#334155;opacity:0.5;display:inline-block;border:1px dashed #334155;"
				></span>
				<span
					style="width:14px;height:14px;border-radius:50%;background:#334155;opacity:0.42;display:inline-block;border:1px dashed #334155;"
				></span>
			</div>
			<div class="flex justify-between" style="font-size:9px;">
				<span>Exact</span><span>Street</span><span>Village</span><span>Town</span><span>City</span
				><span>Region</span><span>Unknown</span>
			</div>
			<div class="mt-1" style="font-size:9.5px;">
				점이 흐리고 주변 halo가 클수록 위치 확실성이 낮은 기록입니다.
			</div>
		</div>
	</div>
</div>

<style>
	.map-legend {
		position: absolute;
		bottom: 18px;
		right: 12px;
		background: rgba(255, 255, 255, 0.96);
		border: 1px solid #e2e8f0;
		border-radius: 10px;
		padding: 10px 12px;
		font-size: 11px;
		color: #334155;
		box-shadow: 0 4px 14px rgba(0, 0, 0, 0.1);
		z-index: 500;
		min-width: 150px;
		transition:
			opacity 0.25s ease,
			background 0.25s ease;
		transform-origin: bottom right;
	}
	.map-legend :global(.legend-row) {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 3px 0;
	}
	.map-legend :global(.legend-dot) {
		width: 12px;
		height: 12px;
		border-radius: 999px;
		border: 2px solid white;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
		flex-shrink: 0;
	}
	.panel-header-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		margin-bottom: 6px;
	}
	.panel-header-label {
		font-size: 11px;
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

	/* 다크맵일 때 */
	.map-legend.is-dark {
		background: rgba(15, 23, 42, 0.9);
		border-color: rgba(255, 255, 255, 0.1);
		color: #cbd5e1;
	}
	.map-legend.is-dark :global(.legend-row),
	.map-legend.is-dark .panel-header-label,
	.map-legend.is-dark :global(.legend-precision) {
		color: #94a3b8 !important;
	}
	.map-legend.is-dark .panel-header-label {
		color: #e2e8f0 !important;
	}
</style>
