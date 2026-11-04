// @vitest-environment oriso-jsdom

import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import {
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import { createInstance } from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import englishCatalogue from '../../../resources/i18n/en/common.json';
import { MatrixClientContext } from '../../../globalState/context/MatrixClientContext';
import { callManager } from '../../../services/CallManager';
import { GroupCallWidget } from '../GroupCallWidget';
import {
	FAKE_CALLER_USER_ID,
	FAKE_SIGNAL_ROOM_ID,
	makeFakeMatrixClientService,
	resetCallManager,
	seedIncomingElementCall
} from './groupCallHarness';

const sessionRooms = vi.hoisted(() => ({ byRoomIds: vi.fn() }));

vi.mock('../../../api/apiGetSessionRooms', () => ({
	apiGetSessionRoomsByRoomIds: sessionRooms.byRoomIds
}));

const conversationWith = (consultantMatrixUserId: string) => ({
	sessions: [
		{
			session: {
				id: 344,
				matrixRoomId: FAKE_SIGNAL_ROOM_ID,
				askerMatrixUserId: '@asker:matrix.storybook.test',
				consultantMatrixUserId
			},
			consultant: {
				consultantId: 'c-1',
				username: 'bart_getme_2fa',
				displayName: 'Bart Simpson',
				absent: false,
				absenceMessage: ''
			},
			user: { username: 'asker', sessionData: {} }
		}
	]
});

const testI18n = createInstance();

const renderIncoming = () =>
	render(
		<I18nextProvider i18n={testI18n}>
			<MatrixClientContext.Provider
				value={{
					matrixClientService:
						makeFakeMatrixClientService('incoming'),
					setMatrixClientService: () => {}
				}}
			>
				<GroupCallWidget />
			</MatrixClientContext.Provider>
		</I18nextProvider>
	);

// #780: the incoming-call popup showed "G" and "Someone is calling…".
describe('GroupCallWidget incoming call', () => {
	beforeAll(async () => {
		await testI18n.use(initReactI18next).init({
			lng: 'en',
			fallbackLng: 'en',
			defaultNS: 'common',
			resources: { en: { common: englishCatalogue } },
			interpolation: { escapeValue: false }
		});
	});

	beforeEach(() => {
		sessionRooms.byRoomIds.mockReset();
		resetCallManager();
		seedIncomingElementCall();
	});

	afterEach(() => {
		cleanup();
		callManager.endCall(false);
	});

	it('names the caller and draws their avatar, as the session list does', async () => {
		sessionRooms.byRoomIds.mockResolvedValue(
			conversationWith(FAKE_CALLER_USER_ID)
		);

		renderIncoming();

		// The card in the call language (FE#1904), named by the caller.
		const card = await screen.findByRole('alertdialog', {
			name: 'Bart Simpson'
		});
		expect(sessionRooms.byRoomIds).toHaveBeenCalledWith(
			[FAKE_SIGNAL_ROOM_ID],
			expect.anything()
		);
		expect(card.querySelector('[data-testid="user-avatar"]')).toBeTruthy();
		expect(screen.queryByText('G')).toBeNull();
	});

	it('keeps the generic line, without a letter, for a caller who is not a party', async () => {
		sessionRooms.byRoomIds.mockResolvedValue(
			conversationWith('@somebody-else:matrix.storybook.test')
		);

		renderIncoming();

		await waitFor(() => expect(sessionRooms.byRoomIds).toHaveBeenCalled());
		expect(screen.getByText('Someone is calling…')).toBeTruthy();
		expect(screen.queryByText('G')).toBeNull();
		expect(screen.queryByText(/Bart Simpson/)).toBeNull();
	});
});
