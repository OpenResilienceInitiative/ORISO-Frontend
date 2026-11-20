import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { MessageDateDivider } from '../message/MessageDateDivider';
import { ReactComponent as TemporaryClockIcon } from '../../resources/img/icons/temporary-clock.svg';
import { MessageRetention } from './messageRetention';

export interface GuestRetentionDividerProps {
	/** What happens to this guest's messages when the account is deleted. */
	retention: MessageRetention;
}

/**
 * #1869: a status line in the timeline (same divider as the date). Says
 * "Temporär" only when the messages go with the account. No extra header.
 */
export const GuestRetentionDivider = ({
	retention
}: GuestRetentionDividerProps) => {
	const { t } = useTranslation();
	return (
		<div data-testid="guest-retention-divider">
			<MessageDateDivider
				tone="secondary"
				icon={<TemporaryClockIcon focusable="false" />}
				label={
					retention === 'delete'
						? `${t('temporaryAccount.chip.guest')} · ${t('temporaryAccount.marker.label')}`
						: t('temporaryAccount.chip.guest')
				}
			/>
		</div>
	);
};
