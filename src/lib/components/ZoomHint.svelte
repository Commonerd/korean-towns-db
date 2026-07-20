<script>
	import { ZOOM_DETAIL_THRESHOLD } from '$lib/map/mapStyle.js';

	let { zoom = 5, dark = false } = $props();

	let visible = $state(false);
	let html = $state('');
	let timer = null;

	// 기존 updateZoomHint 로직 이식
	$effect(() => {
		const z = zoom;
		if (timer) clearTimeout(timer);

		if (z >= ZOOM_DETAIL_THRESHOLD) {
			visible = false;
			return;
		}

		const isMobile = window.innerWidth < 768;
		const zr = Math.round(z);
		html = isMobile
			? `<i class="fa-solid fa-magnifying-glass-plus mr-1"></i> 확대하면 점들이 펼쳐집니다 (Zoom ${zr})`
			: `<i class="fa-solid fa-magnifying-glass-plus mr-1"></i> 지도를 확대하면 점들이 펼쳐집니다 (현재 zoom ${zr})`;
		visible = true;
		timer = setTimeout(() => (visible = false), 3000);

		return () => {
			if (timer) clearTimeout(timer);
		};
	});
</script>

<div class="zoom-hint" class:is-dark={dark} style="opacity: {visible ? 1 : 0};">
	{@html html}
</div>

<style>
	.zoom-hint {
		position: absolute;
		top: 12px;
		left: 50%;
		transform: translateX(-50%);
		background: rgba(15, 23, 42, 0.85);
		color: white;
		font-size: 11px;
		padding: 6px 14px;
		border-radius: 999px;
		backdrop-filter: blur(6px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
		z-index: 500;
		pointer-events: none;
		transition: opacity 0.4s;
		white-space: nowrap;
	}
	.zoom-hint.is-dark {
		background: rgba(2, 6, 23, 0.9);
	}
	@media (max-width: 767px) {
		.zoom-hint {
			top: 64px;
			font-size: 9px;
			padding: 5px 12px;
			white-space: normal;
			text-align: center;
			max-width: 90%;
		}
	}
</style>
