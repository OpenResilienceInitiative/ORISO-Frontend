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

	it('drops the pill when a kind is hidden, and restores it independently', () => {
		const hidden = setKindSetting(EMPTY_DISPLAY_FILTER, 'drafts', {
			show: false
		});
		expect(resolveKindSetting(hidden, 'drafts')).toEqual({
			show: false,
			pill: false
		});
		const shownAgain = setKindSetting(hidden, 'drafts', { show: true });
		expect(resolveKindSetting(shownAgain, 'drafts')).toEqual({
			show: true,
			pill: false
		});
		expect(isDisplayFilterCustomised(shownAgain, ['drafts'])).toBe(true);
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
