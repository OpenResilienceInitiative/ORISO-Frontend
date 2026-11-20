/**
 * Rooms this person is leaving on purpose (#1923). The Matrix "you left"
 * event that follows must not be read as "the group was stopped".
 */
const leaving = new Set<string>();

export const markSelfLeave = (roomId: string) => {
	leaving.add(roomId);
};

export const clearSelfLeave = (roomId: string) => {
	leaving.delete(roomId);
};

/** True once for a room marked by `markSelfLeave`. */
export const takeSelfLeave = (roomId: string) => leaving.delete(roomId);
