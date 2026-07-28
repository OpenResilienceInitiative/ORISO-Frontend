export const SUPERVISOR_FEEDBACK_PREFIX = '[SUPERVISOR_FEEDBACK]';
export const SYSTEM_NOTIFICATION_PREFIX = '[SYSTEM_NOTIFICATION]';
export const SYSTEM_NOTIFICATION_USER_LEFT_CHAT = 'USER_LEFT_CHAT';
export const SYSTEM_NOTIFICATION_CASE_HANDOVER_GRANTED =
	'CASE_HANDOVER_GRANTED';
export const VISIBLE_TO_PREFIX = '[VISIBLE_TO:';
const PREFIX_SUFFIX = ']';

// ADR-017 hard cut: `[THREAD:…]` is no longer a thread-identity carrier —
// thread membership lives solely in the native `m.thread` relation. The only
// remnant is a cosmetic strip (in parseMessagePrefixes) so leftover pre-dev
// prefix events don't render the raw token; it produces no thread semantics.
const LEGACY_THREAD_PREFIX = '[THREAD:';

export const buildVisibleToPrefix = (recipientIds: string[]) =>
	`${VISIBLE_TO_PREFIX}${recipientIds.join(',')}${PREFIX_SUFFIX}`;

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
			systemNotificationReasonLabel: '',
			systemNotificationExplanation: '',
			visibleToUserIds: [] as string[]
		};
	}

	let cleanedMessage = message;
	let isSupervisorFeedback = false;
	let isSystemNotification = false;
	let systemNotificationTitle = '';
	let systemNotificationDescription = '';
	let systemNotificationType: string | null = null;
	let systemNotificationUsername = '';
	let systemNotificationReasonLabel = '';
	let systemNotificationExplanation = '';
	let visibleToUserIds: string[] = [];

	let keepParsingPrefixes = true;
	while (keepParsingPrefixes) {
		keepParsingPrefixes = false;

		// ADR-017: cosmetically strip a leading [THREAD:…] token from leftover
		// pre-dev events so the raw marker never shows. No thread semantics are
		// derived — the token is simply discarded.
		if (cleanedMessage.startsWith(LEGACY_THREAD_PREFIX)) {
			const endIndex = cleanedMessage.indexOf(PREFIX_SUFFIX);
			if (endIndex > LEGACY_THREAD_PREFIX.length) {
				cleanedMessage = cleanedMessage
					.substring(endIndex + 1)
					.trimStart();
				keepParsingPrefixes = true;
				continue;
			}
		}

		if (cleanedMessage.startsWith(VISIBLE_TO_PREFIX)) {
			const endIndex = cleanedMessage.indexOf(PREFIX_SUFFIX);
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
				reasonLabel?: string;
				explanation?: string;
			};
			systemNotificationType = parsed?.type?.trim() || null;
			systemNotificationUsername = parsed?.username?.trim() || '';
			systemNotificationTitle = parsed?.title?.trim() || '';
			systemNotificationDescription = parsed?.description?.trim() || '';
			systemNotificationReasonLabel = parsed?.reasonLabel?.trim() || '';
			systemNotificationExplanation = parsed?.explanation?.trim() || '';
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
		systemNotificationReasonLabel,
		systemNotificationExplanation,
		visibleToUserIds
	};
};
