import type { TourDefinition } from '../types';

/**
 * Asker settings (FE#2343): password, two-factor, the recovery key, account
 * deletion, notifications and display. Watch-only — deleting the account is
 * explained, never triggered. Password (hidden for temporary accounts),
 * two-factor (only when enabled) and notifications (several variants, absent
 * under some tenant permissions) are optional. At desktop width a profile tab
 * renders all of its cards and lower ones may sit below the fold (targets are
 * not scrolled into view), hence `auto` placement on the card steps.
 */
export const askerSettingsTour: TourDefinition = {
	id: 'asker-settings',
	version: 1,
	surface: 'frontend',
	audiences: ['asker'],
	titleKey: 'tour.askerSettings.title',
	summaryKey: 'tour.askerSettings.summary',
	steps: [
		{
			id: 'intro',
			route: '/profile/einstellungen',
			target: '',
			placement: 'center',
			titleKey: 'tour.askerSettings.step.intro.title',
			contentKey: 'tour.askerSettings.step.intro.intro'
		},
		{
			id: 'password',
			route: '/profile/einstellungen/sicherheit',
			target: 'settings-password',
			placement: 'auto',
			optional: true,
			titleKey: 'tour.askerSettings.step.password.title',
			contentKey: 'tour.askerSettings.step.password.intro'
		},
		{
			id: 'two-factor',
			route: '/profile/einstellungen/sicherheit',
			target: 'settings-2fa',
			placement: 'auto',
			optional: true,
			titleKey: 'tour.askerSettings.step.twoFactor.title',
			contentKey: 'tour.askerSettings.step.twoFactor.intro'
		},
		{
			id: 'recovery',
			route: '/profile/einstellungen/sicherheit',
			target: 'settings-recovery',
			placement: 'auto',
			titleKey: 'tour.askerSettings.step.recovery.title',
			contentKey: 'tour.askerSettings.step.recovery.intro'
		},
		{
			// Explained only; the tour never opens the delete dialog. Always
			// rendered for askers, but the lowest card of the page.
			id: 'delete-account',
			route: '/profile/einstellungen/sicherheit',
			target: 'settings-delete-account',
			placement: 'auto',
			titleKey: 'tour.askerSettings.step.deleteAccount.title',
			contentKey: 'tour.askerSettings.step.deleteAccount.intro'
		},
		{
			id: 'notifications',
			route: '/profile/einstellungen/email',
			target: 'settings-notifications',
			placement: 'auto',
			optional: true,
			titleKey: 'tour.askerSettings.step.notifications.title',
			contentKey: 'tour.askerSettings.step.notifications.intro'
		},
		{
			id: 'display',
			route: '/profile/einstellungen/anzeige',
			target: 'settings-display',
			placement: 'auto',
			titleKey: 'tour.askerSettings.step.display.title',
			contentKey: 'tour.askerSettings.step.display.intro'
		},
		{
			id: 'done',
			target: '',
			placement: 'center',
			titleKey: 'tour.askerSettings.step.done.title',
			contentKey: 'tour.askerSettings.step.done.intro'
		}
	]
};
