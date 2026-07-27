/**
 * FE#514 — pure logic of the Team-Besprechung panel (ADR-016 scope rules +
 * timeline mapping).
 */
import { describe, expect, it } from 'vitest';
import {
	isTeamDiscussionAvailable,
	mapTimelineToDiscussionMessages,
	matrixLocalpart,
	TimelineEventLike
} from './teamDiscussionHelpers';

const event = (
	id: string,
	sender: string,
	body: string,
	ts: number,
	type = 'm.room.message',
	msgtype = 'm.text'
): TimelineEventLike => ({
	getId: () => id,
	getType: () => type,
	getSender: () => sender,
	getTs: () => ts,
	getContent: () => ({ msgtype, body })
});

describe('isTeamDiscussionAvailable', () => {
	const base = {
		isConsultant: true,
		isEnquiry: true,
		isGroup: false,
		isAnonymous: false,
		featureEnabled: true,
		hasExistingDiscussion: false
	};

	it('is available for a consultant on an open registered enquiry', () => {
		expect(isTeamDiscussionAvailable(base)).toBe(true);
	});

	it('is never available for askers', () => {
		expect(
			isTeamDiscussionAvailable({ ...base, isConsultant: false })
		).toBe(false);
	});

	it('is excluded for live chat (anonymous) and groups per ADR-016', () => {
		expect(isTeamDiscussionAvailable({ ...base, isAnonymous: true })).toBe(
			false
		);
		expect(isTeamDiscussionAvailable({ ...base, isGroup: true })).toBe(
			false
		);
	});

	it('is off when the tenant feature toggle is off', () => {
		expect(
			isTeamDiscussionAvailable({ ...base, featureEnabled: false })
		).toBe(false);
	});

	it('stays reachable read-only after acceptance when a discussion exists', () => {
		expect(
			isTeamDiscussionAvailable({
				...base,
				isEnquiry: false,
				hasExistingDiscussion: true
			})
		).toBe(true);
	});

	it('cannot be started on an accepted case without existing discussion', () => {
		expect(isTeamDiscussionAvailable({ ...base, isEnquiry: false })).toBe(
			false
		);
	});
});

describe('mapTimelineToDiscussionMessages', () => {
	it('maps text messages chronologically and marks own messages', () => {
		const messages = mapTimelineToDiscussionMessages(
			[
				event('$2', '@kim:oriso', 'second', 200),
				event('$1', '@me:oriso', 'first', 100)
			],
			'@me:oriso'
		);

		expect(messages.map((m) => m.body)).toEqual(['first', 'second']);
		expect(messages[0].isOwn).toBe(true);
		expect(messages[1].isOwn).toBe(false);
		expect(messages[1].senderDisplayName).toBe('kim');
	});

	it('skips non-message and non-text events and deduplicates by id', () => {
		const messages = mapTimelineToDiscussionMessages(
			[
				event('$1', '@kim:oriso', 'hello', 100),
				event('$1', '@kim:oriso', 'hello', 100),
				event('$3', '@kim:oriso', '', 300),
				event('$4', '@kim:oriso', 'x', 400, 'm.room.member'),
				event(
					'$5',
					'@kim:oriso',
					'img',
					500,
					'm.room.message',
					'm.image'
				)
			],
			null
		);

		expect(messages).toHaveLength(1);
		expect(messages[0].id).toBe('$1');
	});

	it('uses a display-name resolver when provided', () => {
		const messages = mapTimelineToDiscussionMessages(
			[event('$1', '@kim:oriso', 'hello', 100)],
			null,
			() => 'Kim Gerlander'
		);

		expect(messages[0].senderDisplayName).toBe('Kim Gerlander');
	});
});

describe('matrixLocalpart', () => {
	it('strips sigil and server name', () => {
		expect(matrixLocalpart('@kim:oriso.example')).toBe('kim');
		expect(matrixLocalpart('kim')).toBe('kim');
	});
});
