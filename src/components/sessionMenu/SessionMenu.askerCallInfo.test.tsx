// @vitest-environment oriso-jsdom
/**
 * Only counsellors start calls (Frank, 17 Nov 2026). An advice seeker sees
 * the call buttons, but they open the appointment information instead.
 */
import * as React from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
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

const startRoomCall = vi.hoisted(() => vi.fn());
vi.mock('../call/startRoomCall', () => ({ startRoomCall }));
const apiGetSessionAppointments = vi.hoisted(() =>
	vi.fn().mockResolvedValue([])
);
vi.mock('../../api/apiSessionAppointments', () => ({
	apiGetSessionAppointments
}));

// Browser-only animation renderers have no canvas in jsdom.
vi.mock('lottie-web', () => ({ default: { loadAnimation: () => ({}) } }));
vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: 'de', resolvedLanguage: 'de' }
	})
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

const asker = {
	userId: 'asker',
	grantedAuthorities: [AUTHORITIES.ASKER_DEFAULT]
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
	startRoomCall.mockClear();
	apiGetSessionAppointments.mockClear();
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

const HEADER = {
	video: 'session-header-start-video-call',
	audio: 'session-header-start-call'
} as const;
const headerButton = (kind: 'video' | 'audio') =>
	document.querySelector<HTMLElement>(`[data-cy="${HEADER[kind]}"]`);

describe('SessionMenu call buttons for an advice seeker', () => {
	it.each(['video', 'audio'] as const)(
		'the %s button opens the appointment information and starts no call',
		async (kind) => {
			render(<Menu userData={asker} />);
			const button = headerButton(kind);
			expect(button).not.toBeNull();
			fireEvent.click(button!);
			expect(startRoomCall).not.toHaveBeenCalled();
			expect(
				await screen.findByText('videoCall.askerInfo.title')
			).toBeTruthy();
			expect(apiGetSessionAppointments).toHaveBeenCalledWith(-2);
			expect(
				await screen.findByText('videoCall.askerInfo.none')
			).toBeTruthy();
		}
	);

	it('"Termin anfragen" closes the information and opens the composer', async () => {
		const composer = document.createElement('div');
		composer.className = 'textarea__input';
		composer.innerHTML = '<div contenteditable="true" tabindex="0"></div>';
		document.body.appendChild(composer);
		render(<Menu userData={asker} />);
		fireEvent.click(headerButton('video')!);
		fireEvent.click(await screen.findByTestId('asker-call-info-request'));
		await waitFor(() =>
			expect(
				document.activeElement?.getAttribute('contenteditable')
			).toBe('true')
		);
		expect(startRoomCall).not.toHaveBeenCalled();
		composer.remove();
	});

	it('in the kebab menu the rows open the information too', async () => {
		render(<Menu userData={asker} callsInMenu />);
		fireEvent.click(
			document.querySelector<HTMLElement>('.sessionMenu__icon--desktop')!
		);
		const row = document.querySelector<HTMLElement>(
			'[data-cy="session-menu-start-video-call"]'
		);
		expect(row).not.toBeNull();
		fireEvent.click(row!);
		expect(startRoomCall).not.toHaveBeenCalled();
		expect(
			await screen.findByText('videoCall.askerInfo.title')
		).toBeTruthy();
	});
});

describe('SessionMenu call buttons for a counsellor (unchanged)', () => {
	it('starts the call and opens no information', () => {
		render(<Menu />);
		fireEvent.click(headerButton('video')!);
		expect(startRoomCall).toHaveBeenCalledTimes(1);
		expect(screen.queryByText('videoCall.askerInfo.title')).toBeNull();
	});
});
