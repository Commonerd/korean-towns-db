import { PREFIXED_LOCALES } from '$lib/data/locales.js';

/* `/[lang=lang]/…` 가 en|ja|ru|zh 만 받도록 제한.
   ko 는 접두어 없이 기존 경로(/towns/…)를 그대로 쓰므로 여기 포함하지 않는다.
   (포함하면 /ko/towns/ 와 /towns/ 가 같은 내용의 중복 URL 이 된다) */
export function match(param) {
	return PREFIXED_LOCALES.includes(param);
}
