// @vitest-environment jsdom
import React from 'react';
import {
	act,
	cleanup,
	fireEvent,
	render,
	waitFor
} from '@testing-library/react';
import {
	MemoryRouter,
	Route,
	Routes,
	useLocation,
	useNavigate
} from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProductTourAdapter } from './ProductTourAdapter';
import { emitTourEvent } from './tourEvents';
import type { TourDefinition, TourEvent } from './types';

interface CapturedJoyrideProps {
	run: boolean;
	stepIndex: number;
	steps: any[];
	onEvent: (data: any) => void;
	tooltipComponent?: any;
	locale?: any;
	disableScrolling?: boolean;
}

let joyrideProps: CapturedJoyrideProps | null = null;

vi.mock('react-joyride', async () => {
	const actual: any = await vi.importActual('react-joyride');
	return {
		...actual,
		Joyride: (props: any) => {
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

let navigateTo: (path: string) => void = () => {};
const NavigateCapture = () => {
	navigateTo = useNavigate();
	return null;
};

const renderAdapter = (
	over: Partial<React.ComponentProps<typeof ProductTourAdapter>> = {}
) => {
	const events: Array<{ event: TourEvent; stepId?: string }> = [];
	const paths: string[] = [];
	const onTerminal = vi.fn(() => Promise.resolve());
	const tree = (
		props: Partial<React.ComponentProps<typeof ProductTourAdapter>>
	) => (
		<MemoryRouter initialEntries={['/']}>
			<LocationProbe onPath={(p) => paths.push(p)} />
			<NavigateCapture />
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
							{...props}
						/>
					}
				/>
			</Routes>
		</MemoryRouter>
	);
	const utils = render(tree(over));
	const rerenderAdapter = (
		props: Partial<React.ComponentProps<typeof ProductTourAdapter>>
	) => utils.rerender(tree({ ...over, ...props }));
	return { events, paths, onTerminal, rerenderAdapter, ...utils };
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

	it('never scrolls the fixed-viewport app window', async () => {
		renderAdapter();

		await waitFor(() => expect(joyrideProps).not.toBeNull());
		expect((joyrideProps as any).options.skipScroll).toBe(true);
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
			joyrideProps!.onEvent({
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
			joyrideProps!.onEvent({
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
			joyrideProps!.onEvent({
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

	it('waits for a delayed first-step target before running joyride', async () => {
		const delayedTour: TourDefinition = {
			...tour,
			steps: [
				{
					id: 'late-first',
					target: 'late-first-target',
					titleKey: 't0',
					contentKey: 'c0'
				}
			]
		};
		renderAdapter({ tour: delayedTour });
		await waitFor(() => expect(joyrideProps).not.toBeNull());
		expect(joyrideProps!.run).toBe(false);

		const el = document.createElement('div');
		el.setAttribute('data-tour-target', 'late-first-target');
		document.body.appendChild(el);

		await waitFor(() => expect(joyrideProps!.run).toBe(true), {
			timeout: 3000
		});
		expect(joyrideProps!.stepIndex).toBe(0);
	});

	it('completes with terminal status when trailing optional targets never appear', async () => {
		const optionalTailTour: TourDefinition = {
			...tour,
			steps: [
				{
					id: 'intro',
					target: '',
					placement: 'center',
					titleKey: 't0',
					contentKey: 'c0'
				},
				{
					id: 'composer',
					target: 'session-composer',
					optional: true,
					titleKey: 't1',
					contentKey: 'c1'
				}
			]
		};
		const { events, onTerminal } = renderAdapter({
			tour: optionalTailTour
		});
		await waitFor(() => expect(joyrideProps).not.toBeNull());

		act(() => {
			joyrideProps!.onEvent({
				action: 'next',
				index: 0,
				status: 'running',
				type: 'step:after'
			});
		});

		await waitFor(
			() =>
				expect(onTerminal).toHaveBeenCalledWith(
					expect.objectContaining({
						tourId: 'test-tour',
						status: 'completed'
					})
				),
			{ timeout: 3000 }
		);
		expect(
			events.some(
				(e) =>
					e.event === 'optional_step_skipped' &&
					e.stepId === 'composer'
			)
		).toBe(true);
		expect(events.some((e) => e.event === 'target_missing')).toBe(false);
		expect(joyrideProps!.run).toBe(false);
	});

	it('closes resumable when a trailing required target never appears', async () => {
		const requiredTailTour: TourDefinition = {
			...tour,
			steps: [
				{
					id: 'intro',
					target: '',
					placement: 'center',
					titleKey: 't0',
					contentKey: 'c0'
				},
				{
					id: 'strict-end',
					target: 'strict-end-target',
					titleKey: 't1',
					contentKey: 'c1'
				}
			]
		};
		const { events, onTerminal } = renderAdapter({
			tour: requiredTailTour
		});
		await waitFor(() => expect(joyrideProps).not.toBeNull());

		act(() => {
			joyrideProps!.onEvent({
				action: 'next',
				index: 0,
				status: 'running',
				type: 'step:after'
			});
		});

		await waitFor(() => expect(joyrideProps!.run).toBe(false), {
			timeout: 3000
		});
		expect(
			events.some(
				(e) => e.event === 'target_missing' && e.stepId === 'strict-end'
			)
		).toBe(true);
		expect(onTerminal).not.toHaveBeenCalled();
	});

	it('persists skipped when the user closes the tour mid-way', async () => {
		const { onTerminal } = renderAdapter();
		await waitFor(() => expect(joyrideProps).not.toBeNull());

		act(() => {
			joyrideProps!.onEvent({
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

	describe('variants', () => {
		const variantTour: TourDefinition = {
			...tour,
			steps: [
				{
					id: 'intro',
					target: '',
					placement: 'center',
					titleKey: 't0',
					contentKey: 'c0'
				},
				{
					id: 'team',
					target: '',
					placement: 'center',
					when: { flag: 'featureTeamDiscussionEnabled' },
					titleKey: 't1',
					contentKey: 'c1'
				},
				{
					id: 'outro',
					target: '',
					placement: 'center',
					titleKey: 't2',
					contentKey: 'c2'
				}
			]
		};

		it('hands joyride only the steps whose conditions hold', async () => {
			renderAdapter({
				tour: variantTour,
				context: { flags: { featureTeamDiscussionEnabled: false } }
			});

			await waitFor(() => expect(joyrideProps).not.toBeNull());
			expect(joyrideProps!.steps.map((s) => s.id)).toEqual([
				'intro',
				'outro'
			]);
		});

		it('keeps every step when the flag is unset', async () => {
			renderAdapter({ tour: variantTour, context: { flags: {} } });

			await waitFor(() => expect(joyrideProps).not.toBeNull());
			expect(joyrideProps!.steps).toHaveLength(3);
		});

		it('completes at the last resolved step, not the last defined one', async () => {
			const { onTerminal } = renderAdapter({
				tour: variantTour,
				context: { flags: { featureTeamDiscussionEnabled: false } }
			});
			await waitFor(() => expect(joyrideProps!.run).toBe(true));

			act(() => {
				joyrideProps!.onEvent({
					action: 'next',
					index: 1,
					status: 'running',
					type: 'step:after'
				});
			});

			await waitFor(() =>
				expect(onTerminal).toHaveBeenCalledWith(
					expect.objectContaining({
						status: 'completed',
						currentStepId: 'outro'
					})
				)
			);
		});

		it('renders and starts nothing when the tour-level condition fails', async () => {
			const { onTerminal } = renderAdapter({
				tour: {
					...variantTour,
					when: { flag: 'featureSupervisionEnabled' }
				},
				context: { flags: { featureSupervisionEnabled: false } }
			});

			await act(async () => {});
			expect(joyrideProps).toBeNull();
			expect(onTerminal).not.toHaveBeenCalled();
		});

		it('resolves once at start and ignores later flag changes', async () => {
			const { rerenderAdapter } = renderAdapter({
				tour: variantTour,
				context: { flags: { featureTeamDiscussionEnabled: false } }
			});
			await waitFor(() => expect(joyrideProps!.run).toBe(true));

			rerenderAdapter({ context: { flags: {} } });

			expect(joyrideProps!.steps.map((s) => s.id)).toEqual([
				'intro',
				'outro'
			]);
		});
	});

	describe('dismiss safety', () => {
		it('keeps joyride defaults for ordinary tours so ESC and overlay clicks close them', async () => {
			renderAdapter();

			await waitFor(() => expect(joyrideProps).not.toBeNull());
			const options = (joyrideProps as any).options;
			expect(options).not.toHaveProperty('dismissKeyAction');
			expect(options).not.toHaveProperty('overlayClickAction');
		});

		it('disables ESC and overlay clicks for a non-dismissible tour', async () => {
			renderAdapter({ tour: { ...tour, dismissible: false } });

			await waitFor(() => expect(joyrideProps).not.toBeNull());
			const options = (joyrideProps as any).options;
			expect(options.dismissKeyAction).toBe(false);
			expect(options.overlayClickAction).toBe(false);
		});

		it('keeps the highlighted target clickable', async () => {
			renderAdapter({ tour: { ...tour, dismissible: false } });

			await waitFor(() => expect(joyrideProps).not.toBeNull());
			expect(
				(joyrideProps as any).options.blockTargetInteraction
			).not.toBe(true);
		});

		it('still ends a non-dismissible tour through the explicit close button', async () => {
			const { onTerminal } = renderAdapter({
				tour: { ...tour, dismissible: false }
			});
			await waitFor(() => expect(joyrideProps!.run).toBe(true));

			act(() => {
				joyrideProps!.onEvent({
					action: 'skip',
					index: 0,
					status: 'skipped',
					type: 'tour:end'
				});
			});

			await waitFor(() =>
				expect(onTerminal).toHaveBeenCalledWith(
					expect.objectContaining({ status: 'skipped' })
				)
			);
		});
	});

	describe('host hooks (setup and teardown)', () => {
		const deferred = () => {
			let resolve!: () => void;
			let reject!: (error: Error) => void;
			const promise = new Promise<void>((res, rej) => {
				resolve = res;
				reject = rej;
			});
			return { promise, resolve, reject };
		};

		it('runs onBeforeStart before the first step is prepared and starts after it resolves', async () => {
			const setup = deferred();
			const onBeforeStart = vi.fn(() => setup.promise);
			renderAdapter({ onBeforeStart });

			await waitFor(() => expect(onBeforeStart).toHaveBeenCalledTimes(1));
			await act(async () => {});
			expect(joyrideProps!.run).toBe(false);

			await act(async () => setup.resolve());

			await waitFor(() => expect(joyrideProps!.run).toBe(true));
			expect(onBeforeStart).toHaveBeenCalledTimes(1);
		});

		it('does not prepare the first target while setup is still pending', async () => {
			const setup = deferred();
			const el = document.createElement('div');
			el.setAttribute('data-tour-target', 'second-target');
			document.body.appendChild(el);
			const { paths } = renderAdapter({
				tour: {
					...tour,
					steps: [{ ...tour.steps[1] }]
				},
				onBeforeStart: () => setup.promise
			});

			await act(async () => {});
			expect(paths).not.toContain('/second');

			await act(async () => setup.resolve());
			await waitFor(() => expect(paths).toContain('/second'));
		});

		it('tears down once after the terminal status is written', async () => {
			const order: string[] = [];
			const onEnd = vi.fn(() => order.push('end'));
			const { onTerminal } = renderAdapter({ onEnd });
			onTerminal.mockImplementation(() => {
				order.push('terminal');
				return Promise.resolve();
			});
			await waitFor(() => expect(joyrideProps!.run).toBe(true));

			act(() => {
				joyrideProps!.onEvent({
					action: 'next',
					index: 2,
					status: 'running',
					type: 'step:after'
				});
			});

			await waitFor(() => expect(onEnd).toHaveBeenCalledTimes(1));
			expect(order).toEqual(['terminal', 'end']);
		});

		it('tears down when the tour is skipped', async () => {
			const onEnd = vi.fn();
			renderAdapter({ onEnd });
			await waitFor(() => expect(joyrideProps!.run).toBe(true));

			act(() => {
				joyrideProps!.onEvent({
					action: 'close',
					index: 0,
					status: 'running',
					type: 'step:after'
				});
			});

			await waitFor(() => expect(onEnd).toHaveBeenCalledTimes(1));
		});

		it('tears down when the tour stops without a terminal status', async () => {
			const onEnd = vi.fn();
			renderAdapter({
				onEnd,
				tour: {
					...tour,
					steps: [
						tour.steps[0],
						{
							id: 'strict-end',
							target: 'strict-end-target',
							titleKey: 't1',
							contentKey: 'c1'
						}
					]
				}
			});
			await waitFor(() => expect(joyrideProps!.run).toBe(true));

			act(() => {
				joyrideProps!.onEvent({
					action: 'next',
					index: 0,
					status: 'running',
					type: 'step:after'
				});
			});

			await waitFor(() => expect(onEnd).toHaveBeenCalledTimes(1), {
				timeout: 3000
			});
		});

		it('tears down when joyride loses the last required target', async () => {
			const onEnd = vi.fn();
			const { onTerminal } = renderAdapter({ onEnd });
			await waitFor(() => expect(joyrideProps!.run).toBe(true));

			act(() => {
				joyrideProps!.onEvent({
					action: 'next',
					index: 2,
					status: 'running',
					type: 'error:target_not_found'
				});
			});

			await waitFor(() => expect(onEnd).toHaveBeenCalledTimes(1));
			expect(onTerminal).not.toHaveBeenCalled();
		});

		it('tears down on unmount and never twice', async () => {
			const onEnd = vi.fn();
			const { unmount } = renderAdapter({ onEnd });
			await waitFor(() => expect(joyrideProps!.run).toBe(true));

			unmount();

			expect(onEnd).toHaveBeenCalledTimes(1);
		});

		it('does not tear down again on unmount after the terminal teardown', async () => {
			const onEnd = vi.fn();
			const { unmount } = renderAdapter({ onEnd });
			await waitFor(() => expect(joyrideProps!.run).toBe(true));
			act(() => {
				joyrideProps!.onEvent({
					action: 'close',
					index: 0,
					status: 'running',
					type: 'step:after'
				});
			});
			await waitFor(() => expect(onEnd).toHaveBeenCalledTimes(1));

			unmount();

			expect(onEnd).toHaveBeenCalledTimes(1);
		});

		it('does not tear down a tour whose setup never ran', () => {
			const onEnd = vi.fn();
			const { unmount } = renderAdapter({ active: false, onEnd });

			unmount();

			expect(onEnd).not.toHaveBeenCalled();
		});

		it('waits for a pending setup before tearing down after an early unmount', async () => {
			const setup = deferred();
			const order: string[] = [];
			const { unmount } = renderAdapter({
				onBeforeStart: () =>
					setup.promise.then(() => {
						order.push('setup');
					}),
				onEnd: () => order.push('end')
			});
			await act(async () => {});

			unmount();
			await act(async () => {});
			expect(order).toEqual([]);

			await act(async () => setup.resolve());

			await waitFor(() => expect(order).toEqual(['setup', 'end']));
		});

		it('never starts the tour when its setup fails, and still tears down', async () => {
			const onEnd = vi.fn();
			const { events } = renderAdapter({
				onBeforeStart: () => Promise.reject(new Error('boom')),
				onEnd
			});

			await waitFor(() => expect(onEnd).toHaveBeenCalledTimes(1));
			expect(joyrideProps!.run).toBe(false);
			expect(events).toEqual([]);
		});

		it('runs neither hook for a tour that resolves to no steps', async () => {
			const onBeforeStart = vi.fn();
			const onEnd = vi.fn();
			const { unmount } = renderAdapter({
				tour: { ...tour, when: { flag: 'off' } },
				context: { flags: { off: false } },
				onBeforeStart,
				onEnd
			});
			await act(async () => {});

			unmount();

			expect(onBeforeStart).not.toHaveBeenCalled();
			expect(onEnd).not.toHaveBeenCalled();
		});
	});

	describe('advanceOn', () => {
		const target = (name: string) => {
			const el = document.createElement('button');
			el.setAttribute('data-tour-target', name);
			document.body.appendChild(el);
			return el;
		};
		const advancing = (steps: TourDefinition['steps']): TourDefinition => ({
			...tour,
			steps
		});
		const plain = (id: string) => ({
			id,
			target: '',
			placement: 'center' as const,
			titleKey: `${id}.t`,
			contentKey: `${id}.c`
		});
		const click = (
			id: string,
			over: Partial<TourDefinition['steps'][number]> = {}
		) => ({
			id,
			target: `${id}-target`,
			titleKey: `${id}.t`,
			contentKey: `${id}.c`,
			advanceOn: { type: 'click' as const },
			...over
		});
		const started = async (
			steps: TourDefinition['steps'],
			over: Parameters<typeof renderAdapter>[0] = {}
		) => {
			const utils = renderAdapter({ tour: advancing(steps), ...over });
			await waitFor(() => expect(joyrideProps?.run).toBe(true));
			return utils;
		};
		const completed = (events: Array<{ event: TourEvent }>) =>
			events.filter((e) => e.event === 'step_completed');

		it('hands the step data to joyride so the tooltip can drop Next', async () => {
			target('a-target');
			await started([click('a'), plain('b')]);

			expect(joyrideProps!.steps[0].data).toEqual({
				advanceOn: { type: 'click' }
			});
		});

		describe('click', () => {
			it('advances like Next when the step target is clicked', async () => {
				const el = target('a-target');
				const { events } = await started([click('a'), plain('b')]);

				fireEvent.click(el);

				await waitFor(() => expect(joyrideProps!.stepIndex).toBe(1));
				expect(completed(events)).toEqual([
					{ event: 'step_completed', stepId: 'a' }
				]);
			});

			it('advances for a click on a child of the target', async () => {
				const el = target('a-target');
				const child = document.createElement('span');
				el.appendChild(child);
				await started([click('a'), plain('b')]);

				fireEvent.click(child);

				await waitFor(() => expect(joyrideProps!.stepIndex).toBe(1));
			});

			it('ignores clicks elsewhere and on other tour targets', async () => {
				target('a-target');
				const other = target('other-target');
				await started([click('a'), plain('b')]);

				fireEvent.click(other);
				fireEvent.click(document.body);
				await act(async () => {});
				await new Promise((r) => setTimeout(r, 30));

				expect(joyrideProps!.stepIndex).toBe(0);
			});

			it('listens on the explicit click target instead of the step target', async () => {
				const anchor = target('a-target');
				const trigger = target('trigger-target');
				await started([
					click('a', {
						advanceOn: { type: 'click', target: 'trigger-target' }
					}),
					plain('b')
				]);

				fireEvent.click(anchor);
				await new Promise((r) => setTimeout(r, 30));
				expect(joyrideProps!.stepIndex).toBe(0);

				fireEvent.click(trigger);
				await waitFor(() => expect(joyrideProps!.stepIndex).toBe(1));
			});

			it('sees a click the target stops from bubbling (capture phase)', async () => {
				const el = target('a-target');
				el.addEventListener('click', (e) => e.stopPropagation());
				await started([click('a'), plain('b')]);

				fireEvent.click(el);

				await waitFor(() => expect(joyrideProps!.stepIndex).toBe(1));
			});

			it('lets the target handle its own click before the tour moves on', async () => {
				const el = target('a-target');
				const order: string[] = [];
				el.addEventListener('click', () => order.push('target click'));
				await started([click('a'), plain('b')], {
					onEvent: (event) => order.push(event)
				});

				fireEvent.click(el);

				await waitFor(() => expect(order).toContain('step_completed'));
				expect(order.indexOf('target click')).toBeLessThan(
					order.indexOf('step_completed')
				);
			});

			it('advances only once for repeated clicks', async () => {
				const el = target('a-target');
				const { events } = await started([click('a'), plain('b')]);

				fireEvent.click(el);
				fireEvent.click(el);
				fireEvent.click(el);
				await waitFor(() => expect(joyrideProps!.stepIndex).toBe(1));
				fireEvent.click(el);
				await new Promise((r) => setTimeout(r, 30));

				expect(completed(events)).toHaveLength(1);
				expect(joyrideProps!.stepIndex).toBe(1);
			});

			it('still advances when the click itself navigates', async () => {
				const el = target('a-target');
				el.addEventListener('click', () => navigateTo('/after-click'));
				const { paths } = await started([click('a'), plain('b')]);

				fireEvent.click(el);

				await waitFor(() => expect(joyrideProps!.stepIndex).toBe(1));
				expect(paths).toContain('/after-click');
			});

			it('still advances when the click re-renders the host with fresh callbacks', async () => {
				const el = target('a-target');
				const { rerenderAdapter } = await started([
					click('a'),
					plain('b')
				]);

				fireEvent.click(el);
				rerenderAdapter({ onEvent: () => {} });
				rerenderAdapter({ onEvent: () => {} });

				await waitFor(() => expect(joyrideProps!.stepIndex).toBe(1));
			});

			it('does not advance while the tour is paused', async () => {
				const el = target('a-target');
				const { rerenderAdapter } = await started([
					click('a'),
					plain('b')
				]);
				rerenderAdapter({ paused: true });

				fireEvent.click(el);
				await new Promise((r) => setTimeout(r, 30));

				expect(joyrideProps!.stepIndex).toBe(0);
			});

			it('stops listening once the tour is unmounted', async () => {
				const el = target('a-target');
				const { events, unmount } = await started([
					click('a'),
					plain('b')
				]);

				unmount();
				fireEvent.click(el);
				await new Promise((r) => setTimeout(r, 30));

				expect(completed(events)).toHaveLength(0);
			});

			it('arms the next self-advancing step after moving on, and again after Back', async () => {
				const a = target('a-target');
				const b = target('b-target');
				const { events } = await started([
					click('a'),
					click('b'),
					plain('c')
				]);

				fireEvent.click(a);
				await waitFor(() => expect(joyrideProps!.stepIndex).toBe(1));
				fireEvent.click(a);
				await new Promise((r) => setTimeout(r, 30));
				expect(joyrideProps!.stepIndex).toBe(1);

				act(() => {
					joyrideProps!.onEvent({
						action: 'prev',
						index: 1,
						status: 'running',
						type: 'step:after'
					});
				});
				await waitFor(() => expect(joyrideProps!.stepIndex).toBe(0));

				fireEvent.click(a);
				await waitFor(() => expect(joyrideProps!.stepIndex).toBe(1));
				fireEvent.click(b);
				await waitFor(() => expect(joyrideProps!.stepIndex).toBe(2));
				expect(completed(events).map((e: any) => e.stepId)).toEqual([
					'a',
					'a',
					'b'
				]);
			});

			it('completes the tour when the last step advances by itself', async () => {
				const el = target('a-target');
				const { onTerminal } = await started([
					plain('intro'),
					click('a')
				]);
				act(() => {
					joyrideProps!.onEvent({
						action: 'next',
						index: 0,
						status: 'running',
						type: 'step:after'
					});
				});
				await waitFor(() => expect(joyrideProps!.stepIndex).toBe(1));

				fireEvent.click(el);

				await waitFor(() =>
					expect(onTerminal).toHaveBeenCalledWith(
						expect.objectContaining({
							status: 'completed',
							currentStepId: 'a'
						})
					)
				);
			});
		});

		describe('route', () => {
			const routeStep = (path: string) => ({
				...plain('r'),
				advanceOn: { type: 'route' as const, path }
			});

			it('advances when the location reaches the path', async () => {
				const { events } = await started([
					routeStep('/done'),
					plain('b')
				]);
				expect(joyrideProps!.stepIndex).toBe(0);

				act(() => navigateTo('/elsewhere'));
				await new Promise((r) => setTimeout(r, 30));
				expect(joyrideProps!.stepIndex).toBe(0);

				act(() => navigateTo('/done'));

				await waitFor(() => expect(joyrideProps!.stepIndex).toBe(1));
				expect(completed(events)).toHaveLength(1);
			});

			it('matches router patterns and required query params', async () => {
				await started([
					routeStep('/session/:id?channel=team'),
					plain('b')
				]);

				act(() => navigateTo('/session/7'));
				await new Promise((r) => setTimeout(r, 30));
				expect(joyrideProps!.stepIndex).toBe(0);

				act(() => navigateTo('/session/7?channel=team'));
				await waitFor(() => expect(joyrideProps!.stepIndex).toBe(1));
			});

			it('advances at once when the step is shown on a location that already matches', async () => {
				await started([plain('intro'), routeStep('/'), plain('c')]);
				act(() => {
					joyrideProps!.onEvent({
						action: 'next',
						index: 0,
						status: 'running',
						type: 'step:after'
					});
				});

				await waitFor(() => expect(joyrideProps!.stepIndex).toBe(2));
			});
		});

		describe('event', () => {
			const eventStep = (name: string) => ({
				...plain('e'),
				advanceOn: { type: 'event' as const, name }
			});

			it('advances when the named event is emitted while the step is shown', async () => {
				const { events } = await started([
					eventStep('practice:message-sent'),
					plain('b')
				]);

				emitTourEvent('practice:other');
				await new Promise((r) => setTimeout(r, 30));
				expect(joyrideProps!.stepIndex).toBe(0);

				act(() => emitTourEvent('practice:message-sent'));

				await waitFor(() => expect(joyrideProps!.stepIndex).toBe(1));
				expect(completed(events)).toHaveLength(1);
			});

			it('advances only once when the event is emitted repeatedly', async () => {
				const { events } = await started([eventStep('x'), plain('b')]);

				act(() => {
					emitTourEvent('x');
					emitTourEvent('x');
				});
				await waitFor(() => expect(joyrideProps!.stepIndex).toBe(1));
				act(() => emitTourEvent('x'));
				await new Promise((r) => setTimeout(r, 30));

				expect(completed(events)).toHaveLength(1);
			});

			it('ignores an event emitted before the step is shown', async () => {
				await started([plain('intro'), eventStep('early'), plain('c')]);

				act(() => emitTourEvent('early'));
				act(() => {
					joyrideProps!.onEvent({
						action: 'next',
						index: 0,
						status: 'running',
						type: 'step:after'
					});
				});
				await waitFor(() => expect(joyrideProps!.stepIndex).toBe(1));
				await new Promise((r) => setTimeout(r, 30));

				expect(joyrideProps!.stepIndex).toBe(1);
			});

			it('stops listening after the step was left', async () => {
				const { events } = await started([
					eventStep('x'),
					plain('b'),
					plain('c')
				]);
				act(() => emitTourEvent('x'));
				await waitFor(() => expect(joyrideProps!.stepIndex).toBe(1));

				act(() => emitTourEvent('x'));
				await new Promise((r) => setTimeout(r, 30));

				expect(joyrideProps!.stepIndex).toBe(1);
				expect(completed(events)).toHaveLength(1);
			});
		});
	});
});
