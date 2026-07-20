import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		// 정적 사이트로 프리렌더 (Vercel 정적 배포 대응)
		adapter: adapter({
			fallback: undefined,
			strict: true
		}),
		// 기존 사이트가 `/` 와 `/map/` (슬래시 포함) 구조 → 동일 유지
		prerender: {
			handleHttpError: 'warn'
		},
		paths: {
			relative: false
		}
	}
};

export default config;
