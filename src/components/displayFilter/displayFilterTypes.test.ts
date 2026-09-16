import { describe, expect, it } from 'vitest';
import {
	EMPTY_DISPLAY_FILTER,
	OTHER_KIND_ID,
	isDisplayFilterCustomised,
	reconcileActiveKind,
	resolveKindSetting,
	setKindSetting,
	visiblePillKinds,
	orderChipKinds
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
		expect(visiblePillKinds(hidden, kinds, null).map((k) => k.id)).toEqual(
			['requests']
		);
	});

	it('auto-sort floats kinds with unread items to the left, otherwise keeps the section order', () => {
		const kinds = [
			{ id: 'unread', label: 'Ungelesen', unreadCount: 0 },
			{ id: 'nearby', label: 'Mail', unreadCount: 2 },
			{ id: 'liveChat', label: 'Live-Chat', unreadCount: 0 },
			{ id: 'circle', label: 'Gesprächskreis', unreadCount: 1 }
		];
		expect(orderChipKinds(kinds, { autoSort: false }).map((k) => k.id)).toEqual(
			['unread', 'nearby', 'liveChat', 'circle']
		);
		// Stable among the unread ones and among the rest.
		expect(orderChipKinds(kinds, { autoSort: true }).map((k) => k.id)).toEqual(
			['nearby', 'circle', 'unread', 'liveChat']
		);
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
