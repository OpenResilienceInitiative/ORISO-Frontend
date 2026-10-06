// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getTourHostHooks } from '../components/productTour/tourHostHooks';
import { appSnackbarStack } from '../components/m3Snackbar/snackbarStack';
import {
	getPracticeSnapshot,
	isPracticeMode,
	exitPracticeMode
} from './practiceMode';
import { PRACTICE_TOUR_IDS } from './practiceTourIds';
import {
	PracticeHostHooks,
	registerPracticeTourHostHooks
} from './practiceTourHostHooks';

vi.mock('i18next', () => ({
	default: { t: (key: string) => `t:${key}` }
}));

const enterMock = vi.hoisted(() => ({ fail: false }));
vi.mock('./practiceMode', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./practiceMode')>();
	return {
		...actual,
		enterPracticeMode: (params: { tourId: string }) => {
			if (enterMock.fail) {
				throw new Error('guard could not be installed');
			}
			actual.enterPracticeMode(params);
		}
	};
});

beforeEach(() => {
	enterMock.fail = false;
	appSnackbarStack.clear();
});

afterEach(() => {
	cleanup();
	exitPracticeMode();
	appSnackbarStack.clear();
});

describe('registerPracticeTourHostHooks', () => {
	it('registers a hook pair for both practice tours and removes them again', () => {
		const unregister = registerPracticeTourHostHooks();

		PRACTICE_TOUR_IDS.forEach((id) => {
			expect(getTourHostHooks(id)?.setup).toBeTypeOf('function');
			expect(getTourHostHooks(id)?.teardown).toBeTypeOf('function');
		});
		expect(getTourHostHooks('consultant-walkthrough')).toBeUndefined();

		unregister();
		PRACTICE_TOUR_IDS.forEach((id) =>
			expect(getTourHostHooks(id)).toBeUndefined()
		);
	});

	it.each(PRACTICE_TOUR_IDS)(
		'enters practice mode for %s before the tour starts and leaves it when the tour ends',
		(id) => {
			const unregister = registerPracticeTourHostHooks();
			const hooks = getTourHostHooks(id)!;

			hooks.setup!();
			expect(isPracticeMode()).toBe(true);
			expect(getPracticeSnapshot().session?.tourId).toBe(id);

			hooks.teardown!();
			expect(isPracticeMode()).toBe(false);
			unregister();
		}
	);

	it('lets the tour fail to start and tells the user calmly when practice cannot be entered', () => {
		const unregister = registerPracticeTourHostHooks();
		enterMock.fail = true;

		expect(() =>
			getTourHostHooks('consultant-practice-accept')!.setup!()
		).toThrow('guard could not be installed');

		const [note] = appSnackbarStack.getSnapshot();
		expect(note.announcement).toBe('t:practice.error.start');
		expect(isPracticeMode()).toBe(false);
		unregister();
	});

	it('shows the start error through the snackbar surface the app already has', () => {
		const unregister = registerPracticeTourHostHooks();
		enterMock.fail = true;
		try {
			getTourHostHooks('consultant-practice-accept')!.setup!();
		} catch {
			// expected: the tour must not start
		}
		const [note] = appSnackbarStack.getSnapshot();

		render(<div>{note.render({ dismiss: () => undefined })}</div>);

		expect(screen.getByRole('status').textContent).toContain(
			't:practice.error.start'
		);
		unregister();
	});

	it('keeps teardown harmless after a failed setup', () => {
		const unregister = registerPracticeTourHostHooks();
		enterMock.fail = true;
		try {
			getTourHostHooks('consultant-practice-accept')!.setup!();
		} catch {
			// expected
		}

		expect(() =>
			getTourHostHooks('consultant-practice-accept')!.teardown!()
		).not.toThrow();
		expect(isPracticeMode()).toBe(false);
		unregister();
	});
});

describe('PracticeHostHooks', () => {
	it('registers while mounted and unregisters on unmount', () => {
		const { unmount } = render(<PracticeHostHooks />);
		expect(getTourHostHooks('consultant-practice-accept')).toBeDefined();

		act(() => unmount());

		expect(getTourHostHooks('consultant-practice-accept')).toBeUndefined();
	});
});
