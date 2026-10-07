// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
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
		t: (key: string, fallback?: string) => fallback ?? key
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
	rawMessage?: string
) {
	const userData = {
		email: 'asker@example.org',
		emailNotifications: {
			emailNotificationsEnabled: emailActive,
			settings: { newChatMessageNotificationEnabled: emailActive }
		}
	} as UserDataInterface;
	render(
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
	setup(false, 'ASYNCHRONOUS', false);
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
	setup(true, 'ASYNCHRONOUS', true, rawMessage);
	expect(screen.getByText('Who reads this?').tagName).toBe('SUMMARY');
	expect(screen.getByText('You can add an email address.')).toBeTruthy();
	expect(
		screen.queryByRole('button', { name: /notificationChoice.email / })
	).toBeNull();
	expect(screen.queryByRole('button', { name: 'Add email' })).toBeNull();
});
