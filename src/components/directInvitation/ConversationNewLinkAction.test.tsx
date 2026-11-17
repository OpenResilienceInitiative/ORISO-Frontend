// @vitest-environment oriso-jsdom
import * as React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import {
	apiGetOwnDirectLinks,
	apiRenewDirectInvitation,
	DIRECT_LINKS_CHANGED_EVENT
} from '../../api/apiDirectLinks';
import { createSnackbarStack } from '../m3Snackbar/snackbarStack';
import { ConversationNewLinkAction } from './ConversationNewLinkAction';
import { MAX_TIMER_MS } from './invitationModel';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));
vi.mock('qrcode', () => ({
	default: { toDataURL: () => Promise.resolve('data:image/png;base64,') }
}));
vi.mock('../../api/apiDirectLinks', async (importOriginal) => ({
	...(await importOriginal<typeof import('../../api/apiDirectLinks')>()),
	apiGetOwnDirectLinks: vi.fn(),
	apiRenewDirectInvitation: vi.fn()
}));

const link = (id: string, sessionId: number, expired: boolean) => ({
	id,
	name: `Termin ${id}`,
	topic: 'Schulden',
	medium: 'VIDEO' as const,
	temporary: true,
	active: true,
	url: `https://app.example/invite/${id}`,
	sessionId,
	expired
});

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

