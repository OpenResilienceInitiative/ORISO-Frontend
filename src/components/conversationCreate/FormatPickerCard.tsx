import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { CardArtwork } from '../../resources/img/topics';
import { ArtworkImage } from './ArtworkImage';
import { FormatCard } from './FormatCard';

/**
 * Format card for phones and tablets: the same card shell as the desktop
 * picker (`FormatCard`) with header, artwork and one short line, and a
 * "Auswählen" button that opens the format's settings. Replaces the flat
 * list rows, so the formats look like cards on every viewport
 * (Frank, 2026-11-21).
 */

interface FormatPickerCardProps {
	'icon': React.ReactNode;
	'title': string;
	'subtitle': string;
	/** One short line under the artwork. */
	'text': string;
	'image': CardArtwork;
	'onSelect': () => void;
	'headerAction'?: React.ReactNode;
	'className'?: string;
	'data-cy'?: string;
}

export const FormatPickerCard = ({
	icon,
	title,
	subtitle,
	text,
	image,
	onSelect,
	headerAction,
	className,
	'data-cy': dataCy
}: FormatPickerCardProps) => {
	const { t } = useTranslation();
	return (
		<div className={`formatPickerCard${className ? ` ${className}` : ''}`}>
			<FormatCard
				className="formatPickerCard__card"
				title={title}
				subtitle={subtitle}
				avatar={icon}
				headerAction={headerAction}
				media={<ArtworkImage artwork={image} sizes="360px" alt="" />}
			>
				<p className="conversationCreate__cardText formatPickerCard__text">
					{text}
				</p>
				<div className="conversationCreate__cardActions">
					<button
						type="button"
						className="formatPickerCard__choose"
						onClick={onSelect}
						aria-label={`${title}: ${t('groupChat.format.choose')}`}
						data-cy={dataCy}
					>
						{t('groupChat.format.choose')}
					</button>
				</div>
			</FormatCard>
		</div>
	);
};
