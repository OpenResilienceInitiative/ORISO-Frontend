import * as React from 'react';
import { useEffect, useState } from 'react';
import { renderAvatarSvg } from '../../utils/pseudonymGenerator';
import type { AvatarChoice } from '../../utils/avatarChoice';
import {
	type CounsellorNameParts,
	counsellorInitials
} from '../../utils/counsellorAvatar';

export interface CounsellorAvatarProps extends CounsellorNameParts {
	choice: Exclude<AvatarChoice, { kind: 'animal' }>;
	/** Outer diameter in px. */
	size?: number;
	/** Accessible name; omitted → decorative, because a name is already visible. */
	label?: string;
}

/**
 * The counsellor's CHOSEN avatar (#1047): the monochrome motif they picked, or
 * their initials — always on the tenant's primary pair, so the face
 * an advice seeker sees carries the operator's brand instead of a colour hash.
 *
 * `--m3-primary` is the surface and `--m3-on-primary` the
 * foreground; the m3Sweep guard forbids the reverse, and both are re-derived
 * per tenant in `utils/theme/orisoScheme.ts`.
 *
 * Counsellors who never chose do not reach this component at all — `UserAvatar`
 * keeps rendering their deterministic animal, so nothing regresses.
 */
export const CounsellorAvatar: React.FC<CounsellorAvatarProps> = ({
	choice,
	displayName,
	firstName,
	lastName,
	username,
	size = 32,
	label
}) => {
	const motifFile = choice.kind === 'motif' ? choice.file : null;
	const [motifHtml, setMotifHtml] = useState<string | null>(null);

	useEffect(() => {
		let canceled = false;
		setMotifHtml(null);
		if (!motifFile) {
			return undefined;
		}
		renderAvatarSvg({
			file: motifFile,
			bg: 'var(--m3-primary)',
			iconColor: 'currentColor'
		})
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
			data-avatar-id={
				motifHtml
					? motifFile?.replace(/\.svg$/i, '').toLowerCase()
					: undefined
			}
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
				background: 'var(--m3-primary)',
				color: 'var(--m3-on-primary)',
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
						// the on-primary foreground set above.
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
