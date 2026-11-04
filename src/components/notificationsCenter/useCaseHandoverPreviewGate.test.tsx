// @vitest-environment oriso-jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vite-plus/test';
import {
	resetCaseHandoverPreviewGateCache,
	useCaseHandoverPreviewGate
} from './caseHandoverPreviewGate';

const lookup = vi.hoisted(() => vi.fn());

vi.mock('../../api/apiCaseHandover', () => ({
	apiGetCaseHandoverStatus: lookup
}));

afterEach(() => {
	lookup.mockReset();
	resetCaseHandoverPreviewGateCache();
});

it('never uses another account’s cached handover decision for the same case', async () => {
	lookup.mockResolvedValueOnce({ canViewContent: true });
	lookup.mockResolvedValueOnce({ canViewContent: false });
	const { result, rerender } = renderHook(
		({ viewer }) => useCaseHandoverPreviewGate(['42'], viewer),
		{ initialProps: { viewer: 'first-account' } }
	);
	await waitFor(() => expect(result.current('42')).toBe(true));
	rerender({ viewer: 'second-account' });
	expect(result.current('42')).toBe(false);
	await waitFor(() => expect(lookup).toHaveBeenCalledTimes(2));
	expect(result.current('42')).toBe(false);
});
