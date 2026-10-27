import * as React from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import HourglassEmptyRoundedIcon from '@mui/icons-material/HourglassEmptyRounded';
import BookmarkAddedOutlinedIcon from '@mui/icons-material/BookmarkAddedOutlined';
import { MessageRetention } from './messageRetention';
import './temporaryAccount.styles.scss';

export interface GuestRetentionChipProps {
	/** What happens to this guest's messages when the account is deleted. */
	retention: MessageRetention;
}

/**
 * #1869: in the conversation header, so the counsellor knows before reading
 * whether the guest's messages stay after the temporary account is gone.
 */
export const GuestRetentionChip = ({ retention }: GuestRetentionChipProps) => {
	const { t } = useTranslation();
	const Icon =
		retention === 'delete'
			? HourglassEmptyRoundedIcon
			: BookmarkAddedOutlinedIcon;
	return (
		<span
			className={clsx(
				'guestRetentionChip',
				`guestRetentionChip--${retention}`
			)}
			data-testid="guest-retention-chip"
		>
			<Icon className="guestRetentionChip__icon" aria-hidden />
			<span>{t('temporaryAccount.chip.guest')}</span>
			<span aria-hidden className="guestRetentionChip__dot">
				·
			</span>
			<span>{t(`temporaryAccount.chip.${retention}`)}</span>
		</span>
	);
};
