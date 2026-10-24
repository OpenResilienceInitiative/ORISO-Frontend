import { vi } from 'vitest';

/**
 * A waiting room's button fetches the screen behind it when it is pressed
 * (`warmClosingDestination`, ORISO-Frontend#1737). In a test that would make
 * vite-node transform the whole app in the middle of the next test and push its
 * timers past their waits, so the tests of the rooms never ask for it.
 * `appChunks.test.ts` unmocks this to test the real thing.
 */
vi.mock('../components/app/appChunks', async (importOriginal) => ({
	...(await importOriginal<typeof import('../components/app/appChunks')>()),
	warmClosingDestination: () => undefined
}));
