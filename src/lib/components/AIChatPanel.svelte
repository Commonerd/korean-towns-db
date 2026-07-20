<script>
	let {
		open = false,
		messages = [],
		loading = false,
		onSend = () => {},
		onClose = () => {}
	} = $props();

	let inputValue = $state('');
	let bodyEl;

	function submit() {
		const msg = inputValue.trim();
		if (!msg) return;
		inputValue = '';
		onSend(msg);
	}
	function onKey(e) {
		if (e.key === 'Enter') submit();
	}

	// 새 메시지/로딩 시 하단으로 스크롤
	$effect(() => {
		messages.length;
		loading;
		if (bodyEl) bodyEl.scrollTop = bodyEl.scrollHeight;
	});
</script>

<div
	class="fixed right-0 top-0 h-full w-full sm:w-96 bg-white shadow-[-10px_0_20px_rgba(0,0,0,0.1)] transition-transform duration-300 z-[1000] flex flex-col border-l border-slate-200 {open
		? ''
		: 'translate-x-full'}"
>
	<div class="px-4 py-3 bg-purple-600 text-white flex justify-between items-center shadow-sm z-10">
		<div class="flex items-center gap-2 font-bold">
			<i class="fa-solid fa-robot"></i>
			<span>AI 연구 보조원</span>
		</div>
		<button
			onclick={onClose}
			aria-label="AI 보조원 닫기"
			class="hover:bg-purple-700 w-8 h-8 rounded-full flex items-center justify-center transition-colors"
		>
			<i class="fa-solid fa-xmark"></i>
		</button>
	</div>

	<div bind:this={bodyEl} class="flex-1 overflow-y-auto p-4 bg-slate-50 flex flex-col scroll-smooth">
		{#each messages as m, i (i)}
			<div class="flex gap-3 mb-4 {m.role === 'user' ? 'flex-row-reverse' : ''}">
				<div
					class="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm {m.role ===
					'user'
						? 'bg-slate-200 text-slate-600'
						: 'bg-purple-100 text-purple-600 border border-purple-200'}"
				>
					<i class="fa-solid {m.role === 'user' ? 'fa-user' : 'fa-robot'}"></i>
				</div>
				<div
					class="p-3 max-w-[75%] text-sm shadow-sm leading-relaxed {m.role === 'user'
						? 'bg-primary text-white rounded-l-lg rounded-br-lg'
						: 'bg-slate-100 text-slate-800 rounded-r-lg rounded-bl-lg border border-slate-200'}"
				>
					{@html m.html}
				</div>
			</div>
		{/each}

		{#if loading}
			<div class="flex gap-3 mb-4">
				<div
					class="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm bg-purple-100 text-purple-600 border border-purple-200"
				>
					<i class="fa-solid fa-robot"></i>
				</div>
				<div
					class="p-3 bg-slate-100 text-slate-500 rounded-r-lg rounded-bl-lg border border-slate-200 text-sm flex items-center gap-2"
				>
					<i class="fa-solid fa-circle-notch fa-spin"></i> 관계망 사료 교차 검증 중...
				</div>
			</div>
		{/if}
	</div>

	<div class="p-3 border-t border-slate-200 bg-white">
		<div class="relative">
			<input
				type="text"
				bind:value={inputValue}
				onkeypress={onKey}
				placeholder="역사적 배경이나 추가 정보를 물어보세요..."
				class="w-full pl-4 pr-12 py-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-shadow bg-slate-50"
			/>
			<button
				onclick={submit}
				aria-label="메시지 보내기"
				class="absolute right-2 top-2 w-8 h-8 bg-purple-100 text-purple-600 hover:bg-purple-600 hover:text-white rounded flex items-center justify-center transition-colors"
			>
				<i class="fa-solid fa-paper-plane text-xs"></i>
			</button>
		</div>
		<div class="text-[10px] text-center text-slate-400 mt-2">
			Gemini AI가 제공하는 정보는 참고용으로 교차 검증이 필요합니다.
		</div>
	</div>
</div>
