// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const CLIENT_POLL_INTERVAL_MS = 2000;

const realClient = () => ({ on: vi.fn(), off: vi.fn() });

/** Fresh tracker, registry and fake from one module graph (see utdTracker.test). */
const loadModules = async () => {
	const { initUtdTracking } = await import(
		'../utils/observability/utdTracker'
	);
	const { setMatrixClientServiceRef } = await import(
		'../services/matrixClientRegistry'
	);
	const { createFakeMatrixService } = await import(
		'./fakeMatrix/FakeMatrixService'
	);
	return {
		initUtdTracking,
		setMatrixClientServiceRef,
		createFakeMatrixService
	};
};

describe('UTD telemetry in practice mode', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it('stays on the real Matrix client while the practice client is registered', async () => {
		const {
			initUtdTracking,
			setMatrixClientServiceRef,
			createFakeMatrixService
		} = await loadModules();
		const real = realClient();
		setMatrixClientServiceRef({ getClient: () => real } as any);
		initUtdTracking();
		expect(real.on).toHaveBeenCalledWith(
			'Room.timeline',
			expect.any(Function)
		);

		const practice = createFakeMatrixService({ rooms: [] });
		const practiceOn = vi.spyOn(practice.getClient(), 'on');
		setMatrixClientServiceRef(practice as any);
		vi.advanceTimersByTime(CLIENT_POLL_INTERVAL_MS);

		expect(real.off).not.toHaveBeenCalled();
		expect(practiceOn).not.toHaveBeenCalled();
	});
});
