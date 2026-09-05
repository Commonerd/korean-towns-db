/* ====== 사용 로그 전송 ======
   adapter-static 이라 런타임 서버가 없다. 대신 같은 오리진의 `/track` 으로 핑을 보내면,
   프로젝트 루트의 middleware.js(Vercel Routing Middleware)가 받아서 **요청 IP 와 출처를
   붙여** 구글시트(Apps Script)로 중계한다.
   (설치 방법은 scripts/google-apps-script/track-usage.gs.js 상단 주석 참고)

   ⚠️ 왜 시트 주소로 바로 안 쏘는가
      - 브라우저는 자기 공인 IP 를 모른다. Vercel 을 거쳐야 IP 가 붙는다.
      - 시트 주소를 클라이언트에 두면 번들에 그대로 노출돼, 누구나 가짜 로그를 넣을 수 있다.
      그래서 실제 시트 주소는 서버(middleware)만 알고, 브라우저는 `/track` 만 안다.

   ⚠️ 이 파일이 보내는 것은 "버튼을 눌렀다"는 클릭 의도(download-file/copy-url)다.
      kepler.gl 등이 /nodes.geojson 을 직접 fetch 하는 것처럼 버튼을 거치지 않는 요청은
      middleware.js 가 'geojson-fetch' 로 따로 기록한다. */

const ENDPOINT = '/track';

/* 실패해도 사용자 동작(다운로드 등)을 절대 막지 않는다 — fire-and-forget. */
export function track(event) {
	if (typeof navigator === 'undefined') return;

	const url =
		`${ENDPOINT}?event=${encodeURIComponent(event)}` +
		`&page=${encodeURIComponent(location.pathname)}`;

	try {
		// sendBeacon 은 페이지를 떠나는 중에도 전송이 보장된다(다운로드 클릭에 적합).
		if (navigator.sendBeacon) {
			navigator.sendBeacon(url);
			return;
		}
		fetch(url, { keepalive: true });
	} catch {
		/* 트래킹 실패는 조용히 무시 */
	}
}
