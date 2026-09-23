// @vitest-environment jsdom
import * as React from 'react';
import {
	act,
	cleanup,
	render,
	renderHook,
	screen,
	waitFor,
	within
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GroupChatJoinRequest } from './joinRequestModel';

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

const { createFakeJoinRequestTransport } = await import(
	'./fakeJoinRequestTransport'
);
const { useOwnJoinRequest } = await import('./useOwnJoinRequest');
const { JoinRequestCenter } = await import('./JoinRequestCenter');
const { M3SnackbarHost } = await import('../../m3Snackbar/M3SnackbarHost');
const { createSnackbarStack } = await import('../../m3Snackbar/snackbarStack');

afterEach(cleanup);

const SERIES = 9101;

const pending = (
	id: number,
	displayName: string,
	extra: Partial<GroupChatJoinRequest> = {}
): GroupChatJoinRequest => ({
	id,
	seriesId: SERIES,
	groupTitle: 'HIV und Aids',
	status: 'PENDING',
	requestedAt: `2026-09-23T14:3${id % 10}:00+02:00`,
	via: 'INVITE_LINK',
	viewerRole: 'OWNER',
	requester: {
		consultantId: `c-${id}`,
		displayName,
		agencyName: 'Beratungsstelle Nord',
		tenantName: 'Caritas Köln',
		sameAgency: false,
		sameTenant: true
	},
	...extra
});

describe('useOwnJoinRequest — the counsellor who knocks', () => {
	const setup = (
		mine: Parameters<
			ReturnType<typeof createFakeJoinRequestTransport>['setMine']
		>[1] = null
	) => {
		const transport = createFakeJoinRequestTransport();
		transport.setMine(SERIES, mine);
		const hook = renderHook(() =>
			useOwnJoinRequest(SERIES, 'tok_EN-9', transport, {
				onOpenGroup: vi.fn()
			})
		);
		return { transport, hook };
	};

	it('starts with the offer to knock when she has not asked yet', async () => {
		const { hook } = setup();

		await waitFor(() => expect(hook.result.current?.state).toBe('idle'));
	});

	it('picks up a request she sent earlier', async () => {
		const { hook } = setup({
			id: 1,
			status: 'PENDING',
			requestedAt: '2026-09-23T14:30:00Z'
		});

		await waitFor(() => expect(hook.result.current?.state).toBe('pending'));
	});

	it('sends the knock and waits for the moderation', async () => {
		const { hook, transport } = setup();
		await waitFor(() => expect(hook.result.current?.state).toBe('idle'));

		act(() => hook.result.current!.onRequest());

		await waitFor(() => expect(hook.result.current?.state).toBe('pending'));
		expect(transport.knocks).toEqual([
			{ seriesId: SERIES, inviteToken: 'tok_EN-9' }
		]);
	});

	it('says so when the knock could not be sent', async () => {
		const { hook, transport } = setup();
		transport.failNext('knock');
		await waitFor(() => expect(hook.result.current?.state).toBe('idle'));

		act(() => hook.result.current!.onRequest());

		await waitFor(() => expect(hook.result.current?.state).toBe('error'));
	});

	it('tells her when the server no longer accepts the link', async () => {
		const { hook, transport } = setup();
		transport.failNext('knock', 'linkInvalid');
		await waitFor(() => expect(hook.result.current?.state).toBe('idle'));

		act(() => hook.result.current!.onRequest());

		await waitFor(() =>
			expect(hook.result.current?.state).toBe('linkInvalid')
		);
	});

	it('learns that she was let in, or not, while she waits', async () => {
		const { hook, transport } = setup({
			id: 1,
			status: 'PENDING',
			requestedAt: '2026-09-23T14:30:00Z'
		});
		await waitFor(() => expect(hook.result.current?.state).toBe('pending'));

		act(() =>
			transport.setMine(SERIES, {
				id: 1,
				status: 'ADMITTED',
				requestedAt: '2026-09-23T14:30:00Z'
			})
		);
		await waitFor(() =>
			expect(hook.result.current?.state).toBe('admitted')
		);

		act(() =>
			transport.setMine(SERIES, {
				id: 2,
				status: 'DECLINED',
				requestedAt: '2026-09-23T14:40:00Z'
			})
		);
		await waitFor(() =>
			expect(hook.result.current?.state).toBe('declined')
		);
	});

	it('takes the request back', async () => {
		const { hook, transport } = setup({
			id: 1,
			status: 'PENDING',
			requestedAt: '2026-09-23T14:30:00Z'
		});
		await waitFor(() => expect(hook.result.current?.state).toBe('pending'));

		act(() => hook.result.current!.onCancel());

		await waitFor(() => expect(hook.result.current?.state).toBe('idle'));
		expect(transport.cancellations).toEqual([SERIES]);
	});

	it('offers no knock at all where the server does not support it yet', async () => {
		const transport = createFakeJoinRequestTransport();
		transport.setUnavailable(true);
		const hook = renderHook(() =>
			useOwnJoinRequest(SERIES, 'tok_EN-9', transport, {
				onOpenGroup: vi.fn()
			})
		);

		await waitFor(() => expect(transport.getMineCalls).toBe(1));
		expect(hook.result.current).toBeUndefined();
	});
});

