// @vitest-environment oriso-jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { apiGetChatMembers } from '../../api/apiGetChatMembers';
import {
	participantRole,
	SUPERVISOR_POWER_LEVEL,
	useGroupChatMemberRoles
} from './groupChatMemberRoles';

vi.mock('../../api/apiGetChatMembers', () => ({
	apiGetChatMembers: vi.fn()
}));

/**
 * OBP 2.1 #107 "Alle sehen alle Rollen": every participant of a group or
 * team chat carries a role badge.
 */
describe('participantRole', () => {
	it('names an advice seeker', () => {
		expect(participantRole('ADVICE_SEEKER', 0)).toBe('asker');
	});

	it('names a counsellor', () => {
		expect(participantRole('CONSULTANT', 50)).toBe('consultant');
	});

	it('names a counsellor who reads along at the supervisor power level a supervisor', () => {
		expect(participantRole('CONSULTANT', SUPERVISOR_POWER_LEVEL)).toBe(
			'supervisor'
		);
	});

	it('never makes an advice seeker a supervisor', () => {
		expect(participantRole('ADVICE_SEEKER', SUPERVISOR_POWER_LEVEL)).toBe(
			'asker'
		);
	});

	it('shows no badge while the role is unknown', () => {
		expect(participantRole(undefined, 0)).toBeUndefined();
		expect(
			participantRole(undefined, SUPERVISOR_POWER_LEVEL)
		).toBeUndefined();
	});
});

describe('useGroupChatMemberRoles', () => {
	// Reset queued answers too, so no test inherits another's mock.
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(apiGetChatMembers).mockReset();
	});

	it('maps each Matrix member to its role', async () => {
		vi.mocked(apiGetChatMembers).mockResolvedValue({
			members: [
				{ _id: '@c:hs', role: 'CONSULTANT' },
				{ _id: '@a:hs', role: 'ADVICE_SEEKER' }
			]
		});

		const { result } = renderHook(() => useGroupChatMemberRoles(7));

		await waitFor(() =>
			expect(result.current.get('@a:hs')).toBe('ADVICE_SEEKER')
		);
		expect(result.current.get('@c:hs')).toBe('CONSULTANT');
		expect(apiGetChatMembers).toHaveBeenCalledWith(7);
	});

	it('degrades to no roles when the member list cannot be read', async () => {
		vi.mocked(apiGetChatMembers).mockRejectedValue(new Error('CATCH_ALL'));

		const { result } = renderHook(() => useGroupChatMemberRoles(7));

		await waitFor(() => expect(apiGetChatMembers).toHaveBeenCalled());
		expect(result.current.size).toBe(0);
	});

	// A participant who joins while Chat-Info is open gets her badge too.
	it('asks again when the room membership changes', async () => {
		vi.mocked(apiGetChatMembers)
			.mockResolvedValueOnce({
				members: [{ _id: '@c:hs', role: 'CONSULTANT' }]
			})
			.mockResolvedValueOnce({
				members: [
					{ _id: '@c:hs', role: 'CONSULTANT' },
					{ _id: '@new:hs', role: 'ADVICE_SEEKER' }
				]
			});

		const { result, rerender } = renderHook(
			({ members }) => useGroupChatMemberRoles(7, members),
			{ initialProps: { members: '@c:hs' } }
		);
		await waitFor(() =>
			expect(result.current.get('@c:hs')).toBe('CONSULTANT')
		);

		rerender({ members: '@c:hs,@new:hs' });

		await waitFor(() =>
			expect(result.current.get('@new:hs')).toBe('ADVICE_SEEKER')
		);
		expect(apiGetChatMembers).toHaveBeenCalledTimes(2);
	});

	it('keeps the newer answer when an older one arrives late', async () => {
		let resolveOld: (value: any) => void = () => {};
		vi.mocked(apiGetChatMembers)
			.mockReturnValueOnce(
				new Promise((resolve) => (resolveOld = resolve))
			)
			.mockResolvedValueOnce({
				members: [{ _id: '@new:hs', role: 'ADVICE_SEEKER' }]
			});

		const { result, rerender } = renderHook(
			({ members }) => useGroupChatMemberRoles(7, members),
			{ initialProps: { members: '@c:hs' } }
		);
		rerender({ members: '@c:hs,@new:hs' });
		await waitFor(() =>
			expect(result.current.get('@new:hs')).toBe('ADVICE_SEEKER')
		);

		await act(async () => resolveOld({ members: [] }));

		expect(result.current.get('@new:hs')).toBe('ADVICE_SEEKER');
	});

	it('does not ask without a chat', () => {
		renderHook(() => useGroupChatMemberRoles(undefined));
		expect(apiGetChatMembers).not.toHaveBeenCalled();
	});
});
