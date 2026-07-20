/* 스크롤 진입 시 .is-visible 부여 (기존 IntersectionObserver 로직 이식) */
export function reveal(node) {
	node.classList.add('reveal');

	const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	if (prefersReduced || !('IntersectionObserver' in window)) {
		node.classList.add('is-visible');
		return;
	}

	const io = new IntersectionObserver(
		(entries) => {
			entries.forEach((entry) => {
				if (entry.isIntersecting) {
					entry.target.classList.add('is-visible');
					io.unobserve(entry.target);
				}
			});
		},
		{ threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
	);
	io.observe(node);

	return {
		destroy() {
			io.disconnect();
		}
	};
}
