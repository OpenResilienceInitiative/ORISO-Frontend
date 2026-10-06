// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { createStore, Provider } from 'jotai';
import { afterEach, describe, expect, it } from 'vitest';
import type { TourDefinition } from '../components/productTour/types';
import {
	practiceTourProgressAtom,
	usePracticeTourProgress,
	usePracticeTourProgressReporter
} from './usePracticeTourProgress';

const step = (id: string) => ({
	id,
	target: '',
	titleKey: `${id}.title`,
	contentKey: `${id}.content`
});

const practiceTour = (ids: string[]): TourDefinition => ({
	id: 'consultant-practice-accept',
	version: 1,
	surface: 'frontend',
	audiences: ['consultant'],
	titleKey: 't',
	summaryKey: 's',
	steps: ids.map(step)
});

afterEach(cleanup);

const setup = (tour: TourDefinition | undefined) => {
	const store = createStore();
	const wrapper = ({ children }: { children: React.ReactNode }) => (
		<Provider store={store}>{children}</Provider>
	);
	const reporter = renderHook(
		(props: { tour: TourDefinition | undefined }) =>
			usePracticeTourProgressReporter(props.tour),
		{ wrapper, initialProps: { tour } }
	);
	const reader = renderHook(() => usePracticeTourProgress(), { wrapper });
	return { store, reporter, reader };
};

describe('practice tour progress', () => {
	it('starts at step 1 of the resolved step count as soon as the run mounts', () => {
		const { reader } = setup(practiceTour(['a', 'b', 'c', 'd']));

		expect(reader.result.current).toEqual({
			tourId: 'consultant-practice-accept',
			stepIndex: 0,
			stepCount: 4
		});
	});

	it('follows the step the tour shows', () => {
		const { reporter, reader } = setup(practiceTour(['a', 'b', 'c']));

		act(() => reporter.result.current('step_viewed', step('c')));

		expect(reader.result.current?.stepIndex).toBe(2);
		expect(reader.result.current?.stepCount).toBe(3);
	});

	it('ignores every event but step_viewed, and steps it does not know', () => {
		const { reporter, reader } = setup(practiceTour(['a', 'b']));

		act(() => {
			reporter.result.current('step_completed', step('b'));
			reporter.result.current('step_viewed', step('nope'));
			reporter.result.current('step_viewed', undefined);
		});

		expect(reader.result.current?.stepIndex).toBe(0);
	});

	it('forgets the run when the tour ends', () => {
		const { reporter, reader } = setup(practiceTour(['a', 'b']));

		reporter.unmount();

		expect(reader.result.current).toBeNull();
	});

	it('does not track a tour that is not a practice tour', () => {
		const { reader } = setup({
			...practiceTour(['a']),
			id: 'consultant-walkthrough'
		});

		expect(reader.result.current).toBeNull();
	});

	it('does not track anything without a tour', () => {
		const { reader } = setup(undefined);

		expect(reader.result.current).toBeNull();
	});

	it('exposes the atom for hosts that feed it directly', () => {
		const { store } = setup(undefined);

		store.set(practiceTourProgressAtom, {
			tourId: 'consultant-practice-supervision',
			stepIndex: 1,
			stepCount: 5
		});

		expect(store.get(practiceTourProgressAtom)?.stepCount).toBe(5);
	});
});
