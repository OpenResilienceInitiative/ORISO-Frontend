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

/**
 * A Matrix room name stays within 255 bytes. Counted in bytes, not characters,
 * because that is the stricter reading: an emoji is 4 bytes. A link name stops
 * at 100 characters, so this only bites on names made of wide characters.
 */
const MAX_NAME_BYTES = 255;

/**
 * Catches a name that IS a Matrix room id, or the old `Group call for <room
 * id>` (what this code used to produce). It does not search free text for a
 * room id: a counsellor may write "Hilfe! Termin: Montag" as a link name, and
 * that is a name, not a leak. A room id reaches the title only by being copied
 * in whole, and that is the case this guards.
 */
const LOOKS_LIKE_ROOM_ID = /^(?:Group call for )?!\S+:\S+$/u;

const encoder = new TextEncoder();

/** Cut at a code point, never inside a surrogate pair. */
const withinByteLimit = (text: string): string => {
	let bytes = 0;
	let kept = '';
	for (const codePoint of text) {
		bytes += encoder.encode(codePoint).length;
		if (bytes > MAX_NAME_BYTES) {
			break;
		}
		kept += codePoint;
	}
	return kept;
};

/**
 * The name the direct link gave the conversation, or `undefined` when there
 * is none worth using. The one place that decides what counts as a name.
 */
export const directLinkCallName = (
	session?: { directLinkName?: string | null } | null
): string | undefined => {
	const name = session?.directLinkName;
	if (typeof name !== 'string') {
		return undefined;
	}
	const trimmed = name.trim();
	if (!trimmed || LOOKS_LIKE_ROOM_ID.test(trimmed)) {
		return undefined;
	}
	return withinByteLimit(trimmed);
};

export const callRoomName = (
	session?: { directLinkName?: string | null } | null
): string => directLinkCallName(session) ?? DEFAULT_CALL_ROOM_NAME;
