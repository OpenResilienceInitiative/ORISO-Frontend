/**
 * WP-06 Activity Timeline — Event-descriptor registry (Slice 0a).
 *
 * The single source of truth mapping `event_type` → descriptor. Seeds:
 *   - the 6 event types emitted today (`inquiry.accepted`, `message.new`,
 *     `thread.reply.new`, `supervisor.added/removed/assigned`,
 *     `counselor.renamed`), and
 *   - descriptors for every designed family that Slices 2–5 will light up
 *     (Requests, Messages, Drafts, Handover, Calls, System). Appointments are
 *     deferred (no event types seeded).
 *
 * Pure module: no React / SVG imports. Icons are resolved separately by id
 * (`icons.tsx`); all visible strings are i18n keys rendered client-side
 * (ADR-AT-01 — the server record is text-free).
 */

import {
	EventActionParams,
	EventActionTarget,
	EventDescriptor,
	EventFamily
} from './types';

/** Default conversation list base when the consumer does not pass one. */
const DEFAULT_SESSIONS_BASE_PATH = '/sessions/consultant/sessionView';

/** i18n key for a family's filter-chip / tag label. */
export const familyLabelKey = (family: EventFamily): string =>
	`notifications.families.${family}`;

// --- Action-target resolvers (origin rule) -------------------------------

const buildConversationPath = (params: EventActionParams): string | null => {
	if (params.actionPath) {
		return params.actionPath;
	}
	if (params.sourceSessionId != null && params.sourceSessionId !== '') {
		const base = params.sessionsBasePath || DEFAULT_SESSIONS_BASE_PATH;
		return `${base}/session/${params.sourceSessionId}`;
	}
	if (params.seriesId != null && params.seriesId !== '') {
		const base = params.sessionsBasePath || DEFAULT_SESSIONS_BASE_PATH;
		return `${base}/session/${params.seriesId}`;
	}
	return null;
};

const conversationTarget = (params: EventActionParams): EventActionTarget => ({
	kind: 'conversation',
	path: buildConversationPath(params)
});

const groupChatJoinTarget = (params: EventActionParams): EventActionTarget => ({
	kind: 'groupChatJoin',
	path: buildConversationPath(params)
});

const requestTarget = (params: EventActionParams): EventActionTarget => ({
	kind: 'request',
	path: params.actionPath || params.requestsBasePath || null
});

const draftTarget = (params: EventActionParams): EventActionTarget => ({
	kind: 'draft',
	forcedScopeKey: params.forcedScopeKey ?? null,
	path: params.actionPath ?? null
});

// Slice 5: the consumer wires `join` to `callManager.startCall(callRoomId,
// isVideo, true)` (LiveKit/ElementCall) — NOT the legacy `useJoinVideoCall`
// (`/videoanruf`) native-WebRTC path. Here we only produce the pure descriptor.
const joinTarget = (params: EventActionParams): EventActionTarget => ({
	kind: 'join',
	callRoomId: params.callRoomId ?? params.roomRef ?? null,
	isVideo: !!params.isVideo
});

// --- Descriptor factory --------------------------------------------------

interface DescriptorSeed {
	family: EventDescriptor['family'];
	category: EventDescriptor['category'];
	icon: EventDescriptor['icon'];
	/** camelCase i18n key segment (decoupled from the dotted event_type). */
	i18nKey: string;
	resolveActionTarget: EventDescriptor['resolveActionTarget'];
}

const descriptor = (
	eventType: string,
	seed: DescriptorSeed
): EventDescriptor => ({
	eventType,
	family: seed.family,
	category: seed.category,
	icon: seed.icon,
	titleTemplate: `notifications.events.${seed.i18nKey}.title`,
	textTemplate: `notifications.events.${seed.i18nKey}.text`,
	resolveActionTarget: seed.resolveActionTarget
});

/**
 * Fallback descriptor for unknown / not-yet-described event types. Keeps the
 * timeline robust: an unseeded type still renders (generic system card) rather
 * than crashing. The consumer falls back to the server-provided title/text via
 * `defaultValue` when the template is absent.
 */
export const FALLBACK_DESCRIPTOR: EventDescriptor = {
	eventType: '__fallback__',
	family: 'system',
	category: 'system',
	icon: 'system',
	titleTemplate: 'notifications.events.fallback.title',
	textTemplate: 'notifications.events.fallback.text',
	resolveActionTarget: conversationTarget
};

// --- The registry --------------------------------------------------------

