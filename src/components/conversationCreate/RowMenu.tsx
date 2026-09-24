import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
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

/*
 * The menu moves focus into itself by script, and browsers may draw a focus
 * ring for that even after a tap. Remember how the author last interacted,
 * so the ring only appears for keyboard use.
 */
let lastInputWasKeyboard = false;
if (typeof document !== 'undefined') {
	document.addEventListener(
		'keydown',
		() => {
			lastInputWasKeyboard = true;
		},
		true
	);
	document.addEventListener(
		'pointerdown',
		() => {
			lastInputWasKeyboard = false;
		},
		true
	);
}

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
	const [keyboardUse, setKeyboardUse] = useState(lastInputWasKeyboard);
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

	/*
	 * The menu mounts hidden until it is measured, and a hidden button cannot
	 * take focus; so focus the chosen option (else the first) once the menu is
	 * visible.
	 */
	const focusedRef = useRef(false);
	useEffect(() => {
		if (focusedRef.current || style.visibility === 'hidden') {
			return;
		}
		const buttons = optionButtons();
		const target =
			buttons.find(
				(button) => button.getAttribute('aria-selected') === 'true'
			) ?? buttons[0];
		if (target) {
			target.focus();
			focusedRef.current = true;
		}
	}, [style]);

	const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
		setKeyboardUse(true);
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
				className={`rowMenu rowMenu--${direction}${
					keyboardUse ? ' rowMenu--keyboard' : ''
				}`}
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