describe('JoinRequestCenter — the moderator who is knocked on', () => {
	const setup = () => {
		const transport = createFakeJoinRequestTransport();
		const stack = createSnackbarStack();
		render(
			<>
				<M3SnackbarHost stack={stack} maxVisible={4} />
				<JoinRequestCenter transport={transport} stack={stack} />
			</>
		);
		return { transport, stack };
	};
	const cards = () => screen.queryAllByTestId('join-request-snackbar');
	const card = (name: string) =>
		screen.getByRole('group', { name: new RegExp(name) });
	/* The live region repeats every arrival; look where it is shown. */
	const inStack = () => within(screen.getByRole('region'));

	it('shows one snackbar per person knocking, first come at the top', async () => {
		const { transport } = setup();

		act(() =>
			transport.setPending([
				pending(1, 'Anna Berg'),
				pending(2, 'Jonas Keller'),
				pending(3, 'Mira Sommer')
			])
		);

		await waitFor(() => expect(cards()).toHaveLength(3));
		expect(cards().map((item) => item.textContent)).toEqual([
			expect.stringContaining('Anna Berg'),
			expect.stringContaining('Jonas Keller'),
			expect.stringContaining('Mira Sommer')
		]);
	});

	it('lets someone in as participant and confirms it', async () => {
		const { transport } = setup();
		act(() => transport.setPending([pending(1, 'Anna Berg')]));
		await waitFor(() => expect(cards()).toHaveLength(1));

		await userEvent.click(
			within(card('Anna Berg')).getByRole('button', {
				name: 'groupChat.joinRequest.admit'
			})
		);

		await waitFor(() => expect(cards()).toHaveLength(0));
		expect(transport.admissions).toEqual([
			{ requestId: 1, role: 'PARTICIPANT' }
		]);
		expect(
			inStack().getByText(
				'groupChat.joinRequest.admitted(name=Anna Berg)'
			)
		).toBeTruthy();
	});

	it('declines and confirms it', async () => {
		const { transport } = setup();
		act(() => transport.setPending([pending(1, 'Anna Berg')]));
		await waitFor(() => expect(cards()).toHaveLength(1));

		await userEvent.click(
			within(card('Anna Berg')).getByRole('button', {
				name: 'groupChat.joinRequest.decline'
			})
		);

		await waitFor(() => expect(cards()).toHaveLength(0));
		expect(transport.declines).toEqual([1]);
		expect(
			inStack().getByText(
				'groupChat.joinRequest.declined(name=Anna Berg)'
			)
		).toBeTruthy();
	});

	it('drops a snackbar that a co-moderator already decided', async () => {
		const { transport } = setup();
		act(() =>
			transport.setPending([
				pending(1, 'Anna Berg'),
				pending(2, 'Jonas Keller')
			])
		);
		await waitFor(() => expect(cards()).toHaveLength(2));

		act(() => transport.setPending([pending(2, 'Jonas Keller')]));

		await waitFor(() => expect(cards()).toHaveLength(1));
		expect(cards()[0].textContent).toContain('Jonas Keller');
	});

	it('opens the details popup and admits as co-moderator from there', async () => {
		const { transport } = setup();
		act(() => transport.setPending([pending(1, 'Anna Berg')]));
		await waitFor(() => expect(cards()).toHaveLength(1));

		await userEvent.click(
			within(card('Anna Berg')).getByRole('button', {
				name: 'groupChat.joinRequest.details'
			})
		);
		const dialog = await screen.findByRole('dialog');
		await userEvent.click(
			within(dialog).getByRole('radio', {
				name: /groupChat\.joinRequest\.dialog\.asCoModerator/
			})
		);
		await userEvent.click(
			within(dialog).getByRole('button', {
				name: 'groupChat.joinRequest.admit'
			})
		);

		await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
		expect(transport.admissions).toEqual([
			{ requestId: 1, role: 'CO_MODERATOR' }
		]);
	});

	it('keeps the snackbar and says so when letting in failed', async () => {
		const { transport } = setup();
		act(() => transport.setPending([pending(1, 'Anna Berg')]));
		await waitFor(() => expect(cards()).toHaveLength(1));
		transport.failNext('admit');

		await userEvent.click(
			within(card('Anna Berg')).getByRole('button', {
				name: 'groupChat.joinRequest.admit'
			})
		);

		await waitFor(() =>
			expect(
				inStack().getByText('groupChat.joinRequest.failed')
			).toBeTruthy()
		);
		expect(cards()).toHaveLength(1);
		expect(
			within(card('Anna Berg'))
				.getByRole('button', { name: 'groupChat.joinRequest.admit' })
				.hasAttribute('disabled')
		).toBe(false);
	});
});
