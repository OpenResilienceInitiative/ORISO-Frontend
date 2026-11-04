import { describe, expect, it, vi } from 'vite-plus/test';
import { profileRoutesSettings } from './profileSettings.routes';
import { EmailNotification } from './EmailNotifications';
import type { AppConfigInterface } from '../../globalState/interfaces';
import type { TenantDataSettingsInterface } from '../../globalState/interfaces/TenantDataInterface';
import { isTabGroup, solveCondition } from '../../utils/tabsHelper';

vi.mock('../../globalState', () => ({
	hasUserAuthority: (authority: string, userData: { roles: string[] }) =>
		userData?.roles?.includes(authority),
	AUTHORITIES: { CONSULTANT_DEFAULT: 'consultant', ASKER_DEFAULT: 'asker' }
}));
vi.mock('./SecurityPrivacySettings', () => ({
	SecurityPrivacySettings: () => null
}));
vi.mock('./ConsultantNotifications', () => ({
	ConsultantNotifications: () => null
}));
vi.mock('./EmailNotifications', () => ({ EmailNotification: () => null }));
vi.mock('./NotificationSettings', () => ({
	NotificationSettingsPanel: () => null
}));
vi.mock('../../utils/notificationHelpers', async (importOriginal) => ({
	...(await importOriginal<object>()),
	isSupported: () => true
}));
vi.mock('./BrowserNotifications', () => ({
	BrowserNotification: () => null
}));
vi.mock('./Locale', () => ({ Locale: () => null }));
vi.mock('../timelineSettings/TimelineSettings', () => ({
	TimelineSettings: () => null
}));
vi.mock('../directLinks/MyDirectLinksPanel', () => ({
	MyLinksSettings: () => null
}));
vi.mock(
	'../../features/keyboard-shortcuts/components/KeyboardShortcutsSettings',
	() => ({ KeyboardShortcutsSettings: () => null })
);

/**
 * #1979 (OBP 2.1 test point #101): the advice seeker's e-mail switches are
 * shown only when the release toggle is on AND the Admin "Berechtigungen"
 * allow advice-seeker e-mail.
 */
const emailPanelShown = (
	enableNewNotifications: boolean,
	tenantSettings: Partial<TenantDataSettingsInterface> | undefined,
	role: 'asker' | 'consultant'
) => {
	const group = profileRoutesSettings(
		[],
		{ releaseToggles: { enableNewNotifications } } as AppConfigInterface,
		true,
		tenantSettings
	).find((entry) => isTabGroup(entry) && entry.url === '/email');
	if (!group || !isTabGroup(group)) throw new Error('missing tab');
	return group.elements
		.filter((entry) =>
			solveCondition(entry.condition, { roles: [role] } as never, [])
		)
		.map((entry) => entry.component)
		.includes(EmailNotification);
};

describe('Settings e-mail panel follows the Admin permissions (#1979)', () => {
	it('hides the advice seeker e-mail switches when the permission is off', () => {
		expect(
			emailPanelShown(true, { featureAskerEmailEnabled: false }, 'asker')
		).toBe(false);
	});

	it('shows them with the release toggle on and the permission on', () => {
		expect(
			emailPanelShown(true, { featureAskerEmailEnabled: true }, 'asker')
		).toBe(true);
	});

	it('hides them while the release toggle is off, whatever the permission', () => {
		expect(
			emailPanelShown(false, { featureAskerEmailEnabled: true }, 'asker')
		).toBe(false);
	});

	it('keeps the counsellor e-mail panel: the asker permission is not theirs', () => {
		expect(
			emailPanelShown(
				true,
				{ featureAskerEmailEnabled: false },
				'consultant'
			)
		).toBe(true);
	});
});
