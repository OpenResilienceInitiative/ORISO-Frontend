// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GroupChatJoinRequest } from './joinRequestModel';

/* Keys come back with their values, so a test can see WHAT was said without
   depending on the German wording. */
vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, values?: Record<string, unknown>) =>
			values
				? `${key}(${Object.entries(values)
						.map(([name, value]) => `${name}=${value}`)
						.join(',')})`
				: key,
		i18n: { language: 'de' }
	})
}));

const { JoinRequestSnackbar } = await import('./JoinRequestSnackbar');
const { JoinRequestDialog } = await import('./JoinRequestDialog');

afterEach(cleanup);

const NOW = new Date('2026-09-23T14:35:00+02:00');

const request = (
	overrides: Partial<GroupChatJoinRequest['requester']> = {},
	viewerRole: GroupChatJoinRequest['viewerRole'] = 'OWNER'
): GroupChatJoinRequest => ({
	id: 41,
	seriesId: 9101,
	groupTitle: 'HIV und Aids',
	status: 'PENDING',
	requestedAt: '2026-09-23T14:32:00+02:00',
	via: 'INVITE_LINK',
	viewerRole,
	requester: {
		consultantId: 'c-anna',
		displayName: 'Anna Berg',
		agencyName: 'Beratungsstelle Nord',
		tenantName: 'Caritas Köln',
		sameAgency: false,
		sameTenant: true,
		...overrides
	}
});

describe('JoinRequestSnackbar', () => {
	it('says who is asking, from where, how and when', () => {
		render(
			<JoinRequestSnackbar
				request={request()}
				now={NOW}
				onAdmit={vi.fn()}
				onDecline={vi.fn()}
				onDetails={vi.fn()}
			/>
		);
		const card = screen.getByRole('group', { name: /Anna Berg/ });

		expect(within(card).getByText('Anna Berg')).toBeTruthy();
		expect(
			within(card).getByText(
				'groupChat.joinRequest.knocks(group=HIV und Aids)'
			)
		).toBeTruthy();
		expect(card.textContent).toContain('Beratungsstelle Nord');
		expect(card.textContent).toContain('Caritas Köln');
		expect(card.textContent).toContain(
			'groupChat.joinRequest.viaInviteLink'
		);
		expect(card.textContent).toContain(
			'groupChat.joinRequest.minutesAgo(count=3)'
		);
	});

	it('lets the moderator admit, decline or open the details', async () => {
		const onAdmit = vi.fn();
		const onDecline = vi.fn();
		const onDetails = vi.fn();
		render(
			<JoinRequestSnackbar
				request={request()}
				now={NOW}
				onAdmit={onAdmit}
				onDecline={onDecline}
				onDetails={onDetails}
			/>
		);

		await userEvent.click(
			screen.getByRole('button', { name: 'groupChat.joinRequest.admit' })
		);
		await userEvent.click(
			screen.getByRole('button', {
				name: 'groupChat.joinRequest.decline'
			})
		);
		await userEvent.click(
			screen.getByRole('button', {
				name: 'groupChat.joinRequest.details'
			})
		);

		expect(onAdmit).toHaveBeenCalledTimes(1);
		expect(onDecline).toHaveBeenCalledTimes(1);
		expect(onDetails).toHaveBeenCalledTimes(1);
	});

	it('greys out both decisions while one is on its way, and keeps them visible', () => {
		render(
			<JoinRequestSnackbar
				request={request()}
				now={NOW}
				busy
				onAdmit={vi.fn()}
				onDecline={vi.fn()}
				onDetails={vi.fn()}
			/>
		);

		expect(
			screen
				.getByRole('button', { name: 'groupChat.joinRequest.admit' })
				.hasAttribute('disabled')
		).toBe(true);
		expect(
			screen
				.getByRole('button', { name: 'groupChat.joinRequest.decline' })
				.hasAttribute('disabled')
		).toBe(true);
	});
});

describe('JoinRequestDialog', () => {
	const renderDialog = (
		props: Partial<React.ComponentProps<typeof JoinRequestDialog>> = {}
	) => {
		const handlers = {
			onAdmit: vi.fn(),
			onDecline: vi.fn(),
			onClose: vi.fn()
		};
		render(
			<JoinRequestDialog
				open
				request={request()}
				now={NOW}
				{...handlers}
				{...props}
			/>
		);
		return handlers;
	};

	it('shows the full picture of the person asking', () => {
		renderDialog();
		const dialog = screen.getByRole('dialog');

		expect(dialog.textContent).toContain(
			'groupChat.joinRequest.dialog.title(name=Anna Berg)'
		);
		expect(dialog.textContent).toContain('Beratungsstelle Nord');
		expect(dialog.textContent).toContain('Caritas Köln');
		expect(dialog.textContent).toContain(
			'groupChat.joinRequest.otherAgency'
		);
		expect(dialog.textContent).toContain(
			'groupChat.joinRequest.viaInviteLink'
		);
	});

	it('admits as participant unless the owner picks co-moderation', async () => {
		const first = renderDialog();
		await userEvent.click(
			screen.getByRole('button', { name: 'groupChat.joinRequest.admit' })
		);
		expect(first.onAdmit).toHaveBeenLastCalledWith('PARTICIPANT');
		cleanup();

		const second = renderDialog();
		await userEvent.click(
			screen.getByRole('radio', {
				name: /groupChat\.joinRequest\.dialog\.asCoModerator/
			})
		);
		await userEvent.click(
			screen.getByRole('button', { name: 'groupChat.joinRequest.admit' })
		);
		expect(second.onAdmit).toHaveBeenLastCalledWith('CO_MODERATOR');
	});

	it('shows co-moderation to a co-moderator, but disabled, with the reason', () => {
		renderDialog({ request: request({}, 'CO_MODERATOR') });

		const coModeration = screen.getByRole('radio', {
			name: /groupChat\.joinRequest\.dialog\.asCoModerator/
		});
		expect(coModeration.hasAttribute('disabled')).toBe(true);
		expect(
			screen.getByText(
				'groupChat.joinRequest.dialog.coModeratorOwnerOnly'
			)
		).toBeTruthy();
	});

	it('never offers co-moderation to a colleague of another Träger', () => {
		renderDialog({ request: request({ sameTenant: false }) });

		expect(
			screen
				.getByRole('radio', {
					name: /groupChat\.joinRequest\.dialog\.asCoModerator/
				})
				.hasAttribute('disabled')
		).toBe(true);
		expect(screen.getByRole('dialog').textContent).toContain(
			'groupChat.joinRequest.otherTenant'
		);
	});

	it('declines, and closes with Escape without deciding anything', async () => {
		const handlers = renderDialog();

		await userEvent.keyboard('{Escape}');
		expect(handlers.onClose).toHaveBeenCalledTimes(1);
		expect(handlers.onAdmit).not.toHaveBeenCalled();
		expect(handlers.onDecline).not.toHaveBeenCalled();

		await userEvent.click(
			screen.getByRole('button', {
				name: 'groupChat.joinRequest.decline'
			})
		);
		expect(handlers.onDecline).toHaveBeenCalledTimes(1);
	});
});
