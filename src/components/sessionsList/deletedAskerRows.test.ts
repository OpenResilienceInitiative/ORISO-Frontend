import { describe, expect, it } from 'vite-plus/test';
import {
	buildDeletedAskerRows,
	placeDeletedAskerRows
} from './deletedAskerRows';

const at = (iso: string) => Date.parse(iso);

describe('buildDeletedAskerRows', () => {
	it('merges backend placeholders and marked chats, newest first, one row per case', () => {
		const rows = buildDeletedAskerRows(
			[
				{ formerSessionId: 1, deletedAt: '2026-10-20T10:00:00Z' },
				{ formerSessionId: 2, deletedAt: '2026-10-28T10:00:00Z' }
			],
			[
				{ sessionId: 2, lastInteraction: at('2026-10-27T10:00:00Z') },
				{ sessionId: 3, lastInteraction: at('2026-10-25T10:00:00Z') }
			],
			new Set()
		);

		expect(rows.map((row) => row.formerSessionId)).toEqual([2, 3, 1]);
		// a marked chat keeps its place in the list
		expect(rows[0].timestamp).toBe(at('2026-10-27T10:00:00Z'));
	});

	it('never shows a placeholder next to the real conversation', () => {
		const rows = buildDeletedAskerRows(
			[{ formerSessionId: 1, deletedAt: '2026-10-20T10:00:00Z' }],
			[],
			new Set([1])
		);

		expect(rows).toEqual([]);
	});
});

describe('placeDeletedAskerRows', () => {
	const rows = buildDeletedAskerRows(
		[
			{ formerSessionId: 1, deletedAt: '2026-10-29T10:00:00Z' },
			{ formerSessionId: 2, deletedAt: '2026-10-26T10:00:00Z' },
			{ formerSessionId: 3, deletedAt: '2026-10-01T10:00:00Z' }
		],
		[],
		new Set()
	);
	const conversations = [
		at('2026-10-28T10:00:00Z'),
		at('2026-10-25T10:00:00Z')
	];

	it('puts each row above the first older conversation', () => {
		const { before, trailing } = placeDeletedAskerRows(
			conversations,
			rows,
			false
		);

		expect(before[0].map((row) => row.formerSessionId)).toEqual([1]);
		expect(before[1].map((row) => row.formerSessionId)).toEqual([2]);
		expect(trailing.map((row) => row.formerSessionId)).toEqual([3]);
	});

	it('holds back rows older than every loaded conversation while more pages can load', () => {
		const { trailing } = placeDeletedAskerRows(conversations, rows, true);

		expect(trailing).toEqual([]);
	});

	it('shows every row in an empty list', () => {
		const { trailing } = placeDeletedAskerRows([], rows, false);

		expect(trailing).toHaveLength(3);
	});
});
