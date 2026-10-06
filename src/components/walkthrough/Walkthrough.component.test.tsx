// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { createStore, Provider } from 'jotai';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiPatchConsultantData } from '../../api';
import { TenantContext, UserDataContext } from '../../globalState';
import { frontendTours } from '../productTour/tourDefinitions';
import { tourLaunchRequestAtom } from '../productTour/tourLaunchState';
import { registerTourHostHooks } from '../productTour/tourHostHooks';
import { versionedTourProgressRepository } from '../productTour/versionedTourProgressRepository';
import type { TourDefinition } from '../productTour/types';
import { Walkthrough } from './Walkthrough';

let adapterProps: any = null;

vi.mock('../productTour/ProductTourAdapter', () => ({
	ProductTourAdapter: (props: any) => {
		adapterProps = props;
		return <div data-testid="product-tour-adapter" />;
	}
}));

vi.mock('../../api', () => ({
	apiPatchConsultantData: vi.fn(() => Promise.resolve())
}));

vi.mock('../productTour/versionedTourProgressRepository', () => ({
	versionedTourProgressRepository: {
		saveProgress: vi.fn(() => Promise.resolve()),
		getProgress: vi.fn(() => Promise.resolve([]))
	}
}));

// The globalState barrel pulls lottie (crashes in jsdom): stub the player.
vi.mock('lottie-react', () => ({ default: () => null }));

const appConfig: { enableWalkthrough: boolean } = { enableWalkthrough: true };
vi.mock('../../hooks/useAppConfig', () => ({
	useAppConfig: () => appConfig
}));

const renderWalkthrough = (
	userDataOver: Record<string, any> = {},
	launchRequest: any = null,
	tenantSettings?: Record<string, any>
) => {
	const reloadUserData = vi.fn();
	const userData = {
		isWalkThroughEnabled: true,
		twoFactorAuth: { isShown: false },
		...userDataOver
	};
	const store = createStore();
	store.set(tourLaunchRequestAtom, launchRequest);
	const utils = render(
		<Provider store={store}>
			<UserDataContext.Provider
				value={{ userData, reloadUserData } as any}
			>
				<TenantContext.Provider
					value={
						tenantSettings
							? ({ tenant: { settings: tenantSettings } } as any)
							: null
					}
				>
					<Walkthrough />
				</TenantContext.Provider>
			</UserDataContext.Provider>
		</Provider>
	);
	return { reloadUserData, store, ...utils };
};

// Lets the async progress read settle before asserting that nothing started.
const flushProgressRead = () => act(async () => {});

afterEach(() => {
	cleanup();
	adapterProps = null;
	appConfig.enableWalkthrough = true;
	vi.clearAllMocks();
});

