import * as React from 'react';
import { useRef, useState } from 'react';
import { Menu, MenuItem } from '@mui/material';
import clsx from 'clsx';
import { SplitButton } from '../splitButton/SplitButton';

export interface KindOption {
	id: string;
	label: string;
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
	disabled?: boolean;
	/** Only the main segment is inert (e.g. nothing to preview); the menu stays usable. */
	mainDisabled?: boolean;
	className?: string;
	dataCy?: string;
}

/**
 * The small split button with a menu that the display-filter dialog uses
 * for per-kind choices (Frank 2026-09-16): the tone of a kind, the
 * live-chat pill mode. All pickers in a column share one width, so the
 * label truncates instead of the buttons growing.
 */
export const KindOptionPicker = ({
	options,
	selected,
	onSelect,
	onMain,
	icon,
	mainLabel,
	menuLabel,
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
				label={current?.label}
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
				MenuListProps={{ 'dense': true, 'aria-label': menuLabel }}
			>
				{options.map((option) => (
					<MenuItem
						key={option.id}
						selected={option.id === selected}
						onClick={() => {
							setOpen(false);
							onSelect(option.id);
						}}
					>
						{option.label}
					</MenuItem>
				))}
			</Menu>
		</>
	);
};
