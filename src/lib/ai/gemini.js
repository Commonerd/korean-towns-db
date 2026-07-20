import { geminiApiKey } from '$lib/config.js';

/* ====== Gemini AI (기존 fetchGeminiResponse 이식) ======
   chatHistory: [{ role:'user'|'model', parts:[{text}] }]
   rawData: 전체 DB (시스템 프롬프트 컨텍스트)
   반환: { status: 'ok'|'no-key'|'forbidden'|'error', text } */
export async function fetchGeminiResponse(chatHistory, rawData) {
	if (!geminiApiKey) {
		return {
			status: 'no-key',
			text: 'Gemini API 키가 설정되지 않았습니다. .env 의 VITE_GEMINI_API_KEY 를 확인하세요.'
		};
	}

	const systemPrompt = `당신은 '코리아타운 DB - 기억의 복원' 프로젝트의 수석 역사학자이자 AI 연구원입니다. 사라진 한인 마을(공간), 독립운동 조직, 인물 간의 네트워크와 위상 관계를 설명합니다. 전체 데이터 정보: ${JSON.stringify(
		rawData
	)}. 질문에 사료적 근거와 학술적 맥락을 더해 풍성하게 답변하세요.`;

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
				text: "⚠️ <b>API 접근 권한 거부(403 Error)</b>: Google Cloud 콘솔의 'API 및 서비스 > 사용자 인증 정보'에서 사용 중인 API 키의 제한사항을 <b>'키 제한 안함'</b>으로 변경하거나, <b>'Generative Language API'</b>를 명시적으로 허용해 주셔야 해결됩니다."
			};
		}
		return { status: 'error', text: '자료를 분석하는 중에 에러가 발생했습니다.' };
	} catch (error) {
		return { status: 'error', text: '네트워크 통신 오류가 발생했습니다.' };
	}
}

/* 마크다운 간이 파서 (기존 parseSimpleMarkdown 이식) */
export function parseSimpleMarkdown(text) {
	let html = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
	html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
	html = html.replace(/\n/g, '<br>');
	return html;
}
