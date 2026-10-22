// @vitest-environment jsdom
import * as React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserDataContext } from '../../globalState/context/UserDataContext';
import { AUTHORITIES } from '../../globalState/helpers/stateHelpers';
// vi.mock calls below are hoisted above these imports by vitest.
import { useConversationPreview } from './useConversationPreview';

const MAIN = '!main:x';
const SIDE = '!side:x';
const TEAM = '!team:x';

const fakes = vi.hoisted(() => ({
	useSession: vi.fn(),
	apiGetSessionSupervisors: vi.fn(),
	apiGetCaseHandoverStatus: vi.fn(),
	apiGetGroupChatInfo: vi.fn(),
	useTeamDiscussionChannel: vi.fn(),
	membership: 'join',
	transport: {
		getMatrixRoom: vi.fn(),
		onMatrixRoomLifecycle: vi.fn(() => () => undefined),
		onMatrixTimeline: vi.fn(() => () => undefined)
	}
}));

// lottie-web asks for a 2d canvas context at import time.
vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('lottie-web', () => ({ default: { loadAnimation: () => ({}) } }));
vi.mock('../../hooks/useSession', () => ({ useSession: fakes.useSession }));
vi.mock('../../api/apiGetSessionSupervisors', () => ({
	apiGetSessionSupervisors: fakes.apiGetSessionSupervisors
}));
vi.mock('../../api/apiCaseHandover', () => ({
	apiGetCaseHandoverStatus: fakes.apiGetCaseHandoverStatus
}));
vi.mock('../../api/apiGetGroupChatInfo', () => ({
	apiGetGroupChatInfo: fakes.apiGetGroupChatInfo
}));
vi.mock('../../hooks/useTeamDiscussionChannel', () => ({
	useTeamDiscussionChannel: fakes.useTeamDiscussionChannel
}));
vi.mock('../../services/chatTransportService', () => ({
	chatTransportService: fakes.transport
}));

const session = (overrides: Record<string, any> = {}): any => {
	const { item, ...rest } = overrides;
	return {
		rid: MAIN,
		consultant: { id: 'me' },
		isSession: true,
		...rest,
		item: { id: 13, status: 2, matrixRoomId: MAIN, ...item }
	};
};

const consultant = {
	userId: 'me',
	displayName: 'Marge',
	grantedAuthorities: [AUTHORITIES.CONSULTANT_DEFAULT],
	userRoles: ['CONSULTANT'],
	dataPrivacyConfirmation: '2026-01-01'
};
const asker = {
	userId: 'asker',
	userName: 'fuchs42',
	grantedAuthorities: [AUTHORITIES.ASKER_DEFAULT],
	userRoles: ['USER'],
	dataPrivacyConfirmation: '2026-01-01'
};

const row = (overrides: Record<string, any> = {}): any => ({
	id: 'a1',
	eventType: 'message.new',
	category: 'message',
	createdAt: '2026-10-22T10:00:00Z',
	params: { roomRef: MAIN, sourceSessionId: 13 },
	actionPath: `/sessions/consultant/sessionView/${MAIN}/13`,
	...overrides
});

const render = (event: any, userData: any = consultant, visible = true) =>
	renderHook(() => useConversationPreview(event, { visible }), {
		wrapper: ({ children }: { children: React.ReactNode }) => (
			<UserDataContext.Provider value={{ userData } as any}>
				{children}
			</UserDataContext.Provider>
		)
	});

beforeEach(() => {
	fakes.membership = 'join';
	fakes.transport.getMatrixRoom.mockImplementation(() => ({
		getMyMembership: () => fakes.membership
	}));
	fakes.useSession.mockReturnValue({ session: session(), ready: true });
	fakes.apiGetSessionSupervisors.mockResolvedValue([]);
	fakes.apiGetGroupChatInfo.mockResolvedValue({ bannedUsers: [] });
	fakes.useTeamDiscussionChannel.mockReturnValue({
		discussion: null,
		resolved: true
	});
});
afterEach(() => vi.clearAllMocks());

