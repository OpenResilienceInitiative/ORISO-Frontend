// @vitest-environment oriso-jsdom
import { describe, expect, it, vi } from 'vite-plus/test';
import {
	draftsToFeedItems,
	isTimelineDraftId,
	mergeDraftsIntoFeed,
	toNonEmbeddedPath
} from './timelineDrafts';
import { REMOTE_DRAFT_INDEX_SCOPE } from '../../services/draftStore';
import type { NotificationFeedItem } from '../../globalState/provider/NotificationsProvider';
import * as practiceMode from '../../practice/practiceMode';

const OPAQUE = 'draft.v1.' + 'a'.repeat(43);

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
				opaqueScopeKey: OPAQUE,
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
			params: { forcedScopeKey: OPAQUE }
		});
		expect(item.actionPath).toBe(
			`/sessions/consultant/sessionView/session/73?draftScopeKey=${OPAQUE}`
		);
		expect(isTimelineDraftId(item.id)).toBe(true);
		expect(JSON.stringify(item)).not.toContain('secret');
		expect(JSON.stringify(item)).not.toContain('Marge');
		expect(JSON.stringify(item)).not.toContain('!room:x');
		expect(item.params).toEqual({ forcedScopeKey: OPAQUE });
	});

	it('preserves the ordinary session channel while replacing the draft selector', () => {
		const [item] = draftsToFeedItems([
			{
				scopeKey: 'scope:!room:x|thread:$root',
				opaqueScopeKey: OPAQUE,
				text: 'draft',
				actionPath:
					'/sessions/user/view/session/73?channel=thread%3A%24root&draftScopeKey=legacy'
			}
		]);
		expect(item.actionPath).toBe(
			`/sessions/user/view/session/73?channel=thread%3A%24root&draftScopeKey=${OPAQUE}`
		);
	});

	it('falls back to the drafts page when the draft has no path', () => {
		const [item] = draftsToFeedItems([
			{ scopeKey: 'k', opaqueScopeKey: OPAQUE, text: 'x' }
		]);
		expect(item.actionPath).toBe(`/drafts?draftScopeKey=${OPAQUE}`);
	});

	it('skips index bookkeeping and empty editors', () => {
		expect(
			draftsToFeedItems([
				{ scopeKey: REMOTE_DRAFT_INDEX_SCOPE, text: 'index' },
				{
					scopeKey: 'empty',
					opaqueScopeKey: OPAQUE,
					text: '<p><br></p>'
				}
			])
		).toEqual([]);
	});

	it('never turns an invalid or missing opaque scope into a real route or card', () => {
		const legacy = {
			scopeKey: 'scope:!room:x|thread:$private',
			text: 'text',
			actionPath: '/sessions/user/view/session/73?draftScopeKey=old'
		};
		expect(
			draftsToFeedItems([
				legacy,
				{ ...legacy, opaqueScopeKey: legacy.scopeKey }
			])
		).toEqual([]);
		expect(
			draftsToFeedItems([
				{
					...legacy,
					opaqueScopeKey: OPAQUE,
					actionPath: '//other.example/path'
				}
			])
		).toEqual([]);
	});

	it('resumes only known practice scopes while the practice session is active', () => {
		const practice = {
			scopeKey: 'scope:-1|thread:main',
			text: 'practice text',
			actionPath: '/sessions/user/view/session/-1'
		};
		expect(draftsToFeedItems([practice])).toEqual([]);
		const state = vi
			.spyOn(practiceMode, 'getPracticeSnapshot')
			.mockReturnValue({
				status: 'active',
				session: { tourId: 'practice', runId: 1 }
			});
		try {
			expect(draftsToFeedItems([practice])[0]?.actionPath).toContain(
				'draftScopeKey=scope%3A-1'
			);
			expect(
				draftsToFeedItems([
					{
						...practice,
						actionPath: '/sessions/user/view/session/73'
					}
				])
			).toEqual([]);
		} finally {
			state.mockRestore();
		}
	});

	it('merges drafts into the server feed newest first', () => {
		const feed = [
			serverItem('a', '2026-09-07T03:00:00Z'),
			serverItem('b', '2026-09-07T01:00:00Z')
		];
		const drafts = draftsToFeedItems([
			{
				scopeKey: 'k',
				opaqueScopeKey: OPAQUE,
				text: 'x',
				updatedAt: '2026-09-07T02:00:00Z'
			}
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
