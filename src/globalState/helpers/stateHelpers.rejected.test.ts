import { expect, it } from 'vitest';
import { buildExtendedSession } from './stateHelpers';
import type { ListItemInterface } from '../interfaces';

// Existing persisted ordinals are part of the backend/frontend contract.
it.each([
	[0, true, true, false, false, false],
	[1, true, false, true, false, false],
	[2, false, false, false, false, false],
	[3, false, false, false, false, false],
	[4, false, false, false, true, false],
	[5, false, false, false, false, true]
])(
	'projects status%s without changing the earlier enquiry/archive meanings',
	(status, enquiry, empty, submitted, archived, rejected) => {
		const actual = buildExtendedSession({
			session: { id: 4711, status, matrixRoomId: '!case:test' }
		} as ListItemInterface);
		expect(actual.rid).toBe('!case:test');
		expect([
			actual.isEnquiry,
			actual.isEmptyEnquiry,
			actual.isNonEmptyEnquiry,
			actual.isArchive,
			actual.isRejected
		]).toEqual([enquiry, empty, submitted, archived, rejected]);
	}
);
