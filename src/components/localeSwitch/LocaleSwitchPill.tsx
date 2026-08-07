import * as React from 'react';
import { useRef, useState } from 'react';
import { Box, ButtonBase, Menu, MenuItem, Typography } from '@mui/material';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import LanguageIcon from '@mui/icons-material/Language';

export interface LocaleSwitchPillOption {
	value: string;
	label: string;
}

export interface LocaleSwitchPillProps {
	value: string;
	options: LocaleSwitchPillOption[];
	onChange: (value: string) => void;
	/** Accessible name for the trigger, e.g. "Sprache wählen". */
	ariaLabel: string;
	className?: string;
}

const PILL_HEIGHT = 48;
const ROW_HEIGHT = 44;

/**
 * The login header's language control (design 2d).
 *
 * A pill — globe in a 36 px circle, the language in its own name, the ISO code,
 * a chevron — over a plain list. The in-app navigation keeps the react-select
 * based `LocaleSwitch`; this is presentational only and takes its options from
 * the caller, so both share `selectableLocales` as the single source.
 */
export const LocaleSwitchPill = ({
	value,
	options,
	onChange,
	ariaLabel,
	className
}: LocaleSwitchPillProps) => {
	const anchorRef = useRef<HTMLButtonElement>(null);
	const [open, setOpen] = useState(false);
	const current = options.find((option) => option.value === value);

	return (
		<Box className={className} sx={{ position: 'relative' }}>
			<ButtonBase
				ref={anchorRef}
				onClick={() => setOpen(true)}
				aria-label={ariaLabel}
				aria-haspopup="listbox"
				aria-expanded={open}
				sx={{
					'display': 'flex',
					'alignItems': 'center',
					'flex': 'none',
					'gap': '10px',
					'height': PILL_HEIGHT,
					'pl': '6px',
					'pr': '8px',
					'borderRadius': '999px',
					'backgroundColor':
						'var(--m3-surface-container-lowest, #ffffff)',
					'border': '1px solid var(--m3-outline-variant, #e4e2e2)',
					'boxShadow': '0 1px 2px rgba(0, 0, 0, 0.04)',
					'color': 'var(--m3-on-surface, #1a1c1e)',
					'transition': 'border-color 180ms ease',
					'&:hover': {
						borderColor: 'var(--m3-outline, #c4c7c8)'
					},
					'&:focus-visible': {
						outline: '2px solid var(--m3-primary, #a5000a)',
						outlineOffset: '2px'
					}
				}}
			>
				<Box
					aria-hidden
					sx={{
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						width: 36,
						height: 36,
						borderRadius: '999px',
						backgroundColor:
							'var(--m3-surface-container, #f0edee)',
						color: 'var(--m3-on-surface-variant, #444748)'
					}}
				>
					<LanguageIcon sx={{ fontSize: 19 }} />
				</Box>
				{/* Typography always resolves to text.primary and never inherits
				    the pill's colour, so both lines state their own. */}
				<Typography
					component="span"
					sx={{
						fontSize: 16,
						fontWeight: 500,
						lineHeight: 1,
						whiteSpace: 'nowrap',
						color: 'var(--m3-on-surface, #1a1c1e)'
					}}
				>
					{current?.label ?? value}
				</Typography>
				<Typography
					component="span"
					sx={{
						fontSize: 13,
						letterSpacing: '0.4px',
						lineHeight: 1,
						whiteSpace: 'nowrap',
						color: 'var(--m3-on-surface-variant, #747878)'
					}}
				>
					{value.slice(0, 2).toUpperCase()}
				</Typography>
				<KeyboardArrowDownRoundedIcon
					aria-hidden
					sx={{
						fontSize: 16,
						mr: '6px',
						color: 'var(--m3-on-surface-variant, #747878)',
						transform: open ? 'rotate(180deg)' : 'none',
						transition: 'transform 180ms ease'
					}}
				/>
			</ButtonBase>

			<Menu
				anchorEl={anchorRef.current}
				open={open}
				onClose={() => setOpen(false)}
				anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
				transformOrigin={{ vertical: 'top', horizontal: 'left' }}
				MenuListProps={{ 'role': 'listbox', 'aria-label': ariaLabel }}
				slotProps={{
					paper: {
						sx: {
							mt: '8px',
							width: 250,
							borderRadius: '8px',
							border: '1px solid var(--m3-outline-variant, #e4e2e2)',
							boxShadow: '0 4px 12px rgba(0, 0, 0, 0.12)',
							p: '6px'
						}
					}
				}}
			>
				{options.map((option) => {
					const selected = option.value === value;
					return (
						<MenuItem
							key={option.value}
							role="option"
							aria-selected={selected}
							selected={selected}
							onClick={() => {
								onChange(option.value);
								setOpen(false);
							}}
							sx={{
								'gap': '10px',
								'height': ROW_HEIGHT,
								'minHeight': ROW_HEIGHT,
								'px': '12px',
								'borderRadius': '6px',
								'fontSize': 16,
								'color': 'var(--m3-on-surface, #1a1c1e)',
								'fontWeight': selected ? 600 : 400,
								// The theme paints selected menu items solid red
								// with `#ffdad5` text, which is the in-app
								// navigation's look. The `&.Mui-selected` nesting
								// is what makes these win — a flat `color` here
								// loses on specificity and the row comes out pale
								// pink on pale pink.
								'&.Mui-selected, &.Mui-selected:hover': {
									backgroundColor:
										'var(--list-item-selected-bg, #fdeceb)',
									color: 'var(--m3-primary, #a5000a)'
								},
								'&:hover': {
									backgroundColor:
										'var(--m3-surface-container, #f0edee)',
									color: 'var(--m3-on-surface, #1a1c1e)'
								}
							}}
						>
							{/* The unselected rows keep the check column's width
							    so the labels stay on one left edge. */}
							<Box
								aria-hidden
								sx={{
									width: 16,
									display: 'flex',
									flex: 'none',
									alignItems: 'center'
								}}
							>
								{selected && (
									<CheckRoundedIcon sx={{ fontSize: 16 }} />
								)}
							</Box>
							{option.label}
						</MenuItem>
					);
				})}
			</Menu>
		</Box>
	);
};
