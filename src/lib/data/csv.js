/* ====== CSV 파서 (기존 로직 이식) ====== */
export function csvToArray(text) {
	let c = '',
		r = [];
	let q = false;
	let row = [''];
	for (let i = 0; i < text.length; i++) {
		c = text[i];
		let next = text[i + 1];
		if (c === '"') {
			if (q && next === '"') {
				row[row.length - 1] += '"';
				i++;
			} else {
				q = !q;
			}
		} else if (c === ',') {
			if (q) row[row.length - 1] += c;
			else row.push('');
		} else if (c === '\r' || c === '\n') {
			if (c === '\r' && next === '\n') i++;
			if (q) row[row.length - 1] += c;
			else {
				r.push(row);
				row = [''];
			}
		} else {
			row[row.length - 1] += c;
		}
	}
	if (row.length > 1 || row[0] !== '') r.push(row);
	return r;
}

/* 헤더 → 인덱스 맵 (대소문자/공백 무시, 별칭 지원) */
export function buildHeaderMap(headerRow) {
	const map = {};
	headerRow.forEach((h, i) => {
		const key = (h || '')
			.toString()
			.trim()
			.toLowerCase()
			.replace(/\s+/g, '_');
		if (key) map[key] = i;
	});
	return map;
}

export function getCol(row, map, ...aliases) {
	for (const a of aliases) {
		const idx = map[a];
		if (idx !== undefined && row[idx] !== undefined) {
			return (row[idx] || '').toString().trim();
		}
	}
	// 폴백: 헤더에 공백/언더스코어 유무가 alias 와 달라도(예: "수정 내용" vs "수정내용")
	// 매칭되도록 양쪽에서 언더스코어를 지우고 다시 비교한다.
	for (const a of aliases) {
		const target = a.replace(/_/g, '');
		for (const key in map) {
			if (key.replace(/_/g, '') === target) {
				const idx = map[key];
				if (row[idx] !== undefined) return (row[idx] || '').toString().trim();
			}
		}
	}
	return '';
}
