// @vitest-environment oriso-jsdom
import React from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
	within
} from '@testing-library/react';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import {
	apiChangeGroupChatParticipantRole,
	apiRemoveGroupChatParticipant,
	apiTransferGroupChatOwnership
} from '../../api/apiGroupChatRoles';
import { GroupChatRoleManager } from './GroupChatRoleManager';

vi.mock('../../api/apiGroupChatRoles', () => ({
	apiChangeGroupChatParticipantRole: vi.fn(() => Promise.resolve()),
	apiRemoveGroupChatParticipant: vi.fn(() => Promise.resolve()),
	apiTransferGroupChatOwnership: vi.fn(() => Promise.resolve())
}));

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, options?: { name?: string }) =>
			options?.name ? `${key} ${options.name}` : key
	})
}));

const participants: UserService.Schemas.GroupChatParticipantDTO[] = [
	{ consultantId: 'owner', displayName: 'Alice', role: 'OWNER' },
	{ consultantId: 'target', displayName: 'Bob', role: 'PARTICIPANT' },
	{ consultantId: 'other', displayName: 'Charlie', role: 'PARTICIPANT' }
];

const roleSelect = (name: string) =>
	screen.getByRole('combobox', { name: `groupChat.roles.roleLabel ${name}` });

/** Opens the kit select (MUI menu, not a native list) and picks a role. */
const chooseRole = (name: string, role: string) => {
	fireEvent.mouseDown(roleSelect(name));
	fireEvent.click(
		within(screen.getByRole('listbox')).getByRole('option', {
			name: `groupChat.roles.${role}`
		})
	);
};

describe('GroupChatRoleManager', () => {
	beforeEach(() => vi.clearAllMocks());
	afterEach(cleanup);

	it('lets an owner assign explicit Series roles', async () => {
		render(
			<GroupChatRoleManager
				seriesId={42}
				currentUserId="owner"
				participants={participants}
			/>
		);

		chooseRole('Bob', 'CO_MODERATOR');

		await waitFor(() =>
			expect(apiChangeGroupChatParticipantRole).toHaveBeenCalledWith(
				42,
				'target',
				'CO_MODERATOR'
			)
		);
		// Focus comes back to the row's picker once the change settles.
		await waitFor(() =>
			expect(document.activeElement).toBe(roleSelect('Bob'))
		);
	});

	it('leaves focus where the user moved it while a change was running', async () => {
		let settle: () => void = () => undefined;
		vi.mocked(apiChangeGroupChatParticipantRole).mockReturnValueOnce(
			new Promise<void>((resolve) => {
				settle = resolve;
			})
		);
		render(
			<>
				<GroupChatRoleManager
					seriesId={42}
					currentUserId="owner"
					participants={participants}
				/>
				<button type="button">elsewhere</button>
			</>
		);
		chooseRole('Bob', 'CO_MODERATOR');
		const elsewhere = screen.getByRole('button', { name: 'elsewhere' });
		elsewhere.focus();
		settle();
		await waitFor(() =>
			expect(roleSelect('Bob').textContent).toBe(
				'groupChat.roles.CO_MODERATOR'
			)
		);
		expect(document.activeElement).toBe(elsewhere);
	});

	it('offers only co-moderator and participant, never owner', () => {
		render(
			<GroupChatRoleManager
				seriesId={42}
				currentUserId="owner"
				participants={participants}
			/>
		);
		fireEvent.mouseDown(roleSelect('Charlie'));
		const listbox = within(screen.getByRole('listbox'));
		expect(
			listbox.getByRole('option', { name: 'groupChat.roles.PARTICIPANT' })
		).toBeTruthy();
		expect(
			listbox.getByRole('option', {
				name: 'groupChat.roles.CO_MODERATOR'
			})
		).toBeTruthy();
		expect(
			listbox.queryAllByRole('option', { name: 'groupChat.roles.OWNER' })
		).toHaveLength(0);
	});

	it('locks every mutation control while one role update is pending', () => {
		vi.mocked(apiChangeGroupChatParticipantRole).mockReturnValueOnce(
			new Promise(() => undefined)
		);
		render(
			<GroupChatRoleManager
				seriesId={42}
				currentUserId="owner"
				participants={participants}
			/>
		);

		chooseRole('Bob', 'CO_MODERATOR');

		expect(
			(
				screen.getByRole('button', {
					name: 'groupChat.roles.transferLabel Charlie'
				}) as HTMLButtonElement
			).disabled
		).toBe(true);
		expect(roleSelect('Charlie').getAttribute('aria-disabled')).toBe(
			'true'
		);
	});

	it('keeps the previous role and shows an error when an update fails', async () => {
		vi.mocked(apiChangeGroupChatParticipantRole).mockRejectedValueOnce(
			new Error('network')
		);
		render(
			<GroupChatRoleManager
				seriesId={42}
				currentUserId="owner"
				participants={participants}
			/>
		);

		chooseRole('Bob', 'CO_MODERATOR');

		await screen.findByRole('alert');
		await waitFor(() =>
			expect(document.activeElement).toBe(roleSelect('Bob'))
		);
		expect(roleSelect('Bob').textContent).toBe(
			'groupChat.roles.PARTICIPANT'
		);
	});

	it('transfers primary ownership through a stable consultant id', async () => {
		render(
			<GroupChatRoleManager
				seriesId={42}
				currentUserId="owner"
				participants={participants}
			/>
		);

		fireEvent.click(
			screen.getByRole('button', {
				name: 'groupChat.roles.transferLabel Bob'
			})
		);

		await waitFor(() =>
			expect(apiTransferGroupChatOwnership).toHaveBeenCalledWith(
				42,
				'target'
			)
		);
	});

	it('keeps role controls read-only for non-owners', () => {
		render(
			<GroupChatRoleManager
				seriesId={42}
				currentUserId="target"
				participants={participants}
			/>
		);

		expect(
			screen.queryByLabelText('groupChat.roles.roleLabel Alice')
		).toBeNull();
		expect(screen.getByText('Alice')).toBeTruthy();
	});

	it('lets an owner remove a non-owner participant', async () => {
		render(
			<GroupChatRoleManager
				seriesId={42}
				currentUserId="owner"
				participants={participants}
			/>
		);

		fireEvent.click(
			screen.getByRole('button', {
				name: 'groupChat.roles.remove Bob'
			})
		);

		await waitFor(() =>
			expect(apiRemoveGroupChatParticipant).toHaveBeenCalledWith(
				42,
				'target'
			)
		);
		// The row is removed on a later render than the mutation call, so wait
		// for the DOM update rather than asserting it synchronously — otherwise
		// this races the re-render and flakes (Bob still present).
		await waitFor(() => expect(screen.queryByText('Bob')).toBeNull());
	});
});
