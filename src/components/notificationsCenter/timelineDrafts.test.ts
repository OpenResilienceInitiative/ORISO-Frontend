import { describe, expect, it } from 'vitest';
import {
	draftsToFeedItems,
	isTimelineDraftId,
	mergeDraftsIntoFeed,
	toNonEmbeddedPath
} from './timelineDrafts';
import { REMOTE_DRAFT_INDEX_SCOPE } from '../../services/draftStore';
import type { NotificationFeedItem } from '../../globalState/provider/NotificationsProvider';

const serverItem = (id: string, createdAt: string): NotificationFeedItem => ({
	id,
	type: 'info',
	title: '',
	text: '',
	eventType: 'message.new',
	category: 'message',
	createdAt
});

describe('timeline drafts (#1535)', () => {
	it('turns a draft into a read, content-free card that resumes the draft', () => {
		const [item] = draftsToFeedItems([
			{
				scopeKey: 'scope:!room:x|thread:main',
				text: 'secret ciphertext',
				title: 'Marge Bouvier',
				actionPath:
					'/sessions/consultant/sessionView/session/73?embeddedNotifications=1&draftScopeKey=old',
				sourceSessionId: 73,
				roomRef: '!room:x',
				updatedAt: '2026-09-07T00:00:00Z'
			}
		]);
		expect(item).toMatchObject({
			eventType: 'draft.created',
			title: '',
			text: '',
			createdAt: '2026-09-07T00:00:00Z',
			readAt: '2026-09-07T00:00:00Z',
			sourceSessionId: '73',
			params: { forcedScopeKey: 'scope:!room:x|thread:main' }
		});
		expect(item.actionPath).toBe(
			'/sessions/consultant/sessionView/session/73?draftScopeKey=scope%3A%21room%3Ax%7Cthread%3Amain'
		);
		expect(isTimelineDraftId(item.id)).toBe(true);
		expect(JSON.stringify(item)).not.toContain('secret');
		expect(JSON.stringify(item)).not.toContain('Marge');
	});

	it('falls back to the drafts page when the draft has no path', () => {
		const [item] = draftsToFeedItems([{ scopeKey: 'k', text: 'x' }]);
		expect(item.actionPath).toBe('/drafts?draftScopeKey=k');
	});

	it('skips index bookkeeping and empty editors', () => {
		expect(
			draftsToFeedItems([
				{ scopeKey: REMOTE_DRAFT_INDEX_SCOPE, text: 'index' },
				{ scopeKey: 'empty', text: '<p><br></p>' }
			])
		).toEqual([]);
	});

	it('merges drafts into the server feed newest first', () => {
		const feed = [
			serverItem('a', '2026-09-07T03:00:00Z'),
			serverItem('b', '2026-09-07T01:00:00Z')
		];
		const drafts = draftsToFeedItems([
			{ scopeKey: 'k', text: 'x', updatedAt: '2026-09-07T02:00:00Z' }
		]);
		expect(mergeDraftsIntoFeed(feed, drafts).map((i) => i.id)).toEqual([
			'a',
			drafts[0].id,
			'b'
		]);
		expect(mergeDraftsIntoFeed(feed, [])).toBe(feed);
		expect(isTimelineDraftId('a')).toBe(false);
	});
});

describe('toNonEmbeddedPath', () => {
	it.each([
		[null, null],
		['/sessions/1', '/sessions/1'],
		['/sessions/1?embeddedNotifications=1', '/sessions/1'],
		['/s?a=1&embeddedNotifications=1', '/s?a=1']
	])('%s -> %s', (path, expected) => {
		expect(toNonEmbeddedPath(path)).toBe(expected);
	});
});
