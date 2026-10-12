import { getCounsellingDpaFailure } from '../api/counsellingDpaFailure';
import type { NotificationDefaultType } from '../globalState/provider/NotificationsProvider';

/** Uses the existing notification surface; no deadline or permission decisions live here. */
export const getCounsellingDpaNotification = (
	error: unknown,
	translate: (key: string) => string
): NotificationDefaultType | null => {
	const failure = getCounsellingDpaFailure(error);
	if (!failure) return null;
	return {
		id: failure.key,
		notificationType: 'error',
		title: translate(`${failure.key}.title`),
		text: translate(`${failure.key}.text`),
		closeable: true,
		announce: 'alert'
	};
};
