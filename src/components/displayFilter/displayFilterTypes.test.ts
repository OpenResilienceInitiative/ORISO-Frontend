import { describe, expect, it } from 'vitest';
import {
	EMPTY_DISPLAY_FILTER,
	OTHER_KIND_ID,
	isDisplayFilterCustomised,
	reconcileActiveKind,
	resolveKindSetting,
	setKindSetting,
	visiblePillKinds,
	orderChipKinds,
	resolveKindAvailability,
	listedKinds,
	kindsUnderOther,
	matchesOtherChip,
	isKindMuted,
	kindSoundOverride,
	kindPillMode,
	isKindPinned
} from './displayFilterTypes';

describe('displayFilterTypes (#1377)', () => {
	it('defaults every kind to shown with a pill', () => {
		expect(resolveKindSetting(EMPTY_DISPLAY_FILTER, 'messages')).toEqual({
			show: true,
			pill: true
		});
		expect(
			isDisplayFilterCustomised(EMPTY_DISPLAY_FILTER, ['messages'])
		).toBe(false);
	});

	it('never hides the catch-all "other" kind', () => {
		const value = setKindSetting(EMPTY_DISPLAY_FILTER, OTHER_KIND_ID, {
			show: false
		});
		expect(resolveKindSetting(value, OTHER_KIND_ID).show).toBe(true);
		const tampered = {
			kinds: { other: { show: false, pill: true } },
			autoReadHidden: false
		};
		expect(resolveKindSetting(tampered, OTHER_KIND_ID)).toEqual({
			show: true,
			pill: true
		});
	});

	it('drops the pill while a kind is hidden and brings it back on re-show', () => {
		const hidden = setKindSetting(EMPTY_DISPLAY_FILTER, 'drafts', {
			show: false
		});
		expect(resolveKindSetting(hidden, 'drafts')).toEqual({
			show: false,
			pill: false
		});
		// Frank, 2026-09-16: hide → show must be a no-op for the pill. The
		// user never touched the Pille switch, so it must not stay off.
		const shownAgain = setKindSetting(hidden, 'drafts', { show: true });
		expect(resolveKindSetting(shownAgain, 'drafts')).toEqual({
			show: true,
			pill: true
		});
		expect(isDisplayFilterCustomised(shownAgain, ['drafts'])).toBe(false);
	});

	it('keeps a pill the user switched off across hide → show', () => {
		const pillOff = setKindSetting(EMPTY_DISPLAY_FILTER, 'drafts', {
			pill: false
		});
		const hidden = setKindSetting(pillOff, 'drafts', { show: false });
		const shownAgain = setKindSetting(hidden, 'drafts', { show: true });
		expect(resolveKindSetting(shownAgain, 'drafts')).toEqual({
			show: true,
			pill: false
		});
	});

	it('counts profile-owned partial hiding as customised', () => {
		expect(
			isDisplayFilterCustomised(EMPTY_DISPLAY_FILTER, [
				{ id: 'messages', partial: true }
			])
		).toBe(true);
		expect(
			isDisplayFilterCustomised(EMPTY_DISPLAY_FILTER, [
				{ id: 'messages', partial: false }
			])
		).toBe(false);
	});

	it('never yields a chip for a show-only kind', () => {
		const kinds = [
			{
				id: 'futureTimeline',
				label: 'Zukunft',
				unreadCount: 3,
				showOnly: true
			}
		];
		expect(
			visiblePillKinds(EMPTY_DISPLAY_FILTER, kinds, 'futureTimeline')
		).toEqual([]);
	});

	it('ignores the pill state of a show-only kind', () => {
		const kind = { id: 'futureTimeline', showOnly: true };
		const hidden = setKindSetting(EMPTY_DISPLAY_FILTER, kind.id, {
			show: false
		});
		expect(isDisplayFilterCustomised(hidden, [kind])).toBe(true);
		// hide → show keeps the pill intent, so nothing is left behind —
		// neither for the show-only option nor for the bare id.
		const shownAgain = setKindSetting(hidden, kind.id, { show: true });
		expect(isDisplayFilterCustomised(shownAgain, [kind])).toBe(false);
		expect(isDisplayFilterCustomised(shownAgain, [kind.id])).toBe(false);
	});

	it('marks auto-read alone as customised', () => {
		expect(
			isDisplayFilterCustomised(
				{ ...EMPTY_DISPLAY_FILTER, autoReadHidden: true },
				[]
			)
		).toBe(true);
	});

	it('renders a chip for every shown kind whose pill is on (Frank 2026-09-16: the chip is a menu entry, unread is a badge)', () => {
		const kinds = [
			{ id: 'requests', label: 'Anfragen', unreadCount: 2 },
			{ id: 'messages', label: 'Nachrichten', unreadCount: 0 },
			{ id: 'drafts', label: 'Entwürfe', unreadCount: 5 }
		];
		const value = setKindSetting(EMPTY_DISPLAY_FILTER, 'drafts', {
			pill: false
		});
		// 0 unread keeps the chip; a switched-off pill removes it.
		expect(visiblePillKinds(value, kinds, null).map((k) => k.id)).toEqual([
			'requests',
			'messages'
		]);
		// A hidden kind has no chip either.
		const hidden = setKindSetting(value, 'messages', { show: false });
		expect(visiblePillKinds(hidden, kinds, null).map((k) => k.id)).toEqual([
			'requests'
		]);
	});

	it('auto-sort floats kinds with unread items to the left, otherwise keeps the section order', () => {
		const kinds = [
			{ id: 'unread', label: 'Ungelesen', unreadCount: 0 },
			{ id: 'nearby', label: 'Mail', unreadCount: 2 },
			{ id: 'liveChat', label: 'Live-Chat', unreadCount: 0 },
			{ id: 'circle', label: 'Gesprächskreis', unreadCount: 1 }
		];
		expect(
			orderChipKinds(kinds, { autoSort: false }).map((k) => k.id)
		).toEqual(['unread', 'nearby', 'liveChat', 'circle']);
		// Stable among the unread ones and among the rest.
		expect(
			orderChipKinds(kinds, { autoSort: true }).map((k) => k.id)
		).toEqual(['nearby', 'circle', 'unread', 'liveChat']);
	});

	it('clears the active kind once its pill is gone', () => {
		expect(reconcileActiveKind(EMPTY_DISPLAY_FILTER, 'messages')).toBe(
			'messages'
		);
		const pillOff = setKindSetting(EMPTY_DISPLAY_FILTER, 'messages', {
			pill: false
		});
		expect(reconcileActiveKind(pillOff, 'messages')).toBeNull();
		const hidden = setKindSetting(EMPTY_DISPLAY_FILTER, 'messages', {
			show: false
		});
		expect(reconcileActiveKind(hidden, 'messages')).toBeNull();
		expect(reconcileActiveKind(hidden, null)).toBeNull();
	});
});

