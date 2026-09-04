/* ====== AI 컨텍스트 빌더 ======
   기존에는 systemPrompt 에 JSON.stringify(rawData) 를 통째로 넣었다.
   실측하면 노드 1100여 건이 약 190만 자(= 150만 토큰 이상)라서 Gemini 요청이
   컨텍스트 한도를 넘겨 그대로 실패하거나 응답 없이 멈췄다.

   용량의 대부분은 AI 답변에 쓸모없는 부분이었다:
     - nameI18n/descriptionI18n : 같은 내용을 5개 언어로 중복 (약 54만 자)
     - JSON 키 이름이 노드마다 반복 (약 45만 자)

   그래서 JSON 대신 "구분자 한 줄 = 노드 하나" 형식으로 직렬화한다.
   작성자·수정자·수정내용·좌표·주소·출처·위치근거까지 전부 포함해도
   실측 1112건 전체가 약 29만 자(≈ 22만 토큰)로, Gemini 2.5 Flash 의
   100만 토큰 한도의 약 1/5 수준이라 여유가 크다.
   (2026-09 실측: 289,894자 → promptTokenCount 219,794)

   그래도 데이터가 계속 늘어날 것에 대비해 글자수 예산(CONTEXT_CHAR_BUDGET)을
   두고, 예산을 넘으면 아래 순서로 자동 축소한다:
     설명 길이 축소 → 설명 생략(다른 필드는 유지) → 관련도 낮은 노드는 이름만
     → 그래도 넘치면 건수만 표기.
   출처·주소·좌표 등 요청된 필드는 이 축소 단계에서 잘리지 않는다
   (단, 서지 인용문이 극단적으로 긴 이상치 하나가 예산을 독식하는 것만
    SOURCE_HARD_CAP 으로 방지한다). */

import { DATA_LOCALES } from '$lib/data/sheets.js';

/* 시스템 프롬프트에 실을 데이터 컨텍스트의 최대 글자수.
   45만 자 ≈ 34만 토큰 안팎. 현재 데이터(전체 필드 포함 29만 자)보다
   넉넉히 크게 잡아, 데이터가 지금의 1.5배로 늘어나도 축소 없이 전부
   들어가게 하면서 Gemini 2.5 Flash 100만 토큰 한도에는 충분한 여유
   (대화 기록·질문·응답 토큰 몫)를 남긴다. */
export const CONTEXT_CHAR_BUDGET = 450_000;

/* 서지 인용문 한 건이 비정상적으로 길어 예산을 독식하는 것만 막는 안전장치.
   현재 데이터의 출처 평균 길이(약 100자)보다 한참 넉넉하다. */
const SOURCE_HARD_CAP = 1200;

const DESC_NONE = -1;

/* 설명 자르기 단계 — 예산에 맞을 때까지 위에서부터 시도한다.
   0 = 자르지 않음, -1 = 설명 자체를 싣지 않음(다른 필드는 그대로 유지). */
const DESC_LIMITS = [0, 400, 200, 100, DESC_NONE];

/* 파이프 구분 형식이 깨지지 않도록 값에서 개행/구분자를 제거 */
function clean(v) {
	if (v === null || v === undefined) return '';
	return String(v).replace(/\s+/g, ' ').replace(/\|/g, '/').trim();
}

function cut(text, limit) {
	if (limit === DESC_NONE) return '';
	const s = clean(text);
	if (!limit || s.length <= limit) return s;
	return s.slice(0, limit) + '…';
}

/* 노드의 표시 이름. 한국어 원문이 정본이므로 항상 싣고,
   현재 언어가 한국어가 아니면 해당 언어 이름을 괄호로 덧붙인다
   (사용자가 영어/일본어 이름으로 물어봐도 AI 가 같은 노드를 찾을 수 있게). */
function nodeName(n, locale) {
	const ko = clean(n.name);
	if (locale === 'ko' || !DATA_LOCALES.includes(locale)) return ko;
	const alias = clean(n.nameI18n?.[locale]);
	return alias && alias !== ko ? `${ko}(${alias})` : ko;
}

/* 현재 언어의 설명이 있으면 그걸 쓴다 (한국어 원문에 더해서가 아니라 대신). */
function nodeDesc(n, locale) {
	if (locale !== 'ko' && DATA_LOCALES.includes(locale)) {
		const loc = clean(n.descriptionI18n?.[locale]);
		if (loc) return loc;
	}
	return clean(n.description);
}

function years(n) {
	const a = clean(n.founded);
	const b = clean(n.dissolved);
	if (!a && !b) return '';
	if (a && b) return a === b ? a : `${a}~${b}`;
	return a ? `${a}~` : `~${b}`;
}

