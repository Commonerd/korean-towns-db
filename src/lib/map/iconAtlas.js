import { computeMarkerVisual } from './icons.js';

/* ====== 상세줌(zoom>=10) 마을·조직·인물 마커를 위한 GPU(WebGL) 아이콘 래스터 ======
   DOM 마커(maplibregl.Marker)를 개별 생성하지 않고, 미리 캔버스로 그려 등록한
   이미지를 symbol 레이어의 icon-image 로 참조한다. 포인트 수가 아무리 많아져도
   지도 이동/확대 시 DOM reflow가 없어 매끄럽다.

   MapLibre 의 text-field(라벨/뱃지 숫자)는 style.glyphs(폰트 서버) 설정이 필요한데,
   이 프로젝트는 API 키 없이 동작하도록 glyphs 를 의도적으로 생략했다. 대신 라벨/뱃지도
   캔버스로 직접 그려 이미지로 등록해 icon-image 로 표시한다 — 키 없이 동일한 효과. */

// Font Awesome 6 Free Solid 코드포인트 (cdnjs all.min.css 6.4.0 기준 고정값)
const GLYPH_CODEPOINT = {
	'마을-타운': 0xf7f2, // fa-house-chimney
	'마을-빌리지': 0xf015, // fa-house
	조직: 0xf0c0, // fa-users
	인물: 0xf007, // fa-user
	사건: 0xf0e7 // fa-bolt
};

function glyphChar(key) {
	return String.fromCodePoint(GLYPH_CODEPOINT[key]);
}

const BASE_SIZE = 64; // 아이콘 캔버스 논리 크기(px). icon-size 표현식이 이 값으로 나눠 실제 크기를 맞춘다.
const PIXEL_RATIO = 3; // 레티나 대응 배율
const LABEL_SCALE = 3;
const LABEL_FONT = '700 13px "Noto Sans KR", sans-serif';

function glyphKey(type, settlementType) {
	return type === '마을' ? `마을-${settlementType === '빌리지' ? '빌리지' : '타운'}` : type;
}

export function iconImageId(type, settlementType, isHighlighted) {
	return `kt-icon-${glyphKey(type, settlementType)}-${isHighlighted ? 'hi' : 'n'}`;
}

let fontReadyPromise = null;
function ensureFontLoaded() {
	if (!fontReadyPromise) {
		fontReadyPromise =
			document.fonts && document.fonts.load
				? Promise.all([
						document.fonts.load(`900 ${BASE_SIZE}px "Font Awesome 6 Free"`),
						document.fonts.load(LABEL_FONT),
						document.fonts.ready
					]).catch(() => {})
				: Promise.resolve();
	}
	return fontReadyPromise;
}

function drawIconCanvas(type, settlementType, isHighlighted) {
	const v = computeMarkerVisual(type, { settlementType, isHighlighted, certaintyScore: 1 });
	const glyph = glyphChar(glyphKey(type, settlementType));
	const borderW = isHighlighted ? 3 : 2;

	const px = BASE_SIZE * PIXEL_RATIO;
	const canvas = document.createElement('canvas');
	canvas.width = px;
	canvas.height = px;
	const ctx = canvas.getContext('2d');
	ctx.scale(PIXEL_RATIO, PIXEL_RATIO);

	const r = BASE_SIZE / 2;
	ctx.beginPath();
	ctx.arc(r, r, r - borderW / 2 - 1, 0, Math.PI * 2);
	ctx.fillStyle = v.color;
	ctx.fill();
	ctx.lineWidth = borderW;
	ctx.strokeStyle = isHighlighted ? '#fbbf24' : 'rgba(255,255,255,0.95)';
	ctx.stroke();

	ctx.fillStyle = '#fff';
	ctx.font = `900 ${Math.round(BASE_SIZE * 0.42)}px "Font Awesome 6 Free"`;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText(glyph, r, r + 1);

	return ctx.getImageData(0, 0, px, px);
}

const ICON_COMBOS = [
	['마을', '타운', false],
	['마을', '타운', true],
	['마을', '빌리지', false],
	['마을', '빌리지', true],
	['조직', '타운', false],
	['조직', '타운', true],
	['인물', '타운', false],
	['인물', '타운', true],
	['사건', '타운', false],
	['사건', '타운', true]
];

/* 필요한 8종(타운/빌리지/조직/인물 × 일반/하이라이트) 아이콘 이미지를 스타일에 등록한다. */
export async function ensureIconImages(map) {
	await ensureFontLoaded();
	for (const [type, settlementType, isHighlighted] of ICON_COMBOS) {
		const id = iconImageId(type, settlementType, isHighlighted);
		if (!map.hasImage(id)) {
			map.addImage(id, drawIconCanvas(type, settlementType, isHighlighted), {
				pixelRatio: PIXEL_RATIO
			});
		}
	}
}

export const ICON_BASE_SIZE = BASE_SIZE;

/* ====== 라벨(장소명) 캔버스 래스터 — 문자열별로 1회만 생성/캐시 ====== */
function drawLabelCanvas(text) {
	const measureCtx = document.createElement('canvas').getContext('2d');
	measureCtx.font = LABEL_FONT;
	const textWidth = Math.ceil(measureCtx.measureText(text).width);
	const width = textWidth + 12;
	const height = 22;

	const canvas = document.createElement('canvas');
	canvas.width = width * LABEL_SCALE;
	canvas.height = height * LABEL_SCALE;
	const ctx = canvas.getContext('2d');
	ctx.scale(LABEL_SCALE, LABEL_SCALE);
	ctx.font = LABEL_FONT;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	const cx = width / 2;
	const cy = height / 2;

	// 흰색 halo (기존 text-shadow 재현)
	ctx.lineWidth = 3;
	ctx.lineJoin = 'round';
	ctx.strokeStyle = 'rgba(255,255,255,0.92)';
	ctx.strokeText(text, cx, cy);
	ctx.fillStyle = '#475569';
	ctx.fillText(text, cx, cy);

	return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

export function ensureLabelImage(map, text) {
	const id = `kt-label:${text}`;
	if (!map.hasImage(id)) {
		map.addImage(id, drawLabelCanvas(text), { pixelRatio: LABEL_SCALE });
	}
	return id;
}

/* ====== 뱃지(연결 개수) 캔버스 래스터 — 숫자별로 1회만 생성/캐시 ====== */
function drawBadgeCanvas(count) {
	const text = String(count);
	const size = 20;
	const canvas = document.createElement('canvas');
	canvas.width = size * LABEL_SCALE;
	canvas.height = size * LABEL_SCALE;
	const ctx = canvas.getContext('2d');
	ctx.scale(LABEL_SCALE, LABEL_SCALE);

	ctx.beginPath();
	ctx.arc(size / 2, size / 2, size / 2 - 1.5, 0, Math.PI * 2);
	ctx.fillStyle = '#b45309';
	ctx.fill();
	ctx.lineWidth = 2;
	ctx.strokeStyle = '#fff';
	ctx.stroke();

	ctx.fillStyle = '#fff';
	ctx.font = `700 ${text.length > 2 ? 9 : 11}px "Noto Sans KR", sans-serif`;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText(text, size / 2, size / 2 + 1);

	return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

export function ensureBadgeImage(map, count) {
	const id = `kt-badge:${count}`;
	if (!map.hasImage(id)) {
		map.addImage(id, drawBadgeCanvas(count), { pixelRatio: LABEL_SCALE });
	}
	return id;
}