const seeds: EventDescriptor[] = [
	// ----- Existing 6 emitted types -----
	// A request is accepted → the conversation now exists, so it opens the chat.
	descriptor('inquiry.accepted', {
		family: 'requests',
		category: 'system',
		icon: 'requestAccepted',
		i18nKey: 'inquiryAccepted',
		resolveActionTarget: conversationTarget
	}),
	descriptor('message.new', {
		family: 'messages',
		category: 'message',
		icon: 'message',
		i18nKey: 'messageNew',
		resolveActionTarget: conversationTarget
	}),
	descriptor('thread.reply.new', {
		family: 'messages',
		category: 'message',
		icon: 'threadReply',
		i18nKey: 'threadReplyNew',
		resolveActionTarget: conversationTarget
	}),
	// FE#514 / ADR-016: a post in an enquiry's team-only discussion room. The
	// server-emitted actionPath deep-links into the discussion panel.
	descriptor('team.discussion.new', {
		family: 'messages',
		category: 'message',
		icon: 'teamDiscussion',
		i18nKey: 'teamDiscussionNew',
		resolveActionTarget: conversationTarget
	}),
	descriptor('supervisor.added', {
		family: 'system',
		category: 'system',
		icon: 'supervisor',
		i18nKey: 'supervisorAdded',
		resolveActionTarget: conversationTarget
	}),
	descriptor('supervisor.removed', {
		family: 'system',
		category: 'system',
		icon: 'supervisor',
		i18nKey: 'supervisorRemoved',
		resolveActionTarget: conversationTarget
	}),
	descriptor('supervisor.assigned', {
		family: 'system',
		category: 'system',
		icon: 'supervisor',
		i18nKey: 'supervisorAssigned',
		resolveActionTarget: conversationTarget
	}),
	descriptor('counselor.renamed', {
		family: 'system',
		category: 'system',
		icon: 'rename',
		i18nKey: 'counselorRenamed',
		resolveActionTarget: conversationTarget
	}),

	// ----- Requests family (Slice 2 will persist "New client request") -----
	descriptor('request.new', {
		family: 'requests',
		category: 'system',
		icon: 'requestNew',
		i18nKey: 'requestNew',
		resolveActionTarget: requestTarget
	}),
	// Figma design review 2026-07-12 (Timeline History Pannel): seed the
	// designed-but-not-yet-emitted types so the frontend is ready the moment a
	// backend writer appears (Slice-0a philosophy — seed ALL designed types).
	descriptor('request.denied', {
		family: 'requests',
		category: 'system',
		icon: 'requestDenied',
		i18nKey: 'requestDenied',
		resolveActionTarget: requestTarget
	}),
	// A client entering the live-chat waiting room originates from the
	// request/enquiry view (WP-06 Tier 3 — descriptor seeded ahead of the
	// writer).
	descriptor('waiting_room.client.joined', {
		family: 'requests',
		category: 'system',
		icon: 'waitingRoom',
		i18nKey: 'waitingRoomClientJoined',
		resolveActionTarget: requestTarget
	}),

	// ----- Drafts family (self-event; Slice 3 overlay) -----
	descriptor('draft.created', {
		family: 'drafts',
		category: 'system',
		icon: 'draft',
		i18nKey: 'draftCreated',
		resolveActionTarget: draftTarget
	}),

	// ----- Handover family (append-only progression cards; Slice 4) -----
	descriptor('handover.requested', {
		family: 'handover',
		category: 'system',
		icon: 'handover',
		i18nKey: 'handoverRequested',
		resolveActionTarget: conversationTarget
	}),
	descriptor('handover.partial', {
		family: 'handover',
		category: 'system',
		icon: 'handover',
		i18nKey: 'handoverPartial',
		resolveActionTarget: conversationTarget
	}),
	descriptor('handover.all_confirmed', {
		family: 'handover',
		category: 'system',
		icon: 'handover',
		i18nKey: 'handoverAllConfirmed',
		resolveActionTarget: conversationTarget
	}),
	descriptor('handover.auto_confirmed', {
		family: 'handover',
		category: 'system',
		icon: 'handover',
		i18nKey: 'handoverAutoConfirmed',
		resolveActionTarget: conversationTarget
	}),
	descriptor('handover.denied', {
		family: 'handover',
		category: 'system',
		icon: 'handoverDenied',
		i18nKey: 'handoverDenied',
		resolveActionTarget: conversationTarget
	}),
	descriptor('case.handover.consent.requested', {
		family: 'handover',
		category: 'system',
		icon: 'handover',
		i18nKey: 'caseHandoverConsentRequested',
		resolveActionTarget: conversationTarget
	}),
	descriptor('case.handover.granted', {
		family: 'handover',
		category: 'system',
		icon: 'handover',
		i18nKey: 'caseHandoverGranted',
		resolveActionTarget: conversationTarget
	}),
	descriptor('case.handover.consent.declined', {
		family: 'handover',
		category: 'system',
		icon: 'handoverDenied',
		i18nKey: 'caseHandoverConsentDeclined',
		resolveActionTarget: conversationTarget
	}),

	// ----- Calls family (Slice 5) -----
	// Live, joinable call -> Join overlay (does not navigate).
	descriptor('call.started', {
		family: 'calls',
		category: 'system',
		icon: 'callStarted',
		i18nKey: 'callStarted',
		resolveActionTarget: joinTarget
	}),
	descriptor('call.ended', {
		family: 'calls',
		category: 'system',
		icon: 'callEnded',
		i18nKey: 'callEnded',
		resolveActionTarget: conversationTarget
	}),
	descriptor('call.missed', {
		family: 'calls',
		category: 'system',
		icon: 'callMissed',
		i18nKey: 'callMissed',
		resolveActionTarget: conversationTarget
	}),
	// Invitation to an internal (team) group call — Figma 2026-07-12.
	descriptor('call.invited', {
		family: 'calls',
		category: 'system',
		icon: 'callInvited',
		i18nKey: 'callInvited',
		resolveActionTarget: conversationTarget
	}),

	// ----- Appointments family (Figma 2026-07-12; writers still deferred) -----
	descriptor('appointment.requested', {
		family: 'appointments',
		category: 'system',
		icon: 'appointmentRequested',
		i18nKey: 'appointmentRequested',
		resolveActionTarget: conversationTarget
	}),
	descriptor('appointment.scheduled', {
		family: 'appointments',
		category: 'system',
		icon: 'appointmentScheduled',
		i18nKey: 'appointmentScheduled',
		resolveActionTarget: conversationTarget
	}),
	descriptor('appointment.cancelled', {
		family: 'appointments',
		category: 'system',
		icon: 'appointmentCancelled',
		i18nKey: 'appointmentCancelled',
		resolveActionTarget: conversationTarget
	}),
	descriptor('appointment.briefing', {
		family: 'appointments',
		category: 'system',
		icon: 'appointmentBriefing',
		i18nKey: 'appointmentBriefing',
		resolveActionTarget: conversationTarget
	}),

	// ----- Self-help group occurrence lifecycle -----
	descriptor('group_chat.reminder', {
		family: 'appointments',
		category: 'system',
		icon: 'appointment',
		i18nKey: 'groupChatReminder',
		resolveActionTarget: conversationTarget
	}),
	descriptor('group_chat.opened', {
		family: 'appointments',
		category: 'system',
		icon: 'appointment',
		i18nKey: 'groupChatOpened',
		resolveActionTarget: groupChatJoinTarget
	}),
	descriptor('group_chat.cancelled', {
		family: 'appointments',
		category: 'system',
		icon: 'appointment',
		i18nKey: 'groupChatCancelled',
		resolveActionTarget: conversationTarget
	})
];

/** event_type → descriptor. */
export const EVENT_DESCRIPTORS: Readonly<Record<string, EventDescriptor>> =
	seeds.reduce<Record<string, EventDescriptor>>((acc, entry) => {
		acc[entry.eventType] = entry;
		return acc;
	}, {});

/** All seeded event types (excludes the fallback). */
export const KNOWN_EVENT_TYPES: ReadonlyArray<string> = seeds.map(
	(entry) => entry.eventType
);

/**
 * Resolve the descriptor for an `event_type`. Never returns null — an unknown
 * type yields {@link FALLBACK_DESCRIPTOR} so the timeline stays robust.
 */
export const getEventDescriptor = (
	eventType: string | null | undefined
): EventDescriptor => {
	if (!eventType) {
		return FALLBACK_DESCRIPTOR;
	}
	return EVENT_DESCRIPTORS[eventType] || FALLBACK_DESCRIPTOR;
};

/** True if the given event type has a seeded (non-fallback) descriptor. */
export const isKnownEventType = (
	eventType: string | null | undefined
): boolean => !!eventType && eventType in EVENT_DESCRIPTORS;
