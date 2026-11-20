import { getCounsellingDpaFailure } from '../api/counsellingDpaFailure';
import type { NotificationDefaultType } from '../globalState/provider/NotificationsProvider';

/**
 * A group is not a counselling: when someone JOINS a group, the refusal must not
 * say "new counselling". Same server refusal, accurate wording.
 */
const COPY_KEY_FOR_GROUP_JOIN = 'counselling.dpa.restrictedGroupJoin';

/** Uses the existing notification surface; no deadline or permission decisions live here. */
export const getCounsellingDpaNotification = (
	error: unknown,
	translate: (key: string) => string,
	options: { groupJoin?: boolean } = {}
): NotificationDefaultType | null => {
	const failure = getCounsellingDpaFailure(error);
	if (!failure) return null;
	const copyKey =
		options.groupJoin && failure.key === 'counselling.dpa.restricted'
			? COPY_KEY_FOR_GROUP_JOIN
			: failure.key;
	return {
		id: failure.key,
		notificationType: 'error',
		title: translate(`${copyKey}.title`),
		text: translate(`${copyKey}.text`),
		closeable: true,
		announce: 'alert'
	};
};
