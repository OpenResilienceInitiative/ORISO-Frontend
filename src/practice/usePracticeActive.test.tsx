// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { enterPracticeMode, exitPracticeMode } from './practiceMode';
import { usePracticeActive } from './usePracticeActive';

describe('usePracticeActive', () => {
	afterEach(() => {
		cleanup();
		exitPracticeMode();
	});

	it('follows practice mode without a provider', () => {
		const { result } = renderHook(() => usePracticeActive());
		expect(result.current).toBe(false);

		act(() => enterPracticeMode({ tourId: 'consultant-practice-accept' }));
		expect(result.current).toBe(true);

		act(() => exitPracticeMode());
		expect(result.current).toBe(false);
	});

	it('is already true for a component mounted after enter', () => {
		enterPracticeMode({ tourId: 'consultant-practice-supervision' });

		const { result } = renderHook(() => usePracticeActive());

		expect(result.current).toBe(true);
	});
});
