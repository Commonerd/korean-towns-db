<script>
	let { syncing = false, onSync = () => {}, onToggleAI = () => {} } = $props();
</script>

<header class="bg-slate-50 border-b border-slate-200/80 shadow-sm z-20 relative flex-shrink-0">
	<div class="px-4 py-3 flex justify-between items-center max-w-full">
		<div class="flex items-center gap-3">
			<a href="/" class="flex items-center gap-3">
				<img
					src="/favicon.png"
					alt="코리아타운 DB 로고"
					class="w-8 h-8 rounded-lg object-cover border border-slate-200 shadow-sm"
				/>
				<div>
					<h1 class="font-serif font-bold text-primary leading-tight map-title">코리아타운 DB</h1>
					<p class="text-slate-500 tracking-wider map-subtitle">
						기억의 복원 : 세계 속 한인 마을의 과거와 현재를 지도 위에
					</p>
				</div>
			</a>
		</div>

		<div class="hidden sm:flex items-center gap-4">
			<button
				onclick={onSync}
				disabled={syncing}
				class="bg-green-600 hover:bg-green-700 disabled:opacity-70 text-white text-sm font-medium py-2 px-4 rounded-md transition duration-200 flex items-center gap-2 shadow-sm"
			>
				{#if syncing}
					<i class="fa-solid fa-circle-notch fa-spin"></i> 동기화 중...
				{:else}
					<i class="fa-brands fa-google"></i> 실시간 동기화
				{/if}
			</button>
			<button
				onclick={onToggleAI}
				class="bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium py-2 px-4 rounded-md transition duration-200 flex items-center gap-2 shadow-sm"
			>
				<i class="fa-solid fa-wand-magic-sparkles"></i> AI 보조원
			</button>
		</div>
	</div>
</header>

<style>
	.map-title {
		font-size: 1.15rem;
	}
	.map-subtitle {
		font-size: 0.7rem;
		letter-spacing: -0.02em;
	}
	@media (max-width: 640px) {
		.map-title {
			font-size: 1rem;
		}
		.map-subtitle {
			font-size: 0.65rem;
			white-space: normal;
			line-height: 1.2;
		}
	}
</style>
