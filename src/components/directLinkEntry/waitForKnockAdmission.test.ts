// @vitest-environment oriso-jsdom

import { describe, expect, it, vi } from 'vite-plus/test';
import { waitForKnockAdmission } from './waitForKnockAdmission';

const answers = (...statuses: Array<string | Error>) => {
	const getKnock = vi.fn();
	statuses.forEach((status) =>
		status instanceof Error
			? getKnock.mockRejectedValueOnce(status)
			: getKnock.mockResolvedValueOnce({ status })
	);
	return getKnock;
};

describe('waitForKnockAdmission (FE#2542)', () => {
	it('keeps asking until the counsellor lets the person in', async () => {
		const getKnock = answers('PENDING', 'PENDING', 'ADMITTED');
		await expect(
			waitForKnockAdmission(21, { getKnock, pollMs: 1 })
		).resolves.toBe('admitted');
		expect(getKnock).toHaveBeenCalledTimes(3);
		expect(getKnock).toHaveBeenCalledWith(21);
	});

	it('says when the counsellor turned the person down', async () => {
		await expect(
			waitForKnockAdmission(21, {
				getKnock: answers('PENDING', 'DECLINED'),
				pollMs: 1
			})
		).resolves.toBe('declined');
	});

	it('ends when the knock was withdrawn elsewhere', async () => {
		await expect(
			waitForKnockAdmission(21, {
				getKnock: answers('CANCELLED'),
				pollMs: 1
			})
		).resolves.toBe('cancelled');
	});

	it('does not take a failed request for an answer', async () => {
		const getKnock = answers(new Error('offline'), 'ADMITTED');
		await expect(
			waitForKnockAdmission(21, { getKnock, pollMs: 1 })
		).resolves.toBe('admitted');
	});

	it('treats a knock that no longer exists (404) as withdrawn', async () => {
		const getKnock = vi.fn().mockRejectedValue({ status: 404 });
		await expect(
			waitForKnockAdmission(21, { getKnock, pollMs: 1 })
		).resolves.toBe('cancelled');
		expect(getKnock).toHaveBeenCalledOnce();
	});

	it('ends when the session is over (401) instead of asking for ever', async () => {
		const getKnock = vi.fn().mockRejectedValue({ status: 401 });
		await expect(
			waitForKnockAdmission(21, { getKnock, pollMs: 1 })
		).resolves.toBe('ended');
		expect(getKnock).toHaveBeenCalledOnce();
	});

	it('keeps asking through a server error (503)', async () => {
		const getKnock = vi
			.fn()
			.mockRejectedValueOnce({ status: 503 })
			.mockResolvedValueOnce({ status: 'ADMITTED' });
		await expect(
			waitForKnockAdmission(21, { getKnock, pollMs: 1 })
		).resolves.toBe('admitted');
	});

	it('ends after the maximum wait without an answer', async () => {
		const getKnock = vi.fn().mockResolvedValue({ status: 'PENDING' });
		await expect(
			waitForKnockAdmission(21, { getKnock, pollMs: 2, maxWaitMs: 15 })
		).resolves.toBe('ended');
		const calls = getKnock.mock.calls.length;
		await new Promise((r) => setTimeout(r, 20));
		expect(getKnock.mock.calls.length).toBe(calls);
	});

	it('stops at once when the person no longer waits', async () => {
		const stop = new AbortController();
		const getKnock = vi.fn().mockResolvedValue({ status: 'PENDING' });
		const waiting = waitForKnockAdmission(21, {
			getKnock,
			pollMs: 5,
			signal: stop.signal
		});
		stop.abort();
		await expect(waiting).resolves.toBe('cancelled');
		const asked = getKnock.mock.calls.length;
		await new Promise((resolve) => setTimeout(resolve, 30));
		expect(getKnock.mock.calls.length).toBeLessThanOrEqual(asked + 1);
	});
});
