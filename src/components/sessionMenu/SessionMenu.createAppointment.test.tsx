// @vitest-environment oriso-jsdom
/**
 * FE#1960: "Termin anlegen" is a row of the conversation's ⋮ menu, shown
 * only while the header hands the menu an opener.
 */
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import {
	ActiveSessionContext,
	AUTHORITIES,
	ConsultingTypesContext,
	ModalProvider,
	SessionsDataContext,
	SessionTypeContext,
	UserDataContext
} from '../../globalState';
import { SESSION_LIST_TYPES } from '../session/sessionHelpers';
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
	useAppConfig: () => ({ releaseToggles: { enableNewNotifications: true } })
}));
const tenant = vi.hoisted(() => ({ current: null as unknown }));
vi.mock(
	'../../globalState/provider/TenantProvider',
	async (importOriginal) => ({
		...(await importOriginal<object>()),
		useTenant: () => tenant.current
	})
);

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

const dispatch = vi.fn();

const Menu = ({
	callsInMenu = false,
	userData = counsellor,
	status = 2,
	onCreateAppointment
}: {
	callsInMenu?: boolean;
	userData?: object;
	status?: number;
	onCreateAppointment?: () => void;
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
							value={{ dispatch } as any}
						>
							<ModalProvider>
								<SessionMenu
									hasUserInitiatedStopOrLeaveRequest={{
										current: false
									}}
									isAskerInfoAvailable
									callsInMenu={callsInMenu}
									onCreateAppointment={onCreateAppointment}
								/>
							</ModalProvider>
						</SessionsDataContext.Provider>
					</ConsultingTypesContext.Provider>
				</ActiveSessionContext.Provider>
			</UserDataContext.Provider>
		</SessionTypeContext.Provider>
	</MemoryRouter>
);

beforeEach(() => {
	const host = document.createElement('div');
	host.id = 'overlay';
	document.body.appendChild(host);
	vi.spyOn(HTMLElement.prototype, 'getClientRects').mockImplementation(
		() => [{ width: 100, height: 40 }] as unknown as DOMRectList
	);
	dispatch.mockClear();
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
	vi.restoreAllMocks();
	document.getElementById('overlay')?.remove();
	tenant.current = null;
});

describe('SessionMenu "Termin anlegen"', () => {
	it('is a menu row that opens the appointment dialog', () => {
		const open = vi.fn();
		render(<Menu onCreateAppointment={open} />);
		const row = document.querySelector<HTMLElement>(
			'[data-cy="session-menu-create-appointment"]'
		);
		expect(row).not.toBeNull();
		expect(
			screen.getByText('sessionList.timeline.appointment.create')
		).toBeTruthy();
		fireEvent.click(row!);
		expect(open).toHaveBeenCalledTimes(1);
	});

	it('is absent while the header offers no opener', () => {
		render(<Menu />);
		expect(
			document.querySelector(
				'[data-cy="session-menu-create-appointment"]'
			)
		).toBeNull();
	});
});