describe('kind availability under the Träger feature switch (Frank 2026-09-16)', () => {
	it('is available while the format is enabled', () => {
		expect(
			resolveKindAvailability({ formatEnabled: true, rowCount: 0 })
		).toBe('available');
	});

	it('is absent when the format is off and nothing of that kind exists', () => {
		expect(
			resolveKindAvailability({ formatEnabled: false, rowCount: 0 })
		).toBe('absent');
	});

	it('is deactivated when the format is off but rows still exist — nothing may vanish silently', () => {
		expect(
			resolveKindAvailability({ formatEnabled: false, rowCount: 3 })
		).toBe('deactivated');
	});

	it('lists available and deactivated kinds, drops absent ones', () => {
		const kinds = [
			{
				id: 'oneToOne',
				label: 'Mail',
				availability: 'available' as const
			},
			{
				id: 'circle',
				label: 'Gesprächskreis',
				availability: 'deactivated' as const
			},
			{
				id: 'internalGroup',
				label: 'Intern',
				availability: 'absent' as const
			}
		];
		expect(listedKinds(kinds).map((k) => k.id)).toEqual([
			'oneToOne',
			'circle'
		]);
	});
});

describe('Sonstiges bundles the kinds without their own pill (Frank 2026-09-16)', () => {
	const kinds = [
		{ id: 'requests', label: 'Anfragen', unreadCount: 2 },
		{ id: 'messages', label: 'Nachrichten', unreadCount: 5 },
		{ id: 'drafts', label: 'Entwürfe', unreadCount: 1 },
		{
			id: 'futureTimeline',
			label: 'Termine',
			unreadCount: 0,
			showOnly: true
		},
		{ id: OTHER_KIND_ID, label: 'Sonstiges', unreadCount: 3 }
	];

	it('never bundles a pill-only kind (Archiv, Erstellen, Ungelesen, Entwürfe): they have no rows to hold', () => {
		const kinds = [
			{ id: 'oneToOne', label: 'Mail' },
			{ id: 'archive', label: 'Archiviert', pillOnly: true },
			{ id: 'create', label: 'Chat erstellen', pillOnly: true },
			{ id: OTHER_KIND_ID, label: 'Sonstiges' }
		];
		let value = setKindSetting(EMPTY_DISPLAY_FILTER, 'archive', {
			pill: false
		});
		value = setKindSetting(value, 'create', { pill: false });
		expect(kindsUnderOther(value, kinds)).toEqual([]);
		// so the bundle chip stays away as well
		expect(visiblePillKinds(value, kinds).map((kind) => kind.id)).toEqual([
			'oneToOne'
		]);
	});

	it('lists the shown kinds whose pill is off, never show-only or hidden ones', () => {
		let value = setKindSetting(EMPTY_DISPLAY_FILTER, 'messages', {
			pill: false
		});
		value = setKindSetting(value, 'drafts', { pill: false });
		value = setKindSetting(value, 'drafts', { show: false });
		expect(kindsUnderOther(value, kinds)).toEqual(['messages']);
		expect(kindsUnderOther(EMPTY_DISPLAY_FILTER, kinds)).toEqual([]);
	});

	it('adds their unread items to the Sonstiges chip', () => {
		const value = setKindSetting(EMPTY_DISPLAY_FILTER, 'messages', {
			pill: false
		});
		const chips = visiblePillKinds(value, kinds, null);
		const other = chips.find((k) => k.id === OTHER_KIND_ID)!;
		expect(other.unreadCount).toBe(8);
		expect(chips.map((k) => k.id)).toEqual([
			'requests',
			'drafts',
			OTHER_KIND_ID
		]);
		// nothing bundled → the plain count
		expect(
			visiblePillKinds(EMPTY_DISPLAY_FILTER, kinds, null).find(
				(k) => k.id === OTHER_KIND_ID
			)!.unreadCount
		).toBe(3);
	});

	it('tells whether a row kind belongs to the active Sonstiges chip', () => {
		const value = setKindSetting(EMPTY_DISPLAY_FILTER, 'messages', {
			pill: false
		});
		expect(matchesOtherChip(value, kinds, 'messages')).toBe(true);
		expect(matchesOtherChip(value, kinds, OTHER_KIND_ID)).toBe(true);
		expect(matchesOtherChip(value, kinds, 'requests')).toBe(false);
	});

	it('shows the bundle chip only when something is bundled or unmapped items are unread', () => {
		const quiet = kinds.map((k) =>
			k.id === OTHER_KIND_ID ? { ...k, unreadCount: 0 } : k
		);
		// nothing bundled, no unread unmapped → no Sonstiges chip
		expect(
			visiblePillKinds(EMPTY_DISPLAY_FILTER, quiet, null).map((k) => k.id)
		).not.toContain(OTHER_KIND_ID);
		// unread unmapped items → chip
		expect(
			visiblePillKinds(EMPTY_DISPLAY_FILTER, kinds, null).map((k) => k.id)
		).toContain(OTHER_KIND_ID);
		// something bundled → chip, even with 0 unmapped unread
		const value = setKindSetting(EMPTY_DISPLAY_FILTER, 'requests', {
			pill: false
		});
		expect(visiblePillKinds(value, quiet, null).map((k) => k.id)).toContain(
			OTHER_KIND_ID
		);
	});

	it('uses the chip label for the bundle chip when given', () => {
		const labelled = kinds.map((k) =>
			k.id === OTHER_KIND_ID ? { ...k, chipLabel: 'Weitere' } : k
		);
		const other = visiblePillKinds(
			EMPTY_DISPLAY_FILTER,
			labelled,
			null
		).find((k) => k.id === OTHER_KIND_ID)!;
		expect(other.chipLabel).toBe('Weitere');
	});
});

