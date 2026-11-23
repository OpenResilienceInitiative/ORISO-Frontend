export type SupervisorSystemMessageKind = 'added' | 'removed' | 'replaced';

/**
 * Title/description i18n keys of the timeline system note posted when a
 * supervisor is attached to, or detached from, a chat (OBP 2.1 #119).
 */
export const SUPERVISOR_SYSTEM_MESSAGE_KEYS: Record<
	SupervisorSystemMessageKind,
	{ title: string; description: string }
> = {
	added: {
		title: 'message.supervisionEnabledTitle',
		description: 'message.supervisionEnabledDescription'
	},
	removed: {
		title: 'message.supervisionDisabledTitle',
		description: 'message.supervisionDisabledDescription'
	},
	replaced: {
		title: 'message.supervisionChangedTitle',
		description: 'message.supervisionChangedDescription'
	}
};

export const buildSupervisorSystemMessagePayload = (
	kind: SupervisorSystemMessageKind,
	supervisorName: string,
	translate: (key: string, options?: Record<string, unknown>) => string,
	/** Replacement only: the supervisor who is no longer on the case. */
	previousName?: string
): string =>
	JSON.stringify({
		title: translate(SUPERVISOR_SYSTEM_MESSAGE_KEYS[kind].title),
		description: translate(
			SUPERVISOR_SYSTEM_MESSAGE_KEYS[kind].description,
			{
				name: supervisorName,
				from: previousName ?? ''
			}
		)
	});
