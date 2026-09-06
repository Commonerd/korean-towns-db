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
        baseLayer = 'map',
        showGeoLabels = true,
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
    let applyBaseLayer = (layer = baseLayer, labels = showGeoLabels, opacity = darkOpacity) => {};

    /* 줌아웃할수록(카메라가 멀어질수록) 같은 고도차가 화면에서 차지하는 비중이
       자연히 작아진다(비행기에서 산이 평평해 보이는 것과 같은 원리). terrain.exaggeration
       은 스타일 스펙상 숫자만 받고 줌 표현식을 못 쓰므로, 줌 레벨에 맞춰 직접 배율을
       계산해 매번 setTerrain 을 다시 호출한다. ZOOM_FAR 이하에서는 과장 배율을 크게,
       ZOOM_NEAR 이상에서는 기존 기본값(2.5)로 선형 보간한다.

       ⚠️ Terrarium DEM 은 해저 지형(수심)도 같이 담고 있어서 배율을 너무 키우면 대양
       한복판까지 울퉁불퉁하게 도드라진다. 그래서 상한을 6.0 이 아니라 4.0 으로 두고,
       해수면 이하는 아래 setupTerrainSource 의 color-relief 레이어로 따로 덮는다. */
    const ZOOM_FAR = 4;
    const ZOOM_NEAR = 11;
    const EXAGGERATION_FAR = 4.0;
    const EXAGGERATION_NEAR = 2.5;
    function terrainExaggerationForZoom(zoom) {
        const t = Math.max(0, Math.min(1, (zoom - ZOOM_FAR) / (ZOOM_NEAR - ZOOM_FAR)));
        return EXAGGERATION_FAR + (EXAGGERATION_NEAR - EXAGGERATION_FAR) * t;
    }
    /* hillshade-exaggeration 는 줌 표현식을 지원하므로, 다크모드 슬라이더가 만든
       기준값(baseline)을 양 끝값으로 삼아 interpolate 식을 만든다 — 줌 리스너 없이도
       GPU 쪽에서 알아서 보간된다.
       ⚠️ 스펙상 0~1 이 상한이다(넘으면 setPaintProperty 가 예외를 던지고 조용히 무시되어,
          실제로는 아예 적용이 안 된 채로 지나간다) — 두 값 다 반드시 clamp 한다. */
    function hillshadeExaggerationExpression(baseline) {
        const b = Math.max(0, Math.min(1, baseline));
        const boosted = Math.min(1, b * 1.8);
        return ['interpolate', ['linear'], ['zoom'], ZOOM_FAR, boosted, ZOOM_NEAR, b];
    }


    export function focus(item) {
        controller?.focus(item);
    }

    export function setTerrainMode(mode = terrainMode, opacity = darkOpacity) {
        applyTerrainMode(mode, opacity);
    }

    export function setBaseLayer(layer = baseLayer, labels = showGeoLabels, opacity = darkOpacity) {
        applyBaseLayer(layer, labels, opacity);
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
                            /* 스펙상 0~1 이 상한이라(초과 시 addLayer 자체가 예외를 던진다),
                               1 을 넘지 않는 기본값으로 시작한다 — 실제 배율은 applyTerrainMode 가
                               곧바로 이어서 setPaintProperty 로 덮어쓴다. */
                            'hillshade-exaggeration': 0.5,
                            'hillshade-shadow-color': '#000000',
                            'hillshade-highlight-color': '#ffffff'
                        }
                    });
                }
                /* Terrarium DEM 은 해저 지형(수심)도 담고 있어 배율을 키우면 대양까지
                   울퉁불퉁해진다. 해수면(고도 0) 이하를 불투명 단색으로 덮어 가린다.
                   ⚠️ color-relief-color 는 생성 시 한 번만 넣는다 — 이후 setPaintProperty 로
                   값을 바꾸면 MapLibre 내부에서 예외가 난다(별도로 확인된 라이브러리 버그). */
                if (!map.getLayer('color-relief')) {
                    // beforeId 없이 addLayer → 맨 위에 쌓여 hills 보다 위(= hills 를 가림)
                    map.addLayer({
                        id: 'color-relief',
                        type: 'color-relief',
                        source: 'free-dem',
                        paint: {
                            'color-relief-color': [
                                'interpolate',
                                ['linear'],
                                ['elevation'],
                                -50,
                                'rgba(120, 140, 160, 1)',
                                0,
                                'rgba(120, 140, 160, 0)'
                            ]
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
                        }
                        if (map.getLayer('color-relief')) {
                            map.setLayoutProperty('color-relief', 'visibility', 'none');
                        }
                        map.setPitch(0);
                        map.setBearing(0);
                        return;
                    }

                    map.setTerrain({
                        source: 'free-dem',
                        exaggeration: terrainExaggerationForZoom(map.getZoom())
                    });
                    if (map.getLayer('hills')) {
                        map.setLayoutProperty('hills', 'visibility', 'visible');
                        // 스펙 상한 1 을 넘지 않는 범위(0.3~0.8)에서 다크모드 슬라이더로 조절한다.
                        const baseline = 0.3 + 0.5 * Math.max(0, Math.min(1, opacity));
                        map.setPaintProperty(
                            'hills',
                            'hillshade-exaggeration',
                            hillshadeExaggerationExpression(baseline)
                        );
                    }
                    if (map.getLayer('color-relief')) {
                        map.setLayoutProperty('color-relief', 'visibility', 'visible');
                    }
                    map.setPitch(50);
                    map.setBearing(0);
                } catch (err) {
                    console.warn('DEM terrain setup failed:', err);
                }
            };

            /* 베이스 지도 4종(라이트/다크 × 라벨유무) + 위성, 전부 이 함수 하나가 종합해서
               raster-opacity 를 낸다. controller.js 는 더 이상 osm-light/carto-dark 를
               건드리지 않는다 — 라벨유무 두 쌍을 서로 반투명으로 겹치면 글자가 이중으로
               비쳐 보이므로, "누가 어느 쌍을 켜는지"를 한 곳에서만 결정해야 한다.
               위성 모드에서는 넷 다 끄고 satellite 하나만 켠다. */
            applyBaseLayer = (layer = baseLayer, labels = showGeoLabels, opacity = darkOpacity) => {
                if (!map || disposed || !map.getLayer('satellite')) return;
                try {
                    const satellite = layer === 'satellite';
                    const o = Math.max(0, Math.min(1, opacity));

                    map.setPaintProperty('satellite', 'raster-opacity', satellite ? 1 : 0);
                    if (map.getLayer('osm-labels')) {
                        map.setLayoutProperty(
                            'osm-labels',
                            'visibility',
                            satellite && labels ? 'visible' : 'none'
                        );
                    }

                    map.setPaintProperty('osm-light', 'raster-opacity', !satellite && labels ? 1 - o : 0);
                    map.setPaintProperty('carto-dark', 'raster-opacity', !satellite && labels ? o : 0);
                    map.setPaintProperty(
                        'light-nolabels',
                        'raster-opacity',
                        !satellite && !labels ? 1 - o : 0
                    );
                    map.setPaintProperty('dark-nolabels', 'raster-opacity', !satellite && !labels ? o : 0);
                } catch (err) {
                    console.warn('base layer switch failed:', err);
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

            // terrain.exaggeration 은 표현식을 못 받는 고정 숫자라, 줌이 끝날 때마다
            // 새 줌 레벨 기준으로 다시 계산해 넣는다('flat' 모드에서는 지형 자체가 꺼져 있으므로 스킵).
            map.on('zoomend', () => {
                if (disposed || !map || terrainMode === 'flat') return;
                if (!map.getTerrain()) return;
                map.setTerrain({
                    source: 'free-dem',
                    exaggeration: terrainExaggerationForZoom(map.getZoom())
                });
            });

            // 스타일이 완전히 세팅되거나 로드되었을 때 Terrain 설정 실행
            map.on('style.load', () => {
                applyTerrainMode(terrainMode, darkOpacity);
                applyBaseLayer(baseLayer, showGeoLabels, darkOpacity);
            });

            let inited = false;
            const initController = () => {
                if (inited || disposed || !map || !map.getLayer('osm-light')) return;
                inited = true;

                // 컨트롤러 초기화 전 지형/베이스레이어 설정 한번 더 체크
                applyTerrainMode(terrainMode, darkOpacity);
                applyBaseLayer(baseLayer, showGeoLabels, darkOpacity);

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
            locale
        };
        if (ready && controller) controller.update(state);
    });

    /* ⚠️ map 은 일반 let 변수(반응형 아님)라서, 이걸로 게이트하면 컴포넌트가 처음
       마운트될 때(아직 map 이 null인 시점) 조기 return 하면서 이 실행에서 읽은 반응형
       값이 하나도 없어 Svelte 가 의존성을 추적 못 하고, 그 뒤로 영원히 재실행이 안 된다
       (다크모드 슬라이더를 움직여도 지형·베이스레이어가 갱신되지 않던 버그의 원인).
       ready 는 $state 라 이 값으로 게이트해야 나중에 true 로 바뀔 때 정상적으로
       재실행되고, 그 실행에서 비로소 terrainMode/darkOpacity 등을 의존성으로 잡는다. */
    $effect(() => {
        if (!ready) return;
        const mode = terrainMode;
        const opacity = darkOpacity;
        applyTerrainMode(mode, opacity);
    });

    $effect(() => {
        if (!ready) return;
        applyBaseLayer(baseLayer, showGeoLabels, darkOpacity);
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
