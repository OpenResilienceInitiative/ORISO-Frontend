// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { createStore, Provider } from 'jotai';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiPatchConsultantData } from '../../api';
import { UserDataContext } from '../../globalState';
import { tourLaunchRequestAtom } from '../productTour/tourLaunchState';
import { versionedTourProgressRepository } from '../productTour/versionedTourProgressRepository';
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
	launchRequest: any = null
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
				<Walkthrough />
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
});
