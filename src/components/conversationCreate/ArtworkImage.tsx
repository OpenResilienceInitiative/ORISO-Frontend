import * as React from 'react';
import { CardArtwork } from '../../resources/img/topics';

interface ArtworkImageProps {
	'artwork': CardArtwork;
	'alt': string;
	'className'?: string;
	'sizes'?: string;
	'aria-hidden'?: boolean;
}

/** Shared responsive media for format cards and their compact mobile rows. */
export const ArtworkImage = ({
	artwork,
	alt,
	className = 'formatCard__mediaImage',
	sizes = '(max-width: 600px) calc(100vw - 48px), 360px',
	...props
}: ArtworkImageProps) => (
	<img
		className={className}
		src={artwork.src}
		srcSet={`${artwork.src} 640w, ${artwork.src1280} 1280w`}
		sizes={sizes}
		alt={alt}
		width={640}
		height={360}
		loading="lazy"
		{...props}
	/>
);
