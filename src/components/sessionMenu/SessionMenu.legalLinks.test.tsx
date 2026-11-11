// @vitest-environment oriso-jsdom
/**
 * ORISO-Admin#1490: an advice seeker's ⋮ menu opens Impressum and
 * Datenschutzerklärung. They must be the advice centre's published documents
 * (department scope, agency × topic), not the Träger template.
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
import { LegalLinksContext } from '../../globalState/provider/LegalLinksProvider';
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
vi.mock('../profile/NotificationSettings/NotificationConfigDialog', () => ({
	NotificationConfigDialog: () => null
}));
const modal = vi.hoisted(() => ({
	props: null as null | Record<string, unknown>
}));
vi.mock('../legalLinks/LegalLinkModal', () => ({
	LegalLinkModal: (props: Record<string, unknown>) => {
		modal.props = props;
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

const askerSession = (item: Record<string, unknown>) => ({
	isSession: true,
	isGroup: false,
	isEnquiry: false,
	rid: '!asker-14:practice.invalid',
	agency: { id: 3, name: 'Beratungsstelle Mitte' },
	item: {
		id: 14,
		consultingType: 0,
		matrixRoomId: '!asker-14:practice.invalid',
		active: true,
		subscribed: true,
		status: 2,
		...item
	}
});

const asker = {
	userId: 'asker',
	grantedAuthorities: [AUTHORITIES.ASKER_DEFAULT]
};

const legalLinks = [
	{
		label: 'legal.privacy.label',
		getUrl: () => '/datenschutz',
		url: '/datenschutz',
		registration: true
	}
];

const Menu = ({ session }: { session: object }) => (
	<MemoryRouter>
		<SessionTypeContext.Provider
			value={
				{
					type: SESSION_LIST_TYPES.MY_SESSION,
					path: '/sessions/user/view'
				} as any
			}
		>
			<UserDataContext.Provider value={{ userData: asker } as any}>
				<ActiveSessionContext.Provider
					value={
						{
							activeSession: session,
							reloadActiveSession: vi.fn()
						} as any
					}
				>
					<ConsultingTypesContext.Provider
						value={{ consultingTypes: [{ id: 0 }] } as any}
					>
						<SessionsDataContext.Provider
							value={{ dispatch: vi.fn() } as any}
						>
							<LegalLinksContext.Provider
								value={legalLinks as any}
							>
								<ModalProvider>
									<SessionMenu
										hasUserInitiatedStopOrLeaveRequest={{
											current: false
										}}
										isAskerInfoAvailable
									/>
								</ModalProvider>
							</LegalLinksContext.Provider>
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
	modal.props = null;
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
});

const openPrivacy = () => {
	fireEvent.click(screen.getAllByRole('button', { name: 'app.menu' })[0]);
	fireEvent.click(
		screen.getByRole('button', { name: /legal\.privacy\.label/ })
	);
};

describe('SessionMenu legal links (ORISO-Admin#1490)', () => {
	it("opens the advice centre's document for the session's agency and topic", () => {
		render(
			<Menu
				session={askerSession({ topic: { id: 14, name: 'Schulden' } })}
			/>
		);
		openPrivacy();
		expect(modal.props).toMatchObject({
			scope: 'agency',
			agencyId: 3,
			topicId: 14,
			url: '/datenschutz'
		});
	});

	it('keeps the tenant text when the session names no topic', () => {
		render(<Menu session={askerSession({ topic: 'Schulden' })} />);
		openPrivacy();
		expect(modal.props).not.toBeNull();
		expect(modal.props?.scope).toBeUndefined();
	});
});
