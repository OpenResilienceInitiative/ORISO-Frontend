import React, { useEffect, useState } from 'react';
import { type Avatar, renderAvatarSvg } from '../../utils/pseudonymGenerator';

interface AnimalAvatarProps {
	avatar: Avatar;
	/** Outer circle size in px (Figma default = 108) */
	size?: number;
}

/**
 * Padding around the artwork, as a share of the avatar's diameter per side.
 * The SVGs are cropped to their artwork, so this alone sets how large an
 * animal reads. 16% suits most of the set; flat or delicate motifs look too
 * small at 16% and get less padding (owner, 2026-09-24, judged at 104px).
 * Keys are SVG file names without extension, lower-case.
 */
export const DEFAULT_ICON_PADDING = 0.16;
export const ICON_PADDING: Readonly<Record<string, number>> = {
	alpaca: 0.14,
	dolphin: 0.12,
	giraffe: 0.12,
	nightingale: 0.12,
	turtle: 0.12
};

/** Padding for one SVG file; unknown or missing names get the default. */
export const iconPaddingFor = (file?: string | null): number =>
	(file && ICON_PADDING[file.replace(/\.svg$/i, '').toLowerCase()]) ||
	DEFAULT_ICON_PADDING;

/**
 * Share of the diameter the artwork fills for a given padding. The padding
 * values above were judged on a 104px avatar with a 2px border (~4% of the
 * diameter); expressing them as a fraction keeps that look at every size,
 * including the 24px avatar inside UserAvatar's ring, where a plain
 * percentage of the size would leave the animal at ~50%.
 */
const BORDER_SHARE_AT_REFERENCE = 0.04;
const artworkFraction = (padding: number) =>
	1 - 2 * padding - BORDER_SHARE_AT_REFERENCE;

/**
 * Circular generated avatar. The SVG itself is loaded on demand and recolored
 * by the shared anonymous-name engine so light and dark backgrounds stay legible.
 */
export const AnimalAvatar: React.FC<AnimalAvatarProps> = ({
	avatar,
	size = 108
}) => {
	const [avatarHtml, setAvatarHtml] = useState<string | null>(null);
	const borderWidth = 2;
	// A small floor only. The old 8px floor above 60px dates from SVGs with
	// built-in margins; now it would clamp the per-icon overrides at 64px
	// (LiveChatAccess, mobile AskerInfo) to the same padding as the default.
	const minPadding = 2;
	// The border is subtracted first, or small ringed avatars (24px in
	// UserAvatar) shrink to ~50%.
	const fraction = artworkFraction(iconPaddingFor(avatar.file));
	const padding = Math.max(
		minPadding,
		Math.round((size * (1 - fraction) - borderWidth * 2) / 2)
	);
	const innerSize = Math.max(0, size - padding * 2 - borderWidth * 2);

	useEffect(() => {
		let canceled = false;
		setAvatarHtml(null);
		renderAvatarSvg(avatar)
			.then((html) => {
				if (!canceled) {
					setAvatarHtml(html);
				}
			})
			.catch(() => {
				if (!canceled) {
					setAvatarHtml(null);
				}
			});

		return () => {
			canceled = true;
		};
	}, [avatar]);

	return (
		<div
			style={{
				display: 'flex',
				padding,
				justifyContent: 'center',
				alignItems: 'center',
				borderRadius: size / 2,
				background: avatar.bg,
				width: size,
				height: size,
				boxSizing: 'border-box',
				border: `${borderWidth}px solid #c4c7c8`,
				boxShadow: '0 2px 8px 0 rgba(0, 0, 0, 0.10)',
				overflow: 'hidden',
				flexShrink: 0
			}}
		>
			<div
				style={{
					width: innerSize,
					height: innerSize,
					position: 'relative',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					overflow: 'visible'
				}}
				aria-hidden="true"
				dangerouslySetInnerHTML={
					avatarHtml ? { __html: avatarHtml } : undefined
				}
			/>
		</div>
	);
};
