// @vitest-environment jsdom
import * as React from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserDataContext } from '../../globalState/context/UserDataContext';
import { ModalProvider } from '../../globalState/provider/ModalProvider';
import type { UserDataInterface } from '../../globalState/interfaces/UserDataInterface';
import { notificationSettingsStore } from '../../utils/notificationSettings/store';
import { NotificationSetupMessage } from './NotificationSetupMessage';

vi.hoisted(() => {
	HTMLCanvasElement.prototype.getContext = (() => ({
		fillStyle: '',
		fillRect() {}
	})) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});
const { patch, request } = vi.hoisted(() => ({
	patch: vi.fn(),
	request: vi.fn()
}));
vi.mock('../../api/apiPatchUserData', () => ({ apiPatchUserData: patch }));
vi.mock('../../api', () => ({
	apiPutEmail: vi.fn(),
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
// Keys come back as-is; interpolated values are appended so a test can see
// which channel the one-line summary names.
vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, options?: unknown) =>
			typeof options === 'string'
				? options
				: options && typeof options === 'object'
					? `${key}|${Object.values(options).join(',')}`
					: key
	})
}));

const USER_ID = 'user-4711';
const EMAIL = 'asker@example.org';
const noChannel = {
	userId: USER_ID,
	email: EMAIL,
	emailNotifications: {
		emailNotificationsEnabled: false,
		settings: {
			newChatMessageNotificationEnabled: false,
			reassignmentNotificationEnabled: false
		}
	}
} as UserDataInterface;
const emailOn = {
	...noChannel,
	emailNotifications: {
		emailNotificationsEnabled: true,
		settings: {
			newChatMessageNotificationEnabled: true,
			reassignmentNotificationEnabled: true
		}
	}
} as UserDataInterface;

const SUMMARY = 'erstantwort.notificationSummary.label';
const CHANGE = 'erstantwort.notificationSummary.change';
const DISMISS = 'erstantwort.notificationSummary.dismiss';
const EMAIL_CHOICE = /notificationChoice\.email/;
const BOTH_CHOICE = /notificationChoice\.bothSetup/;
const ENABLE_BROWSER = 'erstantwort.notificationChoice.enableBrowser';

let saved: UserDataInterface;

const mount = (
	initial: UserDataInterface,
	props: Partial<React.ComponentProps<typeof NotificationSetupMessage>> = {}
) => {
	const Account = () => {
		const [userData, setUserData] = React.useState(initial);
		return (
			<UserDataContext.Provider
				value={{
					userData,
					reloadUserData: async () => {
						setUserData(saved);
						return saved;
					},
					setUserData
				}}
			>
				<ModalProvider>
					<NotificationSetupMessage messageId="$event-1" {...props} />
				</ModalProvider>
			</UserDataContext.Provider>
		);
	};
	return render(<Account />);
};

