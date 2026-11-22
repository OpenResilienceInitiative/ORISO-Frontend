// @vitest-environment oriso-jsdom
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import {
	InternalChatInvitationError,
	apiGetInternalChatInvitationRecipients,
	apiInviteInternalChatParticipant
} from '../../api/apiInternalChatInvitation';
import { createInternalChatPeopleSource } from './internalChatPeopleSource';
import { PersonChangeRefusedError } from './managedPeople';

vi.mock('../../api/apiInternalChatInvitation', async (importOriginal) => ({
	...(await importOriginal<
		typeof import('../../api/apiInternalChatInvitation')
	>()),
	apiGetInternalChatInvitationRecipients: vi.fn(),
	apiInviteInternalChatParticipant: vi.fn()
}));

const participants = [
	{ consultantId: 'marge', displayName: 'Marge Simpson', role: 'OWNER' },
	{ consultantId: 'me', displayName: 'Herb Powell', role: 'PARTICIPANT' },
	{ consultantId: 'patty', displayName: 'enc.OBQXI5DZ', role: 'CO_MODERATOR' }
] as any;

const source = (onChanged = vi.fn()) =>
	createInternalChatPeopleSource({
		chatId: 77,
		getParticipants: () => participants,
		currentConsultantId: 'me',
		onChanged
	});

describe('createInternalChatPeopleSource', () => {
	beforeEach(() => vi.resetAllMocks());

	it('lists the people in the chat with their role, never an encoded name', async () => {
		const members = await source().loadMembers();

		expect(members.map(({ id, role }) => [id, role])).toEqual([
			['marge', 'owner'],
			['me', 'participant'],
			['patty', 'coModerator']
		]);
		expect(members.find(({ id }) => id === 'me')?.isSelf).toBe(true);
		expect(members.every(({ name }) => !name.startsWith('enc.'))).toBe(
			true
		);
		// Inviting is all this chat allows: nobody can be removed or swapped here.
		expect(
			members.some(({ canRemove, canReplace }) => canRemove || canReplace)
		).toBe(false);
	});

	it('offers the colleagues the room accepts, with their counselling centre', async () => {
		vi.mocked(apiGetInternalChatInvitationRecipients).mockResolvedValue([
			{
				consultantId: 'selma',
				displayName: 'Selma Bouvier',
				tenantName: 'Springfield QA Dev',
				agencies: [{ id: 2, name: 'Beratungsstelle Berlin' }]
			}
		]);

		const candidates = await source().loadCandidates!();

		expect(apiGetInternalChatInvitationRecipients).toHaveBeenCalledWith(77);
		expect(candidates).toEqual([
			{
				id: 'selma',
				name: 'Selma Bouvier',
				organisation: 'Beratungsstelle Berlin'
			}
		]);
	});

	it('shows "nobody else can be added" when the room refuses newcomers', async () => {
		vi.mocked(apiGetInternalChatInvitationRecipients).mockRejectedValue(
			new InternalChatInvitationError('INTERNAL_CHAT_HISTORY_SHARED', 409)
		);

		await expect(source().loadCandidates!()).resolves.toEqual([]);
	});

	it('keeps a failed candidate load retryable', async () => {
		vi.mocked(apiGetInternalChatInvitationRecipients).mockRejectedValue(
			new InternalChatInvitationError('INTERNAL_CHAT_BUSY', 503)
		);

		await expect(source().loadCandidates!()).rejects.toBeInstanceOf(
			InternalChatInvitationError
		);
	});

	it('invites without asking for a reason and reports the change', async () => {
		const onChanged = vi.fn();
		const chat = source(onChanged);

		expect(chat.requiresReason).toBeFalsy();
		await chat.addPerson!(
			{ id: 'selma', name: 'Selma Bouvier' },
			{ reason: undefined }
		);

		expect(apiInviteInternalChatParticipant).toHaveBeenCalledWith(
			77,
			'selma'
		);
		expect(onChanged).toHaveBeenCalledWith({
			kind: 'added',
			name: 'Selma Bouvier'
		});
	});

	it('turns a refusal by the server into the dialog refusal state', async () => {
		vi.mocked(apiInviteInternalChatParticipant).mockRejectedValue(
			new InternalChatInvitationError(
				'INTERNAL_CHAT_RECIPIENT_OUT_OF_SCOPE',
				403
			)
		);

		await expect(
			source().addPerson!({ id: 'selma', name: 'Selma' }, {})
		).rejects.toBeInstanceOf(PersonChangeRefusedError);
	});

	it('keeps a busy server retryable', async () => {
		vi.mocked(apiInviteInternalChatParticipant).mockRejectedValue(
			new InternalChatInvitationError('INTERNAL_CHAT_BUSY', 503)
		);

		const error = await source().addPerson!(
			{ id: 'selma', name: 'Selma' },
			{}
		).catch((e) => e);

		expect(error).not.toBeInstanceOf(PersonChangeRefusedError);
	});
});
