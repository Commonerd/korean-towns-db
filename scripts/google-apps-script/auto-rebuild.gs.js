/**
 * 구글시트 확장 프로그램(Apps Script) — 시트 수정 시 Vercel 재빌드 트리거.
 *
 * ⚠️ 이 파일은 이 저장소(npm build)에서 실행되지 않습니다. 구글시트 자체의
 *    Apps Script 편집기에 통째로 복사해 넣는 참고용 코드입니다.
 *
 * 설치 방법
 * ─────────
 * 1. Vercel 대시보드 → 프로젝트 → Settings → Git → Deploy Hooks 에서
 *    "Create Hook" (브랜치: main 등 배포 브랜치 선택) → URL 복사.
 * 2. 구글시트 → 확장 프로그램 → Apps Script.
 * 3. 이 파일 내용을 통째로 붙여넣고, 아래 DEPLOY_HOOK_URL 값을 1번에서
 *    복사한 URL로 교체.
 * 4. 좌측 "트리거" 메뉴 → 우측 하단 "+ 트리거 추가":
 *      - 실행할 함수         : onSheetChange
 *      - 이벤트 소스         : 스프레드시트에서
 *      - 이벤트 유형         : 변경 시 (onChange)
 *    저장 시 권한 승인 화면이 뜨면 허용 (UrlFetchApp 외부 요청 권한 필요).
 * 5. (선택) testDeployHookManually 를 편집기에서 직접 실행해 후크가
 *    정상 동작하는지 먼저 확인해도 좋습니다.
 *
 * 왜 debounce 가 필요한가
 * ───────────────────────
 * onChange 는 셀 하나만 고쳐도 발생합니다. 그대로 매번 Vercel 을 호출하면
 * 시트를 몇 분간 연속 수정할 때 빌드가 수십 번 큐에 쌓입니다. 그래서
 * "마지막 수정 후 DEBOUNCE_MINUTES 분 동안 조용하면 그때 한 번만 호출"
 * 하는 방식으로 여러 번의 수정을 재빌드 1회로 합칩니다.
 */

const DEPLOY_HOOK_URL = 'https://api.vercel.com/v1/integrations/deploy/REPLACE_ME';
const DEBOUNCE_MINUTES = 10;

/** 트리거 함수. 이벤트 소스: 스프레드시트 / 이벤트 유형: 변경 시(onChange) */
function onSheetChange() {
	const props = PropertiesService.getScriptProperties();
	props.setProperty('lastEditAt', String(Date.now()));

	// 이미 예약된 지연 실행이 있으면 새로 만들지 않는다 (중복 트리거 방지)
	if (props.getProperty('pending') === 'true') return;
	props.setProperty('pending', 'true');

	ScriptApp.newTrigger('checkAndDeploy')
		.timeBased()
		.after(DEBOUNCE_MINUTES * 60 * 1000)
		.create();
}

/** debounce 타이머가 만료되면 실행 — 그사이 새 편집이 없었을 때만 배포 */
function checkAndDeploy() {
	const props = PropertiesService.getScriptProperties();
	const lastEdit = Number(props.getProperty('lastEditAt') || 0);
	const idleMs = Date.now() - lastEdit;
	const windowMs = DEBOUNCE_MINUTES * 60 * 1000;

	// 대기 중에 또 편집이 들어왔으면, 남은 시간만큼 다시 예약하고 이번엔 배포하지 않는다
	if (idleMs < windowMs - 5000) {
		deleteTriggersFor_('checkAndDeploy');
		ScriptApp.newTrigger('checkAndDeploy')
			.timeBased()
			.after(windowMs - idleMs)
			.create();
		return;
	}

	deleteTriggersFor_('checkAndDeploy');
	props.deleteProperty('pending');

	const res = UrlFetchApp.fetch(DEPLOY_HOOK_URL, { method: 'post', muteHttpExceptions: true });
	props.setProperty('lastDeployAt', String(Date.now()));
	Logger.log('Vercel deploy hook 호출: ' + res.getResponseCode());
}

function deleteTriggersFor_(handlerName) {
	ScriptApp.getProjectTriggers().forEach((t) => {
		if (t.getHandlerFunction() === handlerName) ScriptApp.deleteTrigger(t);
	});
}

/** 수동 테스트용 — 편집기에서 이 함수를 직접 "실행"해 후크가 잘 도는지 즉시 확인 */
function testDeployHookManually() {
	const res = UrlFetchApp.fetch(DEPLOY_HOOK_URL, { method: 'post', muteHttpExceptions: true });
	Logger.log(res.getResponseCode() + ' ' + res.getContentText());
}