beforeEach(() => {
	localStorage.clear();
	notificationSettingsStore.resetForTests();
	patch.mockReset().mockResolvedValue(undefined);
	request.mockReset();
	saved = emailOn;
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

describe('notification setup message collapses to one line (ORISO-Frontend#1700)', () => {
	it('shows the full setup while no channel is chosen', () => {
		mount(noChannel);
		expect(screen.getByRole('button', { name: EMAIL_CHOICE })).toBeTruthy();
		expect(screen.queryByText(new RegExp(SUMMARY))).toBeNull();
	});

	it('collapses as soon as a channel is chosen and names it', async () => {
		mount(noChannel);

		fireEvent.click(screen.getByRole('button', { name: EMAIL_CHOICE }));

		const summary = await screen.findByText(
			'erstantwort.notificationSummary.label|erstantwort.notificationSummary.email'
		);
		expect(summary).toBeTruthy();
		expect(screen.queryByRole('button', { name: EMAIL_CHOICE })).toBeNull();
		expect(screen.getByRole('button', { name: CHANGE })).toBeTruthy();
	});

	it('starts collapsed when a channel is already active', () => {
		mount(emailOn);
		expect(
			screen.getByText(
				'erstantwort.notificationSummary.label|erstantwort.notificationSummary.email'
			)
		).toBeTruthy();
		expect(screen.queryByRole('button', { name: EMAIL_CHOICE })).toBeNull();
	});

	it('keeps a collapsed message collapsed after a reload', () => {
		const first = mount(emailOn);
		first.unmount();

		mount(emailOn);
		expect(screen.getByRole('button', { name: CHANGE })).toBeTruthy();
		expect(screen.queryByRole('button', { name: EMAIL_CHOICE })).toBeNull();
	});

	it('collapses with the X even when no channel is set up, and says so', () => {
		mount(noChannel);

		fireEvent.click(screen.getByRole('button', { name: DISMISS }));

		expect(
			screen.getByText(
				'erstantwort.notificationSummary.label|erstantwort.notificationSummary.none'
			)
		).toBeTruthy();
		expect(screen.queryByRole('button', { name: EMAIL_CHOICE })).toBeNull();
		// Closing is not a choice: nothing was saved.
		expect(patch).not.toHaveBeenCalled();
	});

	it('keeps the X-collapsed state after a reload', () => {
		const first = mount(noChannel);
		fireEvent.click(screen.getByRole('button', { name: DISMISS }));
		first.unmount();

		mount(noChannel);
		expect(screen.getByRole('button', { name: CHANGE })).toBeTruthy();
	});

	it('"change" opens the setup again and it stays open after a reload', () => {
		const first = mount(emailOn);
		fireEvent.click(screen.getByRole('button', { name: CHANGE }));
		expect(screen.getByRole('button', { name: EMAIL_CHOICE })).toBeTruthy();
		expect(screen.queryByRole('button', { name: CHANGE })).toBeNull();
		first.unmount();

		mount(emailOn);
		expect(screen.getByRole('button', { name: EMAIL_CHOICE })).toBeTruthy();
	});

	it('collapses again when a different channel is chosen after "change"', async () => {
		saved = emailOn;
		mount(noChannel);
		fireEvent.click(screen.getByRole('button', { name: DISMISS }));
		fireEvent.click(screen.getByRole('button', { name: CHANGE }));

		fireEvent.click(screen.getByRole('button', { name: EMAIL_CHOICE }));

		await waitFor(() =>
			expect(screen.getByRole('button', { name: CHANGE })).toBeTruthy()
		);
		expect(
			screen.getByText(
				'erstantwort.notificationSummary.label|erstantwort.notificationSummary.email'
			)
		).toBeTruthy();
	});

	it('waits for the browser step of "both" before it collapses', async () => {
		mount(noChannel);

		fireEvent.click(screen.getByRole('button', { name: BOTH_CHOICE }));
		// E-Mail is saved; the browser still needs its own click.
		const enable = await screen.findByRole('button', {
			name: ENABLE_BROWSER
		});
		expect(screen.queryByRole('button', { name: CHANGE })).toBeNull();

		fireEvent.click(enable);

		expect(
			await screen.findByText(
				'erstantwort.notificationSummary.label|erstantwort.notificationSummary.both'
			)
		).toBeTruthy();
	});

	it('remembers each message on its own', () => {
		const first = mount(emailOn, { messageId: '$event-1' });
		first.unmount();

		mount(noChannel, { messageId: '$event-2' });
		expect(screen.getByRole('button', { name: EMAIL_CHOICE })).toBeTruthy();
	});

	it('does not carry the state over to another account in the same browser', () => {
		const first = mount(emailOn);
		first.unmount();

		mount({ ...noChannel, userId: 'someone-else' });
		expect(screen.getByRole('button', { name: EMAIL_CHOICE })).toBeTruthy();
	});

	it('writes no personal data into the storage key', () => {
		mount(emailOn);

		const keys = Object.keys(localStorage).filter((key) =>
			key.includes('notificationSetup')
		);
		expect(keys.length).toBeGreaterThan(0);
		keys.forEach((key) => {
			expect(key).not.toContain(USER_ID);
			expect(key).not.toContain(EMAIL);
		});
	});

	it('hands keyboard focus to "change" when the message collapses under it', async () => {
		mount(noChannel);
		const dismiss = screen.getByRole('button', { name: DISMISS });
		dismiss.focus();

		fireEvent.click(dismiss, { detail: 0 });

		await waitFor(() =>
			expect(document.activeElement).toBe(
				screen.getByRole('button', { name: CHANGE })
			)
		);
	});
});
