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

describe('OrisoTimePicker — 30-minute steps (#2358)', () => {
	const renderStepping = (stepMinutes?: number) => {
		const onChange = vi.fn();
		const { container } = render(
			<OrisoTimePicker
				label="Beginn"
				ampm={false}
				value={dayjs(new Date(2026, 10, 25, 9, 0))}
				onChange={onChange}
				stepMinutes={stepMinutes}
			/>
		);
		const input = container.querySelector('input') as HTMLInputElement;
		const time = () => onChange.mock.calls[0]?.[0]?.format('HH:mm');
		return { input, onChange, time };
	};

	it.each([
		['ArrowUp', '09:30'],
		['ArrowDown', '08:30']
	])('%s moves the time to %s', (key, expected) => {
		const { input, time } = renderStepping(30);
		fireEvent.keyDown(input, { key });
		expect(time()).toBe(expected);
	});

	it.each([
		[-100, '09:30'],
		[100, '08:30']
	])('the wheel (deltaY %i) moves the time to %s', (deltaY, expected) => {
		const { input, time } = renderStepping(30);
		const event = new WheelEvent('wheel', {
			deltaY,
			bubbles: true,
			cancelable: true
		});
		input.dispatchEvent(event);
		expect(time()).toBe(expected);
		expect(event.defaultPrevented).toBe(true);
	});

	it('does not step without stepMinutes', () => {
		const { input, onChange } = renderStepping();
		fireEvent.keyDown(input, { key: 'ArrowUp' });
		input.dispatchEvent(
			new WheelEvent('wheel', { deltaY: -100, cancelable: true })
		);
		expect(onChange).not.toHaveBeenCalled();
	});
});
