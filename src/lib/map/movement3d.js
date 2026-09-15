import * as THREE from 'three';
import maplibregl from 'maplibre-gl';

function toRadians(value) {
	return (value * Math.PI) / 180;
}

function toDegrees(value) {
	return (value * 180) / Math.PI;
}

/*
 * ----------------------------------------
 * 장거리 이동 보정용 거리 감쇠 함수
 *
 * 문제:
 * 고도/두께 계산이 실제 지구상 거리(groundDistance)에
 * '선형'으로 비례하기 때문에, 해외 이주처럼 수천 km
 * 떨어진 경로가 섞이면 아치 높이가 수십~수백 km까지
 * 치솟는다.
 *
 * 도시 단위로 확대한 화면에서는 이 거대한 아치의
 * 정점이 화면 밖으로 나가고, 출발/도착점 근처의
 * '거의 수직으로 솟는 구간'만 두껍게 보이게 되는데,
 * 여러 경로가 한 지점(허브 마을)에 몰리면 이 수직
 * 구간들이 방사형으로 늘어서서 마치 선이 여러 갈래로
 * 갈라진 것처럼 보인다.
 *
 * 해결:
 * DISTANCE_CAP 이하 거리는 기존과 동일하게 선형으로
 * 처리하되, 그 이상부터는 로그 함수로 증가폭을 눌러서
 * '얼마나 먼지'는 여전히 반영하면서도 초장거리 경로가
 * 화면을 지배하지 않도록 한다. (DISTANCE_CAP 지점에서
 * 값과 기울기가 모두 선형 구간과 매끄럽게 이어짐)
 * ----------------------------------------
 */

const DISTANCE_CAP = 0.015; // Mercator 단위, 적도 기준 약 600km

// DEM 타일 미로딩으로 고도 조회가 실패했을 때 재시도할 최대 횟수.
// 네트워크 장애 등으로 타일이 끝내 안 뜨는 경우 무한 재시도를 막기 위한 상한.
const MAX_ELEVATION_RETRIES = 4;

function dampDistance(distance) {
	if (distance <= DISTANCE_CAP) {
		return distance;
	}

	return DISTANCE_CAP * (1 + Math.log(distance / DISTANCE_CAP));
}

/*
 * ----------------------------------------
 * 이동선 양 끝 테이퍼링
 *
 * 문제:
 * 고도 곡선(sin(pi*t)^0.9)은 t=0, t=1 부근에서
 * 접선이 거의 수직에 가깝게 급격히 꺾인다.
 * 이 구간은 커브 상의 실제 이동 거리(수평)는
 * 짧은데 튜브 반지름은 동일하게 유지되기 때문에
 * 출발/도착 지점에 두꺼운 '뭉치'가 생긴 것처럼
 * 보인다.
 *
 * 해결:
 * 경로 양 끝 TAPER_FRACTION 구간에서 반지름을
 * TAPER_MIN_RATIO까지 매끄럽게 줄여, 끝으로
 * 갈수록 가늘어지는 창끝 모양으로 만든다.
 * ----------------------------------------
 */

const TAPER_FRACTION = 0.08;
const TAPER_MIN_RATIO = 0.05;

function smoothstep(edge0, edge1, x) {
	const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
	return t * t * (3 - 2 * t);
}

function taperFactor(u) {
	const fromStart = smoothstep(0, TAPER_FRACTION, u);
	const fromEnd = smoothstep(0, TAPER_FRACTION, 1 - u);
	const shape = Math.min(fromStart, fromEnd);

	return TAPER_MIN_RATIO + (1 - TAPER_MIN_RATIO) * shape;
}

function applyEndTaper(tubeGeometry, curve, tubularSegments, radialSegments) {
	const centers = curve.getSpacedPoints(tubularSegments);
	const positions = tubeGeometry.attributes.position;
	const verticesPerRing = radialSegments + 1;

	for (let i = 0; i <= tubularSegments; i++) {
		const factor = taperFactor(i / tubularSegments);
		const center = centers[i];

		for (let j = 0; j < verticesPerRing; j++) {
			const index = i * verticesPerRing + j;

			const x = positions.getX(index);
			const y = positions.getY(index);
			const z = positions.getZ(index);

			positions.setXYZ(
				index,
				center.x + (x - center.x) * factor,
				center.y + (y - center.y) * factor,
				center.z + (z - center.z) * factor
			);
		}
	}

	positions.needsUpdate = true;
}

