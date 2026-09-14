import * as THREE from 'three';
import maplibregl from 'maplibre-gl';

function toRadians(value) {
	return (value * Math.PI) / 180;
}

function toDegrees(value) {
	return (value * 180) / Math.PI;
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
			(zoom - 8) * 0.35
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
					groundDistance * 0.02,
					metersPerMercator * 700
				);

			const maxAltitude =
				baseMaxAltitude *
				clampedAltitudeFactor;

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
					groundDistance * 0.0015,
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
							value: 0.95
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
						opacity: 1,
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
					groundDistance * 0.015,
					metersPerMercator * 700
				);

			const baseArrowRadius =
				Math.max(
					groundDistance * 0.003,
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