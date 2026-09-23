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
	/** Selected animal file, e.g. `magpie.svg`. */
	value?: string | null;
	onChange: (file: string) => void;
	/** Accessible name of the grid. */
	label: string;
	/** Defaults to every animal the app ships. */
	files?: string[];
}

/**
 * Grid of the app's animal avatars (#1540). Advice seekers pick an animal on
 * a pastel ground; counsellors always appear on the brand pair, so their tiles
 * share one colour and differ only by the animal.
 */
export const AvatarPicker = ({
	role,
	value,
	onChange,
	label,
	files = ALL_ANIMAL_FILES
}: AvatarPickerProps) => {
	const avatars = useMemo<Avatar[]>(
		() =>
			files.map((file, i) => {
				if (role === 'consultant') {
					// Same pair as CounsellorAvatar (#1468); the glyph takes the tile colour.
					return {
						file,
						bg: 'var(--m3-primary-container)',
						iconColor: 'currentColor'
					};
				}
				const bg = AVATAR_COLORS[i % AVATAR_COLORS.length];
				return { file, bg, iconColor: pickIconColor(bg) };
			}),
		[files, role]
	);

	return (
		<div
			className={`avatarPicker avatarPicker--${role}`}
			role="radiogroup"
			aria-label={label}
		>
			{avatars.map((avatar) => {
				const selected = avatar.file === value;
				return (
					<button
						key={avatar.file}
						type="button"
						role="radio"
						aria-checked={selected}
						aria-label={avatar.file.replace(/\.svg$/, '')}
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
