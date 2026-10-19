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
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NotificationsContext, UserDataContext } from '../../../globalState';
import { apiPatchUserData } from '../../../api/apiPatchUserData';
import { EmailToggle } from './EmailToggle';
import { markServerUserData } from '../../../globalState/serverUserData';
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

const stored = () => ({
	userId: 'counsellor',
	email: 'counsellor@example.test',
	emailNotifications: {
		emailNotificationsEnabled: true,
		settings: { appointmentNotificationEnabled: true }
	},
	emailToggles: []
});

let setUserData: React.Dispatch<React.SetStateAction<object>> = () => undefined;
const Harness = () => {
	const [userData, set] = React.useState<object>(() =>
		markServerUserData(stored())
	);
	setUserData = set;
	const reloadUserData = React.useCallback(async () => {
		throw new Error('offline');
	}, []);
	return (
		<NotificationsContext.Provider
			value={{ addNotification: vi.fn() } as never}
		>
			<UserDataContext.Provider
				value={{ userData, reloadUserData } as never}
			>
				<EmailToggle
					name="emailNotificationsEnabled"
					titleKey="master"
				/>
				<EmailToggle
					name="settings.appointmentNotificationEnabled"
					titleKey="appointments"
				/>
			</UserDataContext.Provider>
		</NotificationsContext.Provider>
	);
};

const switchNamed = (name: string) =>
	screen.getByRole('switch', { name }) as HTMLInputElement;

/** Master off: the PATCH goes through, the reload after it fails. */
const masterOffWithoutReload = async () => {
	render(<Harness />);
	fireEvent.click(switchNamed('master'));
	await waitFor(() => expect(apiPatchUserData).toHaveBeenCalledOnce());
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 0));
	});
	expect(switchNamed('master').checked).toBe(false);
};

afterEach(() => {
	cleanup();
	vi.mocked(apiPatchUserData).mockReset();
});

describe('e-mail settings and other context updates', () => {
	it('keeps a saved value through an unrelated local update, and builds on it', async () => {
		vi.mocked(apiPatchUserData).mockResolvedValue(undefined);
		await masterOffWithoutReload();
		// useLiveChatViaSidebar-style: spreads the stale context.
		act(() =>
			setUserData((previous) => ({
				...previous,
				liveChatViaSidebar: true
			}))
		);
		expect(switchNamed('master').checked).toBe(false);
		fireEvent.click(switchNamed('appointments'));
		await waitFor(() => expect(apiPatchUserData).toHaveBeenCalledTimes(2));
		expect(vi.mocked(apiPatchUserData).mock.calls[1][0]).toEqual({
			emailNotifications: {
				emailNotificationsEnabled: false,
				settings: { appointmentNotificationEnabled: false }
			}
		});
	});

	it('takes fresh server data with a different e-mail part', async () => {
		vi.mocked(apiPatchUserData).mockResolvedValue(undefined);
		await masterOffWithoutReload();
		// A later reload: another device switched e-mails back on.
		act(() =>
			setUserData(
				markServerUserData({
					...stored(),
					emailNotifications: {
						emailNotificationsEnabled: true,
						settings: { appointmentNotificationEnabled: false }
					}
				})
			)
		);
		expect(switchNamed('master').checked).toBe(true);
		expect(switchNamed('appointments').checked).toBe(false);
		fireEvent.click(switchNamed('appointments'));
		await waitFor(() => expect(apiPatchUserData).toHaveBeenCalledTimes(2));
		expect(vi.mocked(apiPatchUserData).mock.calls[1][0]).toEqual({
			emailNotifications: {
				emailNotificationsEnabled: true,
				settings: { appointmentNotificationEnabled: true }
			}
		});
	});

	it('takes a server reload equal to the value before the write, and builds the next PATCH on it', async () => {
		vi.mocked(apiPatchUserData).mockResolvedValue(undefined);
		await masterOffWithoutReload();
		// Another device switched it back: the reload equals the pre-write data.
		act(() => setUserData(markServerUserData(stored())));
		expect(switchNamed('master').checked).toBe(true);
		fireEvent.click(switchNamed('appointments'));
		await waitFor(() => expect(apiPatchUserData).toHaveBeenCalledTimes(2));
		// Only the changed key, plus the master the server confirmed.
		expect(vi.mocked(apiPatchUserData).mock.calls[1][0]).toEqual({
			emailNotifications: {
				emailNotificationsEnabled: true,
				settings: { appointmentNotificationEnabled: false }
			}
		});
	});
});
