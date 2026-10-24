// @vitest-environment oriso-jsdom
import * as React from 'react';
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { NotificationsContext, UserDataContext } from '../../../globalState';
import { apiPatchUserData } from '../../../api/apiPatchUserData';
import { EmailToggle } from './EmailToggle';
import { resetEmailSettingSession } from './emailSetting';

// The e-mail write state is module-wide: no case inherits another's.
afterEach(() => resetEmailSettingSession());

vi.mock('../../../api/apiPatchUserData', () => ({
	apiPatchUserData: vi.fn()
}));
vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

const account = (userId: string, master: boolean) => ({
	userId,
	email: `${userId}@example.test`,
	emailNotifications: {
		emailNotificationsEnabled: master,
		settings: { appointmentNotificationEnabled: true }
	},
	emailToggles: []
});

afterEach(() => {
	cleanup();
	vi.mocked(apiPatchUserData).mockReset();
});

describe('e-mail settings across a sign-out and sign-in in place', () => {
	it("never shows or writes the previous account's pending state", async () => {
		const patches: Array<() => void> = [];
		vi.mocked(apiPatchUserData).mockImplementation(
			() =>
				new Promise<void>((resolve) => {
					patches.push(() => resolve());
				})
		);
		let switchTo: (userData: object) => void = () => undefined;
		const reloadUserData = vi.fn(async () => {
			throw new Error('offline');
		});
		const Harness = () => {
			const [userData, setUserData] = React.useState<object>(() =>
				account('a', true)
			);
			switchTo = setUserData;
			return (
				<NotificationsContext.Provider
					value={{ addNotification: vi.fn() } as never}
				>
					<UserDataContext.Provider
						value={{ userData, reloadUserData } as never}
					>
						<EmailToggle
							name="emailNotificationsEnabled"
							titleKey="profile.notifications.mainEmail.title"
						/>
					</UserDataContext.Provider>
				</NotificationsContext.Provider>
			);
		};
		render(<Harness />);
		const toggle = screen.getByRole('switch') as HTMLInputElement;
		// A: master off (PATCH pending), then on again (queued behind it).
		fireEvent.click(toggle);
		fireEvent.click(toggle);
		await waitFor(() => expect(patches).toHaveLength(1));
		expect(toggle.checked).toBe(true);

		// Signed out and B (master stored off) signed in, in place, while
		// A's writes are pending; A's newest pending value is on.
		act(() => switchTo(account('b', false)));
		expect(toggle.checked).toBe(false);
		act(() => patches.shift()?.()); // A's PATCH lands; its reload fails.
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 0));
		});
		// B sees B's stored value, and A's queued write never went out.
		expect(toggle.checked).toBe(false);
		expect(apiPatchUserData).toHaveBeenCalledTimes(1);

		// B's own change goes from B's stored off to on, nothing of A.
		fireEvent.click(toggle);
		await waitFor(() => expect(apiPatchUserData).toHaveBeenCalledTimes(2));
		expect(vi.mocked(apiPatchUserData).mock.calls[1][0]).toEqual({
			emailNotifications: {
				emailNotificationsEnabled: true,
				settings: {}
			}
		});
		expect(toggle.checked).toBe(true);
	});
});
