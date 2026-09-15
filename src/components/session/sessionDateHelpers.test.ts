import { describe, expect, it } from 'vitest';
import {
	getGroupChatDate,
	getGroupChatTimezoneSuffix
} from './sessionDateHelpers';

// Derived from the runner's own zone rather than stubbed, so these hold on any
// machine and in CI: one zone that is the reader's, one that certainly is not.
const VIEWER_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;
const FOREIGN_ZONE =
	VIEWER_ZONE === 'Europe/Berlin' ? 'America/New_York' : 'Europe/Berlin';

const groupChat = (extra: Record<string, unknown> = {}) => ({
	startDate: '2019-10-23T00:00:00.000Z',
	startTime: '18:00',
	duration: 60,
	repetitive: false,
	...extra
});

describe('getGroupChatTimezoneSuffix', () => {
	it('says nothing when the group carries no timezone', () => {
		expect(getGroupChatTimezoneSuffix(undefined)).toBe('');
		expect(getGroupChatTimezoneSuffix('')).toBe('');
	});

	it('says nothing when the group sits in the reader own zone', () => {
		expect(getGroupChatTimezoneSuffix(VIEWER_ZONE)).toBe('');
	});

	it('names the city when the group is somewhere else (#1293)', () => {
		expect(getGroupChatTimezoneSuffix(FOREIGN_ZONE)).toBe(
			FOREIGN_ZONE === 'Europe/Berlin' ? ' (Berlin)' : ' (New York)'
		);
	});

	it('reads an underscored zone as a human city name', () => {
		// Only meaningful when the runner is not itself in New York.
		if (VIEWER_ZONE === 'America/New_York') {
			return;
		}
		expect(getGroupChatTimezoneSuffix('America/New_York')).toBe(
			' (New York)'
		);
	});
});

describe('getGroupChatDate carries the timezone into what the reader sees', () => {
	it('appends the zone to the start time of a group elsewhere (#1293)', () => {
		const value = getGroupChatDate(
			groupChat({ timezone: FOREIGN_ZONE }),
			'Uhr',
			false,
			false,
			true
		);
		expect(value).toContain('18:00 Uhr');
		expect(value).toContain(
			getGroupChatTimezoneSuffix(FOREIGN_ZONE).trim()
		);
	});

	it('leaves the start time alone for a group in the reader own zone', () => {
		expect(
			getGroupChatDate(
				groupChat({ timezone: VIEWER_ZONE }),
				'Uhr',
				false,
				false,
				true
			)
		).toBe('18:00 Uhr');
	});

	it('leaves the start time alone when no timezone is stored', () => {
		expect(getGroupChatDate(groupChat(), 'Uhr', false, false, true)).toBe(
			'18:00 Uhr'
		);
	});

	it('never puts a zone on the date-only row, which shows no time', () => {
		expect(
			getGroupChatDate(
				groupChat({ timezone: FOREIGN_ZONE }),
				'Uhr',
				false,
				true,
				false
			)
		).not.toContain('(');
	});

	it('appends the zone once to the full date and time range', () => {
		const value = getGroupChatDate(
			groupChat({ timezone: FOREIGN_ZONE }),
			'Uhr'
		);
		const suffix = getGroupChatTimezoneSuffix(FOREIGN_ZONE);
		expect(value.endsWith(suffix)).toBe(true);
		expect(value.split(suffix.trim()).length - 1).toBe(1);
	});
});
