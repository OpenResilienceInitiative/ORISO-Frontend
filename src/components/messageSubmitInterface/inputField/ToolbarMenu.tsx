import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { autoUpdate, computePosition, offset, shift } from '@floating-ui/dom';
import type { MenuDirection } from './menuDirection';

export interface ToolbarMenuItem {
	key: string;
	label: string;
	glyph?: React.ReactNode;
	selected?: boolean;
	/**
	 * True when the entry is one of a set the caret can only be in one of
	 * (text style, list style) — announced as a radio rather than a toggle.
	 */
	exclusive?: boolean;
	onSelect: () => void;
}

export interface ToolbarMenuProps {
	items: ToolbarMenuItem[];
	direction: MenuDirection;
	onClose: () => void;
	ariaLabel: string;
	/** The toolbar button the menu is anchored to. */
	anchorEl: HTMLElement | null;
}

/**
 * Floating toolbar menu (Figma 7086:46390). Prefers to open bottom-to-top when
 * the composer is docked/minimized or on mobile and top-down in fullscreen, but
 * it is positioned with floating-ui and portalled to the body so it flips into
 * view instead of clipping off-screen or behind the toolbar's overflow.
 */
export const ToolbarMenu = ({
	items,
	direction,
	onClose,
	ariaLabel,
	anchorEl
}: ToolbarMenuProps) => {
	const menuRef = useRef<HTMLDivElement | null>(null);
	const [position, setPosition] = useState<{ top: number; left: number }>({
		top: -9999,
		left: -9999
	});

	useEffect(() => {
		const menuEl = menuRef.current;
		if (!anchorEl || !menuEl) {
			return;
		}
		return autoUpdate(anchorEl, menuEl, () => {
			computePosition(anchorEl, menuEl, {
				// The Figma direction rule is authoritative: docked/mobile menus
				// always open upward, the maximized editor opens them downward.
				// No flip() — flipping against the rule renders the menu over
				// the editor content instead of on top of the toolbar.
				placement: direction === 'up' ? 'top-start' : 'bottom-start',
				middleware: [offset(6), shift({ padding: 8 })]
			}).then(({ x, y }) => setPosition({ left: x, top: y }));
		});
	}, [anchorEl, direction]);

	useEffect(() => {
		const handlePointerDown = (event: PointerEvent) => {
			const target = event.target as Node | null;
			if (
				menuRef.current &&
				target &&
				!menuRef.current.contains(target) &&
				!(target as HTMLElement).closest?.(
					'.composerToolbar__menuAnchor'
				)
			) {
				onClose();
			}
		};
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				onClose();
			}
		};
		document.addEventListener('pointerdown', handlePointerDown);
		document.addEventListener('keydown', handleKeyDown);
		return () => {
			document.removeEventListener('pointerdown', handlePointerDown);
			document.removeEventListener('keydown', handleKeyDown);
		};
	}, [onClose]);

	if (typeof document === 'undefined') {
		return null;
	}

	return createPortal(
		<div
			ref={menuRef}
			role="menu"
			aria-label={ariaLabel}
			className={`composerToolbar__menu composerToolbar__menu--${direction}`}
			style={{ top: position.top, left: position.left }}
		>
			{items.map((item) => (
				<button
					key={item.key}
					type="button"
					// Entries that carry a selected state are a choice, not a
					// one-shot command: announce them as such so a screen
					// reader says which text style the caret is in (#995).
					role={
						item.selected === undefined
							? 'menuitem'
							: item.exclusive
								? 'menuitemradio'
								: 'menuitemcheckbox'
					}
					aria-checked={
						item.selected === undefined ? undefined : item.selected
					}
					className={[
						'composerToolbar__menuItem',
						item.selected && 'composerToolbar__menuItem--selected'
					]
						.filter(Boolean)
						.join(' ')}
					onClick={() => {
						item.onSelect();
						onClose();
					}}
				>
					{item.glyph && (
						<span
							className="composerToolbar__menuGlyph"
							aria-hidden
						>
							{item.glyph}
						</span>
					)}
					<span>{item.label}</span>
					{item.selected && (
						<span
							className="composerToolbar__menuCheck"
							aria-hidden
						>
							✓
						</span>
					)}
				</button>
			))}
		</div>,
		document.body
	);
};
