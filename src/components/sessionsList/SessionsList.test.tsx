// @vitest-environment oriso-jsdom

import * as React from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import {
	ActiveSessionContext,
	SessionsDataContext,
	SessionTypeContext,
	TenantContext,
	UserDataContext
} from '../../globalState';
import { STATUS_ENQUIRY } from '../../globalState/interfaces';
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
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: 'de' }
	})
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
const futureState = vi.hoisted(() => ({ entries: [] as any[] }));
vi.mock('./timeline/useFutureEntries', () => ({
	FUTURE_MONTHS: 3,
	useFutureEntries: () => ({
		entries: futureState.entries,
		markCancelled: () => undefined
	})
}));
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
const SessionRowId = () => {
	const { activeSession } = React.useContext(ActiveSessionContext);
	return <span data-testid="session-row">{activeSession?.item?.id}</span>;
};
vi.mock('../sessionsListItem/SessionListItemComponent', () => ({
	SessionListItemComponent: (props: any) => (
		<div>
			<SessionRowId />
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

const sessionListPaths = {
	[SESSION_LIST_TYPES.MY_SESSION]: '/sessions/consultant/sessionView',
	[SESSION_LIST_TYPES.ENQUIRY]: '/sessions/consultant/sessionPreview'
};

const ListTree = ({
	rows = sessions,
	type = SESSION_LIST_TYPES.MY_SESSION,
	chip
}: {
	rows?: typeof sessions;
	type?: SESSION_LIST_TYPES;
	chip?: 'liveChat';
}) => (
	<MemoryRouter
		initialEntries={[
			sessionListPaths[type] + (chip ? `?chip=${chip}` : '')
		]}
	>
		<TenantContext.Provider value={{ tenant: { settings: {} } } as any}>
			<UserDataContext.Provider
				value={
					{
						userData: { userId: 'c1', grantedAuthorities: [] }
					} as any
				}
			>
				<SessionTypeContext.Provider
					value={{ type, path: sessionListPaths[type] }}
				>
					<SessionsDataContext.Provider
						value={{
							sessions: rows,
							ready: true,
							dispatch: vi.fn()
						}}
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

describe('SessionsList future zone (ADR-021)', () => {
	afterEach(() => {
		cleanup();
		futureState.entries = [];
	});

	it('shows no zone without planned appointments', async () => {
		renderList();
		await screen.findAllByText('start-batch');
		expect(
			document.querySelector('[data-cy="sessions-list-timeline"]')
		).toBeNull();
	});

	it('shows a booking without a room as its own pill above "Jetzt"', async () => {
		futureState.entries = [
			{
				key: 'booking-7',
				kind: 'one-to-one',
				title: 'Ratsuchende A',
				start: new Date(Date.now() + 86_400_000),
				modality: 'video',
				canDuplicate: false,
				booking: { id: 7, uid: 'uid-7' }
			}
		];
		renderList();
		await screen.findAllByText('start-batch');
		const zone = document.querySelector(
			'[data-cy="sessions-list-timeline"]'
		);
		expect(zone).not.toBeNull();
		expect(
			zone!.querySelector(
				'[data-cy="timeline-entry"][data-unmapped="true"]'
			)?.textContent
		).toContain('Ratsuchende A');
		expect(zone!.querySelector('[data-cy="timeline-now"]')).not.toBeNull();
	});
});

describe('SessionsList first enquiry order', () => {
	afterEach(cleanup);

	const firstRequest = (
		id: number,
		createDate: string,
		conversationType: string
	) => ({
		session: { id, createDate, conversationType, status: STATUS_ENQUIRY },
		user: { id: `u${id}` }
	});
	const rows = [
		firstRequest(20, '2026-11-04T12:04:00Z', 'LIVE_CHAT'),
		firstRequest(41, '2026-11-04T12:01:00Z', 'AGENCY_COUNSELLING'),
		firstRequest(10, '2026-11-04T12:02:00.000', 'LIVE_CHAT'),
		firstRequest(2, '2026-11-04T12:02:00Z', 'LIVE_CHAT'),
		firstRequest(42, '2026-11-04T12:03:00Z', 'AGENCY_COUNSELLING')
	];
	const renderedRowIds = async () =>
		(await screen.findAllByTestId('session-row')).map(
			(row) => row.textContent
		);

	it('puts the oldest Live Chat first with numeric ID ties', async () => {
		render(
			<ListTree
				rows={rows}
				type={SESSION_LIST_TYPES.ENQUIRY}
				chip="liveChat"
			/>
		);

		expect(await renderedRowIds()).toEqual(['2', '10', '20']);
	});

	it('keeps the newest Mail enquiry first', async () => {
		render(<ListTree rows={rows} type={SESSION_LIST_TYPES.ENQUIRY} />);

		expect(await renderedRowIds()).toEqual(['42', '41']);
	});
});
