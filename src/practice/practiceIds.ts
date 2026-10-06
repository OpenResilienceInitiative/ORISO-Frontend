/**
 * Id shapes for practice fixtures that can never equal a real id (spec section
 * 4): a practice case that happened to share an id with a real enquiry would
 * make "accept" or a heartbeat hit a real row. Helpers only; the fixtures
 * themselves belong to the fake backend (S2).
 *
 * - numeric ids (sessions, users, messages) are negative; real ids are
 *   sequential database ids >= 0
 * - string ids start with `practice-`
 * - Matrix ids use the reserved `.invalid` TLD (RFC 6761) as server name: it
 *   can never resolve or be registered, so no federation or lookup can hit it
 */

export const PRACTICE_ID_PREFIX = 'practice-';
export const PRACTICE_MATRIX_SERVER = 'practice.invalid';

const LOCAL_PART = /^[A-Za-z0-9._-]+$/;
const NEGATIVE_INTEGER = /^-[1-9]\d*$/;
const PRACTICE_STRING = new RegExp(`^${PRACTICE_ID_PREFIX}[A-Za-z0-9._-]+$`);
const PRACTICE_MATRIX = new RegExp(
	`^[!$@#]${PRACTICE_ID_PREFIX}[A-Za-z0-9._-]+:${PRACTICE_MATRIX_SERVER.replace('.', '\\.')}$`
);

const assertSequence = (n: unknown): number => {
	if (typeof n !== 'number' || !Number.isInteger(n) || n < 1) {
		throw new Error(
			'A practice id needs a positive integer sequence number'
		);
	}
	return n;
};

const assertLocalPart = (value: string): string => {
	if (typeof value !== 'string' || !LOCAL_PART.test(value)) {
		throw new Error(`Invalid practice id part: ${JSON.stringify(value)}`);
	}
	return value;
};

/** 1 -> -1, 2 -> -2. Zero is refused: it could be a real id. */
export const practiceNumericId = (n: number): number => -assertSequence(n);

/** (`enquiry`, 1) -> `practice-enquiry-1`. */
export const practiceStringId = (kind: string, n: number): string =>
	`${PRACTICE_ID_PREFIX}${assertLocalPart(kind)}-${assertSequence(n)}`;

/** (`!`, `room-1`) -> `!practice-room-1:practice.invalid`. */
export const practiceMatrixId = (
	sigil: '!' | '$' | '@' | '#',
	localPart: string
): string =>
	`${sigil}${PRACTICE_ID_PREFIX}${assertLocalPart(localPart)}:${PRACTICE_MATRIX_SERVER}`;

/**
 * True only for ids made by the helpers above. Anything else, including
 * non-ids, counts as "real": callers must treat unknown as real.
 */
export const isPracticeId = (id: unknown): boolean => {
	if (typeof id === 'number') {
		return Number.isInteger(id) && id < 0;
	}
	if (typeof id === 'string') {
		return (
			NEGATIVE_INTEGER.test(id) ||
			PRACTICE_STRING.test(id) ||
			PRACTICE_MATRIX.test(id)
		);
	}
	return false;
};
