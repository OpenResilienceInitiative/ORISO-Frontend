// @vitest-environment jsdom
import { createElement } from 'react';
import { render, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	clearDepartmentLegalCache,
	getCachedDepartmentLegal
} from './apiGetDepartmentLegal';
import { useDepartmentLegal } from './useDepartmentLegal';
import { fetchData } from './fetchData';

vi.mock('./fetchData', async () => {
	const actual =
		await vi.importActual<typeof import('./fetchData')>('./fetchData');
	return {
		...actual,
		fetchData: vi.fn()
	};
});

vi.mock('../resources/scripts/endpoints', () => ({
	endpoints: {
		agencyDepartmentLegal: (agencyId: number, topicId: number) =>
			`https://api.test.local/service/agencies/${agencyId}/topics/${topicId}/legal`
	}
}));

const samplePayload = {
	dpp: {
		content: '{"de":"<p>DPP</p>"}',
		consentText: '{"de":"Einwilligung"}'
	},
	imprint: { content: null }
};

describe('getCachedDepartmentLegal', () => {
	beforeEach(() => {
		clearDepartmentLegalCache();
		vi.mocked(fetchData).mockResolvedValue(samplePayload);
	});

	afterEach(() => {
		clearDepartmentLegalCache();
		vi.clearAllMocks();
	});

	it('makes one network call per (agency, topic) key', async () => {
		const first = await getCachedDepartmentLegal(42, 7);
		const second = await getCachedDepartmentLegal(42, 7);

		expect(fetchData).toHaveBeenCalledTimes(1);
		expect(first).toBe(second);
		expect(first?.dpp.consentText).toBe('{"de":"Einwilligung"}');
	});

	it('fetches separately for different keys', async () => {
		await getCachedDepartmentLegal(42, 7);
		await getCachedDepartmentLegal(42, 8);

		expect(fetchData).toHaveBeenCalledTimes(2);
	});
});

describe('useDepartmentLegal', () => {
	beforeEach(() => {
		clearDepartmentLegalCache();
		vi.mocked(fetchData).mockResolvedValue(samplePayload);
	});

	afterEach(() => {
		clearDepartmentLegalCache();
		vi.clearAllMocks();
	});

	it('does not fetch when enabled is false', async () => {
		const { result } = renderHook(() =>
			useDepartmentLegal(42, 7, { enabled: false })
		);

		expect(result.current.loading).toBe(false);
		expect(fetchData).not.toHaveBeenCalled();
	});

	/**
	 * #1213 review: a mounted consumer (the open legal dialog) can have its
	 * agency/topic swapped under it by a profile or session update. React runs
	 * the effect only after that render, so a snapshot kept in plain state is
	 * painted once under the new identifiers first. Recording every render
	 * value catches that frame — asserting on the settled result would not.
	 */
	it('never publishes a snapshot loaded for other identifiers', async () => {
		const rendered: Array<{ hasData: boolean; loading: boolean }> = [];

		const Probe = ({
			agencyId,
			topicId
		}: {
			agencyId: number;
			topicId: number;
		}) => {
			const { data, loading } = useDepartmentLegal(agencyId, topicId);
			rendered.push({ hasData: data != null, loading });
			return null;
		};

		const { rerender } = render(
			createElement(Probe, { agencyId: 42, topicId: 7 })
		);

		await waitFor(() => {
			expect(rendered.at(-1)?.hasData).toBe(true);
		});

		rendered.length = 0;
		rerender(createElement(Probe, { agencyId: 42, topicId: 8 }));

		// Not one frame of the previous department's legal text.
		expect(rendered.every((frame) => frame.hasData === false)).toBe(true);
		expect(rendered.at(-1)?.loading).toBe(true);

		await waitFor(() => {
			expect(rendered.at(-1)?.hasData).toBe(true);
		});
		expect(fetchData).toHaveBeenCalledTimes(2);
	});

	it('shares one snapshot across two hook consumers', async () => {
		const { result: a } = renderHook(() => useDepartmentLegal(42, 7));
		const { result: b } = renderHook(() => useDepartmentLegal(42, 7));

		await waitFor(() => {
			expect(a.current.loading).toBe(false);
			expect(b.current.loading).toBe(false);
		});

		expect(fetchData).toHaveBeenCalledTimes(1);
		expect(a.current.data).toBe(b.current.data);
		expect(a.current.data?.dpp.consentText).toBe('{"de":"Einwilligung"}');
		expect(a.current.data?.dpp.content).toBe(b.current.data?.dpp.content);
	});
});
