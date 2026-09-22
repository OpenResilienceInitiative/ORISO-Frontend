import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
	ALL_ANIMAL_FILES,
	loadCounsellorMotifSvg
} from '../../utils/pseudonymGenerator';
import {
	type CounsellorAvatarChoice,
	type CounsellorNameParts,
	counsellorInitials,
	counsellorMotifFile,
	resolveCounsellorAvatarKind
} from '../../utils/counsellorAvatar';

export interface CounsellorAvatarProps
	extends CounsellorAvatarChoice,
		CounsellorNameParts {
	/** Outer diameter in px. */
	size?: number;
	/** Accessible name; omitted → decorative, because a name is already visible. */
	label?: string;
}

/**
 * The counsellor's CHOSEN avatar (#1047): the monochrome motif they picked, or
 * their initials — always on the tenant's primary-container pair, so the face
 * an advice seeker sees carries the operator's brand instead of a colour hash.
 *
 * `--m3-primary-container` is the surface and `--m3-on-primary-container` the
 * foreground; the m3Sweep guard forbids the reverse, and both are re-derived
 * per tenant in `utils/theme/orisoScheme.ts`.
 *
 * Counsellors who never chose do not reach this component at all — `UserAvatar`
 * keeps rendering their deterministic animal, so nothing regresses.
 */
export const CounsellorAvatar: React.FC<CounsellorAvatarProps> = ({
	avatarKind,
	avatarId,
	displayName,
	firstName,
	lastName,
	username,
	size = 32,
	label
}) => {
	const motifFile = useMemo(
		() =>
			resolveCounsellorAvatarKind({ avatarKind, avatarId }) === 'ICON'
				? counsellorMotifFile(avatarId, ALL_ANIMAL_FILES)
				: null,
		[avatarKind, avatarId]
	);
	const [motifHtml, setMotifHtml] = useState<string | null>(null);

	useEffect(() => {
		let canceled = false;
		setMotifHtml(null);
		if (!motifFile) {
			return undefined;
		}
		loadCounsellorMotifSvg(motifFile)
			.then((html) => {
				if (!canceled) {
					setMotifHtml(html);
				}
			})
			// A motif that will not load must not blank the avatar: staying at
			// null renders the initials underneath instead.
			.catch(() => {
				if (!canceled) {
					setMotifHtml(null);
				}
			});

		return () => {
			canceled = true;
		};
	}, [motifFile]);

	const initials = counsellorInitials({
		displayName,
		firstName,
		lastName,
		username
	});
	const glyphSize = Math.round(size * 0.6);

	return (
		<span
			data-testid="counsellor-avatar"
			data-avatar-kind={motifHtml ? 'ICON' : 'INITIALS'}
			data-avatar-id={motifHtml ? avatarId : undefined}
			role={label ? 'img' : undefined}
			aria-label={label || undefined}
			aria-hidden={label ? undefined : true}
			style={{
				display: 'inline-flex',
				alignItems: 'center',
				justifyContent: 'center',
				width: size,
				height: size,
				borderRadius: '50%',
				// Surface / foreground of the tenant's brand — the whole point of #1046.
				background: 'var(--m3-primary-container, #cc1e1c)',
				color: 'var(--m3-on-primary-container, #ffe2de)',
				fontSize: Math.round(size * 0.4),
				fontWeight: 600,
				lineHeight: 1,
				boxSizing: 'border-box',
				flexShrink: 0,
				overflow: 'hidden'
			}}
		>
			{motifHtml ? (
				<span
					style={{
						width: glyphSize,
						height: glyphSize,
						display: 'flex',
						// The motif is recoloured to `currentColor`, so it inherits
						// the on-primary-container foreground set above.
						color: 'inherit'
					}}
					aria-hidden="true"
					dangerouslySetInnerHTML={{ __html: motifHtml }}
				/>
			) : (
				initials
			)}
		</span>
	);
};
