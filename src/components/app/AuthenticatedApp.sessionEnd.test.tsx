// @vitest-environment oriso-jsdom
import * as React from 'react';
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import { AuthenticatedApp } from './AuthenticatedApp';
import { UserDataContext } from '../../globalState';
import { ModalProvider } from '../../globalState/provider/ModalProvider';
import { UserDataProvider } from '../../globalState/provider/UserDataProvider';
import type { UserDataInterface } from '../../globalState/interfaces/UserDataInterface';
import {
	removeAllCookies,
	setValueInCookie
} from '../sessionCookie/accessSessionCookie';
import {
	REFRESH_TOKEN_VALID_UNTIL_KEY,
	removeTokenExpiryFromLocalStorage
} from '../sessionCookie/accessSessionLocalStorage';
import {
	APP_SESSION_ENDED_KEY,
	getAppSessionScope,
	publishAppSessionEnd
} from '../sessionCookie/observeAppSession';

const mocks = vi.hoisted(() => ({
	logout: vi.fn(),
	peerTeardown: vi.fn(),
	localTeardown: vi.fn(),
	setMatrix: vi.fn(),
	getUserData: vi.fn(),
	updatePassword: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../../globalState', async () => {
	const { createContext } = await import('react');
	const { ModalContext } = await import(
		'../../globalState/context/ModalContext'
	);
	const { UserDataContext } = await import(
		'../../globalState/context/UserDataContext'
	);
	const setter = () => {};
	return {
		ModalContext,
		UserDataContext,
		ConsultingTypesContext: createContext({ setConsultingTypes: setter }),
		InformalContext: createContext({ setInformal: setter }),
		LocaleContext: createContext({ locale: 'de', setLocale: setter }),
		NotificationsContext: createContext({ setNotifications: setter }),
		hasUserAuthority: () => false,
		AUTHORITIES: {
			CONSULTANT_DEFAULT: 'consultant',
			ANONYMOUS_DEFAULT: 'anonymous'
		}
	};
});
vi.mock('./Routing', async () => {
	const { useContext } = await import('react');
	const { useLocation } = await import('react-router-dom');
	const { UserDataContext } = await import('../../globalState');
	const { PasswordReset } = await import('../passwordReset/PasswordReset');
	return {
		Routing: ({ logout }: { logout: () => void }) => {
			const { userData } = useContext(UserDataContext);
			const { pathname } = useLocation();
			return (
				<>
					<p>
						Private profile:{' '}
						{String(userData.appointmentFeatureEnabled)}
					</p>
					<button type="button" onClick={logout}>
						Sign out
					</button>
					{pathname === securityPath && <PasswordReset />}
				</>
			);
		}
	};
});
vi.mock('./Loading', () => ({ Loading: () => <p>Loading session</p> }));
vi.mock('../../api', () => ({
	apiGetConsultingTypes: vi.fn().mockResolvedValue([]),
	apiGetUserData: mocks.getUserData,
	apiUpdatePassword: mocks.updatePassword
}));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));
vi.mock('focus-trap-react', () => ({
	default: ({ children }: React.PropsWithChildren) => <>{children}</>
}));
vi.mock('../animatedIllustration/AnimatedIllustration', () => ({
	CheckAnimation: () => null
}));
vi.mock('../../utils/tenantSettingsHelper', () => ({
	getTenantSettings: () => ({})
}));
vi.mock('../auth/auth', () => ({
	handleTokenRefresh: vi.fn().mockResolvedValue(undefined),
	isTokenRefreshUnavailableError: () => false
}));
vi.mock('../logout/logout', () => ({
	logout: mocks.logout,
	teardownLocalSession: mocks.localTeardown,
	teardownPeerLocalSession: mocks.peerTeardown
}));
vi.mock('../sessionCookie/getMatrixAccessToken', () => ({
	getCurrentAuthSubject: () => 'synthetic-user',
	getMatrixAccessToken: vi.fn().mockResolvedValue({ homeserverUrl: null }),
	persistMatrixLoginData: vi.fn()
}));
vi.mock('../../globalState/context/MatrixClientContext', () => ({
	useMatrixClient: () => ({
		matrixClientService: null,
		setMatrixClientService: mocks.setMatrix
	})
}));
vi.mock('../../globalState/provider/CallProvider', () => ({
	useCall: () => ({})
}));
vi.mock('../../hooks/useAppConfig', () => ({
	useAppConfig: () => ({ releaseToggles: {}, urls: { toLogin: '/login' } })
}));
vi.mock('../../hooks/useNotificationPermission', () => ({
	useNotificationPermission: vi.fn()
}));
vi.mock('../../hooks/useAuthenticatedChatRecovery', () => ({
	useAuthenticatedChatRecovery: vi.fn()
}));
vi.mock('../../hooks/usePendingGroupChatJoin', () => ({
	usePendingGroupChatJoin: () => true
}));
vi.mock('../../hooks/useDisplayFilter', () => ({
	useDisplayFilterStoreBinding: vi.fn()
}));
vi.mock('../../hooks/useTimelineSettings', () => ({
	useTimelineSettingsStoreBinding: vi.fn()
}));
vi.mock('../../hooks/useAccountInactivityActivity', () => ({
	useAccountInactivityActivity: vi.fn()
}));
vi.mock('../groupChat/groupJoinHandoverCopy', () => ({
	useGroupJoinHandoverCopy: () => undefined
}));
vi.mock('../twoFactorAuth/AccountSetupGate', () => ({
	AccountSetupGate: () => null
}));
vi.mock('../twoFactorAuth/accountSetupStep', () => ({
	isAccountSetupPending: () => false,
	resolveAccountSetupStep: () => null
}));
vi.mock('../registration/autoLogin', () => ({
	POST_REGISTRATION_LOADER_KEY: 'test-registration'
}));
vi.mock('../E2EEncryptionSupportBanner/E2EEncryptionSupportBanner', () => ({
	E2EEncryptionSupportBanner: () => null
}));
vi.mock('../E2EEncryptionSupportBanner/KeyBackupRecoveryPrompt', () => ({
	KeyBackupRecoveryPrompt: () => null
}));
vi.mock('../E2EEncryptionSupportBanner/RecoveryKeySaveReminder', () => ({
	RecoveryKeySaveReminder: () => null
}));
vi.mock('../m3Snackbar/M3SnackbarHost', () => ({ M3SnackbarHost: () => null }));
vi.mock('../../practice/PracticeLayer', () => ({
	PracticeLayer: ({ children }: React.PropsWithChildren) => children
}));
vi.mock('../groupChat/joinRequest/JoinRequestCenter', () => ({
	JoinRequestCenter: () => null
}));
vi.mock('../groupChat/joinRequest/httpJoinRequestTransport', () => ({
	httpJoinRequestTransport: {}
}));
vi.mock('./BuildIdentity', () => ({
	AuthenticatedBuildIdentityBoundary: ({
		children
	}: React.PropsWithChildren) => children
}));
vi.mock('../../utils/displayFilter/store', () => ({
	displayFilterStore: { detachClient: vi.fn() }
}));
vi.mock('../../utils/appConfig', () => ({
	appConfig: { blockConsultantAppLogin: false }
}));

