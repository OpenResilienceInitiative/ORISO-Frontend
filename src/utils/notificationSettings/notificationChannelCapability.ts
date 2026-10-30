/**
 * Which channels of a settings row can really fire (FE#1211, epic #778:
 * "every row can fire all its channels, or is visibly disabled with a
 * reason"). One table of feed events — who receives them, whether
 * UserService writes them today, whether an in-app pop-up card exists — and a
 * derived answer per role × row × channel. The row of an event always comes
 * from `resolveEventChannelContract`, never from a second mapping here.
 */
import { getEventDescriptor } from '../../components/notificationsCenter/eventDescriptors/registry';
import {
	NEVER_NOTIFY_FAMILIES,
	type NotificationArea,
	type NotificationKind
} from './notificationConfig';
import { resolveEventChannelContract } from './occasionChannelContract';

export type NotificationRole = 'consultant' | 'asker';
/** popup = in-app card, banner = OS notification, sound = tone. */
export type NotificationChannel = 'popup' | 'banner' | 'sound';
export const NOTIFICATION_CHANNELS: ReadonlyArray<NotificationChannel> = [
	'popup',
	'banner',
	'sound'
];
export const NOTIFICATION_ROLES: ReadonlyArray<NotificationRole> = [
	'consultant',
	'asker'
];

/**
 * 'mentioned' = params.mentioned set; 'liveChat' = LIVE_CHAT conversation;
 * 'optIn' = params.clientConsent is OPT_IN (the advice seeker's yes is needed).
 */
export type EventVariant = 'mentioned' | 'liveChat' | 'optIn';

export interface EventCase {
	eventType: string;
	variant?: EventVariant;
	/** Roles the event is addressed to. */
	recipients: ReadonlyArray<NotificationRole>;
	/**
	 * UserService writes this event type. Hand-flagged: the source of truth is
	 * the event-type literals passed to `createEvent*` in UserService `src/main`
	 * (read on origin/dev 44f4517c2, 2026-10-28). Re-check when UserService changes.
	 */
	emitted: boolean;
	/**
	 * Roles that get an in-app pop-up card: live chat, new enquiry, mention (team
	 * discussion), counsellor handover offer, advice seeker's opt-in consent.
	 */
	popupFor?: ReadonlyArray<NotificationRole>;
	/**
	 * With the target conversation open and visible, the card, tone and banner
	 * are all skipped (the message itself is the signal). Only set where the
	 * runtime does so; everything else announces regardless.
	 */
	silentWhenOpen?: boolean;
	/** Where the producer lives, or why there is none. */
	source: string;
}

const BOTH: ReadonlyArray<NotificationRole> = ['consultant', 'asker'];
const CONSULTANT: ReadonlyArray<NotificationRole> = ['consultant'];
const ASKER: ReadonlyArray<NotificationRole> = ['asker'];
const ES = 'EventNotificationService';
const CH = 'CaseHandoverService';
const NONE = 'no producer (frontend descriptor only)';

