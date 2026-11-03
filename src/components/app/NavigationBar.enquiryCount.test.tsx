// @vitest-environment oriso-jsdom
/**
 * FE#1435: the "Anfragen" nav item shows how many enquiries are open, from
 * every section (desktop rail and mobile bar render the same items).
 */
import * as React from 'react';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import { NavigationBar } from './NavigationBar';
import { NavigationStoryProviders } from './navigationStoryHelpers';
import { NotificationsContext } from '../../globalState/provider/NotificationsProvider';
import { messageEventEmitter } from '../../services/messageEventEmitter';
import {
	NEW_ENQUIRY_NOTICE_ID,
	NOTIFICATION_TYPE_NEW_ENQUIRY
} from '../notifications/NewEnquiryNotice';

vi.mock('lottie-react', () => ({ default: () => null }));

const responsive = vi.hoisted(() => ({ fromL: false }));
vi.mock('../../hooks/useResponsive', () => ({
	useResponsive: () => ({
		fromS: responsive.fromL,
		fromM: responsive.fromL,
		fromL: responsive.fromL,
		fromXL: false,
		fromXXL: false,
		untilL: !responsive.fromL
	})
}));

vi.mock('../../api/apiSetLiveChatAvailability', () => ({
	apiGetLiveChatAvailability: vi.fn(() => Promise.resolve(false)),
	apiGetNewCounsellingAllowed: vi.fn(() => Promise.resolve(null)),
	apiHeartbeatLiveChatAvailability: vi.fn(() => Promise.resolve(true)),
	apiSetLiveChatAvailability: vi.fn(() => Promise.resolve())
}));
vi.mock('../../api/apiPatchUserData', () => ({
	apiPatchUserData: vi.fn(() => Promise.resolve())
}));
vi.mock('../../api/apiGetTools', () => ({
	userHasBudibaseTools: vi.fn(() => Promise.resolve(false))
}));
vi.mock('../../api/apiGetAskerSessionList', () => ({
	apiGetAskerSessionList: vi.fn(() => new Promise(() => {}))
}));

const apiGetConsultantEnquiryCount = vi.hoisted(() => vi.fn());
vi.mock('../../api/apiGetConsultantSessionList', () => ({
	apiGetConsultantEnquiryCount: (...args: unknown[]) =>
		apiGetConsultantEnquiryCount(...args)
}));

const routes = {
	navigation: [
		{
			to: '/sessions/consultant/sessionPreview',
			titleKeys: { large: 'navigation.consultant.enquiries' }
		},
		{
			to: '/sessions/consultant/sessionView',
			titleKeys: { large: 'navigation.consultant.sessions.large' }
		}
	]
};

const removeNotification = vi.fn();

const renderNavigation = (role: 'consultant' | 'asker' = 'consultant') =>
	render(
		<MemoryRouter initialEntries={['/sessions/consultant/sessionView']}>
			<NotificationsContext.Provider
				value={{ removeNotification } as never}
			>
				<NavigationStoryProviders role={role}>
					<NavigationBar routerConfig={routes} onLogout={() => {}} />
				</NavigationStoryProviders>
			</NotificationsContext.Provider>
		</MemoryRouter>
	);

const enquiriesLink = (container: HTMLElement) =>
	container.querySelector(
		'a[href="/sessions/consultant/sessionPreview"]'
	) as HTMLAnchorElement;

describe('NavigationBar "Anfragen" count (FE#1435)', () => {
	beforeEach(() => {
		localStorage.clear();
		apiGetConsultantEnquiryCount.mockReset();
		removeNotification.mockClear();
	});

	afterEach(() => {
		cleanup();
	});

	describe.each([
		['mobile bar', false],
		['desktop rail', true]
	])('%s', (_label, fromL) => {
		beforeEach(() => {
			responsive.fromL = fromL;
		});

		it('shows the number of open enquiries on the item and in its name', async () => {
			apiGetConsultantEnquiryCount.mockResolvedValue(3);
			const { container } = renderNavigation();

			await waitFor(() =>
				expect(
					enquiriesLink(container).querySelector(
						'.navigation__item__count'
					)?.textContent
				).toBe('3')
			);
			// Screen readers hear "Anfragen, 3 offene Anfragen" (keys here:
			// the unit project loads no catalogue).
			expect(enquiriesLink(container).getAttribute('aria-label')).toBe(
				'navigation.consultant.enquiries, sessionList.rail.openEnquiries'
			);
		});
	});

	it('shows no number while nothing is open, and drops it when the last one is taken', async () => {
		apiGetConsultantEnquiryCount.mockResolvedValue(1);
		const { container } = renderNavigation();
		await waitFor(() =>
			expect(
				enquiriesLink(container).querySelector(
					'.navigation__item__count'
				)
			).not.toBeNull()
		);

		apiGetConsultantEnquiryCount.mockResolvedValue(0);
		act(() => {
			messageEventEmitter.emit({ sessionId: 246 });
		});
		await waitFor(() =>
			expect(
				enquiriesLink(container).querySelector(
					'.navigation__item__count'
				)
			).toBeNull()
		);
		// Nothing left to take: the new-enquiry pop-up goes as well.
		expect(removeNotification).toHaveBeenCalledWith(
			NEW_ENQUIRY_NOTICE_ID,
			NOTIFICATION_TYPE_NEW_ENQUIRY
		);
	});

	it('keeps a fresh pop-up while the count is still 0 from before it', async () => {
		apiGetConsultantEnquiryCount.mockResolvedValue(0);
		const view = renderNavigation();
		await waitFor(() =>
			expect(apiGetConsultantEnquiryCount).toHaveBeenCalledTimes(1)
		);
		await act(async () => {
			await Promise.resolve();
		});
		// The provider hands out a new remover whenever its cards change.
		const nextRemove = vi.fn();
		view.rerender(
			<MemoryRouter initialEntries={['/sessions/consultant/sessionView']}>
				<NotificationsContext.Provider
					value={{ removeNotification: nextRemove } as never}
				>
					<NavigationStoryProviders role="consultant">
						<NavigationBar
							routerConfig={routes}
							onLogout={() => {}}
						/>
					</NavigationStoryProviders>
				</NotificationsContext.Provider>
			</MemoryRouter>
		);
		expect(removeNotification).not.toHaveBeenCalled();
		expect(nextRemove).not.toHaveBeenCalled();
	});

	it('never asks for enquiries as an advice seeker', async () => {
		renderNavigation('asker');
		await act(async () => {
			await Promise.resolve();
		});
		expect(apiGetConsultantEnquiryCount).not.toHaveBeenCalled();
	});
});
