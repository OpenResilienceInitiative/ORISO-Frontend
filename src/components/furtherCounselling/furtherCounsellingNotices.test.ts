import { describe, expect, it } from 'vite-plus/test';
import {
	FURTHER_COUNSELLING_NOTE_MAX_LENGTH,
	FURTHER_COUNSELLING_RECOMMENDED,
	isFurtherCounsellingNoticeType,
	parseFurtherCounsellingNotice,
	TOPIC_DUPLICATE_ENDED,
	TOPIC_DUPLICATE_STARTED
} from './furtherCounsellingNotices';
import { parseMessagePrefixes } from '../message/messageConstants';

const body = (payload: unknown) =>
	`[SYSTEM_NOTIFICATION]${JSON.stringify(payload)}`;

describe('parseFurtherCounsellingNotice', () => {
	it('reads a recommendation with note and author', () => {
		expect(
			parseFurtherCounsellingNotice({
				type: FURTHER_COUNSELLING_RECOMMENDED,
				topicId: 7,
				note: 'Bitte melden Sie sich dort.',
				recommendedBy: 'consultant-1',
				createdAt: '2026-10-28T10:00:00Z'
			})
		).toEqual({
			type: FURTHER_COUNSELLING_RECOMMENDED,
			topicId: 7,
			note: 'Bitte melden Sie sich dort.',
			recommendedBy: 'consultant-1',
			createdAt: '2026-10-28T10:00:00Z'
		});
	});

	it('treats a missing, null or blank note as no note', () => {
		for (const note of [undefined, null, '   ']) {
			expect(
				parseFurtherCounsellingNotice({
					type: FURTHER_COUNSELLING_RECOMMENDED,
					topicId: 7,
					note,
					createdAt: '2026-10-28T10:00:00Z'
				})
			).toMatchObject({ note: null, recommendedBy: null });
		}
	});

	it('cuts an over-long note to the contract limit', () => {
		const notice = parseFurtherCounsellingNotice({
			type: FURTHER_COUNSELLING_RECOMMENDED,
			topicId: 7,
			note: 'x'.repeat(FURTHER_COUNSELLING_NOTE_MAX_LENGTH + 50)
		});
		expect(
			notice?.type === FURTHER_COUNSELLING_RECOMMENDED && notice.note
		).toHaveLength(FURTHER_COUNSELLING_NOTE_MAX_LENGTH);
	});

	it('accepts a numeric string topic id but rejects anything else', () => {
		expect(
			parseFurtherCounsellingNotice({
				type: TOPIC_DUPLICATE_ENDED,
				topicId: '12'
			})
		).toEqual({ type: TOPIC_DUPLICATE_ENDED, topicId: 12 });
		for (const topicId of [undefined, 0, -3, 1.5, 'abc', {}]) {
			expect(
				parseFurtherCounsellingNotice({
					type: TOPIC_DUPLICATE_ENDED,
					topicId
				})
			).toBeNull();
		}
	});

	it('reads the duplicate-started notice by its topic alone', () => {
		expect(
			parseFurtherCounsellingNotice({
				type: TOPIC_DUPLICATE_STARTED,
				topicId: 3
			})
		).toEqual({ type: TOPIC_DUPLICATE_STARTED, topicId: 3 });
	});

	it('drops a new session id an older backend still sends', () => {
		// The old room must learn nothing about the new conversation.
		expect(
			parseFurtherCounsellingNotice({
				type: TOPIC_DUPLICATE_STARTED,
				topicId: 3,
				newSessionId: 99
			})
		).toEqual({ type: TOPIC_DUPLICATE_STARTED, topicId: 3 });
	});

	it('ignores other notice types and non-objects', () => {
		expect(
			parseFurtherCounsellingNotice({
				type: 'INQUIRY_ACCEPTED',
				topicId: 1
			})
		).toBeNull();
		expect(parseFurtherCounsellingNotice(null)).toBeNull();
		expect(parseFurtherCounsellingNotice('FURTHER')).toBeNull();
	});

	it('knows its own types', () => {
		expect(isFurtherCounsellingNoticeType(TOPIC_DUPLICATE_STARTED)).toBe(
			true
		);
		expect(isFurtherCounsellingNoticeType('USER_LEFT_CHAT')).toBe(false);
		expect(isFurtherCounsellingNoticeType(null)).toBe(false);
	});
});

describe('parseMessagePrefixes carries the further-counselling notice', () => {
	it('exposes the parsed notice on a system notification', () => {
		const parsed = parseMessagePrefixes(
			body({
				type: FURTHER_COUNSELLING_RECOMMENDED,
				topicId: 7,
				note: null,
				createdAt: '2026-10-28T10:00:00Z'
			})
		);
		expect(parsed.isSystemNotification).toBe(true);
		expect(parsed.systemNotificationType).toBe(
			FURTHER_COUNSELLING_RECOMMENDED
		);
		expect(parsed.systemNotificationFurtherCounselling).toMatchObject({
			type: FURTHER_COUNSELLING_RECOMMENDED,
			topicId: 7
		});
	});

	it('leaves it empty for other system notifications and plain text', () => {
		expect(
			parseMessagePrefixes(body({ type: 'USER_LEFT_CHAT' }))
				.systemNotificationFurtherCounselling
		).toBeNull();
		expect(
			parseMessagePrefixes('Hallo').systemNotificationFurtherCounselling
		).toBeNull();
		expect(
			parseMessagePrefixes(null).systemNotificationFurtherCounselling
		).toBeNull();
	});
});