describe('sound per kind (Frank 2026-09-16: Ton statt In der Liste)', () => {
	it('defaults to sound on and stores a mute independently of show/pill', () => {
		expect(isKindMuted(EMPTY_DISPLAY_FILTER, 'oneToOne')).toBe(false);
		const muted = setKindSetting(EMPTY_DISPLAY_FILTER, 'oneToOne', {
			sound: 'none'
		});
		expect(muted.kinds.oneToOne).toEqual({
			show: true,
			pill: true,
			sound: 'none'
		});
		expect(resolveKindSetting(muted, 'oneToOne')).toEqual({
			show: true,
			pill: true
		});
		expect(isKindMuted(muted, 'oneToOne')).toBe(true);
		// a chosen tone is an override, not a mute; undefined = area default
		const toned = setKindSetting(EMPTY_DISPLAY_FILTER, 'oneToOne', {
			sound: 'ton-3'
		});
		expect(kindSoundOverride(toned, 'oneToOne')).toBe('ton-3');
		expect(isKindMuted(toned, 'oneToOne')).toBe(false);
		expect(
			kindSoundOverride(EMPTY_DISPLAY_FILTER, 'oneToOne')
		).toBeUndefined();
		// Frank 2026-09-16: the live-chat pill has modes — dynamic (default,
		// only stored when it differs), "bei Sitzung", or pinned ("fest")
		const pinned = setKindSetting(EMPTY_DISPLAY_FILTER, 'liveChat', {
			pillMode: 'fixed'
		});
		expect(pinned.kinds.liveChat).toEqual({
			show: true,
			pill: true,
			pillMode: 'fixed'
		});
		expect(kindPillMode(pinned, 'liveChat')).toBe('fixed');
		expect(isKindPinned(pinned, 'liveChat')).toBe(true);
		expect(isDisplayFilterCustomised(pinned, ['liveChat'])).toBe(true);
		const session = setKindSetting(pinned, 'liveChat', {
			pillMode: 'session'
		});
		expect(kindPillMode(session, 'liveChat')).toBe('session');
		expect(isKindPinned(session, 'liveChat')).toBe(false);
		expect(isDisplayFilterCustomised(session, ['liveChat'])).toBe(true);
		const dynamic = setKindSetting(session, 'liveChat', {
			pillMode: 'dynamic'
		});
		expect(dynamic.kinds.liveChat).toEqual({ show: true, pill: true });
		expect(kindPillMode(dynamic, 'liveChat')).toBe('dynamic');
		expect(kindPillMode(EMPTY_DISPLAY_FILTER, 'liveChat')).toBe('dynamic');
		expect(isKindMuted(muted, 'liveChat')).toBe(false);
		// a mute counts as customised (the button dot)
		expect(isDisplayFilterCustomised(muted, ['oneToOne'])).toBe(true);
	});
});
