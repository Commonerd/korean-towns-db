<script>
	let {
		enabled = false,
		yearMin = 1860,
		yearMax = 2026,
		yearRangeMin = 1860,
		yearRangeMax = 2026,
		onToggle = () => {},
		onChange = () => {}
	} = $props();

	let sliderEl;

	const range = $derived(Math.max(1, yearRangeMax - yearRangeMin));
	const minPct = $derived(((yearMin - yearRangeMin) / range) * 100);
	const maxPct = $derived(((yearMax - yearRangeMin) / range) * 100);

	function startDrag(e, isMin) {
		e.preventDefault();
		const rect = sliderEl.getBoundingClientRect();
		const span = yearRangeMax - yearRangeMin;

		function onMove(ev) {
			const clientX = ev.touches ? ev.touches[0].clientX : ev.clientX;
			let pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
			let val = Math.round(yearRangeMin + pct * span);
			if (isMin) {
				onChange(Math.min(val, yearMax - 1), yearMax);
			} else {
				onChange(yearMin, Math.max(val, yearMin + 1));
			}
		}
		function onUp() {
			document.removeEventListener('mousemove', onMove);
			document.removeEventListener('touchmove', onMove);
			document.removeEventListener('mouseup', onUp);
			document.removeEventListener('touchend', onUp);
		}
		document.addEventListener('mousemove', onMove);
		document.addEventListener('touchmove', onMove, { passive: false });
		document.addEventListener('mouseup', onUp);
		document.addEventListener('touchend', onUp);
	}
</script>

<div class="mt-3 flex items-center gap-2">
	<button
		class="flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all text-xs font-medium flex-shrink-0 {enabled
			? 'border-primary bg-primary text-white'
			: 'border-slate-300 bg-white text-slate-600 hover:bg-slate-100'}"
		onclick={onToggle}
	>
		<i class="fa-solid fa-clock-rotate-left {enabled ? 'text-white' : 'text-amber-600'}"></i> 연도 필터
	</button>
	<span class="text-[10px] text-slate-400">{yearRangeMin} – {yearRangeMax}</span>
</div>

<div
	class="overflow-hidden transition-all duration-300"
	style="max-height: {enabled ? '80px' : '0'}; opacity: {enabled ? 1 : 0};"
>
	<div class="pt-3 pb-1 px-1">
		<div class="flex justify-between text-[11px] font-bold text-primary mb-2">
			<span>{yearMin}</span>
			<span>{yearMax}</span>
		</div>
		<div
			bind:this={sliderEl}
			class="relative h-6 flex items-center select-none"
			style="cursor:pointer;"
		>
			<div class="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-slate-200"></div>
			<div
				class="absolute top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-primary"
				style="left:{minPct}%; width:{maxPct - minPct}%;"
			></div>
			<button
				class="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-primary border-2 border-white shadow-md cursor-grab active:cursor-grabbing z-10 transition-shadow hover:shadow-lg year-thumb"
				style="left:{minPct}%;"
				aria-label="시작 연도"
				onmousedown={(e) => startDrag(e, true)}
				ontouchstart={(e) => startDrag(e, true)}
			></button>
			<button
				class="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-primary border-2 border-white shadow-md cursor-grab active:cursor-grabbing z-10 transition-shadow hover:shadow-lg year-thumb"
				style="left:{maxPct}%;"
				aria-label="종료 연도"
				onmousedown={(e) => startDrag(e, false)}
				ontouchstart={(e) => startDrag(e, false)}
			></button>
		</div>
		<div class="flex justify-between text-[9px] text-slate-400 mt-0.5 px-1">
			<span></span>
			<span class="text-center text-slate-300">드래그하여 기간 설정</span>
			<span></span>
		</div>
	</div>
</div>

<style>
	.year-thumb {
		padding: 0;
		transition:
			box-shadow 0.15s,
			transform 0.1s;
	}
	.year-thumb:hover {
		transform: translateY(-50%) translateX(-50%) scale(1.2);
	}
	.year-thumb:active {
		transform: translateY(-50%) translateX(-50%) scale(1.1);
		box-shadow: 0 0 0 4px rgba(30, 58, 138, 0.18);
	}
</style>
