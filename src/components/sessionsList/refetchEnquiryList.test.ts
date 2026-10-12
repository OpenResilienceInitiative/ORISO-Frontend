import { describe, expect, it, vi } from 'vitest';
import { refetchEnquiryListState } from './refetchEnquiryList';

describe('refetchEnquiryListState', () => {
	it('clears a previously visible queue when both enquiry feeds return EMPTY', async () => {
		const replaceSessions = vi.fn();
		const setTotalItems = vi.fn();
		const setCurrentOffset = vi.fn();

		await refetchEnquiryListState({
			fetchPage: () => Promise.reject(new Error('EMPTY')),
			replaceSessions,
			setTotalItems,
			setCurrentOffset
		});

		expect(replaceSessions).toHaveBeenCalledWith([]);
		expect(setTotalItems).toHaveBeenCalledWith(0);
		expect(setCurrentOffset).toHaveBeenCalledWith(0);
	});
});

it.each(['success', 'empty'] as const)(
	'does not restore an obsolete %s response after newer reconciliation',
	async (kind) => {
		let finish: (value: { sessions: string[]; total: number }) => void;
		let fail: (error: Error) => void;
		const pending = new Promise<{ sessions: string[]; total: number }>(
			(resolve, reject) => {
				finish = resolve;
				fail = reject;
			}
		);
		const controller = new AbortController();
		const replaceSessions = vi.fn();
		const setTotalItems = vi.fn();
		const setCurrentOffset = vi.fn();
		const previous = refetchEnquiryListState({
			fetchPage: () => pending,
			signal: controller.signal,
			replaceSessions,
			setTotalItems,
			setCurrentOffset
		});
		controller.abort();
		await refetchEnquiryListState({
			fetchPage: async () => ({ sessions: ['current'], total: 1 }),
			replaceSessions,
			setTotalItems,
			setCurrentOffset
		});
		if (kind === 'success') finish({ sessions: ['obsolete'], total: 2 });
		else fail(new Error('EMPTY'));
		await previous;
		expect(replaceSessions).toHaveBeenCalledTimes(1);
		expect(replaceSessions).toHaveBeenLastCalledWith(['current']);
		expect(setTotalItems).toHaveBeenCalledTimes(1);
		expect(setCurrentOffset).toHaveBeenCalledTimes(1);
	}
);
