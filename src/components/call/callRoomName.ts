/**
 * #2170 (Frank, 2026-11-10): what a call room is called.
 *
 * Element Call shows the Matrix room name as the call's title, and the room
 * is created by the person who starts the call, so this is the one place the
 * title is decided. It used to be `Group call for <session room id>`, which
 * showed the advice seeker and the counsellor a cryptic code.
 *
 * - A conversation opened through a counsellor's direct link is called what
 *   that link is called ("Flyer Schule"). UserService sends the name with the
 *   conversation as `SessionDTO.directLinkName`.
 * - Everything else is "Anruf".
 *
 * Element Call's `roomDisplayName` shows the neutral name in the viewer's own
 * language, so "Anruf" is a marker as much as a word. Change both together.
 */
export const DEFAULT_CALL_ROOM_NAME = 'Anruf';

/** The Matrix limit for a room name. A link name stops at 100. */
const MAX_NAME_LENGTH = 255;

/**
 * A name that is a Matrix room id, or the old `Group call for <room id>`, is
 * no title. It cannot come from a link name today; the guard keeps it that way.
 */
const LOOKS_LIKE_ROOM_ID = /^(?:Group call for )?!\S+:\S+$/u;

export const callRoomName = (
	session?: { directLinkName?: string | null } | null
): string => {
	const name = session?.directLinkName;
	if (typeof name !== 'string') {
		return DEFAULT_CALL_ROOM_NAME;
	}
	const trimmed = name.trim();
	if (!trimmed || LOOKS_LIKE_ROOM_ID.test(trimmed)) {
		return DEFAULT_CALL_ROOM_NAME;
	}
	return trimmed.slice(0, MAX_NAME_LENGTH);
};
