// @vitest-environment oriso-jsdom
import { describe, expect, it } from 'vite-plus/test';
import {
	shouldShowTourLauncher,
	type TourLauncherVisibilityInput
} from './TourLauncherFab';

const base: TourLauncherVisibilityInput = {
	walkthroughEnabled: true,
	userWantsLauncher: true,
	tourCount: 3,
	tourRunning: false,
	conversationOpen: false,
	otherSurfaces: 0
};

describe('shouldShowTourLauncher', () => {
	it('shows the "?" when tours exist and nothing is in the way', () => {
		expect(shouldShowTourLauncher(base)).toBe(true);
	});

	it.each<[string, Partial<TourLauncherVisibilityInput>]>([
		['the platform switched tours off', { walkthroughEnabled: false }],
		['the user switched the button off', { userWantsLauncher: false }],
		['there is no tour to start', { tourCount: 0 }],
		['a tour is already running', { tourRunning: true }],
		['a conversation is open', { conversationOpen: true }],
		['another floating button or a call is on screen', { otherSurfaces: 1 }]
	])('hides it when %s', (_reason, change) => {
		expect(shouldShowTourLauncher({ ...base, ...change })).toBe(false);
	});
});
