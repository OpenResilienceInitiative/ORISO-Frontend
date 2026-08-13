/**
 * The notification matrix from ADR-019, as the settings screen shows it.
 *
 * Advice seekers and counsellors get two separate lists, not one list filtered
 * by role. That is the decision the ADR turns on: an advice seeker uses ORISO a
 * handful of times, in a situation they did not choose, often on a shared
 * device; a counsellor works in it daily and needs the operational stream. One
 * list forces one of the two to be wrong, and is how
 * `appointmentNotificationEnabled` came to be shown to everyone with nothing
 * behind it.
 */

/**
 * Where a switch's value actually lives.
 *
 * Two mechanisms, because the platform has two. Four occasions sit in the
 * `notificationsSettings` JSON blob on the user; the counsellor's two
 * most-used ones are columns on the consultant, reached through
 * `emailToggles`. Unifying them is a migration — this presents one coherent
 * list over both.
 */
export type NotificationSource =
	/**
	 * `field` is keyed to the generated API type on purpose. A typo here would
	 * not fail — the switch would render, save without error, and never
	 * persist. This makes it a compile error instead.
	 */
	| {
			kind: 'settings';
			field: string & keyof UserService.Schemas.NotificationsSettingsDTO;
	  }
	| { kind: 'emailToggle'; type: UserService.Schemas.EmailType };

export interface NotificationSwitch {
	/** Stable id — also what the unsubscribe link's `?mail=` resolves against. */
	id: string;
	titleKey: string;
	descriptionKey: string;
	source: NotificationSource;
	/**
	 * The occasions this one switch covers. Several occasions deliberately
	 * share a switch: someone who does not want to hear about a reassignment
	 * request does not want to hear about its confirmation either.
	 */
	occasions: string[];
}

/**
 * Advice seekers: three switches.
 *
 * Deliberately short. Everything else that reaches an advice seeker is either
 * account access, which nobody may switch off, or in-app only.
 */
export const ADVICE_SEEKER_SWITCHES: NotificationSwitch[] = [
	{
		id: 'newMessage',
		titleKey: 'profile.notifications.matrix.asker.newMessage.title',
		descriptionKey:
			'profile.notifications.matrix.asker.newMessage.description',
		source: {
			kind: 'settings',
			field: 'newChatMessageNotificationEnabled'
		},
		occasions: ['neue-nachricht']
	},
	{
		id: 'appointment',
		titleKey: 'profile.notifications.matrix.asker.appointment.title',
		descriptionKey:
			'profile.notifications.matrix.asker.appointment.description',
		source: { kind: 'settings', field: 'appointmentNotificationEnabled' },
		occasions: ['termin']
	},
	{
		id: 'serviceNotice',
		titleKey: 'profile.notifications.matrix.shared.serviceNotice.title',
		descriptionKey:
			'profile.notifications.matrix.shared.serviceNotice.description',
		source: { kind: 'settings', field: 'serviceNoticeNotificationEnabled' },
		occasions: ['systemhinweis']
	}
];

/** Counsellors: the operational stream. */
export const CONSULTANT_SWITCHES: NotificationSwitch[] = [
	{
		id: 'newEnquiry',
		titleKey: 'profile.notifications.matrix.consultant.newEnquiry.title',
		descriptionKey:
			'profile.notifications.matrix.consultant.newEnquiry.description',
		source: {
			kind: 'settings',
			field: 'initialEnquiryNotificationEnabled'
		},
		occasions: ['neue-anfrage', 'direkte-anfrage']
	},
	{
		id: 'dailyDigest',
		titleKey: 'profile.notifications.matrix.consultant.dailyDigest.title',
		descriptionKey:
			'profile.notifications.matrix.consultant.dailyDigest.description',
		source: { kind: 'emailToggle', type: 'DAILY_ENQUIRY' },
		occasions: ['tagesuebersicht']
	},
	{
		id: 'newMessage',
		titleKey: 'profile.notifications.matrix.consultant.newMessage.title',
		descriptionKey:
			'profile.notifications.matrix.consultant.newMessage.description',
		source: {
			kind: 'emailToggle',
			type: 'NEW_CHAT_MESSAGE_FROM_ADVICE_SEEKER'
		},
		occasions: ['neue-nachricht']
	},
	{
		id: 'assignment',
		titleKey: 'profile.notifications.matrix.consultant.assignment.title',
		descriptionKey:
			'profile.notifications.matrix.consultant.assignment.description',
		source: { kind: 'settings', field: 'assignmentNotificationEnabled' },
		occasions: ['anfrage-zugewiesen']
	},
	{
		id: 'reassignment',
		titleKey: 'profile.notifications.matrix.consultant.reassignment.title',
		descriptionKey:
			'profile.notifications.matrix.consultant.reassignment.description',
		source: { kind: 'settings', field: 'reassignmentNotificationEnabled' },
		occasions: ['uebergabe-angefragt', 'uebergabe-bestaetigt']
	},
	{
		id: 'feedback',
		titleKey: 'profile.notifications.matrix.consultant.feedback.title',
		descriptionKey:
			'profile.notifications.matrix.consultant.feedback.description',
		source: { kind: 'settings', field: 'feedbackNotificationEnabled' },
		occasions: ['rueckmeldung']
	},
	{
		id: 'serviceNotice',
		titleKey: 'profile.notifications.matrix.shared.serviceNotice.title',
		descriptionKey:
			'profile.notifications.matrix.shared.serviceNotice.description',
		source: { kind: 'settings', field: 'serviceNoticeNotificationEnabled' },
		occasions: ['systemhinweis']
	}
];

/**
 * What is sent regardless, and why.
 *
 * Named on the screen rather than left out of it. A recipient who arrives here
 * from an unsubscribe link on a password-reset mail should find out that there
 * is no switch, instead of hunting a list for one that does not exist.
 */
export const ALWAYS_SENT_KEYS = [
	'profile.notifications.matrix.alwaysSent.security',
	'profile.notifications.matrix.alwaysSent.legal',
	'profile.notifications.matrix.alwaysSent.outage'
];

/** Resolves the `?mail=<occasion>` an ORISO mail's footer link carries. */
export const switchForOccasion = (
	switches: NotificationSwitch[],
	occasion: string | null
): NotificationSwitch | undefined =>
	occasion
		? switches.find((entry) => entry.occasions.includes(occasion))
		: undefined;
