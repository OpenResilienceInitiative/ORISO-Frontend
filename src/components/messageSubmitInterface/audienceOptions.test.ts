import { describe, expect, it } from 'vitest';

import {
	AUDIENCE_ALL,
	audienceIdentityKeys,
	buildAudienceRoster,
	classifyAudienceKind,
	createAudienceCollector,
	createIdentityLookup,
	defaultAudienceSelection,
	reconcileAudienceSelection,
	restoreAudienceSelection,
	shouldShowAudienceSelector,
	audienceOptionsReady,
	groupAudienceOptions,
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
		expect(
			defaultAudienceSelection([option('@kim'), option('@ada')])
		).toEqual(['@kim']);
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

describe('audienceOptionsReady', () => {
	/**
	 * The state this guards against, found by re-reading the restore effect
	 * rather than by a failing screen: `audienceOptions` starts life as a
	 * one-element `[__all__]` placeholder, and the real recipients only arrive
	 * once the Matrix room members load. A restore that fires against the
	 * placeholder finds nothing valid, falls back to "everyone", marks the chat
	 * as restored — and then skips the real options when they show up. The
	 * saved selection would be lost exactly as before.
	 */
	it('is not ready while only the placeholder exists', () => {
		expect(
			audienceOptionsReady([
				{ value: AUDIENCE_ALL, label: 'Send to all', kind: 'all' }
			])
		).toBe(false);
	});

	it('is not ready for an empty list', () => {
		expect(audienceOptionsReady([])).toBe(false);
	});

	it('is ready once a real recipient is present', () => {
		expect(
			audienceOptionsReady([
				{ value: AUDIENCE_ALL, label: 'Send to all', kind: 'all' },
				{ value: '@ada', label: 'Ada', kind: 'consultant' }
			])
		).toBe(true);
	});

	it('is ready even without an "all" option', () => {
		expect(
			audienceOptionsReady([
				{ value: '@ada', label: 'Ada', kind: 'person' }
			])
		).toBe(true);
	});
});

describe('groupAudienceOptions', () => {
	const options: AudienceOption[] = [
		{
			value: '@enc.katze_mika:oriso.org',
			label: 'Katze Mika',
			kind: 'asker'
		},
		{
			value: '@consultant42:oriso.org',
			label: 'K. Paulstätter',
			kind: 'consultant'
		},
		{
			value: '@moderator7:oriso.org',
			label: 'B. Pardon',
			kind: 'supervisor'
		},
		{ value: '@someone:oriso.org', label: 'Unklar', kind: 'person' },
		{ value: AUDIENCE_ALL, label: 'Send to all', kind: 'all' }
	];

	it('puts each option in the section its role says', () => {
		const grouped = groupAudienceOptions(options, []);
		expect(grouped.clients.map((o) => o.value)).toEqual([
			'@enc.katze_mika:oriso.org'
		]);
		expect(grouped.moderators.map((o) => o.value)).toEqual([
			'@moderator7:oriso.org'
		]);
		expect(grouped.counsellors.map((o) => o.value)).toEqual([
			'@consultant42:oriso.org',
			'@someone:oriso.org'
		]);
	});

	it('never lists the "everyone" sentinel as a person', () => {
		const grouped = groupAudienceOptions(options, []);
		const everyone = [
			...grouped.clients,
			...grouped.counsellors,
			...grouped.moderators
		];
		expect(everyone.some((o) => o.value === AUDIENCE_ALL)).toBe(false);
	});

	/**
	 * The reason this is a function rather than inline classification: the menu
	 * used to re-derive roles with the fuzzy `getComparableAudienceIds`, whose
	 * 4+ character tokens include the homeserver name. Every participant on
	 * `oriso.org` shares the token `oriso`, so one supervisor in the room could
	 * pull unrelated people into the moderator section — and with them the
	 * moderator icon. Reported by CodeRabbit on #948.
	 */
	it('does not let a shared homeserver drag people into the wrong section', () => {
		const grouped = groupAudienceOptions(options, []);
		expect(grouped.moderators).toHaveLength(1);
		expect(grouped.clients).toHaveLength(1);
	});

	it('marks the viewer’s own entry as disabled rather than dropping it', () => {
		const grouped = groupAudienceOptions(options, ['consultant42']);
		expect(grouped.counsellors[0]).toMatchObject({
			value: '@consultant42:oriso.org',
			disabled: true
		});
		expect(grouped.counsellors[1].disabled).toBe(false);
	});

	/** Matching self must be exact too — two generated names can share a word. */
	it('does not disable someone who merely shares a word with the viewer', () => {
		const shared: AudienceOption[] = [
			{
				value: '@alpaka_mika:oriso.org',
				label: 'sanftes Alpaka Mika',
				kind: 'asker'
			},
			{
				value: '@alpaka_leon:oriso.org',
				label: 'gutmütiges Alpaka Leon',
				kind: 'asker'
			}
		];
		const grouped = groupAudienceOptions(shared, ['alpaka_mika']);
		expect(grouped.clients.map((o) => o.disabled)).toEqual([true, false]);
	});
});

describe('audienceIdentityKeys', () => {
	it('recognises one person across the spellings they arrive in', () => {
		const keys = audienceIdentityKeys('@enc.katze_mika:oriso.org');
		expect(keys.has('katze_mika')).toBe(true);
		expect(keys.has('enc.katze_mika')).toBe(true);
		expect(keys.has('@enc.katze_mika:oriso.org')).toBe(true);
	});

	/** The whole point: the homeserver must never become an identity. */
	it('never yields the homeserver as a key', () => {
		const keys = audienceIdentityKeys('@consultant42:oriso.org');
		expect(keys.has('oriso')).toBe(false);
		expect(keys.has('oriso.org')).toBe(false);
	});

	it('has nothing in common with another account on the same homeserver', () => {
		const mine = audienceIdentityKeys('@consultant42:oriso.org');
		const theirs = audienceIdentityKeys('@moderator7:oriso.org');
		const shared = [...mine].filter((key) => theirs.has(key));
		expect(shared).toEqual([]);
	});
});

describe('createAudienceCollector', () => {
	/**
	 * The regression this collector exists for.
	 *
	 * De-duplication used to run through the composer's fuzzy
	 * `getComparableAudienceIds`, which adds every token of four or more
	 * characters — so `@consultant42:oriso.org` contributed `oriso`, and every
	 * account on the homeserver looked like a duplicate of every other one. The
	 * second recipient was silently dropped and the message went out narrowed
	 * to the wrong audience.
	 */
	it('keeps two different people who share a homeserver', () => {
		const collector = createAudienceCollector([]);
		collector.add('@consultant42:oriso.org', 'K. Paulstätter');
		collector.add('@moderator7:oriso.org', 'B. Pardon');

		expect(collector.entries()).toEqual([
			['@consultant42:oriso.org', 'K. Paulstätter'],
			['@moderator7:oriso.org', 'B. Pardon']
		]);
	});

	it('keeps a whole room of accounts on one homeserver', () => {
		const collector = createAudienceCollector([]);
		[
			'@enc.katze_mika:oriso.org',
			'@consultant42:oriso.org',
			'@moderator7:oriso.org',
			'@someone-else:oriso.org'
		].forEach((id) => collector.add(id, id));

		expect(collector.entries()).toHaveLength(4);
	});

	it('still collapses the same person arriving twice', () => {
		const collector = createAudienceCollector([]);
		collector.add('@enc.katze_mika:oriso.org', 'Katze Mika');
		// The session payload calls the same asker by their bare username.
		collector.add('katze_mika', 'katze_mika');

		expect(collector.entries()).toEqual([
			['@enc.katze_mika:oriso.org', 'Katze Mika']
		]);
	});

	it('reports whether an entry was taken', () => {
		const collector = createAudienceCollector([]);
		expect(collector.add('@consultant42:oriso.org', 'K.')).toBe(true);
		expect(collector.add('consultant42', 'K.')).toBe(false);
		expect(collector.add('', 'nobody')).toBe(false);
	});

	/**
	 * The same defect on the self test, and the more damaging half: it runs
	 * before de-duplication, over the Matrix room member list. With the fuzzy
	 * matcher the signed-in consultant's own `oriso` token matched every member
	 * of the room, so the loop discarded all of them as "me" and the selector
	 * fell back to whatever the explicit additions could supply.
	 */
	it('does not mistake a colleague on the same homeserver for the viewer', () => {
		const collector = createAudienceCollector(['@consultant1:oriso.org']);

		expect(collector.isSelf('@moderator7:oriso.org')).toBe(false);
		expect(collector.isSelf('@enc.katze_mika:oriso.org')).toBe(false);
		expect(collector.isSelf('@consultant1:oriso.org')).toBe(true);
	});

	it('drops the viewer however their own id is spelled', () => {
		const collector = createAudienceCollector([
			'@consultant1:oriso.org',
			'consultant1',
			'Kim Paulstätter'
		]);
		collector.add('@consultant1:oriso.org', 'me');
		collector.add('consultant1', 'me');
		collector.add('@moderator7:oriso.org', 'B. Pardon');

		expect(collector.entries()).toEqual([
			['@moderator7:oriso.org', 'B. Pardon']
		]);
	});

	/** Two generated pseudonyms can share a word without being one person. */
	it('does not merge two people who merely share a name word', () => {
		const collector = createAudienceCollector([]);
		collector.add('@alpaka_mika:oriso.org', 'sanftes Alpaka Mika');
		collector.add('@alpaka_leon:oriso.org', 'gutmütiges Alpaka Leon');

		expect(collector.entries()).toHaveLength(2);
	});
});

describe('createIdentityLookup', () => {
	it('finds the entry whichever spelling of the id is used', () => {
		const lookup = createIdentityLookup<string>();
		lookup.set(['@moderator7:oriso.org', 'moderator7'], 'B. Pardon');

		expect(lookup.get('@moderator7:oriso.org')).toBe('B. Pardon');
		expect(lookup.get('moderator7')).toBe('B. Pardon');
	});

	/**
	 * Under the fuzzy matcher a single supervisor lent their label — and with
	 * it the moderator icon — to everybody sharing the homeserver.
	 */
	it('does not hand a supervisor label to their homeserver neighbours', () => {
		const lookup = createIdentityLookup<string>();
		lookup.set(['@moderator7:oriso.org'], 'B. Pardon');

		expect(lookup.get('@consultant42:oriso.org')).toBeUndefined();
		expect(lookup.get('@enc.katze_mika:oriso.org')).toBeUndefined();
	});

	it('keeps the first label written for an identity', () => {
		const lookup = createIdentityLookup<string>();
		lookup.set(['moderator7'], 'B. Pardon');
		lookup.set(['moderator7'], 'raw-id-fallback');

		expect(lookup.get('moderator7')).toBe('B. Pardon');
	});

	it('ignores empty ids', () => {
		const lookup = createIdentityLookup<string>();
		lookup.set([null, undefined, '  '], 'nobody');

		expect(lookup.size).toBe(0);
		expect(lookup.get('')).toBeUndefined();
	});
});
