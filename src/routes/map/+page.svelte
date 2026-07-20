<script>
	import { onMount } from 'svelte';
	import MapHeader from '$lib/components/MapHeader.svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import MapView from '$lib/components/MapView.svelte';
	import AIChatPanel from '$lib/components/AIChatPanel.svelte';
	import Legend from '$lib/components/Legend.svelte';
	import DarkMapControl from '$lib/components/DarkMapControl.svelte';
	import ZoomHint from '$lib/components/ZoomHint.svelte';
	import { filterData } from '$lib/data/filter.js';
	import { loadGoogleSheetsData, detectYearRange } from '$lib/data/sheets.js';
	import { fetchGeminiResponse, parseSimpleMarkdown } from '$lib/ai/gemini.js';
	import { escapeHtml } from '$lib/util.js';

	/* ====== 상태 ====== */
	let rawData = $state([]);
	let loading = $state(true);

	let filter = $state('all');
	let search = $state('');
	let selectedTownName = $state(null);

	let yearEnabled = $state(false);
	let yearMin = $state(1860);
	let yearMax = $state(2026);
	let yearRangeMin = $state(1860);
	let yearRangeMax = $state(2026);

	let darkOpacity = $state(0);
	let syncing = $state(false);
	let sidebarCollapsed = $state(true);
	let zoom = $state(5);

	let chatOpen = $state(false);
	let messages = $state([]);
	let chatLoading = $state(false);
	let chatHistory = []; // Gemini API 포맷 (비반응형)

	let toast = $state(null);
	let mapView;

	const searchLower = $derived(search.toLowerCase());
	const filtered = $derived(
		filterData(rawData, {
			filter,
			search: searchLower,
			yearEnabled,
			yearMin,
			yearMax,
			yearRangeMin,
			yearRangeMax
		})
	);
	const dark = $derived(darkOpacity > 0.5);

	/* ====== 데이터 로드 ====== */
	async function fetchLatestAndRender(firstLoad = false) {
		const data = await loadGoogleSheetsData();
		rawData = data;
		const r = detectYearRange(data);
		if (r) {
			yearRangeMin = r.min;
			yearRangeMax = r.max;
			// 최초 로드 시에만 필터 범위를 전체로 초기화(폴링 때 사용자 선택 보존)
			if (firstLoad) {
				yearMin = r.min;
				yearMax = r.max;
			}
		}
	}

	async function sync() {
		syncing = true;
		try {
			await fetchLatestAndRender(false);
			showToast('DB의 최신 데이터가 반영되었습니다.');
		} catch (err) {
			showToast('동기화에 실패했습니다.', true);
		} finally {
			syncing = false;
		}
	}

	let toastTimer;
	function showToast(msg, isError = false) {
		toast = { msg, isError };
		if (toastTimer) clearTimeout(toastTimer);
		toastTimer = setTimeout(() => (toast = null), 2600);
	}

	onMount(() => {
		document.body.classList.add('map-page');

		(async () => {
			try {
				await fetchLatestAndRender(true);
			} catch (e) {
				console.error(e);
			} finally {
				loading = false;
			}
		})();

		const poll = setInterval(() => fetchLatestAndRender(false).catch(() => {}), 30000);

		return () => {
			clearInterval(poll);
			if (toastTimer) clearTimeout(toastTimer);
			document.body.classList.remove('map-page');
		};
	});

	/* ====== 사이드바 상호작용 ====== */
	function onSearch(val) {
		search = val;
		if (!val) selectedTownName = null;
	}
	function onFilterChange(type) {
		filter = type;
		selectedTownName = null;
	}
	function onYearToggle() {
		yearEnabled = !yearEnabled;
	}
	function onYearChange(min, max) {
		yearMin = min;
		yearMax = max;
	}
	function onFocus(item) {
		if (item.type === '마을') selectedTownName = item.name;
		else if (item.relatedTown) selectedTownName = item.relatedTown;
		mapView?.focus(item);
	}
	function onClearSelection() {
		selectedTownName = null;
	}
	function onSelectTown(name) {
		selectedTownName = name;
	}
	function toggleSidebar() {
		sidebarCollapsed = !sidebarCollapsed;
	}

	/* ====== AI 챗 ====== */
	function pushAssistant(html) {
		messages = [...messages, { role: 'assistant', html }];
	}
	function pushUser(display) {
		messages = [...messages, { role: 'user', html: escapeHtml(display) }];
	}

	function toggleAIChat() {
		chatOpen = !chatOpen;
		if (chatOpen && messages.length === 0) {
			pushAssistant(
				"안녕하세요! '코리아타운 DB' 연구 보조원입니다. 지도에서 마을을 클릭하시면 종속된 조직·인물 관계망이 펼쳐집니다. 궁금한 역사적 사실을 물어보세요!"
			);
		}
	}

	async function callGemini(modelPrompt) {
		chatHistory.push({ role: 'user', parts: [{ text: modelPrompt }] });
		chatLoading = true;
		const res = await fetchGeminiResponse(chatHistory, rawData);
		chatLoading = false;
		if (res.status === 'ok') {
			chatHistory.push({ role: 'model', parts: [{ text: res.text }] });
			pushAssistant(parseSimpleMarkdown(res.text));
		} else {
			pushAssistant(res.text);
		}
	}

	function sendMessage(text) {
		pushUser(text);
		callGemini(text);
	}

	function askAI(id) {
		const item = rawData.find((d) => d.id === id);
		if (!item) return;
		if (!chatOpen) toggleAIChat();

		let relationContext = '';
		if (item.type === '마을') {
			const childOrgs = rawData
				.filter((d) => d.type === '조직' && d.relatedTown === item.name)
				.map((d) => d.name);
			const childPers = rawData
				.filter((d) => d.type === '인물' && d.relatedTown === item.name)
				.map((d) => d.name);
			relationContext = ` 이 마을에 종속된 조직: [${childOrgs.join(', ')}]. 인물: [${childPers.join(', ')}].`;
		} else if (item.relatedTown) {
			relationContext = ` 이 대상은 '${item.relatedTown}' 한인 마을 공간에 종속되어 활동했습니다.`;
		}
		let attrContext = '';
		if (item.type === '조직' && item.orgType) attrContext += ` 조직 유형: ${item.orgType}.`;
		if (item.type === '인물') {
			if (item.nationality) attrContext += ` 국적: ${item.nationality}.`;
			if (item.job) attrContext += ` 직업: ${item.job}.`;
		}

		const prompt = `'${item.name}'(${item.type})에 대해 학술적·역사적 배경을 자세히 설명해 줘. (DB 기초 정보: ${item.description}).${attrContext}${relationContext}`;
		pushUser(`'${item.name}' 관계망에 대해 자세한 학술 해설을 부탁합니다.`);
		callGemini(prompt);
	}
