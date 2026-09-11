import { spreadsheetId } from '$lib/config.js';
import { csvToArray, buildHeaderMap, getCol } from './csv.js';
import { normalizePrecision, getCertaintyScore } from './precision.js';

/* ⚠️ events(사건) 시트의 gid 로 교체하세요.
   구글시트에서 events 탭을 연 뒤 주소창의 `...#gid=숫자` 값을 그대로 넣으면 됩니다.
   (0 인 상태로 두면 마을 시트와 겹치므로 반드시 실제 gid 로 바꿔야 사건이 로드됩니다.) */
const EVENTS_GID = 'REPLACE_WITH_EVENTS_GID';

/* 시트의 name_ko/name_en/... , description_ko/... 다국어 칼럼을 한 객체로 모은다.

   ⚠️ 여기서 모은 값은 "표시용"이다. 노드의 `name`(한국어)은 절대 바꾸지 않는다 —
	slug 생성은 표시 이름을 사용하지만, 관계망과 마을-자식 관계는 고유 ID를 사용한다.

   시트에 해당 언어 칼럼이 비어 있으면 한국어 원문으로 폴백한다
   (towns 의 name_ko 는 실제로 절반 정도만 채워져 있어 폴백이 필수). */
export const DATA_LOCALES = ['ko', 'en', 'ja', 'ru', 'zh'];

function splitIds(raw) {
	return String(raw || '')
		.split(',')
		.map((value) => value.trim())
		.filter(Boolean);
}

function firstId(row, headerMap, ...aliases) {
	return getCol(row, headerMap, ...aliases);
}

function collectI18n(row, headerMap, base, fallback) {
	const out = {};
	for (const loc of DATA_LOCALES) {
		out[loc] = getCol(row, headerMap, `${base}_${loc}`) || fallback;
	}
	// 한국어는 번역 칼럼보다 원문을 우선한다 (원문이 늘 정본).
	out.ko = fallback || out.ko;
	return out;
}

/* URL slug 생성 (name 기반, 타입별로 중복 시 -2, -3 ... 접미사) */
function makeSlugger() {
	const counts = new Map();
	return function slugify(type, name) {
		const base =
			name
				.trim()
				.toLowerCase()
				.replace(/[^\w가-힣\s-]/g, '')
				.replace(/\s+/g, '-') || 'unnamed';
		const key = `${type}:${base}`;
		const n = (counts.get(key) ?? 0) + 1;
		counts.set(key, n);
		return n === 1 ? base : `${base}-${n}`;
	};
}

