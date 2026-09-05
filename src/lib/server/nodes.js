/* ====== 빌드타임(프리렌더) 데이터 로더 ======
   adapter-static 이라 런타임 서버가 없다. 이 모듈의 load 는 `npm run build` 중
   딱 한 번 실행되고, 결과가 HTML + __data.json 으로 구워진다.

   ⚠️ 메모이즈 필수: entries() 와 load() 가 라우트/노드마다 호출되므로
      캐시가 없으면 CSV 4장을 1000번 넘게 내려받게 된다.
      (Promise 자체를 캐시해 동시 호출도 1회로 합친다.)

   ⚠️ 실패는 조용히 넘기지 않는다: 빌드 중 시트를 못 읽으면 상세 페이지 전체가
      사라진 채 배포되어 색인이 통째로 날아간다. building 이면 throw 한다. */
import { building, dev } from '$app/environment';
import { spreadsheetId } from '$lib/config.js';
import { loadGoogleSheetsData } from '$lib/data/sheets.js';
import { buildIndex } from '$lib/data/relations.js';

/* 빌드 시각(YYYY-MM-DD). 모듈이 처음 로드될 때 한 번만 확정되므로 빌드 전체가 같은 값을
   공유한다. GeoJSON 내보내기의 `generated` 필드와 다운로드 파일명이 어긋나지 않게 하려고
   날짜 계산을 여기 한 곳으로 모았다. */
export const BUILD_DATE = new Date().toISOString().slice(0, 10);

let cached = null;

/** @returns {Promise<{nodes: any[], index: any}>} */
export function loadNodeIndex() {
	if (!cached) cached = fetchOnce();
	return cached;
}

async function fetchOnce() {
	const nodes = await fetchNodes();
	return { nodes, index: buildIndex(nodes) };
}

async function fetchNodes() {
	if (!spreadsheetId) {
		return fail(
			'VITE_SPREADSHEET_ID 가 비어 있습니다. .env(로컬) 또는 Vercel 프로젝트 환경변수에 설정하세요.'
		);
	}

	let nodes;
	try {
		nodes = await loadGoogleSheetsData();
	} catch (e) {
		return fail(`구글 시트 요청이 실패했습니다: ${e?.message ?? e}`);
	}

	if (!nodes.length) {
		return fail(
			`구글 시트(${spreadsheetId})에서 노드를 한 건도 읽지 못했습니다. ` +
				'시트가 "링크가 있는 모든 사용자에게 공개"인지, gid 가 맞는지 확인하세요.'
		);
	}
	return nodes;
}

/* 빌드 중이면 빌드를 세우고, dev 서버에서는 경고만 남기고 빈 목록으로 계속 간다. */
function fail(message) {
	const full = `[코리아타운 DB] 프리렌더 데이터 로드 실패 — ${message}`;
	if (building) throw new Error(full);
	if (dev) console.warn(full + ' (dev 모드라 빈 목록으로 계속합니다)');
	return [];
}
 
