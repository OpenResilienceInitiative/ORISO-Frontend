// @vitest-environment jsdom
import * as React from 'react';
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { UserDataContext } from '../../globalState/context/UserDataContext';
import { TenantContext } from '../../globalState/provider/TenantProvider';
import type { TenantDataInterface } from '../../globalState/interfaces/TenantDataInterface';
import { ModalProvider } from '../../globalState/provider/ModalProvider';
import { CaseHandoverConversation } from './CaseHandoverConversation';
import { notificationSettingsStore } from '../../utils/notificationSettings/store';
import { UserDataInterface } from '../../globalState/interfaces/UserDataInterface';

vi.hoisted(() => {
	HTMLCanvasElement.prototype.getContext = (() => ({
		fillStyle: '',
		fillRect() {}
	})) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});
const { patch, request, putEmail } = vi.hoisted(() => ({
	patch: vi.fn(),
	request: vi.fn(),
	putEmail: vi.fn()
}));
vi.mock('../../api/apiPatchUserData', () => ({ apiPatchUserData: patch }));
vi.mock('../../api', () => ({
	apiPutEmail: putEmail,
	FETCH_ERRORS: {},
	X_REASON: {}
}));
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
	useTranslation: () => ({
		t: (key: string, fallback?: unknown) =>
			typeof fallback === 'string' ? fallback : key
	})
}));
const account = {
	email: 'asker@example.org',
	emailNotifications: {
		emailNotificationsEnabled: false,
		settings: {
			newChatMessageNotificationEnabled: false,
			appointmentNotificationEnabled: false
		}
	}
} as UserDataInterface;
let saved: UserDataInterface;
const approve = vi.fn();
const decline = vi.fn();
function setup(initial = account, isEmailEnabled?: boolean) {
	const TestAccount = ({
		sessionKey = '1',
		emailEnabled = isEmailEnabled
	}: {
		sessionKey?: string;
		emailEnabled?: boolean;
	}) => {
		const [userData, setUserData] = React.useState(initial);
		const reloadUserData = async () => {
			setUserData(saved);
			return saved;
		};
		return (
			<UserDataContext.Provider
				value={{ userData, reloadUserData, setUserData }}
			>
				<TenantContext.Provider
					value={{
						tenant: {
							settings: {
								featureAskerEmailEnabled: emailEnabled
							}
						} as TenantDataInterface,
						setTenant: () => {},
						updateTenantSettings: () => {}
					}}
				>
					<ModalProvider>
						<CaseHandoverConversation
							key={sessionKey}
							onApprove={approve}
							onDecline={decline}
							consentGranted={false}
						/>
					</ModalProvider>
				</TenantContext.Provider>
			</UserDataContext.Provider>
		);
	};
	const view = render(<TestAccount />);
	return {
		...view,
		switchSession: (id: string) =>
			view.rerender(<TestAccount sessionKey={id} />),
		disableEmail: () => view.rerender(<TestAccount emailEnabled={false} />)
	};
}
beforeEach(() => {
	approve.mockClear();
	decline.mockClear();
	localStorage.clear();
	notificationSettingsStore.resetForTests();
	patch.mockReset();
	request.mockReset();
	putEmail.mockReset();
	saved = {
		...account,
		emailNotifications: {
			...account.emailNotifications,
			emailNotificationsEnabled: true,
			settings: {
				newChatMessageNotificationEnabled: true,
				reassignmentNotificationEnabled: true
			}
		}
	};
	patch.mockResolvedValue(undefined);
	vi.stubGlobal('Notification', {
		permission: 'default',
		requestPermission: request
	});
	request.mockImplementation(async () => {
		Object.defineProperty(Notification, 'permission', {
			value: 'granted',
			configurable: true
		});
		return 'granted';
	});
	document.body.innerHTML = '<div id="overlay"></div>';
});
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

