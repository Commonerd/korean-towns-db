# 코리아타운 DB

세계 속 한인 마을의 과거와 현재를 지도 위에 잇는 재외동포 역사 인프라 프로젝트.

**Svelte 5 + SvelteKit + MapLibre GL JS** 기반의 **완전 정적(프리렌더) 사이트**입니다.
데이터는 구글 스프레드시트에 있고, 빌드 시 CSV 로 읽어 5개 언어 × 전 노드를 HTML 로 구워 냅니다.

---

## 현재 상태 (2026-09 기준)

| 항목 | 값 |
| --- | --- |
| 노드 총계 | **1,112건** — 마을 989 · 조직 99 · 인물 6 · 사건 18 |
| 지원 언어 | **5개** — 한국어(기본) · English · 日本語 · Русский · 中文 |
| 프리렌더 페이지 | 상세 1,112 × 5 = **5,560장** + 색인 20장 + 랜딩·지도·라이선스·sitemap |
| 좌표 보유 | 마을 926/989 (94%) · 조직 99/99 · 사건 18/18 · 인물 4/6 |
| 출처 기재 | 마을 973/989 (98%) · 조직 97/99 · 사건 17/18 |
| 관계 연결 | 조직·인물·사건 123건 중 `related_town` 기재 **40건** → 관계가 붙은 마을은 983개 중 **7개** |
| 코드 규모 | `src/` 약 10,400줄 (번역 사전 1,655줄 포함) |
| 타입 점검 | `npm run check` — 오류 0, 경고 2 (미사용 CSS 선택자 오탐) |

> 노드 수는 시트가 바뀌면 함께 바뀝니다. 위 값은 현 시점 스냅샷입니다.

---

## 라우트

한국어는 접두어 없이(`/towns/`), 나머지 언어는 접두어를 붙입니다(`/en/towns/`).
이미 색인된 한국어 URL 을 보존하기 위한 설계입니다.

| 경로 | 설명 | 언어별 URL |
| --- | --- | --- |
| `/` | 랜딩 페이지 (프로젝트 소개) | 단일 URL · 클라이언트 전환 |
| `/map/` | 인터랙티브 지도 | 단일 URL · 클라이언트 전환 |
| `/license/` | 데이터 이용약관 (CC BY 4.0) | 단일 URL |
| `/towns/` `/orgs/` `/persons/` `/events/` | 분류 색인 | `/{en\|ja\|ru\|zh}/towns/` … |
| `/towns/<slug>/` 등 | 노드 상세 — 1건당 1페이지 | `/{en\|ja\|ru\|zh}/towns/<slug>/` |
| `/sitemap.xml` | 전체 URL + hreflang 사이트맵 (빌드 시 생성) | — |
| `/nodes.geojson` | 좌표 보유 노드 전체 GeoJSON 내보내기 (CC BY 4.0, GIS 도구용) | — |

- **slug 는 전 언어가 공유합니다.** 한국어 `name` 에서 만들며(`src/lib/data/sheets.js` 의
  `makeSlugger`), 같은 분류 안에서 이름이 겹치면 `-2`, `-3` 이 붙습니다.
  언어마다 slug 가 달라지면 hreflang 대응과 관계망 링크가 전부 깨지므로 번역하지 않습니다.
- **이름을 바꾸면 URL 도 바뀌어 색인이 끊깁니다.** 검색 유입이 붙은 뒤에는 주의하세요.

---

## 요구 사항 · 설치 · 빌드

- Node.js >= 18

```bash
npm install
npm run dev        # 개발 서버 (http://localhost:5173)
npm run build      # 정적 사이트를 build/ 에 프리렌더
npm run preview    # 빌드 결과 미리보기
npm run check      # svelte-check (타입/접근성 점검)
```

`@sveltejs/adapter-static` 으로 **모든 라우트를 빌드 시점에 프리렌더**하므로 결과물(`build/`)을
Vercel 등 어떤 정적 호스팅에도 그대로 올릴 수 있습니다. 런타임 서버가 없으므로
`+page.server.js` 의 `load` 는 요청 시점이 아니라 `npm run build` 중 **한 번만** 실행되고,
그 결과가 HTML 에 구워집니다.

