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
