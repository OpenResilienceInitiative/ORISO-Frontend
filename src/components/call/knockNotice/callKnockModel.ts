/**
 * Somebody knocking on a call in their own 1:1 conversation, after arriving
 * through a counsellor's audio or video direct link (ADR-029 §2).
 * Mirrors UserService `CallKnockDTO` (ORISO-UserService#1479).
 */
export type CallKnockStatus = 'PENDING' | 'ADMITTED' | 'DECLINED' | 'CANCELLED';

export type CallKnockMedium = 'CHAT' | 'AUDIO' | 'VIDEO';

export interface CallKnock {
	id: number;
	sessionId: number;
	status: CallKnockStatus;
	medium: CallKnockMedium;
	requestedAt: string;
	decidedAt?: string | null;
}

/** What the notice shows: the knock, and who it is. */
export interface KnockingPerson {
	id: number;
	/** `null` while the name is still being looked up, or when it is unknown. */
	name: string | null;
	medium: CallKnockMedium;
}

/** The knocks a fresh list adds to the ones already known: those ring. */
export const newKnockIds = (
	known: ReadonlySet<number>,
	knocks: readonly CallKnock[]
): number[] => knocks.map((k) => k.id).filter((id) => !known.has(id));

/** Keeps the page on screen when the list shrinks under it. */
export const clampPage = (page: number, count: number): number =>
	count <= 0 ? 0 : Math.min(Math.max(page, 0), count - 1);
