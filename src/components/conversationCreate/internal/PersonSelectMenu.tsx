import * as React from 'react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { decideMenuPlacement, MenuPlacement } from '../menuDirection';

/**
 * Person selection menu (Figma "Menu Selection List", node 8482:25911).
 * Rows show the person's name and a round toggle: primary red check when
 * selected, tonal grey check when selectable, a disabled × for people who
 * have vacated the agency — those stay listed until they are deselected,
 * only then do they leave the list. The menu opens towards the side with
 * more space and scrolls internally when it cannot fit.
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
}

const PREFERRED_MENU_HEIGHT = 420;

export const PersonSelectMenu = ({
	options,
	onToggle,
	anchorRef,
	onClose,
	labelledBy,
	toggleLabel
}: PersonSelectMenuProps) => {
	const menuRef = useRef<HTMLDivElement | null>(null);
	const [placement, setPlacement] = useState<MenuPlacement>({
		direction: 'down',
		maxHeight: PREFERRED_MENU_HEIGHT
	});

	useLayoutEffect(() => {
		const anchor = anchorRef.current;
		if (!anchor) {
			return;
		}
		const rect = anchor.getBoundingClientRect();
		setPlacement(
			decideMenuPlacement({
				anchorTop: rect.top,
				anchorBottom: rect.bottom,
				viewportHeight: window.innerHeight,
				menuHeight: PREFERRED_MENU_HEIGHT
			})
		);
	}, [anchorRef, options.length]);

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
		const handleEscape = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				onClose();
			}
		};
		document.addEventListener('mousedown', handleOutsidePointer);
		document.addEventListener('touchstart', handleOutsidePointer);
		document.addEventListener('keydown', handleEscape);
		return () => {
			document.removeEventListener('mousedown', handleOutsidePointer);
			document.removeEventListener('touchstart', handleOutsidePointer);
			document.removeEventListener('keydown', handleEscape);
		};
	}, [anchorRef, onClose]);

	return (
		<div
			ref={menuRef}
			className={`personSelectMenu personSelectMenu--${placement.direction}`}
			style={{ maxHeight: placement.maxHeight }}
			role="listbox"
			aria-multiselectable
			aria-labelledby={labelledBy}
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
						aria-label={toggleLabel(option.label, option.selected)}
					>
						<span className="personSelectMenu__name">
							{option.label}
						</span>
						<span className="personSelectMenu__toggle" aria-hidden>
							{option.vacated ? (
								<svg
									width="24"
									height="24"
									viewBox="0 0 24 24"
									fill="none"
								>
									<path
										d="M6 6L18 18M18 6L6 18"
										stroke="currentColor"
										strokeWidth="2"
										strokeLinecap="round"
									/>
								</svg>
							) : (
								<svg
									width="24"
									height="24"
									viewBox="0 0 24 24"
									fill="none"
								>
									<path
										d="M5 12.5L10 17.5L19 7.5"
										stroke="currentColor"
										strokeWidth="2"
										strokeLinecap="round"
										strokeLinejoin="round"
									/>
								</svg>
							)}
						</span>
					</button>
				);
			})}
		</div>
	);
};
