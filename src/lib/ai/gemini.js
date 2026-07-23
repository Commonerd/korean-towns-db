import { geminiApiKey } from '$lib/config.js';
import { t } from '$lib/i18n/store.svelte.js';

/* ====== Gemini AI (기존 fetchGeminiResponse 이식) ======
   chatHistory: [{ role:'user'|'model', parts:[{text}] }]
   rawData: 전체 DB (시스템 프롬프트 컨텍스트)
   반환: { status: 'ok'|'no-key'|'forbidden'|'error', text } */
export async function fetchGeminiResponse(chatHistory, rawData) {
	if (!geminiApiKey) {
		return {
			status: 'no-key',
			text: t('ai.noKey')
		};
	}

	const systemPrompt = `당신은 '코리아타운 DB - 기억의 복원' 프로젝트의 수석 역사학자이자 AI 연구원입니다. 사라진 한인 마을(공간), 독립운동 조직, 인물 간의 네트워크와 위상 관계를 설명합니다. 전체 데이터 정보: ${JSON.stringify(
		rawData
	)}. 질문에 사료적 근거와 학술적 맥락을 더해 풍성하게 답변하세요. ${t('ai.langInstruction')}`;

	const payload = {
		contents: chatHistory,
		systemInstruction: { parts: [{ text: systemPrompt }] }
	};
	const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;

	try {
		const response = await fetch(apiUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload)
		});
		const result = await response.json();

		if (result.candidates && result.candidates[0].content) {
			return { status: 'ok', text: result.candidates[0].content.parts[0].text };
		} else if (result.error && result.error.code === 403) {
			return {
				status: 'forbidden',
				text: t('ai.forbidden')
			};
		}
		return { status: 'error', text: t('ai.error') };
	} catch (error) {
		return { status: 'error', text: t('ai.network') };
	}
}

/* 마크다운 간이 파서 (기존 parseSimpleMarkdown 이식) */
export function parseSimpleMarkdown(text) {
	let html = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
	html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
	html = html.replace(/\n/g, '<br>');
	return html;
}
