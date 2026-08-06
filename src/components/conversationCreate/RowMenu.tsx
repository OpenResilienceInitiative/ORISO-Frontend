import * as React from 'react';
import { useEffect, useRef } from 'react';
import { MenuPortal, useAnchoredMenuLayout } from './anchoredMenu';
import { resolveListboxKey } from './listboxKeyboard';

/**
 * Option list attached to a settings row (Figma 8482-30552, "Interval
 * konfigurieren"). Shares the anchored-menu layer with the person and topic
 * menus, so it floats above the card instead of being clipped by it.
 */

export interface RowMenuOption {
	value: string;
	label: string;
}

interface RowMenuProps {
	options: RowMenuOption[];
	value: string;
	onSelect: (value: string) => void;
	anchorRef: React.RefObject<HTMLElement>;
	onClose: () => void;
	labelledBy?: string;
	/** Free-form content instead of an option list (e.g. the calendar). */
	children?: React.ReactNode;
	preferredHeight?: number;
}

const DEFAULT_MENU_HEIGHT = 320;

export const RowMenu = ({
	options,
	value,
	onSelect,
	anchorRef,
	onClose,
	labelledBy,
	children,
	preferredHeight = DEFAULT_MENU_HEIGHT
}: RowMenuProps) => {
	const menuRef = useRef<HTMLDivElement | null>(null);
	const { direction, style } = useAnchoredMenuLayout(
		anchorRef,
		preferredHeight,
		options.length
	);

	useEffect(() => {
		const handleOutsidePointer = (event: MouseEvent | TouchEvent) => {
			const target = event.target as Node | null;
			if (
				target &&
				!menuRef.current?.contains(target) &&
				!anchorRef.current?.contains(target)
			) {
				onClose();
			}
		};
		document.addEventListener('mousedown', handleOutsidePointer);
		document.addEventListener('touchstart', handleOutsidePointer);
		return () => {
			document.removeEventListener('mousedown', handleOutsidePointer);
			document.removeEventListener('touchstart', handleOutsidePointer);
		};
	}, [anchorRef, onClose]);

	const optionButtons = () =>
		Array.from(
			menuRef.current?.querySelectorAll<HTMLButtonElement>(
				'button[role="option"]'
			) ?? []
		);

	useEffect(() => {
		optionButtons()[0]?.focus();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
		const buttons = optionButtons();
		const currentIndex = buttons.findIndex(
			(button) => button === document.activeElement
		);
		const result = resolveListboxKey(
			event.key,
			currentIndex,
			buttons.length
		);
		if (result === null) {
			return;
		}
		event.preventDefault();
		if (result === 'close') {
			onClose();
			(
				anchorRef.current?.querySelector('button') as HTMLButtonElement
			)?.focus();
			return;
		}
		buttons[result]?.focus();
	};

	return (
		<MenuPortal>
			<div
				ref={menuRef}
				className={`rowMenu rowMenu--${direction}`}
				style={style}
				role={children ? 'dialog' : 'listbox'}
				aria-labelledby={labelledBy}
				onKeyDown={handleKeyDown}
			>
				{children ??
					options.map((option) => (
						<button
							key={option.value}
							type="button"
							role="option"
							aria-selected={option.value === value}
							className="rowMenu__option"
							onClick={() => onSelect(option.value)}
						>
							{option.label}
						</button>
					))}
			</div>
		</MenuPortal>
	);
};