export const EVENT_CASES: ReadonlyArray<EventCase> = [
	// Requests
	{
		eventType: 'request.new',
		recipients: CONSULTANT,
		emitted: true,
		popupFor: CONSULTANT,
		source: `${ES}.createNewClientRequestNotifications`
	},
	{
		eventType: 'waiting_room.client.joined',
		recipients: CONSULTANT,
		emitted: true,
		popupFor: CONSULTANT,
		source: `${ES}.createWaitingRoomClientJoinedNotifications`
	},
	{
		eventType: 'request.denied',
		recipients: ASKER,
		emitted: true,
		source: 'EnquiryRejectionTransactions'
	},
	{
		eventType: 'inquiry.accepted',
		recipients: ASKER,
		emitted: true,
		source: `${ES}.createInquiryAcceptedNotification`
	},
	// Messages
	{
		eventType: 'message.new',
		recipients: BOTH,
		emitted: true,
		source: `${ES}.createMessageNotificationFromRoom`
	},
	{
		eventType: 'message.new',
		variant: 'liveChat',
		recipients: CONSULTANT,
		emitted: true,
		popupFor: CONSULTANT,
		silentWhenOpen: true,
		source: `${ES}.createMessageNotificationFromRoom`
	},
	{
		eventType: 'thread.reply.new',
		recipients: BOTH,
		emitted: true,
		source: `${ES}.createThreadReplyNotificationFromRoom`
	},
	{
		eventType: 'first_response.received',
		recipients: ASKER,
		emitted: true,
		source: `${ES}.createFirstResponseNotification`
	},
	{
		eventType: 'conversation.finished',
		recipients: BOTH,
		emitted: true,
		source: 'SendFinishedAnonymousConversationEventActionCommand'
	},
	{
		eventType: 'team.discussion.new',
		recipients: CONSULTANT,
		emitted: true,
		source: 'TeamDiscussionNotificationService'
	},
	{
		// The only producer that sets params.mentioned (team discussions), so
		// the mention pop-up exists for this event alone.
		eventType: 'team.discussion.new',
		variant: 'mentioned',
		recipients: CONSULTANT,
		emitted: true,
		popupFor: CONSULTANT,
		silentWhenOpen: true,
		source: 'TeamDiscussionNotificationService'
	},
	// Handover
	{
		// Addressed to the advice seeker. OPT_OUT / NONE only inform: no card.
		eventType: 'case.handover.consent.requested',
		recipients: ASKER,
		emitted: true,
		source: `${CH}.notifyPendingConsent`
	},
	{
		// OPT_IN: the advice seeker's yes is needed, so a card asks for it.
		eventType: 'case.handover.consent.requested',
		variant: 'optIn',
		recipients: ASKER,
		emitted: true,
		popupFor: ASKER,
		silentWhenOpen: true,
		source: `${CH}.notifyPendingConsent`
	},
	{
		eventType: 'case.handover.granted',
		recipients: BOTH,
		emitted: true,
		source: `${CH}.notifyGranted`
	},
	{
		eventType: 'case.handover.consent.declined',
		recipients: CONSULTANT,
		emitted: true,
		source: `${CH}.notifyConsentDeclined`
	},
	{
		eventType: 'case.handover.offer.received',
		recipients: CONSULTANT,
		emitted: true,
		popupFor: CONSULTANT,
		silentWhenOpen: true,
		source: `${CH}.notifyRecipientOffer`
	},
	...[
		'handover.requested',
		'handover.partial',
		'handover.all_confirmed',
		'handover.auto_confirmed',
		'handover.denied'
	].map(
		(eventType): EventCase => ({
			eventType,
			recipients: CONSULTANT,
			emitted: false,
			source: NONE
		})
	),
	// Calls
	...['call.invited', 'call.started', 'call.ended', 'call.missed'].map(
		(eventType): EventCase => ({
			eventType,
			recipients: BOTH,
			emitted: true,
			source: `${ES}.createCall*Notification`
		})
	),
	// Appointments
	...[
		'appointment.requested',
		'appointment.scheduled',
		'appointment.cancelled',
		'appointment.briefing'
	].map(
		(eventType): EventCase => ({
			eventType,
			recipients: BOTH,
			emitted: false,
			source: NONE
		})
	),
	...['group_chat.reminder', 'group_chat.opened', 'group_chat.cancelled'].map(
		(eventType): EventCase => ({
			eventType,
			recipients: BOTH,
			emitted: true,
			source: 'GroupChatLifecycleNotificationService'
		})
	),
	// System (banner follows the single system switch, not a row)
	...['supervisor.added', 'supervisor.removed', 'supervisor.assigned'].map(
		(eventType): EventCase => ({
			eventType,
			recipients: CONSULTANT,
			emitted: true,
			source: `${ES}.createSupervisor*Notification`
		})
	),
	{
		eventType: 'counselor.renamed',
		recipients: ASKER,
		emitted: true,
		source: `${ES}.createCounselorRenamedNotification`
	},
	{
		eventType: 'service.notice.planned',
		recipients: CONSULTANT,
		emitted: true,
		source: 'ServiceNoticeConfirmation'
	},
	// Drafts never notify on any channel
	{
		eventType: 'draft.created',
		recipients: CONSULTANT,
		emitted: false,
		source: NONE
	}
];

/** The row an event case lands in for one recipient, or null (never notifies). */
export const rowForCase = (
	eventCase: EventCase,
	role: NotificationRole
): { area: NotificationArea; kind: NotificationKind } | null => {
	const { family } = getEventDescriptor(eventCase.eventType);
	if (NEVER_NOTIFY_FAMILIES.includes(family)) {
		return null;
	}
	const { area, kind } = resolveEventChannelContract(
		eventCase.eventType,
		role,
		{
			mentioned: eventCase.variant === 'mentioned',
			conversationType:
				eventCase.variant === 'liveChat' ? 'LIVE_CHAT' : undefined
		}
	).browser;
	return { area, kind };
};

/** Why a channel cannot fire; all but `noPopup` have a `…config.unavailable.<reason>` text. */
export type UnavailableReason =
	| 'notSentYet'
	| 'notForRole'
	| 'noEvent'
	| 'noPopup';

export type ChannelCapability =
	| { fires: true }
	| { fires: false; reason: UnavailableReason };

