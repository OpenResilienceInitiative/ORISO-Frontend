import { describe, expect, it } from 'vitest';

import {
	AUDIENCE_ALL,
	buildAudienceRoster,
	classifyAudienceKind,
	defaultAudienceSelection,
	reconcileAudienceSelection,
	restoreAudienceSelection,
	shouldShowAudienceSelector,
	type AudienceOption
} from './audienceOptions';

const option = (
	value: string,
	kind: AudienceOption['kind'] = 'person'
): AudienceOption => ({ value, label: value, kind });

const withAll = (...rest: AudienceOption[]): AudienceOption[] => [
	{ value: AUDIENCE_ALL, label: 'Send to all', kind: 'all' },
	...rest
];

describe('defaultAudienceSelection', () => {
	it('prefers "all" when the option exists', () => {
		expect(defaultAudienceSelection(withAll(option('@kim')))).toEqual([
			AUDIENCE_ALL
		]);
	});

	it('falls back to the first option when there is no "all"', () => {
		expect(defaultAudienceSelection([option('@kim'), option('@ada')])).toEqual(
			['@kim']
		);
	});

	it('returns "all" for an empty option list', () => {
		expect(defaultAudienceSelection([])).toEqual([AUDIENCE_ALL]);
	});
});

describe('restoreAudienceSelection', () => {
	const options = withAll(option('@kim'), option('@ada'));

	/**
	 * The regression this whole module exists for: the previous implementation
	 * bailed out before reading storage whenever an "all" option was present —
	 * and the selector is only ever rendered when "all" *is* present, so the
	 * restore path could never run in production.
	 */
	it('restores a saved person selection even though "all" is available', () => {
		expect(
			restoreAudienceSelection(JSON.stringify(['@ada']), options)
		).toEqual(['@ada']);
	});

	it('restores a saved multi-person selection, preserving order', () => {
		expect(
			restoreAudienceSelection(JSON.stringify(['@ada', '@kim']), options)
		).toEqual(['@ada', '@kim']);
	});

	it('restores an explicitly saved "all"', () => {
		expect(
			restoreAudienceSelection(JSON.stringify([AUDIENCE_ALL]), options)
		).toEqual([AUDIENCE_ALL]);
	});

	it('drops values whose participant is no longer in the room', () => {
		expect(
			restoreAudienceSelection(
				JSON.stringify(['@ada', '@someone-who-left']),
				options
			)
		).toEqual(['@ada']);
	});

	it('returns null when nothing saved is still valid', () => {
		expect(
			restoreAudienceSelection(JSON.stringify(['@gone']), options)
		).toBeNull();
	});

	it('returns null for missing, malformed or non-array storage', () => {
		expect(restoreAudienceSelection(null, options)).toBeNull();
		expect(restoreAudienceSelection('', options)).toBeNull();
		expect(restoreAudienceSelection('{ not json', options)).toBeNull();
		expect(restoreAudienceSelection('"@ada"', options)).toBeNull();
		expect(restoreAudienceSelection('42', options)).toBeNull();
	});

	it('ignores non-string entries inside the saved array', () => {
		expect(
			restoreAudienceSelection(
				JSON.stringify(['@ada', 7, null, { value: '@kim' }]),
				options
			)
		).toEqual(['@ada']);
	});
});

