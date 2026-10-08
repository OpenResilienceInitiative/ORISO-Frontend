// @vitest-environment jsdom
import * as React from 'react';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiGetAgenciesByIds } from '../api/apiGetAgenciesByIds';
import { UserDataContext } from '../globalState/context/UserDataContext';
import {
	resetCounsellorAgencyFormatsForTests,
	useCounsellorAgencyFormats
} from './useCounsellorAgencyFormats';

vi.mock('../api/apiGetAgenciesByIds', () => ({
	apiGetAgenciesByIds: vi.fn()
}));

const Probe = () => {
	const { agencies, isLoading } = useCounsellorAgencyFormats();
	return (
		<div>
			<span data-cy="loading">{String(isLoading)}</span>
			<span data-cy="circles">
				{String(
					agencies.find((agency) => agency.id === 1)?.settings
						?.featureSelfHelpGroupsEnabled ?? 'unknown'
				)}
			</span>
		</div>
	);
};

const Harness = ({ ids }: { ids: number[] }) => (
	<UserDataContext.Provider
		value={{
			userData: {
				agencies: ids.map((id) => ({ id, name: `Agency ${id}` }))
			},
			setUserData: () => undefined,
			reloadUserData: async () => null as any
		}}
	>
		<Probe />
	</UserDataContext.Provider>
);

describe('useCounsellorAgencyFormats', () => {
	beforeEach(() => {
		resetCounsellorAgencyFormatsForTests();
	});
	afterEach(() => {
		cleanup();
		resetCounsellorAgencyFormatsForTests();
		vi.clearAllMocks();
	});

	it('discards a slower older response when a newer agency set settles first', async () => {
		const pending = new Map<string, (value: unknown) => void>();
		vi.mocked(apiGetAgenciesByIds).mockImplementation(
			(ids: number[]) =>
				new Promise((resolve) => {
					pending.set(ids.join(','), resolve);
				})
		);

		const { rerender } = render(<Harness ids={[1]} />);
		await waitFor(() => expect(pending.has('1')).toBe(true));

		rerender(<Harness ids={[1, 2]} />);
		await waitFor(() => expect(pending.has('1,2')).toBe(true));

		act(() => {
			pending.get('1,2')?.([
				{
					id: 1,
					settings: { featureSelfHelpGroupsEnabled: false }
				},
				{
					id: 2,
					settings: { featureSelfHelpGroupsEnabled: true }
				}
			]);
		});
		await waitFor(() =>
			expect(
				document.querySelector('[data-cy="circles"]')?.textContent
			).toBe('false')
		);

		act(() => {
			pending.get('1')?.([
				{
					id: 1,
					settings: { featureSelfHelpGroupsEnabled: true }
				}
			]);
		});

		expect(document.querySelector('[data-cy="circles"]')?.textContent).toBe(
			'false'
		);
	});
});
