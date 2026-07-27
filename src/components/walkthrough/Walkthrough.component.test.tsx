// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, waitFor } from '@testing-library/react';
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

afterEach(() => {
	cleanup();
	adapterProps = null;
	appConfig.enableWalkthrough = true;
	vi.clearAllMocks();
});

describe('Walkthrough', () => {
	it('renders nothing when the app config disables the walkthrough', () => {
		appConfig.enableWalkthrough = false;
		const { queryByTestId } = renderWalkthrough();

		expect(queryByTestId('product-tour-adapter')).toBeNull();
	});

	it('renders nothing without auto-run or a carousel launch request', () => {
		const { queryByTestId } = renderWalkthrough({
			isWalkThroughEnabled: false
		});

		expect(queryByTestId('product-tour-adapter')).toBeNull();
	});

	it('runs the consultant walkthrough tour when the legacy gate is open', () => {
		renderWalkthrough();

		expect(adapterProps).not.toBeNull();
		expect(adapterProps.tour.id).toBe('consultant-walkthrough');
		expect(adapterProps.active).toBe(true);
		expect(adapterProps.paused).toBe(false);
	});

	it('runs on a carousel launch request even when the legacy switch is off', () => {
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

	it('pauses the tour while the two-factor-authentication dialog is shown', () => {
		renderWalkthrough({ twoFactorAuth: { isShown: true } });

		expect(adapterProps.paused).toBe(true);
	});

	it('persists step progress through the versioned api while running', () => {
		renderWalkthrough();

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

	it('skips the step-progress write for the final step so it cannot race the terminal write', () => {
		renderWalkthrough();

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

	it('persists terminal progress via the versioned api and syncs the legacy boolean', async () => {
		const { reloadUserData, store } = renderWalkthrough();

		await adapterProps.onTerminalStatus({
			tourId: 'consultant-walkthrough',
			tourVersion: 1,
			status: 'completed'
		});

		expect(
			versionedTourProgressRepository.saveProgress
		).toHaveBeenCalledWith(
			expect.objectContaining({ status: 'completed' })
		);
		expect(apiPatchConsultantData).toHaveBeenCalledWith({
			walkThroughEnabled: false
		});
		await waitFor(() => expect(reloadUserData).toHaveBeenCalled());
		expect(store.get(tourLaunchRequestAtom)).toBeNull();
	});

	it('does not touch the legacy boolean for carousel-only runs', async () => {
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
