// @vitest-environment oriso-jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { apiRenewDirectInvitation } from '../../api/apiDirectLinks';
import { NotificationsContext } from '../../globalState';
import { createSnackbarStack } from '../m3Snackbar/snackbarStack';
import { DIRECT_INVITATION_RENEWAL_REQUESTED } from '../notificationsCenter/eventDescriptors/directInvitationEvents';
import { useSendNewLink } from './useSendNewLink';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));
vi.mock('qrcode', () => ({
	default: { toDataURL: () => Promise.resolve('data:image/png;base64,') }
}));
vi.mock('../../api/apiDirectLinks', async (importOriginal) => ({
	...(await importOriginal<typeof import('../../api/apiDirectLinks')>()),
	apiRenewDirectInvitation: vi.fn()
}));

const renewed = {
	id: '9',
	name: 'Termin',
	topic: 'Schulden',
	medium: 'VIDEO' as const,
	temporary: true,
	active: true,
	url: 'https://app.example/invite/new'
};

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

/* #2252: every renewal issues a new token and expires the one before. */
describe('useSendNewLink', () => {
	it('makes one new link while a renewal of the same invitation is running', async () => {
		let resolve: (link: typeof renewed) => void = () => undefined;
		vi.mocked(apiRenewDirectInvitation).mockReturnValue(
			new Promise((done) => {
				resolve = done;
			})
		);
		const header = renderHook(() => useSendNewLink(createSnackbarStack()));
		const notice = renderHook(() => useSendNewLink(createSnackbarStack()));

		let results: boolean[] = [];
		await act(async () => {
			const all = Promise.all([
				header.result.current.send('9'),
				header.result.current.send('9'),
				notice.result.current.send('9')
			]);
			resolve(renewed);
			results = await all;
		});

		expect(apiRenewDirectInvitation).toHaveBeenCalledTimes(1);
		expect(results).toEqual([true, true, true]);
	});

	it('renews again once the earlier renewal has finished', async () => {
		vi.mocked(apiRenewDirectInvitation).mockResolvedValue(renewed);
		const { result } = renderHook(() =>
			useSendNewLink(createSnackbarStack())
		);
		await act(async () => {
			await result.current.send('9');
		});
		await act(async () => {
			await result.current.send('9');
		});
		expect(apiRenewDirectInvitation).toHaveBeenCalledTimes(2);
	});

	it('consumes the request pop-up and unread requests of the renewed link', async () => {
		vi.mocked(apiRenewDirectInvitation).mockResolvedValue(renewed);
		const markNotificationAsRead = vi.fn();
		const feed = [
			{
				id: 'a',
				eventType: DIRECT_INVITATION_RENEWAL_REQUESTED,
				params: { linkId: 9 }
			},
			{
				id: 'b',
				eventType: DIRECT_INVITATION_RENEWAL_REQUESTED,
				params: { linkId: 9 },
				readAt: '2026-11-16T10:00:00Z'
			},
			{
				id: 'c',
				eventType: DIRECT_INVITATION_RENEWAL_REQUESTED,
				params: { linkId: 10 }
			},
			{ id: 'd', eventType: 'other.event', params: { linkId: 9 } }
		];
		const stack = createSnackbarStack();
		const dismiss = vi.spyOn(stack, 'dismiss');
		const wrapper = ({ children }: { children: React.ReactNode }) => (
			<NotificationsContext.Provider
				value={
					{
						notificationFeed: feed,
						markNotificationAsRead
					} as unknown as React.ContextType<
						typeof NotificationsContext
					>
				}
			>
				{children}
			</NotificationsContext.Provider>
		);
		const { result } = renderHook(() => useSendNewLink(stack), {
			wrapper
		});

		await act(async () => {
			await result.current.send('9');
		});

		/* Otherwise a later click on the leftover pop-up renews again and
		   expires the link just sent. */
		expect(markNotificationAsRead.mock.calls).toEqual([['a']]);
		expect(dismiss).toHaveBeenCalledWith('new-link-request-9');
	});

	it('consumes a request that arrived while the renewal was running', async () => {
		let resolve: (link: typeof renewed) => void = () => undefined;
		vi.mocked(apiRenewDirectInvitation).mockReturnValue(
			new Promise((done) => {
				resolve = done;
			})
		);
		const markNotificationAsRead = vi.fn();
		const request = (id: string) => ({
			id,
			eventType: DIRECT_INVITATION_RENEWAL_REQUESTED,
			params: { linkId: 9 }
		});
		let feed = [request('a')];
		const wrapper = ({ children }: { children: React.ReactNode }) => (
			<NotificationsContext.Provider
				value={
					{
						notificationFeed: feed,
						markNotificationAsRead
					} as unknown as React.ContextType<
						typeof NotificationsContext
					>
				}
			>
				{children}
			</NotificationsContext.Provider>
		);
		const { result, rerender } = renderHook(
			() => useSendNewLink(createSnackbarStack()),
			{ wrapper }
		);

		let sent: Promise<boolean> = Promise.resolve(true);
		act(() => {
			sent = result.current.send('9');
		});
		/* The next poll brings another request while the renewal runs. */
		feed = [request('a'), request('e')];
		rerender();
		await act(async () => {
			resolve(renewed);
			await sent;
		});

		/* Left unread, its pop-up would renew once more and expire the link
		   just sent. */
		expect(markNotificationAsRead.mock.calls).toEqual([['a'], ['e']]);
	});

	it('keeps a link pending until its own renewal has finished', async () => {
		const done: Record<string, (link: typeof renewed) => void> = {};
		vi.mocked(apiRenewDirectInvitation).mockImplementation(
			(id: string) =>
				new Promise((resolve) => {
					done[id] = resolve;
				})
		);
		const { result } = renderHook(() =>
			useSendNewLink(createSnackbarStack())
		);
		let a: Promise<boolean> = Promise.resolve(true);
		let b: Promise<boolean> = Promise.resolve(true);
		act(() => {
			a = result.current.send('A');
			b = result.current.send('B');
		});
		expect([...result.current.pendingIds].sort()).toEqual(['A', 'B']);

		await act(async () => {
			done.A({ ...renewed, id: 'A' });
			await a;
		});
		expect([...result.current.pendingIds]).toEqual(['B']);

		await act(async () => {
			done.B({ ...renewed, id: 'B' });
			await b;
		});
		expect(result.current.pendingIds.size).toBe(0);
	});
});
