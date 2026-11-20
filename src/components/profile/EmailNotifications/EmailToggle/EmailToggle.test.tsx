// @vitest-environment oriso-jsdom
import * as React from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { NotificationsContext, UserDataContext } from '../../../../globalState';
import { apiPatchUserData } from '../../../../api/apiPatchUserData';
import { EmailToggle } from '.';
import { resetEmailSettingSession } from '../emailSetting';

// The e-mail write state is module-wide: no case inherits another's.
afterEach(() => resetEmailSettingSession());

vi.mock('../../../../api/apiPatchUserData', () => ({
	apiPatchUserData: vi.fn()
}));
vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

afterEach(() => {
	cleanup();
	vi.mocked(apiPatchUserData).mockReset();
});

describe('EmailToggle', () => {
	it('keeps the last choice when an older queued write fails after newer ones succeed', async () => {
		const answers: Array<() => void> = [];
		const outcomes = [false, true, true];
		vi.mocked(apiPatchUserData).mockImplementation(
			() =>
				new Promise((resolve, reject) => {
					const ok = outcomes[answers.length];
					answers.push(() =>
						ok ? resolve(undefined) : reject(new Error('offline'))
					);
				})
		);
		render(
			<NotificationsContext.Provider
				value={{ addNotification: vi.fn() } as never}
			>
				<UserDataContext.Provider
					value={
						{
							userData: {
								emailNotifications: {
									emailNotificationsEnabled: true,
									settings: {}
								}
							},
							reloadUserData: vi.fn(async () => {
								throw new Error('offline');
							})
						} as never
					}
				>
					<EmailToggle
						name="emailNotificationsEnabled"
						titleKey="profile.notifications.mainEmail.title"
					/>
				</UserDataContext.Provider>
			</NotificationsContext.Provider>
		);
		const toggle = screen.getByRole('switch') as HTMLInputElement;
		// Stored: On. Off → On → Off before the first write answers; the
		// first PATCH fails, the later two succeed, reloads stay down.
		fireEvent.click(toggle);
		fireEvent.click(toggle);
		fireEvent.click(toggle);
		expect(toggle.checked).toBe(false);
		for (let index = 0; index < 3; index += 1) {
			await waitFor(() => expect(answers).toHaveLength(index + 1));
			answers[index]();
		}
		await waitFor(() => expect(apiPatchUserData).toHaveBeenCalledTimes(3));
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(
			vi.mocked(apiPatchUserData).mock.calls[2][0].emailNotifications
				?.emailNotificationsEnabled
		).toBe(false);
		expect(toggle.checked).toBe(false);
	});
});
