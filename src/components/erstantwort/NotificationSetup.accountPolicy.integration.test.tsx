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
import { afterEach, beforeEach, expect, it, vi } from 'vite-plus/test';
import { UserDataProvider } from '../../globalState/provider/UserDataProvider';
import { UserDataContext } from '../../globalState/context/UserDataContext';
import { TenantContext } from '../../globalState/provider/TenantProvider';
import { ModalProvider } from '../../globalState/provider/ModalProvider';
import {
	accountPolicyTenant,
	accountPolicyUser
} from '../../test/fixtures/askerAccountPolicyFixtures';
import { apiGetUserData } from '../../api';
import { apiPatchUserData } from '../../api/apiPatchUserData';
import {
	setValueInCookie,
	deleteCookieByName
} from '../sessionCookie/accessSessionCookie';
import { notificationSettingsStore } from '../../utils/notificationSettings/store';
import type { UserDataInterface } from '../../globalState/interfaces/UserDataInterface';
import { NotificationSetup } from './NotificationSetup';
import { useAccountEmailCollectionAllowed } from '../../hooks/useAccountEmailCollectionAllowed';

vi.mock('../../api', () => ({
	apiGetUserData: vi.fn(),
	apiPutEmail: vi.fn(),
	FETCH_ERRORS: {},
	X_REASON: {}
}));
vi.mock('../../api/apiPatchUserData', () => ({ apiPatchUserData: vi.fn() }));
vi.mock('lottie-web', () => ({
	default: {
		loadAnimation: () => ({
			destroy() {},
			addEventListener() {},
			play() {},
			stop() {}
		})
	}
}));
vi.mock('focus-trap-react', () => ({
	default: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

const signIn = (sub = 'policy-asker', tenantId = 1) =>
	setValueInCookie(
		'keycloak',
		`header.${btoa(JSON.stringify({ sub, tenantId }))}.sig`
	);
const deferred = <T,>() => {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((yes) => {
		resolve = yes;
	});
	return { promise, resolve };
};
const account = (allowed = true, subscribed = false) =>
	accountPolicyUser({
		email: 'existing@example.test',
		isAskerEmailCollectionAllowed: allowed,
		emailNotifications: {
			emailNotificationsEnabled: subscribed,
			settings: {
				newChatMessageNotificationEnabled: subscribed,
				reassignmentNotificationEnabled: subscribed
			}
		}
	});
const onDone = vi.fn();
const requestPermission = vi.fn();
const Harness = () => {
	const accountEmailAllowed = useAccountEmailCollectionAllowed();
	const { userData, reloadUserData, setUserData } =
		React.useContext(UserDataContext);
	React.useEffect(() => {
		void reloadUserData();
	}, [reloadUserData]);
	return (
		<>
			<output data-testid="capability">
				{String(userData?.isAskerEmailCollectionAllowed)}
			</output>
			<button onClick={() => setUserData(account(false))}>revoke</button>
			<NotificationSetup
				isEmailEnabled={accountEmailAllowed}
				onDone={onDone}
			/>
		</>
	);
};
const setup = () =>
	render(
		<TenantContext.Provider
			value={{
				tenant: accountPolicyTenant({
					featureAskerEmailCollectionLiveChatEnabled: false
				}),
				setTenant: vi.fn(),
				updateTenantSettings: vi.fn()
			}}
		>
			<UserDataProvider>
				<ModalProvider>
					<Harness />
				</ModalProvider>
			</UserDataProvider>
		</TenantContext.Provider>
	);
const chooseBoth = async () =>
	fireEvent.click(
		await screen.findByRole('button', { name: /notificationChoice.both/ })
	);
const continueBrowser = () =>
	screen.queryByRole('button', {
		name: 'erstantwort.notificationChoice.enableBrowser'
	});
beforeEach(() => {
	localStorage.clear();
	notificationSettingsStore.resetForTests();
	vi.resetAllMocks();
	signIn();
	document.body.innerHTML = '<div id="overlay"></div>';
	vi.mocked(apiGetUserData).mockResolvedValueOnce(account());
	vi.mocked(apiPatchUserData).mockResolvedValue(undefined);
	vi.stubGlobal('Notification', { permission: 'default', requestPermission });
	requestPermission.mockImplementation(async () => {
		Object.defineProperty(Notification, 'permission', {
			value: 'granted',
			configurable: true
		});
		return 'granted';
	});
});
afterEach(() => {
	cleanup();
	deleteCookieByName('keycloak');
	vi.unstubAllGlobals();
});

it('preserves BOTH through its own real provider capability refresh and a fresh browser gesture', async () => {
	const refresh = deferred<UserDataInterface>();
	vi.mocked(apiGetUserData).mockReturnValueOnce(refresh.promise);
	setup();
	await chooseBoth();
	await waitFor(() =>
		expect(screen.getByTestId('capability').textContent).toBe('undefined')
	);
	expect(requestPermission).not.toHaveBeenCalled();
	await act(async () => refresh.resolve(account(true, true)));
	fireEvent.click(
		await screen.findByRole('button', {
			name: 'erstantwort.notificationChoice.enableBrowser'
		})
	);
	await waitFor(() =>
		expect(
			JSON.parse(localStorage.getItem('BROWSER_NOTIFICATIONS')!).enabled
		).toBe(true)
	);
	expect(onDone).toHaveBeenCalledOnce();
});
it('does not continue an email subscription revoked while the server write is pending', async () => {
	const write = deferred<void>();
	vi.mocked(apiPatchUserData).mockReturnValueOnce(write.promise);
	setup();
	await chooseBoth();
	fireEvent.click(screen.getByRole('button', { name: 'revoke' }));
	await act(async () => write.resolve());
	expect(continueBrowser()).toBeNull();
	expect(requestPermission).not.toHaveBeenCalled();
	expect(apiGetUserData).toHaveBeenCalledTimes(1);
	expect(onDone).not.toHaveBeenCalled();
});
it.each(['actor', 'tenant', 'actor A→B→A'] as const)(
	'ignores an accepted refresh after a %s lifetime change',
	async (change) => {
		const refresh = deferred<UserDataInterface>();
		vi.mocked(apiGetUserData).mockReturnValueOnce(refresh.promise);
		setup();
		await chooseBoth();
		await waitFor(() => expect(apiGetUserData).toHaveBeenCalledTimes(2));
		act(() => {
			if (change === 'tenant') signIn('policy-asker', 2);
			else {
				signIn('other');
				if (change === 'actor A→B→A') signIn();
			}
		});
		await act(async () => refresh.resolve(account(true, true)));
		expect(continueBrowser()).toBeNull();
		expect(requestPermission).not.toHaveBeenCalled();
		expect(onDone).not.toHaveBeenCalled();
	}
);