function sphericalPoint(from, to, t) {
	const aLat = toRadians(from.lat);
	const aLng = toRadians(from.lng);
	const bLat = toRadians(to.lat);
	const bLng = toRadians(to.lng);

	const a = new THREE.Vector3(
		Math.cos(aLat) * Math.cos(aLng),
		Math.cos(aLat) * Math.sin(aLng),
		Math.sin(aLat)
	);

	const b = new THREE.Vector3(
		Math.cos(bLat) * Math.cos(bLng),
		Math.cos(bLat) * Math.sin(bLng),
		Math.sin(bLat)
	);

	const angle = Math.acos(
		Math.max(-1, Math.min(1, a.dot(b)))
	);

	const point = angle < 0.000001
		? a.clone().lerp(b, t)
		: a.clone()
			.multiplyScalar(
				Math.sin((1 - t) * angle) / Math.sin(angle)
			)
			.add(
				b.clone().multiplyScalar(
					Math.sin(t * angle) / Math.sin(angle)
				)
			);

	point.normalize();

	return {
		lat: toDegrees(Math.asin(point.z)),
		lng: toDegrees(Math.atan2(point.y, point.x))
	};
}

/*
 * ----------------------------------------
 * 지형(DEM) 고도 조회
 *
 * 문제:
 * 이 레이어는 경로 좌표를 map.setTerrain() 이 만드는 실제 지형
 * 메시가 아니라, Mercator 좌표계에 직접 점을 찍어서 그린다.
 * 지금까지는 그 점의 고도를 항상 0(해수면)으로 고정해 왔는데,
 * 3D 지형모드에서는 마을 마커(GPU 심볼/DOM 마커)가 지형 표면
 * (게다가 exaggeration 이 곱해진 표면) 위에 자동으로 얹히므로,
 * 해수면에 그려지는 이동선 끝점과 마을 노드 사이에 수직 차이가
 * 생긴다. pitch 가 있는 카메라에서는 이 수직 차이가 화면상
 * "옆으로 살짝 비껴난 것"처럼 보인다.
 *
 * 해결:
 * map.queryTerrainElevation() 으로 실제(과장 배율 포함) 지형
 * 고도를 미터 단위로 구해서 MercatorCoordinate 의 altitude 인자로
 * 그대로 넘긴다 — 마을 마커가 얹히는 것과 동일한 표면 높이다.
 *
 * 주의:
 * - 지형이 꺼져 있으면(map.getTerrain() 이 null) 언제나 null 이
 *   반환된다 — 평면모드에서는 정상 동작이므로 조용히 0으로 처리.
 * - 지형이 켜져 있어도 해당 좌표의 DEM 타일이 아직 로드되기 전이면
 *   일시적으로 null 이 반환된다 — 이 경우도 일단 0으로 폴백하되,
 *   호출부(_rebuild)가 "타일 로딩 중"이었음을 알 수 있도록
 *   결과에 표시해서 타일이 마저 로드된 뒤 다시 계산하게 한다.
 * ----------------------------------------
 */

function queryElevationMeters(map, lngLat) {
	if (!map || typeof map.queryTerrainElevation !== 'function') {
		return { elevation: 0, pending: false };
	}

	let raw = null;

	try {
		raw = map.queryTerrainElevation(lngLat);
	} catch (err) {
		raw = null;
	}

	if (typeof raw === 'number' && Number.isFinite(raw)) {
		return { elevation: raw, pending: false };
	}

	// null 이 지형 자체가 꺼져 있어서인지, 타일 로딩 중이어서인지 구분한다.
	// 지형이 켜져 있는데도 null 이면 "아직 못 구했다"는 뜻이므로 재시도 대상.
	const terrainActive = typeof map.getTerrain === 'function' && !!map.getTerrain();

	return { elevation: 0, pending: terrainActive };
}

