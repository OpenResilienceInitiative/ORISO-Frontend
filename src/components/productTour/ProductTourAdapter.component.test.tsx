// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProductTourAdapter } from './ProductTourAdapter';
import type { TourDefinition, TourEvent } from './types';

interface CapturedJoyrideProps {
	run: boolean;
	stepIndex: number;
	steps: any[];
	callback: (data: any) => void;
	tooltipComponent?: any;
	locale?: any;
	disableScrolling?: boolean;
}

let joyrideProps: CapturedJoyrideProps | null = null;

vi.mock('react-joyride', async () => {
	const actual: any = await vi.importActual('react-joyride');
	return {
		...actual,
		default: (props: any) => {
			joyrideProps = props;
			return null;
		}
	};
});

const tour: TourDefinition = {
	id: 'test-tour',
	version: 1,
	surface: 'frontend',
	audiences: ['consultant'],
	titleKey: 'tour.title',
	summaryKey: 'tour.summary',
	steps: [
		{
			id: 'intro',
			target: '',
			placement: 'center',
			titleKey: 't0',
			contentKey: 'c0'
		},
		{
			id: 'second',
			route: '/second',
			target: 'second-target',
			titleKey: 't1',
			contentKey: 'c1'
		},
		{
			id: 'third',
			route: '/third',
			target: 'third-target',
			titleKey: 't2',
			contentKey: 'c2'
		}
	]
};

const LocationProbe = ({ onPath }: { onPath: (path: string) => void }) => {
	const location = useLocation();
	onPath(location.pathname + location.search);
	return null;
};

const renderAdapter = (
	over: Partial<React.ComponentProps<typeof ProductTourAdapter>> = {}
) => {
	const events: Array<{ event: TourEvent; stepId?: string }> = [];
	const paths: string[] = [];
	const onTerminal = vi.fn(() => Promise.resolve());
	const utils = render(
		<MemoryRouter initialEntries={['/']}>
			<LocationProbe onPath={(p) => paths.push(p)} />
			<Routes>
				<Route
					path="*"
					element={
						<ProductTourAdapter
							tour={tour}
							active={true}
							paused={false}
							targetTimeoutMs={80}
							onEvent={(event, step) =>
								events.push({ event, stepId: step?.id })
							}
							onTerminalStatus={onTerminal}
							{...over}
						/>
					}
				/>
			</Routes>
		</MemoryRouter>
	);
	return { events, paths, onTerminal, ...utils };
};

afterEach(() => {
	cleanup();
	joyrideProps = null;
	document.body.innerHTML = '';
	vi.clearAllMocks();
});

describe('ProductTourAdapter', () => {
	it('renders joyride in controlled mode with mapped steps', async () => {
		renderAdapter();

		await waitFor(() => expect(joyrideProps).not.toBeNull());
		expect(joyrideProps!.steps).toHaveLength(3);
		expect(joyrideProps!.steps[0].target).toBe('body');
		expect(joyrideProps!.stepIndex).toBe(0);
		expect(joyrideProps!.run).toBe(true);
	});

	it('does not run while paused', async () => {
		renderAdapter({ paused: true });

		await waitFor(() => expect(joyrideProps).not.toBeNull());
		expect(joyrideProps!.run).toBe(false);
	});

	it('navigates to the next step route and advances only once its target exists', async () => {
		const el = document.createElement('div');
		el.setAttribute('data-tour-target', 'second-target');
		document.body.appendChild(el);

		const { paths } = renderAdapter();
		await waitFor(() => expect(joyrideProps).not.toBeNull());

		act(() => {
			joyrideProps!.callback({
				action: 'next',
				index: 0,
				status: 'running',
				type: 'step:after'
			});
		});

		await waitFor(() => expect(joyrideProps!.stepIndex).toBe(1));
		expect(paths).toContain('/second');
	});

	it('records target_missing and skips ahead when a target never appears', async () => {
		const el = document.createElement('div');
		el.setAttribute('data-tour-target', 'third-target');
		document.body.appendChild(el);

		const { events, paths } = renderAdapter();
		await waitFor(() => expect(joyrideProps).not.toBeNull());

		// advance to step 1 whose target is missing -> should end on step 2
		act(() => {
			joyrideProps!.callback({
				action: 'next',
				index: 0,
				status: 'running',
				type: 'step:after'
			});
		});

		await waitFor(() => expect(joyrideProps!.stepIndex).toBe(2), {
			timeout: 3000
		});
		expect(
			events.some(
				(e) => e.event === 'target_missing' && e.stepId === 'second'
			)
		).toBe(true);
		expect(paths).toContain('/third');
	});

	it('persists completed through the terminal callback', async () => {
		const { onTerminal } = renderAdapter();
		await waitFor(() => expect(joyrideProps).not.toBeNull());

		act(() => {
			joyrideProps!.callback({
				action: 'next',
				index: 2,
				status: 'running',
				type: 'step:after'
			});
		});

		await waitFor(() =>
			expect(onTerminal).toHaveBeenCalledWith(
				expect.objectContaining({
					tourId: 'test-tour',
					tourVersion: 1,
					status: 'completed'
				})
			)
		);
	});

	it('persists skipped when the user closes the tour mid-way', async () => {
		const { onTerminal } = renderAdapter();
		await waitFor(() => expect(joyrideProps).not.toBeNull());

		act(() => {
			joyrideProps!.callback({
				action: 'close',
				index: 0,
				status: 'running',
				type: 'step:after'
			});
		});

		await waitFor(() =>
			expect(onTerminal).toHaveBeenCalledWith(
				expect.objectContaining({ status: 'skipped' })
			)
		);
		expect(joyrideProps!.run).toBe(false);
	});
});
