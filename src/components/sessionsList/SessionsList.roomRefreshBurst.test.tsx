// @vitest-environment oriso-jsdom
import React from 'react';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vite-plus/test';
import {
	E2EEContext,
	SessionsDataProvider,
	SessionTypeContext,
	UserDataContext
} from '../../globalState';
import { LegalLinksContext } from '../../globalState/provider/LegalLinksProvider';
import { SESSION_LIST_TYPES } from '../session/sessionHelpers';
import { SessionsList } from './SessionsList';
import { messageEventEmitter } from '../../services/messageEventEmitter';

const askerList = vi.hoisted(() => vi.fn());
const consultantList = vi.hoisted(() => vi.fn());
vi.mock('../../api', async (importOriginal) => ({
	...(await importOriginal<typeof import('../../api')>()),
	apiGetAskerSessionList: askerList,
	apiGetConsultantSessionList: consultantList
}));
const sessionRooms = vi.hoisted(() => vi.fn());
vi.mock('../../api/apiGetSessionRooms', () => ({
	apiGetSessionRoomsByRoomIds: sessionRooms
}));
vi.mock('../../api/apiUserDrafts', async (importOriginal) => ({
	...(await importOriginal<typeof import('../../api/apiUserDrafts')>()),
	apiGetUserDrafts: async () => ({ items: [], page: 0, perPage: 200 })
}));
vi.mock('../../api/apiSetLiveChatAvailability', async (importOriginal) => ({
	...(await importOriginal<
		typeof import('../../api/apiSetLiveChatAvailability')
	>()),
	apiGetLiveChatAvailability: async () => false
}));
vi.mock('../../globalState', async (importOriginal) => ({
	...(await importOriginal<typeof import('../../globalState')>()),
	useTenant: () => ({}),
	useConsultingType: () => ({ registration: { autoSelectPostcode: false } }),
	useTopic: () => null
}));
vi.mock('../../hooks/useE2EE', () => ({
	useE2EE: () => ({ key: null, keyID: null, encrypted: false, ready: true })
}));
vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

afterEach(() => {
	cleanup();
});

const inRoom = (id: number, matrixRoomId: string) => ({
	...fresh,
	session: { ...fresh.session, id, matrixRoomId }
});

const fresh = {
	agency: { id: 9, name: 'Test agency' } as any,
	consultant: null,
	user: { username: 'asker', sessionData: {} },
	session: {
		id: 501,
		agencyId: 9,
		consultingType: 1,
		status: 0,
		matrixRoomId: null,
		messageDate: null,
		createDate: '2026-11-01T10:00:00Z',
		messagesRead: true,
		registrationType: 'REGISTERED',
		postcode: 12345,
		lastMessage: null,
		topic: { id: 3, name: 'Test topic', description: '' }
	}
};

const renderAsker = (path = '/sessions/user/view') =>
	render(
		<MemoryRouter initialEntries={[path]}>
			<UserDataContext.Provider
				value={
					{
						userData: {
							userId: 'asker-1',
							userName: 'asker',
							userRoles: ['user'],
							grantedAuthorities: ['AUTHORIZATION_USER_DEFAULT'],
							agencies: []
						}
					} as any
				}
			>
				<SessionTypeContext.Provider
					value={{
						type: SESSION_LIST_TYPES.MY_SESSION,
						path: '/sessions/user/view'
					}}
				>
					<SessionsDataProvider>
						<E2EEContext.Provider
							value={{
								key: null,
								reloadPrivateKey: () => {},
								isE2eeEnabled: false,
								e2EEReady: true
							}}
						>
							<LegalLinksContext.Provider value={[]}>
								<SessionsList
									defaultLanguage="de"
									sessionTypes={[] as any}
								/>
							</LegalLinksContext.Provider>
						</E2EEContext.Provider>
					</SessionsDataProvider>
				</SessionTypeContext.Provider>
			</UserDataContext.Provider>
		</MemoryRouter>
	);

/*
 * #2480: on page load the Matrix sync replays many messages per room, and
 * every one of them asked the UserService for its room on its own (104
 * single-room requests for 14 rooms on one counsellor load on Dev). A burst
 * now becomes one batched lookup for the rooms involved.
 */
it('looks up the rooms of a message burst with one batched request', async () => {
	askerList.mockReset();
	consultantList.mockReset();
	sessionRooms.mockReset();
	const loaded = [inRoom(501, '!r1:oriso'), inRoom(502, '!r2:oriso')];
	askerList.mockResolvedValue({ sessions: loaded });
	sessionRooms.mockImplementation(async (roomIds: string[]) => ({
		sessions: loaded.filter((s) => roomIds.includes(s.session.matrixRoomId))
	}));
	renderAsker('/sessions/user/view/session/501');
	// One "write enquiry" row per loaded conversation.
	const rows = () =>
		document.body.textContent?.match(/sessionList\.user\.writeEnquiry/g)
			?.length ?? 0;
	await waitFor(() => expect(rows()).toBe(2));

	act(() => {
		for (let i = 0; i < 20; i += 1) {
			messageEventEmitter.emit({
				roomId: '!r1:oriso',
				timestamp: 1_000 + i
			});
			messageEventEmitter.emit({
				roomId: '!r2:oriso',
				timestamp: 1_000 + i
			});
		}
	});

	await waitFor(() => expect(sessionRooms).toHaveBeenCalled());
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 400));
	});
	expect(sessionRooms).toHaveBeenCalledOnce();
	expect([...sessionRooms.mock.calls[0][0]].sort()).toEqual([
		'!r1:oriso',
		'!r2:oriso'
	]);
});
