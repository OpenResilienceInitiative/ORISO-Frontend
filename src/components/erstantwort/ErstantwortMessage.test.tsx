// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { UserDataContext } from '../../globalState/context/UserDataContext';
import { ModalProvider } from '../../globalState/provider/ModalProvider';
import { UserDataInterface } from '../../globalState/interfaces/UserDataInterface';
import { ErstantwortMessage } from './ErstantwortMessage';
import { SYSTEM_NOTIFICATION_PREFIX } from '../message/messageConstants';
import { notificationSettingsStore } from '../../utils/notificationSettings/store';

vi.hoisted(() => {
	HTMLCanvasElement.prototype.getContext = (() => ({
		fillStyle: '',
		fillRect() {}
	})) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});
vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, fallback?: unknown) =>
			typeof fallback === 'string' ? fallback : key
	})
}));
vi.mock('../../hooks/useOpenTwoFactorSettings', () => ({
	TWO_FACTOR_SETTINGS_PATH: '/security',
	useOpenTwoFactorSettings: () => () => {}
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

function setup(
	emailActive = false,
	conversationType?: string,
	isAskerEmailEnabled?: boolean,
	rawMessage?: string,
	messageId?: string
) {
	const userData = {
		email: 'asker@example.org',
		emailNotifications: {
			emailNotificationsEnabled: emailActive,
			settings: { newChatMessageNotificationEnabled: emailActive }
		}
	} as UserDataInterface;
	return render(
		<MemoryRouter>
			<UserDataContext.Provider
				value={{
					userData,
					reloadUserData: async () => userData,
					setUserData: vi.fn()
				}}
			>
				<ModalProvider>
					<ErstantwortMessage
						trigger="AFTER_ENQUIRY_DISPATCHED"
						rawMessage={rawMessage}
						messageId={messageId}
						conversationType={conversationType}
						isAskerEmailEnabled={isAskerEmailEnabled}
						skipAnimation
					/>
				</ModalProvider>
			</UserDataContext.Provider>
		</MemoryRouter>
	);
}
beforeEach(() => {
	localStorage.clear();
	notificationSettingsStore.resetForTests();
	vi.stubGlobal('Notification', {
		permission: 'default',
		requestPermission: vi.fn()
	});
});
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});
it('does not automatically invite an already email-reachable asker to configure notifications again', () => {
	setup(true);
	expect(
		screen.queryByRole('button', { name: /notificationChoice.email / })
	).toBeNull();
});
it('does not automatically invite an already browser-reachable asker to configure notifications again', () => {
	vi.stubGlobal('Notification', {
		permission: 'granted',
		requestPermission: vi.fn()
	});
	localStorage.setItem(
		'BROWSER_NOTIFICATIONS',
		JSON.stringify({ enabled: true })
	);
	setup();
	expect(
		screen.queryByRole('button', { name: /notificationChoice.email / })
	).toBeNull();
});
it('offers actual setup when no notification channel is active', () => {
	setup();
	expect(
		screen.getByRole('button', { name: /notificationChoice.email / })
	).toBeTruthy();
});

it('does not mistake a saved address with notifications switched off for an active channel', () => {
	setup(false);
	expect(
		screen.getByRole('button', { name: /notificationChoice.email / })
	).toBeTruthy();
});
it('does not count a silenced browser as reachable', () => {
	vi.stubGlobal('Notification', {
		permission: 'granted',
		requestPermission: vi.fn()
	});
	localStorage.setItem(
		'BROWSER_NOTIFICATIONS',
		JSON.stringify({ enabled: true })
	);
	notificationSettingsStore.setDeviceSilenced(true);
	setup();
	expect(
		screen.getByRole('button', { name: /notificationChoice.email / })
	).toBeTruthy();
});
it('does not invite live-chat participants to collect an email address', () => {
	setup(false, 'LIVE_CHAT');
	expect(
		screen.queryByRole('button', { name: /notificationChoice.email / })
	).toBeNull();
});
it('respects the current tenant email-off policy without inventing per-type settings', () => {
	setup(false, 'AGENCY_COUNSELLING', false);
	expect(
		screen.queryByRole('button', { name: /notificationChoice.email / })
	).toBeNull();
	expect(
		screen.getByRole('button', { name: /notificationChoice.browser / })
	).toBeTruthy();
});

it('keeps frozen FAQ and invitation words when the saved channel suppresses its live setup controls', () => {
	const rawMessage =
		SYSTEM_NOTIFICATION_PREFIX +
		JSON.stringify({
			type: 'FIRST_RESPONSE',
			version: 1,
			bausteine: [
				{
					id: 'whoReadsAlong',
					headline: 'Who reads this?',
					body: 'Only the responsible counselling team.'
				},
				{
					id: 'emailNotification',
					body: 'You can add an email address.',
					action: { kind: 'ADD_EMAIL', label: 'Add email' }
				}
			]
		});
	setup(true, 'AGENCY_COUNSELLING', true, rawMessage);
	expect(screen.getByText('Who reads this?').tagName).toBe('SUMMARY');
	expect(screen.getByText('You can add an email address.')).toBeTruthy();
	expect(
		screen.queryByRole('button', { name: /notificationChoice.email / })
	).toBeNull();
	expect(screen.queryByRole('button', { name: 'Add email' })).toBeNull();
});

it('keeps the setup collapsed after a reload once the person closed it with the X (ORISO-Frontend#1700)', () => {
	const first = setup(
		false,
		undefined,
		undefined,
		undefined,
		'$first-answer'
	);
	fireEvent.click(
		screen.getByRole('button', {
			name: 'erstantwort.notificationSummary.dismiss'
		})
	);
	expect(
		screen.queryByRole('button', { name: /notificationChoice.email / })
	).toBeNull();
	first.unmount();

	// The same message, rendered again after a reload.
	setup(false, undefined, undefined, undefined, '$first-answer');
	expect(
		screen.getByRole('button', {
			name: 'erstantwort.notificationSummary.changeLabel'
		})
	).toBeTruthy();
	expect(
		screen.queryByRole('button', { name: /notificationChoice.email / })
	).toBeNull();
});
it('shows the setup in full again after "ändern", also after a reload', () => {
	const first = setup(
		false,
		undefined,
		undefined,
		undefined,
		'$first-answer'
	);
	fireEvent.click(
		screen.getByRole('button', {
			name: 'erstantwort.notificationSummary.dismiss'
		})
	);
	fireEvent.click(
		screen.getByRole('button', {
			name: 'erstantwort.notificationSummary.changeLabel'
		})
	);
	first.unmount();

	setup(false, undefined, undefined, undefined, '$first-answer');
	expect(
		screen.getByRole('button', { name: /notificationChoice.email / })
	).toBeTruthy();
});

const firstResponse = (...ids: string[]) =>
	SYSTEM_NOTIFICATION_PREFIX +
	JSON.stringify({
		type: 'FIRST_RESPONSE',
		version: 1,
		bausteine: ids.map((id) =>
			id === 'emailNotification'
				? {
						id,
						body: 'You can add an email address.',
						action: { kind: 'ADD_EMAIL', label: 'Add email' }
					}
				: { id, headline: `Headline ${id}`, body: `Body ${id}` }
		)
	});

it('keeps the one-line summary and "change" on the persisted invitation once a channel is reachable (ORISO-Frontend#1767 review)', () => {
	setup(
		true,
		'AGENCY_COUNSELLING',
		true,
		firstResponse('whoReadsAlong', 'emailNotification'),
		'$first-answer'
	);
	expect(screen.getByText('You can add an email address.')).toBeTruthy();
	expect(
		screen.getByRole('button', {
			name: 'erstantwort.notificationSummary.changeLabel'
		})
	).toBeTruthy();
	// Still no automatic invitation: the choices stay hidden behind "change".
	expect(
		screen.queryByRole('button', { name: /notificationChoice.email / })
	).toBeNull();
	fireEvent.click(
		screen.getByRole('button', {
			name: 'erstantwort.notificationSummary.changeLabel'
		})
	);
	expect(
		screen.getByRole('button', { name: /notificationChoice.email / })
	).toBeTruthy();
});

it('keeps the one-line summary and "change" on a persisted channel choice once a channel is reachable (ORISO-Frontend#1767 review)', () => {
	setup(
		true,
		'AGENCY_COUNSELLING',
		true,
		firstResponse('whoReadsAlong', 'notificationChoice'),
		'$first-answer'
	);
	expect(screen.getByText('Body notificationChoice')).toBeTruthy();
	expect(
		screen.getByRole('button', {
			name: 'erstantwort.notificationSummary.changeLabel'
		})
	).toBeTruthy();
});

it('shows no summary on a persisted message when the tenant offers no channel at all', () => {
	setup(
		false,
		'AGENCY_COUNSELLING',
		false,
		firstResponse('whoReadsAlong', 'notificationChoice'),
		'$first-answer'
	);
	expect(
		screen.queryByRole('button', {
			name: 'erstantwort.notificationSummary.changeLabel'
		})
	).toBeNull();
});
