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
        terrainMode = 'terrain',
        locale = 'ko',
        onSelectTown = () => {},
        onAskAI = () => {},
        onZoom = () => {},
        onReady = () => {}
    } = $props();

    let container;
    let map = null;
    let controller = null;
    let ready = $state(false);
    let applyTerrainMode = (mode = terrainMode, opacity = darkOpacity) => {};

    export function focus(item) {
        controller?.focus(item);
    }

    export function setTerrainMode(mode = terrainMode, opacity = darkOpacity) {
        applyTerrainMode(mode, opacity);
    }

    onMount(() => {
        let ro;
        let disposed = false;

        (async () => {
            const maplibregl = (await import('maplibre-gl')).default;
            const { MapController } = await import('$lib/map/controller.js');
            if (disposed) return;

            const setupTerrainSource = () => {
                if (!map || disposed) return;
                if (!map.getSource('free-dem')) {
                    map.addSource('free-dem', {
                        type: 'raster-dem',
                        tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
                        encoding: 'terrarium',
                        tileSize: 256,
                        maxzoom: 15
                    });
                }
                if (!map.getLayer('hills')) {
                    map.addLayer({
                        id: 'hills',
                        type: 'hillshade',
                        source: 'free-dem',
                        layout: { visibility: 'visible' },
                        paint: {
                            'hillshade-exaggeration': 1.5,
                            'hillshade-shadow-color': '#000000',
                            'hillshade-highlight-color': '#ffffff'
                        }
                    });
                }
            };

            applyTerrainMode = (mode = terrainMode, opacity = darkOpacity) => {
                if (!map || disposed) return;
                const flat = mode === 'flat';

                try {
                    setupTerrainSource();
                    if (flat) {
                        map.setTerrain(null);
                        if (map.getLayer('hills')) {
                            map.setLayoutProperty('hills', 'visibility', 'none');
                            map.setPaintProperty('hills', 'hillshade-opacity', 0);
                        }
                        map.setPitch(0);
                        map.setBearing(0);
                        return;
                    }

                    map.setTerrain({ source: 'free-dem', exaggeration: 2.5 });
                    if (map.getLayer('hills')) {
                        map.setLayoutProperty('hills', 'visibility', 'visible');
                        const exp = 1.5 + 3.0 * Math.max(0, Math.min(1, opacity));
                        map.setPaintProperty('hills', 'hillshade-exaggeration', exp);
                        const overlayOpacity = 0.6 + 0.4 * Math.max(0, Math.min(1, opacity));
                        map.setPaintProperty('hills', 'hillshade-opacity', overlayOpacity);
                    }
                    map.setPitch(50);
                    map.setBearing(0);
                } catch (err) {
                    console.warn('DEM terrain setup failed:', err);
                }
            };

            map = new maplibregl.Map({
                container,
                style: createMapStyle(),
                center: [132.0, 43.0],
                zoom: 5,
                pitch: 50,
                maxPitch: 85,
                minZoom: 2,
                maxZoom: 19,
                renderWorldCopies: true,
                attributionControl: { compact: true }
            });

            map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-left');
            map.on('zoom', () => onZoom(map.getZoom()));

            // 스타일이 완전히 세팅되거나 로드되었을 때 Terrain 설정 실행
            map.on('style.load', () => applyTerrainMode(terrainMode, darkOpacity));

            let inited = false;
            const initController = () => {
                if (inited || disposed || !map || !map.getLayer('osm-light')) return;
                inited = true;

                // 컨트롤러 초기화 전 지형 설정 한번 더 체크
                applyTerrainMode(terrainMode, darkOpacity);

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
                    darkOpacity,
                    locale
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
        })();

        return () => {
            disposed = true;
            if (ro) ro.disconnect();
            if (controller) controller.destroy();
            if (map) map.remove();
        };
    });

    $effect(() => {
        const data = rawData;
        if (ready && controller) controller.setData(data);
    });

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
            darkOpacity,
            locale
        };
        if (ready && controller) controller.update(state);
    });

    $effect(() => {
        if (!map) return;
        const mode = terrainMode;
        const opacity = darkOpacity;
        applyTerrainMode(mode, opacity);
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