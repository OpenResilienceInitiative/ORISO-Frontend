import * as React from 'react';

/**
 * The session card's preview wraps around a float that keeps its lines clear
 * of the trailing marks (Mail, Live Chat, a supervision chip, the team
 * badge …). Those marks are translated and some arrive late, so their width
 * is not known to CSS. This hook measures the trailing group and hands the
 * width to the stylesheet as `--card-trailing-width` on the card body, and
 * keeps it current when the group changes size.
 *
 * `enabled` is false for the rail and group-chat renders, which have no body.
 */
export const useReservedTrailingWidth = (enabled: boolean) => {
	const bodyRef = React.useRef<HTMLDivElement>(null);
	const trailingRef = React.useRef<HTMLDivElement>(null);

	React.useLayoutEffect(() => {
		const body = bodyRef.current;
		const trailing = trailingRef.current;
		if (!enabled || !body || !trailing) {
			return undefined;
		}
		const reserve = () => {
			body.style.setProperty(
				'--card-trailing-width',
				`${trailing.getBoundingClientRect().width}px`
			);
		};
		reserve();
		if (typeof ResizeObserver === 'undefined') {
			return undefined;
		}
		const observer = new ResizeObserver(reserve);
		observer.observe(trailing);
		return () => observer.disconnect();
	}, [enabled]);

	return { bodyRef, trailingRef };
};
