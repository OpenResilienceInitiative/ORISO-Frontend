import { describe, expect, it } from 'vitest';
import { getGroupChatRepeatLabel } from './groupChatRepeatLabel';

// Identity translator that also shows the interpolation, so the assertions
// see which key and which values were used.
const translate = (key: string, options?: Record<string, unknown>) =>
	options ? `${key}(${JSON.stringify(options)})` : key;

describe('getGroupChatRepeatLabel (Chat-Info + share dialog, #1499)', () => {
	it('names the real interval and the number of dates of a series', () => {
		expect(
			getGroupChatRepeatLabel(
				{ repeatCount: 3, chatInterval: 'BIWEEKLY' },
				translate
			)
		).toBe(
			'groupChat.shareDialog.repeatValue({"count":3,"interval":"groupChat.create.interval.options.biweekly"})'
		);
	});

	it('does not call a monthly series weekly', () => {
		expect(
			getGroupChatRepeatLabel(
				{ repeatCount: 6, chatInterval: 'MONTHLY', repetitive: true },
				translate
			)
		).toContain('groupChat.create.interval.options.monthly');
	});

	it('shows a one-off group as a single date', () => {
		expect(
			getGroupChatRepeatLabel(
				{ repeatCount: 1, chatInterval: null, repetitive: false },
				translate
			)
		).toBe('groupChat.info.settings.repetition.single');
	});

	it('falls back to weekly for a legacy repetitive chat without an interval', () => {
		expect(getGroupChatRepeatLabel({ repetitive: true }, translate)).toBe(
			'groupChat.info.settings.repetition.weekly'
		);
	});
});