</script>

<svelte:head>
	<title>코리아타운 DB - 기억의 복원</title>
	<meta
		name="description"
		content="코리아타운 DB의 지도 페이지에서 세계 한인 마을의 연결망과 기록을 탐색할 수 있습니다."
	/>
	<meta name="keywords" content="코리아타운, 지도, 한인마을, 네트워크, 재외동포" />
	<link rel="canonical" href="https://korean-towns-db.vercel.app/map/" />
	<meta property="og:type" content="website" />
	<meta property="og:locale" content="ko_KR" />
	<meta property="og:site_name" content="코리아타운 DB" />
	<meta property="og:title" content="코리아타운 DB - 기억의 복원" />
	<meta property="og:description" content="지도에서 세계 한인 마을의 연결망과 기록을 탐색해 보세요." />
	<meta property="og:url" content="https://korean-towns-db.vercel.app/map/" />
	<meta property="og:image" content="https://korean-towns-db.vercel.app/resources/images/koreantown1.png" />
	<meta property="og:image:alt" content="코리아타운 DB 지도 페이지 미리보기" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="코리아타운 DB - 기억의 복원" />
	<meta name="twitter:description" content="지도에서 세계 한인 마을의 연결망과 기록을 탐색해 보세요." />
	<meta name="twitter:image" content="https://korean-towns-db.vercel.app/resources/images/koreantown1.png" />
	{@html `<script type="application/ld+json">${JSON.stringify({
		'@context': 'https://schema.org',
		'@type': 'WebPage',
		name: '코리아타운 DB 지도',
		url: 'https://korean-towns-db.vercel.app/map/',
		description: '세계 한인 마을의 연결망과 기록을 지도에서 탐색할 수 있는 페이지입니다.',
		inLanguage: 'ko'
	})}<\/script>`}
