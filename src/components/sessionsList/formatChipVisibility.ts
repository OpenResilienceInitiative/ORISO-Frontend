import { getConversationFormatAvailability } from '../conversationCreate/formatAvailability';

interface FormatChipVisibility {
	/** The "Neue Unterhaltung erstellen" entry in the toolbar. */
	createGroupChat: boolean;
	/** Filter chip for Gesprächskreise. */
	groups: boolean;
	/** Filter chip for internal conversations. */
	internalGroup: boolean;
}

/**
 * Which conversation-format entries the session-list toolbar shows.
 *
 * Read from the same availability the create flow uses, so the list can never
 * offer a filter — or an entry point — for a format the Träger has switched
 * off. The internal filter used to follow `featureSupervisionEnabled`, which
 * governs a different feature: on a Träger with supervision on and group chats
 * off it offered a filter for conversations nobody there can create.
 */
export const getFormatChipVisibility = (
	tenant: Parameters<typeof getConversationFormatAvailability>[0],
	showConsultantToolbarActions: boolean
): FormatChipVisibility => {
	const availability = getConversationFormatAvailability(tenant);

	return {
		// The create flow opens straight into whichever single format is left,
		// so the entry survives as long as one of them is available.
		createGroupChat:
			showConsultantToolbarActions &&
			(availability.circle || availability.internal),
		groups: showConsultantToolbarActions && availability.circle,
		internalGroup: showConsultantToolbarActions && availability.internal
	};
};
