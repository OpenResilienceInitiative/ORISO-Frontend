// @vitest-environment oriso-jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vite-plus/test';
import { apiGetChatMembers } from '../../api/apiGetChatMembers';
import { callCounsellorsOf, useCallCounsellors } from './callCounsellors';
import type { CallConversation } from './callParty';

vi.mock('../../api/apiGetChatMembers', () => ({ apiGetChatMembers: vi.fn() }));

const getMembers = vi.mocked(apiGetChatMembers);

const session: CallConversation = {
	session: {
		askerMatrixUserId: '@asker:example',
		consultantMatrixUserId: '@counsellor:example'
	}
};

const group: CallConversation = { chat: { id: 7, active: true } };

const members: UserService.Schemas.ChatMemberResponseDTO[] = [
	{ _id: '@zoe:example', role: 'CONSULTANT' },
	{ _id: '@asker:example', role: 'ADVICE_SEEKER' },
	{ _id: '@anna:example', role: 'CONSULTANT' },
	{ _id: '@unknown:example' },
	{ _id: 'not-a-matrix-id', role: 'CONSULTANT' }
];

describe('callCounsellorsOf', () => {
	it("lists a session's assigned counsellor, never the asker", () => {
		expect(callCounsellorsOf(session)).toEqual(['@counsellor:example']);
	});

	it("lists a group chat's CONSULTANT members, sorted, nobody else", () => {
		expect(callCounsellorsOf(group, members)).toEqual([
			'@anna:example',
			'@zoe:example'
		]);
	});

	it('ignores member lists for a conversation that is not a group chat', () => {
		expect(callCounsellorsOf(session, members)).toEqual([
			'@counsellor:example'
		]);
	});

	it('is empty without a conversation (shared-call guest) or a counsellor', () => {
		expect(callCounsellorsOf(null)).toEqual([]);
		expect(callCounsellorsOf(undefined, members)).toEqual([]);
		expect(
			callCounsellorsOf({ session: { askerMatrixUserId: '@a:example' } })
		).toEqual([]);
	});
});

describe('useCallCounsellors', () => {
	// No mockReset/mockClear here: under vite-plus they turn the rejection
	// of the failure case into an unhandled one. Count calls per test instead.
	it('reads the session counsellor without a request', () => {
		const before = getMembers.mock.calls.length;
		const { result } = renderHook(() => useCallCounsellors(session));
		expect(result.current).toEqual(['@counsellor:example']);
		expect(getMembers.mock.calls.length).toBe(before);
	});

	it("loads a group chat's members from the userservice", async () => {
		getMembers.mockResolvedValue({ members });
		const { result } = renderHook(() => useCallCounsellors(group));
		expect(result.current).toEqual([]);
		await waitFor(() =>
			expect(result.current).toEqual(['@anna:example', '@zoe:example'])
		);
		expect(getMembers).toHaveBeenCalledWith(7);
	});

	it('keeps an empty list when the member read fails', async () => {
		getMembers.mockImplementation(async () => {
			throw new Error('403');
		});
		const { result } = renderHook(() => useCallCounsellors(group));
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 0));
		});
		expect(getMembers).toHaveBeenCalledWith(7);
		expect(result.current).toEqual([]);
	});

	it('returns the same array for the same people', async () => {
		const { result, rerender } = renderHook(
			(conversation: CallConversation) =>
				useCallCounsellors(conversation),
			{ initialProps: session }
		);
		const first = result.current;
		rerender({ ...session, session: { ...session.session } });
		expect(result.current).toBe(first);
	});
});
