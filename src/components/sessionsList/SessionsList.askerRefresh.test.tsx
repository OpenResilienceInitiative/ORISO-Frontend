// @vitest-environment oriso-jsdom
import React from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
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
vi.mock('../../api/apiGetSessionRooms', () => ({
	apiGetSessionRoomsByRoomIds: async () => ({ sessions: [] })
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

const rowCount = (container: HTMLElement) =>
	container.querySelectorAll('.sessionsListItem').length;

/*
 * OBP 2.1 #3: right after registration the asker's first list request can
 * come back empty (the app asks while the new account is still settling).
 * The list must not stay on "keine aktiven Beratungen" until a reload: the
 * refreshes it already has (a message from a room it does not know, a
 * refresh signal) have to ask the asker endpoint, not the counsellor one.
 */
it('shows the new conversation after a message from its room when the first asker list was empty', async () => {
	askerList.mockReset();
	consultantList.mockReset();
	askerList.mockResolvedValueOnce({ sessions: [] });
	askerList.mockResolvedValue({ sessions: [fresh] });
	consultantList.mockRejectedValue(new Error('CATCH_ALL'));
	const view = renderAsker();
	await screen.findByText('sessionList.empty.mySessions');

	act(() => messageEventEmitter.emit({ roomId: '!new501:oriso' }));

	await waitFor(() => expect(rowCount(view.container)).toBe(1));
	expect(screen.queryByText('sessionList.empty.mySessions')).toBeNull();
	expect(askerList).toHaveBeenCalledTimes(2);
	expect(consultantList).not.toHaveBeenCalled();
});

it('refetches the asker list on a session-list refresh signal', async () => {
	askerList.mockReset();
	consultantList.mockReset();
	askerList.mockResolvedValueOnce({ sessions: [] });
	askerList.mockResolvedValue({ sessions: [fresh] });
	consultantList.mockRejectedValue(new Error('CATCH_ALL'));
	const view = renderAsker();
	await screen.findByText('sessionList.empty.mySessions');

	act(() => messageEventEmitter.emit({ refreshSessionList: true }));

	await waitFor(() => expect(rowCount(view.container)).toBe(1));
	expect(consultantList).not.toHaveBeenCalled();
});

it('keeps the loaded conversations when an asker refresh answers empty', async () => {
	askerList.mockReset();
	consultantList.mockReset();
	// apiGetAskerSessionList resolves an error to an empty list, so an empty
	// refresh answer cannot be told apart from a failed one.
	askerList.mockResolvedValueOnce({ sessions: [fresh] });
	askerList.mockResolvedValue({ sessions: [] });
	const view = renderAsker('/sessions/user/view/session/501');
	await waitFor(() => expect(rowCount(view.container)).toBe(1));

	act(() => messageEventEmitter.emit({ refreshSessionList: true }));

	await waitFor(() => expect(askerList).toHaveBeenCalledTimes(2));
	await act(async () => {});
	expect(rowCount(view.container)).toBe(1);
});