> **빌드 규모 주의** — 노드 1건이 언어 수(5)만큼 페이지로 늘어납니다. 지금은 5,500여 장이며,
> 노드가 3,000건이 되면 15,000장이 됩니다. 빌드 시간·산출물 크기가 노드 수 × 언어 수에
> 비례해 늘어난다는 점을 데이터 확장 계획에 반영하세요.

---

## 환경 변수

`.env.example` 를 `.env` 로 복사한 뒤 값을 채웁니다. 모두 클라이언트에 노출되는 값이라
`VITE_` 접두사를 씁니다.

| 변수 | 필수 | 용도 |
| --- | --- | --- |
| `VITE_SPREADSHEET_ID` | **필수** | 구글 스프레드시트 ID (towns/organizations/persons/events 시트) |
| `VITE_GEMINI_API_KEY` | 선택 | AI 연구 보조원. 없으면 챗 패널이 안내 메시지만 표시 |
| `VITE_SITE_URL` | 선택 | 정식 도메인 (canonical·og:url·sitemap 기준). 기본값 `https://korean-towns-db.vercel.app` |
| `VITE_CARTO_API_KEY` | 선택 | CARTO 다크 타일 키. 없으면 키 없는 공개 엔드포인트 사용 |
| `VITE_TRACK_URL` | 선택 | GeoJSON 사용 로그를 받을 Apps Script 웹앱 URL. 없으면 트래킹이 통째로 비활성 |

> **`VITE_SPREADSHEET_ID` 는 빌드 환경에도 반드시 있어야 합니다.** Vercel 프로젝트 설정 →
> Environment Variables 에 등록하세요. 빌드 중 시트를 못 읽으면 상세 페이지 전체가 사라진 채
> 배포되므로, `src/lib/server/nodes.js` 가 그런 경우 **빌드를 즉시 실패시킵니다.**
> 시트는 "링크가 있는 모든 사용자에게 공개" 상태여야 합니다.

> Gemini 키는 브라우저에 노출되므로 Google Cloud 콘솔에서 **HTTP 리퍼러/도메인 제한**을
> 걸어 두는 것을 권장합니다.

---

## 데이터 흐름

구글 스프레드시트를 CSV 로 export 해서 가져옵니다. 경로가 두 갈래입니다.

1. **빌드 시점 (SEO)** — `src/lib/server/nodes.js` 가 시트를 **딱 한 번** 내려받아
   메모이즈하고, 랜딩·지도·아카이브 전 페이지와 `sitemap.xml` 이 그 결과를 공유합니다.
   (메모이즈가 없으면 5,500여 번의 프리렌더가 CSV 4장을 매번 받게 됩니다.)
2. **런타임 (최신성)** — 지도 페이지는 프리렌더된 노드로 즉시 그려진 뒤, **30초마다**
   시트를 다시 읽어 갱신합니다. 우상단 "실시간 동기화" 버튼으로 수동 갱신도 가능합니다.

즉 **지도는 실시간, 검색 색인용 정적 페이지는 빌드 시점 스냅샷**입니다. 시트 수정 내용을
아카이브 페이지에도 반영하려면 재빌드가 필요합니다.

### 시트 스키마

4개 시트가 gid 로 고정되어 있습니다 (`src/lib/data/sheets.js` 의 `targets`).

| 시트 | gid | 고유 필드 |
| --- | --- | --- |
| 마을 towns | `0` | `population` |
| 조직 organizations | `1633831664` | `type`(조직 유형) |
| 인물 persons | `997795861` | `nationality`, `job`, `related_organization` |
| 사건 events | `1560552606` | `event_type`, `related_organization`, `related_person` |

공통 필드: `name` `description` `start_year` `end_year` `latitude` `longitude`
`source` `creator` `updater` `update_note` `address` `location_precision` `location_basis`
`related_town`, 그리고 다국어 칼럼 `name_{ko,en,ja,ru,zh}` · `description_{ko,en,ja,ru,zh}`.

- 헤더 매칭은 대소문자·공백·언더스코어를 무시하고 한글 별칭(`이름`/`위도`/`출처` 등)도 받습니다
  (`src/lib/data/csv.js` 의 `getCol`).
