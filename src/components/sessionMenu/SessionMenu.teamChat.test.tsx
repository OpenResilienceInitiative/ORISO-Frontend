// @vitest-environment oriso-jsdom
/**
 * FE#2491: the team chat of an open enquiry is switched on and off in
 * "Weitere Funktionen", like supervision — one row for the state it is in,
 * and switching off asks first.
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

// Browser-only animation renderers have no canvas in jsdom.
vi.mock('lottie-web', () => ({ default: { loadAnimation: () => ({}) } }));
vi.mock('lottie-react', () => ({ default: () => null }));
// jsdom has no layout, so the overlay's focus trap finds nothing tabbable.
vi.mock('focus-trap-react', () => ({
	default: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));
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

const enquiry = {
	isSession: false,
	isGroup: false,
	isEnquiry: true,
	rid: '!enquiry:test',
	item: {
		id: 4711,
		consultingType: 0,
		matrixRoomId: '!enquiry:test',
		status: 1,
		active: true,
		subscribed: true
	}
};

const counsellor = {
	userId: 'counsellor',
	grantedAuthorities: [AUTHORITIES.CONSULTANT_DEFAULT]
};

type TeamProps = Pick<
	React.ComponentProps<typeof SessionMenu>,
	| 'onOpenTeamChat'
	| 'onSwitchTeamChatOn'
	| 'onSwitchTeamChatOff'
	| 'teamChatToggling'
>;

const Menu = ({
	session = enquiry,
	...props
}: TeamProps & { session?: typeof enquiry }) => (
	<MemoryRouter>
		<SessionTypeContext.Provider
			value={
				{
					type: SESSION_LIST_TYPES.ENQUIRY,
					path: '/sessions/consultant/sessionPreview'
				} as any
			}
		>
			<UserDataContext.Provider value={{ userData: counsellor } as any}>
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
							<ModalProvider>
								<SessionMenu
									hasUserInitiatedStopOrLeaveRequest={{
										current: false
									}}
									isAskerInfoAvailable
									{...props}
								/>
							</ModalProvider>
						</SessionsDataContext.Provider>
					</ConsultingTypesContext.Provider>
				</ActiveSessionContext.Provider>
			</UserDataContext.Provider>
		</SessionTypeContext.Provider>
	</MemoryRouter>
);

const row = (cy: string) =>
	document.querySelector<HTMLButtonElement>(`[data-cy="${cy}"]`);

beforeEach(() => {
	const host = document.createElement('div');
	host.id = 'overlay';
	document.body.appendChild(host);
	vi.spyOn(HTMLElement.prototype, 'getClientRects').mockImplementation(
		() => [{ width: 100, height: 40 }] as unknown as DOMRectList
	);
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

describe('SessionMenu — Team-Chat switch (FE#2491)', () => {
	it('offers nothing when the team chat is not available for this enquiry', () => {
		render(<Menu />);
		expect(row('session-menu-team-chat')).toBeNull();
		expect(row('session-menu-team-chat-on')).toBeNull();
		expect(row('session-menu-team-chat-off')).toBeNull();
	});

	it('switches the team chat on while it is off or switched off', () => {
		const switchOn = vi.fn();
		render(<Menu onSwitchTeamChatOn={switchOn} />);
		expect(row('session-menu-team-chat-off')).toBeNull();
		expect(screen.getByText('teamDiscussion.switchOn.menu')).toBeTruthy();
		fireEvent.click(row('session-menu-team-chat-on')!);
		expect(switchOn).toHaveBeenCalledTimes(1);
	});

	it('disables the switch-on row while the switch is in flight', () => {
		render(<Menu onSwitchTeamChatOn={vi.fn()} teamChatToggling="on" />);
		expect(row('session-menu-team-chat-on')!.disabled).toBe(true);
	});

	it('opens and offers switching off while the team chat is on', () => {
		const open = vi.fn();
		render(<Menu onOpenTeamChat={open} onSwitchTeamChatOff={vi.fn()} />);
		expect(row('session-menu-team-chat-on')).toBeNull();
		expect(row('session-menu-team-chat-off')).not.toBeNull();
		fireEvent.click(row('session-menu-team-chat')!);
		expect(open).toHaveBeenCalledTimes(1);
	});

	it('switches off only after the confirmation', async () => {
		const switchOff = vi.fn(async () => undefined);
		render(
			<Menu onOpenTeamChat={vi.fn()} onSwitchTeamChatOff={switchOff} />
		);
		fireEvent.click(row('session-menu-team-chat-off')!);
		expect(switchOff).not.toHaveBeenCalled();
		expect(
			await screen.findByText('teamDiscussion.switchOff.confirm.headline')
		).toBeTruthy();
		fireEvent.click(
			screen.getByText('teamDiscussion.switchOff.confirm.confirm')
		);
		await waitFor(() => expect(switchOff).toHaveBeenCalledTimes(1));
		await waitFor(() =>
			expect(
				screen.queryByText('teamDiscussion.switchOff.confirm.headline')
			).toBeNull()
		);
	});

	it('never switches off another case that became active while the confirmation was open', async () => {
		const switchOff = vi.fn(async () => undefined);
		const { rerender } = render(
			<Menu onOpenTeamChat={vi.fn()} onSwitchTeamChatOff={switchOff} />
		);
		fireEvent.click(row('session-menu-team-chat-off')!);
		await screen.findByText('teamDiscussion.switchOff.confirm.headline');
		rerender(
			<Menu
				session={{ ...enquiry, item: { ...enquiry.item, id: 4712 } }}
				onOpenTeamChat={vi.fn()}
				onSwitchTeamChatOff={switchOff}
			/>
		);
		fireEvent.click(
			screen.getByText('teamDiscussion.switchOff.confirm.confirm')
		);
		await waitFor(() =>
			expect(
				screen.queryByText('teamDiscussion.switchOff.confirm.headline')
			).toBeNull()
		);
		expect(switchOff).not.toHaveBeenCalled();
	});

	it('keeps the team chat on when the confirmation is cancelled', async () => {
		const switchOff = vi.fn();
		render(
			<Menu onOpenTeamChat={vi.fn()} onSwitchTeamChatOff={switchOff} />
		);
		fireEvent.click(row('session-menu-team-chat-off')!);
		fireEvent.click(
			await screen.findByText('teamDiscussion.switchOff.confirm.cancel')
		);
		await waitFor(() =>
			expect(
				screen.queryByText('teamDiscussion.switchOff.confirm.headline')
			).toBeNull()
		);
		expect(switchOff).not.toHaveBeenCalled();
	});
});
