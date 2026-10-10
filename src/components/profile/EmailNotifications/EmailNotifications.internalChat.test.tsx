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

const fixture = createEmailSettingsFixture('interne-nachricht');
const { reload, addNotification, renderSettings } = fixture;
const internalChatSwitch = () =>
	screen.getByRole<HTMLInputElement>('switch', {
		name: 'profile.notifications.matrix.consultant.internalChat.title'
	});

describe('ordinary internal-chat mail preference', () => {
	it('opens its own saved preference from an internal-chat mail footer', () => {
		const { container } = renderSettings();
		expect(internalChatSwitch().checked).toBe(true);
		expect(
			container
				.querySelector('[data-cy="notification-switch-internalChat"]')
				?.classList.contains('notifications__row--highlighted')
		).toBe(true);
	});

	it.each([undefined, null])(
		'defaults an absent legacy internal-chat setting (%s) to enabled',
		(value) => {
			fixture.stored.settings.internalChatNotificationEnabled = value;
			renderSettings();
			expect(internalChatSwitch().checked).toBe(true);
		}
	);

	it('honors an explicit internal-chat opt-out', () => {
		fixture.stored.settings.internalChatNotificationEnabled = false;
		renderSettings();
		expect(internalChatSwitch().checked).toBe(false);
	});

	it('persists only the internal-chat choice and reads it after reload', async () => {
		const view = renderSettings();
		fireEvent.click(internalChatSwitch());
		await waitFor(() => expect(reload).toHaveBeenCalledOnce());
		expect(apiPatchUserData).toHaveBeenCalledWith({
			emailNotifications: {
				...initialNotifications(),
				settings: {
					...initialNotifications().settings,
					internalChatNotificationEnabled: false
				}
			}
		});
		view.unmount();
		renderSettings();
		expect(internalChatSwitch().checked).toBe(false);
	});

	it('restores the enabled legacy preference after a rejected save', async () => {
		fixture.stored.settings.internalChatNotificationEnabled = undefined;
		vi.mocked(apiPatchUserData).mockRejectedValueOnce(
			new Error('save failed')
		);
		renderSettings();
		fireEvent.click(internalChatSwitch());
		await waitFor(() => expect(reload).toHaveBeenCalledOnce());
		await waitFor(() => expect(internalChatSwitch().checked).toBe(true));
		expect(addNotification).toHaveBeenCalledWith(
			expect.objectContaining({ notificationType: 'error' })
		);
	});

	it('does not offer internal counsellor mail to advice seekers', () => {
		renderSettings('asker');
		expect(
			screen.queryByRole('switch', {
				name: 'profile.notifications.matrix.consultant.internalChat.title'
			})
		).toBeNull();
	});
});
