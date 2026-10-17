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
			// The active option stays clickable: no write, nothing to undo.
			const previous =
				pending[key] ?? readEmailSetting(userData, entry.source);
			if (next === previous) return;
			setPending((current) => ({ ...current, [key]: next }));
			if (!(await save(entry.source, next))) {
				setPending((current) => ({ ...current, [key]: previous }));
			}
		},
		[pending, role, save, section, userData]
	);

	const column = useMemo(
		() => ({
			cell: (kindId: string) => {
				if (unavailableReason) return null;
				const entry = emailSettingForKind(section, kindId, role);
				if (!entry) return null;
				return {
					checked:
						pending[emailSettingKey(entry.source)] ??
						readEmailSetting(userData, entry.source)
				};
			},
			onChange,
			unavailableReason
		}),
		[onChange, pending, role, section, unavailableReason, userData]
	);
	return newNotifications ? column : undefined;
};
