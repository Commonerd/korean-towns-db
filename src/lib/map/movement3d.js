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
	}

	_rebuild() {
		this._clearGroup();

		if (!this.map || !this.routes.length) {
			return;
		}

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
			 * 1. 출발점을 이 route의 로컬 원점으로 설정
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
			 * 2. 도착점의 Mercator 좌표
			 * ----------------------------------------
			 */

			const destination =
				maplibregl.MercatorCoordinate.fromLngLat({
					lng: route.to.lng,
					lat: route.to.lat
				});

			/*
			 * ----------------------------------------
			 * 3. Mercator 기준 지상거리
			 * ----------------------------------------
			 */

			const dx = destination.x - origin.x;
			const dy = destination.y - origin.y;

			const groundDistance = Math.sqrt(
				dx * dx + dy * dy
			);

			/*
			 * ----------------------------------------
			 * 4. 해당 위도에서 실제 meter → Mercator 변환
			 * ----------------------------------------
			 */

			const metersPerMercator =
				origin.meterInMercatorCoordinateUnits();

			/*
			 * ----------------------------------------
			 * 5. 비행/이동 경로의 최대 고도
			 * ----------------------------------------
			 */

			const maxAltitude = Math.max(
				groundDistance * 0.03,
				metersPerMercator * 1200
			);

			/*
			 * ----------------------------------------
			 * 6. route 전용 Group
			 *
			 * 모든 점을 출발점 기준 local coordinate로 만든다.
			 * ----------------------------------------
			 */

			const routeGroup = new THREE.Group();

			routeGroup.position.copy(originVector);

			/*
			 * ----------------------------------------
			 * 7. 경로 점 생성
			 * ----------------------------------------
			 */

			const points = [];

			for (let i = 0; i <= 64; i++) {
				const t = i / 64;

				const location = sphericalPoint(
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

				/*
				 * 출발점 기준 상대 좌표
				 */

				const x = mercator.x - origin.x;
				const y = mercator.y - origin.y;

				/*
				 * 양 끝은 0,
				 * 가운데에서 최대 고도
				 */

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
			 * 8. 부드러운 곡선
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
			 * 9. 선 굵기
			 * ----------------------------------------
			 */

			const tubeRadius = Math.max(
				groundDistance * 0.001,
				metersPerMercator * 40
			);

			const tube =
				new THREE.TubeGeometry(
					curve,
					64,
					tubeRadius,
					8,
					false
				);

			/*
			 * ----------------------------------------
			 * 10. 선 material
			 * ----------------------------------------
			 */

			const material =
				new THREE.MeshBasicMaterial({
					color: 0x14532d,
					transparent: true,
					opacity: 0.95,

					/*
					 * 지도/지형에 묻히지 않도록
					 * 우선 false로 테스트
					 */
					depthTest: false,
					depthWrite: false
				});

			const tubeMesh =
				new THREE.Mesh(
					tube,
					material
				);

			routeGroup.add(tubeMesh);

			/*
			 * ----------------------------------------
			 * 11. 화살표
			 * ----------------------------------------
			 */

			const arrowT = 0.92;

			const arrowPoint =
				curve.getPointAt(arrowT);

			const tangent =
				curve
					.getTangentAt(arrowT)
					.normalize();

			const arrowHeight = Math.max(
				groundDistance * 0.015,
				metersPerMercator * 700
			);

			const arrowRadius = Math.max(
				groundDistance * 0.003,
				metersPerMercator * 180
			);

			const arrowGeometry =
				new THREE.ConeGeometry(
					arrowRadius,
					arrowHeight,
					8
				);

			const arrowMaterial =
				new THREE.MeshBasicMaterial({
					color: 0x14532d,
					transparent: true,
					opacity: 1,
					depthTest: false,
					depthWrite: false
				});

			const arrow =
				new THREE.Mesh(
					arrowGeometry,
					arrowMaterial
				);

			arrow.position.copy(
				arrowPoint
			);

			arrow.quaternion.setFromUnitVectors(
				new THREE.Vector3(0, 1, 0),
				tangent
			);

			routeGroup.add(arrow);

			/*
			 * ----------------------------------------
			 * 12. 이 route를 전체 scene에 추가
			 * ----------------------------------------
			 */

			this.group.add(routeGroup);
		}
	}

	render(gl, options) {
		if (
			!this.renderer ||
			!this.routes.length
		) {
			return;
		}

		/*
		 * MapLibre가 제공하는 projection matrix
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