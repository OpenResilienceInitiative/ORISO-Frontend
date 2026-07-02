import React, { useEffect, useState } from 'react';
import { type Avatar, renderAvatarSvg } from '../../utils/pseudonymGenerator';

interface AnimalAvatarProps {
	avatar: Avatar;
	/** Outer circle size in px (Figma default = 108) */
	size?: number;
}

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
	const padding = Math.max(14, Math.round(size * 0.18));
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
