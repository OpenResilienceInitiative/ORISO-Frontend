// @vitest-environment oriso-jsdom
/**
 * #1979 / review on #1981: the conversation menu's e-mail link must follow
 * the same tenant state as the Settings panel it points to. A permission
 * refresh that omits a key must not re-enable the link while the merged
 * tenant context (which Settings reads) still says `false`.
 */
import * as React from 'react';
import { cleanup, render } from '@testing-library/react';
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
const emailLink = vi.hoisted(() => ({ shown: undefined as unknown }));
vi.mock('../profile/NotificationSettings/NotificationConfigDialog', () => ({
	NotificationConfigDialog: (props: { showEmailLink?: boolean }) => {
		emailLink.shown = props.showEmailLink;
		return null;
	}
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
							value={{ dispatch } as any}
						>
							<ModalProvider>
								<SessionMenu
									hasUserInitiatedStopOrLeaveRequest={{
										current: false
									}}
									isAskerInfoAvailable
									callsInMenu={callsInMenu}
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
	emailLink.shown = undefined;
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

const asker = {
	userId: 'asker',
	grantedAuthorities: [AUTHORITIES.ASKER_DEFAULT]
};

describe('SessionMenu e-mail settings link', () => {
	it('follows the merged tenant context, not a refresh that omitted the key', () => {
		// The per-session refresh (mocked above) answered without the key;
		// the context still holds the Träger's explicit "no".
		tenant.current = { settings: { featureAskerEmailEnabled: false } };
		render(<Menu userData={asker} />);
		expect(emailLink.shown).toBe(false);
	});

	it('links an advice seeker while the context permits e-mail', () => {
		tenant.current = { settings: { featureAskerEmailEnabled: true } };
		render(<Menu userData={asker} />);
		expect(emailLink.shown).toBe(true);
	});
});
