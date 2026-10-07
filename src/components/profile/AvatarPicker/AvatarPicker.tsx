import * as React from 'react';
import { useMemo } from 'react';
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
	defaultTile?: { avatar: Avatar; label: string };
	/**
	 * Advice seekers keep the colours derived from their id, so each tile is
	 * previewed in them; without it every tile gets its own colour.
	 */
	askerColors?: Pick<Avatar, 'bg' | 'iconColor'>;
	disabled?: boolean;
}

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

	return (
		<div
			className={`avatarPicker avatarPicker--${role} avatarPicker--${layout}`}
			role="radiogroup"
			aria-label={label}
		>
			{defaultTile && (
				<button
					type="button"
					role="radio"
					aria-checked={!value}
					aria-label={defaultTile.label}
					disabled={disabled}
					className={`avatarPicker__tile avatarPicker__tile--default${
						!value ? ' avatarPicker__tile--selected' : ''
					}`}
					onClick={() => onChange(null)}
				>
					<AnimalAvatar avatar={defaultTile.avatar} size={52} />
					{!value && (
						<span className="avatarPicker__check">
							<CheckRoundedIcon aria-hidden="true" />
						</span>
					)}
				</button>
			)}
			{avatars.map((avatar) => {
				const selected = avatar.file === value;
				return (
					<button
						key={avatar.file}
						type="button"
						role="radio"
						aria-checked={selected}
						aria-label={avatar.file.replace(/\.svg$/, '')}
						disabled={disabled}
						className={`avatarPicker__tile${
							selected ? ' avatarPicker__tile--selected' : ''
						}`}
						onClick={() => onChange(avatar.file)}
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
