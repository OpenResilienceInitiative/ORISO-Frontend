export const SUPERVISOR_FEEDBACK_PREFIX = '[SUPERVISOR_FEEDBACK]';
export const SYSTEM_NOTIFICATION_PREFIX = '[SYSTEM_NOTIFICATION]';
export const SYSTEM_NOTIFICATION_USER_LEFT_CHAT = 'USER_LEFT_CHAT';
export const VISIBLE_TO_PREFIX = '[VISIBLE_TO:';
export const THREAD_PREFIX = '[THREAD:';
export const THREAD_SUFFIX = ']';

export const buildThreadPrefix = (rootId: string) =>
	`${THREAD_PREFIX}${rootId}${THREAD_SUFFIX}`;

export const buildVisibleToPrefix = (recipientIds: string[]) =>
	`${VISIBLE_TO_PREFIX}${recipientIds.join(',')}${THREAD_SUFFIX}`;

export const parseMessagePrefixes = (message?: string | null) => {
	if (!message) {
		return {
			cleanedMessage: '',
			isSupervisorFeedback: false,
			isSystemNotification: false,
			systemNotificationTitle: '',
			systemNotificationDescription: '',
			systemNotificationType: null as string | null,
			systemNotificationUsername: '',
			visibleToUserIds: [] as string[],
			isThreadMessage: false,
			threadRootId: null as string | null
		};
	}

	let cleanedMessage = message;
	let isSupervisorFeedback = false;
	let isSystemNotification = false;
	let systemNotificationTitle = '';
	let systemNotificationDescription = '';
	let systemNotificationType: string | null = null;
	let systemNotificationUsername = '';
	let visibleToUserIds: string[] = [];
	let threadRootId: string | null = null;

	let keepParsingPrefixes = true;
	while (keepParsingPrefixes) {
		keepParsingPrefixes = false;

		if (!threadRootId && cleanedMessage.startsWith(THREAD_PREFIX)) {
			const endIndex = cleanedMessage.indexOf(THREAD_SUFFIX);
			if (endIndex > THREAD_PREFIX.length) {
				threadRootId = cleanedMessage.substring(
					THREAD_PREFIX.length,
					endIndex
				);
				cleanedMessage = cleanedMessage
					.substring(endIndex + 1)
					.trimStart();
				keepParsingPrefixes = true;
				continue;
			}
		}

		if (cleanedMessage.startsWith(VISIBLE_TO_PREFIX)) {
			const endIndex = cleanedMessage.indexOf(THREAD_SUFFIX);
			if (endIndex > VISIBLE_TO_PREFIX.length) {
				const recipients = cleanedMessage
					.substring(VISIBLE_TO_PREFIX.length, endIndex)
					.split(',')
					.map((entry) => entry.trim())
					.filter(Boolean);
				visibleToUserIds = recipients;
				cleanedMessage = cleanedMessage
					.substring(endIndex + 1)
					.trimStart();
				keepParsingPrefixes = true;
				continue;
			}
		}

		if (
			!isSupervisorFeedback &&
			cleanedMessage.startsWith(SUPERVISOR_FEEDBACK_PREFIX)
		) {
			isSupervisorFeedback = true;
			cleanedMessage = cleanedMessage
				.substring(SUPERVISOR_FEEDBACK_PREFIX.length)
				.trimStart();
			keepParsingPrefixes = true;
			continue;
		}
	}

	if (cleanedMessage.startsWith(SYSTEM_NOTIFICATION_PREFIX)) {
		isSystemNotification = true;
		const payload = cleanedMessage
			.substring(SYSTEM_NOTIFICATION_PREFIX.length)
			.trimStart();
		try {
			const parsed = JSON.parse(payload) as {
				title?: string;
				description?: string;
				type?: string;
				username?: string;
			};
			systemNotificationType = parsed?.type?.trim() || null;
			systemNotificationUsername = parsed?.username?.trim() || '';
			systemNotificationTitle = parsed?.title?.trim() || '';
			systemNotificationDescription = parsed?.description?.trim() || '';
		} catch (_error) {
			const lines = payload
				.split('\n')
				.map((line) => line.trim())
				.filter(Boolean);
			systemNotificationTitle = lines[0] || '';
			systemNotificationDescription = lines.slice(1).join(' ');
		}
		cleanedMessage =
			systemNotificationDescription || systemNotificationTitle || payload;
	}

	return {
		cleanedMessage,
		isSupervisorFeedback,
		isSystemNotification,
		systemNotificationTitle,
		systemNotificationDescription,
		systemNotificationType,
		systemNotificationUsername,
		visibleToUserIds,
		isThreadMessage: !!threadRootId,
		threadRootId
	};
};
