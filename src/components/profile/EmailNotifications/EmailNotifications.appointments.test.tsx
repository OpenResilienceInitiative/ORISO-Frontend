// @vitest-environment jsdom

import * as React from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationsContext, UserDataContext } from '../../../globalState';
import { apiPatchUserData } from '../../../api/apiPatchUserData';
import { EmailNotification } from './index';

vi.mock('../../../api/apiPatchUserData', () => ({ apiPatchUserData: vi.fn() }));
vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

const initialNotifications = () => ({
	emailNotificationsEnabled: true,
	settings: {
		appointmentNotificationEnabled: true,
		initialEnquiryNotificationEnabled: false,
		newChatMessageNotificationEnabled: true,
		reassignmentNotificationEnabled: true,
		assignmentNotificationEnabled: true,
		feedbackNotificationEnabled: true,
		serviceNoticeNotificationEnabled: false
	}
});

let stored = initialNotifications();
const reload = vi.fn();
const addNotification = vi.fn();
const appointmentSwitch = () =>
	screen.getByRole<HTMLInputElement>('switch', {
		name: 'profile.notifications.appointmentNotificationEnabled.title'
	});
const originalScrollIntoView = Object.getOwnPropertyDescriptor(
	HTMLElement.prototype,
	'scrollIntoView'
);

const renderSettings = (role: 'consultant' | 'asker' = 'consultant') => {
	const Fixture = () => {
		const [notifications, setNotifications] = React.useState(() =>
			structuredClone(stored)
		);
		reload.mockImplementation(async () => {
			setNotifications(structuredClone(stored));
		});
		return (
			<UserDataContext.Provider
				value={
					{
						userData: {
							email: 'appointment-test@example.test',
							grantedAuthorities: [
								role === 'consultant'
									? 'AUTHORIZATION_CONSULTANT_DEFAULT'
									: 'AUTHORIZATION_USER_DEFAULT'
							],
							emailNotifications: notifications,
							emailToggles: []
						},
						reloadUserData: reload
					} as never
				}
			>
				<EmailNotification />
			</UserDataContext.Provider>
		);
	};
	return render(
		<MemoryRouter
			initialEntries={[
				'/profile/notifications/email?mail=selbsthilfe-termin-erinnerung-beratung'
			]}
		>
			<NotificationsContext.Provider value={{ addNotification } as never}>
				<Fixture />
			</NotificationsContext.Provider>
		</MemoryRouter>
	);
};

beforeEach(() => {
	stored = initialNotifications();
	vi.clearAllMocks();
	Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
		configurable: true,
		value: vi.fn()
	});
	vi.mocked(apiPatchUserData).mockImplementation(async (data) => {
		stored = structuredClone(data.emailNotifications);
	});
});

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	if (originalScrollIntoView) {
		Object.defineProperty(
			HTMLElement.prototype,
			'scrollIntoView',
			originalScrollIntoView
		);
	} else {
		delete HTMLElement.prototype.scrollIntoView;
	}
});

describe('counsellor self-help appointment preference', () => {
	it('opens the existing preference from a counsellor mail footer', () => {
		const { container } = renderSettings();
		expect(screen.getAllByRole('switch')).toHaveLength(9);
		expect(appointmentSwitch().checked).toBe(true);
		expect(
			container
				.querySelector('[data-cy="notification-switch-appointment"]')
				?.classList.contains('notifications__row--highlighted')
		).toBe(true);
	});

	it('saves the existing flag, preserves other settings and reads it after reload', async () => {
		const view = renderSettings();
		fireEvent.click(appointmentSwitch());
		await waitFor(() => expect(reload).toHaveBeenCalledOnce());
		expect(apiPatchUserData).toHaveBeenCalledWith({
			emailNotifications: {
				...initialNotifications(),
				settings: {
					...initialNotifications().settings,
					appointmentNotificationEnabled: false
				}
			}
		});
		view.unmount();
		renderSettings();
		expect(appointmentSwitch().checked).toBe(false);
	});

	it('restores the stored preference after a rejected save', async () => {
		vi.mocked(apiPatchUserData).mockRejectedValueOnce(
			new Error('save failed')
		);
		renderSettings();
		const toggle = appointmentSwitch();
		fireEvent.click(toggle);
		await waitFor(() => expect(reload).toHaveBeenCalledOnce());
		await waitFor(() => expect(toggle.checked).toBe(true));
		expect(addNotification).toHaveBeenCalledWith(
			expect.objectContaining({ notificationType: 'error' })
		);
	});

	it('keeps the separate three-switch asker list and does not highlight a counsellor occasion', () => {
		const { container } = renderSettings('asker');
		expect(screen.getAllByRole('switch')).toHaveLength(4);
		expect(
			container.querySelector('.notifications__row--highlighted')
		).toBeNull();
	});
});