describe('Walkthrough', () => {
	it('renders nothing when the app config disables the walkthrough', async () => {
		appConfig.enableWalkthrough = false;
		const { queryByTestId } = renderWalkthrough();

		await flushProgressRead();
		expect(queryByTestId('product-tour-adapter')).toBeNull();
		expect(
			versionedTourProgressRepository.getProgress
		).not.toHaveBeenCalled();
	});

	it('ignores a manual start while the app config disables the walkthrough', () => {
		appConfig.enableWalkthrough = false;
		const { queryByTestId } = renderWalkthrough(
			{ isWalkThroughEnabled: false },
			{ tourId: 'consultant-walkthrough', mode: 'start', requestedAt: 10 }
		);

		expect(queryByTestId('product-tour-adapter')).toBeNull();
	});

	it('does not auto-start while the switch is off', async () => {
		renderWalkthrough({ isWalkThroughEnabled: false });

		await flushProgressRead();
		expect(adapterProps).toBeNull();
		expect(
			versionedTourProgressRepository.getProgress
		).not.toHaveBeenCalled();
	});

	it('auto-starts the walkthrough when the switch is on and the current version is not done', async () => {
		vi.mocked(
			versionedTourProgressRepository.getProgress
		).mockResolvedValueOnce([
			{
				tourId: 'consultant-walkthrough',
				tourVersion: 0,
				surface: 'frontend',
				status: 'completed'
			}
		]);
		renderWalkthrough();

		await waitFor(() => expect(adapterProps).not.toBeNull());
		expect(adapterProps.tour.id).toBe('consultant-walkthrough');
		expect(adapterProps.active).toBe(true);
		expect(adapterProps.paused).toBe(false);
	});

	it('reads the progress again when the switch is turned back on', async () => {
		const store = createStore();
		const tree = (isWalkThroughEnabled: boolean) => (
			<Provider store={store}>
				<UserDataContext.Provider
					value={
						{
							userData: {
								isWalkThroughEnabled,
								twoFactorAuth: { isShown: false }
							},
							reloadUserData: vi.fn()
						} as any
					}
				>
					<Walkthrough />
				</UserDataContext.Provider>
			</Provider>
		);
		const { rerender, queryByTestId } = render(tree(true));
		await waitFor(() => expect(adapterProps).not.toBeNull());

		rerender(tree(false));
		await flushProgressRead();
		expect(queryByTestId('product-tour-adapter')).toBeNull();

		// Another session finished the tour while the switch was off.
		vi.mocked(
			versionedTourProgressRepository.getProgress
		).mockResolvedValueOnce([
			{
				tourId: 'consultant-walkthrough',
				tourVersion: 1,
				surface: 'frontend',
				status: 'completed'
			}
		]);
		rerender(tree(true));
		await flushProgressRead();

		expect(
			versionedTourProgressRepository.getProgress
		).toHaveBeenCalledTimes(2);
		expect(queryByTestId('product-tour-adapter')).toBeNull();
	});

	it.each(['completed', 'skipped'])(
		'does not auto-start when the current version is %s',
		async (status) => {
			vi.mocked(
				versionedTourProgressRepository.getProgress
			).mockResolvedValueOnce([
				{
					tourId: 'consultant-walkthrough',
					tourVersion: 1,
					surface: 'frontend',
					status: status as 'completed' | 'skipped'
				}
			]);
			renderWalkthrough();

			await flushProgressRead();
			expect(adapterProps).toBeNull();
		}
	);

	it('does not auto-start when the progress cannot be read', async () => {
		vi.mocked(
			versionedTourProgressRepository.getProgress
		).mockRejectedValueOnce(new Error('network down'));
		renderWalkthrough();

		await flushProgressRead();
		expect(adapterProps).toBeNull();
	});

	it('runs a manual start from the list even when the switch is off', () => {
		renderWalkthrough(
			{ isWalkThroughEnabled: false },
			{
				tourId: 'consultant-walkthrough',
				mode: 'restart',
				requestedAt: 1
			}
		);

		expect(adapterProps).not.toBeNull();
		expect(adapterProps.active).toBe(true);
	});

	it('pauses the tour while the two-factor-authentication dialog is shown', async () => {
		renderWalkthrough({ twoFactorAuth: { isShown: true } });

		await waitFor(() => expect(adapterProps).not.toBeNull());
		expect(adapterProps.paused).toBe(true);
	});

	it('persists step progress through the versioned api while running', async () => {
		renderWalkthrough();
		await waitFor(() => expect(adapterProps).not.toBeNull());

		adapterProps.onEvent('step_completed', { id: 'enquiries' });

		expect(
			versionedTourProgressRepository.saveProgress
		).toHaveBeenCalledWith({
			tourId: 'consultant-walkthrough',
			tourVersion: 1,
			status: 'in_progress',
			currentStepId: 'enquiries'
		});
	});

	it('skips the step-progress write for the final step so it cannot race the terminal write', async () => {
		renderWalkthrough();
		await waitFor(() => expect(adapterProps).not.toBeNull());

		adapterProps.onEvent('step_completed', { id: 'profile' });

		expect(
			versionedTourProgressRepository.saveProgress
		).not.toHaveBeenCalled();
	});

	it('re-opens the versioned scope when a restart run starts', () => {
		renderWalkthrough(
			{ isWalkThroughEnabled: false },
			{
				tourId: 'consultant-walkthrough',
				mode: 'restart',
				requestedAt: 2
			}
		);

		adapterProps.onEvent('tour_started', undefined);

		expect(
			versionedTourProgressRepository.saveProgress
		).toHaveBeenCalledWith({
			tourId: 'consultant-walkthrough',
			tourVersion: 1,
			status: 'in_progress'
		});
	});

	it('persists terminal progress and never switches the counsellor off', async () => {
		const { store } = renderWalkthrough();
		await waitFor(() => expect(adapterProps).not.toBeNull());

		await act(() =>
			adapterProps.onTerminalStatus({
				tourId: 'consultant-walkthrough',
				tourVersion: 1,
				status: 'completed'
			})
		);

		expect(
			versionedTourProgressRepository.saveProgress
		).toHaveBeenCalledWith(
			expect.objectContaining({ status: 'completed' })
		);
		expect(apiPatchConsultantData).not.toHaveBeenCalled();
		expect(store.get(tourLaunchRequestAtom)).toBeNull();
	});

	it('does not re-open the auto-run tour after it finished in this session', async () => {
		const { queryByTestId } = renderWalkthrough();
		await waitFor(() => expect(adapterProps).not.toBeNull());

		await act(() =>
			adapterProps.onTerminalStatus({
				tourId: 'consultant-walkthrough',
				tourVersion: 1,
				status: 'skipped'
			})
		);

		expect(queryByTestId('product-tour-adapter')).toBeNull();
	});

	it('hosts the mail-counselling tour when the carousel requests it', () => {
		renderWalkthrough(
			{ isWalkThroughEnabled: false },
			{
				tourId: 'consultant-mail-counselling',
				mode: 'start',
				requestedAt: 4
			}
		);

		expect(adapterProps).not.toBeNull();
		expect(adapterProps.tour.id).toBe('consultant-mail-counselling');
		expect(adapterProps.active).toBe(true);
	});

	it('prefers the requested tour over the auto-run', () => {
		renderWalkthrough(
			{ isWalkThroughEnabled: true },
			{
				tourId: 'consultant-mail-counselling',
				mode: 'start',
				requestedAt: 5
			}
		);

		expect(adapterProps.tour.id).toBe('consultant-mail-counselling');
	});

	it('persists step progress under the requested tour id', () => {
		renderWalkthrough(
			{ isWalkThroughEnabled: false },
			{
				tourId: 'consultant-mail-counselling',
				mode: 'start',
				requestedAt: 6
			}
		);

		adapterProps.onEvent('step_completed', { id: 'enquiries' });

		expect(
			versionedTourProgressRepository.saveProgress
		).toHaveBeenCalledWith({
			tourId: 'consultant-mail-counselling',
			tourVersion: 1,
			status: 'in_progress',
			currentStepId: 'enquiries'
		});
	});

	it('never touches the switch for a non-walkthrough tour', async () => {
		renderWalkthrough(
			{ isWalkThroughEnabled: true },
			{
				tourId: 'consultant-mail-counselling',
				mode: 'start',
				requestedAt: 7
			}
		);

		await adapterProps.onTerminalStatus({
			tourId: 'consultant-mail-counselling',
			tourVersion: 1,
			status: 'completed'
		});

		expect(apiPatchConsultantData).not.toHaveBeenCalled();
	});

	it('renders nothing for an unknown requested tour id', () => {
		const { queryByTestId } = renderWalkthrough(
			{ isWalkThroughEnabled: false },
			{ tourId: 'does-not-exist', mode: 'start', requestedAt: 8 }
		);

		expect(queryByTestId('product-tour-adapter')).toBeNull();
	});

	it('does not fall back to the auto-run for an unknown requested tour id', () => {
		const { queryByTestId } = renderWalkthrough(
			{ isWalkThroughEnabled: true },
			{ tourId: 'does-not-exist', mode: 'start', requestedAt: 9 }
		);

		expect(queryByTestId('product-tour-adapter')).toBeNull();
	});

	it('does not touch the switch for manual runs', async () => {
		renderWalkthrough(
			{ isWalkThroughEnabled: false },
			{
				tourId: 'consultant-walkthrough',
				mode: 'restart',
				requestedAt: 3
			}
		);

		await adapterProps.onTerminalStatus({
			tourId: 'consultant-walkthrough',
			tourVersion: 1,
			status: 'skipped'
		});

		expect(apiPatchConsultantData).not.toHaveBeenCalled();
	});

	describe('variants', () => {
		const variantTour: TourDefinition = {
			id: 'variant-tour',
			version: 1,
			surface: 'frontend',
			audiences: ['consultant'],
			titleKey: 't',
			summaryKey: 's',
			steps: [
				{ id: 'a', target: '', titleKey: 'a.t', contentKey: 'a.c' },
				{ id: 'b', target: '', titleKey: 'b.t', contentKey: 'b.c' },
				{
					id: 'team',
					target: '',
					titleKey: 'c.t',
					contentKey: 'c.c',
					when: { flag: 'featureTeamDiscussionEnabled' }
				}
			]
		};
		const request = (requestedAt: number) => ({
			tourId: 'variant-tour',
			mode: 'start',
			requestedAt
		});

		beforeEach(() => {
			frontendTours.push(variantTour);
		});
		afterEach(() => {
			frontendTours.splice(frontendTours.indexOf(variantTour), 1);
		});

		it('hands the adapter the steps the tenant flags leave', () => {
			renderWalkthrough({}, request(20), {
				featureTeamDiscussionEnabled: false
			});

			expect(adapterProps.tour.steps.map((s: any) => s.id)).toEqual([
				'a',
				'b'
			]);
		});

		it('keeps every step for a tenant that never set the flag', () => {
			renderWalkthrough({}, request(21), {});

			expect(adapterProps.tour.steps).toHaveLength(3);
		});

		it('works without any tenant loaded', () => {
			renderWalkthrough({}, request(22));

			expect(adapterProps.tour.steps).toHaveLength(3);
		});

		it('treats the last resolved step as the last one for the progress writes', () => {
			renderWalkthrough({}, request(23), {
				featureTeamDiscussionEnabled: false
			});

			adapterProps.onEvent('step_completed', { id: 'b' });
			expect(
				versionedTourProgressRepository.saveProgress
			).not.toHaveBeenCalled();

			adapterProps.onEvent('step_completed', { id: 'a' });
			expect(
				versionedTourProgressRepository.saveProgress
			).toHaveBeenCalledWith(
				expect.objectContaining({
					tourId: 'variant-tour',
					currentStepId: 'a'
				})
			);
		});

		it('renders nothing when the tour-level condition fails', () => {
			variantTour.when = { flag: 'featureSupervisionEnabled' };
			try {
				const { queryByTestId } = renderWalkthrough({}, request(24), {
					featureSupervisionEnabled: false
				});

				expect(queryByTestId('product-tour-adapter')).toBeNull();
			} finally {
				delete variantTour.when;
			}
		});
	});

	describe('host hooks', () => {
		it('passes no hooks for a tour that registered none', () => {
			renderWalkthrough(
				{},
				{
					tourId: 'consultant-walkthrough',
					mode: 'start',
					requestedAt: 30
				}
			);

			expect(adapterProps.onBeforeStart).toBeUndefined();
			expect(adapterProps.onEnd).toBeUndefined();
		});

		it('hands the registered setup and teardown of the running tour to the adapter', async () => {
			const setup = vi.fn();
			const teardown = vi.fn();
			const unregister = registerTourHostHooks(
				'consultant-mail-counselling',
				{ setup, teardown }
			);
			try {
				renderWalkthrough(
					{},
					{
						tourId: 'consultant-mail-counselling',
						mode: 'start',
						requestedAt: 31
					}
				);

				await adapterProps.onBeforeStart();
				adapterProps.onEnd();

				expect(setup).toHaveBeenCalledTimes(1);
				expect(teardown).toHaveBeenCalledTimes(1);
			} finally {
				unregister();
			}
		});

		it('does not hand one tour the hooks of another', () => {
			const unregister = registerTourHostHooks(
				'consultant-mail-counselling',
				{ setup: vi.fn(), teardown: vi.fn() }
			);
			try {
				renderWalkthrough(
					{},
					{
						tourId: 'consultant-walkthrough',
						mode: 'start',
						requestedAt: 32
					}
				);

				expect(adapterProps.onBeforeStart).toBeUndefined();
				expect(adapterProps.onEnd).toBeUndefined();
			} finally {
				unregister();
			}
		});
	});
});
