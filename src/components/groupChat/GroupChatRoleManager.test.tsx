// @vitest-environment jsdom
import React from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

		fireEvent.change(
			screen.getByLabelText('groupChat.roles.roleLabel Bob'),
			{
				target: { value: 'CO_MODERATOR' }
			}
		);

		await waitFor(() =>
			expect(apiChangeGroupChatParticipantRole).toHaveBeenCalledWith(
				42,
				'target',
				'CO_MODERATOR'
			)
		);
		expect(
			screen.queryAllByRole('option', { name: 'groupChat.roles.OWNER' })
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

		fireEvent.change(
			screen.getByLabelText('groupChat.roles.roleLabel Bob'),
			{
				target: { value: 'CO_MODERATOR' }
			}
		);

		expect(
			(
				screen.getByRole('button', {
					name: 'groupChat.roles.transferLabel Charlie'
				}) as HTMLButtonElement
			).disabled
		).toBe(true);
		expect(
			(
				screen.getByLabelText(
					'groupChat.roles.roleLabel Charlie'
				) as HTMLSelectElement
			).disabled
		).toBe(true);
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

		const select = screen.getByLabelText(
			'groupChat.roles.roleLabel Bob'
		) as HTMLSelectElement;
		fireEvent.change(select, { target: { value: 'CO_MODERATOR' } });

		await screen.findByRole('alert');
		expect(select.value).toBe('PARTICIPANT');
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
		expect(screen.queryByText('Bob')).toBeNull();
	});
});
