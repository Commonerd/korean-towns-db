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

		this._rebuild();
	}

	onRemove() {
		this._clearGroup();

		this.renderer?.dispose();
		this.renderer = null;
		this.map = null;
	}

	setRoutes(routes = []) {
		this.routes = routes;

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
			 * 1. 출발점
			 * ----------------------------------------
			 */

			const origin =
				maplibregl.MercatorCoordinate.fromLngLat({
					lng: route.from.lng,
					lat: route.from.lat
				});

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
				maplibregl.MercatorCoordinate.fromLngLat({
					lng: route.to.lng,
					lat: route.to.lat
				});

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

				const mercator =
					maplibregl.MercatorCoordinate.fromLngLat(
						{
							lng: location.lng,
							lat: location.lat
						},
						0
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