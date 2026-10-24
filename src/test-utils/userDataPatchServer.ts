/**
 * How UserService applies a user-data PATCH to the e-mail preferences
 * (UserServiceMapper / UserDtoMapper on dev and main): `emailToggles` per
 * toggle, `emailNotifications.settings` per key (null = not sent), and
 * `emailNotificationsEnabled` replaced (absent = off). For fake servers in
 * tests.
 */
interface EmailPreferences {
	emailNotifications?: {
		emailNotificationsEnabled?: boolean;
		settings?: Record<string, boolean | undefined>;
	};
	emailToggles?: Array<{ name: string; state: boolean }>;
}

export const applyUserDataPatch = <T extends EmailPreferences>(
	stored: T,
	patch: EmailPreferences
): T => {
	const next = structuredClone(stored);
	for (const toggle of patch.emailToggles ?? []) {
		next.emailToggles = (next.emailToggles ?? []).map((current) =>
			current.name === toggle.name
				? { ...current, state: toggle.state }
				: current
		);
	}
	if (patch.emailNotifications) {
		const settings = { ...(next.emailNotifications?.settings ?? {}) };
		for (const [key, value] of Object.entries(
			patch.emailNotifications.settings ?? {}
		)) {
			if (value !== undefined && value !== null) settings[key] = value;
		}
		next.emailNotifications = {
			emailNotificationsEnabled:
				patch.emailNotifications.emailNotificationsEnabled === true,
			settings
		};
	}
	return next;
};
