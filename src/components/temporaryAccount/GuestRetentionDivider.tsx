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
 * #1869: a status line in the timeline (same divider as the date), so both
 * counsellor and guest see what happens to the guest's messages. No extra
 * header element.
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
				label={`${t('temporaryAccount.chip.guest')} · ${t(
					`temporaryAccount.chip.${retention}`
				)}`}
			/>
		</div>
	);
};
