import * as React from 'react';
import { useTranslation } from 'react-i18next';
import HourglassEmptyRoundedIcon from '@mui/icons-material/HourglassEmptyRounded';
import './temporaryAccount.styles.scss';

/**
 * #1869: next to the bubble time of a message that is deleted together with
 * its temporary account. Icon plus word, never colour alone.
 */
export const TemporaryMessageMarker = () => {
	const { t } = useTranslation();
	return (
		<span
			className="temporaryMessageMarker"
			title={t('temporaryAccount.marker.title')}
			data-testid="temporary-message-marker"
		>
			<HourglassEmptyRoundedIcon
				className="temporaryMessageMarker__icon"
				aria-hidden
				focusable="false"
			/>
			{t('temporaryAccount.marker.label')}
			<span className="sr-only">
				{`, ${t('temporaryAccount.marker.title')}`}
			</span>
		</span>
	);
};