describe('classifyAudienceKind', () => {
	const roster = buildAudienceRoster({
		askerIds: ['@enc.katze_mika_1234:oriso.org', 'katze_mika_1234'],
		consultantIds: ['@consultant42:oriso.org'],
		supervisorIds: ['@moderator7:oriso.org']
	});

	it('marks the sentinel as "all"', () => {
		expect(classifyAudienceKind(AUDIENCE_ALL, roster)).toBe('all');
	});

	it('recognises the asker by their Matrix id', () => {
		expect(
			classifyAudienceKind('@enc.katze_mika_1234:oriso.org', roster)
		).toBe('asker');
	});

	it('recognises the asker by their bare username', () => {
		expect(classifyAudienceKind('katze_mika_1234', roster)).toBe('asker');
	});

	it('recognises a consultant', () => {
		expect(classifyAudienceKind('@consultant42:oriso.org', roster)).toBe(
			'consultant'
		);
	});

	it('recognises a supervisor', () => {
		expect(classifyAudienceKind('@moderator7:oriso.org', roster)).toBe(
			'supervisor'
		);
	});

	/**
	 * Supervision outranks the counselling role: someone listed as both is a
	 * moderator for the purpose of this conversation, and the icon has to say
	 * so.
	 */
	it('prefers supervisor over consultant when a person is both', () => {
		const both = buildAudienceRoster({
			askerIds: [],
			consultantIds: ['@consultant42:oriso.org'],
			supervisorIds: ['@consultant42:oriso.org']
		});
		expect(classifyAudienceKind('@consultant42:oriso.org', both)).toBe(
			'supervisor'
		);
	});

	/**
	 * A display name containing the word "Berater" must not be enough to make
	 * someone a counsellor — that string test is exactly what this replaces.
	 */
	it('does not infer a role from the label text', () => {
		expect(
			classifyAudienceKind('@gutmuetiger_berater_biber:oriso.org', roster)
		).toBe('person');
	});

	it('falls back to "person" for anyone unmatched', () => {
		expect(classifyAudienceKind('@someone-else:oriso.org', roster)).toBe(
			'person'
		);
	});
});

describe('reconcileAudienceSelection', () => {
	const options: AudienceOption[] = [
		{ value: AUDIENCE_ALL, label: 'Send to all', kind: 'all' },
		{ value: '@kim', label: 'Kim', kind: 'consultant' },
		{ value: '@ada', label: 'Ada', kind: 'supervisor' }
	];

	/**
	 * The bug this replaces: the old effect forced `['__all__']` on every new
	 * `audienceOptions` array identity. A 700 ms refresh timer rebuilds that
	 * array shortly after mount, so a recipient picked in the first seconds was
	 * silently reset to "everyone" — the opposite of what the user chose, in a
	 * control that decides who can read the message.
	 */
	it('keeps an explicit selection when the options are rebuilt', () => {
		expect(reconcileAudienceSelection(['@ada'], options)).toEqual(['@ada']);
	});

	it('keeps an explicit "all"', () => {
		expect(reconcileAudienceSelection([AUDIENCE_ALL], options)).toEqual([
			AUDIENCE_ALL
		]);
	});

	it('drops recipients who left and keeps the rest', () => {
		expect(reconcileAudienceSelection(['@ada', '@gone'], options)).toEqual([
			'@ada'
		]);
	});

	it('falls back to the default when every recipient is gone', () => {
		expect(reconcileAudienceSelection(['@gone'], options)).toEqual([
			AUDIENCE_ALL
		]);
	});

	it('falls back to the first option when there is no "all" left', () => {
		expect(
			reconcileAudienceSelection(['@gone'], [options[1], options[2]])
		).toEqual(['@kim']);
	});
});

describe('shouldShowAudienceSelector', () => {
	const person = (value: string): AudienceOption => ({
		value,
		label: value,
		kind: 'person'
	});

	it('shows the control once more than two people can message each other', () => {
		expect(
			shouldShowAudienceSelector({
				isClientUser: false,
				options: withAll(person('@kim'), person('@ada'))
			})
		).toBe(true);
	});

	/** Rule A — one possible recipient means there is nothing to choose. */
	it('hides the control in a 1-1 conversation', () => {
		expect(
			shouldShowAudienceSelector({
				isClientUser: false,
				options: withAll(person('@kim'))
			})
		).toBe(false);
	});

	it('hides the control when there is nobody to address', () => {
		expect(
			shouldShowAudienceSelector({ isClientUser: false, options: [] })
		).toBe(false);
	});

	/** Rule E — advice seekers do not get to narrow the audience. */
	it('hides the control from advice seekers even in a large group', () => {
		expect(
			shouldShowAudienceSelector({
				isClientUser: true,
				options: withAll(person('@kim'), person('@ada'), person('@bo'))
			})
		).toBe(false);
	});

	/**
	 * Without "everyone" there is no way back from a narrowed audience, so the
	 * control is withheld rather than offering a one-way door.
	 */
	it('hides the control when there is no way back to everyone', () => {
		expect(
			shouldShowAudienceSelector({
				isClientUser: false,
				options: [person('@kim'), person('@ada')]
			})
		).toBe(false);
	});
});
