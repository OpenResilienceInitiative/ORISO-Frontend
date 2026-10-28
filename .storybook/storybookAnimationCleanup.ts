// Storybook 10.6.3 portable runStory does not release pauseAnimations' style
// when its strict addon afterEach throws. Own only new exact pinned nodes;
// keep them through the audit and awaited verification, then release them.
const pauseStyleText = `*, *:before, *:after {
    animation-delay: 0s !important;
    animation-direction: reverse !important;
    animation-play-state: paused !important;
    transition: none !important;
  }`;

export const captureStorybookAnimationCleanup = () => {
	const preexisting = new Set(document.head.querySelectorAll('style'));
	const owned = new Set<HTMLStyleElement>();
	const collect = (records: MutationRecord[]) => {
		records.forEach((record) =>
			record.addedNodes.forEach((node) => {
				if (
					node instanceof HTMLStyleElement &&
					!preexisting.has(node) &&
					node.textContent === pauseStyleText
				)
					owned.add(node);
			})
		);
	};
	const observer = new MutationObserver(collect);
	observer.observe(document.head, { childList: true });
	let finished = false;
	return () => {
		if (finished) return;
		finished = true;
		collect(observer.takeRecords());
		observer.disconnect();
		owned.forEach((node) => {
			if (node.textContent === pauseStyleText) node.remove();
		});
		owned.clear();
	};
};
