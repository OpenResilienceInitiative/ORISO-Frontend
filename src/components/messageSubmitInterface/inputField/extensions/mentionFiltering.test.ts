import { describe, expect, it } from 'vitest';
import { filterMentionCandidates, MentionCandidate } from './mentionFiltering';

const c = (
	id: string,
	displayName: string,
	username: string,
	isInRoom: boolean
): MentionCandidate => ({ id, displayName, username, isInRoom });

const candidates: MentionCandidate[] = [
	c('1', 'Anna Kräger', 'a.kraeger', true),
	c('2', 'Jonas Lehmann', 'j.lehmann', false),
	c('3', 'Änne Müller', 'ae.mueller', true),
	c('self', 'Berta Beraterin', 'beraterin', true)
];

describe('filterMentionCandidates', () => {
	it('returns everyone (minus self) for an empty query', () => {
		const result = filterMentionCandidates(candidates, '', 'self');
		expect(result.map((r) => r.id)).not.toContain('self');
		expect(result).toHaveLength(3);
	});

	it('matches on display name, case-insensitive', () => {
		const result = filterMentionCandidates(candidates, 'kräger', 'self');
		expect(result.map((r) => r.id)).toEqual(['1']);
	});

	it('is diacritics-insensitive both ways', () => {
		expect(
			filterMentionCandidates(candidates, 'anne', 'self').map((r) => r.id)
		).toContain('3');
		expect(
			filterMentionCandidates(candidates, 'kraeger', 'self').map(
				(r) => r.id
			)
		).toEqual(['1']);
	});

	it('matches on username', () => {
		expect(
			filterMentionCandidates(candidates, 'lehmann', 'self').map(
				(r) => r.id
			)
		).toEqual(['2']);
	});

	it('sorts in-room members before those not in the chat', () => {
		const result = filterMentionCandidates(candidates, '', 'self');
		const notInRoomIndex = result.findIndex((r) => !r.isInRoom);
		const inRoomIndexes = result
			.map((r, i) => (r.isInRoom ? i : -1))
			.filter((i) => i >= 0);
		expect(Math.max(...inRoomIndexes)).toBeLessThan(notInRoomIndex);
	});

	it('excludes the author even without a query', () => {
		expect(
			filterMentionCandidates(candidates, 'berta', 'self')
		).toHaveLength(0);
	});
});
