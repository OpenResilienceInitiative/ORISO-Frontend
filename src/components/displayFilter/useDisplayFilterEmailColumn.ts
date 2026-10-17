import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	AUTHORITIES,
	UserDataContext,
	hasUserAuthority
} from '../../globalState';
import {
	emailSettingKey,
	readEmailSetting,
	useSaveEmailSetting
} from '../profile/EmailNotifications/emailSetting';
import type { DisplayFilterSection } from '../../utils/displayFilter/model';
import { usesNewNotifications } from '../../utils/newNotificationsToggle';
import { useAppConfig } from '../../hooks/useAppConfig';
import { emailSettingForKind } from './emailSettingForKind';
import type { DisplayFilterEmailColumn } from './DisplayFilterKindTable';

/**
 * Connects the dialog's E-Mail column to the profile's stored e-mail
 * preferences (FE#1377 redesign): reads them from the user data and saves
 * through the same write path as the profile page. Optimistic while saving,
 * put back when the save fails. Mirrors the profile: no column while the
 * legacy notification screens are routed, no switches without an address.
 */
export const useDisplayFilterEmailColumn = (
	section: DisplayFilterSection
): DisplayFilterEmailColumn | undefined => {
	const { t } = useTranslation();
	const newNotifications = usesNewNotifications(useAppConfig());
	const userData = useContext(UserDataContext)?.userData;
	const hasEmail = Boolean(userData?.email);
	const save = useSaveEmailSetting();
	const role = hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData)
		? 'consultant'
		: 'asker';
	const [pending, setPending] = useState<Record<string, boolean>>({});
	// Fresh user data is the stored truth: drop the optimistic values.
	useEffect(() => setPending({}), [userData]);

	const onChange = useCallback(
		async (kindId: string, next: boolean) => {
			const entry = emailSettingForKind(section, kindId, role);
			if (!entry) return;
			const key = emailSettingKey(entry.source);
			setPending((current) => ({ ...current, [key]: next }));
			if (!(await save(entry.source, next))) {
				setPending((current) => ({ ...current, [key]: !next }));
			}
		},
		[role, save, section]
	);

	const column = useMemo(
		() => ({
			cell: (kindId: string) => {
				if (!hasEmail) return null;
				const entry = emailSettingForKind(section, kindId, role);
				if (!entry) return null;
				return {
					checked:
						pending[emailSettingKey(entry.source)] ??
						readEmailSetting(userData, entry.source)
				};
			},
			onChange,
			unavailableReason: hasEmail
				? undefined
				: t('profile.notifications.noEmail.info')
		}),
		[hasEmail, onChange, pending, role, section, t, userData]
	);
	return newNotifications ? column : undefined;
};
