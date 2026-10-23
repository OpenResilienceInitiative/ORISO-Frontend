// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const order: string[] = [];
const resume = vi.fn();
const loadChunk = vi.fn();

vi.mock('./components/transition/closing/playClosingAnimation', () => ({
	resumeClosingAnimation: () => {
		order.push('resume');
		return resume();
	}
}));
vi.mock('./utils/chunkLoadRecovery', () => ({
	loadChunk: (...args: unknown[]) => {
		order.push('loadChunk');
		return loadChunk(...args);
	}
}));
vi.mock('./resources/scripts/runtimeConfig', () => ({
	getRuntimeConfigProblems: () => []
}));
vi.mock('./components/configurationError/ConfigurationError', () => ({
	ConfigurationError: () => null,
	reportRuntimeConfigProblems: () => undefined
}));

const start = async () => {
	vi.resetModules();
	await import('./initApp');
};

/**
 * ORISO-Frontend#1737. The closing animation of a waiting room that replaced
 * the page is carried on by the app's first module, before the (large) app
 * chunk is even requested: whatever the person sees first is the cover.
 */
describe('initApp', () => {
	beforeEach(() => {
		order.length = 0;
		resume.mockReset();
		resume.mockResolvedValue({ played: false });
		loadChunk.mockReset();
	});
	afterEach(() => vi.restoreAllMocks());

	it('resumes the closing animation of the previous document, before it loads the app', async () => {
		await start();
		expect(order).toEqual(['resume', 'loadChunk']);
	});

	it('starts the app without waiting for the animation', async () => {
		resume.mockReturnValue(new Promise(() => undefined));
		await start();
		expect(loadChunk).toHaveBeenCalledTimes(1);
	});

	it('starts the app when the animation cannot resume, and hears of the failure so it is not left unhandled', async () => {
		const handled: Array<(reason: unknown) => unknown> = [];
		resume.mockReturnValue({
			catch: (onRejected: (reason: unknown) => unknown) => {
				handled.push(onRejected);
			}
		});
		await start();
		expect(loadChunk).toHaveBeenCalledTimes(1);
		expect(handled, 'the failure is caught').toHaveLength(1);
		expect(
			handled[0](new Error('animate is not supported'))
		).toBeUndefined();
	});
});
