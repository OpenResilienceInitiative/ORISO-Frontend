import { describe, expect, it } from 'vitest';
import {
	pickDisplayOrUsername,
	pickSupervisionCounterpartName
} from './supervisionCounterpart';

describe('pickSupervisionCounterpartName', () => {
	describe('supervisor view (counterpart = responsible consultant)', () => {
		it('prefers the marker counsellorDisplayName over the by-id lookup', () => {
			expect(
				pickSupervisionCounterpartName({
					role: 'supervisor',
					counsellorDisplayName: 'Mona (intern)',
					consultant: {
						displayName: 'Mona M.',
						username: 'mona.moench'
					},
					fallback: 'Anfragephase'
				})
			).toBe('Mona (intern)');
		});

		it('falls back to the resolved consultant when the marker name is blank', () => {
			expect(
				pickSupervisionCounterpartName({
					role: 'supervisor',
					counsellorDisplayName: '  ',
					consultant: { displayName: 'Mona M.' },
					fallback: 'Anfragephase'
				})
			).toBe('Mona M.');
		});

		it('uses the marker name alone when nothing else is resolved (list DTO has no name)', () => {
			const listDtoConsultant = {
				id: 'c-1',
				firstName: 'Mona',
				lastName: 'Mönch'
			} as Record<string, string>;
			expect(
				pickSupervisionCounterpartName({
					role: 'supervisor',
					counsellorDisplayName: 'Mona (intern)',
					consultant: listDtoConsultant,
					fallback: 'Anfragephase'
				})
			).toBe('Mona (intern)');
		});

		it('uses the consultant display name first', () => {
			expect(
				pickSupervisionCounterpartName({
					role: 'supervisor',
					consultant: {
						displayName: 'Mona M.',
						username: 'mona.moench'
					},
					fallback: 'Anfragephase'
				})
			).toBe('Mona M.');
		});

		it('falls back to the username when no display name exists', () => {
			expect(
				pickSupervisionCounterpartName({
					role: 'supervisor',
					consultant: { displayName: '  ', username: 'mona.moench' },
					fallback: 'Anfragephase'
				})
			).toBe('mona.moench');
		});

		it('accepts the userName spelling of the consultant DTO', () => {
			expect(
				pickSupervisionCounterpartName({
					role: 'supervisor',
					consultant: { userName: 'mona.moench' },
					fallback: 'Anfragephase'
				})
			).toBe('mona.moench');
		});

		it('never uses a real name (#996): id/firstName/lastName only → fallback', () => {
			const listDtoConsultant = {
				id: 'c-1',
				firstName: 'Mona',
				lastName: 'Mönch'
			} as Record<string, string>;
			expect(
				pickSupervisionCounterpartName({
					role: 'supervisor',
					consultant: listDtoConsultant,
					fallback: 'Anfragephase'
				})
			).toBe('Anfragephase');
		});

		it('ignores supervisor lists in the supervisor view', () => {
			expect(
				pickSupervisionCounterpartName({
					role: 'supervisor',
					consultant: null,
					supervisorDisplayNames: ['Bettina B.'],
					supervisorUsernames: ['bettina'],
					fallback: 'Anfragephase'
				})
			).toBe('Anfragephase');
		});
	});

	describe('consultant view (counterpart = supervisor)', () => {
		it('uses the list-DTO supervisor display name first', () => {
			expect(
				pickSupervisionCounterpartName({
					role: 'consultant',
					counsellorDisplayName: 'Mona (intern)',
					consultant: { displayName: 'Mona M.' },
					supervisorDisplayNames: ['Bettina B.'],
					supervisorUsernames: ['bettina'],
					fallback: 'Supervision'
				})
			).toBe('Bettina B.');
		});

		it('skips blank display names and uses the supervisor username', () => {
			expect(
				pickSupervisionCounterpartName({
					role: 'consultant',
					supervisorDisplayNames: ['', undefined],
					supervisorUsernames: [null, 'bettina'],
					fallback: 'Supervision'
				})
			).toBe('bettina');
		});

		it('returns the fallback when nothing is known yet', () => {
			expect(
				pickSupervisionCounterpartName({
					role: 'consultant',
					fallback: 'Supervision'
				})
			).toBe('Supervision');
		});
	});
});

describe('pickDisplayOrUsername', () => {
	it('returns an empty string for nothing', () => {
		expect(pickDisplayOrUsername(undefined)).toBe('');
		expect(pickDisplayOrUsername({})).toBe('');
	});
});
