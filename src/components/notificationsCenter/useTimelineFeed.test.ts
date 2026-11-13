// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vite-plus/test';
import { useTimelineFeed } from './useTimelineFeed';

const drafts = vi.hoisted(() => ({ current: [] as any[] }));
vi.mock('../../hooks/useTimelineDrafts', () => ({
	useTimelineDrafts: () => drafts.current
}));

const row = (id: string, createdAt: string): any => ({
	id,
	eventType: 'message.new',
	createdAt,
	readAt: null
});

describe('useTimelineFeed (#1535 / #1888: drafts join the list, not the provider)', () => {
	it('merges unsent drafts into the list', () => {
		drafts.current = [row('local-draft-13', '2026-10-28T11:00:00Z')];
		const { result } = renderHook(() =>
			useTimelineFeed([row('a', '2026-10-28T10:00:00Z')], vi.fn())
		);
		expect(result.current.feed.map((item) => item.id)).toEqual([
			'local-draft-13',
			'a'
		]);
	});

	it('never hands a draft to the provider to mark read', () => {
		drafts.current = [];
		const markServerRead = vi.fn();
		const { result } = renderHook(() =>
			useTimelineFeed([], markServerRead)
		);
		result.current.markRead('local-draft-13');
		result.current.markRead('a');
		expect(markServerRead.mock.calls).toEqual([['a']]);
	});
});