async function openSetup() {
	fireEvent.click(
		screen.getByRole('button', { name: 'caseHandover.consent.info.more' })
	);
	fireEvent.click(
		await screen.findByRole('button', {
			name: 'caseHandover.consent.info.notificationsAction'
		})
	);
	await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
	return screen.findByRole('region', {
		name: 'caseHandover.consent.info.notificationsAction'
	});
}
it('opens and focuses one same-conversation setup message without changing consent', async () => {
	setup();
	const message = await openSetup();
	await waitFor(() => expect(document.activeElement).toBe(message));
	expect(
		screen.getByRole('button', { name: /notificationChoice.both/ })
	).toBeTruthy();
	expect(approve).not.toHaveBeenCalled();
	expect(decline).not.toHaveBeenCalled();
	await openSetup();
	expect(
		screen.getAllByRole('region', {
			name: 'caseHandover.consent.info.notificationsAction'
		})
	).toHaveLength(1);
});
it('reading and closing the explanation does not start notification setup', async () => {
	setup();
	fireEvent.click(
		screen.getByRole('button', { name: 'caseHandover.consent.info.more' })
	);
	fireEvent.click(
		(await screen.findAllByRole('button', { name: 'app.close' }))[0]
	);
	await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
	expect(screen.queryByRole('region')).toBeNull();
	expect(approve).not.toHaveBeenCalled();
});
it('cancelling email setup leaves consent and channels untouched', async () => {
	setup({ ...account, email: undefined });
	await openSetup();
	fireEvent.click(
		screen.getByRole('button', { name: /notificationChoice.both/ })
	);
	fireEvent.click(
		await screen.findByRole('button', {
			name: 'furtherSteps.email.overlay.button2.label'
		})
	);
	expect(screen.queryByRole('textbox')).toBeNull();
	expect(approve).not.toHaveBeenCalled();
	expect(decline).not.toHaveBeenCalled();
	expect(patch).not.toHaveBeenCalled();
	expect(request).not.toHaveBeenCalled();
});
it('reopening setup preserves saved email instead of collecting it again', async () => {
	setup(saved);
	await openSetup();
	expect(
		screen
			.getByRole('button', { name: /notificationChoice.email / })
			.getAttribute('aria-pressed')
	).toBe('true');
	await openSetup();
	expect(screen.queryByRole('textbox')).toBeNull();
	expect(patch).not.toHaveBeenCalled();
});
it('the shortcut uses the same tenant email restriction as regular setup', async () => {
	setup(account, false);
	await openSetup();
	expect(
		screen.queryByRole('button', { name: /notificationChoice.email / })
	).toBeNull();
	expect(
		screen.queryByRole('button', { name: /notificationChoice.both/ })
	).toBeNull();
	expect(
		screen.getByRole('button', { name: /notificationChoice.browser / })
	).toBeTruthy();
});
it('failure remains retryable without deciding handover consent', async () => {
	patch.mockRejectedValueOnce(new Error('offline'));
	setup();
	await openSetup();
	fireEvent.click(
		screen.getByRole('button', { name: /notificationChoice.email / })
	);
	await screen.findByRole('alert');
	fireEvent.click(
		screen.getByRole('button', { name: /notificationChoice.email / })
	);
	await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
	expect(approve).not.toHaveBeenCalled();
	expect(decline).not.toHaveBeenCalled();
});

it('does not carry a transient setup message into another session', async () => {
	const view = setup();
	await openSetup();
	view.switchSession('2');
	expect(screen.queryByRole('region')).toBeNull();
	expect(
		screen.getByRole('button', { name: 'caseHandover.consent.info.more' })
	).toBeTruthy();
});
it('reload reads saved notification state when the shortcut is reopened', async () => {
	setup(saved);
	await openSetup();
	cleanup();
	setup(saved);
	expect(screen.queryByRole('region')).toBeNull();
	await openSetup();
	expect(
		screen
			.getByRole('button', { name: /notificationChoice.email / })
			.getAttribute('aria-pressed')
	).toBe('true');
	expect(screen.queryByRole('textbox')).toBeNull();
});

it('both channels wait for saved email and a separate browser gesture through the shortcut', async () => {
	setup();
	await openSetup();
	fireEvent.click(
		screen.getByRole('button', { name: /notificationChoice.both/ })
	);
	const activate = await screen.findByRole('button', {
		name: 'erstantwort.notificationChoice.enableBrowser'
	});
	expect(request).not.toHaveBeenCalled();
	fireEvent.click(activate);
	await waitFor(() => expect(Notification.permission).toBe('granted'));
	expect(approve).not.toHaveBeenCalled();
	expect(decline).not.toHaveBeenCalled();
});

for (const change of ['session', 'tenant'] as const) {
	it(`does not activate notifications when delayed address save finishes after ${change} changes`, async () => {
		let resolveSave!: () => void;
		putEmail.mockImplementation(
			() =>
				new Promise<void>((resolve) => {
					resolveSave = resolve;
				})
		);
		const view = setup({ ...account, email: undefined });
		await openSetup();
		fireEvent.click(
			screen.getByRole('button', { name: /notificationChoice.both/ })
		);
		fireEvent.change(await screen.findByRole('textbox'), {
			target: { value: 'asker@example.org' }
		});
		fireEvent.click(
			screen.getByRole('button', {
				name: 'furtherSteps.email.overlay.button1.label'
			})
		);
		expect(putEmail).toHaveBeenCalledOnce();
		if (change === 'session') view.switchSession('2');
		else view.disableEmail();
		await act(async () => resolveSave());
		expect(patch).not.toHaveBeenCalled();
		expect(request).not.toHaveBeenCalled();
	});
}
