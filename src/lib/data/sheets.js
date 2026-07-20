import { spreadsheetId } from '$lib/config.js';
import { csvToArray, buildHeaderMap, getCol } from './csv.js';
import { normalizePrecision, getCertaintyScore } from './precision.js';

/* ====== DB 데이터 로드 (기존 loadGoogleSheetsData 이식) ====== */
export async function loadGoogleSheetsData() {
	if (!spreadsheetId) return [];

	const baseUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`;
	const targets = [
		{ type: '마을', gid: '0' },
		{ type: '조직', gid: '1633831664' },
		{ type: '인물', gid: '997795861' }
	];

	let globalId = 1;
	const updatedData = [];
	const townCoords = {};

	/* 1단계: 마을 먼저 */
	try {
		const townTarget = targets.find((t) => t.type === '마을');
		const response = await fetch(`${baseUrl}&gid=${townTarget.gid}`);
		if (response.ok) {
			const records = csvToArray(await response.text());
			if (records.length > 0) {
				const headerMap = buildHeaderMap(records[0]);
				for (let i = 1; i < records.length; i++) {
					const row = records[i];
					const name = getCol(row, headerMap, 'name', 'village_name', '이름');
					if (!name) continue;

					const lat = parseFloat(getCol(row, headerMap, 'lat', 'latitude', '위도')) || 0;
					const lng =
						parseFloat(getCol(row, headerMap, 'lng', 'lon', 'longitude', '경도')) || 0;
					if (lat && lng) townCoords[name] = { lat, lng };

					let desc = getCol(row, headerMap, 'description', 'desc', '설명');
					const population = getCol(row, headerMap, 'population', '인구');
					if (population) desc = `[인구: ${population}] ` + desc;

					// location_precision 필드 하나로 '빌리지/타운 규모 구분'과 '위치 확실성'을 함께 처리한다.
					// (수백 명 단위의 소규모 정착지는 'village'로 관리)
					const rawPrecision = getCol(
						row,
						headerMap,
						'location_precision',
						'precision',
						'위치_정확도',
						'정확도'
					);
					const precision = normalizePrecision(rawPrecision, 'town');

					// 레거시 호환: 예전 방식(별도 규모/분류 열)으로 입력된 시트가 아직 남아있는 경우를 대비
					const legacyType = getCol(
						row,
						headerMap,
						'settlement_type',
						'규모',
						'타운/빌리지',
						'분류'
					).toLowerCase();
					const isVillage =
						precision === 'village' ||
						(precision !== 'town' && (legacyType.includes('빌리지') || legacyType === 'village'));

					const address = getCol(row, headerMap, 'address', '어드레스', '주소', '주소지');

					updatedData.push({
						id: globalId++,
						type: '마을',
						settlementType: isVillage ? '빌리지' : '타운',
						name,
						description: desc,
						founded: getCol(row, headerMap, 'start_year', 'founded', '설립'),
						dissolved: getCol(row, headerMap, 'end_year', 'dissolved', '소멸'),
						lat,
						lng,
						address,
						source: getCol(row, headerMap, 'source', '출처'),
						author: getCol(row, headerMap, 'creator', 'author', '작성자'),
						relatedTown: '',
						relatedOrg: '',
						locationPrecision: precision,
						certaintyScore: getCertaintyScore(precision)
					});
				}
			}
		}
	} catch (e) {
		console.error('마을 파싱 실패', e);
	}

	/* 2단계: 조직 & 인물 */
	for (const target of targets) {
		if (target.type === '마을') continue;
		try {
			const response = await fetch(`${baseUrl}&gid=${target.gid}`);
			if (!response.ok) continue;
			const records = csvToArray(await response.text());
			if (records.length === 0) continue;
			const headerMap = buildHeaderMap(records[0]);

			for (let i = 1; i < records.length; i++) {
				const row = records[i];
				const name = getCol(row, headerMap, 'name', '이름');
				if (!name) continue;

				const rawPrecision = getCol(
					row,
					headerMap,
					'location_precision',
					'precision',
					'위치_정확도',
					'정확도'
				);
				const precision = normalizePrecision(rawPrecision, 'unknown');
				const relatedTown = getCol(row, headerMap, 'related_town', '소속마을');
				const ownLat = parseFloat(getCol(row, headerMap, 'lat', 'latitude', '위도')) || 0;
				const ownLng = parseFloat(getCol(row, headerMap, 'lng', 'lon', 'longitude', '경도')) || 0;

				const isPrecise = precision === 'exact' || precision === 'street';

				/* 정확위치: 자체 lat/lng가 있으면 사용, 없으면 마을 좌표 fallback */
				let lat = 0,
					lng = 0;
				if (isPrecise && ownLat && ownLng) {
					lat = ownLat;
					lng = ownLng;
				} else if (townCoords[relatedTown]) {
					lat = townCoords[relatedTown].lat;
					lng = townCoords[relatedTown].lng;
				} else if (ownLat && ownLng) {
					lat = ownLat;
					lng = ownLng;
				}

				// 어드레스(조직/인물 시트 신설 필드) — 좌표 비정이 안 되어도 텍스트로 보존
				const address = getCol(row, headerMap, 'address', '어드레스', '주소', '주소지');

				const item = {
					id: globalId++,
					type: target.type,
					name,
					description: getCol(row, headerMap, 'description', 'desc', '설명'),
					founded: getCol(row, headerMap, 'start_year', '설립'),
					dissolved: getCol(row, headerMap, 'end_year', '소멸'),
					lat,
					lng,
					relatedTown,
					relatedOrg: '',
					source: getCol(row, headerMap, 'source', '출처'),
					author: getCol(row, headerMap, 'creator', 'author', '작성자'),
					locationPrecision: precision,
					isPrecise,
					address,
					certaintyScore: getCertaintyScore(precision)
				};

				if (target.type === '조직') {
					item.orgType = getCol(row, headerMap, 'type', 'organization_type', '유형');
				} else if (target.type === '인물') {
					item.relatedOrg = getCol(
						row,
						headerMap,
						'related_organization',
						'related_org',
						'소속조직'
					);
					item.nationality = getCol(row, headerMap, 'nationality', '국적');
					item.job = getCol(row, headerMap, 'job', 'occupation', '직업');
				}
				updatedData.push(item);
			}
		} catch (error) {
			console.error(`${target.type} 파싱 실패`, error);
		}
	}

	return updatedData;
}

/* 데이터에서 연도 범위 자동 감지 */
export function detectYearRange(rawData) {
	const years = rawData
		.flatMap((d) => [parseInt(d.founded), parseInt(d.dissolved)])
		.filter((y) => y && y > 1000 && y < 2100);
	if (years.length === 0) return null;
	return { min: Math.min(...years), max: Math.max(...years) };
}
