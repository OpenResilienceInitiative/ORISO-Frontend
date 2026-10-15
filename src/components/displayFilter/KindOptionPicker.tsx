import * as React from 'react';
import { useRef, useState } from 'react';
import { Menu, MenuItem } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import clsx from 'clsx';
import { SplitButton } from '../splitButton/SplitButton';
import {
	ChatMenuDropdownDivider,
	ChatMenuDropdownItem
} from '../chatMenuDropdown/ChatMenuDropdown';

export interface KindOption {
	id: string;
	label: string;
	/** One line of support text under the label (e.g. "Nur das Fenster, kein Ton"). */
	description?: string;
	/** Shorter text for the button while this option is chosen (e.g. "Stumm"). */
	selectedLabel?: string;
	/** A divider above this option starts a new group. */
	dividerBefore?: boolean;
}

export interface KindOptionPickerProps {
	options: ReadonlyArray<KindOption>;
	/** Selected option id; falls back to the first option's label when unknown. */
	selected: string;
	onSelect: (id: string) => void;
	/** Main segment action (e.g. preview the tone). Without it the main segment opens the menu. */
	onMain?: () => void;
	icon?: React.ReactNode;
	mainLabel: string;
	menuLabel: string;
	/** Small caption above the first group of options (e.g. "Pop-up mit Ton"). */
	groupLabel?: string;
	disabled?: boolean;
	/** Only the main segment is inert (e.g. nothing to preview); the menu stays usable. */
	mainDisabled?: boolean;
	className?: string;
	dataCy?: string;
}

// Captions and dividers are not options: MUI's list keyboard focus skips
// children whose component carries this flag (as it does for its own Divider).
const MenuGroupLabel = ({ children }: { children: React.ReactNode }) => (
	<li
		role="presentation"
		className="chatMenuDropdown__subtitle kindOptionPicker__groupLabel"
	>
		{children}
	</li>
);
MenuGroupLabel.muiSkipListHighlight = true;

const MenuDivider = () => (
	<ChatMenuDropdownDivider
		as="li"
		role="separator"
		className="kindOptionPicker__divider"
	/>
);
MenuDivider.muiSkipListHighlight = true;

/**
 * The small split button with a menu that the display-filter dialog uses
 * for per-kind choices (Frank 2026-09-16): the tone of a kind, the
 * live-chat pill mode, the e-mail notice. All pickers in a column share one
 * width, so the label truncates instead of the buttons growing.
 *
 * The menu is the house menu (Storybook "Components/Chat/MenuDropdown"):
 * its surface, rows with optional support text, selected row and divider,
 * in compact density, hosted by MUI `Menu` for focus and keyboard handling.
 */
export const KindOptionPicker = ({
	options,
	selected,
	onSelect,
	onMain,
	icon,
	mainLabel,
	menuLabel,
	groupLabel,
	disabled = false,
	mainDisabled = false,
	className,
	dataCy
}: KindOptionPickerProps) => {
	const [open, setOpen] = useState(false);
	const anchor = useRef<HTMLDivElement>(null);
	const current =
		options.find((option) => option.id === selected) ?? options[0];
	return (
		<>
			<SplitButton
				ref={anchor}
				size="small"
				variant="outlined"
				className={clsx('kindOptionPicker', className)}
				label={current?.selectedLabel ?? current?.label}
				mainLabel={mainLabel}
				icon={icon}
				disabled={disabled}
				mainDisabled={mainDisabled}
				mainOpensMenu={!onMain}
				onClick={onMain ?? (() => setOpen(true))}
				onToggleMenu={() => setOpen((value) => !value)}
				open={open}
				menuLabel={menuLabel}
				id={dataCy}
			/>
			<Menu
				anchorEl={anchor.current}
				open={open}
				onClose={() => setOpen(false)}
				PaperProps={{
					className:
						'chatMenuDropdown chatMenuDropdown--compact kindOptionPicker__menu'
				}}
				MenuListProps={{
					'disablePadding': true,
					'aria-label': menuLabel
				}}
			>
				{groupLabel && <MenuGroupLabel>{groupLabel}</MenuGroupLabel>}
				{options.flatMap((option) => {
					const isSelected = option.id === selected;
					const item = (
						<ChatMenuDropdownItem
							key={option.id}
							as={MenuItem}
							role="menuitemradio"
							aria-checked={isSelected}
							selected={isSelected}
							className="kindOptionPicker__item"
							icon={
								isSelected ? (
									<CheckIcon aria-hidden="true" />
								) : (
									<span aria-hidden="true" />
								)
							}
							title={option.label}
							description={option.description}
							onClick={() => {
								setOpen(false);
								onSelect(option.id);
							}}
						/>
					);
					return option.dividerBefore
						? [<MenuDivider key={`${option.id}-divider`} />, item]
						: [item];
				})}
			</Menu>
		</>
	);
};