export class Movement3DLayer {
	id = 'movement-3d-routes';
	type = 'custom';
	renderingMode = '3d';

	constructor() {
		this.map = null;
		this.renderer = null;

		this.camera = new THREE.Camera();
		this.scene = new THREE.Scene();

		this.group = new THREE.Group();
		this.scene.add(this.group);

		this.routes = [];

		this.dashMaterials = [];
		this.arrowObjects = [];

		/*
		 * 지형 DEM 고도 재조회 관련 상태.
		 * - _elevationRetryCount: 같은 route 세트에 대해 "타일이 아직
		 *   안 떴다"는 이유로 재시도한 횟수. 네트워크 문제 등으로 DEM 이
		 *   끝내 안 뜨는 경우까지 대비해 무한 재시도는 하지 않는다.
		 * - _elevationRetryScheduled: 'idle' 리스너가 이미 걸려 있는지
		 *   여부(중복 예약 방지).
		 */
		this._elevationRetryCount = 0;
		this._elevationRetryScheduled = false;
		this._onTerrainChange = null;
	}

	onAdd(map, gl) {
		this.map = map;

		this.renderer = new THREE.WebGLRenderer({
			canvas: map.getCanvas(),
			context: gl,
			antialias: true
		});

		this.renderer.autoClear = false;
		this.renderer.setPixelRatio(1);

		/*
		 * 평면 ↔ 3D 지형 전환(map.setTerrain 호출)은 zoomend 를 거치지
		 * 않을 수 있다(예: 지형 토글 버튼만 눌렀을 때). 그 경우에도
		 * 경로 고도를 지형 기준으로 다시 계산해야 하므로, MapLibre 가
		 * setTerrain 시점에 쏘는 'terrain' 이벤트를 직접 구독한다.
		 */
		this._onTerrainChange = () => {
			this._elevationRetryCount = 0;
			this._rebuild();
			this.map?.triggerRepaint();
		};
		this.map.on('terrain', this._onTerrainChange);

		this._rebuild();
	}

	onRemove() {
		this._clearGroup();

		if (this.map && this._onTerrainChange) {
			this.map.off('terrain', this._onTerrainChange);
		}
		this._onTerrainChange = null;

		this.renderer?.dispose();
		this.renderer = null;
		this.map = null;
	}

	setRoutes(routes = []) {
		this.routes = routes;

		// 경로 자체가 바뀌면 새 좌표 기준으로 재시도 횟수도 리셋한다.
		this._elevationRetryCount = 0;

		console.debug(
			'[movement3d] routes:',
			routes.length
		);

		this._rebuild();
		this.map?.triggerRepaint();
	}

	_clearGroup() {
		for (const child of [...this.group.children]) {
			child.traverse((object) => {
				if (object.geometry) {
					object.geometry.dispose();
				}

				if (Array.isArray(object.material)) {
					object.material.forEach((material) => {
						material.dispose();
					});
				} else if (object.material) {
					object.material.dispose();
				}
			});

			this.group.remove(child);
		}

		this.dashMaterials = [];
		this.arrowObjects = [];
	}

