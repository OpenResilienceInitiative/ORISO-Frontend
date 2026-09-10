/**
 * Which state marks one pill of the collapsed session-list rail carries.
 *
 * Frank, 09.09.2026: "Die Kreise finde ich ganz geil. Allerdings sind die
 * natürlich auch verwirrend und auch bisschen eiförmig. Ich würde mir
 * wünschen, wir hätten da mehr Infos drin." — so the rail's avatar circles
 * become portrait pills: avatar on top, small state marks underneath.
 *
 * ---------------------------------------------------------------------------
 * ONE SOURCE PER MARK — nothing here invents state. Every input already
 * existed in the list before this module; the mark is only its rendering.
 * ---------------------------------------------------------------------------
 *
 *   thread       `MatrixRoomPreview.channel === 'thread'`
 *                (`sessionsListItem/matrixRoomPreview.ts`, set from the
 *                `m.thread` relation on the room's newest message).
 *                HONEST SCOPE: this says the newest message came from a
 *                thread — not "this conversation has N threads". The list
 *                DTO carries no thread count, and the rail must not fetch
 *                per row to invent one.
 *
 *   supervision  `getSupervisionListState(...) !== 'none'`
 *                (`sessionsListItem/supervisionListState.ts` over
 *                `SessionDTO.supervision`, ADR-008 list marker). Both
 *                `supervisedByMe` and `supervisedByOthers` mean a supervisor
 *                is on the case, which is what the rail states.
 *
 *   mail         `getModality(...) === Modality.AGENCY_COUNSELLING`
 *                (`session/getModality.ts`, ADR-006 — the single modality
 *                selector; the expanded row draws the same envelope from it).
 *
 *   unread       `isChatItemUnread(...)` (`utils/sessionUnread.ts`, #1147 —
 *                derived from the Matrix room's notification count. The DTO's
 *                `messagesRead` is hard-coded `true` and must not be read.)
 *
 * Frank named them in this order — "ob es dort Threads gibt, eine Supervision
 * … ob es eine Mailberatung ist, ob eine neue Nachricht gekommen ist" — and
 * the pill renders them in exactly that order, so the marks never dance
 * around between rows.
 */

export type SessionRailMark = 'thread' | 'supervision' | 'mail' | 'unread';

/** Rendering order. Fixed, so a mark keeps its slot from row to row. */
export const SESSION_RAIL_MARK_ORDER: readonly SessionRailMark[] = [
	'thread',
	'supervision',
	'mail',
	'unread'
] as const;

export interface SessionRailMarkInput {
	/** `MatrixRoomPreview.channel` of the row's newest message. */
	previewChannel?: 'thread' | 'supervision' | null;
	/** `getSupervisionListState()` result for the signed-in consultant. */
	supervisionState?: 'none' | 'supervisedByMe' | 'supervisedByOthers' | null;
	/** `getModality()` result — compared against `AGENCY_COUNSELLING`. */
	modality?: string | null;
	/** `isChatItemUnread()` result. */
	unread?: boolean | null;
}

/** `Modality.AGENCY_COUNSELLING` as a string, so this stays import-free. */
const MAIL_MODALITY = 'AGENCY_COUNSELLING';

/**
 * The marks for one row, already in render order. Undefined inputs mean "the
 * list does not know" and produce no mark — a missing source never guesses.
 */
export const getSessionRailMarks = ({
	previewChannel,
	supervisionState,
	modality,
	unread
}: SessionRailMarkInput): SessionRailMark[] => {
	const present: Record<SessionRailMark, boolean> = {
		thread: previewChannel === 'thread',
		supervision:
			supervisionState === 'supervisedByMe' ||
			supervisionState === 'supervisedByOthers',
		mail: modality === MAIL_MODALITY,
		unread: unread === true
	};
	return SESSION_RAIL_MARK_ORDER.filter((mark) => present[mark]);
};

/**
 * Accessible names for the marks. Injected, never looked up here: the pill is
 * a presentational building block and the i18n catalogue is guarded at drift
 * budget 0, so the host maps EXISTING keys onto this shape.
 *
 * The app's mapping (`SessionListItemComponent`) uses, in order:
 *   `chatStage.switcher.kind.thread`      → "Thread"
 *   `sessionList.toolbar.chips.supervision` → "Supervision"
 *   `sessionList.toolbar.chips.nearby`     → "Mail"
 *   `sessionList.toolbar.chips.unread`     → "Ungelesen"
 */
export type SessionRailMarkLabels = Record<SessionRailMark, string>;