- `related_town` 등 관계 필드는 **쉼표로 여러 값**을 넣을 수 있습니다.
- **관계 매칭은 항상 한국어 `name` 원문 기준**입니다. 번역 칼럼은 표시용일 뿐이며,
  `name` 을 번역하면 slug·관계망이 통째로 깨집니다.
- 좌표가 없는 조직/인물/사건은 `related_town` 의 마을 좌표로 폴백합니다.

### 위치 정확도 (`location_precision`)

`exact → street → village → town → city → region → unknown` 7등급이며, 이 순서대로
확실성 점수(1.0 → 0.0)가 계산됩니다 (`src/lib/data/precision.js`). 상세 페이지에 확실성
막대로 표시되고, 지도 마커 모양에도 반영됩니다.

- 마을 시트에서는 이 필드가 **정착지 규모**(`village` = 빌리지, `town` = 타운)를 겸합니다.
- 값이 비어 있으면 마을은 `town`, 그 외는 `unknown` 으로 폴백합니다.
  현재 마을 989건 중 559건(57%)이 빈칸이라 대부분 `town` 으로 표시됩니다.

### 시트 수정 → 자동 재빌드 (선택, 권장)

`scripts/google-apps-script/auto-rebuild.gs.js` 에 참고용 Apps Script 코드가 있습니다.
구글시트의 스크립트 편집기에 붙여넣는 코드라 이 저장소의 빌드에는 관여하지 않습니다.
시트를 몇 분간 연속 수정해도 마지막 수정 후 10분 조용하면 그때 재빌드를 1회만 트리거하도록
(debounce) 짜여 있습니다.

1. Vercel 대시보드 → 프로젝트 → **Settings → Git → Deploy Hooks** 에서 후크 URL 생성
2. 구글시트 → **확장 프로그램 → Apps Script** → 파일 내용 통째로 붙여넣기
3. `DEPLOY_HOOK_URL` 값을 1번 URL로 교체
4. **트리거** 메뉴 → `onSheetChange` 를 스프레드시트의 "변경 시(onChange)" 이벤트에 연결

설정하지 않으면 시트 수정 후 직접 재빌드를 트리거해야 합니다.

---

## 다국어(i18n) 구조

경로가 두 갈래로 갈립니다. **정적 페이지는 URL 로, 지도·랜딩은 클라이언트 상태로** 전환합니다.

| | 아카이브 (색인·상세) | 랜딩 · 지도 |
| --- | --- | --- |
| 전환 방식 | 언어별 URL 프리렌더 | `localStorage` + 브라우저 언어 감지 |
| 상태 | `src/lib/i18n/translations.js` 의 순수 함수 | `src/lib/i18n/store.svelte.js` (Svelte 5 runes) |
| hreflang | `<link rel="alternate">` + sitemap `xhtml:link` | 없음 (단일 URL) |
| 색인 | 언어별로 각각 색인됨 | 한국어 1장만 색인됨 |

- 사전은 `translations.js` 한 곳(1,445개 키)에 모여 있습니다. 일부 값은 `<br>`/`<strong>`
  같은 HTML 을 포함하며 `{@html}` 로 렌더합니다.
- 데이터 자체의 번역은 시트의 `name_*` / `description_*` 칼럼에서 옵니다. 비어 있으면
  한국어 원문으로 폴백합니다.
- SSR 과 첫 클라이언트 렌더를 맞추기 위해 스토어는 항상 `ko` 로 시작하고, 하이드레이션
  직후 `initLocale()` 이 감지 언어로 전환합니다.

---

## SEO 구조

지도(`/map/`)는 자바스크립트로 그려지므로 크롤러가 노드 텍스트를 읽지 못합니다.
그래서 **노드 1건 = 정적 페이지 1장**으로 따로 프리렌더합니다.

- 각 상세 페이지는 고유 `<title>` / `meta description` / `canonical` / OG 태그와
  타입별 schema.org JSON-LD(`Place` / `Organization` / `Person` / `Event`) +
  `BreadcrumbList` 를 갖습니다.
- 크롤 경로: `/` → 분류 색인 → 상세 → (관련 마을·조직·인물·사건 링크로) 옆 페이지.
  `sr-only` 더미가 아니라 **실제로 보이는 내부 링크**입니다(`src/lib/data/relations.js`).
