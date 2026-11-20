import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as TemporaryClockIcon } from '../../resources/img/icons/temporary-clock.svg';
import './temporaryAccount.styles.scss';

/**
 * #1869: own row under the bubble time of a message that is deleted together
 * with its temporary account. Secondary pill with a filled clock and a word,
 * never colour alone.
 */
export const TemporaryMessageMarker = () => {
	const { t } = useTranslation();
	return (
		// A div: the bubble forces every inner span to `display: inline`.
		<div
			className="temporaryMessageMarker"
			title={t('temporaryAccount.marker.title')}
			data-testid="temporary-message-marker"
		>
			<TemporaryClockIcon
				className="temporaryMessageMarker__icon"
				aria-hidden
				focusable="false"
			/>
			{t('temporaryAccount.marker.label')}
		</div>
	);
};
