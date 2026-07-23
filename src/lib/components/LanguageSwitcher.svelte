<script>
	import { SUPPORTED, LOCALE_NAMES, getLocale, setLocale, t } from '$lib/i18n/store.svelte.js';

	// variant: 'light' (밝은 배경, 랜딩) | 'compact' (지도 헤더)
	let { variant = 'light' } = $props();

	let open = $state(false);
	let rootEl;

	const current = $derived(getLocale());

	function choose(l) {
		setLocale(l);
		open = false;
	}

	function onWindowClick(e) {
		if (open && rootEl && !rootEl.contains(e.target)) open = false;
	}
</script>

<svelte:window onclick={onWindowClick} />

<div class="lang-switch" class:is-compact={variant === 'compact'} bind:this={rootEl}>
	<button
		type="button"
		class="lang-btn"
		aria-haspopup="listbox"
		aria-expanded={open}
		aria-label={t('lang.switch')}
		onclick={() => (open = !open)}
	>
		<i class="fa-solid fa-globe"></i>
		<span class="lang-current">{LOCALE_NAMES[current]}</span>
		<i class="fa-solid fa-chevron-down lang-caret" class:open></i>
	</button>

	{#if open}
		<ul class="lang-menu" role="listbox">
			{#each SUPPORTED as l (l)}
				<li>
					<button
						type="button"
						role="option"
						aria-selected={l === current}
						class="lang-option"
						class:active={l === current}
						onclick={() => choose(l)}
					>
						{LOCALE_NAMES[l]}
						{#if l === current}<i class="fa-solid fa-check"></i>{/if}
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.lang-switch {
		position: relative;
		flex-shrink: 0;
	}
	.lang-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.4em;
		padding: 0.5em 0.85em;
		border-radius: 999px;
		border: 1px solid var(--line, #e2e8f0);
		background: #fff;
		color: var(--navy, #1e3a8a);
		font-size: 0.8rem;
		font-weight: 600;
		cursor: pointer;
		white-space: nowrap;
		transition: background 0.15s ease, border-color 0.15s ease;
	}
	.lang-btn:hover {
		background: #f1f5f9;
	}
	.lang-caret {
		font-size: 0.6rem;
		transition: transform 0.2s ease;
	}
	.lang-caret.open {
		transform: rotate(180deg);
	}
	.lang-menu {
		position: absolute;
		top: calc(100% + 6px);
		right: 0;
		z-index: 1200;
		min-width: 140px;
		margin: 0;
		padding: 6px;
		list-style: none;
		background: #fff;
		border: 1px solid var(--line, #e2e8f0);
		border-radius: 12px;
		box-shadow: 0 12px 28px rgba(0, 0, 0, 0.16);
	}
	.lang-option {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.6em;
		width: 100%;
		padding: 0.55em 0.7em;
		border: none;
		background: transparent;
		border-radius: 8px;
		font-size: 0.84rem;
		color: #334155;
		cursor: pointer;
		text-align: left;
		white-space: nowrap;
	}
	.lang-option:hover {
		background: #f1f5f9;
	}
	.lang-option.active {
		color: var(--navy, #1e3a8a);
		font-weight: 700;
	}

	/* 지도 헤더용 컴팩트 변형 */
	.is-compact .lang-btn {
		padding: 0.45em 0.7em;
		font-size: 0.75rem;
	}
	.is-compact .lang-current {
		display: none;
	}
	@media (min-width: 640px) {
		.is-compact .lang-current {
			display: inline;
		}
	}
</style>
