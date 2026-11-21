// @vitest-environment oriso-jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vite-plus/test';
import { apiGetChatMembers } from '../../api/apiGetChatMembers';
import { apiGetSessionSupervisors } from '../../api/apiGetSessionSupervisors';
import { callCounsellorsOf, useCallCounsellors } from './callCounsellors';
import type { CallConversation } from './callParty';

vi.mock('../../api/apiGetChatMembers', () => ({ apiGetChatMembers: vi.fn() }));
vi.mock('../../api/apiGetSessionSupervisors', () => ({
	apiGetSessionSupervisors: vi.fn()
}));

const getMembers = vi.mocked(apiGetChatMembers);
const getSupervisors = vi.mocked(apiGetSessionSupervisors);

const supervisorRow = (
	supervisorMatrixUserId: string | null | undefined
): UserService.Schemas.SessionSupervisorResponseDTO => ({
	id: 1,
	sessionId: 42,
	supervisorConsultantId: 'kc-supervisor',
	supervisorUsername: 'supervisor',
	supervisorMatrixUserId,
	addedByConsultantId: 'kc-counsellor',
	addedDate: '2026-11-11T10:00:00Z'
});

const session: CallConversation = {
	session: {
		id: 42,
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

	it("adds a session's supervisors, deduplicated and sorted (#144)", () => {
		expect(
			callCounsellorsOf(
				session,
				[],
				[
					supervisorRow('@bettina:example'),
					supervisorRow('@counsellor:example'),
					supervisorRow(null),
					supervisorRow('not-a-matrix-id')
				]
			)
		).toEqual(['@bettina:example', '@counsellor:example']);
	});

	it('ignores supervisor lists for a group chat', () => {
		getMembers.mockResolvedValue({ members: [] });
		expect(
			callCounsellorsOf(group, [], [supervisorRow('@bettina:example')])
		).toEqual([]);
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
	it('reads the session counsellor at once, without a member request', () => {
		getSupervisors.mockResolvedValue([]);
		const before = getMembers.mock.calls.length;
		const { result } = renderHook(() => useCallCounsellors(session));
		expect(result.current).toEqual(['@counsellor:example']);
		expect(getMembers.mock.calls.length).toBe(before);
	});

	it("adds the session's supervisors from the userservice (#144)", async () => {
		getSupervisors.mockResolvedValue([supervisorRow('@bettina:example')]);
		const { result } = renderHook(() => useCallCounsellors(session));
		await waitFor(() =>
			expect(result.current).toEqual([
				'@bettina:example',
				'@counsellor:example'
			])
		);
		expect(getSupervisors).toHaveBeenCalledWith(42);
	});

	it('keeps the counsellor when the supervisor read is refused', async () => {
		getSupervisors.mockImplementation(async () => {
			throw new Error('403');
		});
		const { result } = renderHook(() => useCallCounsellors(session));
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 0));
		});
		expect(result.current).toEqual(['@counsellor:example']);
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
		getSupervisors.mockResolvedValue([]);
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
