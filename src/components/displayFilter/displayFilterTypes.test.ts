import { describe, expect, it } from 'vitest';
import {
	EMPTY_DISPLAY_FILTER,
	OTHER_KIND_ID,
	isDisplayFilterCustomised,
	reconcileActiveKind,
	resolveKindSetting,
	setKindSetting,
	visiblePillKinds
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

	it('renders a pill only with unread items or when active', () => {
		const kinds = [
			{ id: 'requests', label: 'Anfragen', unreadCount: 2 },
			{ id: 'messages', label: 'Nachrichten', unreadCount: 0 },
			{ id: 'drafts', label: 'Entwürfe', unreadCount: 5 }
		];
		const value = setKindSetting(EMPTY_DISPLAY_FILTER, 'drafts', {
			pill: false
		});
		expect(visiblePillKinds(value, kinds, null).map((k) => k.id)).toEqual([
			'requests'
		]);
		expect(
			visiblePillKinds(value, kinds, 'messages').map((k) => k.id)
		).toEqual(['requests', 'messages']);
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
