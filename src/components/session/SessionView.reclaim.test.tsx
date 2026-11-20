// @vitest-environment oriso-jsdom
import React from 'react';
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen
} from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vite-plus/test';
import {
	apiGetCaseHandoverStatus,
	apiReclaimCaseHandover
} from '../../api/apiCaseHandover';
import { apiGetSessionRoomBySessionId } from '../../api/apiGetSessionRooms';
import {
	ConsultantListContext,
	SessionTypeContext,
	UserDataContext
} from '../../globalState';
import { NotificationsContext } from '../../globalState/provider/NotificationsProvider';
import { mockUserData } from '../message/MessageItemComponent.mocks';
import { STATUS_ACTIVE } from '../../globalState/interfaces/SessionsDataInterface';
import { SessionView } from './SessionView';
import { SESSION_LIST_TYPES } from './sessionHelpers';

const roomId = '!case:dev.example.invalid';
const homer = { id: 'homer', name: 'Homer Simpson' };
const krusty = { id: 'krusty', name: 'Krusty Clown' };
const lisa = { id: 'lisa', name: 'Lisa Simpson' };
const matrixId = (actor: typeof homer) => `@${actor.id}:dev.example.invalid`;

vi.mock('react-i18next', () => {
	const t = (key: string, options?: { names?: string }) =>
		key === 'chatStage.participants.label'
			? `Beteiligte: ${options?.names}`
			: key;
	return { useTranslation: () => ({ t }) };
});

vi.mock('lottie-web', () => ({ default: {} }));
vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('../app/navigationHandler', () => ({
	desktopView: vi.fn(),
	mobileDetailView: vi.fn(),
	mobileListView: vi.fn()
}));
vi.mock('../../hooks/useResponsive', () => ({
	useResponsive: () => ({ fromL: true })
}));
vi.mock('../../hooks/useAppConfig', () => ({ useAppConfig: () => ({}) }));
vi.mock('../../globalState', async (original) => ({
	...(await original<typeof import('../../globalState')>()),
	useConsultingType: () => null,
	useTopic: () => null
}));
vi.mock('../../utils/tenantSettingsHelper', async (original) => ({
	...(await original<typeof import('../../utils/tenantSettingsHelper')>()),
	getTenantSettings: () => ({ featureTeamDiscussionEnabled: false })
}));
vi.mock('../sessionMenu/SessionMenu', () => ({ SessionMenu: () => null }));
vi.mock('./SessionItemComponent', async () => {
	const { SessionHeaderComponent } = await import(
		'../sessionHeader/SessionHeaderComponent'
	);
	return {
		SessionItemComponent: () => <SessionHeaderComponent bannedUsers={[]} />
	};
});
vi.mock('../../globalState/context/MatrixClientContext', () => {
	const matrixClientService = {
		getClient: () => ({
			on: () => {},
			off: () => {},
			getUserId: () => matrixId(homer),
			getRoom: () => ({
				// Both counsellors stay joined when the assigned owner changes.
				getJoinedMembers: () =>
					[homer, krusty, lisa].map((actor) => ({
						userId: matrixId(actor),
						name: actor.name
					}))
			})
		})
	};
	return { useMatrixClient: () => ({ matrixClientService }) };
});
vi.mock('../../api/apiCaseHandover', async (original) => ({
	...(await original<typeof import('../../api/apiCaseHandover')>()),
	apiGetCaseHandoverReasons: vi.fn(async () => []),
	apiGetCaseHandoverStatus: vi.fn(),
	apiReclaimCaseHandover: vi.fn()
}));
vi.mock('../../api/apiGetSessionRooms', () => ({
	apiGetSessionRoomBySessionId: vi.fn()
}));
vi.mock('../../api/apiGetSessionSupervisors', () => ({
	apiGetSessionSupervisors: vi.fn(async () => [])
}));

afterEach(cleanup);

const roomResponse = (owner: typeof homer) =>
	({
		sessions: [
			{
				session: {
					id: 14,
					status: STATUS_ACTIVE,
					matrixRoomId: roomId,
					consultantMatrixUserId: matrixId(owner),
					askerMatrixUserId: matrixId(lisa),
					topic: { id: 14 }
				},
				consultant: { id: owner.id, username: owner.id },
				user: { username: lisa.id, displayName: lisa.name }
			}
		]
	}) as Awaited<ReturnType<typeof apiGetSessionRoomBySessionId>>;

it('updates the displayed participant from the cover to the original counsellor after reclaim', async () => {
	let completeRefresh: (room: ReturnType<typeof roomResponse>) => void;
	const refreshedRoom = new Promise<ReturnType<typeof roomResponse>>(
		(resolve) => {
			completeRefresh = resolve;
		}
	);
	vi.mocked(apiGetSessionRoomBySessionId)
		.mockResolvedValueOnce(roomResponse(krusty))
		.mockReturnValueOnce(refreshedRoom);
	const status = {
		sessionId: 14,
		status: 'NOT_REQUESTED',
		canReclaim: true,
		canViewContent: false,
		clientConsentRequired: false
	};
	vi.mocked(apiGetCaseHandoverStatus).mockResolvedValue(status);
	vi.mocked(apiReclaimCaseHandover).mockResolvedValue({
		...status,
		status: 'GRANTED',
		canReclaim: false,
		canViewContent: true
	});

	const sessionPath = '/sessions/consultant/sessionView';
	const userData = mockUserData({
		userId: homer.id,
		userName: homer.id,
		displayName: homer.name
	});
	const notifications = {
		notificationFeed: [],
		addNotification: () => {},
		addEventNotification: () => {}
	} as React.ContextType<typeof NotificationsContext>;
	render(
		<MemoryRouter initialEntries={[`${sessionPath}/session/14`]}>
			<UserDataContext.Provider
				value={{
					userData,
					setUserData: () => {},
					reloadUserData: async () => userData
				}}
			>
				<SessionTypeContext.Provider
					value={{
						type: SESSION_LIST_TYPES.MY_SESSION,
						path: sessionPath
					}}
				>
					<ConsultantListContext.Provider
						value={{ setConsultantList: () => {} }}
					>
						<NotificationsContext.Provider value={notifications}>
							<Routes>
								<Route
									path={`${sessionPath}/session/:sessionId`}
									element={<SessionView />}
								/>
							</Routes>
						</NotificationsContext.Provider>
					</ConsultantListContext.Provider>
				</SessionTypeContext.Provider>
			</UserDataContext.Provider>
		</MemoryRouter>
	);

	fireEvent.click(
		await screen.findByRole('button', {
			name: 'caseHandover.curtain.reclaim.cta'
		})
	);
	await screen.findByRole('list', { name: /Beteiligte: .*Krusty Clown/ });

	await act(async () => completeRefresh(roomResponse(homer)));

	const participants = await screen.findByRole('list', {
		name: /Beteiligte: .*Homer Simpson/
	});
	expect(participants.getAttribute('aria-label')).not.toContain(krusty.name);
	expect(apiReclaimCaseHandover).toHaveBeenCalledExactlyOnceWith(14);
	expect(apiGetSessionRoomBySessionId).toHaveBeenCalledTimes(2);
});
