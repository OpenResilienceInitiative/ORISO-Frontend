import {
	InternalChatInvitationError,
	apiGetInternalChatInvitationRecipients,
	apiInviteInternalChatParticipant
} from '../../api/apiInternalChatInvitation';
import {
	ManagedPeopleSource,
	ManagedPerson,
	ManagedPersonRole,
	PersonChangeRefusedError,
	readablePersonName
} from './managedPeople';

type Participant = UserService.Schemas.GroupChatParticipantDTO;

export interface InternalChatPeopleSourceOptions {
	/** The running internal chat (the group chat id). */
	chatId: number;
	/** The chat's current participants, read fresh on every load. */
	getParticipants: () => Participant[] | undefined;
	currentConsultantId?: string | null;
	/** After an invitation: refresh the chat, tell the user. */
	onChanged?: (change: {
		kind: 'added';
		name: string;
	}) => void | Promise<void>;
}

const ROLES: Record<string, ManagedPersonRole> = {
	OWNER: 'owner',
	CO_MODERATOR: 'coModerator'
};

const asRefusal = (error: unknown): unknown =>
	error instanceof InternalChatInvitationError && error.refused
		? new PersonChangeRefusedError(error.reason)
		: error;

/**
 * People of a running members-only internal chat (ORISO-Frontend#2023).
 * Anyone who takes part may invite a colleague; UserService decides who is
 * in scope and refuses rooms that would show earlier messages to a newcomer.
 * Nobody is removed or swapped from here.
 */
export const createInternalChatPeopleSource = ({
	chatId,
	getParticipants,
	currentConsultantId,
	onChanged
}: InternalChatPeopleSourceOptions): ManagedPeopleSource => ({
	kind: 'internalChat',
	loadMembers: async () =>
		(getParticipants() ?? []).map(
			(participant): ManagedPerson => ({
				id: participant.consultantId,
				name: readablePersonName(
					participant.displayName,
					null,
					participant.consultantId
				),
				role: ROLES[participant.role ?? ''] ?? 'participant',
				isSelf: participant.consultantId === currentConsultantId,
				canRemove: false,
				canReplace: false
			})
		),
	loadCandidates: async () => {
		try {
			const recipients =
				await apiGetInternalChatInvitationRecipients(chatId);
			return recipients.map((recipient) => ({
				id: recipient.consultantId,
				name: readablePersonName(
					recipient.displayName,
					null,
					recipient.consultantId
				),
				organisation:
					recipient.agencies
						?.map(({ name }) => name)
						.filter(Boolean)
						.join(', ') ||
					recipient.tenantName ||
					undefined
			}));
		} catch (error) {
			// A room that refuses newcomers (for example because it would show
			// earlier messages) has nobody to offer; that is not a load error.
			if (error instanceof InternalChatInvitationError && error.refused) {
				return [];
			}
			throw error;
		}
	},
	addPerson: async (candidate) => {
		try {
			await apiInviteInternalChatParticipant(chatId, candidate.id);
		} catch (error) {
			throw asRefusal(error);
		}
		await onChanged?.({ kind: 'added', name: candidate.name });
	}
});
