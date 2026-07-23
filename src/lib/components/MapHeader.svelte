<script>
	import { t } from '$lib/i18n/store.svelte.js';
	import LanguageSwitcher from './LanguageSwitcher.svelte';
	let { syncing = false, onSync = () => {}, onToggleAI = () => {} } = $props();
</script>

<header class="bg-slate-50 border-b border-slate-200/80 shadow-sm z-20 relative flex-shrink-0">
	<div class="px-4 py-3 flex justify-between items-center max-w-full">
		<div class="flex items-center gap-3">
			<a href="/" class="flex items-center gap-3">
				<img
					src="/favicon.png"
					alt={t('brand.logoAlt')}
					class="w-8 h-8 rounded-lg object-cover border border-slate-200 shadow-sm"
				/>
				<div>
					<h1 class="font-serif font-bold text-primary leading-tight map-title">{t('brand.name')}</h1>
					<p class="text-slate-500 tracking-wider map-subtitle">
						{t('mapHeader.subtitle')}
					</p>
				</div>
			</a>
		</div>

		<div class="flex items-center gap-2 sm:gap-4">
			<button
				onclick={onSync}
				disabled={syncing}
				class="hidden sm:flex bg-green-600 hover:bg-green-700 disabled:opacity-70 text-white text-sm font-medium py-2 px-4 rounded-md transition duration-200 items-center gap-2 shadow-sm"
			>
				{#if syncing}
					<i class="fa-solid fa-circle-notch fa-spin"></i> {t('header.syncing')}
				{:else}
					<i class="fa-brands fa-google"></i> {t('header.sync')}
				{/if}
			</button>
			<button
				onclick={onToggleAI}
				class="hidden sm:flex bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium py-2 px-4 rounded-md transition duration-200 items-center gap-2 shadow-sm"
			>
				<i class="fa-solid fa-wand-magic-sparkles"></i> {t('header.ai')}
			</button>
			<LanguageSwitcher variant="compact" />
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
