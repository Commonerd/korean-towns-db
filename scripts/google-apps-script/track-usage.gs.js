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
 *    이 저장소의 .env 와 Vercel 환경변수에 VITE_TRACK_URL 로 넣습니다.
 * 4. 코드를 고친 뒤에는 반드시 "배포 관리 → 편집(연필) → 버전: 새 버전 → 배포"까지
 *    해야 반영됩니다. 저장만으로는 웹앱 URL 의 동작이 바뀌지 않습니다.
 *
 * 무엇이 기록되나
 * ───────────────
 *   download-file : 사이트에서 GeoJSON 파일 내려받기 버튼을 누른 횟수
 *   copy-url      : GeoJSON URL 복사 버튼을 누른 횟수 (외부 GIS 도구에 붙여넣을 의도)
 *
 * ⚠️ kepler.gl 등이 /nodes.geojson 을 직접 fetch 하는 것은 여기 잡히지 않습니다.
 *    정적 파일을 Vercel 이 그대로 내보내므로 우리 코드가 끼어들 지점이 없습니다.
 *    실제 외부 사용량을 보려면 Vercel 대시보드의 Analytics/로그를 함께 보세요.
 *
 * 집계는 어떻게
 * ─────────────
 * 로그 시트에 한 줄씩 쌓이므로, 빈 셀에서 아래처럼 세면 됩니다.
 *   =COUNTIF(B:B, "download-file")
 *   =COUNTIF(B:B, "copy-url")
 *   최근 7일: =COUNTIFS(B:B,"download-file",A:A,">="&TODAY()-7)
 */

/** 로그가 쌓일 시트 이름. 없으면 자동 생성됩니다. */
const LOG_SHEET_NAME = 'usage-log';

/** 허용할 이벤트 이름. 목록에 없는 값은 무시합니다(장난성 요청 방지). */
const ALLOWED_EVENTS = ['download-file', 'copy-url'];

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
      String(params.page || '').slice(0, 200)
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
    sheet.appendRow(['시각', '이벤트', '페이지']);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/** 편집기에서 직접 실행해 시트에 줄이 쌓이는지 확인용. */
function testAppendManually() {
  handleHit_({ parameter: { event: 'download-file', page: '/test' } });
}
