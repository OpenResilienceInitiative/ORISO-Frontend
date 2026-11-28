import { describe, expect, it } from 'vite-plus/test';
import {
	buildDeletedAskerRows,
	deletedAskerTopicName,
	listGroupEdges,
	placeDeletedAskerRows,
	type DeletedAskerRow
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

describe('listGroupEdges', () => {
	const deleted = (id: number): DeletedAskerRow => ({
		key: `deleted-asker:${id}`,
		formerSessionId: id,
		timestamp: id
	});

	it('keeps one outline across deleted and real cards', () => {
		const { sessions, rows } = listGroupEdges(
			{ before: [[deleted(1)], []], trailing: [deleted(2)] },
			[false, false],
			() => false
		);
		expect(rows.get('deleted-asker:1')).toMatchObject({
			isGroupStart: true,
			isGroupEnd: false
		});
		expect(sessions[0]).toMatchObject({
			isGroupStart: false,
			isGroupEnd: false
		});
		expect(sessions[1]).toMatchObject({
			isGroupStart: false,
			isGroupEnd: false
		});
		expect(rows.get('deleted-asker:2')).toMatchObject({
			isGroupStart: false,
			isGroupEnd: true
		});
	});

	it('parts the group around an active deleted card', () => {
		const { sessions } = listGroupEdges(
			{ before: [[], [deleted(1)]], trailing: [] },
			[false, false],
			(row) => row.formerSessionId === 1
		);
		expect(sessions[0]).toMatchObject({
			isGroupEnd: true,
			isBeforeActive: true
		});
		expect(sessions[1]).toMatchObject({
			isGroupStart: true,
			isAfterActive: true
		});
	});

	it('matches the plain list when there are no deleted cards', () => {
		const { sessions } = listGroupEdges(
			{ before: [[], [], []], trailing: [] },
			[false, true, false],
			() => false
		);
		expect(
			sessions.map((edge) => [edge.isGroupStart, edge.isGroupEnd])
		).toEqual([
			[true, true],
			[false, false],
			[true, true]
		]);
		expect(sessions[0].isBeforeActive).toBe(true);
		expect(sessions[2].isAfterActive).toBe(true);
	});
});

describe('deletedAskerTopicName', () => {
	const raw = (session: Record<string, unknown>) =>
		({ session }) as unknown as Parameters<typeof deletedAskerTopicName>[0];
	const topics = [
		{ id: 7, name: 'Allgemeine Sozialberatung' }
	] as unknown as Parameters<typeof deletedAskerTopicName>[1];

	it('takes the name the session carries', () => {
		expect(
			deletedAskerTopicName(
				raw({ topic: { id: 7, name: 'Schulden' } }),
				topics
			)
		).toBe('Schulden');
	});

	it('looks the topic up by id when the name is missing', () => {
		expect(deletedAskerTopicName(raw({ mainTopicId: 7 }), topics)).toBe(
			'Allgemeine Sozialberatung'
		);
	});

	it('is undefined when nobody knows the topic', () => {
		expect(deletedAskerTopicName(raw({}), topics)).toBeUndefined();
	});

	it('carries the topic into the row', () => {
		const [row] = buildDeletedAskerRows(
			[],
			[{ sessionId: 1, lastInteraction: 5, topic: 'Schulden' }],
			new Set()
		);
		expect(row.topic).toBe('Schulden');
	});
});
