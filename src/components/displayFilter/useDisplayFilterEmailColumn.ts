import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
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
import { emailSettingForKind } from './emailSettingForKind';
import type { DisplayFilterEmailColumn } from './DisplayFilterKindTable';

/**
 * Connects the dialog's E-Mail column to the profile's stored e-mail
 * preferences (FE#1377 redesign): reads them from the user data and saves
 * through the same write path as the profile page. Optimistic while saving,
 * put back when the save fails.
 */
export const useDisplayFilterEmailColumn = (
	section: DisplayFilterSection
): DisplayFilterEmailColumn => {
	const userData = useContext(UserDataContext)?.userData;
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

	return useMemo(
		() => ({
			cell: (kindId: string) => {
				const entry = emailSettingForKind(section, kindId, role);
				if (!entry) return null;
				return {
					checked:
						pending[emailSettingKey(entry.source)] ??
						readEmailSetting(userData, entry.source)
				};
			},
			onChange
		}),
		[onChange, pending, role, section, userData]
	);
};
