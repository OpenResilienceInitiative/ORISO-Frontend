import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { ReactComponent as CheckIcon } from '../../../resources/img/icons/check.svg';
import { ReactComponent as CloseIcon } from '../../../resources/img/icons/close.svg';
import HelpOutlineOutlinedIcon from '@mui/icons-material/HelpOutlineOutlined';
import { MenuPortal, useAnchoredMenuLayout } from '../anchoredMenu';
import { OrisoTextField } from '../../form/OrisoTextField';
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
	searchLabel?: string;
	noMatchesLabel?: string;
	onToggle: (id: string) => void;
	/** The element the menu is anchored to (the split button). */
	anchorRef: React.RefObject<HTMLElement>;
	onClose: () => void;
	labelledBy?: string;
	toggleLabel: (label: string, selected: boolean) => string;
	/** Spelt-out state for people who have left the agency. */
	vacatedHint: string;
	/**
	 * Empty state (#1499): with nobody to pick, the menu still opens and says
	 * so in a disabled line instead of showing an empty frame.
	 */
	emptyLabel?: string;
	/** Optional help entry shown under the empty line; opens an explanation. */
	helpLabel?: string;
	onHelp?: () => void;
}

const PREFERRED_MENU_HEIGHT = 420;

export const PersonSelectMenu = ({
	options,
	searchLabel,
	noMatchesLabel,
	onToggle,
	anchorRef,
	onClose,
	labelledBy,
	toggleLabel,
	vacatedHint,
	emptyLabel,
	helpLabel,
	onHelp
}: PersonSelectMenuProps) => {
	const menuRef = useRef<HTMLDivElement | null>(null);
	const searchRef = useRef<HTMLInputElement | null>(null);
	const [query, setQuery] = useState('');
	const search = query.trim().toLocaleLowerCase();
	const visibleOptions = search
		? options.filter(({ label }) =>
				label.toLocaleLowerCase().includes(search)
			)
		: options;
	const isEmpty = visibleOptions.length === 0;
	const emptyMessage = search ? noMatchesLabel : emptyLabel;
	const showHelp = !search && isEmpty && Boolean(helpLabel && onHelp);
	const { direction, style } = useAnchoredMenuLayout(
		anchorRef,
		PREFERRED_MENU_HEIGHT,
		Math.max(1, visibleOptions.length) +
			Number(showHelp) +
			(searchLabel && options.length > 0 ? 2 : 0)
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

	// The portal starts hidden until its anchor has been measured.
	useEffect(() => {
		if (style.visibility !== 'hidden') {
			const target =
				searchRef.current ??
				menuRef.current?.querySelector<HTMLButtonElement>('button');
			target?.focus();
		}
	}, [style.visibility]);

	const returnFocusToAnchor = () => {
		const anchor = anchorRef.current;
		(anchor?.querySelector('button') as HTMLButtonElement | null)?.focus();
	};

	const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
		if (
			event.target === searchRef.current &&
			event.key !== 'Escape' &&
			event.key !== 'ArrowDown' &&
			event.key !== 'ArrowUp'
		) {
			return;
		}
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
				onKeyDown={handleKeyDown}
			>
				{searchLabel && options.length > 0 && (
					<div className="personSelectMenu__search">
						<OrisoTextField
							inputRef={searchRef}
							type="search"
							size="small"
							fullWidth
							label={searchLabel}
							value={query}
							onChange={(event) => setQuery(event.target.value)}
						/>
					</div>
				)}
				<div
					role="listbox"
					aria-multiselectable
					aria-labelledby={labelledBy}
				>
					{isEmpty && emptyMessage && (
						<div
							role="option"
							aria-selected={false}
							aria-disabled
							className="personSelectMenu__row personSelectMenu__row--empty"
						>
							<span className="personSelectMenu__name">
								{emptyMessage}
							</span>
						</div>
					)}
					{visibleOptions.map((option) => {
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
									{option.vacated ? (
										<CloseIcon />
									) : (
										<CheckIcon />
									)}
								</span>
							</button>
						);
					})}
				</div>
				{showHelp && (
					<button
						type="button"
						className="personSelectMenu__row personSelectMenu__row--help"
						onClick={() => {
							onClose();
							onHelp?.();
						}}
					>
						<span className="personSelectMenu__name">
							{helpLabel}
						</span>
						<span className="personSelectMenu__toggle" aria-hidden>
							<HelpOutlineOutlinedIcon />
						</span>
					</button>
				)}
			</div>
		</MenuPortal>
	);
};
