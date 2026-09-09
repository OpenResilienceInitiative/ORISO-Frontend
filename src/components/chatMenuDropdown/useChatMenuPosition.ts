import { useMenuEffects } from '../../features/menu-effects/useMenuEffects';
import { CSSProperties, RefObject, useLayoutEffect, useState } from 'react';

export const getChatMenuPosition = (
	anchor: Pick<DOMRect, 'left' | 'right' | 'top'>,
	viewport: { width: number; height: number },
	menu: { width: number; height: number }
) => {
	const margin = 12;
	const gap = 8;
	const width = Math.min(
		menu.width,
		Math.max(0, viewport.width - margin * 2)
	);
	const maxHeight = Math.max(0, viewport.height - margin * 2);
	const side =
		anchor.right + gap + width <= viewport.width - margin
			? 'right'
			: 'left';
	const left = Math.max(
		margin,
		Math.min(
			side === 'right' ? anchor.right + gap : anchor.left - gap - width,
			viewport.width - width - margin
		)
	);
	const top = Math.max(
		margin,
		Math.min(
			anchor.top,
			viewport.height - Math.min(menu.height, maxHeight) - margin
		)
	);
	return {
		left,
		top,
		width,
		maxHeight,
		transformOrigin: `${side === 'right' ? 'left' : 'right'} ${Math.max(0, anchor.top - top)}px`
	};
};

/** Measure before paint so the entrance animation starts at its final anchor. */
export const useChatMenuPosition = ({
	open,
	anchorRef,
	menuRef,
	width = 301
}: {
	open: boolean;
	anchorRef: RefObject<HTMLElement | null>;
	menuRef: RefObject<HTMLElement | null>;
	width?: number;
}): CSSProperties => {
	const { motionEnabled } = useMenuEffects();
	const [position, setPosition] = useState<ReturnType<
		typeof getChatMenuPosition
	> | null>(null);
	useLayoutEffect(() => {
		if (!open) {
			setPosition(null);
			return;
		}
		let frame = 0;
		let attempts = 0;
		let cleanup = () => {};
		const attach = () => {
			const anchor = anchorRef.current;
			const menu = menuRef.current;
			if (!anchor || !menu) {
				// Portals may mount after the parent's layout effect.
				if (attempts++ < 60) frame = requestAnimationFrame(attach);
				return;
			}
			const update = () => {
				const next = getChatMenuPosition(
					anchor.getBoundingClientRect(),
					{ width: window.innerWidth, height: window.innerHeight },
					{
						width,
						height:
							menu.scrollHeight +
							menu.offsetHeight -
							menu.clientHeight
					}
				);
				setPosition((previous) =>
					JSON.stringify(previous) === JSON.stringify(next)
						? previous
						: next
				);
			};
			update();
			const observer =
				typeof ResizeObserver === 'undefined'
					? null
					: new ResizeObserver(update);
			observer?.observe(menu);
			observer?.observe(anchor);
			window.addEventListener('resize', update);
			window.addEventListener('scroll', update, true);
			cleanup = () => {
				observer?.disconnect();
				window.removeEventListener('resize', update);
				window.removeEventListener('scroll', update, true);
			};
		};
		attach();
		return () => {
			cancelAnimationFrame(frame);
			cleanup();
		};
	}, [open, anchorRef, menuRef, width]);
	return {
		animation:
			open && position && motionEnabled
				? 'oriso-menu-reveal 160ms ease-out both'
				: 'none',
		transition: 'none',
		position: 'fixed',
		right: 'auto',
		...position,
		maxWidth: 'calc(100vw - 24px)',
		overflowY: 'auto',
		visibility: open && position ? 'visible' : 'hidden'
	};
};
