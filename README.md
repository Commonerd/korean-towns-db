# 코리아타운 DB

세계 속 한인 마을의 과거와 현재를 지도 위에 잇는 재외동포 역사 인프라 프로젝트.

**Svelte 5 + SvelteKit + MapLibre GL JS** 기반의 정적 사이트입니다.
(기존 순수 HTML/CSS/JS + Leaflet 구성에서 마이그레이션)

## 라우트

| 경로                  | 설명                                                     |
| --------------------- | -------------------------------------------------------- |
| `/`                   | 랜딩 페이지 (프로젝트 소개)                               |
| `/map/`               | 인터랙티브 지도 (마을·조직·인물·사건 네트워크 탐색)         |
| `/towns/`             | 마을 색인 (아카이브)                                      |
| `/towns/<slug>/`      | 마을 상세 — 노드 1건당 1페이지                             |
| `/orgs/`, `/orgs/<slug>/`       | 조직 색인 / 상세                                |
| `/persons/`, `/persons/<slug>/` | 인물 색인 / 상세                                |
| `/events/`, `/events/<slug>/`   | 사건 색인 / 상세                                |
| `/sitemap.xml`        | 전체 URL 사이트맵 (빌드 시 자동 생성)                      |

상세 페이지 URL 은 시트의 `name` 에서 자동 생성한 slug 를 씁니다
(`src/lib/data/sheets.js` 의 `makeSlugger`). 같은 타입 안에서 이름이 겹치면
`-2`, `-3` 이 붙습니다. **이름을 바꾸면 URL 도 바뀌어 색인이 끊기므로**, 검색
유입이 붙은 뒤에는 이름 변경에 주의하세요.

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

`@sveltejs/adapter-static` 으로 **모든 라우트를 빌드 시점에 프리렌더**하므로
결과물(`build/`)을 Vercel 등 어떤 정적 호스팅에도 그대로 배포할 수 있습니다.
런타임 서버가 없으므로 `+page.server.js` 의 `load` 는 요청 시점이 아니라
`npm run build` 중 **한 번만** 실행되고, 그 결과가 HTML 에 구워집니다.

## 환경 변수

`.env.example` 를 `.env` 로 복사한 뒤 값을 채웁니다. (모두 클라이언트 노출 값이라
`VITE_` 접두사를 사용합니다.)

```
VITE_SPREADSHEET_ID=     # 구글 스프레드시트 ID (towns/organizations/persons/events 시트)
VITE_GEMINI_API_KEY=     # Gemini API 키 (AI 연구 보조원)
VITE_SITE_URL=           # 정식 도메인 (canonical/og:url/sitemap 기준, 기본값 있음)
```

> **`VITE_SPREADSHEET_ID` 는 빌드 환경에도 반드시 있어야 합니다.** Vercel 프로젝트
> 설정 → Environment Variables 에 등록하세요. 빌드 중 시트를 못 읽으면 상세 페이지
> 전체가 사라진 채 배포되므로, `src/lib/server/nodes.js` 가 그런 경우 **빌드를 즉시
> 실패시킵니다.** 시트는 "링크가 있는 모든 사용자에게 공개" 상태여야 합니다.

> Gemini 키는 브라우저에 노출되므로 Google Cloud 콘솔에서 **HTTP 리퍼러/도메인 제한**을
> 걸어 두는 것을 권장합니다.

## 데이터 흐름

데이터는 구글 스프레드시트를 CSV 로 export 해서 가져옵니다. 경로가 두 갈래입니다.

1. **빌드 시점 (SEO)** — `src/lib/server/nodes.js` 가 시트를 **딱 한 번** 내려받아
   메모이즈하고, 랜딩·지도·아카이브 전체 페이지와 `sitemap.xml` 이 이 결과를 공유합니다.
   (메모이즈가 없으면 CSV 4장을 1000번 넘게 받게 됩니다.)
