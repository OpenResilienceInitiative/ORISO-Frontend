import {
	AUTHORITIES,
	hasUserAuthority
} from '../../../globalState/helpers/stateHelpers';
import type { UserDataInterface } from '../../../globalState/interfaces/UserDataInterface';
import type { NotificationRole } from '../../../utils/notificationSettings/notificationChannelCapability';

/**
 * Whose notifications the settings rows describe. Undefined until the user
 * data has loaded: guessing "advice seeker" for a counsellor would briefly
 * show them the wrong rows.
 */
export const notificationRoleFor = (
	userData: UserDataInterface | null | undefined
): NotificationRole | undefined => {
	if (!Array.isArray(userData?.grantedAuthorities)) {
		return undefined;
	}
	return hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData)
		? 'consultant'
		: 'asker';
};
