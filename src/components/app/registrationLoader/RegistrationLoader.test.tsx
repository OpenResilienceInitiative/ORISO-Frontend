// @vitest-environment jsdom
import * as React from 'react';
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RegistrationLoader } from './RegistrationLoader';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key
	})
}));

vi.mock('@mui/material', async () => {
	const actual =
		await vi.importActual<typeof import('@mui/material')>('@mui/material');
	return {
		...actual,
		useMediaQuery: () => false
	};
});

describe('RegistrationLoader', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('calls onFinish once after ready and the completion delay', () => {
		const onFinish = vi.fn();
		const { rerender } = render(
			<RegistrationLoader ready={false} onFinish={onFinish} />
		);

		act(() => {
			vi.advanceTimersByTime(1200);
		});

		rerender(<RegistrationLoader ready={true} onFinish={onFinish} />);

		act(() => {
			vi.advanceTimersByTime(700);
		});

		expect(onFinish).toHaveBeenCalledTimes(1);
	});

	it('does not reset finish timers when parent re-renders', () => {
		const firstFinish = vi.fn();
		const secondFinish = vi.fn();
		const { rerender } = render(
			<RegistrationLoader ready={false} onFinish={firstFinish} />
		);

		act(() => {
			vi.advanceTimersByTime(1200);
		});

		rerender(<RegistrationLoader ready={true} onFinish={firstFinish} />);

		act(() => {
			vi.advanceTimersByTime(500);
		});

		rerender(<RegistrationLoader ready={true} onFinish={secondFinish} />);

		act(() => {
			vi.advanceTimersByTime(200);
		});

		expect(firstFinish).not.toHaveBeenCalled();
		expect(secondFinish).toHaveBeenCalledTimes(1);
	});
});
