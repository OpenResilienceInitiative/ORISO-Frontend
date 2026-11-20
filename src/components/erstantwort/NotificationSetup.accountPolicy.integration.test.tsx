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
import { apiGetUserData, apiPutEmail } from '../../api';
import { ErstantwortMessage } from './ErstantwortMessage';
import { MemoryRouter } from 'react-router-dom';
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
	let reject!: (reason: unknown) => void;
	const promise = new Promise<T>((yes, no) => {
		resolve = yes;
		reject = no;
	});
	return { promise, resolve, reject };
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
const Harness = ({
	firstReply = false,
	emailOnlySetup = false
}: {
	firstReply?: boolean;
	emailOnlySetup?: boolean;
}) => {
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
			<button
				onClick={() => setUserData({ ...account(), email: undefined })}
			>
				restore
			</button>
			<button onClick={() => void reloadUserData()}>reload</button>
			{firstReply ? (
				<ErstantwortMessage
					trigger={
						emailOnlySetup
							? 'AFTER_ENQUIRY_DISPATCHED'
							: 'AFTER_FIRST_MESSAGE'
					}
					conversationType="AGENCY_COUNSELLING"
					skipAnimation
				/>
			) : (
				<NotificationSetup
					isEmailEnabled={accountEmailAllowed}
					onDone={onDone}
				/>
			)}
		</>
	);
};
const setup = (firstReply = false, emailOnlySetup = false) =>
	render(
		<MemoryRouter>
			<TenantContext.Provider
				value={{
					tenant: accountPolicyTenant({
						featureAskerEmailCollectionSelfHelpEnabled: false,
						featureAskerBrowserAgencyCounsellingEnabled:
							!emailOnlySetup
					}),
					setTenant: vi.fn(),
					updateTenantSettings: vi.fn()
				}}
			>
				<UserDataProvider>
					<ModalProvider>
						<Harness
							firstReply={firstReply}
							emailOnlySetup={emailOnlySetup}
						/>
					</ModalProvider>
				</UserDataProvider>
			</TenantContext.Provider>
		</MemoryRouter>
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
	const initial = deferred<UserDataInterface>();
	const refresh = deferred<UserDataInterface>();
	vi.mocked(apiGetUserData)
		.mockReset()
		.mockReturnValueOnce(initial.promise)
		.mockReturnValueOnce(refresh.promise);
	setup();
	await act(async () => initial.resolve(account()));
	await chooseBoth();
	await waitFor(() => expect(apiGetUserData).toHaveBeenCalledTimes(2));
	expect(screen.getByTestId('capability').textContent).toBe('true');
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
/** Clicks a control in the task in which React commits it, before React's
 * passive effects for that commit run (a real browser can dispatch a click
 * there; under load RTL's waitFor polling lands there too). */
const clickOnCommit = (find: () => HTMLElement | null) =>
	new Promise<void>((resolve) => {
		const observer = new MutationObserver(() => {
			const element = find();
			if (!element) return;
			observer.disconnect();
			fireEvent.click(element);
			resolve();
		});
		observer.observe(document.body, { childList: true, subtree: true });
	});
it('keeps a BOTH choice clicked in the commit that loaded the account', async () => {
	const initial = deferred<UserDataInterface>();
	vi.mocked(apiGetUserData)
		.mockReset()
		.mockReturnValueOnce(initial.promise)
		.mockResolvedValueOnce(account(true, true));
	setup();
	const clicked = clickOnCommit(() =>
		screen.queryByRole('button', { name: /notificationChoice.both/ })
	);
	initial.resolve(account());
	await clicked;
	await waitFor(() => expect(apiPatchUserData).toHaveBeenCalledOnce());
	await waitFor(() => expect(apiGetUserData).toHaveBeenCalledTimes(2));
	expect(await screen.findByRole('button', { name: /enableBrowser/ })).toBe(
		continueBrowser()
	);
});
it('keeps the first-reply email form opened in the commit that loaded the account', async () => {
	const initial = deferred<UserDataInterface>();
	vi.mocked(apiGetUserData).mockReset().mockReturnValueOnce(initial.promise);
	setup(true);
	const clicked = clickOnCommit(() =>
		screen.queryByRole('button', {
			name: 'erstantwort.emailNotification.action'
		})
	);
	initial.resolve({ ...account(), email: undefined });
	await clicked;
	expect(await screen.findByRole('textbox')).toBeTruthy();
});
it('does not continue an email subscription revoked while the server write is pending', async () => {
	const write = deferred<void>();
	vi.mocked(apiPatchUserData).mockReturnValueOnce(write.promise);
	setup();
	await chooseBoth();
	fireEvent.click(
		screen.getByRole('button', {
			name: 'revoke',
			hidden: true
		})
	);
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

it('closes the actual accepted first-reply email form across its real provider refresh without reopening it', async () => {
	const refresh = deferred<UserDataInterface>();
	vi.mocked(apiGetUserData)
		.mockReset()
		.mockResolvedValueOnce({ ...account(), email: undefined })
		.mockReturnValueOnce(refresh.promise);
	vi.mocked(apiPutEmail).mockResolvedValue(undefined);
	setup(true);
	fireEvent.click(
		await screen.findByRole('button', {
			name: 'erstantwort.emailNotification.action'
		})
	);
	fireEvent.change(await screen.findByRole('textbox'), {
		target: { value: 'new@example.test' }
	});
	fireEvent.click(
		screen.getByRole('button', {
			name: 'furtherSteps.email.overlay.button1.label'
		})
	);
	await waitFor(() => expect(apiPutEmail).toHaveBeenCalledOnce());
	await waitFor(() => expect(apiGetUserData).toHaveBeenCalledTimes(2));
	await act(async () =>
		refresh.resolve({ ...account(), email: 'new@example.test' })
	);
	expect(screen.queryByRole('textbox')).toBeNull();
	expect(apiPutEmail).toHaveBeenCalledTimes(1);
});

const openFirstReplyEmail = async () => {
	fireEvent.click(
		await screen.findByRole('button', {
			name: 'erstantwort.emailNotification.action'
		})
	);
	fireEvent.change(await screen.findByRole('textbox'), {
		target: { value: 'new@example.test' }
	});
	fireEvent.click(
		screen.getByRole('button', {
			name: 'furtherSteps.email.overlay.button1.label'
		})
	);
};
it('keeps a pending first-reply email save through an unrelated account reload', async () => {
	const write = deferred<void>();
	const unrelated = deferred<UserDataInterface>();
	vi.mocked(apiGetUserData)
		.mockReset()
		.mockResolvedValueOnce({ ...account(), email: undefined })
		.mockReturnValueOnce(unrelated.promise)
		.mockResolvedValueOnce({ ...account(), email: 'new@example.test' });
	vi.mocked(apiPutEmail).mockReturnValueOnce(write.promise);
	setup(true);
	await openFirstReplyEmail();
	fireEvent.click(
		screen.getByRole('button', {
			name: 'reload',
			hidden: true
		})
	);
	expect(screen.getByTestId('capability').textContent).toBe('true');
	await act(async () => write.resolve());
	expect(
		await screen.findByText('furtherSteps.email.success.overlay.headline')
	).toBeTruthy();
	await act(async () =>
		unrelated.resolve({ ...account(), email: undefined })
	);
	expect(apiPutEmail).toHaveBeenCalledOnce();
});
it('keeps a rejected first-reply email form retryable until the server accepts it', async () => {
	vi.mocked(apiGetUserData)
		.mockReset()
		.mockResolvedValueOnce({ ...account(), email: undefined })
		.mockResolvedValueOnce({ ...account(), email: 'new@example.test' });
	vi.mocked(apiPutEmail)
		.mockRejectedValueOnce(new Error('offline'))
		.mockResolvedValueOnce(undefined);
	setup(true);
	await openFirstReplyEmail();
	await screen.findAllByText('erstantwort.emailNotification.saveFailed');
	expect(screen.getByRole<HTMLInputElement>('textbox').value).toBe(
		'new@example.test'
	);
	fireEvent.click(
		screen.getByRole('button', {
			name: 'furtherSteps.email.overlay.button1.label'
		})
	);
	await waitFor(() => expect(apiGetUserData).toHaveBeenCalledTimes(2));
	await waitFor(() => expect(screen.queryByRole('textbox')).toBeNull());
	expect(apiPutEmail).toHaveBeenCalledTimes(2);
});
it('does not close a new first-reply email opening when a cancelled write returns late', async () => {
	const write = deferred<void>();
	vi.mocked(apiGetUserData)
		.mockReset()
		.mockResolvedValueOnce({ ...account(), email: undefined });
	vi.mocked(apiPutEmail).mockReturnValueOnce(write.promise);
	setup(true);
	await openFirstReplyEmail();
	fireEvent.click(
		screen.getByRole('button', {
			name: 'furtherSteps.email.overlay.button2.label'
		})
	);
	fireEvent.click(
		await screen.findByRole('button', {
			name: 'erstantwort.emailNotification.action'
		})
	);
	fireEvent.change(await screen.findByRole('textbox'), {
		target: { value: 'current@example.test' }
	});
	await act(async () => write.resolve());
	expect(screen.getByRole<HTMLInputElement>('textbox').value).toBe(
		'current@example.test'
	);
	expect(apiGetUserData).toHaveBeenCalledTimes(1);
});
it('does not restore the first-reply form or refresh an obsolete write after collection revocation', async () => {
	const write = deferred<void>();
	vi.mocked(apiGetUserData)
		.mockReset()
		.mockResolvedValueOnce({ ...account(), email: undefined });
	vi.mocked(apiPutEmail).mockReturnValueOnce(write.promise);
	setup(true);
	await openFirstReplyEmail();
	fireEvent.click(
		screen.getByRole('button', {
			name: 'revoke',
			hidden: true
		})
	);
	fireEvent.click(screen.getByRole('button', { name: 'restore' }));
	expect(screen.queryByRole('textbox')).toBeNull();
	await act(async () => write.resolve());
	expect(apiGetUserData).toHaveBeenCalledTimes(1);
});
it.each(['actor', 'tenant', 'actor A→B→A'] as const)(
	'discards the first-reply opening after an authenticated %s transition',
	async (change) => {
		const write = deferred<void>();
		const nextSubject = change === 'actor' ? 'other' : 'policy-asker';
		vi.mocked(apiGetUserData)
			.mockReset()
			.mockResolvedValueOnce({ ...account(), email: undefined })
			.mockResolvedValueOnce({
				...account(),
				email: undefined,
				userId: nextSubject
			});
		vi.mocked(apiPutEmail).mockReturnValueOnce(write.promise);
		setup(true);
		await openFirstReplyEmail();
		act(() => {
			if (change === 'tenant') signIn('policy-asker', 2);
			else {
				signIn('other');
				if (change === 'actor A→B→A') signIn();
			}
		});
		fireEvent.click(
			screen.getByRole('button', {
				name: 'reload',
				hidden: true
			})
		);
		await waitFor(() =>
			expect(screen.getByTestId('capability').textContent).toBe('true')
		);
		expect(screen.queryByRole('textbox')).toBeNull();
		fireEvent.click(
			await screen.findByRole('button', {
				name: 'erstantwort.emailNotification.action'
			})
		);
		fireEvent.change(await screen.findByRole('textbox'), {
			target: { value: 'current@example.test' }
		});
		await act(async () => write.resolve());
		expect(screen.getByRole<HTMLInputElement>('textbox').value).toBe(
			'current@example.test'
		);
		expect(apiGetUserData).toHaveBeenCalledTimes(2);
	}
);

it('confirms the accepted email but shows refresh failure and retries GET only with capability closed', async () => {
	const retry = deferred<UserDataInterface>();
	vi.mocked(apiGetUserData)
		.mockReset()
		.mockResolvedValueOnce({ ...account(), email: undefined })
		.mockRejectedValueOnce(new Error('offline'))
		.mockReturnValueOnce(retry.promise);
	vi.mocked(apiPutEmail).mockResolvedValue(undefined);
	setup(true);
	await openFirstReplyEmail();
	expect(
		await screen.findByRole('heading', {
			name: 'furtherSteps.email.success.overlay.headline'
		})
	).toBeTruthy();
	expect(screen.getByTestId('capability').textContent).toBe('false');
	expect(screen.getByRole('alert').textContent).toContain(
		'erstantwort.emailNotification.refreshFailed'
	);
	expect(screen.queryByRole('textbox')).toBeNull();
	fireEvent.click(
		screen.getByRole('button', {
			name: 'erstantwort.emailNotification.retryRefresh'
		})
	);
	await waitFor(() => expect(apiGetUserData).toHaveBeenCalledTimes(3));
	expect(screen.queryByRole('textbox')).toBeNull();
	expect(apiPutEmail).toHaveBeenCalledTimes(1);
	await act(async () =>
		retry.resolve({ ...account(), email: 'new@example.test' })
	);
	expect(screen.queryByRole('alert')).toBeNull();
	expect(
		screen.getByRole('heading', {
			name: 'furtherSteps.email.success.overlay.headline'
		})
	).toBeTruthy();
	expect(screen.getByTestId('capability').textContent).toBe('true');
	expect(apiPutEmail).toHaveBeenCalledTimes(1);
});

it('keeps an accepted email-only subscription refresh error visible and retries GET only in the actual parent', async () => {
	const retry = deferred<UserDataInterface>();
	vi.mocked(apiGetUserData)
		.mockReset()
		.mockResolvedValueOnce(account())
		.mockRejectedValueOnce(new Error('offline'))
		.mockReturnValueOnce(retry.promise);
	setup(true, true);
	fireEvent.click(
		await screen.findByRole('button', { name: /notificationChoice.email/ })
	);
	await waitFor(() =>
		expect(screen.getByTestId('capability').textContent).toBe('false')
	);
	expect(screen.getByRole('alert').textContent).toContain(
		'erstantwort.notificationChoice.refreshFailed'
	);
	expect(
		document.querySelector('input:not([readonly]):not([disabled])')
	).toBeNull();
	expect(
		screen.queryByRole('button', { name: /notificationChoice.email / })
	).toBeNull();
	fireEvent.click(
		screen.getByRole('button', {
			name: 'erstantwort.emailNotification.retryRefresh'
		})
	);
	await waitFor(() => expect(apiGetUserData).toHaveBeenCalledTimes(3));
	expect(apiPatchUserData).toHaveBeenCalledTimes(1);
	expect(apiPutEmail).not.toHaveBeenCalled();
	await act(async () => retry.resolve(account(true, true)));
	expect(screen.queryByRole('alert')).toBeNull();
	expect(screen.getByTestId('capability').textContent).toBe('true');
	expect(apiPatchUserData).toHaveBeenCalledTimes(1);
});

it('discards a closed accepted-email readback failure without reopening its confirmation', async () => {
	const refresh = deferred<UserDataInterface>();
	vi.mocked(apiGetUserData)
		.mockReset()
		.mockResolvedValueOnce({ ...account(), email: undefined })
		.mockReturnValueOnce(refresh.promise);
	vi.mocked(apiPutEmail).mockResolvedValue(undefined);
	setup(true);
	await openFirstReplyEmail();
	await screen.findByRole('heading', {
		name: 'furtherSteps.email.success.overlay.headline'
	});
	fireEvent.click(
		screen.getByRole('button', {
			name: 'furtherSteps.email.overlay.button2.label'
		})
	);
	await act(async () => refresh.reject(new Error('offline')));
	expect(
		screen.queryByRole('heading', {
			name: 'furtherSteps.email.success.overlay.headline'
		})
	).toBeNull();
	expect(screen.queryByRole('alert')).toBeNull();
	expect(apiPutEmail).toHaveBeenCalledTimes(1);
});
it('does not apply an old accepted-email readback failure to a newer auth-generation form', async () => {
	const refresh = deferred<UserDataInterface>();
	vi.mocked(apiGetUserData)
		.mockReset()
		.mockResolvedValueOnce({ ...account(), email: undefined })
		.mockReturnValueOnce(refresh.promise)
		.mockResolvedValueOnce({ ...account(), email: undefined });
	vi.mocked(apiPutEmail).mockResolvedValue(undefined);
	setup(true);
	await openFirstReplyEmail();
	await screen.findByRole('heading', {
		name: 'furtherSteps.email.success.overlay.headline'
	});
	act(() => {
		signIn('other');
		signIn();
	});
	fireEvent.click(
		screen.getByRole('button', {
			name: 'reload',
			hidden: true
		})
	);
	await waitFor(() =>
		expect(screen.getByTestId('capability').textContent).toBe('true')
	);
	fireEvent.click(
		await screen.findByRole('button', {
			name: 'erstantwort.emailNotification.action'
		})
	);
	fireEvent.change(await screen.findByRole('textbox'), {
		target: { value: 'current@example.test' }
	});
	await act(async () => refresh.reject(new Error('offline')));
	expect(screen.getByRole<HTMLInputElement>('textbox').value).toBe(
		'current@example.test'
	);
	expect(
		screen.queryByText('erstantwort.emailNotification.refreshFailed')
	).toBeNull();
	expect(apiPutEmail).toHaveBeenCalledTimes(1);
});
