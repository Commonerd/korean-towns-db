/* ====== 위치 정확도(location_precision) 등급 ======
   구글 시트의 towns/organizations/persons 시트가 공통으로 갖는 `location_precision` 필드.
   - 마을(타운/빌리지) 시트: 이 필드 값이 'village'/'town'이면 그 자체로 정착지 규모(빌리지·타운)를 나타낸다.
   - 조직/인물 시트: 좌표를 어느 단위까지 확정할 수 있는지(위치 확실성)를 나타낸다.
   - 값의 정확도 순서는 Exact가 가장 확실하며, 뒤로 갈수록(= City, Region, Unknown) 점점 불확실해진다.
     Exact를 제외하면 어떤 값도 100% 확정된 것은 아니다. */
export const PRECISION_ORDER = ['exact', 'street', 'village', 'town', 'city', 'region', 'unknown'];

export const PRECISION_INFO = {
	exact: { label: 'Exact · 정확 위치', desc: '정확한 지점까지 고증되어 지도 좌표를 신뢰할 수 있습니다.' },
	street: { label: 'Street · 거리 단위', desc: '거리(구역) 단위까지는 고증되었으나, 정확한 지점은 추정입니다.' },
	village: { label: 'Village · 빌리지 단위', desc: '빌리지(소규모 정착지) 단위로 고증된 기록입니다.' },
	town: {
		label: 'Town · 타운 단위',
		desc: '타운(행정구역) 단위로 고증되었으며, 그 안의 정확한 지점은 확정되지 않았습니다.'
	},
	city: { label: 'City · 도시 단위', desc: '도시 단위로만 고증되어 정확한 위치는 불확실합니다.' },
	region: { label: 'Region · 지역 단위', desc: '지역 단위로만 확인되어 위치 불확실성이 큽니다.' },
	unknown: { label: 'Unknown · 미상', desc: '현재로서는 위치를 특정할 수 없는 기록입니다.' }
};

/* 시트 담당자가 한글로 입력했을 경우를 대비한 보조 매핑 */
const PRECISION_KO_ALIASES = {
	정확: 'exact',
	거리: 'street',
	빌리지: 'village',
	타운: 'town',
	도시: 'city',
	지역: 'region',
	미상: 'unknown',
	불명: 'unknown'
};

export function normalizePrecision(raw, fallback = 'unknown') {
	const v = (raw || '').toString().trim().toLowerCase();
	if (PRECISION_ORDER.includes(v)) return v;
	if (PRECISION_KO_ALIASES[v]) return PRECISION_KO_ALIASES[v];
	return fallback;
}

export function getPrecisionRank(precisionKey) {
	const idx = PRECISION_ORDER.indexOf(precisionKey);
	return idx === -1 ? PRECISION_ORDER.length - 1 : idx;
}

/* 1(Exact, 가장 확실) ~ 0(Unknown, 가장 불확실) */
export function getCertaintyScore(precisionKey) {
	const rank = getPrecisionRank(precisionKey);
	return 1 - rank / (PRECISION_ORDER.length - 1);
}

export function certaintyColor(pct) {
	if (pct < 40) return '#dc2626';
	if (pct < 70) return '#d97706';
	return '#16a34a';
}
