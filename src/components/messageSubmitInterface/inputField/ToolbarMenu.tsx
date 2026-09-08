import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
	autoUpdate,
	computePosition,
	flip,
	offset,
	shift,
	size
} from '@floating-ui/dom';
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
	const [maxHeight, setMaxHeight] = useState<number | null>(null);
	const [placedDirection, setPlacedDirection] =
		useState<MenuDirection>(direction);

	useEffect(() => {
		const menuEl = menuRef.current;
		if (!anchorEl || !menuEl) {
			return;
		}
		return autoUpdate(anchorEl, menuEl, () => {
			computePosition(anchorEl, menuEl, {
				/*
				 * The Figma rule (node 7086:46390) is the *preference*, not the
				 * law: docked opens upward, the maximised editor downward.
				 * Fitting on screen overrules it (#1250).
				 *
				 * The previous version deliberately had no flip(), on the
				 * grounds that flipping "renders the menu over the editor
				 * content instead of on top of the toolbar". Re-checked: with
				 * offset(6) the flipped menu clears the trigger by the same 6px
				 * it does in the preferred direction, so it never covers the
				 * button that opened it. It does overlap editor content — which
				 * is what a menu is supposed to do, and far better than running
				 * the last entries off the screen edge, which is what the fixed
				 * rule did to the ⋮ menu on a phone.
				 *
				 * `bestFit` picks the roomier side when neither fits, and
				 * size() caps the height to the space actually available so the
				 * menu scrolls internally instead of overflowing.
				 */
				placement: direction === 'up' ? 'top-start' : 'bottom-start',
				middleware: [
					offset(6),
					flip({ fallbackStrategy: 'bestFit', padding: 8 }),
					shift({ padding: 8 }),
					size({
						padding: 8,
						apply({ availableHeight }) {
							setMaxHeight(Math.max(96, availableHeight));
						}
					})
				]
			}).then(({ x, y, placement }) => {
				setPosition({ left: x, top: y });
				setPlacedDirection(placement.startsWith('top') ? 'up' : 'down');
			});
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
			// The class reflects where the menu actually landed, not where it
			// was asked to go — flip() may have overruled the preference.
			className={`composerToolbar__menu composerToolbar__menu--${placedDirection}`}
			style={{
				top: position.top,
				left: position.left,
				...(maxHeight === null ? {} : { maxHeight })
			}}
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
