import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { GuestAccountMode } from '../../guestAccountMode/guestAccountMode';
import { DirectLink, directLinkGuestAccountMode } from './directLink';

/**
 * UserService#1662: the chip names the account a new person gets. Only
 * TEMPORARY is "Temporär"; GUEST_CHOOSES says "Gast wählt"; PERMANENT is
 * the plain case and has no chip.
 */
const CHIP_KEYS: Record<GuestAccountMode, string | null> = {
	TEMPORARY: 'directLink.temporary',
	GUEST_CHOOSES: 'guestAccountMode.option.GUEST_CHOOSES',
	PERMANENT: null
};

export const DirectLinkModeChip = ({
	link
}: {
	link: Pick<DirectLink, 'guestAccountMode' | 'temporary'>;
}) => {
	const { t } = useTranslation();
	const key = CHIP_KEYS[directLinkGuestAccountMode(link)];
	return key ? <span className="directLinkChip">{t(key)}</span> : null;
};
