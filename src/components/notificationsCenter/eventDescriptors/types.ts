/**
 * WP-06 Activity Timeline — Event-descriptor registry (Slice 0a).
 *
 * Types for the single registry that turns a typed, text-free server record
 * (`event_notification`) into a rendered timeline card. See:
 *   - ORISO-Frontend/CONTEXT.md  (glossary: "Event descriptor", "Event family",
 *     "Action target")
 *   - ADR-AT-01 (Storage & E2EE boundary): the server stores only `event_type`,
 *     reference IDs and structured params — NO rendered display text. Every
 *     visible string is rendered client-side from the i18n templates referenced
 *     here.
 *
 * This module is intentionally pure (no React / no SVG imports) so it can be
 * unit-tested in isolation and so the descriptor data stays serialisable. The
 * SVG components are resolved separately via `icons.tsx` keyed by `EventIconId`.
 */

/**
 * The grouping an event type belongs to — drives the timeline filter chips and
 * shared iconography. Mirrors the families listed in CONTEXT.md.
 * `appointments` is reserved (the family exists in the design) but no
 * appointment event types are seeded yet — Appointment lifecycle events are
 * deferred (WP-06 "Out of scope / deferred").
 */
export type EventFamily =
	| 'requests'
	| 'messages'
	| 'drafts'
	| 'handover'
	| 'calls'
	| 'system'
	| 'appointments';

/**
 * Whether the event carries a chat-message preview (`message`) or is a
 * business/system fact (`system`). Matches the existing
 * `event_notification.category` contract used by `NotificationsCenter` to
 * decide whether to hydrate a Matrix chat preview.
 */
export type EventCategory = 'system' | 'message';

/**
 * Stable identifier for the icon of an event type. Resolved to an SVG React
 * component by `icons.tsx`. Kept as a string id (not the component itself) so
 * this module stays free of SVG/React imports.
 */
export type EventIconId =
	| 'requestNew'
	| 'requestAccepted'
	| 'message'
	| 'threadReply'
	| 'draft'
	| 'handover'
	| 'callStarted'
	| 'callEnded'
	| 'callMissed'
	| 'supervisor'
	| 'rename'
	| 'system';

/**
 * The structured params a descriptor may use to resolve its action target.
 * Today only a subset is populated by the backend (`actionPath`,
 * `sourceSessionId`); the remainder is forward-looking for Slices 2–5 and for
 * the strict text-free record migration (ADR-AT-01). Everything is optional so
 * resolution degrades gracefully while the backend is incremental.
 */
export interface EventActionParams {
	/** Pre-built navigation path emitted by the producer today (origin-encoded). */
	actionPath?: string | null;
	/** Session id the event belongs to, when known. */
	sourceSessionId?: string | number | null;
	/** Matrix room id / RC group id, when known. */
	roomRef?: string | null;
	/** Draft resume scope key (`forcedScopeKey`) for draft events. */
	forcedScopeKey?: string | null;
	/** Thread root id for thread-scoped message events. */
	threadRootId?: string | null;
	/** Live-call room id for `join` targets (Slice 5). */
	callRoomId?: string | null;
	/** Whether a live call is video (Slice 5). */
	isVideo?: boolean | null;
	/**
	 * Base path for the signed-in user's conversation list, e.g.
	 * `/sessions/consultant/sessionView` or `/sessions/user/view`. The consumer
	 * passes this because it depends on the user's authority.
	 */
	sessionsBasePath?: string | null;
	/** Base path for the request/enquiry list, when different from sessions. */
	requestsBasePath?: string | null;
}

/**
 * Where an event's primary action button takes the user. Rule = ORIGIN
 * (CONTEXT.md "Action target"): chat events → the conversation;
 * request-originating events → the request view; a draft → resume where it
 * lives; a live call → Join (does not navigate — joins the call).
 *
 * This is pure data: resolving a target performs no navigation and no side
 * effect. The consumer decides how to act on each `kind`.
 */
export type EventActionTarget =
	| { kind: 'conversation'; path: string | null }
	| { kind: 'request'; path: string | null }
	| { kind: 'draft'; forcedScopeKey: string | null; path: string | null }
	| { kind: 'join'; callRoomId: string | null; isVideo: boolean }
	| { kind: 'none' };

/**
 * The per-event-type definition that owns everything needed to render that
 * event: its icon, family, category, i18n title/text templates, and how to
 * resolve its action target.
 */
export interface EventDescriptor {
	/** The canonical `event_type` string this descriptor describes. */
	eventType: string;
	family: EventFamily;
	category: EventCategory;
	icon: EventIconId;
	/** i18n key for the card title (rendered client-side, ADR-AT-01). */
	titleTemplate: string;
	/** i18n key for the card body text (rendered client-side, ADR-AT-01). */
	textTemplate: string;
	/** Origin-based action target. Pure — returns a descriptor, never navigates. */
	resolveActionTarget: (params: EventActionParams) => EventActionTarget;
}
