import { describe, expect, it } from 'vitest';
import { mergeMatrixMessages } from './sessionHelpers';

const msg = (id: string, tsMs: number, body = id) => ({
	_id: id,
	msg: body,
	ts: new Date(tsMs),
	u: { _id: `@${id}:matrix`, username: id, name: id }
});

describe('mergeMatrixMessages (ADR-008 side-room merge)', () => {
	it('interleaves client and supervision messages sorted ascending by timestamp', () => {
		const client = [msg('c1', 1000), msg('c2', 3000)];
		const supervision = [msg('s1', 2000), msg('s2', 4000)];

		const merged = mergeMatrixMessages(client, supervision);

		expect(merged.map((m) => m._id)).toEqual(['c1', 's1', 'c2', 's2']);
	});

	it('dedupes by event id (client wins over a later duplicate)', () => {
		const client = [msg('shared', 1000, 'from-client')];
		const supervision = [msg('shared', 1000, 'from-side')];

		const merged = mergeMatrixMessages(client, supervision);

		expect(merged).toHaveLength(1);
		expect(merged[0].msg).toBe('from-client');
	});

	it('returns only client messages when there is no side room stream', () => {
		const client = [msg('c1', 1000)];

		const merged = mergeMatrixMessages(client, []);

		expect(merged.map((m) => m._id)).toEqual(['c1']);
	});

	it('tolerates null/undefined inputs', () => {
		expect(mergeMatrixMessages(null as any, undefined as any)).toEqual([]);
	});
});
