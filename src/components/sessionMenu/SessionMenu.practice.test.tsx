// @vitest-environment jsdom
import * as React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	ActiveSessionContext,
	AUTHORITIES,
	ConsultingTypesContext,
	SessionsDataContext,
	SessionTypeContext,
	UserDataContext
} from '../../globalState';
import { SESSION_LIST_TYPES } from '../session/sessionHelpers';
import { enterPracticeMode, exitPracticeMode } from '../../practice';
import { SessionMenu } from './SessionMenu';

// Browser-only animation renderers have no canvas in jsdom.
vi.mock('lottie-web', () => ({ default: { loadAnimation: () => ({}) } }));
vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));
vi.mock('../../hooks/useSessionTenantSettings', () => ({
	useSessionTenantSettings: () => ({ settings: {}, isLoading: false })
}));
vi.mock('../../hooks/useNotificationSettings', () => ({
	useNotificationSettings: () => ({
		settings: {},
		updateSettings: vi.fn()
	})
}));
vi.mock('../../hooks/useMatrixRoomUsers', () => ({
	useMatrixRoomUsers: () => ({ users: [] })
}));
vi.mock('../../hooks/useAppConfig', () => ({
	useAppConfig: () => ({ releaseToggles: {} })
}));
vi.mock('../../api', async (importOriginal) => ({
	...(await importOriginal<object>()),
	apiPutArchive: vi.fn(),
	apiPutDearchive: vi.fn(),
	apiPutGroupChat: vi.fn()
}));

const activeSession = {
	isSession: true,
	isGroup: false,
	isEnquiry: false,
	rid: '!practice-2:practice.invalid',
	consultant: { id: 'counsellor' },
	item: {
		id: -2,
		consultingType: 0,
		matrixRoomId: '!practice-2:practice.invalid',
		active: true,
		subscribed: true
	}
};

const counsellor = {
	userId: 'counsellor',
	grantedAuthorities: [AUTHORITIES.CONSULTANT_DEFAULT]
};

const Menu = ({
	callsInMenu = false,
	userData = counsellor,
	status = 2
}: {
	callsInMenu?: boolean;
	userData?: object;
	status?: number;
}) => (
	<MemoryRouter>
		<SessionTypeContext.Provider
			value={
				{
					type: SESSION_LIST_TYPES.MY_SESSION,
					path: '/sessions/consultant/sessionView'
				} as any
			}
		>
			<UserDataContext.Provider value={{ userData } as any}>
				<ActiveSessionContext.Provider
					value={
						{
							activeSession: {
								...activeSession,
								item: { ...activeSession.item, status }
							},
							reloadActiveSession: vi.fn()
						} as any
					}
				>
					<ConsultingTypesContext.Provider
						value={
							{
								consultingTypes: [
									{ id: 0, isVideoCallAllowed: true }
								]
							} as any
						}
					>
						<SessionsDataContext.Provider
							value={{ dispatch: vi.fn() } as any}
						>
							<SessionMenu
								hasUserInitiatedStopOrLeaveRequest={{
									current: false
								}}
								isAskerInfoAvailable
								callsInMenu={callsInMenu}
							/>
						</SessionsDataContext.Provider>
					</ConsultingTypesContext.Provider>
				</ActiveSessionContext.Provider>
			</UserDataContext.Provider>
		</SessionTypeContext.Provider>
	</MemoryRouter>
);

const callControls = () =>
	document.querySelectorAll(
		[
			'[data-cy="session-header-video-call-buttons"]',
			'[data-cy="session-menu-start-video-call"]',
			'[data-cy="session-menu-start-call"]'
		].join(',')
	);

beforeEach(() => {
	window.matchMedia = ((query: string) => ({
		matches: false,
		media: query,
		addEventListener() {},
		removeEventListener() {},
		addListener() {},
		removeListener() {}
	})) as any;
});
afterEach(() => {
	cleanup();
	exitPracticeMode();
});

describe('SessionMenu calls and practice mode (no calls)', () => {
	it.each([false, true])(
		'offers no call control for rejected enquiry history (callsInMenu %s)',
		(callsInMenu) => {
			render(<Menu callsInMenu={callsInMenu} status={5} />);
			expect(callControls()).toHaveLength(0);
		}
	);
	it('offers the call buttons in the header row outside practice', () => {
		render(<Menu />);

		expect(
			document.querySelector(
				'[data-cy="session-header-video-call-buttons"]'
			)
		).not.toBeNull();
	});

	it('offers the call rows in the menu outside practice', () => {
		render(<Menu callsInMenu />);

		expect(
			document.querySelector('[data-cy="session-menu-start-video-call"]')
		).not.toBeNull();
		expect(
			document.querySelector('[data-cy="session-menu-start-call"]')
		).not.toBeNull();
	});

	it.each([false, true])(
		'offers no call control while practising (callsInMenu %s)',
		(callsInMenu) => {
			enterPracticeMode({ tourId: 'consultant-practice-accept' });

			render(<Menu callsInMenu={callsInMenu} />);

			expect(callControls()).toHaveLength(0);
		}
	);

	it('hides the booking entry while practising', () => {
		const asker = {
			userId: 'asker',
			grantedAuthorities: [AUTHORITIES.ASKER_DEFAULT],
			appointmentFeatureEnabled: true
		};
		const { unmount } = render(<Menu userData={asker} />);
		expect(
			document.querySelector('.sessionMenu__icon--booking')
		).not.toBeNull();
		unmount();

		enterPracticeMode({ tourId: 'consultant-practice-accept' });
		render(<Menu userData={asker} />);

		expect(
			document.querySelector('.sessionMenu__icon--booking')
		).toBeNull();
	});

	it('drops the call controls when practice starts under a mounted menu', () => {
		render(<Menu />);
		expect(callControls().length).toBeGreaterThan(0);

		act(() => enterPracticeMode({ tourId: 'consultant-practice-accept' }));

		expect(callControls()).toHaveLength(0);
	});
});