function typeLabel(n) {
	return n.type === '마을' ? `마을/${n.settlementType || '타운'}` : n.type;
}

/* 유형별 고유 속성 (조직 유형 / 국적·직업 / 사건 유형·관련 조직·인물) */
function attrs(n) {
	const out = [];
	if (n.orgType) out.push(`유형:${clean(n.orgType)}`);
	if (n.eventType) out.push(`사건유형:${clean(n.eventType)}`);
	if (n.nationality) out.push(`국적:${clean(n.nationality)}`);
	if (n.job) out.push(`직업:${clean(n.job)}`);
	if (n.relatedOrg) out.push(`관련조직:${clean(n.relatedOrg)}`);
	if (n.relatedPerson) out.push(`관련인물:${clean(n.relatedPerson)}`);
	return out.join(' ');
}

/* 노드 한 줄: 유형|이름|연도|소속마을|속성|설명 뒤에 메타 필드를
   " ／ 라벨:값" 형식으로 이어 붙인다. descLimit 만 예산에 따라 줄어들고
   나머지 필드(주소·좌표·출처·작성자 등)는 항상 그대로 싣는다. */
function nodeLine(n, locale, descLimit) {
	const parts = [
		[
			typeLabel(n),
			nodeName(n, locale),
			years(n),
			clean(n.relatedTownAll || n.relatedTown),
			attrs(n),
			cut(nodeDesc(n, locale), descLimit)
		].join('|')
	];
	if (n.address) parts.push(`주소:${clean(n.address)}`);
	if (n.lat && n.lng) parts.push(`좌표:${Number(n.lat).toFixed(4)},${Number(n.lng).toFixed(4)}`);
	if (n.locationPrecision) parts.push(`위치확실성:${clean(n.locationPrecision)}`);
	if (n.locationBasis) parts.push(`위치근거:${clean(n.locationBasis)}`);
	if (n.source) parts.push(`출처:${cut(n.source, SOURCE_HARD_CAP)}`);
	if (n.author) parts.push(`작성자:${clean(n.author)}`);
	if (n.updater) parts.push(`수정자:${clean(n.updater)}`);
	if (n.changeNote) parts.push(`수정내용:${clean(n.changeNote)}`);
	return parts.join(' ／ ');
}

/* ====== 관련도 점수 ======
   질문에 나온 낱말과 지금 지도에서 고른 마을을 기준으로 점수를 매긴다.
   전체가 예산 안에 들어가는 한 정렬 순서일 뿐이지만, 예산이 부족해
   잘라내야 할 때는 이 점수 낮은 순으로 먼저 빠진다. */
function tokenize(question) {
	return [
		...new Set(
			String(question || '')
				.toLowerCase()
				.split(/[^0-9a-z가-힣ぁ-んァ-ヶ一-龥Ѐ-ӿ]+/)
				.filter((w) => w.length >= 2)
		)
	].slice(0, 20);
}

function scoreNode(n, terms, focusName) {
	let score = 0;
	const name = clean(n.name).toLowerCase();
	const desc = clean(n.description).toLowerCase();
	const town = clean(n.relatedTownAll || n.relatedTown);

	if (focusName) {
		if (n.name === focusName) score += 100;
		else if (town.includes(focusName)) score += 40;
	}
	for (const term of terms) {
		if (name.includes(term)) score += 10;
		else if (town.toLowerCase().includes(term)) score += 4;
		if (desc.includes(term)) score += 3;
	}
	// 동점일 때는 마을 > 조직 > 인물 > 사건 순으로 남긴다 (마을이 관계망의 뿌리).
	if (n.type === '마을') score += 0.3;
	else if (n.type === '조직') score += 0.2;
	else if (n.type === '인물') score += 0.1;
	return score;
}

/* ====== 요약 통계 ======
   개별 노드가 잘려도 "전체가 몇 건인지"는 항상 알려 준다.
   AI 가 표본만 보고 전수인 것처럼 단정하는 것을 막는 장치이기도 하다. */
