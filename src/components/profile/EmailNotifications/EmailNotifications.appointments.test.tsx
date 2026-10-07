// @vitest-environment jsdom

import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { apiPatchUserData } from '../../../api/apiPatchUserData';
import {
	createEmailSettingsFixture,
	initialNotifications
} from './EmailNotifications.testFixture';

vi.mock('../../../api/apiPatchUserData', () => ({ apiPatchUserData: vi.fn() }));
vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

const fixture = createEmailSettingsFixture(
	'selbsthilfe-termin-erinnerung-beratung'
);
const { reload, addNotification, renderSettings } = fixture;
const appointmentSwitch = () =>
	screen.getByRole<HTMLInputElement>('switch', {
		name: 'profile.notifications.appointmentNotificationEnabled.title'
	});

describe('counsellor self-help appointment preference', () => {
	it('opens the existing preference from a counsellor mail footer', () => {
		const { container } = renderSettings();
		expect(screen.getAllByRole('switch')).toHaveLength(10);
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
