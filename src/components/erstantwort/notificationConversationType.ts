import { getModalityIfKnown, type ModalityInput } from '../session/getModality';

/** Matches the server's persisted session context and legacy registration fallback.
 * Team-agency ownership is independent of conversation modality.
 */
export const notificationConversationType = (
	input?: ModalityInput
): string | undefined => {
	if (!input) return undefined;
	const wrapped = 'item' in input ? input : undefined;
	const session =
		wrapped && !wrapped.isGroup
			? wrapped.item
			: 'session' in input
				? input.session
				: undefined;
	if (session) {
		if (session.conversationType != null) return session.conversationType;
		return String(session.registrationType) === 'ANONYMOUS'
			? 'LIVE_CHAT'
			: 'AGENCY_COUNSELLING';
	}
	return getModalityIfKnown(input);
};
