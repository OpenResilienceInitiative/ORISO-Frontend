import { useCallback, useContext, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
	AUTHORITIES,
	UserDataContext,
	hasUserAuthority
} from '../../globalState';
import {
	readEmailSetting,
	useEmailSettings
} from '../profile/EmailNotifications/emailSetting';
import type { DisplayFilterSection } from '../../utils/displayFilter/model';
import { usesNewNotifications } from '../../utils/newNotificationsToggle';
import { useAppConfig } from '../../hooks/useAppConfig';
import { emailSettingForKind } from './emailSettingForKind';
import type { DisplayFilterEmailColumn } from './DisplayFilterKindTable';

/**
 * Connects the dialog's E-Mail column to the profile's stored e-mail
 * preferences (FE#1377 redesign): reads them from the user data and saves
 * through the same write path as the profile page, which also decides what
 * a cell shows while saving (`useEmailSettings`). Mirrors the profile: no column while the
 * legacy notification screens are routed, no switches without an address
 * or while the master e-mail switch is off.
 */
export const useDisplayFilterEmailColumn = (
	section: DisplayFilterSection
): DisplayFilterEmailColumn | undefined => {
	const { t } = useTranslation();
	const newNotifications = usesNewNotifications(useAppConfig());
	const userData = useContext(UserDataContext)?.userData;
	const hasEmail = Boolean(userData?.email);
	// Delivery needs the profile's master switch too: without it, no cell
	// may claim "An" (gate, never flip the master from here).
	const emailsOn = readEmailSetting(userData, {
		kind: 'path',
		name: 'emailNotificationsEnabled'
	});
	const unavailableReason = !hasEmail
		? t('profile.notifications.noEmail.info')
		: !emailsOn
			? t('notifications.displayFilter.emailMasterOff')
			: undefined;
	const { read, change } = useEmailSettings();
	const role = hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData)
		? 'consultant'
		: 'asker';
	const onChange = useCallback(
		async (kindId: string, next: boolean) => {
			const entry = emailSettingForKind(section, kindId, role);
			if (entry) await change(entry.source, next);
		},
		[change, role, section]
	);

	const column = useMemo(
		() => ({
			cell: (kindId: string) => {
				if (unavailableReason) return null;
				const entry = emailSettingForKind(section, kindId, role);
				if (!entry) return null;
				return { checked: read(entry.source) };
			},
			onChange,
			unavailableReason
		}),
		[onChange, read, role, section, unavailableReason]
	);
	return newNotifications ? column : undefined;
};
