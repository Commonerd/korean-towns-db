export function escapeHtml(s) {
	if (s === null || s === undefined) return '';
	return String(s).replace(
		/[&<>"']/g,
		(c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
	);
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
