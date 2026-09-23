import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import profileRoutes from './profile.routes';
import { BrowserNotification } from './BrowserNotifications';
import { NOTIFICATION_SETTINGS_PATH } from './notificationSettingsPath';
import type {
	AppConfigInterface,
	TenantDataInterface
} from '../../globalState/interfaces';
import { isTabGroup, solveCondition } from '../../utils/tabsHelper';

// Route tables only — keep the real component trees out of the test.
const { stub } = vi.hoisted(() => ({
	stub: (name: string) => () => ({ [name]: () => null })
}));
vi.mock('react-device-detect', () => ({ isDesktop: true }));
vi.mock('../../globalState', () => ({
	AUTHORITIES: {
		CONSULTANT_DEFAULT: 'consultant',
		ASKER_DEFAULT: 'asker'
	},
	hasUserAuthority: (authority: string, userData: any) =>
		!!userData?.grantedAuthorities?.includes(authority)
}));
vi.mock('../../utils/notificationHelpers', () => ({
	isSupported: () => true,
	browserNotificationsSettings: () => ({ enabled: false, visited: true })
}));
vi.mock('./ConsultantInformation', stub('ConsultantInformation'));
vi.mock('./ConsultantSpokenLanguages', stub('ConsultantSpokenLanguages'));
vi.mock('./ConsultantAgencies', stub('ConsultantAgencies'));
vi.mock('./AskerConsultingTypeData', stub('AskerConsultingTypeData'));
vi.mock('./ConsultantPrivateData', stub('ConsultantPrivateData'));
vi.mock('./AskerAboutMeData', stub('AskerAboutMeData'));
vi.mock('./ConsultantStatistics', stub('ConsultantStatistics'));
vi.mock('./AbsenceFormular', stub('AbsenceFormular'));
vi.mock('./LiveChatAvailability', stub('LiveChatAvailability'));
vi.mock('./EnableWalkthrough', stub('EnableWalkthrough'));
vi.mock('../productTour/TourOverviewSection', stub('TourOverviewSection'));
vi.mock('./OverviewMobile/Bookings', stub('OverviewBookings'));
vi.mock('./OverviewMobile/Sessions', stub('OverviewSessions'));
vi.mock('./AdditionalEnquiry/AdditionalEnquiry', stub('AdditionalEnquiry'));
vi.mock('../help/Help', stub('Help'));
vi.mock('./Documentation', stub('Documentation'));
vi.mock('../passwordReset/PasswordReset', stub('PasswordReset'));
vi.mock('../twoFactorAuth/TwoFactorAuth', stub('TwoFactorAuth'));
vi.mock('./EncryptionSettings', stub('EncryptionSettingsPanel'));
vi.mock('./ConsultantNotifications', stub('ConsultantNotifications'));
// Mounted here by #1538; mocked so this test survives that merge.
vi.mock('./EmailNotifications', stub('EmailNotification'));
vi.mock('./NotificationSettings', stub('NotificationSettingsPanel'));
vi.mock('./BrowserNotifications', stub('BrowserNotification'));
vi.mock('./DeleteAccount', stub('DeleteAccount'));
vi.mock('./Locale', stub('Locale'));
vi.mock(
	'../../features/keyboard-shortcuts/components/KeyboardShortcutsSettings',
	stub('KeyboardShortcutsSettings')
);

const consultant = { grantedAuthorities: ['consultant'] };
const asker = { grantedAuthorities: ['asker'] };

const routes = (enableNewNotifications: boolean) =>
	profileRoutes(
		{ releaseToggles: { enableNewNotifications } } as AppConfigInterface,
		null as unknown as TenantDataInterface,
		['de'],
		false
	);

// Mirrors Profile.tsx: `/profile${tab.url}${group.url}`.
const componentsAt = (
	enableNewNotifications: boolean,
	userData: object,
	path: string
) => {
	for (const tab of routes(enableNewNotifications)) {
		if (!solveCondition(tab.condition, userData, [])) continue;
		for (const group of tab.elements) {
			if (!group || !isTabGroup(group)) continue;
			if (`/profile${tab.url}${group.url}` !== path) continue;
			if (!solveCondition(group.condition, userData, [])) continue;
			return (group.elements ?? [])
				.filter((el) => solveCondition(el.condition, userData, []))
				.map((el) => el.component);
		}
	}
	return [];
};

describe('browser pop-up opt-in is reachable (#1551)', () => {
	it.each([
		['counsellor', consultant],
		['advice seeker', asker]
	])(
		'%s finds the browser pop-up switch on the notification settings screen (legacy toggle off)',
		(_, userData) => {
			expect(
				componentsAt(false, userData, NOTIFICATION_SETTINGS_PATH)
			).toContain(BrowserNotification);
		}
	);

	it('leaves the screen to the cross-device panel when the new notifications are on', () => {
		expect(
			componentsAt(true, consultant, NOTIFICATION_SETTINGS_PATH)
		).not.toContain(BrowserNotification);
	});

	it('has no second, hidden notifications tab', () => {
		expect(routes(false).map((tab) => tab.url)).not.toContain(
			'/notifications'
		);
	});

	it.each([
		'src/components/sessionsList/SessionsList.tsx',
		'src/components/notificationsCenter/NotificationsCenter.tsx'
	])('%s links to that screen, not to the hidden tab', (file) => {
		const source = readFileSync(file, 'utf8');
		expect(source).not.toContain('/profile/notifications');
		expect(source).toContain('navigate(NOTIFICATION_SETTINGS_PATH)');
	});
});
