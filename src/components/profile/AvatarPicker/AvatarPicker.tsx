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

interface AvatarPickerProps {
	role: AvatarPickerRole;
	/** Selected animal file, e.g. `magpie.svg`; null selects the default tile. */
	value?: string | null;
	/** The chosen file, or null for the default tile. */
	onChange: (file: string | null) => void;
	/** Accessible name of the grid. */
	label: string;
	/** Defaults to every animal the app ships. */
	files?: string[];
	/** `row`: one horizontally scrolling line, as in the profile header (#878). */
	layout?: 'grid' | 'row';
	/** First tile: the avatar the app derives from the user id, which clears the choice. */
	defaultTile?: { avatar: Avatar; label: string; selected?: boolean };
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
 * their tiles share one colour. Counsellors will use their own motif set
 * (US#1046) once it reaches the app; the animals stand in until then.
 */
export const AvatarPicker = ({
	role,
	value,
	onChange,
	label,
	files = ALL_ANIMAL_FILES,
	layout = 'grid',
	defaultTile,
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
	const hasPickedTile = !!value && avatars.some(({ file }) => file === value);
	const defaultSelected = defaultTile?.selected ?? !value;
	// The group is one tab stop (ARIA radio group): the picked tile, else the first.
	const isTabStop = (file: string | null, index: number) =>
		file === null
			? !value || (!hasPickedTile && index === 0)
			: file === value || (!hasPickedTile && !defaultTile && index === 0);

	// Arrows only move focus; Enter or Space picks, because every pick is saved at once.
	const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
		const move = FOCUS_KEYS[event.key];
		const tiles = Array.from(
			groupRef.current?.querySelectorAll<HTMLButtonElement>(
				'[role="radio"]'
			) ?? []
		);
		const current = tiles.indexOf(
			document.activeElement as HTMLButtonElement
		);
		if (!move || current < 0) return;
		event.preventDefault();
		const last = tiles.length - 1;
		tiles[Math.min(Math.max(move(current, last), 0), last)].focus();
	};
	const pick = (file: string | null) => {
		if (!disabled) onChange(file);
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
			{defaultTile && (
				<button
					type="button"
					role="radio"
					aria-checked={defaultSelected}
					aria-label={defaultTile.label}
					aria-disabled={disabled || undefined}
					tabIndex={isTabStop(null, 0) ? 0 : -1}
					className={`avatarPicker__tile avatarPicker__tile--default${
						defaultSelected ? ' avatarPicker__tile--selected' : ''
					}`}
					onClick={() => pick(null)}
				>
					<AnimalAvatar avatar={defaultTile.avatar} size={52} />
					{defaultSelected && (
						<span className="avatarPicker__check">
							<CheckRoundedIcon aria-hidden="true" />
						</span>
					)}
				</button>
			)}
			{avatars.map((avatar, index) => {
				const selected = avatar.file === value;
				return (
					<button
						key={avatar.file}
						type="button"
						role="radio"
						aria-checked={selected}
						aria-label={avatar.file.replace(/\.svg$/, '')}
						aria-disabled={disabled || undefined}
						tabIndex={isTabStop(avatar.file, index) ? 0 : -1}
						className={`avatarPicker__tile${
							selected ? ' avatarPicker__tile--selected' : ''
						}`}
						onClick={() => pick(avatar.file)}
					>
						<AnimalAvatar avatar={avatar} size={52} />
						{selected && (
							<span className="avatarPicker__check">
								<CheckRoundedIcon aria-hidden="true" />
							</span>
						)}
					</button>
				);
			})}
		</div>
	);
};