describe('useConversationPreview (#1824)', () => {
	it('loads the session by room and session id, only while visible', () => {
		render(row(), consultant, false);
		expect(fakes.useSession).toHaveBeenLastCalledWith(null, undefined);
		render(row());
		expect(fakes.useSession).toHaveBeenLastCalledWith(MAIN, 13);
	});

	it('the own main room: writable, as the chat composer would be', async () => {
		const { result } = render(row());
		await waitFor(() =>
			expect(result.current?.capabilities.composer).toBe(true)
		);
		expect(result.current).toMatchObject({
			roomId: MAIN,
			roomKind: 'main',
			threadRootId: null,
			senderDisplayName: 'Marge'
		});
	});

	it('resolves the supervision side room from the session’s supervisors', async () => {
		fakes.apiGetSessionSupervisors.mockResolvedValue([
			{ supervisorConsultantId: 'sup', matrixRoomId: SIDE }
		]);
		const { result } = render(
			row({ params: { roomRef: SIDE, sourceSessionId: 13 } })
		);
		await waitFor(() =>
			expect(result.current?.roomKind).toBe('supervision')
		);
		expect(result.current?.capabilities.composer).toBe(true);
		expect(result.current?.composerTarget).toEqual({
			targetRoomId: SIDE,
			accent: 'supervision',
			feedbackMailIntent: true,
			isSupervisor: false,
			supervisionRoomId: SIDE
		});
	});

	it('resolves the team room, writable only while OPEN, never creating it', async () => {
		fakes.useTeamDiscussionChannel.mockReturnValue({
			discussion: { matrixRoomId: TEAM, status: 'OPEN' },
			resolved: true
		});
		const { result } = render(
			row({
				eventType: 'team.discussion.new',
				params: { roomRef: TEAM, sourceSessionId: 13 }
			})
		);
		await waitFor(() => expect(result.current?.roomKind).toBe('team'));
		await waitFor(() =>
			expect(result.current?.capabilities.composer).toBe(true)
		);
		expect(result.current?.composerTarget).toEqual({
			targetRoomId: TEAM,
			targetChannelKind: 'team',
			teamDiscussion: true,
			accent: 'team'
		});
		expect(fakes.useTeamDiscussionChannel).toHaveBeenCalledWith(
			expect.objectContaining({ allowCreate: false })
		);
	});

	it('a room that is none of the session’s rooms is read only', async () => {
		const { result } = render(
			row({ params: { roomRef: '!stranger:x', sourceSessionId: 13 } })
		);
		await waitFor(() =>
			expect(result.current?.capabilities.readOnlyReason).toBe(
				'sessionUnknown'
			)
		);
	});

	it('asks the handover status for another counsellor’s case: co-access is read only', async () => {
		fakes.useSession.mockReturnValue({
			session: session({ consultant: { id: 'owner' } }),
			ready: true
		});
		fakes.apiGetCaseHandoverStatus.mockResolvedValue({
			canViewContent: true,
			accessType: 'CO_ACCESS',
			status: 'GRANTED',
			expiresAt: '2026-11-01T00:00:00Z'
		});
		const { result } = render(row());
		await waitFor(() =>
			expect(result.current?.capabilities.readOnlyReason).toBe('coAccess')
		);
		expect(fakes.apiGetCaseHandoverStatus).toHaveBeenCalledWith(13);
		expect(result.current?.caseHandoverStatus?.expiresAt).toBe(
			'2026-11-01T00:00:00Z'
		);
	});

	it('an advice seeker in their own conversation: no handover check, writable', async () => {
		fakes.useSession.mockReturnValue({
			session: session({ consultant: { id: 'counsellor' } }),
			ready: true
		});
		const { result } = render(row(), asker);
		await waitFor(() =>
			expect(result.current?.capabilities.composer).toBe(true)
		);
		expect(fakes.apiGetCaseHandoverStatus).not.toHaveBeenCalled();
		expect(fakes.apiGetSessionSupervisors).not.toHaveBeenCalled();
		expect(result.current?.senderDisplayName).toBe('fuchs42');
	});

	it('a supervisor writes into the side room as the chat does (aside semantics)', async () => {
		fakes.useSession.mockReturnValue({
			session: session({ consultant: { id: 'owner' } }),
			ready: true
		});
		fakes.apiGetSessionSupervisors.mockResolvedValue([
			{ supervisorConsultantId: 'me', matrixRoomId: SIDE }
		]);
		const { result } = render(
			row({ params: { roomRef: SIDE, sourceSessionId: 13 } })
		);
		await waitFor(() =>
			expect(result.current?.capabilities.composer).toBe(true)
		);
		expect(result.current?.composerTarget).toMatchObject({
			isSupervisor: true,
			supervisionRoomId: SIDE
		});
		// A supervisor already reads the case: no handover status is asked.
		expect(fakes.apiGetCaseHandoverStatus).not.toHaveBeenCalled();
	});

	it('stays read only while the supervisors are still loading', async () => {
		let resolveSupervisors: (value: unknown) => void = () => undefined;
		fakes.apiGetSessionSupervisors.mockReturnValue(
			new Promise((resolve) => {
				resolveSupervisors = resolve;
			})
		);
		const { result } = render(row());
		await waitFor(() =>
			expect(result.current?.capabilities.readOnlyReason).toBe(
				'sessionUnknown'
			)
		);
		resolveSupervisors([]);
		await waitFor(() =>
			expect(result.current?.capabilities.composer).toBe(true)
		);
	});

	it('anonymous asker: blocked while the chat’s waiting gate is up', async () => {
		fakes.useSession.mockReturnValue({
			session: session({
				consultant: { id: 'counsellor' },
				item: {
					registrationType: 'ANONYMOUS',
					conversationType: 'LIVE_CHAT'
				}
			}),
			ready: true
		});
		sessionStorage.setItem('anonymous-pseudonym-13', '1');
		const { result } = render(row(), asker);
		await waitFor(() =>
			expect(result.current?.capabilities.readOnlyReason).toBe(
				'consentGate'
			)
		);
		sessionStorage.setItem('anonymous-waiting-dismissed-13', '1');
		const reopened = render(row(), asker);
		await waitFor(() =>
			expect(reopened.result.current?.capabilities.composer).toBe(true)
		);
		// The chat's transport for an anonymous asker, as in the chat.
		expect(reopened.result.current?.composerTarget).toEqual({
			isAnonymousLiveChat: true
		});
		sessionStorage.clear();
	});

	it('group: the chat’s join view blocks a banned member', async () => {
		fakes.useSession.mockReturnValue({
			session: session({
				isGroup: true,
				isSession: false,
				item: { active: true, subscribed: true }
			}),
			ready: true
		});
		fakes.apiGetGroupChatInfo.mockResolvedValue({
			bannedUsers: ['fuchs42']
		});
		const { result } = render(row(), asker);
		await waitFor(() =>
			expect(result.current?.capabilities.readOnlyReason).toBe(
				'notJoined'
			)
		);
	});

	it('group: a stopped group is read only', async () => {
		fakes.useSession.mockReturnValue({
			session: session({
				isGroup: true,
				isSession: false,
				item: { active: false, subscribed: true }
			}),
			ready: true
		});
		const { result } = render(row(), asker);
		await waitFor(() =>
			expect(result.current?.capabilities.readOnlyReason).toBe(
				'notJoined'
			)
		);
	});

	it('a group whose knock is still pending is read only', async () => {
		fakes.membership = 'knock';
		fakes.useSession.mockReturnValue({
			session: session({
				isGroup: true,
				isSession: false,
				item: { active: true, subscribed: true }
			}),
			ready: true
		});
		const { result } = render(row(), asker);
		await waitFor(() =>
			expect(result.current?.capabilities.readOnlyReason).toBe(
				'notJoined'
			)
		);
	});

	it('carries the thread of a thread notification', async () => {
		const { result } = render(
			row({
				eventType: 'thread.reply.new',
				actionPath: `/sessions/consultant/sessionView/${MAIN}/13?channel=thread:$root`
			})
		);
		await waitFor(() => expect(result.current?.threadRootId).toBe('$root'));
	});
});
