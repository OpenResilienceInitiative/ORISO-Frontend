// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));
vi.mock('../emptyState/EmptyStateAnimation', () => ({
	EmptyStateAnimation: () => null
}));

const { GroupChatNotMember } = await import('./GroupChatNotMember');
type JoinRequestView = NonNullable<
	React.ComponentProps<typeof GroupChatNotMember>['joinRequest']
>;

afterEach(cleanup);

const renderNotice = (joinRequest?: Partial<JoinRequestView>) => {
	const handlers = {
		onBack: vi.fn(),
		onRequest: vi.fn(),
		onCancel: vi.fn(),
		onOpenGroup: vi.fn()
	};
	render(
		<GroupChatNotMember
			onBack={handlers.onBack}
			joinRequest={
				joinRequest && {
					state: 'idle',
					onRequest: handlers.onRequest,
					onCancel: handlers.onCancel,
					onOpenGroup: handlers.onOpenGroup,
					...joinRequest
				}
			}
		/>
	);
	return handlers;
};

const button = (name: string) => screen.getByRole('button', { name });

describe('GroupChatNotMember — knock to join', () => {
	it('without a knock offers only the way back (today’s notice)', () => {
		renderNotice();

		expect(screen.getByText('groupChat.notMember.headline')).toBeTruthy();
		expect(screen.getAllByRole('button')).toHaveLength(1);
		expect(button('groupChat.notMember.back')).toBeTruthy();
	});

	it('offers to ask the moderation to be let in', async () => {
		const handlers = renderNotice({ state: 'idle' });

		expect(screen.getByText('groupChat.notMember.knockBody')).toBeTruthy();
		await userEvent.click(button('groupChat.notMember.request'));

		expect(handlers.onRequest).toHaveBeenCalledTimes(1);
	});

	it('greys the request out while it is being sent', () => {
		renderNotice({ state: 'sending' });

		expect(
			button('groupChat.notMember.request').hasAttribute('disabled')
		).toBe(true);
	});

	it('says the request went out, and lets her take it back', async () => {
		const handlers = renderNotice({ state: 'pending' });

		expect(
			screen.getByText('groupChat.notMember.pendingHeadline')
		).toBeTruthy();
		await userEvent.click(button('groupChat.notMember.cancel'));
		expect(handlers.onCancel).toHaveBeenCalledTimes(1);
		await userEvent.click(button('groupChat.notMember.back'));
		expect(handlers.onBack).toHaveBeenCalledTimes(1);
	});

	it('when admitted, opens the group', async () => {
		const handlers = renderNotice({ state: 'admitted' });

		expect(
			screen.getByText('groupChat.notMember.admittedHeadline')
		).toBeTruthy();
		await userEvent.click(button('groupChat.notMember.openGroup'));
		expect(handlers.onOpenGroup).toHaveBeenCalledTimes(1);
	});

	it('when declined, says so kindly and only offers the way back', () => {
		renderNotice({ state: 'declined' });

		expect(
			screen.getByText('groupChat.notMember.declinedHeadline')
		).toBeTruthy();
		expect(screen.getAllByRole('button')).toHaveLength(1);
		expect(button('groupChat.notMember.back')).toBeTruthy();
	});

	it('when sending failed, says so and lets her try again', async () => {
		const handlers = renderNotice({ state: 'error' });

		expect(screen.getByRole('alert').textContent).toBe(
			'groupChat.notMember.requestFailed'
		);
		await userEvent.click(button('groupChat.notMember.request'));
		expect(handlers.onRequest).toHaveBeenCalledTimes(1);
	});

	it('when the invite link is no longer valid, says so and offers no retry', () => {
		renderNotice({ state: 'linkInvalid' });

		expect(screen.getByRole('alert').textContent).toBe(
			'groupChat.notMember.linkInvalid'
		);
		expect(screen.getAllByRole('button')).toHaveLength(1);
		expect(button('groupChat.notMember.back')).toBeTruthy();
	});
});
