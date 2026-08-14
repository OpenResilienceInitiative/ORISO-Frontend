import * as React from 'react';
import { useEffect, useRef } from 'react';
import { ReactComponent as CheckIcon } from '../../../resources/img/icons/check.svg';
import { ReactComponent as CloseIcon } from '../../../resources/img/icons/close.svg';
import { MenuPortal, useAnchoredMenuLayout } from '../anchoredMenu';
import { resolveListboxKey } from '../listboxKeyboard';

/**
 * Person selection menu (Figma "Menu Selection List", node 8482:25911).
 * Rows show the person's name and a round toggle: primary red check when
 * selected, tonal grey check when selectable, a muted × for people who
 * have vacated the agency — those stay listed until they are deselected,
 * only then do they leave the list, and they name their state in words rather
 * than only by being pale. The menu opens towards the side with
 * more space and scrolls internally when it cannot fit, and floats above the
 * card instead of being clipped by it.
 */

export interface PersonOption {
	id: string;
	label: string;
	selected: boolean;
	vacated?: boolean;
}

interface PersonSelectMenuProps {
	options: PersonOption[];
	onToggle: (id: string) => void;
	/** The element the menu is anchored to (the split button). */
	anchorRef: React.RefObject<HTMLElement>;
	onClose: () => void;
	labelledBy?: string;
	toggleLabel: (label: string, selected: boolean) => string;
	/** Spelt-out state for people who have left the agency. */
	vacatedHint: string;
}

const PREFERRED_MENU_HEIGHT = 420;

export const PersonSelectMenu = ({
	options,
	onToggle,
	anchorRef,
	onClose,
	labelledBy,
	toggleLabel,
	vacatedHint
}: PersonSelectMenuProps) => {
	const menuRef = useRef<HTMLDivElement | null>(null);
	const { direction, style } = useAnchoredMenuLayout(
		anchorRef,
		PREFERRED_MENU_HEIGHT,
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

	// Move focus into the popup on open so the option list is operable by
	// keyboard (WCAG listbox contract).
	useEffect(() => {
		optionButtons()[0]?.focus();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const returnFocusToAnchor = () => {
		const anchor = anchorRef.current;
		(anchor?.querySelector('button') as HTMLButtonElement | null)?.focus();
	};

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
			returnFocusToAnchor();
			return;
		}
		buttons[result]?.focus();
	};

	return (
		<MenuPortal>
			<div
				ref={menuRef}
				className={`personSelectMenu personSelectMenu--${direction}`}
				style={style}
				role="listbox"
				aria-multiselectable
				aria-labelledby={labelledBy}
				onKeyDown={handleKeyDown}
			>
				{options.map((option) => {
					const stateClass = option.vacated
						? 'personSelectMenu__row--vacated'
						: option.selected
							? 'personSelectMenu__row--selected'
							: '';
					return (
						<button
							type="button"
							key={option.id}
							role="option"
							aria-selected={option.selected}
							className={`personSelectMenu__row ${stateClass}`}
							onClick={() => onToggle(option.id)}
							aria-label={toggleLabel(
								option.label,
								option.selected
							)}
						>
							<span className="personSelectMenu__name">
								{option.label}
								{option.vacated && (
									<span className="personSelectMenu__vacatedHint">
										{vacatedHint}
									</span>
								)}
							</span>
							<span
								className="personSelectMenu__toggle"
								aria-hidden
							>
								{option.vacated ? <CloseIcon /> : <CheckIcon />}
							</span>
						</button>
					);
				})}
			</div>
		</MenuPortal>
	);
};