function buildSummary(rawData) {
	const counts = {};
	const childCount = new Map();
	let minYear = Infinity;
	let maxYear = -Infinity;

	for (const n of rawData) {
		counts[typeLabel(n)] = (counts[typeLabel(n)] ?? 0) + 1;
		for (const y of [parseInt(n.founded), parseInt(n.dissolved)]) {
			if (y > 1000 && y < 2100) {
				if (y < minYear) minYear = y;
				if (y > maxYear) maxYear = y;
			}
		}
		if (n.type !== '마을') {
			for (const town of String(n.relatedTownAll || n.relatedTown || '')
				.split(',')
				.map((s) => s.trim())
				.filter(Boolean)) {
				childCount.set(town, (childCount.get(town) ?? 0) + 1);
			}
		}
	}

	const topTowns = [...childCount.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, 10)
		.map(([name, c]) => `${name}(${c})`)
		.join(', ');

	const lines = [
		`총 ${rawData.length}건 — ` +
			Object.entries(counts)
				.map(([k, v]) => `${k} ${v}`)
				.join(', ')
	];
	if (minYear !== Infinity) lines.push(`수록 연대: ${minYear}~${maxYear}`);
	if (topTowns) lines.push(`하위 항목이 많은 마을: ${topTowns}`);
	return lines.join('\n');
}

/* ====== 본체 ======
   rawData 를 예산 안에 들어가는 텍스트 컨텍스트로 만든다.
   options: { question, focusName, locale, budget } */
export function buildDataContext(rawData, options = {}) {
	const { question = '', focusName = '', locale = 'ko', budget = CONTEXT_CHAR_BUDGET } = options;
	const nodes = Array.isArray(rawData) ? rawData : [];
	if (nodes.length === 0) return '(데이터가 아직 로드되지 않았습니다. 일반 지식으로만 답하고, DB 근거가 없음을 밝히세요.)';

	const summary = buildSummary(nodes);
	const terms = tokenize(question);

	// 질문/선택 항목과 관련도 높은 노드를 앞쪽에 둔다 (예산 초과로 잘라낼 때 이 순서가 기준).
	const ranked = nodes
		.map((n) => ({ n, score: scoreNode(n, terms, focusName) }))
		.sort((a, b) => b.score - a.score || a.n.id - b.n.id);

	const listBudget = budget - summary.length - 400; // 400 = 머리말/범례 여유

	/* 1) 설명 길이를 단계적으로 줄여가며 예산에 맞는지 확인한다.
	   주소·좌표·출처·작성자 등 나머지 필드는 이 단계에서 손대지 않는다. */
	let listLines = null;
	let usedLimit = 0;
	for (const limit of DESC_LIMITS) {
		const lines = ranked.map(({ n }) => nodeLine(n, locale, limit));
		if (lines.reduce((sum, l) => sum + l.length + 1, 0) <= listBudget) {
			listLines = lines;
			usedLimit = limit;
			break;
		}
	}

	/* 2) 설명을 다 지워도 넘치면 관련도 낮은 노드는 이름만, 그래도 넘치면 건수만 */
	let omittedNote = '';
	if (!listLines) {
		usedLimit = DESC_NONE;
		listLines = [];
		let used = 0;
		let i = 0;
		for (; i < ranked.length; i++) {
			const line = nodeLine(ranked[i].n, locale, DESC_NONE);
			if (used + line.length + 1 > listBudget * 0.8) break;
			listLines.push(line);
			used += line.length + 1;
		}
		const namesOnly = [];
		for (; i < ranked.length; i++) {
			const label = `${typeLabel(ranked[i].n)}:${nodeName(ranked[i].n, locale)}`;
			if (used + label.length + 2 > listBudget) break;
			namesOnly.push(label);
			used += label.length + 2;
		}
		if (namesOnly.length) {
			listLines.push(`\n[이름만 수록 — 상세는 질문하면 조회 가능]\n${namesOnly.join(', ')}`);
		}
		const dropped = ranked.length - i;
		if (dropped > 0) {
			omittedNote = `\n⚠️ 컨텍스트 한도로 ${dropped}건은 이번 답변에 포함되지 않았습니다. 해당 항목을 물어보면 다음 질문에서 우선 포함됩니다.`;
		}
	}

	const descNote =
		usedLimit === 0
			? '설명은 원문 전체'
			: usedLimit === DESC_NONE
				? '설명 생략(다른 필드는 유지)'
				: `설명은 ${usedLimit}자까지만 수록`;

	return [
		'[DB 요약]',
		summary,
		'',
		`[형식] 유형|이름|연도|소속마을|속성|설명 ／ 주소 ／ 좌표 ／ 위치확실성 ／ 위치근거 ／ 출처 ／ 작성자 ／ 수정자 ／ 수정내용`,
		`(각 필드는 자료가 있을 때만 표시됩니다. ${descNote}. 질문/선택 항목과 관련도 높은 순으로 정렬됨)`,
		`\n[전체 목록 ${listLines.length}줄]\n${listLines.join('\n')}`,
		omittedNote
	]
		.filter(Boolean)
		.join('\n');
}