- 상세 페이지의 «지도에서 보기» 는 `/map/?focus=<분류>/<slug>` 로 이동해 해당 노드를
  선택된 상태로 지도를 엽니다.
- `sitemap.xml` 은 빌드 때 전 언어 URL + `xhtml:link` hreflang 으로 다시 생성됩니다
  (`static/` 의 수동 파일이 아님).

---

## 지도 기능

`src/lib/map/controller.js` (약 1,000줄)가 MapLibre 위의 렌더링을 전담합니다.

- **2계층 렌더링** — 저줌에서는 `supercluster` + DOM 마커, 상세줌(zoom ≥ 10)에서는
  halo·아이콘·뱃지·라벨을 GPU 심볼/서클 레이어로 그립니다. 포인트가 늘어도 DOM reflow 가
  없어 이동·확대가 매끄럽습니다.
- **스파이더파이** — 확대해도 쪼개지지 않는 클러스터를 클릭하면 leaf 를 원/나선으로 펼치고
  중심과 잇는 다리 선을 애니메이션합니다.
- **네트워크 라인** — 마을과 그에 속한 조직·인물·사건을 대시 애니메이션 선으로 잇습니다.
- **다크맵 블렌드** — OSM 라이트와 CARTO 다크 라스터의 불투명도를 슬라이더로 섞습니다.
  지형 고도/평면 모드도 전환할 수 있습니다.
- **연도 슬라이더** — `start_year`/`end_year` 로 시대별 필터링. 데이터에서 범위를 자동 감지합니다.
- **키 불필요** — `glyphs`(폰트 서버)를 의도적으로 생략하고 라벨·뱃지까지 캔버스로 그려
  이미지로 등록합니다. 스프라이트/글리프 서버 없이 동작합니다.

## AI 연구 보조원

`src/lib/ai/` — Gemini(`gemini-3.6-flash`)로 노드 맥락을 해설합니다.

DB 전체(1,112건)를 그대로 프롬프트에 넣으면 무료 등급의 **분당 입력 토큰 한도**를 첫 질문
한 번으로 소진합니다. 그래서 `context.js` 가 **질문·선택 항목과 관련 높은 40건만 상세로,
나머지는 요약으로** 실어 15만 자 예산 안에 맞춥니다. 자세한 실측 근거는 해당 파일 상단
주석에 있습니다.

---

## 기술 스택

- **SvelteKit** (`adapter-static`, 전 라우트 프리렌더) — 라우팅 & SEO
- **Svelte 5** (runes) — UI 컴포넌트 · i18n 스토어
- **MapLibre GL JS 5** — 지도 (OSM + CARTO dark 라스터, API 키 불필요)
- **supercluster 8** — 2계층 마커 클러스터링
- **Tailwind CSS v4** — 지도 페이지 UI 유틸리티
- **Google Sheets (CSV export)** — 데이터 소스 (별도 백엔드 없음)
- **Gemini API** — AI 연구 보조원

런타임 의존성은 `maplibre-gl` 과 `supercluster` **2개뿐**입니다.

---

## 프로젝트 구조

