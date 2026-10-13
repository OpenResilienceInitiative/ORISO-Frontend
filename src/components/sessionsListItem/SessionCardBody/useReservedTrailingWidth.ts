import * as React from 'react';

/**
 * Measures the trailing marks into `--card-trailing-width`: they are translated and
 * some arrive late, so CSS cannot know their width.
 */
export const useReservedTrailingWidth = () => {
	const bodyRef = React.useRef<HTMLDivElement>(null);
	const trailingRef = React.useRef<HTMLDivElement>(null);

	React.useLayoutEffect(() => {
		const body = bodyRef.current;
		const trailing = trailingRef.current;
		if (!body || !trailing) {
			return undefined;
		}
		const reserve = (width: number) => {
			body.style.setProperty('--card-trailing-width', `${width}px`);
		};
		// Layout widths only: rows scale in on arrival, so a painted width would be ~2 % short.
		// `offsetWidth` ignores transforms; the observer refines to the fractional size.
		reserve(trailing.offsetWidth);
		if (typeof ResizeObserver === 'undefined') {
			return undefined;
		}
		const observer = new ResizeObserver(([entry]) => {
			const size = entry?.borderBoxSize?.[0];
			reserve(size ? size.inlineSize : trailing.offsetWidth);
		});
		observer.observe(trailing);
		return () => observer.disconnect();
	}, []);

	return { bodyRef, trailingRef };
};