export const channelCapability = (
	role: NotificationRole,
	area: NotificationArea,
	kind: NotificationKind,
	channel: NotificationChannel,
	cases: ReadonlyArray<EventCase> = EVENT_CASES
): ChannelCapability => {
	const landing = cases.filter((eventCase) => {
		const row = eventCase.recipients.includes(role)
			? rowForCase(eventCase, role)
			: null;
		return row?.area === area && row.kind === kind;
	});
	const emitted = landing.filter((eventCase) => eventCase.emitted);
	if (channel === 'popup') {
		if (emitted.some((eventCase) => eventCase.popupFor?.includes(role))) {
			return { fires: true };
		}
		// Events arrive, but no pop-up card exists for them (OS banner/tone do).
		if (emitted.length > 0) {
			return { fires: false, reason: 'noPopup' };
		}
	} else if (emitted.length > 0) {
		return { fires: true };
	}
	if (landing.length > 0) {
		return { fires: false, reason: 'notSentYet' };
	}
	const otherRole = NOTIFICATION_ROLES.some((other) =>
		cases.some((eventCase) => {
			const row = eventCase.recipients.includes(other)
				? rowForCase(eventCase, other)
				: null;
			return row?.area === area && row.kind === kind;
		})
	);
	return { fires: false, reason: otherRole ? 'notForRole' : 'noEvent' };
};

/** The reason of a channel that cannot fire, else null. */
export const unavailableReason = (
	capability: ChannelCapability
): UnavailableReason | null =>
	'reason' in capability ? capability.reason : null;

/** Key of the helper text explaining why a row cannot fire. */
export const unavailableReasonKey = (reason: UnavailableReason): string =>
	`profile.notifications.config.unavailable.${reason}`;

/**
 * What the dialog's two controls can do for a row. The "Banner" select gates
 * the in-app pop-up and the OS banner together, so it is live while either
 * can fire; the tone select follows the sound channel.
 */
export const controlAvailability = (
	role: NotificationRole,
	area: NotificationArea,
	kind: NotificationKind,
	cases: ReadonlyArray<EventCase> = EVENT_CASES
): { banner: ChannelCapability; sound: ChannelCapability } => {
	const popup = channelCapability(role, area, kind, 'popup', cases);
	const banner = channelCapability(role, area, kind, 'banner', cases);
	return {
		banner: popup.fires ? popup : banner,
		sound: channelCapability(role, area, kind, 'sound', cases)
	};
};

/**
 * How the dialog treats a row (Frank, 30 Oct): `hidden` when it can never
 * fire for this role, `disabled` (with a reason) when it will fire once a
 * producer exists, `visible` otherwise. Unknown role (user data not loaded
 * yet) shows the neutral dialog: every row live, except the counsellor-only
 * Live-Chat row.
 */
export type RowVisibility = 'visible' | 'disabled' | 'hidden';

export interface RowAvailability {
	visibility: RowVisibility;
	bannerEnabled: boolean;
	soundEnabled: boolean;
	/** i18n key of the visible reason; set only for `disabled` rows. */
	reasonKey: string | null;
}

export const rowAvailability = (
	role: NotificationRole | undefined,
	area: NotificationArea,
	kind: NotificationKind,
	cases: ReadonlyArray<EventCase> = EVENT_CASES
): RowAvailability => {
	if (role === undefined) {
		return {
			visibility: kind === 'liveChat' ? 'hidden' : 'visible',
			bannerEnabled: true,
			soundEnabled: true,
			reasonKey: null
		};
	}
	const { banner, sound } = controlAvailability(role, area, kind, cases);
	const bannerEnabled = banner.fires;
	const soundEnabled = sound.fires;
	if (bannerEnabled && soundEnabled) {
		return {
			visibility: 'visible',
			bannerEnabled,
			soundEnabled,
			reasonKey: null
		};
	}
	const reasons = [unavailableReason(banner), unavailableReason(sound)];
	if (reasons.includes('notSentYet')) {
		return {
			visibility: 'disabled',
			bannerEnabled,
			soundEnabled,
			reasonKey: unavailableReasonKey('notSentYet')
		};
	}
	return {
		visibility: 'hidden',
		bannerEnabled,
		soundEnabled,
		reasonKey: null
	};
};

/** Areas with at least one row left to show (an empty tab is hidden). */
export const visibleAreas = (
	role: NotificationRole | undefined,
	areas: ReadonlyArray<NotificationArea>,
	kindsOf: (area: NotificationArea) => ReadonlyArray<NotificationKind>
): NotificationArea[] =>
	areas.filter((area) =>
		kindsOf(area).some(
			(kind) => rowAvailability(role, area, kind).visibility !== 'hidden'
		)
	);
