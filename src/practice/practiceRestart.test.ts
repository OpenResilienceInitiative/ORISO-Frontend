import { describe, expect, it, vi } from 'vitest';
import {
	registerPracticeRestartHandler,
	runPracticeRestartHandlers
} from './practiceRestart';

describe('practice restart handlers', () => {
	it('runs every registered handler on restart', () => {
		const fixtures = vi.fn();
		const other = vi.fn();
		const offFixtures = registerPracticeRestartHandler(fixtures);
		const offOther = registerPracticeRestartHandler(other);

		runPracticeRestartHandlers();

		expect(fixtures).toHaveBeenCalledTimes(1);
		expect(other).toHaveBeenCalledTimes(1);
		offFixtures();
		offOther();
	});

	it('stops calling a handler once it unregistered', () => {
		const handler = vi.fn();
		const off = registerPracticeRestartHandler(handler);
		off();

		runPracticeRestartHandlers();

		expect(handler).not.toHaveBeenCalled();
	});

	it('lets one failing handler neither stop the others nor the restart', () => {
		const after = vi.fn();
		const offBroken = registerPracticeRestartHandler(() => {
			throw new Error('fixtures broke');
		});
		const offAfter = registerPracticeRestartHandler(after);

		expect(() => runPracticeRestartHandlers()).not.toThrow();
		expect(after).toHaveBeenCalledTimes(1);
		offBroken();
		offAfter();
	});
});
