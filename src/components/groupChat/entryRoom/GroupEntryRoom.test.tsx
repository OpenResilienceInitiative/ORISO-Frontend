// @vitest-environment jsdom

import * as React from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const navigate = vi.fn();
vi.mock('react-router-dom', async () => {
	const actual =
		await vi.importActual<typeof import('react-router-dom')>(
			'react-router-dom'
		);
	return { ...actual, useNavigate: () => navigate };
});

const sessionState = vi.hoisted(() => ({
	ready: true,
	item: {
		id: 15,
		active: false,
		matrixRoomId: '!room:oriso',
		consultingType: 1,
		topic: 'Trauerbegleitung',
		assignedAgencies: [{ name: 'Caritas Berlin' }],
		startDate: '2026-09-07',
		startTime: '18:00',
		duration: 90,
		hintMessage: 'Willkommen.'
	} as Record<string, unknown> | null
}));
vi.mock('../../../hooks/useSession', () => ({
	useSession: () => ({
		session: sessionState.item
			? { item: sessionState.item, rid: '!room:oriso' }
			: null,
		ready: sessionState.ready,
		reload: vi.fn(),
		read: vi.fn()
	})
}));
vi.mock('../../../api', () => ({
	apiGetGroupChatInfo: vi.fn(() =>
		Promise.resolve({ active: false, id: 15, matrixRoomId: '!room:oriso' })
	),
	apiPutGroupChat: vi.fn(() => Promise.resolve()),
	GROUP_CHAT_API: { JOIN: '/join', ASSIGN: '/assign' }
}));
vi.mock('../useGroupChatAuthorContent', () => ({
	useGroupChatAuthorContent: () => ({
		hintMessage: 'Willkommen.',
		rules: ['Regel eins']
	})
}));
vi.mock('./GroupWaitingRoom', () => ({
	GroupWaitingRoom: (props: {
		topicName?: string;
		agencyName?: string;
		active: boolean;
		onJoin: () => void;
	}) => (
		<div data-testid="waiting-room">
			<span>{props.topicName}</span>
			<span>{props.agencyName}</span>
			<button onClick={props.onJoin} disabled={!props.active}>
				join
			</button>
		</div>
	)
}));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (_key: string, fallback?: string) => fallback ?? _key
	})
}));

const { GroupEntryRoom } = await import('./GroupEntryRoom');
const { apiPutGroupChat } = await import('../../../api');

const renderRoom = () =>
	render(
		<MemoryRouter initialEntries={['/groups/15/entry']}>
			<Routes>
				<Route
					path="/groups/:chatId/entry"
					element={<GroupEntryRoom />}
				/>
			</Routes>
		</MemoryRouter>
	);

describe('GroupEntryRoom', () => {
	afterEach(cleanup);
	beforeEach(() => {
		vi.clearAllMocks();
		sessionState.ready = true;
		sessionState.item = { ...sessionState.item, active: false };
	});

	it('feeds the room from the chat: topic and agency come from the item', () => {
		renderRoom();
		const room = screen.getByTestId('waiting-room');
		expect(room.textContent).toContain('Trauerbegleitung');
		expect(room.textContent).toContain('Caritas Berlin');
	});

	it('joins on "Beitreten" and hands over to the chat route', async () => {
		sessionState.item = { ...sessionState.item, active: true };
		renderRoom();
		fireEvent.click(screen.getByText('join'));
		await waitFor(() =>
			expect(apiPutGroupChat).toHaveBeenCalledWith(15, '/join')
		);
		await waitFor(() =>
			expect(navigate).toHaveBeenCalledWith(
				'/sessions/user/view/!room%3Aoriso/15',
				{ replace: true }
			)
		);
	});

	it('says so when the chat is gone', () => {
		sessionState.item = null;
		renderRoom();
		expect(screen.getByText(/gibt es nicht mehr/)).toBeTruthy();
	});
});
