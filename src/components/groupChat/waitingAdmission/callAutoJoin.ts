/**
 * ORISO-Frontend#2237: a person let in from a group's waiting room goes
 * straight into the group's running call. The waiting room marks the group;
 * the running call's card in the chat that opens next takes the mark and
 * joins without a click. Kept in sessionStorage, so the chat that loads
 * after the admission still finds it; never older than a few minutes.
 */
const KEY = 'oriso.groupCallAutoJoin';
const MAX_AGE_MS = 10 * 60_000;

type Marks = Record<string, number>;

const read = (): Marks => {
	try {
		const raw = window.sessionStorage.getItem(KEY);
		return raw ? (JSON.parse(raw) as Marks) : {};
	} catch {
		return {};
	}
};

const write = (marks: Marks) => {
	try {
		if (Object.keys(marks).length === 0) {
			window.sessionStorage.removeItem(KEY);
		} else {
			window.sessionStorage.setItem(KEY, JSON.stringify(marks));
		}
	} catch {
		/* Storage blocked: the card's "Beitreten" still works. */
	}
};

export const markCallAutoJoin = (chatId: number, now = Date.now()) => {
	write({ ...read(), [String(chatId)]: now });
};

export const shouldAutoJoinCall = (
	chatId: number | undefined,
	now = Date.now()
): boolean => {
	if (chatId === undefined) return false;
	const markedAt = read()[String(chatId)];
	return markedAt !== undefined && now - markedAt <= MAX_AGE_MS;
};

/** True once: the first running call card that asks joins. */
export const takeCallAutoJoin = (
	chatId: number | undefined,
	now = Date.now()
): boolean => {
	if (chatId === undefined) return false;
	const due = shouldAutoJoinCall(chatId, now);
	const marks = read();
	delete marks[String(chatId)];
	write(marks);
	return due;
};
