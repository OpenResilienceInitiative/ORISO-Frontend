// @vitest-environment oriso-jsdom
import * as React from 'react';
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen
} from '@testing-library/react';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import { NotificationsContext } from '../../globalState';
import { M3SnackbarHost } from '../m3Snackbar/M3SnackbarHost';
import { createSnackbarStack } from '../m3Snackbar/snackbarStack';
import {
	apiGetOwnDirectLinks,
	apiRenewDirectInvitation
} from '../../api/apiDirectLinks';
import { NewLinkRequestCenter } from './NewLinkRequestCenter';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, options?: Record<string, string>) =>
			options?.invitation ? `${key}:${options.invitation}` : key
	})
}));
vi.mock('qrcode', () => ({
	default: { toDataURL: () => Promise.resolve('data:image/png;base64,') }
}));
vi.mock('../../api/apiDirectLinks', async (importOriginal) => ({
	...(await importOriginal<typeof import('../../api/apiDirectLinks')>()),
	apiGetOwnDirectLinks: vi.fn(),
	apiRenewDirectInvitation: vi.fn()
}));

const request = (id: string, linkId: number | undefined, readAt = null) => ({
	id,
	type: 'info',
	title: 'New link requested',
	text: '',
	eventType: 'direct_invitation.renewal_requested',
	createdAt: '2026-11-14T10:00:00Z',
	readAt,
	category: 'system' as const,
	params: linkId === undefined ? {} : { linkId, sourceSessionId: 5 }
});

const meeting = {
	id: '9',
	name: 'Termin Frau M.',
	topic: 'Schulden',
	medium: 'VIDEO' as const,
	temporary: true,
	active: true,
	url: 'https://app.example/invite/old'
};

const markNotificationAsRead = vi.fn();
const renderCenter = (feed: unknown[]) => {
	const stack = createSnackbarStack();
	const value = { notificationFeed: feed, markNotificationAsRead } as any;
	return {
		stack,
		...render(
			<NotificationsContext.Provider value={value}>
				<NewLinkRequestCenter stack={stack} />
				<M3SnackbarHost stack={stack} />
			</NotificationsContext.Provider>
		)
	};
};

beforeEach(() => {
	vi.mocked(apiGetOwnDirectLinks).mockResolvedValue([meeting]);
	vi.mocked(apiRenewDirectInvitation).mockResolvedValue({
		...meeting,
		url: 'https://app.example/invite/new'
	});
});
afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

/* #2252: "Neuen Link anfragen" reaches the counsellor as a pop-up. */
describe('NewLinkRequestCenter', () => {
	it('shows one pop-up per invitation, named after it', async () => {
		renderCenter([
			request('1', 9),
			request('2', 9),
			request('3', undefined)
		]);

		expect(
			await screen.findByText(
				'directInvitation.notice.text:Termin Frau M.'
			)
		).toBeTruthy();
		expect(screen.getAllByTestId('new-link-request')).toHaveLength(1);
	});

	it('leaves requests alone that were already read', async () => {
		renderCenter([request('1', 9, '2026-11-14T10:01:00Z' as any)]);
		await act(async () => undefined);
		expect(screen.queryByTestId('new-link-request')).toBeNull();
	});

	it('"Neuen Link senden" renews the invitation, marks the request read and shows the new link', async () => {
		renderCenter([request('1', 9), request('2', 9)]);
		fireEvent.click(
			await screen.findByRole('button', {
				name: 'directInvitation.notice.send'
			})
		);

		expect(
			await screen.findByTestId('direct-link-share-dialog')
		).toBeTruthy();
		expect(apiRenewDirectInvitation).toHaveBeenCalledWith('9');
		expect(markNotificationAsRead).toHaveBeenCalledWith('1');
		expect(markNotificationAsRead).toHaveBeenCalledWith('2');
		expect(screen.queryByTestId('new-link-request')).toBeNull();
	});

	it('says so in a pop-up when the new link cannot be made', async () => {
		vi.mocked(apiRenewDirectInvitation).mockRejectedValue(new Error('x'));
		renderCenter([request('1', 9)]);
		fireEvent.click(
			await screen.findByRole('button', {
				name: 'directInvitation.notice.send'
			})
		);

		expect(
			(await screen.findAllByText('directInvitation.notice.failed'))
				.length
		).toBeGreaterThan(0);
		/* Every pop-up has a title. */
		expect(
			screen.getByText('directInvitation.notice.failedTitle')
		).toBeTruthy();
		expect(markNotificationAsRead).not.toHaveBeenCalled();
	});

	it('reads the names again for an invitation made after the first read', async () => {
		const later = { ...meeting, id: '12', name: 'Termin Herr K.' };
		const { rerender, stack } = renderCenter([request('1', 9)]);
		await screen.findByText('directInvitation.notice.text:Termin Frau M.');
		vi.mocked(apiGetOwnDirectLinks).mockResolvedValue([meeting, later]);
		const value = {
			notificationFeed: [request('1', 9), request('2', 12)],
			markNotificationAsRead
		} as any;
		rerender(
			<NotificationsContext.Provider value={value}>
				<NewLinkRequestCenter stack={stack} />
				<M3SnackbarHost stack={stack} />
			</NotificationsContext.Provider>
		);

		expect(
			await screen.findByText(
				'directInvitation.notice.text:Termin Herr K.'
			)
		).toBeTruthy();
	});
	it('shows an invitation the links do not know once, unnamed, and reads only once', async () => {
		renderCenter([request('1', 40)]);
		expect(
			await screen.findByText('directInvitation.notice.text')
		).toBeTruthy();
		await act(async () => undefined);
		expect(apiGetOwnDirectLinks).toHaveBeenCalledTimes(1);
	});

	it('keeps the pop-up for another try when the new link cannot be made', async () => {
		vi.mocked(apiRenewDirectInvitation).mockRejectedValueOnce(
			new Error('x')
		);
		renderCenter([request('1', 9)]);
		fireEvent.click(
			await screen.findByRole('button', {
				name: 'directInvitation.notice.send'
			})
		);
		await screen.findAllByText('directInvitation.notice.failed');
		fireEvent.click(
			screen.getByRole('button', { name: 'directInvitation.notice.send' })
		);
		expect(
			await screen.findByTestId('direct-link-share-dialog')
		).toBeTruthy();
		expect(apiRenewDirectInvitation).toHaveBeenCalledTimes(2);
	});

	it('shows a later request for an invitation whose earlier one was answered', async () => {
		const { rerender, stack } = renderCenter([request('1', 9)]);
		await screen.findByText('directInvitation.notice.text:Termin Frau M.');
		const show = (feed: unknown[]) =>
			rerender(
				<NotificationsContext.Provider
					value={
						{
							notificationFeed: feed,
							markNotificationAsRead
						} as any
					}
				>
					<NewLinkRequestCenter stack={stack} />
					<M3SnackbarHost stack={stack} />
				</NotificationsContext.Provider>
			);
		act(() => stack.dismiss('new-link-request-9'));
		show([request('1', 9, '2026-11-14T10:01:00Z' as any)]);
		await act(async () => undefined);
		expect(screen.queryByTestId('new-link-request')).toBeNull();
		show([request('1', 9, '2026-11-14T10:01:00Z' as any), request('4', 9)]);
		expect(
			await screen.findByText(
				'directInvitation.notice.text:Termin Frau M.'
			)
		).toBeTruthy();
	});
});
