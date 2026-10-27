import { useEffect, type RefObject } from 'react';

/** Dismiss the recipient popup without changing its audience selection. */
export const useAudienceMenuDismissal = (
	open: boolean,
	rootRef: RefObject<HTMLElement | null>,
	setOpen: (open: boolean) => void
): void => {
	useEffect(() => {
		if (!open) return;
		const root = rootRef.current;
		const active = document.activeElement;
		const opener =
			active instanceof HTMLElement &&
			root?.contains(active) &&
			active.matches('button[aria-haspopup]')
				? active
				: root?.querySelector<HTMLButtonElement>(
						'button[aria-haspopup]'
					);
		const onOutsideClick = (event: MouseEvent) => {
			const target = event.target;
			if (target instanceof Node && !rootRef.current?.contains(target))
				setOpen(false);
		};
		const onEscape = (event: KeyboardEvent) => {
			if (event.key !== 'Escape' || event.defaultPrevented) return;
			event.preventDefault();
			event.stopPropagation();
			setOpen(false);
			if (opener?.isConnected) opener.focus();
		};
		document.addEventListener('mousedown', onOutsideClick);
		// Consume the popup's Escape before the enclosing conversation handles it.
		document.addEventListener('keydown', onEscape, true);
		return () => {
			document.removeEventListener('mousedown', onOutsideClick);
			document.removeEventListener('keydown', onEscape, true);
		};
	}, [open, rootRef, setOpen]);
};
