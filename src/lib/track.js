/* ====== 사용 로그 전송 (구글시트) ======
   adapter-static 이라 런타임 서버가 없다. 그래서 서버 로그 대신, 브라우저에서
   구글 Apps Script 웹앱으로 직접 핑을 보내 시트에 한 줄씩 쌓는다.
   (설치 방법은 scripts/google-apps-script/track-usage.gs.js 상단 주석 참고)

   ⚠️ 잡을 수 있는 것과 없는 것
      - 잡힘: 이 사이트의 버튼 클릭(파일 내려받기, URL 복사)
      - 못 잡음: kepler.gl 같은 외부 도구가 /nodes.geojson 을 직접 fetch 하는 것.
        정적 파일을 Vercel 이 그대로 서빙하므로 우리 코드가 개입할 지점이 없다.
        'copy-url' 클릭 수가 그 대체 지표다. */

const TRACK_URL = import.meta.env.VITE_TRACK_URL ?? '';

/* 실패해도 사용자 동작(다운로드 등)을 절대 막지 않는다 — fire-and-forget. */
export function track(event) {
	if (!TRACK_URL || typeof navigator === 'undefined') return;

	const url =
		`${TRACK_URL}?event=${encodeURIComponent(event)}` +
		`&page=${encodeURIComponent(location.pathname)}`;

	try {
		// sendBeacon 은 페이지를 떠나는 중에도 전송이 보장된다(다운로드 클릭에 적합).
		if (navigator.sendBeacon) {
			navigator.sendBeacon(url);
			return;
		}
		// 폴백. Apps Script 웹앱은 CORS 헤더를 못 붙이므로 응답은 읽지 않는다(no-cors).
		fetch(url, { mode: 'no-cors', keepalive: true });
	} catch {
		/* 트래킹 실패는 조용히 무시 */
	}
}
