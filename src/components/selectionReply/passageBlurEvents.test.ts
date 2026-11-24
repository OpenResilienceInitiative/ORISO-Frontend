import { describe, expect, it } from 'vitest';

import {
	buildPassageBlurContent,
	extractPassageBlurEvents,
	groupPassageBlurs,
	PASSAGE_BLUR_EVENT_TYPE,
	parsePassageBlurRemovedReason,
	passageBlurRemovedReason,
	withPassageBlurs
} from './passageBlurEvents';

const event = (
	id: string,
	content: Record<string, unknown>,
	{
		type = PASSAGE_BLUR_EVENT_TYPE,
		redacted = false,
		sender = '@mod:hs'
	} = {}
) => ({
	getType: () => type,
	getId: () => id,
	getSender: () => sender,
	getContent: () => content,
	isRedacted: () => redacted
});

describe('buildPassageBlurContent', () => {
	it('points at the message and holds only the position', () => {
		expect(
			buildPassageBlurContent('$msg', { start: 10, length: 92 })
		).toEqual({
			'm.relates_to': {
				rel_type: PASSAGE_BLUR_EVENT_TYPE,
				event_id: '$msg'
			},
			'start': 10,
			'length': 92
		});
	});
});

describe('extractPassageBlurEvents', () => {
	it('reads what was sent, with who blurred it', () => {
		const blurs = extractPassageBlurEvents([
			event(
				'$b1',
				buildPassageBlurContent('$msg', { start: 3, length: 7 })
			)
		]);
		expect(blurs).toEqual([
			{
				id: '$b1',
				targetEventId: '$msg',
				start: 3,
				length: 7,
				senderId: '@mod:hs'
			}
		]);
	});

	it('drops a removed (redacted) blur', () => {
		expect(
			extractPassageBlurEvents([
				event(
					'$b1',
					buildPassageBlurContent('$msg', { start: 3, length: 7 }),
					{ redacted: true }
				)
			])
		).toEqual([]);
	});

	it('ignores other events and malformed blurs', () => {
		const relates = {
			rel_type: PASSAGE_BLUR_EVENT_TYPE,
			event_id: '$msg'
		};
		expect(
			extractPassageBlurEvents([
				event('$r', { body: 'hi' }, { type: 'm.room.message' }),
				event('$a', {
					'm.relates_to': relates,
					'start': -1,
					'length': 3
				}),
				event('$b', {
					'm.relates_to': relates,
					'start': 1,
					'length': 0
				}),
				event('$c', {
					'm.relates_to': relates,
					'start': 1.5,
					'length': 2
				}),
				event('$d', {
					'm.relates_to': { ...relates, rel_type: 'm.annotation' },
					'start': 1,
					'length': 2
				}),
				event('$e', { start: 1, length: 2 })
			])
		).toEqual([]);
	});
});

describe('withPassageBlurs', () => {
	it('attaches each message its own blurs and leaves the rest alone', () => {
		const grouped = groupPassageBlurs(
			extractPassageBlurEvents([
				event(
					'$b1',
					buildPassageBlurContent('$m1', { start: 0, length: 4 })
				),
				event(
					'$b2',
					buildPassageBlurContent('$m1', { start: 9, length: 2 })
				)
			])
		);
		const plain = { _id: '$m2', message: 'other' };
		const [blurred, untouched] = withPassageBlurs(
			[{ _id: '$m1', message: 'blurred' }, plain],
			grouped
		);
		expect(blurred).toEqual({
			_id: '$m1',
			message: 'blurred',
			passageBlurs: [
				{ id: '$b1', start: 0, length: 4 },
				{ id: '$b2', start: 9, length: 2 }
			]
		});
		expect(untouched).toBe(plain);
	});
});

describe('passage blur removed reason (#2494 *9)', () => {
	it('round-trips the message id', () => {
		expect(
			parsePassageBlurRemovedReason(passageBlurRemovedReason('$msg:hs'))
		).toEqual({ targetEventId: '$msg:hs' });
	});

	it('reads the marker without a message id', () => {
		expect(
			parsePassageBlurRemovedReason('org.oriso.passage_blur.removed')
		).toEqual({ targetEventId: null });
	});

	it.each([undefined, '', 'spam', 'org.oriso.passage_blur'])(
		'is null for %j',
		(reason) => {
			expect(parsePassageBlurRemovedReason(reason)).toBeNull();
		}
	);
});
