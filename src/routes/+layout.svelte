<script>
	import '../app.css';
	import { onMount } from 'svelte';
	import { initLocale } from '$lib/i18n/store.svelte.js';

	let { children } = $props();

	onMount(() => {
		// 하이드레이션 이후 <html lang> 을 감지된 언어로 동기화
		initLocale();
	});
</script>

{@render children()}
