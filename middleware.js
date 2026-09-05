/* ====== Vercel Routing Middleware ======
   프레임워크 무관하게 프로젝트 루트에 두면 Vercel 이 매 요청 전에 실행한다.
   adapter-static 로 만든 /nodes.geojson 은 배포되면 그냥 정적 파일이라, SvelteKit
   쪽 코드(+server.js)는 실제 방문자 요청에 전혀 관여하지 못한다 — 그래서 "누가 이
   파일을 실제로 받아갔는지"는 이 미들웨어에서만 잡을 수 있다.

   여기서 하는 일은 딱 하나: /nodes.geojson 요청의 IP 를 읽어 구글시트(Apps Script)로
   비동기 핑을 보내고, 응답은 그대로 통과시킨다(정적 파일 서빙에 지연을 주지 않음).

   ⚠️ 이건 "차단"이 아니라 "기록"이다. 실제 DDoS 방어는 Vercel 이 플랫폼 차원에서
      기본 제공하는 공격 방어(Attack Challenge Mode)에 맡기고, 여기서는 이상 트래픽을
      나중에 시트에서 눈으로 확인할 수 있게 IP 를 남기는 것까지만 한다. */

export const config = { matcher: '/nodes.geojson' };

const TRACK_URL = process.env.VITE_TRACK_URL || '';

export default function middleware(request, context) {
	if (!TRACK_URL) return;

	const forwardedFor = request.headers.get('x-forwarded-for') || '';
	const ip = request.headers.get('x-real-ip') || forwardedFor.split(',')[0].trim() || 'unknown';

	const pingUrl = `${TRACK_URL}?event=geojson-fetch&ip=${encodeURIComponent(ip)}`;
	context.waitUntil(fetch(pingUrl).catch(() => {}));
}
