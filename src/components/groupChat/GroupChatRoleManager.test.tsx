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
	useTranslation: () => ({ t: (key: string) => key })
}));

const participants: UserService.Schemas.GroupChatParticipantDTO[] = [
	{ consultantId: 'owner', displayName: 'Alice', role: 'OWNER' },
	{ consultantId: 'target', displayName: 'Bob', role: 'PARTICIPANT' }
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

		fireEvent.change(screen.getByLabelText('Role for Bob'), {
			target: { value: 'CO_MODERATOR' }
		});

		await waitFor(() =>
			expect(apiChangeGroupChatParticipantRole).toHaveBeenCalledWith(
				42,
				'target',
				'CO_MODERATOR'
			)
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
				name: 'groupChat.roles.transfer Bob'
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

		expect(screen.queryByLabelText('Role for Alice')).toBeNull();
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
