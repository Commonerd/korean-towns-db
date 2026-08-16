export function escapeHtml(s) {
	if (s === null || s === undefined) return '';
	return String(s).replace(
		/[&<>"']/g,
		(c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
	);
}

// http(s):// 로 시작하는 것뿐 아니라, 프로토콜 없이 www. 로 시작하는 (비기술 편집자가
// 흔히 그대로 붙여넣는) 주소도 잡는다.
const URL_RE = /https?:\/\/[^\s<>"']+|www\.[^\s<>"']+/gi;

/* 텍스트 안의 URL 만 <a> 로 바꾸고 나머지는 이스케이프.
   출처(source)/위치 근거 같은 필드에 인용문과 URL이 섞여 들어오는 경우를 위한 것.
   {@html} 로만 렌더링해야 한다(직접 <dd>{v}</dd> 로 쓰면 안 됨). */
export function linkify(text) {
	const s = String(text ?? '');
	if (!s) return '';

	let out = '';
	let last = 0;
	for (const m of s.matchAll(URL_RE)) {
		const start = m.index;
		const raw = m[0];
		// URL 끝에 붙은 문장부호(닫는 괄호·마침표·쉼표 등)는 링크에서 제외
		const trailMatch = raw.match(/[).,;:'"”’]+$/);
		const trail = trailMatch ? trailMatch[0] : '';
		const url = trail ? raw.slice(0, -trail.length) : raw;
		// www. 로 시작해 프로토콜이 없는 경우 href 에는 https:// 를 보충 (표시 텍스트는 원문 그대로)
		const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;

		out += escapeHtml(s.slice(last, start));
		out += `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a>${escapeHtml(trail)}`;
		last = start + raw.length;
	}
	out += escapeHtml(s.slice(last));
	return out;
}

/* JSON-LD <script> 문자열. {@html} 로 <svelte:head> 에 넣어 쓴다.
   `<` 를 유니코드 이스케이프해, 설명 안에 </script> 가 섞여 들어와도 태그가 깨지지 않게 한다. */
export function jsonLdScript(obj) {
	const json = JSON.stringify(obj, (_k, v) => (v === '' || v == null ? undefined : v)).replace(
		/</g,
		'\\u003c'
	);
	return `<script type="application/ld+json">${json}<\/script>`;
}
