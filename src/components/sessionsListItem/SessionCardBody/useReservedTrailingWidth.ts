import * as React from 'react';

/**
 * The session card's preview wraps around a float that keeps its lines clear
 * of the trailing marks (Mail, Live Chat, a supervision chip, the team
 * badge …). Those marks are translated and some arrive late, so their width
 * is not known to CSS. This hook measures the trailing group and hands the
 * width to the stylesheet as `--card-trailing-width` on the card body, and
 * keeps it current when the group changes size.
 *
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
		// Layout widths only. The list scales every row in on arrival
		// (0.98 → 1); a painted width read during that entrance is ~2 %
		// short, and nothing re-measures when the scale ends, so the text
		// crept up to the marks. `offsetWidth` ignores transforms; the
		// observer then refines it to the fractional border-box size.
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
