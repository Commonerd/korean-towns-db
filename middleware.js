/* ====== Vercel Routing Middleware ======
   프레임워크 무관하게 프로젝트 루트에 두면 Vercel 이 매 요청 전에 실행한다.
   두 경로를 맡는다.

   /nodes.geojson  실제 파일 요청. adapter-static 배포본에서는 그냥 정적 파일이라
                   SvelteKit 코드(+server.js)가 실 요청에 관여하지 못한다 — 여기서만
                   "누가 실제로 받아갔는지"를 잡을 수 있다. 기록만 하고 그대로 통과시킨다.

   /track          사이트 버튼 클릭 핑의 중계소. 브라우저가 Apps Script 로 직접 쏘면
                   (1) Vercel 을 안 거쳐 IP 를 붙일 수 없고 (2) Apps Script URL 이
                   클라이언트 번들에 노출돼 누구나 가짜 로그를 넣을 수 있다.
                   그래서 브라우저는 같은 오리진의 /track 으로만 보내고, 실제 시트 주소는
                   서버(여기)만 안다.

   ⚠️ 이건 "차단"이 아니라 "기록"이다. 실제 DDoS 방어는 Vercel 이 플랫폼 차원에서
      기본 제공하는 공격 방어에 맡기고, 여기서는 이상 트래픽을 나중에 시트에서 눈으로
      확인할 수 있게 IP·출처를 남기는 것까지만 한다. */

export const config = { matcher: ['/nodes.geojson', '/track'] };

/* 시트(Apps Script 웹앱) 주소. 클라이언트에 노출되지 않으므로 VITE_ 접두어가 필요 없다.
   이미 VITE_TRACK_URL 로 등록해 뒀다면 그대로 인식한다. */
const TRACK_URL = process.env.TRACK_URL || process.env.VITE_TRACK_URL || '';

/* 사이트에서 보내는 클릭 이벤트만 받는다(임의 문자열로 시트를 더럽히지 못하게). */
const CLIENT_EVENTS = ['download-file', 'copy-url'];

/* User-Agent 로만 정체가 드러나는 데스크톱·서버 도구들 */
const UA_TOOLS = [
	[/QGIS/i, 'QGIS'],
	[/ArcGIS|Esri/i, 'ArcGIS'],
	[/GDAL|OGR/i, 'GDAL/OGR'],
	[/Mapbox/i, 'Mapbox'],
	[/python|requests|urllib|httpx|aiohttp/i, 'Python'],
	[/curl/i, 'curl'],
	[/wget/i, 'wget'],
	[/postman/i, 'Postman'],
	[/bot|crawler|spider/i, 'bot/crawler']
];

export default function middleware(request, context) {
	const url = new URL(request.url);

	if (url.pathname === '/track') {
		const event = url.searchParams.get('event') || '';
		if (CLIENT_EVENTS.includes(event)) {
			log(request, context, event, url.searchParams.get('page') || '');
		}
		// 내용 없는 응답. sendBeacon 은 응답을 읽지 않으므로 204 로 충분하다.
		return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
	}

	// /nodes.geojson — 기록 후 반환값 없이 통과(정적 파일 서빙에 지연 없음).
	log(request, context, 'geojson-fetch', url.pathname);
}

function log(request, context, event, page) {
	if (!TRACK_URL) return;

	const params = new URLSearchParams({
		event,
		page,
		ip: clientIp(request),
		source: detectSource(request)
	});

	// waitUntil 로 백그라운드 전송 — 응답을 붙잡아 두지 않는다.
	context.waitUntil(fetch(`${TRACK_URL}?${params}`).catch(() => {}));
}

function clientIp(request) {
	const forwardedFor = request.headers.get('x-forwarded-for') || '';
	return request.headers.get('x-real-ip') || forwardedFor.split(',')[0].trim() || 'unknown';
}

/* 어느 서비스가 가져갔는지 추정한다.
   - kepler.gl·geojson.io·Felt 처럼 브라우저에서 도는 도구는 Origin/Referer 에 정체가 드러난다.
   - QGIS·GDAL·curl 처럼 브라우저 밖에서 도는 도구는 User-Agent 로만 알 수 있다. */
function detectSource(request) {
	const host = hostOf(request.headers.get('origin')) || hostOf(request.headers.get('referer'));
	if (host) return host === hostOf(request.url) ? 'self' : host;

	const ua = request.headers.get('user-agent') || '';
	for (const [pattern, name] of UA_TOOLS) {
		if (pattern.test(ua)) return name;
	}
	return ua ? ua.slice(0, 80) : 'unknown';
}

function hostOf(value) {
	try {
		return new URL(value).host;
	} catch {
		return '';
	}
}
