# 코리아타운 DB

세계 속 한인 마을의 과거와 현재를 지도 위에 잇는 재외동포 역사 인프라 프로젝트.

**Svelte 5 + SvelteKit + MapLibre GL JS** 기반의 정적 사이트입니다.
(기존 순수 HTML/CSS/JS + Leaflet 구성에서 마이그레이션)

## 라우트

| 경로     | 설명                                            |
| -------- | ----------------------------------------------- |
| `/`      | 랜딩 페이지 (프로젝트 소개)                      |
| `/map/`  | 인터랙티브 지도 (마을·조직·인물·사건 네트워크 탐색)  |

## 요구 사항

- Node.js >= 18

## 설치 & 개발

```bash
npm install
npm run dev        # 개발 서버 (http://localhost:5173)
```

## 빌드 & 미리보기

```bash
npm run build      # 정적 사이트를 build/ 에 프리렌더
npm run preview    # 빌드 결과 미리보기
npm run check      # svelte-check (타입/접근성 점검)
```

`@sveltejs/adapter-static` 로 `/` 와 `/map/` 를 프리렌더하므로 결과물(`build/`)을
Vercel 등 어떤 정적 호스팅에도 그대로 배포할 수 있습니다.

## 환경 변수

`.env.example` 를 `.env` 로 복사한 뒤 값을 채웁니다. (모두 클라이언트 노출 값이라
`VITE_` 접두사를 사용합니다.)

```
VITE_SPREADSHEET_ID=     # 구글 스프레드시트 ID (towns/organizations/persons/events 시트)
VITE_GEMINI_API_KEY=     # Gemini API 키 (AI 연구 보조원)
```

> Gemini 키는 브라우저에 노출되므로 Google Cloud 콘솔에서 **HTTP 리퍼러/도메인 제한**을
> 걸어 두는 것을 권장합니다.

데이터는 구글 스프레드시트를 CSV 로 export 하여 런타임에 불러오며, 30초마다 자동
동기화됩니다. 지도 우상단 "실시간 동기화" 버튼으로 수동 갱신도 가능합니다.

## 기술 스택

- **SvelteKit** (정적 프리렌더, `adapter-static`) — 라우팅 & SEO
- **Svelte 5** (runes) — UI 컴포넌트
- **MapLibre GL JS** — 지도 (OSM + CARTO dark 라스터 타일, API 키 불필요)
- **supercluster** — 2계층 마커 클러스터링
- **Tailwind CSS v4** — 지도 페이지 UI 유틸리티
- **Google Sheets (CSV export)** — 데이터 소스
- **Gemini API** — AI 연구 보조원

## 프로젝트 구조

```
src/
├── app.html                 셸 (폰트·Font Awesome·favicon)
├── app.css                  전역 토큰 + Tailwind + 랜딩 디자인 토큰
├── routes/
│   ├── +layout.js           prerender / trailingSlash 설정
│   ├── +layout.svelte
│   ├── +page.svelte         랜딩 페이지
│   └── map/+page.svelte     지도 페이지 (상태 오케스트레이터)
└── lib/
    ├── config.js            환경변수 (spreadsheetId, geminiApiKey)
    ├── util.js              escapeHtml
    ├── actions/reveal.js    스크롤 등장 애니메이션
    ├── data/                csv·precision·sheets·filter (데이터 로드/가공)
    ├── ai/gemini.js         Gemini 호출
    ├── map/                 mapStyle·icons·popup·htmlBits·controller (MapLibre)
    └── components/          MapView·Sidebar·YearSlider·AIChatPanel·Legend·...
```

> 마이그레이션 이전의 원본 파일은 `.legacy/` 에 백업되어 있습니다. 확인 후 삭제해도 됩니다.