/* ====== DB 데이터 로드 (기존 loadGoogleSheetsData 이식) ====== */
export async function loadGoogleSheetsData() {
	if (!spreadsheetId) return [];

	const baseUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`;
	const targets = [
		{ type: '마을', gid: '0' },
		{ type: '조직', gid: '1633831664' },
		{ type: '인물', gid: '997795861' },
		{ type: '사건', gid: '1560552606' }
	];

	let globalId = 1;
	const updatedData = [];
	const townsById = new Map();
	const townCoords = new Map();
	const slugify = makeSlugger();

	/* 1단계: 마을 먼저.

	   ⚠️ 마을 시트는 이 데이터셋의 뼈대다 — 조직·인물·사건의 좌표가 townCoords 에서
	      나오므로, 마을을 못 읽으면 나머지도 사실상 무의미해진다. 예전에는 여기서
	      실패를 로그만 찍고 넘어가 "거의 빈 배열"을 정상 결과처럼 돌려줬는데, 호출부가
	      그걸 그대로 대입해 프리렌더로 갖고 있던 정상 데이터를 지워버렸다(지도에 아무것도
	      안 뜨고 «위치 보기» 도 먹지 않음). 그래서 이제는 조용히 넘기지 않고 throw 한다 —
	      호출부가 "실패"를 구분해 기존 데이터를 지킬 수 있어야 한다. */
	try {
		const townTarget = targets.find((t) => t.type === '마을');
		const response = await fetch(`${baseUrl}&gid=${townTarget.gid}`);
		if (!response.ok) {
			throw new Error(`마을 시트 응답 오류 (HTTP ${response.status})`);
		}
		if (response.ok) {
			const records = csvToArray(await response.text());
			if (records.length > 0) {
				const headerMap = buildHeaderMap(records[0]);
				for (let i = 1; i < records.length; i++) {
					const row = records[i];
					const townId = firstId(row, headerMap, 'town_id', 'townid', '마을_id', '마을id');
					const name = getCol(row, headerMap, 'name', 'village_name', '이름');
					if (!name || !townId) continue;

					const lat = parseFloat(getCol(row, headerMap, 'lat', 'latitude', '위도')) || 0;
					const lng =
						parseFloat(getCol(row, headerMap, 'lng', 'lon', 'longitude', '경도')) || 0;
					if (lat && lng) townCoords.set(townId, { lat, lng });

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
						townId,
						externalId: townId,
						slug: slugify('마을', name),
						type: '마을',
						settlementType: isVillage ? '빌리지' : '타운',
						name,
						nameI18n: collectI18n(row, headerMap, 'name', name),
						description: desc,
						descriptionI18n: collectI18n(row, headerMap, 'description', desc),
						founded: getCol(row, headerMap, 'start_year', 'founded', '설립'),
						dissolved: getCol(row, headerMap, 'end_year', 'dissolved', '소멸'),
						lat,
						lng,
						address,
						source: getCol(row, headerMap, 'source', '출처'),
						author: getCol(row, headerMap, 'creator', 'author', '작성자'),
						updater: getCol(row, headerMap, 'updater', 'updator', '수정자'),
						changeNote: getCol(row, headerMap, 'update_note', 'change_note', '수정내용'),
						relatedTown: '',
						relatedOrg: '',
						locationPrecision: precision,
						locationBasis: getCol(row, headerMap, 'location_basis', '위치_근거', '위치근거'),
						certaintyScore: getCertaintyScore(precision)
					});
					townsById.set(townId, updatedData[updatedData.length - 1]);
				}
			}
		}
	} catch (e) {
		console.error('마을 파싱 실패', e);
		throw e instanceof Error ? e : new Error(String(e));
	}

	/* 마을을 한 건도 못 읽었으면(응답은 200이었지만 내용이 비었거나 형식이 바뀐 경우)
	   역시 실패로 다룬다 — 빈 결과를 정상처럼 돌려주면 안 된다. */
	if (!updatedData.length) {
		throw new Error('마을 시트에서 노드를 한 건도 읽지 못했습니다.');
	}

	/* 2단계: 조직 & 인물 & 사건 */
	for (const target of targets) {
		if (target.type === '마을') continue;
		// events gid 미설정 시 건너뜀 (마을 시트와 겹치는 것 방지)
		if (target.type === '사건' && (!target.gid || target.gid === 'REPLACE_WITH_EVENTS_GID')) continue;
		try {
			const response = await fetch(`${baseUrl}&gid=${target.gid}`);
			if (!response.ok) continue;
			const records = csvToArray(await response.text());
			if (records.length === 0) continue;
			const headerMap = buildHeaderMap(records[0]);

			for (let i = 1; i < records.length; i++) {
				const row = records[i];
				const name = getCol(row, headerMap, 'name', '이름');
				const externalId = target.type === '조직'
					? firstId(row, headerMap, 'org_id', 'orgid', '조직_id', '조직id')
					: target.type === '인물'
						? firstId(row, headerMap, 'prs_id', 'prs_is', 'prsid', 'prsis', '인물_id', '인물id')
						: firstId(row, headerMap, 'evt_id', 'evtid', '사건_id', '사건id');
				if (!name || !externalId) continue;

				const rawPrecision = getCol(
					row,
					headerMap,
					'location_precision',
					'precision',
					'위치_정확도',
					'정확도'
				);
				const precision = normalizePrecision(rawPrecision, 'unknown');
				// 사건은 여러 마을이 쉼표로 들어올 수 있음 → 좌표 비정·부유 위치는 첫 마을 기준,
				// 전체 목록은 relatedTownAll 로 보존
				const relatedTownIds = splitIds(
					getCol(row, headerMap, 'related_town_id', 'related_town_ids', '소속마을_id', '관련마을_id')
				);
				const relatedTowns = relatedTownIds.map((id) => townsById.get(id)).filter(Boolean);
				const relatedTown = relatedTowns[0]?.name || '';
				const relatedTownAll = relatedTowns.map((town) => town.name).join(', ');
				const ownLat = parseFloat(getCol(row, headerMap, 'lat', 'latitude', '위도')) || 0;
				const ownLng = parseFloat(getCol(row, headerMap, 'lng', 'lon', 'longitude', '경도')) || 0;

				const isPrecise = precision === 'exact' || precision === 'street';

				/* 정확위치: 자체 lat/lng가 있으면 사용, 없으면 마을 좌표 fallback */
				let lat = 0,
					lng = 0;
				if (isPrecise && ownLat && ownLng) {
					lat = ownLat;
					lng = ownLng;
				} else if (townCoords.has(relatedTownIds[0])) {
					lat = townCoords.get(relatedTownIds[0]).lat;
					lng = townCoords.get(relatedTownIds[0]).lng;
				} else if (ownLat && ownLng) {
					lat = ownLat;
					lng = ownLng;
				}

				// 어드레스(조직/인물 시트 신설 필드) — 좌표 비정이 안 되어도 텍스트로 보존
				const address = getCol(row, headerMap, 'address', '어드레스', '주소', '주소지');

				const item = {
					id: globalId++,
					externalId,
					slug: slugify(target.type, name),
					type: target.type,
					name,
					nameI18n: collectI18n(row, headerMap, 'name', name),
					description: getCol(row, headerMap, 'description', 'desc', '설명'),
					descriptionI18n: collectI18n(
						row,
						headerMap,
						'description',
						getCol(row, headerMap, 'description', 'desc', '설명')
					),
					founded: getCol(row, headerMap, 'start_year', '설립'),
					dissolved: getCol(row, headerMap, 'end_year', '소멸'),
					lat,
					lng,
					relatedTown,
					relatedTownId: relatedTownIds[0] || '',
					relatedTownIds,
					relatedTownAll,
					relatedOrg: '',
					relatedPerson: '',
					source: getCol(row, headerMap, 'source', '출처'),
					author: getCol(row, headerMap, 'creator', 'author', '작성자'),
					updater: getCol(row, headerMap, 'updater', 'updator', '수정자'),
					changeNote: getCol(row, headerMap, 'update_note', 'change_note', '수정내용'),
					locationPrecision: precision,
					locationBasis: getCol(row, headerMap, 'location_basis', '위치_근거', '위치근거'),
					isPrecise,
					address,
					certaintyScore: getCertaintyScore(precision)
				};

				if (target.type === '조직') {
					item.orgId = externalId;
					item.orgType = getCol(row, headerMap, 'type', 'organization_type', '유형');
				} else if (target.type === '인물') {
					item.prsId = externalId;
					item.relatedOrgIds = splitIds(
						getCol(row, headerMap, 'related_org_id', 'related_org_ids', '소속조직_id')
					);
					item.nationality = getCol(row, headerMap, 'nationality', '국적');
					item.job = getCol(row, headerMap, 'job', 'occupation', '직업');
				} else if (target.type === '사건') {
					item.evtId = externalId;
					item.relatedOrgIds = splitIds(
						getCol(row, headerMap, 'related_org_id', 'related_org_ids', '관련조직_id')
					);
					item.relatedPersonIds = splitIds(
						getCol(row, headerMap, 'related_prs_id', 'related_prs_ids', '관련인물_id')
					);
					// 사건은 마을·조직·인물 모두와 연결될 수 있다 (한 값 또는 쉼표로 여러 값)
					item.eventType = getCol(row, headerMap, 'event_type', 'type', '유형', '사건유형');
				}
				updatedData.push(item);
			}
		} catch (error) {
			console.error(`${target.type} 파싱 실패`, error);
		}
	}

	const nodesById = new Map(updatedData.map((node) => [`${node.type}:${node.externalId}`, node]));
	for (const node of updatedData) {
		node.relatedOrg = (node.relatedOrgIds || [])
			.map((id) => nodesById.get(`조직:${id}`)?.name)
			.filter(Boolean)
			.join(', ');
		node.relatedPerson = (node.relatedPersonIds || [])
			.map((id) => nodesById.get(`인물:${id}`)?.name)
			.filter(Boolean)
			.join(', ');
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
