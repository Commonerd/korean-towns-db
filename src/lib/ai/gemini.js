import { geminiApiKey } from '$lib/config.js';
import { t, getLocale } from '$lib/i18n/store.svelte.js';
import { buildDataContext, CONTEXT_CHAR_BUDGET } from './context.js';

/* gemini-3.1-pro-preview(상위 Pro급)는 결제 계정이 연결된 유료 프로젝트에서만
   쿼터가 열린다(현재 API 키는 무료 등급이라 429). gemini-2.5-pro 는 신규 사용자에게
   더 이상 제공되지 않는다(404, Google 이 3.1-pro-preview 로 안내). 그래서 무료
   등급에서 바로 쓸 수 있는 flash 계열 중 가장 최신인 3.6 을 쓴다. */
const MODEL = 'gemini-3.6-flash';

/* 대화가 길어지면 이전 turn 이 계속 쌓여 데이터 컨텍스트와 함께 한도를 밀어낸다.
   최근 대화만 남긴다 (user/model 합쳐 12개 = 6턴). */
const MAX_HISTORY_TURNS = 12;

/* 답변 길이 상한. gemini-3.6-flash 는 thinkingConfig 자체를 거부해서
   (아래 post() 의 재시도 로직 참고) thinkingBudget 을 0 으로 강제할 수 없고,
   "생각"에 쓰는 토큰도 이 상한을 함께 소모한다. 실측으로 생각에만
   2000~3000 토큰을 쓰는 경우가 있어, 4096 이면 답변이 MAX_TOKENS 로 잘리는
   사례가 나왔다. 8192 로 올려 그 여유를 확보했다. */
const MAX_OUTPUT_TOKENS = 8192;
const THINKING_BUDGET = 0;

/* ====== Gemini AI ======
   chatHistory: [{ role:'user'|'model', parts:[{text}] }]
   rawData: 전체 DB (여기서 예산 안의 텍스트 컨텍스트로 압축해 넣는다)
   options: { focusName, budget } — focusName 은 지도에서 선택한 마을/항목 이름
   반환: { status: 'ok'|'no-key'|'forbidden'|'error', text } */
export async function fetchGeminiResponse(chatHistory, rawData, options = {}) {
	if (!geminiApiKey) {
		return {
			status: 'no-key',
			text: t('ai.noKey')
		};
	}

	const locale = getLocale();
	const history = trimHistory(chatHistory);
	const question = lastUserText(history);

	const dataContext = buildDataContext(rawData, {
		question,
		focusName: options.focusName ?? '',
		locale,
		budget: options.budget ?? CONTEXT_CHAR_BUDGET
	});

	const systemPrompt = `당신은 '코리아타운 DB - 기억의 복원' 프로젝트의 수석 역사학자이자 AI 연구원입니다. 사라진 한인 마을(공간), 독립운동 조직, 인물, 사건 간의 네트워크와 위상 관계를 설명합니다.

아래는 프로젝트 DB 를 요약·압축한 자료입니다. 답변은 이 자료를 1차 근거로 삼고, 부족한 부분만 일반적인 역사 지식으로 보충하되 어디까지가 DB 근거이고 어디부터가 일반 지식인지 구분해 주세요. 자료에 없는 항목을 DB 에 있는 것처럼 말하지 마세요.

${dataContext}

질문에 사료적 근거와 학술적 맥락을 더해 풍성하게 답변하세요. ${t('ai.langInstruction')}`;

	const payload = {
		contents: history,
		systemInstruction: { parts: [{ text: systemPrompt }] },
		generationConfig: {
			temperature: 0.7,
			maxOutputTokens: MAX_OUTPUT_TOKENS,
			thinkingConfig: { thinkingBudget: THINKING_BUDGET }
		}
	};
	const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${geminiApiKey}`;

	try {
		let result = await post(apiUrl, payload);

		/* 모델이 thinkingConfig 를 거부하면 400 이 난다. 메시지가 모델마다 달라
		   ("...thinking..." 도 있고 gemini-3.6-flash 처럼 그냥 "invalid argument" 만
		   오는 경우도 있다) 문구로 판별하지 않고, thinkingConfig 를 보낸 상태에서
		   400 을 받으면 무조건 한 번만 빼고 재시도한다. */
		if (result?.error?.code === 400 && payload.generationConfig.thinkingConfig) {
			delete payload.generationConfig.thinkingConfig;
			result = await post(apiUrl, payload);
		}

		const text = extractText(result);
		if (text) return { status: 'ok', text };

		if (result?.error?.code === 403) {
			return { status: 'forbidden', text: t('ai.forbidden') };
		}
		if (result?.error?.code === 429) {
			return { status: 'rate-limited', text: t('ai.rateLimit') };
		}
		// 원인 파악용 — 사용자에게는 일반 오류 메시지를 보여준다
		console.error('[Gemini] 응답에서 텍스트를 찾지 못했습니다', result);
		return { status: 'error', text: t('ai.error') };
	} catch (error) {
		console.error('[Gemini] 요청 실패', error);
		return { status: 'error', text: t('ai.network') };
	}
}

async function post(apiUrl, payload) {
	const response = await fetch(apiUrl, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload)
	});
	// 4xx/5xx 도 JSON 본문에 error 를 담아 주므로 그대로 파싱해 넘긴다
	return await response.json();
}

/* 최근 대화만 남기되, 대화는 user 발화로 시작해야 하므로 잘린 앞머리를 보정한다. */
function trimHistory(chatHistory) {
	const list = Array.isArray(chatHistory) ? chatHistory : [];
	let out = list.slice(-MAX_HISTORY_TURNS);
	while (out.length && out[0].role !== 'user') out = out.slice(1);
	return out.length ? out : list.slice(-1);
}

function lastUserText(history) {
	for (let i = history.length - 1; i >= 0; i--) {
		if (history[i].role === 'user') return history[i].parts?.[0]?.text ?? '';
	}
	return '';
}

/* candidates[0].parts 가 여러 조각으로 쪼개져 오거나, 안전 필터로 비어 올 수 있다. */
function extractText(result) {
	const parts = result?.candidates?.[0]?.content?.parts;
	if (!Array.isArray(parts)) return '';
	return parts
		.map((p) => p?.text ?? '')
		.join('')
		.trim();
}

/* 마크다운 간이 파서 (기존 parseSimpleMarkdown 이식) */
export function parseSimpleMarkdown(text) {
	let html = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
	html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
	html = html.replace(/\n/g, '<br>');
	return html;
}
