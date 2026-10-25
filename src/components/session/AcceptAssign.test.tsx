// @vitest-environment oriso-jsdom
import * as React from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

/**
 * #1799: accepting a first request must never end silently. Any failure that
 * is not a known conflict or AVV refusal shows an error instead of leaving the
 * enquiry in place with no feedback.
 */
vi.mock('react-i18next', () => {
	const t = (key: string) => key;
	return { useTranslation: () => ({ t, i18n: { language: 'de' } }) };
});
vi.mock('react-router-dom', () => ({
	useParams: () => ({}),
	useNavigate: () => vi.fn()
}));
vi.mock('../../globalState', async () => {
	const { createContext } = await import('react');
	return {
		ActiveSessionContext: createContext(null),
		buildExtendedSession: vi.fn(),
		// Rejection authority is out of scope here: no counsellor authority.
		UserDataContext: createContext({ userData: {} }),
		SessionTypeContext: createContext({ path: '' }),
		hasUserAuthority: () => false,
		AUTHORITIES: { CONSULTANT_DEFAULT: 'AUTHORIZATION_CONSULTANT_DEFAULT' }
	};
});
vi.mock('./session.styles', () => ({}));
vi.mock('../../resources/img/illustrations/x.svg', () => ({
	ReactComponent: () => null
}));
vi.mock('../../api', () => ({
	apiEnquiryAcceptance: vi.fn(),
	apiRejectEnquiry: vi.fn(),
	FETCH_ERRORS: {
		ABORT: 'ABORT',
		CATCH_ALL: 'CATCH_ALL',
		CONFLICT: 'CONFLICT',
		EMPTY: 'EMPTY',
		FORBIDDEN: 'FORBIDDEN'
	}
}));
vi.mock('../../api/apiAcceptAnonymousEnquiry', () => ({
	apiAcceptAnonymousEnquiry: vi.fn()
}));
vi.mock('../../api/apiGetSessionRooms', () => ({
	apiGetSessionRoomBySessionId: vi.fn(() => new Promise(() => {}))
}));
vi.mock('../../api/counsellingDpaFailure', () => ({
	getCounsellingDpaFailure: () => null
}));
vi.mock('./getModality', () => ({
	getModality: () => 'REGISTERED',
	Modality: { LIVE_CHAT: 'LIVE_CHAT' }
}));
vi.mock('./sessionHelpers', () => ({ SESSION_LIST_TAB: {} }));
vi.mock('../../hooks/useSearchParams', () => ({
	useSearchParam: () => undefined
}));
vi.mock('../../hooks/useE2EE', () => ({
	useE2EE: () => ({ encryptRoom: vi.fn(() => Promise.resolve()) })
}));
vi.mock('../../hooks/useE2EEViewElements', () => ({
	useE2EEViewElements: () => ({
		visible: false,
		setState: vi.fn(),
		overlay: null
	})
}));
vi.mock('../../hooks/useTimeoutOverlay', () => ({
	useTimeoutOverlay: () => ({ visible: false, overlay: null })
}));
const watcher = vi.hoisted(() => ({ start: vi.fn(), running: true }));
vi.mock('../../hooks/useWatcher', () => ({
	useWatcher: () => [watcher.start, vi.fn(), watcher.running]
}));
vi.mock('../../utils/matrixRoomUtils', () => ({
	resolveSessionRoomRouteId: vi.fn()
}));
vi.mock('../button/Button', () => ({
	Button: ({ item, buttonHandle }: any) => (
		<button onClick={buttonHandle}>{item.label}</button>
	),
	BUTTON_TYPES: { PRIMARY: 'PRIMARY', SECONDARY: 'SECONDARY' }
}));
vi.mock('../overlay/Overlay', () => ({
	Overlay: ({ item }: any) => (
		<div role="dialog">
			<span data-testid="overlay-headline">{item.headline}</span>
			<span data-testid="overlay-copy">{item.copy}</span>
		</div>
	),
	OVERLAY_FUNCTIONS: { CLOSE: 'CLOSE' }
}));

const { apiEnquiryAcceptance } = await import('../../api');
const { ActiveSessionContext } = await import('../../globalState');
const { AcceptAssign } = await import('./AcceptAssign');

const renderAccept = (
	activeSession: object = { item: { id: 76 }, isEnquiry: true }
) =>
	render(
		<ActiveSessionContext.Provider
			value={
				{
					activeSession,
					reloadActiveSession: vi.fn()
				} as any
			}
		>
			<AcceptAssign btnLabel="enquiry.acceptButton.known" />
		</ActiveSessionContext.Provider>
	);

afterEach(() => {
	cleanup();
	vi.mocked(apiEnquiryAcceptance).mockReset();
	watcher.start.mockReset();
	watcher.running = true;
});

describe('AcceptAssign', () => {
	it('shows an error when accepting fails for an unexpected reason', async () => {
		vi.mocked(apiEnquiryAcceptance).mockRejectedValue(
			new Error('CATCH_ALL')
		);
		vi.spyOn(console, 'error').mockImplementation(() => {});

		renderAccept();
		fireEvent.click(screen.getByText('enquiry.acceptButton.known'));

		await waitFor(() =>
			expect(screen.getByTestId('overlay-headline').textContent).toBe(
				'error.statusCodes.500.headline'
			)
		);
		expect(screen.getByTestId('overlay-copy').textContent).toBe(
			'error.statusCodes.500.description'
		);
		expect(apiEnquiryAcceptance).toHaveBeenCalledWith(76);
	});

	it('keeps the taken-by-colleague notice for a conflict', async () => {
		vi.mocked(apiEnquiryAcceptance).mockRejectedValue(
			new Error('CONFLICT')
		);

		renderAccept();
		fireEvent.click(screen.getByText('enquiry.acceptButton.known'));

		await waitFor(() =>
			expect(screen.getByTestId('overlay-headline').textContent).toBe(
				'session.anonymous.takenByOtherConsultant.overlay.headline'
			)
		);
	});

	it('watches an open enquiry for a colleague taking it over', () => {
		watcher.running = false;
		renderAccept();
		expect(watcher.start).toHaveBeenCalled();
	});

	it('neither polls nor leaves an empty footer once the case is rejected', () => {
		watcher.running = false;
		const { container } = renderAccept({
			item: { id: 76, status: 5 },
			isEnquiry: false
		});
		expect(watcher.start).not.toHaveBeenCalled();
		expect(container.querySelector('.session__acceptance')).toBeNull();
	});
});
