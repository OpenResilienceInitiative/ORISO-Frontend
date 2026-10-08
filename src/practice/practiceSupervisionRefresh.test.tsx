// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { enterPracticeMode, exitPracticeMode } from './practiceMode';
import {
	notifyPracticeSupervisorsChanged,
	usePracticeSupervisorsRevision
} from './practiceSupervisionRefresh';

describe('practice supervisor refresh signal', () => {
	afterEach(() => {
		cleanup();
		exitPracticeMode();
	});

	it('never moves outside practice, so the real lookups keep their open-only behaviour', () => {
		const { result } = renderHook(() => usePracticeSupervisorsRevision());

		act(() => notifyPracticeSupervisorsChanged());

		expect(result.current).toBe(0);
	});

	it('changes on every announcement while practising', () => {
		enterPracticeMode({ tourId: 'consultant-practice-supervision' });
		const { result } = renderHook(() => usePracticeSupervisorsRevision());
		const before = result.current;

		act(() => notifyPracticeSupervisorsChanged());
		const afterFirst = result.current;
		act(() => notifyPracticeSupervisorsChanged());

		expect(afterFirst).not.toBe(before);
		expect(result.current).not.toBe(afterFirst);
	});

	it('falls back to 0 when practice ends', () => {
		enterPracticeMode({ tourId: 'consultant-practice-supervision' });
		const { result } = renderHook(() => usePracticeSupervisorsRevision());
		act(() => notifyPracticeSupervisorsChanged());
		expect(result.current).toBeGreaterThan(0);

		act(() => exitPracticeMode());

		expect(result.current).toBe(0);
	});
});
