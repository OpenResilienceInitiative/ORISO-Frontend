import { describe, expect, it } from 'vite-plus/test';
import {
	askerEmailNotificationsPermitted,
	askerHasEmailSettings,
	hasEmailSettingsPanel,
	visibleEmailSwitches
} from './emailNotificationAccess';
import {
	ADVICE_SEEKER_SWITCHES,
	CONSULTANT_SWITCHES
} from './notificationMatrix';

/**
 * #1979: the e-mail switches in Settings follow the Admin "Berechtigungen".
 * The tenant settings here are the effective values TenantService delivers
 * (platform policy, then Träger), so this is the only place the Frontend
 * decides anything.
 */
describe('askerEmailNotificationsPermitted', () => {
	it('allows e-mail when the Träger has decided nothing (server defaults)', () => {
		expect(askerEmailNotificationsPermitted(undefined)).toBe(true);
		expect(askerEmailNotificationsPermitted({})).toBe(true);
	});

	it('forbids e-mail when "E-Mail hinterlassen" is off', () => {
		expect(
			askerEmailNotificationsPermitted({
				featureAskerEmailEnabled: false
			})
		).toBe(false);
	});

	it('forbids e-mail when every conversation type has e-mail switched off', () => {
		expect(
			askerEmailNotificationsPermitted({
				featureAskerEmailAgencyCounsellingEnabled: false,
				featureAskerEmailLiveChatEnabled: false,
				featureAskerEmailSelfHelpEnabled: false
			})
		).toBe(false);
	});

	it('allows e-mail while at least one conversation type permits it', () => {
		expect(
			askerEmailNotificationsPermitted({
				featureAskerEmailAgencyCounsellingEnabled: false,
				featureAskerEmailLiveChatEnabled: true,
				featureAskerEmailSelfHelpEnabled: false
			})
		).toBe(true);
	});
});

describe('askerHasEmailSettings', () => {
	const on = { releaseToggles: { enableNewNotifications: true } };
	const off = { releaseToggles: { enableNewNotifications: false } };

	it('hides the e-mail settings while the release toggle is off', () => {
		expect(askerHasEmailSettings(off, {})).toBe(false);
		expect(askerHasEmailSettings(undefined, {})).toBe(false);
	});

	it('hides the e-mail settings when the permission is off, even with the toggle on', () => {
		expect(
			askerHasEmailSettings(on, { featureAskerEmailEnabled: false })
		).toBe(false);
	});

	it('shows the e-mail settings with the toggle on and the permission on', () => {
		expect(
			askerHasEmailSettings(on, { featureAskerEmailEnabled: true })
		).toBe(true);
	});
});

describe('hasEmailSettingsPanel (link from the conversation menu)', () => {
	const on = { releaseToggles: { enableNewNotifications: true } };

	it('does not link an advice seeker to a panel the permission hides', () => {
		expect(
			hasEmailSettingsPanel(
				on,
				{ featureAskerEmailEnabled: false },
				false
			)
		).toBe(false);
	});

	it('links an advice seeker when toggle and permission are on', () => {
		expect(hasEmailSettingsPanel(on, {}, false)).toBe(true);
	});

	it('always links counsellors, who keep a panel either way', () => {
		expect(
			hasEmailSettingsPanel(
				undefined,
				{ featureAskerEmailEnabled: false },
				true
			)
		).toBe(true);
	});
});

describe('visibleEmailSwitches', () => {
	const ids = (list: { id: string }[]) => list.map((entry) => entry.id);

	it('drops the internal-chat switch when internal-group e-mail is off', () => {
		expect(
			ids(
				visibleEmailSwitches(CONSULTANT_SWITCHES, {
					featureConsultantEmailInternalGroupEnabled: false
				})
			)
		).not.toContain('internalChat');
	});

	it('keeps every switch when nothing is forbidden', () => {
		expect(visibleEmailSwitches(CONSULTANT_SWITCHES, {})).toEqual(
			CONSULTANT_SWITCHES
		);
		expect(visibleEmailSwitches(ADVICE_SEEKER_SWITCHES, undefined)).toEqual(
			ADVICE_SEEKER_SWITCHES
		);
	});
});
