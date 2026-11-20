import { describe, expect, it } from 'vite-plus/test';
import { groupMissingKeyMessages } from './missingKeyGroups';

const msg = (id: string, extra: Record<string, unknown> = {}) =>
	({
		_id: id,
		message: id,
		messageDate: { str: '', date: null },
		messageTime: '1',
		...extra
	}) as never;
const missing = (id: string, extra: Record<string, unknown> = {}) =>
	msg(id, { undecryptableReason: 'missing-key', ...extra });

describe('groupMissingKeyMessages (#1827)', () => {
	it('keeps readable messages as they are', () => {
		const entries = groupMissingKeyMessages([msg('a'), msg('b')]);
		expect(entries.map((e) => e.kind)).toEqual(['message', 'message']);
	});

	it('collapses consecutive missing-key messages into one group', () => {
		const entries = groupMissingKeyMessages([
			msg('a'),
			missing('b'),
			missing('c'),
			missing('d'),
			msg('e')
		]);
		expect(entries.map((e) => e.kind)).toEqual([
			'message',
			'missing-key',
			'message'
		]);
		const group = entries[1];
		expect(
			group.kind === 'missing-key' && group.messages.map((m) => m._id)
		).toEqual(['b', 'c', 'd']);
	});

	it('shows a single missing-key message as a group of one', () => {
		const entries = groupMissingKeyMessages([missing('a')]);
		expect(entries).toHaveLength(1);
		expect(
			entries[0].kind === 'missing-key' && entries[0].messages
		).toHaveLength(1);
	});

	it('starts a new group where a readable message interrupts', () => {
		const entries = groupMissingKeyMessages([
			missing('a'),
			msg('b'),
			missing('c')
		]);
		expect(entries.map((e) => e.kind)).toEqual([
			'missing-key',
			'message',
			'missing-key'
		]);
	});

	it('starts a new group at a date divider so the divider is not lost', () => {
		const entries = groupMissingKeyMessages([
			missing('a'),
			missing('b', { messageDate: { str: 'message.today', date: null } })
		]);
		expect(entries.map((e) => e.kind)).toEqual([
			'missing-key',
			'missing-key'
		]);
	});

	it('starts a new group at the supplement position', () => {
		const entries = groupMissingKeyMessages(
			[missing('a'), missing('b'), missing('c')],
			1
		);
		expect(
			entries.map((e) =>
				e.kind === 'missing-key' ? e.messages.length : 0
			)
		).toEqual([1, 2]);
	});
});
