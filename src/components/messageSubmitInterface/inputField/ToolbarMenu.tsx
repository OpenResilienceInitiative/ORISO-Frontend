import * as React from 'react';
import { useEffect, useRef } from 'react';
import type { MenuDirection } from './menuDirection';

export interface ToolbarMenuItem {
	key: string;
	label: string;
	glyph?: React.ReactNode;
	selected?: boolean;
	onSelect: () => void;
}

export interface ToolbarMenuProps {
	items: ToolbarMenuItem[];
	direction: MenuDirection;
	onClose: () => void;
	ariaLabel: string;
}

/**
 * Floating menu anchored to its toolbar button (Figma 7086:46390): opens
 * bottom-to-top when the composer is minimized or on mobile, top-down in
 * fullscreen. Closes on outside pointer-down and Escape.
 */
export const ToolbarMenu = ({
	items,
	direction,
	onClose,
	ariaLabel
}: ToolbarMenuProps) => {
	const menuRef = useRef<HTMLDivElement | null>(null);

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

	return (
		<div
			ref={menuRef}
			role="menu"
			aria-label={ariaLabel}
			className={`composerToolbar__menu composerToolbar__menu--${direction}`}
		>
			{items.map((item) => (
				<button
					key={item.key}
					type="button"
					role="menuitem"
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
		</div>
	);
};