	_rebuild() {
		this._clearGroup();

		if (!this.map || !this.routes.length) {
			return;
		}

		const zoom = this.map.getZoom();

		/*
		 * ----------------------------------------
		 * 줌에 따른 전체 크기 보정
		 *
		 * 변화폭을 너무 크게 하지 않음
		 * ----------------------------------------
		 */

		const zoomFactor = Math.pow(
			2,
			(zoom - 8) * 0.5
		);

		/*
		 * ----------------------------------------
		 * 고도 보정
		 *
		 * 줌인 → 낮아짐
		 * 줌아웃 → 높아짐
		 *
		 * 이전보다 조금 더 강하게 적용
		 * ----------------------------------------
		 */

		const altitudeZoomFactor = Math.pow(
			2,
			(8 - zoom) * 0.50
		);

		const clampedAltitudeFactor =
			Math.max(
				0.2,
				Math.min(
					2.5,
					altitudeZoomFactor
				)
			);

		// DEM 타일이 아직 로드되기 전이라 고도 조회가 하나라도 실패했으면
		// true — 루프가 끝난 뒤 타일 로드를 기다렸다가 한 번 더 재계산한다.
		let elevationPending = false;

		for (const route of this.routes) {
			if (
				route.from?.lat == null ||
				route.from?.lng == null ||
				route.to?.lat == null ||
				route.to?.lng == null
			) {
				continue;
			}

			/*
			 * ----------------------------------------
			 * 0. 출발/도착 지점의 지형 고도(m)
			 *
			 * 3D 지형모드에서 마을 노드가 얹히는 것과 동일한 표면
			 * 높이를 구해서, 이동선의 양 끝을 그 높이에 맞춘다.
			 * 평면모드거나 타일 미로딩 시엔 0(해수면)으로 자연스럽게
			 * 폴백한다.
			 * ----------------------------------------
			 */

			const fromLngLat = {
				lng: route.from.lng,
				lat: route.from.lat
			};

			const toLngLat = {
				lng: route.to.lng,
				lat: route.to.lat
			};

			const fromElevationResult =
				queryElevationMeters(this.map, fromLngLat);

			const toElevationResult =
				queryElevationMeters(this.map, toLngLat);

			const fromElevation =
				fromElevationResult.elevation;

			const toElevation =
				toElevationResult.elevation;

			if (
				fromElevationResult.pending ||
				toElevationResult.pending
			) {
				elevationPending = true;
			}

			/*
			 * ----------------------------------------
			 * 1. 출발점
			 * ----------------------------------------
			 */

			const origin =
				maplibregl.MercatorCoordinate.fromLngLat(
					fromLngLat,
					fromElevation
				);

			const originVector = new THREE.Vector3(
				origin.x,
				origin.y,
				origin.z
			);

			/*
			 * ----------------------------------------
			 * 2. 도착점
			 * ----------------------------------------
			 */

			const destination =
				maplibregl.MercatorCoordinate.fromLngLat(
					toLngLat,
					toElevation
				);

			/*
			 * ----------------------------------------
			 * 3. 지상거리
			 * ----------------------------------------
			 */

			const dx =
				destination.x - origin.x;

			const dy =
				destination.y - origin.y;

			const groundDistance =
				Math.sqrt(
					dx * dx + dy * dy
				);

			/*
			 * 고도/두께/화살표 크기 계산에 사용할
			 * 감쇠된 거리값. 짧은 경로는 groundDistance와
			 * 동일하고, 장거리 경로만 증가폭이 눌린다.
			 */
			const scaledDistance =
				dampDistance(groundDistance);

			/*
			 * ----------------------------------------
			 * 4. Mercator 단위
			 * ----------------------------------------
			 */

			const metersPerMercator =
				origin.meterInMercatorCoordinateUnits();

			/*
			 * ----------------------------------------
			 * 5. 최대 고도
			 * ----------------------------------------
			 */

			const baseMaxAltitude =
				Math.max(
					scaledDistance * 0.02,
					metersPerMercator * 700
				);

			const maxAltitude =
					baseMaxAltitude *
					clampedAltitudeFactor *
					1.5;

			/*
			 * ----------------------------------------
			 * 6. Route Group
			 * ----------------------------------------
			 */

			const routeGroup =
				new THREE.Group();

			routeGroup.position.copy(
				originVector
			);

			/*
			 * ----------------------------------------
			 * 7. 경로 생성
			 * ----------------------------------------
			 */

			const points = [];

			for (let i = 0; i <= 64; i++) {
				const t = i / 64;

				const location =
					sphericalPoint(
						route.from,
						route.to,
						t
					);

				/*
				 * 지형을 따라가는 기준선: 출발/도착 지형 고도를
				 * t 에 따라 선형보간한다. t=0 에서 fromElevation,
				 * t=1 에서 toElevation 이 되어 각각 origin/destination
				 * 표면 높이와 정확히 맞물린다.
				 */
				const baseElevation =
					fromElevation +
					(toElevation - fromElevation) * t;

				const mercator =
					maplibregl.MercatorCoordinate.fromLngLat(
						{
							lng: location.lng,
							lat: location.lat
						},
						baseElevation
					);

				const x =
					mercator.x -
					origin.x;

				const y =
					mercator.y -
					origin.y;

				const altitude =
					Math.pow(
						Math.sin(Math.PI * t),
						0.9
					) * maxAltitude;

				const z =
					mercator.z -
					origin.z +
					altitude;

				points.push(
					new THREE.Vector3(
						x,
						y,
						z
					)
				);
			}

			/*
			 * ----------------------------------------
			 * 8. 곡선
			 * ----------------------------------------
			 */

			const curve =
				new THREE.CatmullRomCurve3(
					points,
					false,
					'centripetal'
				);

			/*
			 * ----------------------------------------
			 * 9. 이동선 두께
			 * ----------------------------------------
			 */

			const baseTubeRadius =
				Math.max(
					scaledDistance * 0.0007,
					metersPerMercator * 60
				);

			const tubeRadius =
				baseTubeRadius /
				zoomFactor;

			const tube =
				new THREE.TubeGeometry(
					curve,
					128,
					tubeRadius,
					8,
					false
				);

			/*
			 * ----------------------------------------
			 * 9-1. 시작/끝 두께 테이퍼링
			 *
			 * 이륙/착륙 구간은 고도 변화가 급격해서
			 * (구간 길이는 짧은데 반지름은 그대로라)
			 * 끝부분이 두꺼운 '뭉치'처럼 보인다.
			 *
			 * 경로 양 끝 TAPER_FRACTION 구간에서
			 * 반지름을 점점 줄여, 끝으로 갈수록
			 * 가늘어지는 형태로 보정한다.
			 * ----------------------------------------
			 */

			applyEndTaper(tube, curve, 128, 8);

			/*
			 * ----------------------------------------
			 * 10. 움직이는 점선
			 * ----------------------------------------
			 */

			const dashCount = Math.max(
				10,
				Math.min(
					50,
					groundDistance * 50000
				)
			);

			const dashMaterial =
				new THREE.ShaderMaterial({
					transparent: true,
					depthTest: false,
					depthWrite: false,

					uniforms: {
						uTime: {
							value: 0
						},

						uDashCount: {
							value: dashCount
						},

						uDashSize: {
							value: 0.55
						},

						uOpacity: {
							value: 0.85
						},

						uColor: {
							value: new THREE.Color(
								0x14532d
							)
						}
					},

					vertexShader: `
						varying float vTubePosition;

						void main() {
							vTubePosition = uv.x;

							gl_Position =
								projectionMatrix *
								modelViewMatrix *
								vec4(
									position,
									1.0
								);
						}
					`,

					fragmentShader: `
						uniform float uTime;
						uniform float uDashCount;
						uniform float uDashSize;
						uniform float uOpacity;
						uniform vec3 uColor;

						varying float vTubePosition;

						void main() {
							float position =
								vTubePosition *
								uDashCount;

							float movingPosition =
								position -
								uTime;

							float dash =
								mod(
									movingPosition,
									1.0
								);

							float edge = 0.04;

							float smoothAlpha =
								smoothstep(
									0.0,
									edge,
									dash
								) *
								(
									1.0 -
									smoothstep(
										uDashSize - edge,
										uDashSize,
										dash
									)
								);

							gl_FragColor =
								vec4(
									uColor,
									smoothAlpha *
									uOpacity
								);
						}
					`
				});

			this.dashMaterials.push(
				dashMaterial
			);

			const tubeMesh =
				new THREE.Mesh(
					tube,
					dashMaterial
				);

			routeGroup.add(
				tubeMesh
			);

			/*
			 * ----------------------------------------
			 * 11. 화살표
			 * ----------------------------------------
			 *
			 * 화살표 자체도 render()에서
			 * 경로를 따라 이동시킨다.
			 */

			const arrow =
				new THREE.Mesh(
					new THREE.ConeGeometry(
						1,
						1,
						8
					),
					new THREE.MeshBasicMaterial({
						color: 0x14532d,
						transparent: true,
						opacity: 0.9,
						depthTest: false,
						depthWrite: false
					})
				);

			/*
			 * 기본 크기는 일단 1로 만들고
			 * 아래에서 실제 크기를 적용
			 */

			const baseArrowHeight =
				Math.max(
					scaledDistance * 0.015,
					metersPerMercator * 700
				);

			const baseArrowRadius =
				Math.max(
					scaledDistance * 0.003,
					metersPerMercator * 180
				);

			const arrowZoomFactor = Math.pow(
				2,
				(zoom - 8) * 0.28
			);

			const arrowHeight =
				baseArrowHeight /
				arrowZoomFactor;

			const arrowRadius =
				baseArrowRadius /
				arrowZoomFactor;

			arrow.geometry.dispose();

			arrow.geometry =
				new THREE.ConeGeometry(
					arrowRadius,
					arrowHeight,
					8
				);

			/*
			 * 화살표 애니메이션에 필요한 정보 저장
			 */

			this.arrowObjects.push({
				arrow,
				curve,
				speed: 0.3 + Math.random() * 0.1,
				offset: Math.random(),
				minT: 0.72,
				maxT: 0.96
			});

			routeGroup.add(
				arrow
			);

			/*
			 * ----------------------------------------
			 * 12. Scene에 추가
			 * ----------------------------------------
			 */

			this.group.add(
				routeGroup
			);
		}

		/*
		 * 지형이 켜져 있는데 일부 지점의 DEM 타일이 아직 없어서
		 * 고도를 0으로 폴백한 경우, 타일이 다 뜬 뒤('idle') 한 번 더
		 * 재계산해서 노드 위치와 어긋난 상태가 오래 남지 않게 한다.
		 * 이미 예약돼 있으면 중복 예약하지 않고, 재시도 상한을 넘으면
		 * (예: 타일 요청이 계속 실패) 더 이상 걸지 않는다.
		 */
		if (
			elevationPending &&
			this.map &&
			!this._elevationRetryScheduled &&
			this._elevationRetryCount < MAX_ELEVATION_RETRIES
		) {
			this._elevationRetryScheduled = true;
			this._elevationRetryCount += 1;

			this.map.once('idle', () => {
				this._elevationRetryScheduled = false;
				this._rebuild();
				this.map?.triggerRepaint();
			});
		}
	}