/* #2252, decision 7: the counsellor sends a new link from the chat on their own. */
describe('ConversationNewLinkAction', () => {
	it('offers "Neuen Link senden" only for an expired invitation of this conversation', async () => {
		vi.mocked(apiGetOwnDirectLinks).mockResolvedValue([
			link('1', 5, false),
			link('2', 7, true)
		]);
		const onChange = vi.fn();
		render(
			<ConversationNewLinkAction
				sessionId={5}
				enabled
				onChange={onChange}
				stack={createSnackbarStack()}
			/>
		);
		await act(async () => undefined);
		expect(onChange).not.toHaveBeenLastCalledWith(expect.any(Function));
	});

	it('sends a new link and shows it to share', async () => {
		vi.mocked(apiGetOwnDirectLinks).mockResolvedValue([link('2', 5, true)]);
		vi.mocked(apiRenewDirectInvitation).mockResolvedValue(
			link('2', 5, false)
		);
		let open: (() => void) | undefined;
		render(
			<ConversationNewLinkAction
				sessionId={5}
				enabled
				onChange={(next) => {
					open = next;
				}}
				stack={createSnackbarStack()}
			/>
		);
		await vi.waitFor(() => expect(open).toBeInstanceOf(Function));
		await act(async () => open?.());

		expect(apiRenewDirectInvitation).toHaveBeenCalledWith('2');
		expect(
			await screen.findByTestId('direct-link-share-dialog')
		).toBeTruthy();
	});

	it('reads the links again when they change', async () => {
		vi.mocked(apiGetOwnDirectLinks).mockResolvedValue([]);
		render(
			<ConversationNewLinkAction
				sessionId={5}
				enabled
				onChange={vi.fn()}
				stack={createSnackbarStack()}
			/>
		);
		await act(async () => undefined);
		await act(async () => {
			window.dispatchEvent(new Event(DIRECT_LINKS_CHANGED_EVENT));
		});
		expect(apiGetOwnDirectLinks).toHaveBeenCalledTimes(2);
	});

	/* A fixed clock: the action follows the time, not a render. */
	const settle = (ms = 0) =>
		act(async () => {
			await vi.advanceTimersByTimeAsync(ms);
		});

	it('offers "Neuen Link senden" once the invitation expires while the conversation is open', async () => {
		vi.useFakeTimers({ now: Date.now() });
		try {
			const endingSoon = {
				...link('2', 5, false),
				expiresAt: new Date(Date.now() + 60_000).toISOString()
			};
			vi.mocked(apiGetOwnDirectLinks)
				.mockResolvedValueOnce([endingSoon])
				.mockResolvedValue([{ ...endingSoon, expired: true }]);
			const onChange = vi.fn();
			render(
				<ConversationNewLinkAction
					sessionId={5}
					enabled
					onChange={onChange}
					stack={createSnackbarStack()}
				/>
			);
			await settle();
			expect(onChange).not.toHaveBeenLastCalledWith(expect.any(Function));

			await settle(61_000);
			expect(onChange).toHaveBeenLastCalledWith(expect.any(Function));
		} finally {
			vi.useRealTimers();
		}
	});

	it('reads again when an answer still calls an invitation active after its end', async () => {
		vi.useFakeTimers({ now: Date.now() });
		try {
			const overdue = {
				...link('2', 5, false),
				expiresAt: new Date(Date.now() - 1_000).toISOString()
			};
			vi.mocked(apiGetOwnDirectLinks)
				.mockResolvedValueOnce([overdue])
				.mockResolvedValue([{ ...overdue, expired: true }]);
			const onChange = vi.fn();
			render(
				<ConversationNewLinkAction
					sessionId={5}
					enabled
					onChange={onChange}
					stack={createSnackbarStack()}
				/>
			);
			await settle();
			expect(onChange).not.toHaveBeenLastCalledWith(expect.any(Function));

			await settle(31_000);
			expect(onChange).toHaveBeenLastCalledWith(expect.any(Function));
		} finally {
			vi.useRealTimers();
		}
	});

	it('keeps waiting for an expiry further away than the longest timer', async () => {
		vi.useFakeTimers({ now: Date.now() });
		try {
			const far = {
				...link('2', 5, false),
				expiresAt: new Date(
					Date.now() + MAX_TIMER_MS + 60_000
				).toISOString()
			};
			vi.mocked(apiGetOwnDirectLinks)
				.mockResolvedValueOnce([far])
				.mockResolvedValueOnce([{ ...far }])
				.mockResolvedValue([{ ...far, expired: true }]);
			const onChange = vi.fn();
			render(
				<ConversationNewLinkAction
					sessionId={5}
					enabled
					onChange={onChange}
					stack={createSnackbarStack()}
				/>
			);
			await settle();
			await settle(MAX_TIMER_MS);
			expect(apiGetOwnDirectLinks).toHaveBeenCalledTimes(2);
			expect(onChange).not.toHaveBeenLastCalledWith(expect.any(Function));

			await settle(61_000);
			expect(apiGetOwnDirectLinks).toHaveBeenCalledTimes(3);
			expect(onChange).toHaveBeenLastCalledWith(expect.any(Function));
		} finally {
			vi.useRealTimers();
		}
	});

	it('reads the invitations again after a failed read', async () => {
		vi.useFakeTimers({ now: Date.now() });
		try {
			vi.mocked(apiGetOwnDirectLinks)
				.mockRejectedValueOnce(new Error('CATCH_ALL'))
				.mockResolvedValue([link('2', 5, true)]);
			const onChange = vi.fn();
			render(
				<ConversationNewLinkAction
					sessionId={5}
					enabled
					onChange={onChange}
					stack={createSnackbarStack()}
				/>
			);
			await settle();
			expect(onChange).not.toHaveBeenLastCalledWith(expect.any(Function));

			await settle(60_000);
			expect(apiGetOwnDirectLinks).toHaveBeenCalledTimes(2);
			expect(onChange).toHaveBeenLastCalledWith(expect.any(Function));
		} finally {
			vi.useRealTimers();
		}
	});

	it('reads nothing for somebody who may not send links', async () => {
		render(
			<ConversationNewLinkAction
				sessionId={5}
				enabled={false}
				onChange={vi.fn()}
				stack={createSnackbarStack()}
			/>
		);
		await act(async () => undefined);
		expect(apiGetOwnDirectLinks).not.toHaveBeenCalled();
	});
});
