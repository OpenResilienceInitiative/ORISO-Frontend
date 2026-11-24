import * as React from 'react';
import { useMemo, useRef } from 'react';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import { AnimalAvatar } from '../../pseudonym/AnimalAvatar';
import {
	ALL_ANIMAL_FILES,
	AVATAR_COLORS,
	pickIconColor,
	type Avatar
} from '../../../utils/pseudonymGenerator';
import './avatarPicker.styles.scss';

export type AvatarPickerRole = 'asker' | 'consultant';
export const INITIALS_TILE = 'initials';

interface AvatarPickerProps {
	role: AvatarPickerRole;
	/** Selected motif filename, INITIALS_TILE, or null for the default tile. */
	value?: string | null;
	/** The chosen motif filename, INITIALS_TILE, or null for the default tile. */
	onChange: (selection: string | null) => void;
	/** Accessible name of the grid. */
	label: string;
	/** Defaults to every animal the app ships. */
	files?: string[];
	/** Optional `row` layout: one horizontally scrolling line. */
	layout?: 'grid' | 'row';
	/** First tile: the avatar the app derives from the user id, which clears the choice. */
	defaultTile?: { avatar: Avatar; label: string; selected?: boolean };
	/** Optional initials preview for counsellor profiles. */
	initialsTile?: { label: string; content: React.ReactNode };
	/**
	 * Advice seekers keep the colours derived from their id, so each tile is
	 * previewed in them; without it every tile gets its own colour.
	 */
	askerColors?: Pick<Avatar, 'bg' | 'iconColor'>;
	disabled?: boolean;
}

/** Keys that move focus inside the group; the picked tile stays the group's only tab stop. */
const FOCUS_KEYS: Readonly<
	Record<string, (index: number, last: number) => number>
> = {
	ArrowRight: (index) => index + 1,
	ArrowDown: (index) => index + 1,
	ArrowLeft: (index) => index - 1,
	ArrowUp: (index) => index - 1,
	Home: () => 0,
	End: (_index, last) => last
};

/**
 * Grid of the app's animal avatars (#1540). Advice seekers pick an animal on
 * a pastel ground; counsellors always appear on primary / on-primary, so
 * their motif and initials tiles share one colour.
 */
export const AvatarPicker = ({
	role,
	value,
	onChange,
	label,
	files = ALL_ANIMAL_FILES,
	layout = 'grid',
	defaultTile,
	initialsTile,
	askerColors,
	disabled = false
}: AvatarPickerProps) => {
	const avatars = useMemo<Avatar[]>(
		() =>
			files.map((file, i) => {
				if (role === 'consultant') {
					// Brand pair per US#1046; the glyph takes the tile colour.
					return {
						file,
						bg: 'var(--m3-primary)',
						iconColor: 'currentColor'
					};
				}
				if (askerColors) return { file, ...askerColors };
				const bg = AVATAR_COLORS[i % AVATAR_COLORS.length];
				return { file, bg, iconColor: pickIconColor(bg) };
			}),
		[files, role, askerColors]
	);
	const groupRef = useRef<HTMLDivElement>(null);
	const tiles = avatars.map<{
		id: string | null;
		label: string;
		selected: boolean;
		content: React.ReactNode;
	}>((avatar) => ({
		id: avatar.file,
		label: avatar.file.replace(/\.svg$/, ''),
		selected: avatar.file === value,
		content: <AnimalAvatar avatar={avatar} size={52} />
	}));
	if (initialsTile) {
		tiles.unshift({
			...initialsTile,
			id: INITIALS_TILE,
			selected: value === INITIALS_TILE
		});
	}
	if (defaultTile) {
		tiles.unshift({
			id: null,
			label: defaultTile.label,
			selected: defaultTile.selected ?? !value,
			content: <AnimalAvatar avatar={defaultTile.avatar} size={52} />
		});
	}
	// The selected tile is the only tab stop. Fall back to the first for stale values.
	const tabStop = Math.max(
		0,
		tiles.findIndex(({ selected }) => selected)
	);

	// Arrows only move focus; Enter or Space picks, because every pick is saved at once.
	const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
		const move = FOCUS_KEYS[event.key];
		const buttons = Array.from(
			groupRef.current?.querySelectorAll<HTMLButtonElement>(
				'[role="radio"]'
			) ?? []
		);
		const current = buttons.indexOf(
			document.activeElement as HTMLButtonElement
		);
		if (!move || current < 0) return;
		event.preventDefault();
		const last = buttons.length - 1;
		buttons[Math.min(Math.max(move(current, last), 0), last)].focus();
	};

	return (
		<div
			ref={groupRef}
			className={`avatarPicker avatarPicker--${role} avatarPicker--${layout}`}
			role="radiogroup"
			aria-label={label}
			aria-busy={disabled || undefined}
			onKeyDown={onKeyDown}
		>
			{tiles.map(({ id, label: tileLabel, selected, content }, index) => (
				<button
					key={id ?? 'default'}
					type="button"
					role="radio"
					aria-checked={selected}
					aria-label={tileLabel}
					aria-disabled={disabled || undefined}
					tabIndex={index === tabStop ? 0 : -1}
					className={`avatarPicker__tile${id === null ? ' avatarPicker__tile--default' : ''}${
						selected ? ' avatarPicker__tile--selected' : ''
					}`}
					onClick={() => {
						if (!disabled) onChange(id);
					}}
				>
					{content}
					{selected && (
						<span className="avatarPicker__check">
							<CheckRoundedIcon aria-hidden="true" />
						</span>
					)}
				</button>
			))}
		</div>
	);
};