2. **런타임 (최신성)** — 지도 페이지는 프리렌더된 노드로 즉시 그려진 뒤, 30초마다
   시트를 다시 읽어 갱신합니다. 우상단 "실시간 동기화" 버튼으로 수동 갱신도 가능합니다.

즉 **지도는 실시간, 검색 색인용 정적 페이지는 빌드 시점 스냅샷**입니다. 시트를 고친
내용을 아카이브 페이지에도 반영하려면 재빌드가 필요합니다.

### 시트 수정 → 자동 재빌드 (선택, 권장)

`scripts/google-apps-script/auto-rebuild.gs.js` 에 참고용 Apps Script 코드가 있습니다.
구글시트 자체의 스크립트 편집기에 붙여넣는 코드라 이 저장소의 빌드에는 관여하지
않습니다. 시트를 몇 분간 연속 수정해도 마지막 수정 후 10분 조용하면 그때 재빌드를
1회만 트리거하도록(debounce) 짜여 있습니다.

설정 절차:
1. Vercel 대시보드 → 프로젝트 → **Settings → Git → Deploy Hooks** 에서 후크 URL 생성
2. 구글시트 → **확장 프로그램 → Apps Script** → 파일 내용 통째로 붙여넣기
3. `DEPLOY_HOOK_URL` 값을 1번 URL로 교체
4. **트리거** 메뉴 → `onSheetChange` 함수를 스프레드시트의 "변경 시(onChange)" 이벤트에 연결

이걸 설정하지 않으면 시트 수정 후 `git push` 등으로 직접 재빌드를 트리거해야 합니다.

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
│   ├── +page.server.js      분류별 건수 (색인 링크용)
│   ├── map/                 지도 페이지 (+page.server.js 가 초기 노드를 구워 넣음)
│   ├── [collection=collection]/          분류 색인 (/towns/ /orgs/ /persons/ /events/)
│   │   └── [slug]/          노드 상세 — entries() 로 전 노드를 프리렌더
│   └── sitemap.xml/+server.js            전체 URL 사이트맵 생성
├── params/collection.js     동적 라우트를 4개 분류로만 제한하는 매처
└── lib/
    ├── config.js            환경변수 + siteUrl/absUrl
    ├── util.js              escapeHtml · jsonLdScript
    ├── actions/reveal.js    스크롤 등장 애니메이션
    ├── server/nodes.js      빌드타임 데이터 로더 (메모이즈 + 실패 시 빌드 중단)
    ├── data/                csv·precision·sheets·filter·collections·relations
    ├── ai/gemini.js         Gemini 호출
    ├── map/                 mapStyle·icons·popup·htmlBits·controller (MapLibre)
    └── components/          MapView·Sidebar·ArchiveShell·AIChatPanel·Legend·...
```

> 마이그레이션 이전의 원본 파일은 `.legacy/` 에 백업되어 있습니다. 확인 후 삭제해도 됩니다.

## SEO 구조

지도(`/map/`)는 자바스크립트로 그려지므로 크롤러가 노드 텍스트를 읽지 못합니다.
그래서 **노드 1건 = 정적 페이지 1장**으로 따로 프리렌더합니다.

- 각 상세 페이지는 고유 `<title>` / `meta description` / `canonical` / OG 태그와
  타입별 schema.org JSON-LD(`Place` / `Organization` / `Person` / `Event`) +
  `BreadcrumbList` 를 갖습니다.
- 크롤 경로: `/` → 분류 색인 → 상세 페이지 → (관련 마을·조직·인물 링크로) 옆 페이지.
  본문을 숨긴 `sr-only` 더미가 아니라 **실제로 보이는 내부 링크**입니다.
- 상세 페이지의 «지도에서 보기» 는 `/map/?focus=<분류>/<slug>` 로 이동해 해당 노드를
  선택된 상태로 지도를 엽니다.
- `sitemap.xml` 은 빌드 때 전체 URL 로 다시 생성됩니다 (`static/` 의 수동 파일 아님).