</svelte:head>

<div class="h-screen flex flex-col text-slate-800">
	<MapHeader {syncing} onSync={sync} onToggleAI={toggleAIChat} />

	<main class="flex-1 flex flex-col md:flex-row overflow-hidden relative">
		<Sidebar
			{rawData}
			filteredData={filtered}
			{selectedTownName}
			{filter}
			{search}
			{loading}
			{yearEnabled}
			{yearMin}
			{yearMax}
			{yearRangeMin}
			{yearRangeMax}
			collapsed={sidebarCollapsed}
			{onSearch}
			{onFilterChange}
			{onYearToggle}
			{onYearChange}
			{onFocus}
			onAskAI={askAI}
			{onClearSelection}
			onCollapse={toggleSidebar}
		/>

		<div class="flex-1 relative h-[60vh] md:h-full">
			<MapView
				bind:this={mapView}
				{rawData}
				{filter}
				search={searchLower}
				{selectedTownName}
				{yearEnabled}
				{yearMin}
				{yearMax}
				{yearRangeMin}
				{yearRangeMax}
				{darkOpacity}
				{onSelectTown}
				onAskAI={askAI}
				onZoom={(z) => (zoom = z)}
			/>

			<button
				onclick={toggleSidebar}
				title="검색 패널 열기/닫기"
				class="sidebar-toggle-btn"
				class:ring-2={sidebarCollapsed}
				class:ring-primary={sidebarCollapsed}
			>
				<i class="fa-solid fa-bars"></i>
			</button>

			<ZoomHint {zoom} {dark} />
			<DarkMapControl value={darkOpacity} onChange={(v) => (darkOpacity = v)} />
			<Legend {dark} />
		</div>
	</main>

	<AIChatPanel
		open={chatOpen}
		{messages}
		loading={chatLoading}
		onSend={sendMessage}
		onClose={toggleAIChat}
	/>

	{#if toast}
		<div class="toast" class:is-error={toast.isError}>{toast.msg}</div>
	{/if}
</div>

<style>
	.sidebar-toggle-btn {
		position: absolute;
		top: 96px;
		left: 12px;
		z-index: 900;
		width: 36px;
		height: 36px;
		border-radius: 8px;
		background: rgba(255, 255, 255, 0.97);
		border: 1px solid #e2e8f0;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		display: flex;
		align-items: center;
		justify-content: center;
		color: #1e3a8a;
		font-size: 15px;
		cursor: pointer;
		transition:
			background 0.2s,
			transform 0.2s;
	}
	.sidebar-toggle-btn:hover {
		background: #f1f5f9;
	}
	.sidebar-toggle-btn:active {
		transform: scale(0.94);
	}

	.toast {
		position: fixed;
		top: 80px;
		right: 20px;
		z-index: 9999;
		background: #16a34a;
		color: white;
		padding: 10px 18px;
		border-radius: 8px;
		font-size: 13px;
		box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
	}
	.toast.is-error {
		background: #dc2626;
	}
</style>
