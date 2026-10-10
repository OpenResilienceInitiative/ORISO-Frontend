import * as React from 'react';
import { cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, vi } from 'vitest';
import { NotificationsContext, UserDataContext } from '../../../globalState';
import { apiPatchUserData } from '../../../api/apiPatchUserData';
import { EmailNotification } from './index';

export const initialNotifications = () => ({
	emailNotificationsEnabled: true,
	settings: {
		appointmentNotificationEnabled: true,
		initialEnquiryNotificationEnabled: false,
		newChatMessageNotificationEnabled: true,
		reassignmentNotificationEnabled: true,
		assignmentNotificationEnabled: true,
		feedbackNotificationEnabled: true,
		internalChatNotificationEnabled: true,
		serviceNoticeNotificationEnabled: false
	}
});

export const createEmailSettingsFixture = (occasion: string) => {
	let stored: UserService.Schemas.EmailNotificationsDTO =
		initialNotifications();
	const reload = vi.fn();
	const addNotification = vi.fn();
	const originalScrollIntoView = Object.getOwnPropertyDescriptor(
		HTMLElement.prototype,
		'scrollIntoView'
	);

	const renderSettings = (
		role: 'consultant' | 'asker' = 'consultant',
		requestedOccasion = occasion
	) => {
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
					`/profile/notifications/email?mail=${requestedOccasion}`
				]}
			>
				<NotificationsContext.Provider
					value={{ addNotification } as never}
				>
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

	return {
		get stored() {
			return stored;
		},
		reload,
		addNotification,
		renderSettings
	};
};
