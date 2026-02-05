export const SUPERVISOR_FEEDBACK_PREFIX = '[SUPERVISOR_FEEDBACK]';
export const THREAD_PREFIX = '[THREAD:';
export const THREAD_SUFFIX = ']';

export const buildThreadPrefix = (rootId: string) =>
	`${THREAD_PREFIX}${rootId}${THREAD_SUFFIX}`;

export const parseMessagePrefixes = (message?: string | null) => {
	if (!message) {
		return {
			cleanedMessage: '',
			isSupervisorFeedback: false,
			isThreadMessage: false,
			threadRootId: null as string | null
		};
	}

	let cleanedMessage = message;
	let isSupervisorFeedback = false;
	let threadRootId: string | null = null;

	if (cleanedMessage.startsWith(THREAD_PREFIX)) {
		const endIndex = cleanedMessage.indexOf(THREAD_SUFFIX);
		if (endIndex > THREAD_PREFIX.length) {
			threadRootId = cleanedMessage.substring(THREAD_PREFIX.length, endIndex);
			cleanedMessage = cleanedMessage.substring(endIndex + 1).trimStart();
		}
	}

	if (cleanedMessage.startsWith(SUPERVISOR_FEEDBACK_PREFIX)) {
		isSupervisorFeedback = true;
		cleanedMessage = cleanedMessage
			.substring(SUPERVISOR_FEEDBACK_PREFIX.length)
			.trimStart();
	}

	return {
		cleanedMessage,
		isSupervisorFeedback,
		isThreadMessage: !!threadRootId,
		threadRootId
	};
};

