/**
 * 구글시트 확장 프로그램(Apps Script) — GeoJSON 사용 로그 수집.
 *
 * ⚠️ 이 파일은 이 저장소(npm build)에서 실행되지 않습니다. 구글시트 자체의
 *    Apps Script 편집기에 통째로 복사해 넣는 참고용 코드입니다.
 *
 * 설치 방법
 * ─────────
 * 1. 데이터가 있는 구글시트를 열고 → 확장 프로그램 → Apps Script.
 *    (auto-rebuild.gs.js 를 이미 넣었다면, 좌측 파일 목록에서 "+" 로 새 파일을
 *     추가해 이 내용을 붙여넣으세요. 한 프로젝트에 여러 파일을 둘 수 있습니다.)
 * 2. 우측 상단 "배포" → "새 배포" → 톱니바퀴에서 유형을 "웹 앱" 선택.
 *      - 설명           : usage tracker (아무거나)
 *      - 실행 사용자     : 나
 *      - 액세스 권한     : 모든 사용자          ← 반드시 이 값이어야 익명 핑이 들어옵니다
 *    "배포" 를 누르면 권한 승인 화면이 뜹니다. 허용하세요.
 * 3. 배포 후 표시되는 "웹 앱 URL"(https://script.google.com/macros/s/…/exec)을 복사해,
 *    Vercel 프로젝트 환경변수에 TRACK_URL 로 넣습니다.
 *    ⚠️ 이 주소는 이제 브라우저가 아니라 서버(루트의 middleware.js)만 읽으므로
 *       VITE_ 접두어를 붙이면 안 됩니다 — 붙이면 클라이언트 번들에 노출됩니다.
 *       이미 VITE_TRACK_URL 로 등록해 뒀다면 그대로도 동작하지만, TRACK_URL 로
 *       옮기고 VITE_TRACK_URL 은 지우는 편이 안전합니다.
 * 4. 코드를 고친 뒤에는 반드시 "배포 관리 → 편집(연필) → 버전: 새 버전 → 배포"까지
 *    해야 반영됩니다. 저장만으로는 웹앱 URL 의 동작이 바뀌지 않습니다.
 *
 * 무엇이 기록되나
 * ───────────────
 *   download-file : 사이트에서 GeoJSON 파일 내려받기 버튼을 누른 횟수
 *   copy-url      : GeoJSON URL 복사 버튼을 누른 횟수
 *   geojson-fetch : /nodes.geojson 에 실제로 도달한 모든 요청. 우리 버튼을 거치지 않은
 *                   kepler.gl 등의 직접 fetch 도 여기 잡힌다.
 *                   ⚠️ 우리 사이트에서 버튼을 눌러도 이 이벤트가 같이 찍힌다(같은 요청을
 *                      두 경로가 각각 기록하는 것) — 그래서 download-file 합계와 정확히
 *                      일치하지 않는다. "실제 파일 전송 횟수"의 정본은 이쪽이다.
 *
 * 세 이벤트 모두 프로젝트 루트의 middleware.js 를 거쳐 들어오므로 IP 와 출처가 함께 남는다.
 * '출처' 열은 어느 서비스가 가져갔는지의 추정값이다.
 *   kepler.gl / geojson.io / felt.com …  브라우저 도구 (Origin·Referer 로 식별)
 *   QGIS / GDAL·OGR / curl / Python …    브라우저 밖 도구 (User-Agent 로 식별)
 *   self                                 우리 사이트에서 누른 것
 *
 * ⚠️ 이건 로그일 뿐 차단이 아닙니다. 실제 DDoS 방어는 Vercel 이 플랫폼 차원에서 기본
 *    제공하는 공격 방어에 맡기고, 여기서는 이상 트래픽을 시트에서 눈으로 확인할 수 있게
 *    IP 를 남기는 것까지만 합니다.
 *
 * 집계는 어떻게
 * ─────────────
 * 로그 시트에 한 줄씩 쌓이므로, 빈 셀에서 아래처럼 세면 됩니다.
 *   =COUNTIF(B:B, "download-file")
 *   =COUNTIF(B:B, "geojson-fetch")
 *   최근 7일       : =COUNTIFS(B:B,"geojson-fetch",A:A,">="&TODAY()-7)
 *   IP 별 상위 20  : =QUERY(A:E,"select D, count(D) where B='geojson-fetch' and D<>'' "&
 *                            "group by D order by count(D) desc limit 20",1)
 *                    (짧은 시간에 한 IP 가 유독 많이 찍히면 그게 이상 트래픽 신호입니다)
 *   서비스별 집계  : =QUERY(A:E,"select E, count(E) where B='geojson-fetch' "&
 *                            "group by E order by count(E) desc",1)
 */

/** 로그가 쌓일 시트 이름. 없으면 자동 생성됩니다. */
const LOG_SHEET_NAME = 'usage-log';

/** 허용할 이벤트 이름. 목록에 없는 값은 무시합니다(장난성 요청 방지). */
const ALLOWED_EVENTS = ['download-file', 'copy-url', 'geojson-fetch'];

function doGet(e) {
  return handleHit_(e);
}

function doPost(e) {
  // navigator.sendBeacon 은 POST 로 보냅니다. 쿼리스트링은 그대로 e.parameter 에 담깁니다.
  return handleHit_(e);
}

function handleHit_(e) {
  try {
    const params = (e && e.parameter) || {};
    const event = String(params.event || '').slice(0, 40);

    if (ALLOWED_EVENTS.indexOf(event) === -1) {
      return ContentService.createTextOutput('ignored');
    }

    const sheet = getLogSheet_();
    sheet.appendRow([
      new Date(),
      event,
      String(params.page || '').slice(0, 200),
      String(params.ip || '').slice(0, 45), // IPv6 까지 넉넉히
      String(params.source || '').slice(0, 80)
    ]);

    return ContentService.createTextOutput('ok');
  } catch (err) {
    // 트래킹이 실패해도 사이트에는 영향이 없습니다. 로그만 남깁니다.
    console.error(err);
    return ContentService.createTextOutput('error');
  }
}

function getLogSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(LOG_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(LOG_SHEET_NAME);
    sheet.appendRow(['시각', '이벤트', '페이지', 'IP', '출처']);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/** 편집기에서 직접 실행해 시트에 줄이 쌓이는지 확인용. */
function testAppendManually() {
  handleHit_({
    parameter: {
      event: 'geojson-fetch',
      page: '/nodes.geojson',
      ip: '203.0.113.1',
      source: 'kepler.gl'
    }
  });
}
 
