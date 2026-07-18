// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiPatchConsultantData } from '../../api';
import { UserDataContext } from '../../globalState';
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

// The globalState barrel pulls lottie (crashes in jsdom): stub the player.
vi.mock('lottie-react', () => ({ default: () => null }));

const appConfig: { enableWalkthrough: boolean } = { enableWalkthrough: true };
vi.mock('../../hooks/useAppConfig', () => ({
	useAppConfig: () => appConfig
}));

const renderWalkthrough = (userDataOver: Record<string, any> = {}) => {
	const reloadUserData = vi.fn();
	const userData = {
		isWalkThroughEnabled: true,
		twoFactorAuth: { isShown: false },
		...userDataOver
	};
	const utils = render(
		<UserDataContext.Provider value={{ userData, reloadUserData } as any}>
			<Walkthrough />
		</UserDataContext.Provider>
	);
	return { reloadUserData, ...utils };
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

	it('renders nothing when the user has the walkthrough disabled', () => {
		const { queryByTestId } = renderWalkthrough({
			isWalkThroughEnabled: false
		});

		expect(queryByTestId('product-tour-adapter')).toBeNull();
	});

	it('runs the consultant walkthrough tour when both gates are open', () => {
		renderWalkthrough();

		expect(adapterProps).not.toBeNull();
		expect(adapterProps.tour.id).toBe('consultant-walkthrough');
		expect(adapterProps.active).toBe(true);
		expect(adapterProps.paused).toBe(false);
	});

	it('pauses the tour while the two-factor-authentication dialog is shown', () => {
		renderWalkthrough({ twoFactorAuth: { isShown: true } });

		expect(adapterProps.paused).toBe(true);
	});

	it('disables the legacy boolean and reloads user data on terminal status', async () => {
		const { reloadUserData } = renderWalkthrough();

		await adapterProps.onTerminalStatus({
			tourId: 'consultant-walkthrough',
			tourVersion: 1,
			status: 'completed'
		});

		expect(apiPatchConsultantData).toHaveBeenCalledWith({
			walkThroughEnabled: false
		});
		await waitFor(() => expect(reloadUserData).toHaveBeenCalled());
	});
});
