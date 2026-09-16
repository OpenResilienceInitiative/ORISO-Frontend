// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	recordLoginFailure,
	resetLoginFailureTrackerForTests
} from './loginFailureTracker';

const mocks = vi.hoisted(() => {
	const add = vi.fn();
	const createCounter = vi.fn(() => ({ add }));
	const getMeter = vi.fn(() => ({ createCounter }));
	return { add, createCounter, getMeter };
});

vi.mock('@opentelemetry/api', () => ({
	metrics: { getMeter: mocks.getMeter }
}));

describe('loginFailureTracker', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		resetLoginFailureTrackerForTests();
	});

	it('does not touch the meter at import time (provider may not exist yet)', () => {
		expect(mocks.getMeter).not.toHaveBeenCalled();
	});

	it('counts one failure with the dashboard-contract names and attributes', () => {
		recordLoginFailure({
			outcome: 'credentials',
			transport: 'bad_request',
			stage: 'otp'
		});
		expect(mocks.getMeter).toHaveBeenCalledWith('login-tracker');
		expect(mocks.createCounter).toHaveBeenCalledWith(
			'login_failure',
			expect.objectContaining({ description: expect.any(String) })
		);
		expect(mocks.add).toHaveBeenCalledWith(1, {
			outcome: 'credentials',
			transport: 'bad_request',
			stage: 'otp'
		});
	});

	it('creates the counter once and reuses it', () => {
		recordLoginFailure({
			outcome: 'unavailable',
			transport: 'network',
			stage: 'password'
		});
		recordLoginFailure({
			outcome: 'unavailable',
			transport: 'network',
			stage: 'password'
		});
		expect(mocks.createCounter).toHaveBeenCalledTimes(1);
		expect(mocks.add).toHaveBeenCalledTimes(2);
	});

	it('never carries anything but the three health attributes', () => {
		recordLoginFailure({
			outcome: 'account_disabled',
			transport: 'bad_request',
			stage: 'password',
			// @ts-expect-error -- a caller must not be able to smuggle identity in
			username: 'someone@example.org'
		});
		expect(Object.keys(mocks.add.mock.calls[0][1]).sort()).toEqual([
			'outcome',
			'stage',
			'transport'
		]);
	});

	it('swallows meter failures instead of breaking the login screen', () => {
		mocks.add.mockImplementationOnce(() => {
			throw new Error('exporter exploded');
		});
		expect(() =>
			recordLoginFailure({
				outcome: 'credentials',
				transport: 'unauthorized',
				stage: 'password'
			})
		).not.toThrow();
	});
});
