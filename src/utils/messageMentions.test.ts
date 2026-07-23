/**
 * Intentional mentions (#435) — `m.mentions` pure helpers.
 *
 * Robust + E2EE-safe by construction: mentions are only ever extracted from
 * `data-mention-matrix-id` attributes that the composer populates from a
 * *resolved* Matrix room-member id (never a display name or a guess), and
 * `buildMentionsContent` only ever writes ids that already passed that
 * extraction. No display-name matching happens anywhere in this module.
 */

import { describe, it, expect } from 'vitest';
import {
	extractMentionedUserIds,
	buildMentionsContent,
	getMentionedUserIdsFromContent
} from './messageMentions';

describe('extractMentionedUserIds', () => {
	it('extracts resolved Matrix user ids from mention pill markup', () => {
		const html =
			'<p>Hallo <span class="messageItem__mention" data-mention-id="42" data-mention-matrix-id="@anna:matrix.oriso.org">@Anna</span>, bitte übernehmen</p>';
		expect(extractMentionedUserIds(html)).toEqual([
			'@anna:matrix.oriso.org'
		]);
	});

	it('dedupes the same mentioned user appearing twice', () => {
		const html =
			'<p><span data-mention-matrix-id="@anna:hs">@Anna</span> ... <span data-mention-matrix-id="@anna:hs">@Anna</span></p>';
		expect(extractMentionedUserIds(html)).toEqual(['@anna:hs']);
	});

	it('skips mention pills without a resolved matrix id (consultant not in room)', () => {
		const html =
			'<p><span class="messageItem__mention" data-mention-id="99">@NichtImChat</span></p>';
		expect(extractMentionedUserIds(html)).toEqual([]);
	});

	it('ignores a matrix id attribute that is not a well-formed Matrix user id', () => {
		const html =
			'<p><span data-mention-matrix-id="not-a-user-id">@x</span></p>';
		expect(extractMentionedUserIds(html)).toEqual([]);
	});

	it('returns an empty array for plain text with no mentions', () => {
		expect(extractMentionedUserIds('<p>hallo ohne mention</p>')).toEqual(
			[]
		);
		expect(extractMentionedUserIds('')).toEqual([]);
		expect(extractMentionedUserIds(undefined as any)).toEqual([]);
	});
});

describe('buildMentionsContent', () => {
	it('builds the m.mentions content fragment for the given user ids', () => {
		expect(buildMentionsContent(['@anna:hs', '@bob:hs'])).toEqual({
			'm.mentions': { user_ids: ['@anna:hs', '@bob:hs'] }
		});
	});

	it('returns an empty object (nothing to merge) when there are no mentions', () => {
		expect(buildMentionsContent([])).toEqual({});
		expect(buildMentionsContent(undefined as any)).toEqual({});
	});
});

describe('getMentionedUserIdsFromContent', () => {
	it('reads mentioned user ids from m.mentions on received event content', () => {
		expect(
			getMentionedUserIdsFromContent({
				'msgtype': 'm.text',
				'body': 'Hallo @Anna',
				'm.mentions': { user_ids: ['@anna:hs'] }
			})
		).toEqual(['@anna:hs']);
	});

	it('returns an empty array for content without m.mentions and junk shapes', () => {
		expect(getMentionedUserIdsFromContent({ body: 'x' })).toEqual([]);
		expect(getMentionedUserIdsFromContent(undefined)).toEqual([]);
		expect(
			getMentionedUserIdsFromContent({
				'm.mentions': { user_ids: 'not-an-array' }
			})
		).toEqual([]);
	});
});