```
src/
├── app.html                 셸 (폰트·Font Awesome·favicon)
├── app.css                  전역 토큰 + Tailwind + 랜딩 디자인 토큰
├── routes/
│   ├── +layout.js           prerender / trailingSlash 설정
│   ├── +layout.svelte       하이드레이션 후 언어 감지
│   ├── +page.svelte         랜딩 페이지 (1,730줄)
│   ├── map/                 지도 페이지 (+page.server.js 가 초기 노드를 구워 넣음)
│   ├── license/             데이터 이용약관 (CC BY 4.0)
│   ├── [collection=collection]/          한국어 색인 (/towns/ /orgs/ /persons/ /events/)
│   │   └── [slug]/                       한국어 상세
│   ├── [lang=lang]/[collection=collection]/
│   │   └── [slug]/                       en·ja·ru·zh 색인 / 상세
│   ├── sitemap.xml/+server.js            전 언어 URL + hreflang 사이트맵
│   └── nodes.geojson/+server.js          좌표 보유 노드 GeoJSON 내보내기
├── params/
│   ├── collection.js        동적 라우트를 4개 분류로만 제한
│   └── lang.js              언어 접두어를 en|ja|ru|zh 로만 제한 (ko 제외 = 중복 URL 방지)
└── lib/
    ├── config.js            환경변수 + siteUrl/absUrl
    ├── track.js             사용 로그를 구글시트(Apps Script)로 전송
    ├── util.js              escapeHtml · linkify · jsonLdScript
    ├── actions/reveal.js    스크롤 등장 애니메이션
    ├── server/
    │   ├── nodes.js         빌드타임 로더 (메모이즈 + 실패 시 빌드 중단)
    │   └── archive.js       색인·상세 페이지 공용 로더 (한국어/언어별 라우트가 공유)
    ├── data/
    │   ├── csv.js           CSV 파서 + 헤더 별칭 매칭
    │   ├── sheets.js        시트 → 노드 변환 (slug·다국어·좌표 폴백)
    │   ├── collections.js   분류 4종 정의 (URL slug ↔ 데이터 타입 단일 출처)
    │   ├── locales.js       언어별 URL 규칙 (서버·브라우저 공용)
    │   ├── precision.js     위치 정확도 7등급 + 확실성 점수
    │   ├── relations.js     노드 색인 · 관계 해석 · 요약
    │   └── filter.js        타입/검색어/연도 필터 (순수 함수)
    ├── i18n/
    │   ├── translations.js  5개 언어 사전 (1,445키) + 순수 조회 함수
    │   └── store.svelte.js  현재 언어 상태 (runes) + localStorage
    ├── ai/
    │   ├── gemini.js        Gemini 호출 · 재시도 · 마크다운 파싱
    │   └── context.js       토큰 예산 안에서 DB 컨텍스트 압축
    ├── map/
    │   ├── mapStyle.js      MapLibre 스타일 (라스터 2종 + geojson 소스)
    │   ├── iconAtlas.js     캔버스로 아이콘·라벨·뱃지를 그려 GPU 이미지로 등록
    │   ├── icons.js         마커 시각 속성 계산
    │   ├── popup.js         팝업 · htmlBits.js  마크업 조각
    │   ├── controller.js    렌더·클러스터·스파이더파이·네트워크선·포커스 (1,014줄)
    │   └── map.css
    └── components/          MapView · Sidebar · MapHeader · Legend · YearSlider ·
                             ZoomHint · DarkMapControl · AIChatPanel ·
                             ArchiveShell · CollectionIndex · NodeDetail ·
                             LanguageSwitcher
```

> 마이그레이션 이전의 원본 파일(순수 HTML/CSS/JS + Leaflet)은 `.legacy/` 에 백업되어
> 있습니다. 현재 빌드와 무관하며 확인 후 삭제해도 됩니다.

---

## 라이선스

- **소스 코드** — MIT (`LICENSE`)
- **데이터** — CC BY 4.0 (`DATA-LICENSE.md`, 사이트에서는 `/license/`)
- **지도 타일** — © OpenStreetMap contributors / © CARTO (각 제공자 라이선스)
- **AI 생성 텍스트** — 사료 검증을 거치지 않았으므로 인용 대상이 아닙니다

---

## 알려진 정리 대상

빌드에는 지장이 없으나 손대면 좋은 지점입니다.

- `src/lib/data/sheets.js` 의 `EVENTS_GID = 'REPLACE_WITH_EVENTS_GID'` 상수는 **죽은 코드**입니다.
  실제 gid 는 `targets` 배열에 직접 들어 있어 아래 가드가 절대 참이 되지 않습니다.
- 랜딩(`src/routes/+page.svelte`)과 지도(`src/routes/map/+page.svelte`)의
  canonical·og:url·og:image 가 `absUrl()` 대신 **도메인 문자열로 하드코딩**되어 있습니다.
  커스텀 도메인으로 옮기면 이 두 페이지만 옛 주소를 가리킵니다.
  (`static/robots.txt` 의 sitemap 주소도 같은 상황입니다.)
- 랜딩·지도 페이지는 언어별 URL 이 없어 한국어판만 색인됩니다. 번역 UI 는 이미 5개 언어가
  준비되어 있으므로, 언어별 프리렌더로 확장하면 색인 가능한 페이지가 그만큼 늘어납니다.
