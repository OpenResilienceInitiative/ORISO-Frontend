// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GroupChatSeriesFields } from './GroupChatSeriesFields';

const translations: Record<string, string> = {
	'groupChat.create.schedule': 'Schedule',
	'groupChat.create.startDate': 'Start date',
	'groupChat.create.startTime': 'Start time',
	'groupChat.create.duration': 'Duration',
	'groupChat.create.repeatCount': 'Occurrences',
	'groupChat.create.interval.label': 'Interval',
	'groupChat.create.modality.label': 'Format',
	'groupChat.create.interval.options.daily': 'Daily',
	'groupChat.create.interval.options.weekly': 'Weekly',
	'groupChat.create.interval.options.biweekly': 'Every two weeks',
	'groupChat.create.interval.options.monthly': 'Monthly',
	'groupChat.create.interval.options.quarterly': 'Quarterly',
	'groupChat.create.interval.options.yearly': 'Yearly',
	'groupChat.create.modality.options.text': 'Text',
	'groupChat.create.modality.options.audio': 'Audio',
	'groupChat.create.modality.options.video': 'Video',
	'groupChat.create.durationSelect.option1': '30 minutes',
	'groupChat.create.durationSelect.option2': '1 hour',
	'groupChat.create.durationSelect.option3': '1.5 hours',
	'groupChat.create.durationSelect.option4': '2 hours',
	'groupChat.create.durationSelect.option5': '2.5 hours',
	'groupChat.create.durationSelect.option6': '3 hours'
};

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => translations[key] ?? key
	})
}));

describe('GroupChatSeriesFields', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-07-10T12:00:00Z'));
	});
	afterEach(() => vi.useRealTimers());

	it('uses translated controls and keeps interval disabled for one occurrence', () => {
		const onChange = vi.fn();
		render(
			<GroupChatSeriesFields
				value={{
					startDate: '2026-08-04',
					startTime: '18:00',
					duration: 60,
					repeatCount: 1,
					interval: 'WEEKLY',
					modality: 'TEXT'
				}}
				onChange={onChange}
			/>
		);

		const interval = screen.getByRole('combobox', { name: 'Interval' });
		expect(interval.getAttribute('aria-disabled')).toBe('true');
		fireEvent.keyDown(interval, { key: 'ArrowDown' });
		expect(onChange).not.toHaveBeenCalled();

		fireEvent.change(screen.getByLabelText('Start date'), {
			target: { value: '2026-08-05' }
		});
		expect(onChange).toHaveBeenCalledWith(
			expect.objectContaining({ startDate: '2026-08-05' })
		);
		expect(screen.getByLabelText('Start date').getAttribute('min')).toBe(
			'2026-07-10'
		);

		const repeatCount = screen.getByLabelText(
			'Occurrences'
		) as HTMLInputElement;
		fireEvent.change(repeatCount, {
			target: { value: '0' }
		});
		expect(repeatCount.value).toBe('0');
		fireEvent.blur(repeatCount);
		expect(onChange).toHaveBeenLastCalledWith(
			expect.objectContaining({ repeatCount: 1 })
		);

		fireEvent.change(repeatCount, {
			target: { value: '500' }
		});
		expect(repeatCount.value).toBe('500');
		fireEvent.blur(repeatCount);
		expect(onChange).toHaveBeenLastCalledWith(
			expect.objectContaining({ repeatCount: 365 })
		);
	});
});
