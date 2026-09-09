import { describe, expect, it, vi } from 'vitest';
import { profileRoutesSettings } from './profileSettings.routes';
import { NotificationSettingsPanel } from './NotificationSettings';
import { EmailNotification } from './EmailNotifications';
import { ConsultantNotifications } from './ConsultantNotifications';
import type { AppConfigInterface } from '../../globalState/interfaces';
import { isTabGroup, solveCondition } from '../../utils/tabsHelper';

vi.mock('../../globalState', () => ({
	hasUserAuthority: () => true,
	AUTHORITIES: { CONSULTANT_DEFAULT: 'consultant', ASKER_DEFAULT: 'asker' }
}));
vi.mock('../passwordReset/PasswordReset', () => ({
	PasswordReset: () => null
}));
vi.mock('../twoFactorAuth/TwoFactorAuth', () => ({
	TwoFactorAuth: () => null
}));
vi.mock('./EncryptionSettings', () => ({
	EncryptionSettingsPanel: () => null
}));
vi.mock('./ConsultantNotifications', () => ({
	ConsultantNotifications: () => null
}));
vi.mock('./EmailNotifications', () => ({ EmailNotification: () => null }));
vi.mock('./NotificationSettings', () => ({
	NotificationSettingsPanel: () => null
}));
vi.mock('./DeleteAccount', () => ({ DeleteAccount: () => null }));
vi.mock('./Locale', () => ({ Locale: () => null }));
vi.mock(
	'../../features/keyboard-shortcuts/components/KeyboardShortcutsSettings',
	() => ({ KeyboardShortcutsSettings: () => null })
);

describe('Profile settings notification access', () => {
	it.each([true, false])(
		'shows the correct existing panel when modern notifications=%s',
		(enabled) => {
			const settings = {
				releaseToggles: { enableNewNotifications: enabled }
			} as AppConfigInterface;
			const group = profileRoutesSettings([], settings).find(
				(entry) => isTabGroup(entry) && entry.url === '/email'
			);
			if (!group || !isTabGroup(group))
				throw new Error(
					'Existing settings notification section missing'
				);
			const visible = group.elements.filter((entry) =>
				solveCondition(entry.condition, {} as never, [])
			);
			expect(visible.map((entry) => entry.component)).toEqual(
				enabled
					? [EmailNotification, NotificationSettingsPanel]
					: [ConsultantNotifications]
			);
		}
	);
});
