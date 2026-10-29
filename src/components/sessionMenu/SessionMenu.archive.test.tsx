// @vitest-environment oriso-jsdom
/**
 * Archiving must tell the truth: the "archived" confirmation appears only
 * after the server said yes, a failure shows an error, and the list keeps the
 * chat (OBP 2.1: "archive reports success but nothing changes").
 */
import * as React from 'react';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
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
import { apiPutArchive } from '../../api';
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
	vi.mocked(apiPutArchive).mockReset();
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

const clickArchive = () => {
	const entry = Array.from(
		document.querySelectorAll('.sessionMenu__item')
	).find((el) => el.textContent?.includes('chatFlyout.archive'));
	fireEvent.click(entry as Element);
};
const bodyText = () => document.body.textContent ?? '';

describe('SessionMenu archive', () => {
	it('shows an error and keeps the chat when the server refuses', async () => {
		vi.mocked(apiPutArchive).mockRejectedValue(new Error('500'));
		render(<Menu />);

		clickArchive();

		await waitFor(() =>
			expect(bodyText()).toContain(
				'groupChat.createError.overlay.headline'
			)
		);
		expect(bodyText()).not.toContain(
			'archive.overlay.session.success.copy'
		);
		expect(dispatch).not.toHaveBeenCalled();
	});

	it('confirms only after the server accepted, then drops the chat', async () => {
		let accept: () => void = () => {};
		vi.mocked(apiPutArchive).mockReturnValue(
			new Promise<void>((resolve) => (accept = resolve))
		);
		render(<Menu />);

		clickArchive();

		expect(apiPutArchive).toHaveBeenCalledWith(-2);
		expect(bodyText()).not.toContain(
			'archive.overlay.session.success.copy'
		);
		accept();
		await waitFor(() =>
			expect(bodyText()).toContain('archive.overlay.session.success.copy')
		);
		expect(dispatch).toHaveBeenCalledWith({
			type: 'REMOVE_SESSIONS',
			ids: ['!practice-2:practice.invalid']
		});
	});
});