	render(gl, options) {
		if (
			!this.renderer ||
			!this.routes.length
		) {
			return;
		}

		const time =
			performance.now() * 0.001;

		/*
		 * ----------------------------------------
		 * 1. 점선 이동
		 * ----------------------------------------
		 */

		for (const material of this.dashMaterials) {
			if (material.uniforms?.uTime) {
				material.uniforms.uTime.value =
					time * 0.8;
			}
		}

		/*
		 * ----------------------------------------
		 * 2. 화살표 이동
		 *
		 * 경로의 72% → 96% 구간을
		 * 반복해서 이동
		 * ----------------------------------------
		 */

		for (const item of this.arrowObjects) {
			const range =
				item.maxT -
				item.minT;

			const phase =
				(time * item.speed +
					item.offset) %
				1;

			const t =
				item.minT +
				phase * range;

			const point =
				item.curve.getPointAt(t);

			const tangent =
				item.curve
					.getTangentAt(t)
					.normalize();

			item.arrow.position.copy(
				point
			);

			item.arrow.quaternion.setFromUnitVectors(
				new THREE.Vector3(
					0,
					1,
					0
				),
				tangent
			);
		}

		/*
		 * ----------------------------------------
		 * 3. MapLibre projection
		 * ----------------------------------------
		 */

		const matrix =
			new THREE.Matrix4().fromArray(
				options
					.defaultProjectionData
					.mainMatrix
			);

		this.camera.projectionMatrix.copy(
			matrix
		);

		this.camera.matrixWorld.identity();
		this.camera.matrixWorldInverse.identity();

		this.renderer.resetState();

		this.renderer.render(
			this.scene,
			this.camera
		);

		this.map.triggerRepaint();
	}
}