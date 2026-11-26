import { describe, expect, it } from 'vite-plus/test';
import {
	parseSupervisorReplacedNotice,
	supervisorReplacedNoticeText
} from './supervisorReplacedNotice';
import { parseMessagePrefixes } from './messageConstants';

const translate = (key: string, options?: Record<string, unknown>) =>
	[key, ...Object.values(options ?? {})].join('|');

describe('supervisor replaced notice (#2494 *6)', () => {
	it('reads names and reason', () => {
		expect(
			parseSupervisorReplacedNotice({
				type: 'SUPERVISOR_REPLACED',
				previousName: ' Mona Simpson ',
				newName: 'Blinky Fish',
				reason: 'Urlaub'
			})
		).toEqual({
			previousName: 'Mona Simpson',
			newName: 'Blinky Fish',
			reason: 'Urlaub'
		});
	});

	it('rejects other types and missing names', () => {
		expect(
			parseSupervisorReplacedNotice({ type: 'CONSULTANT_RENAMED' })
		).toBeNull();
		expect(
			parseSupervisorReplacedNotice({
				type: 'SUPERVISOR_REPLACED',
				previousName: '',
				newName: 'Blinky Fish'
			})
		).toBeNull();
	});

	it('words it with and without a reason', () => {
		expect(
			supervisorReplacedNoticeText(
				{ previousName: 'Mona', newName: 'Blinky', reason: 'Urlaub' },
				translate
			)
		).toEqual({
			title: 'message.supervisionChangedTitle',
			description:
				'message.supervisionChangedDescription|Blinky|Mona message.supervisionChangedReason|Urlaub'
		});
		expect(
			supervisorReplacedNoticeText(
				{ previousName: 'Mona', newName: 'Blinky' },
				translate
			).description
		).toBe('message.supervisionChangedDescription|Blinky|Mona');
	});

	it('is parsed from the timeline body', () => {
		const parsed = parseMessagePrefixes(
			`[SYSTEM_NOTIFICATION]${JSON.stringify({
				type: 'SUPERVISOR_REPLACED',
				previousName: 'Mona',
				newName: 'Blinky'
			})}`
		);
		expect(parsed.isSystemNotification).toBe(true);
		expect(parsed.systemNotificationSupervisorReplaced).toEqual({
			previousName: 'Mona',
			newName: 'Blinky'
		});
	});
	it('does not end the sentence twice after a short name', () => {
		const t = (key: string, o?: Record<string, unknown>) =>
			key === 'message.supervisionChangedDescription'
				? `${o?.name} now supervises this chat in place of ${o?.from}.`
				: key;
		expect(
			supervisorReplacedNoticeText(
				{ previousName: 'Clara C.', newName: 'Bettina B.' },
				t
			).description
		).toBe('Bettina B. now supervises this chat in place of Clara C.');
	});
});
