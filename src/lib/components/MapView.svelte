<script>
	import { onMount } from 'svelte';
	import { createMapStyle } from '$lib/map/mapStyle.js';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import '$lib/map/map.css';

	let {
		rawData = [],
		filter = 'all',
		search = '',
		selectedTownName = null,
		yearEnabled = false,
		yearMin = 1860,
		yearMax = 2026,
		yearRangeMin = 1860,
		yearRangeMax = 2026,
		darkOpacity = 0,
		onSelectTown = () => {},
		onAskAI = () => {},
		onZoom = () => {},
		onReady = () => {}
	} = $props();

	let container;
	let map = null;
	let controller = null;
	let ready = $state(false);

	// 외부(사이드바 카드 클릭)에서 호출하는 명령형 API
	export function focus(item) {
		controller?.focus(item);
	}

	onMount(() => {
		let ro;
		let disposed = false;

		(async () => {
			const maplibregl = (await import('maplibre-gl')).default;
			const { MapController } = await import('$lib/map/controller.js');
			if (disposed) return;

			map = new maplibregl.Map({
				container,
				style: createMapStyle(),
				center: [132.0, 43.0],
				zoom: 5,
				minZoom: 2,
				maxZoom: 19,
				renderWorldCopies: true,
				attributionControl: { compact: true }
			});
			map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');

			map.on('zoom', () => onZoom(map.getZoom()));

			// 스타일 로드 시점에 컨트롤러 초기화.
			// 'load' 이벤트는 첫 타일 렌더까지 기다리므로, 타일이 느리거나 막힌
			// 환경에서도 안전하도록 styledata + isStyleLoaded 로 판단한다.
			let inited = false;
			const initController = () => {
				// getLayer 는 스타일 파싱 완료(타일 로드와 무관) 시점부터 값을 반환한다.
				if (inited || disposed || !map || !map.getLayer('osm-light')) return;
				inited = true;
				map.off('styledata', initController);
				controller = new MapController(map, { onSelectTown, onAskAI });
				controller.update({
					filter,
					search,
					selectedTownName,
					yearEnabled,
					yearMin,
					yearMax,
					yearRangeMin,
					yearRangeMax,
					darkOpacity
				});
				controller.setData(rawData);
				ready = true;
				onZoom(map.getZoom());
				onReady();
			};
			map.on('styledata', initController);
			map.on('load', initController);
			initController();

			ro = new ResizeObserver(() => map && map.resize());
			ro.observe(container);
			setTimeout(() => map && map.resize(), 200);
			if (document.fonts && document.fonts.ready) {
				document.fonts.ready.then(() => map && map.resize());
			}
		})();

		return () => {
			disposed = true;
			if (ro) ro.disconnect();
			if (controller) controller.destroy();
			if (map) map.remove();
		};
	});

	// 데이터 변경 → 컨트롤러에 반영
	$effect(() => {
		const data = rawData;
		if (ready && controller) controller.setData(data);
	});

	// 필터/검색/연도/선택/다크 상태 변경 → 컨트롤러에 반영
	$effect(() => {
		const state = {
			filter,
			search,
			selectedTownName,
			yearEnabled,
			yearMin,
			yearMax,
			yearRangeMin,
			yearRangeMax,
			darkOpacity
		};
		if (ready && controller) controller.update(state);
	});
</script>

<div class="map-root" bind:this={container}></div>

<style>
	.map-root {
		position: absolute;
		inset: 0;
		z-index: 0;
	}
</style>