const securityPath = '/profile/einstellungen/sicherheit';
const profile = {
	userId: 'synthetic-user',
	appointmentFeatureEnabled: true
} as UserDataInterface;
const reloadUserData = vi.fn().mockResolvedValue(profile);
const onAppReady = vi.fn();
const onLogout = vi.fn();

const shell = (userData: UserDataInterface | null) => (
	<MemoryRouter>
		<UserDataContext.Provider
			value={{ userData, reloadUserData, setUserData: vi.fn() }}
		>
			<AuthenticatedApp onAppReady={onAppReady} onLogout={onLogout} />
		</UserDataContext.Provider>
	</MemoryRouter>
);

describe('authenticated shell sign-out', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		const claims = btoa(
			JSON.stringify({
				sub: profile.userId,
				sid: 'synthetic-session',
				iss: 'https://identity.example.test'
			})
		);
		const token = `header.${claims}.signature`;
		setValueInCookie('keycloak', token);
		setValueInCookie('refreshToken', token);
		localStorage.setItem(REFRESH_TOKEN_VALID_UNTIL_KEY, '1');
	});

	afterEach(() => {
		cleanup();
		vi.unstubAllGlobals();
		removeAllCookies();
		removeTokenExpiryFromLocalStorage();
		localStorage.removeItem(APP_SESSION_ENDED_KEY);
	});

	it('keeps the current view while logout is pending and withdraws routing when the profile is cleared', async () => {
		const user = userEvent.setup();
		const { rerender } = render(shell(profile));
		expect(await screen.findByText('Private profile: true')).toBeTruthy();

		await user.click(screen.getByRole('button', { name: 'Sign out' }));
		expect(mocks.logout).toHaveBeenCalledTimes(1);
		expect(screen.getByText('Private profile: true')).toBeTruthy();

		rerender(shell(null));
		expect(screen.queryByText('Private profile: true')).toBeNull();
		expect(screen.getByText('Loading session')).toBeTruthy();
	});

	it('keeps the password-change confirmation through sign-out and takes its button to sign-in', async () => {
		const location = {
			pathname: securityPath,
			search: '',
			href: securityPath,
			replace: vi.fn()
		};
		vi.stubGlobal('location', location);
		mocks.getUserData.mockResolvedValueOnce(profile);
		let finishSignOut: () => void;
		mocks.logout.mockImplementationOnce(
			(_redirect, _path, onLocalSessionEnded) => {
				finishSignOut = () => {
					removeAllCookies();
					onLocalSessionEnded();
				};
			}
		);
		const user = userEvent.setup();
		const confirmation =
			'profile.functions.password.reset.overlay.headline';
		const oldPasswordLabel = 'profile.functions.password.reset.old.label';
		let updateSnapshot: (data: UserDataInterface) => void;
		const CaptureSnapshotSetter = () => {
			updateSnapshot = React.useContext(UserDataContext).setUserData;
			return null;
		};
		render(
			<MemoryRouter initialEntries={[securityPath]}>
				<ModalProvider>
					<div id="overlay" />
					<UserDataProvider>
						<CaptureSnapshotSetter />
						<AuthenticatedApp
							onAppReady={onAppReady}
							onLogout={onLogout}
						/>
					</UserDataProvider>
				</ModalProvider>
			</MemoryRouter>
		);

		const newPassword = 'Synthetic!Password42';
		fireEvent.change(await screen.findByLabelText(oldPasswordLabel), {
			target: { value: 'old-synthetic' }
		});
		fireEvent.change(
			screen.getByLabelText('profile.functions.password.reset.new.label'),
			{
				target: { value: newPassword }
			}
		);
		fireEvent.change(
			screen.getByLabelText(
				'profile.functions.password.reset.confirm.label'
			),
			{
				target: { value: newPassword }
			}
		);
		await user.click(
			screen.getByRole('button', {
				name: 'profile.functions.security.button'
			})
		);
		await waitFor(() =>
			expect(mocks.logout).toHaveBeenCalledExactlyOnceWith(
				false,
				'/login',
				expect.any(Function)
			)
		);
		expect(mocks.updatePassword).toHaveBeenCalledExactlyOnceWith(
			'old-synthetic',
			newPassword
		);
		expect(await screen.findByText(confirmation)).toBeTruthy();
		expect(screen.getByText('Private profile: true')).toBeTruthy();

		// The pending logout has finished its pre-logout work and now clears
		// auth. The real UserDataProvider withdraws its protected snapshot.
		act(() => finishSignOut());
		expect(screen.queryByText('Private profile: true')).toBeNull();
		expect(screen.queryByLabelText(oldPasswordLabel)).toBeNull();
		expect(screen.getByText(confirmation)).toBeTruthy();
		act(() => window.dispatchEvent(new Event('pageshow')));
		expect(location.replace).not.toHaveBeenCalled();
		expect(mocks.peerTeardown).not.toHaveBeenCalled();
		act(() => updateSnapshot(profile));
		expect(screen.queryByText('Private profile: true')).toBeNull();
		await user.click(
			screen.getByRole('button', {
				name: 'profile.functions.password.reset.overlay.button.label'
			})
		);
		expect(location.href).toBe('/login');
	});

	it('withdraws the old view before the peer tab navigates to sign-in', async () => {
		const replace = vi.fn(() => {
			expect(screen.queryByText('Private profile: true')).toBeNull();
		});
		vi.stubGlobal('location', {
			pathname: '/profile/allgemeines',
			search: '',
			replace
		});
		render(shell(profile));
		expect(await screen.findByText('Private profile: true')).toBeTruthy();

		const scope = getAppSessionScope();
		act(() => {
			removeTokenExpiryFromLocalStorage();
			window.dispatchEvent(
				new StorageEvent('storage', {
					key: REFRESH_TOKEN_VALID_UNTIL_KEY,
					storageArea: localStorage
				})
			);
		});
		expect(screen.getByText('Private profile: true')).toBeTruthy();

		// The peer's cookie view can still lag when the explicit signal arrives.
		act(() => {
			publishAppSessionEnd(scope);
			window.dispatchEvent(
				new StorageEvent('storage', {
					key: APP_SESSION_ENDED_KEY,
					newValue: scope?.identity,
					storageArea: localStorage
				})
			);
		});

		expect(replace).toHaveBeenCalledExactlyOnceWith('/login');
		expect(mocks.peerTeardown).toHaveBeenCalledTimes(1);
		expect(onLogout).toHaveBeenCalledTimes(1);
		expect(mocks.logout).not.toHaveBeenCalled();
		expect(mocks.localTeardown).not.toHaveBeenCalled();
	});
});
