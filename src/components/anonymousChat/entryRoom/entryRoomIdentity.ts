/** UI progress only: InviteLink still validates session ownership with the server.
 * Do not restore consent or authentication from this record.
 */
const persistentKey = (sessionId: number) =>
	`oriso.liveChat.confirmedName.${sessionId}`;
const key = (sessionId: number) => `anonymous-pseudonym-name-${sessionId}`;

export const readConfirmedEntryName = (sessionId: number): string | null => {
	for (const storage of ['sessionStorage', 'localStorage'] as const) {
		try {
			const name = window[storage].getItem(
				storage === 'localStorage'
					? persistentKey(sessionId)
					: key(sessionId)
			);
			if (name?.trim()) return name;
		} catch {
			// One unavailable storage must not hide the other one's progress.
		}
	}
	return null;
};

/** Called only after both name writes succeeded, or to restore an existing
 * confirmation into a newly opened tab for the downstream chat gate.
 */
export const rememberConfirmedEntryName = (
	sessionId: number,
	name: string
): void => {
	try {
		localStorage.setItem(persistentKey(sessionId), name);
	} catch {
		// Reload can still resume through sessionStorage when persistence is blocked.
	}
	try {
		sessionStorage.setItem(key(sessionId), name);
		sessionStorage.setItem(`anonymous-pseudonym-${sessionId}`, '1');
	} catch {
		// Storage restrictions must not prevent joining the waiting room.
	}
};
