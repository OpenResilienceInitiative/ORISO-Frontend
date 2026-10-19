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
import { ModalProvider } from '../../globalState/provider/ModalProvider';
import { NotificationSetup } from './NotificationSetup';
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
function setup(
	initial = account,
	props: { isEmailEnabled?: boolean; isBrowserEnabled?: boolean } = {}
) {
	const TestAccount = () => {
		const [userData, setUserData] = React.useState(initial);
		const reloadUserData = async () => {
			setUserData(saved);
			return saved;
		};
		return (
			<UserDataContext.Provider
				value={{ userData, reloadUserData, setUserData }}
			>
				<ModalProvider>
					<NotificationSetup {...props} />
				</ModalProvider>
			</UserDataContext.Provider>
		);
	};
	return render(<TestAccount />);
}
beforeEach(() => {
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
	// jsdom has no media playback; previews must not throw in any test.
	vi.stubGlobal(
		'Audio',
		class {
			volume = 1;
			constructor(public src: string) {}
			play = vi.fn().mockResolvedValue(undefined);
		}
	);
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
it('keeps browser permission behind the email step for both channels', async () => {
	setup();
	fireEvent.click(
		screen.getByRole('button', { name: /notificationChoice.both/ })
	);
	await screen.findByRole('button', {
		name: 'erstantwort.notificationChoice.enableBrowser'
	});
	expect(request).not.toHaveBeenCalled();
	fireEvent.click(
		screen.getByRole('button', {
			name: 'erstantwort.notificationChoice.enableBrowser'
		})
	);
	await waitFor(() =>
		expect(
			JSON.parse(localStorage.getItem('BROWSER_NOTIFICATIONS')!).enabled
		).toBe(true)
	);
});
it('keeps browser setup untouched when the email save fails', async () => {
	patch.mockRejectedValue(new Error('offline'));
	setup();
	fireEvent.click(
		screen.getByRole('button', { name: /notificationChoice.both/ })
	);
	await screen.findByRole('alert');
	expect(request).not.toHaveBeenCalled();
	expect(
		screen.queryByRole('button', {
			name: 'erstantwort.notificationChoice.enableBrowser'
		})
	).toBeNull();
});
it('does not present declined browser permission as activated', async () => {
	request.mockResolvedValue('denied');
	setup();
	fireEvent.click(
		screen.getByRole('button', { name: /notificationChoice.browser / })
	);
	fireEvent.click(
		await screen.findByRole('button', {
			name: 'erstantwort.notificationChoice.enableBrowser'
		})
	);
	await screen.findByRole('alert');
	expect(screen.queryByRole('status')).toBeNull();
	expect(localStorage.getItem('BROWSER_NOTIFICATIONS')).toBeNull();
});
it('reflects saved account and device choices after reload', () => {
	Object.defineProperty(Notification, 'permission', {
		value: 'granted',
		configurable: true
	});
	localStorage.setItem(
		'BROWSER_NOTIFICATIONS',
		JSON.stringify({ enabled: true })
	);
	setup(saved);
	expect(
		screen
			.getByRole('button', { name: /notificationChoice.both/ })
			.getAttribute('aria-pressed')
	).toBe('true');
});

it('cancelling address collection leaves both channels inactive', async () => {
	setup({ ...account, email: undefined });
	fireEvent.click(
		screen.getByRole('button', { name: /notificationChoice.both/ })
	);
	const cancel = await screen.findByRole('button', {
		name: 'furtherSteps.email.overlay.button2.label'
	});
	fireEvent.click(cancel);
	expect(screen.queryByRole('textbox')).toBeNull();
	expect(patch).not.toHaveBeenCalled();
	expect(request).not.toHaveBeenCalled();
	expect(screen.queryByRole('status')).toBeNull();
});
it('saving a new address enables email before offering the browser step', async () => {
	putEmail.mockResolvedValue(undefined);
	setup({ ...account, email: undefined });
	fireEvent.click(
		screen.getByRole('button', { name: /notificationChoice.both/ })
	);
	const field = await screen.findByRole('textbox');
	fireEvent.change(field, { target: { value: 'asker@example.org' } });
	fireEvent.click(
		screen.getByRole('button', {
			name: 'furtherSteps.email.overlay.button1.label'
		})
	);
	await screen.findByRole('button', {
		name: 'erstantwort.notificationChoice.enableBrowser'
	});
	expect(screen.queryByRole('textbox')).toBeNull();
	expect(
		screen
			.getByRole('button', {
				name: /notificationChoice.email /,
				hidden: true
			})
			.getAttribute('aria-pressed')
	).toBe('true');
	expect(request).not.toHaveBeenCalled();
});

for (const abandoned of ['cancel', 'unmount'] as const) {
	it(`does not enable notifications when an email PUT finishes after ${abandoned}`, async () => {
		let resolveSave!: () => void;
		putEmail.mockImplementation(
			() =>
				new Promise<void>((resolve) => {
					resolveSave = resolve;
				})
		);
		const view = setup({ ...account, email: undefined });
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
		if (abandoned === 'cancel')
			fireEvent.click(
				screen.getByRole('button', {
					name: 'furtherSteps.email.overlay.button2.label'
				})
			);
		else view.unmount();
		await act(async () => resolveSave());
		expect(patch).not.toHaveBeenCalled();
		expect(request).not.toHaveBeenCalled();
	});
}

it('does not offer a browser channel forbidden by the current conversation policy', () => {
	setup(account, { isBrowserEnabled: false });
	expect(
		screen.queryByRole('button', { name: /notificationChoice.browser / })
	).toBeNull();
	expect(
		screen.queryByRole('button', { name: /notificationChoice.both/ })
	).toBeNull();
	expect(
		screen.getByRole('button', { name: /notificationChoice.email / })
	).toBeTruthy();
});

it('upgrades reply-only email to consent notifications and keeps BOTH behind a fresh browser gesture', async () => {
	const replyOnly = {
		...saved,
		emailNotifications: {
			...saved.emailNotifications,
			settings: {
				newChatMessageNotificationEnabled: true,
				reassignmentNotificationEnabled: false
			}
		}
	};
	setup(replyOnly);
	fireEvent.click(
		screen.getByRole('button', { name: /notificationChoice.both/ })
	);
	await screen.findByRole('button', {
		name: 'erstantwort.notificationChoice.enableBrowser'
	});
	expect(patch).toHaveBeenCalledWith(
		expect.objectContaining({
			emailNotifications: expect.objectContaining({
				settings: expect.objectContaining({
					newChatMessageNotificationEnabled: true,
					reassignmentNotificationEnabled: true
				})
			})
		})
	);
	expect(request).not.toHaveBeenCalled();
});
it('does not confirm consent email or continue BOTH when consent subscription was not saved', async () => {
	saved = {
		...saved,
		emailNotifications: {
			...saved.emailNotifications,
			settings: {
				newChatMessageNotificationEnabled: true,
				reassignmentNotificationEnabled: false
			}
		}
	};
	setup();
	fireEvent.click(
		screen.getByRole('button', { name: /notificationChoice.both/ })
	);
	await screen.findByRole('alert');
	expect(request).not.toHaveBeenCalled();
	expect(
		screen.queryByRole('button', {
			name: 'erstantwort.notificationChoice.enableBrowser'
		})
	).toBeNull();
});

it('explains a blocked browser permission up front, without asking the browser again', () => {
	Object.defineProperty(Notification, 'permission', {
		value: 'denied',
		configurable: true
	});
	setup();
	expect(
		screen.getByText('erstantwort.notificationChoice.browserBlockedHelp')
	).toBeTruthy();
	expect(request).not.toHaveBeenCalled();
});
it.each([
	['the window regains focus', () => window.dispatchEvent(new Event('focus'))],
	[
		'the tab becomes visible again',
		() => document.dispatchEvent(new Event('visibilitychange'))
	]
])('re-reads a lifted browser block when %s', async (_name, trigger) => {
	Object.defineProperty(Notification, 'permission', {
		value: 'denied',
		configurable: true
	});
	setup();
	expect(
		screen.getByText('erstantwort.notificationChoice.browserBlockedHelp')
	).toBeTruthy();
	// The person lifts the block in the browser settings and comes back.
	Object.defineProperty(Notification, 'permission', {
		value: 'default',
		configurable: true
	});
	act(() => trigger());
	await waitFor(() =>
		expect(
			screen.queryByText('erstantwort.notificationChoice.browserBlockedHelp')
		).toBeNull()
	);
});

it('swaps the generic denial for the unblock instructions when the browser stays blocked', async () => {
	Object.defineProperty(Notification, 'permission', {
		value: 'denied',
		configurable: true
	});
	request.mockResolvedValue('denied');
	setup();
	fireEvent.click(
		screen.getByRole('button', { name: /notificationChoice.browser / })
	);
	// A blocked site cannot be asked again: the dialog only gives the way out.
	const alert = await screen.findByRole('alert');
	expect(alert.textContent).toBe(
		'erstantwort.notificationChoice.browserBlockedHelp'
	);
	expect(request).not.toHaveBeenCalled();
	expect(
		(
			screen.getByRole('button', {
				name: 'erstantwort.notificationChoice.enableBrowser'
			}) as HTMLButtonElement
		).disabled
	).toBe(true);
});
it('opens the tone dialog for browser-only and asks the browser only on its button', async () => {
	setup();
	fireEvent.click(
		screen.getByRole('button', { name: /notificationChoice.browser / })
	);
	await screen.findByRole('radiogroup');
	expect(request).not.toHaveBeenCalled();
	expect(
		screen.getByText('erstantwort.notificationChoice.dialog.stayInBrowser')
	).toBeTruthy();
});
it('moves the tone with the arrow keys and keeps one tab stop', async () => {
	setup();
	fireEvent.click(
		screen.getByRole('button', { name: /notificationChoice.browser / })
	);
	const radios = await screen.findAllByRole('radio');
	const selected = radios.findIndex(
		(radio) => radio.getAttribute('aria-checked') === 'true'
	);
	expect(radios.filter((r) => r.tabIndex === 0)).toHaveLength(1);
	fireEvent.keyDown(radios[selected], { key: 'ArrowRight' });
	await waitFor(() =>
		expect(
			radios[(selected + 1) % radios.length].getAttribute('aria-checked')
		).toBe('true')
	);
	expect(radios[selected].getAttribute('aria-checked')).toBe('false');
});
it('remembers the chosen tone for requests and conversations and plays a preview', async () => {
	const play = vi.fn().mockResolvedValue(undefined);
	vi.stubGlobal(
		'Audio',
		class {
			volume = 1;
			constructor(public src: string) {}
			play = play;
		}
	);
	setup();
	fireEvent.click(
		screen.getByRole('button', { name: /notificationChoice.browser / })
	);
	fireEvent.click(await screen.findByTestId('notificationTone-ton-5'));
	expect(play).toHaveBeenCalledTimes(1);
	fireEvent.click(
		screen.getByRole('button', {
			name: 'erstantwort.notificationChoice.enableBrowser'
		})
	);
	await waitFor(() => expect(request).toHaveBeenCalled());
	const { notificationConfig } =
		notificationSettingsStore.getState().settings;
	expect(notificationConfig.requests.new.sound).toBe('ton-5');
	expect(notificationConfig.conversations.standard.sound).toBe('ton-5');
	expect(notificationConfig.timeCritical.call.sound).toBe('ring');
});
it('keeps the old tones when the browser permission is denied', async () => {
	request.mockImplementation(async () => {
		Object.defineProperty(Notification, 'permission', {
			value: 'denied',
			configurable: true
		});
		return 'denied';
	});
	setup();
	const before = JSON.stringify(
		notificationSettingsStore.getState().settings.notificationConfig
	);
	fireEvent.click(
		screen.getByRole('button', { name: /notificationChoice.browser / })
	);
	fireEvent.click(await screen.findByTestId('notificationTone-ton-5'));
	fireEvent.click(
		screen.getByRole('button', {
			name: 'erstantwort.notificationChoice.enableBrowser'
		})
	);
	await waitFor(() => expect(request).toHaveBeenCalled());
	await waitFor(() => expect(screen.queryByRole('radiogroup')).toBeNull());
	expect(
		JSON.stringify(
			notificationSettingsStore.getState().settings.notificationConfig
		)
	).toBe(before);
});
it('keeps the old tones when saving the browser opt-in fails', async () => {
	setup();
	const before = JSON.stringify(
		notificationSettingsStore.getState().settings.notificationConfig
	);
	fireEvent.click(
		screen.getByRole('button', { name: /notificationChoice.browser / })
	);
	fireEvent.click(await screen.findByTestId('notificationTone-ton-5'));
	const spy = vi
		.spyOn(Storage.prototype, 'setItem')
		.mockImplementation(() => {
			throw new Error('quota');
		});
	try {
		fireEvent.click(
			screen.getByRole('button', {
				name: 'erstantwort.notificationChoice.enableBrowser'
			})
		);
		await waitFor(() => expect(request).toHaveBeenCalled());
		await waitFor(() =>
			expect(screen.queryByRole('radiogroup')).toBeNull()
		);
	} finally {
		spy.mockRestore();
	}
	expect(
		JSON.stringify(
			notificationSettingsStore.getState().settings.notificationConfig
		)
	).toBe(before);
});
it('keeps the tones the account already has when the picker is not touched', async () => {
	setup();
	const before = JSON.stringify(
		notificationSettingsStore.getState().settings.notificationConfig
	);
	fireEvent.click(
		screen.getByRole('button', { name: /notificationChoice.browser / })
	);
	await screen.findByRole('radiogroup');
	fireEvent.click(
		screen.getByRole('button', {
			name: 'erstantwort.notificationChoice.enableBrowser'
		})
	);
	await waitFor(() => expect(request).toHaveBeenCalled());
	expect(
		JSON.stringify(
			notificationSettingsStore.getState().settings.notificationConfig
		)
	).toBe(before);
});
it('confirms the saved address and names the one remaining browser step for both channels', async () => {
	setup();
	fireEvent.click(
		screen.getByRole('button', { name: /notificationChoice.both/ })
	);
	await screen.findByRole('button', {
		name: 'erstantwort.notificationChoice.enableBrowser'
	});
	expect(
		screen.getByText('erstantwort.notificationChoice.emailSavedNext')
	).toBeTruthy();
});
