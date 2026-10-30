import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as InfoIcon } from '../../resources/img/icons/i.svg';
import { MISSING_KEY_COPY_KEY as COPY_KEY } from '../../utils/matrixDecryptionFailure';
import { MessageDateDivider } from './MessageDateDivider';
import './missingKeyPlaceholder.styles.scss';

export interface MissingKeyPlaceholderProps {
	/** How many consecutive earlier messages this one notice stands for. */
	count: number;
	/** Date divider of the first message, already translated (if it has one). */
	dateLabel?: string;
}

/**
 * Honest placeholder for earlier messages whose room key this device never
 * received (#1827): not an error, the keys only reach devices that existed
 * when the message was sent. Says what is the case and what helps, without
 * alarm wording.
 */
export const MissingKeyPlaceholder: React.FC<MissingKeyPlaceholderProps> = ({
	count,
	dateLabel
}) => {
	const { t: translate } = useTranslation();
	return (
		<>
			{dateLabel && <MessageDateDivider label={dateLabel} />}
			<div className="missingKeyPlaceholder" role="status">
				<InfoIcon
					className="missingKeyPlaceholder__icon"
					aria-hidden="true"
					focusable="false"
				/>
				<div className="missingKeyPlaceholder__text">
					<p className="missingKeyPlaceholder__title">
						{translate(`${COPY_KEY}.title`, { count })}
					</p>
					<p className="missingKeyPlaceholder__hint">
						{translate(`${COPY_KEY}.hint`, { count })}
					</p>
				</div>
			</div>
		</>
	);
};
