// @vitest-environment jsdom

import * as React from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	SessionsDataContext,
	SessionTypeContext,
	TenantContext,
	UserDataContext
} from '../../globalState';
import {
	SESSION_LIST_TYPES,
	SESSION_TYPE_SESSION
} from '../session/sessionHelpers';
import { SessionListViewStateProvider } from './SessionListViewStateContext';
import { SessionsList } from './SessionsList';

const batchState = vi.hoisted(() => ({
	close: vi.fn(),
	error: undefined as unknown,
	outcome: null as any,
	submit: vi.fn(),
	submitting: false
}));

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));
vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('./useCaseHandoverBatch', () => ({
	useCaseHandoverBatch: vi.fn(() => batchState)
}));
vi.mock('../../api', () => ({
	apiGetAskerSessionList: vi
		.fn()
		.mockResolvedValue({ sessions: [], total: 0 }),
	apiGetCaseHandoverCandidates: vi.fn().mockResolvedValue({ sessions: [] }),
	apiGetCaseHandoverReasons: vi.fn().mockResolvedValue([
		{
			code: 'OTHER_EMERGENCY',
			label: 'Emergency',
			clientConsentRequired: false
		}
	]),
	apiGetConsultantSessionList: vi
		.fn()
		.mockResolvedValue({ sessions: [], total: 0 }),
	FETCH_ERRORS: { ABORT: 'ABORT' },
	SESSION_COUNT: 30
}));
vi.mock('../../api/apiGetSessionRooms', () => ({
	apiGetSessionRoomsByRoomIds: vi.fn().mockResolvedValue([])
}));
vi.mock('../../api/apiGetChatRoomById', () => ({
	apiGetChatRoomById: vi.fn().mockResolvedValue({ sessions: [] })
}));
vi.mock('../../api/apiUserDrafts', () => ({
	apiGetUserDrafts: vi.fn().mockResolvedValue({ items: [] })
}));
vi.mock('../../hooks/useWatcher', () => ({
	useWatcher: () => [vi.fn(), vi.fn(), false]
}));
vi.mock('../../hooks/useUnreadVersion', () => ({ useUnreadVersion: () => 0 }));
vi.mock('../../utils/liveChatToggle', () => ({
	useLiveChatAvailable: () => [true]
}));
vi.mock('../../services/matrixLiveEventBridge', () => ({
	matrixLiveEventBridge: {
		getClient: () => null,
		subscribe: () => () => undefined
	}
}));
vi.mock('../../services/messageEventEmitter', () => ({
	messageEventEmitter: { on: vi.fn(), off: vi.fn() }
}));
vi.mock('./SessionsListToolbar', () => ({
	SessionsListToolbar: () => null,
	buildArchiveTabPath: () => '/archive',
	buildCreateGroupChatPath: () => '/create'
}));
vi.mock('./FutureTimelinePanel', () => ({ FutureTimelinePanel: () => null }));
vi.mock('../sessionsListItem/SessionListItemSkeleton', () => ({
	SessionsListSkeleton: () => null
}));
vi.mock('../session/CaseHandoverCurtain', () => ({
	CaseHandoverCurtainView: (props: any) => (
		<div data-testid="batch-review">
			<button onClick={() => props.onReasonSelect('OTHER_EMERGENCY')}>
				reason
			</button>
			<button onClick={props.onNext}>next</button>
			<button onClick={() => props.onExplanationChange('Cover')}>
				explanation
			</button>
			<button onClick={props.onSubmit}>submit-batch</button>
		</div>
	)
}));
vi.mock('../sessionsListItem/SessionListItemComponent', () => ({
	SessionListItemComponent: (props: any) => (
		<div>
			<div data-testid={`selected-${props.index}`}>
				{String(props.caseHandoverSelected)}
			</div>
			<button onClick={props.onCaseHandoverBatchStart}>
				start-batch
			</button>
			<button onClick={() => props.onCaseHandoverSelect(props.index + 1)}>
				select-{props.index + 1}
			</button>
			<button onClick={props.onCaseHandoverBatchConfirm}>
				review-batch
			</button>
		</div>
	)
}));

const sessions = [1, 2].map((id) => ({
	session: {
		id,
		status: 'IN_PROGRESS',
		active: true,
		matrixRoomId: `!room-${id}:test`,
		topic: { id: 1, name: 'Topic' }
	},
	consultant: { id: 'c1' },
	user: { id: `u${id}` }
})) as any;

const ListTree = () => (
	<MemoryRouter initialEntries={['/sessions/consultant/sessionView']}>
		<TenantContext.Provider value={{ tenant: { settings: {} } } as any}>
			<UserDataContext.Provider
				value={
					{
						userData: { userId: 'c1', grantedAuthorities: [] }
					} as any
				}
			>
				<SessionTypeContext.Provider
					value={{
						type: SESSION_LIST_TYPES.MY_SESSION,
						path: '/sessions/consultant/sessionView'
					}}
				>
					<SessionsDataContext.Provider
						value={{ sessions, ready: true, dispatch: vi.fn() }}
					>
						<SessionListViewStateProvider>
							<SessionsList
								defaultLanguage="en"
								sessionTypes={[SESSION_TYPE_SESSION] as any}
							/>
						</SessionListViewStateProvider>
					</SessionsDataContext.Provider>
				</SessionTypeContext.Provider>
			</UserDataContext.Provider>
		</TenantContext.Provider>
	</MemoryRouter>
);

const renderList = () => render(<ListTree />);

describe('SessionsList case handover batch seam', () => {
	afterEach(cleanup);
	beforeEach(() => {
		vi.clearAllMocks();
		batchState.error = undefined;
		batchState.outcome = null;
		batchState.submitting = false;
	});

	it('passes the selected sessions to the bounded batch owner and retains partial failures', async () => {
		const view = renderList();
		await screen.findAllByText('start-batch');
		fireEvent.click(screen.getAllByText('start-batch')[0]);
		fireEvent.click(screen.getAllByText('select-1')[0]);
		fireEvent.click(screen.getAllByText('select-2')[0]);
		fireEvent.click(screen.getAllByText('review-batch')[0]);
		fireEvent.click(await screen.findByText('reason'));
		fireEvent.click(screen.getByText('next'));
		fireEvent.click(screen.getByText('explanation'));
		fireEvent.click(screen.getByText('submit-batch'));

		expect(batchState.submit).toHaveBeenCalledWith(
			[1, 2],
			'OTHER_EMERGENCY',
			'Cover'
		);
		batchState.outcome = {
			granted: 1,
			pending: 0,
			denied: 0,
			failed: 1,
			unresolvedSessionIds: [2]
		};
		view.rerender(<ListTree />);
		await waitFor(() =>
			expect(screen.getAllByTestId('selected-1')[0].textContent).toBe(
				'true'
			)
		);
		expect(screen.getAllByTestId('selected-0')[0].textContent).toBe(
			'false'
		);
	});
});
