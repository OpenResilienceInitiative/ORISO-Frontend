// @vitest-environment oriso-jsdom
import * as React from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import dayjs from 'dayjs';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { OrisoTimePicker } from './OrisoTimePicker';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: 'de' }
	})
}));

afterEach(cleanup);

const typeAndLeave = (text: string) => {
	const onChange = vi.fn();
	const { container } = render(
		<OrisoTimePicker
			label="Beginn"
			ampm={false}
			value={dayjs(new Date(2026, 10, 25, 9, 0))}
			onChange={onChange}
		/>
	);
	const input = container.querySelector('input') as HTMLInputElement;
	fireEvent.change(input, { target: { value: text } });
	fireEvent.blur(input, { target: { value: text } });
	return onChange;
};

describe('OrisoTimePicker — typed without a colon (calendar test finding C9)', () => {
	it.each([
		['1030', 10, 30],
		['930', 9, 30],
		['10:30', 10, 30]
	])('reads "%s" as %i:%i', (text, hour, minute) => {
		const onChange = typeAndLeave(text);
		const value = onChange.mock.calls[0]?.[0];
		expect(value?.hour()).toBe(hour);
		expect(value?.minute()).toBe(minute);
	});

	it('keeps the old time for "2575"', () => {
		expect(typeAndLeave('2575')).not.toHaveBeenCalled();
	});
});
