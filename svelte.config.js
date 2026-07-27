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
                        handleHttpError: 'warn',
                        // '*' = 페이지 크롤링으로 발견되는 라우트 전부.
                        // /sitemap.xml 은 어디서도 <a> 로 링크되지 않아 크롤러가 못 찾으므로 명시적으로 추가.
                        entries: ['*', '/sitemap.xml']
                },
                paths: {
                        relative: false
                }
        }
};

export default config;