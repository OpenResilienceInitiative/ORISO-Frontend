import { describe, expect, it } from 'vitest';
import { buildNeutralGroupChatCalendar } from './groupChatCalendar';

describe('buildNeutralGroupChatCalendar', () => {
	it('creates content-neutral ICS and provider URLs', () => {
		const calendar = buildNeutralGroupChatCalendar({
			start: new Date('2026-08-04T18:00:00Z'),
			durationMinutes: 60,
			title: 'Online appointment'
		});

		expect(calendar.ics).toContain('SUMMARY:Online appointment');
		expect(calendar.ics).not.toMatch(/support|oriso|sucht/i);
		expect(calendar.googleUrl).toContain('calendar.google.com');
		expect(calendar.outlookUrl).toContain('outlook.live.com');
	});
});
