// @vitest-environment oriso-jsdom

import * as React from 'react';
import {
	act,
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
	AUTHORITIES,
	ActiveSessionContext,
	SessionsDataProvider,
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
import { apiGetConsultantSessionList, SESSION_COUNT } from '../../api';

const batchState = vi.hoisted(() => ({
	close: vi.fn(),
	error: undefined as unknown,
	outcome: null as any,
	submit: vi.fn(),
	submitting: false
}));

afterEach(() => {
	batchState.outcome = null;
	batchState.error = undefined;
	batchState.submitting = false;
});

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
	SessionsListToolbar: ({
		showSupervisionChip,
		activeChip,
		onSearchChange
	}: {
		showSupervisionChip: boolean;
		activeChip: string | null;
		onSearchChange: (query: string) => void;
	}) => (
		<>
			<output data-testid="active-chip">{activeChip ?? 'all'}</output>
			<input
				aria-label="case-search"
				onChange={(event) => onSearchChange(event.target.value)}
			/>
			{showSupervisionChip ? <button>supervision-filter</button> : null}
		</>
	),
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
	SessionListItemComponent: (props: any) => {
		const { activeSession } = React.useContext(ActiveSessionContext);
		return (
			<div data-testid={`case-${activeSession?.item?.id}`}>
				<div data-testid={`selected-${props.index}`}>
					{String(props.caseHandoverSelected)}
				</div>
				<button onClick={props.onCaseHandoverBatchStart}>
					start-batch
				</button>
				<button
					onClick={() => props.onCaseHandoverSelect(props.index + 1)}
				>
					select-{props.index + 1}
				</button>
				<button onClick={props.onCaseHandoverBatchConfirm}>
					review-batch
				</button>
			</div>
		);
	}
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

const TestSessionSource = ({
	children,
	fetched,
	value
}: React.PropsWithChildren<{
	fetched: boolean;
	value: React.ContextType<typeof SessionsDataContext>;
}>) =>
	fetched ? (
		<SessionsDataProvider>{children}</SessionsDataProvider>
	) : (
		<SessionsDataContext.Provider value={value}>
			{children}
		</SessionsDataContext.Provider>
	);

const ListTree = ({
	supervisedByMe,
	consultant = false,
	initialPath = '/sessions/consultant/sessionView',
	ready = true,
	fetched = false
}: {
	supervisedByMe?: boolean;
	consultant?: boolean;
	initialPath?: string;
	ready?: boolean;
	fetched?: boolean;
} = {}) => (
	<MemoryRouter initialEntries={[initialPath]}>
		<TenantContext.Provider value={{ tenant: { settings: {} } } as any}>
			<UserDataContext.Provider
				value={
					{
						userData: {
							userId: 'c1',
							grantedAuthorities: consultant
								? [AUTHORITIES.CONSULTANT_DEFAULT]
								: []
						}
					} as any
				}
			>
				<SessionTypeContext.Provider
					value={{
						type: SESSION_LIST_TYPES.MY_SESSION,
						path: '/sessions/consultant/sessionView'
					}}
				>
					<TestSessionSource
						fetched={fetched}
						value={{
							sessions: sessions.map((raw) => ({
								...raw,
								session: {
									...raw.session,
									...(supervisedByMe === undefined
										? {}
										: { supervision: { supervisedByMe } })
								}
							})),
							ready,
							dispatch: vi.fn()
						}}
					>
						<SessionListViewStateProvider>
							<SessionsList
								defaultLanguage="en"
								sessionTypes={[SESSION_TYPE_SESSION] as any}
							/>
						</SessionListViewStateProvider>
					</TestSessionSource>
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

describe('Supervision filter availability (#1306)', () => {
	afterEach(cleanup);
	it('does not offer supervision to a consultant with no assigned supervised case', async () => {
		render(<ListTree consultant />);
		await screen.findAllByText('start-batch');
		expect(screen.queryByText('supervision-filter')).toBeNull();
	});
	it('offers supervision when the consultant has an explicitly supervised case', async () => {
		render(<ListTree consultant supervisedByMe />);
		expect(await screen.findByText('supervision-filter')).toBeTruthy();
	});
	it('clears a saved Supervision filter when the consultant has no supervised case', async () => {
		render(
			<ListTree
				consultant
				initialPath="/sessions/consultant/sessionView?chip=supervision"
			/>
		);
		await waitFor(() =>
			expect(screen.getByTestId('active-chip').textContent).toBe('all')
		);
	});
	it('clears Supervision when the last assignment disappears', async () => {
		const view = render(
			<ListTree
				consultant
				supervisedByMe
				initialPath="/sessions/consultant/sessionView?chip=supervision"
			/>
		);
		await waitFor(() =>
			expect(screen.getByTestId('active-chip').textContent).toBe(
				'supervision'
			)
		);
		view.rerender(
			<ListTree
				consultant
				supervisedByMe={false}
				initialPath="/sessions/consultant/sessionView?chip=supervision"
			/>
		);
		await waitFor(() =>
			expect(screen.getByTestId('active-chip').textContent).toBe('all')
		);
	});
	it('preserves a bookmarked filter until the session source is ready', async () => {
		const view = render(
			<ListTree
				consultant
				ready={false}
				initialPath="/sessions/consultant/sessionView?chip=supervision"
			/>
		);
		expect(screen.getByTestId('active-chip').textContent).toBe(
			'supervision'
		);
		view.rerender(
			<ListTree
				consultant
				supervisedByMe
				ready
				initialPath="/sessions/consultant/sessionView?chip=supervision"
			/>
		);
		expect(await screen.findByText('supervision-filter')).toBeTruthy();
		expect(screen.getByTestId('active-chip').textContent).toBe(
			'supervision'
		);
	});
});

describe('Supervision filter over fetched pages (#1306)', () => {
	const getList = vi.mocked(apiGetConsultantSessionList);
	const ordinary = (id: number) => ({
		...sessions[0],
		session: {
			...sessions[0].session,
			id,
			matrixRoomId: `!paged-${id}:test`
		},
		user: { id: `u${id}` }
	});
	const page = (offset: number) =>
		Array.from({ length: SESSION_COUNT }, (_, i) =>
			ordinary(offset + i + 1)
		);
	beforeEach(() => {
		getList.mockReset();
		getList.mockResolvedValue({ sessions: [], total: 0 });
		batchState.outcome = null;
		batchState.error = undefined;
		batchState.submitting = false;
	});
	afterEach(() => {
		cleanup();
		getList.mockResolvedValue({ sessions: [], total: 0 });
	});
	it('does not automatically scan remaining pages for an unmatched ordinary text search', async () => {
		const total = SESSION_COUNT * 3;
		getList.mockResolvedValue({ sessions: page(0), total });
		render(<ListTree consultant fetched />);
		expect(await screen.findByTestId('case-1')).toBeTruthy();
		await act(async () => {
			fireEvent.change(screen.getByLabelText('case-search'), {
				target: { value: 'no-such-counselling-case' }
			});
		});
		expect(screen.queryByTestId('case-1')).toBeNull();
		expect(getList.mock.calls.map(([request]) => request.offset)).toEqual([
			0
		]);
	});
	it('loads beyond two full ordinary pages without scrolling and retains the bookmarked filter until its assignment arrives', async () => {
		const total = SESSION_COUNT * 2 + 1;
		let finish!: (
			value: Awaited<ReturnType<typeof apiGetConsultantSessionList>>
		) => void;
		getList.mockResolvedValueOnce({ sessions: page(0), total });
		getList.mockResolvedValueOnce({ sessions: page(SESSION_COUNT), total });
		getList.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					finish = resolve;
				})
		);
		render(
			<ListTree
				consultant
				fetched
				initialPath="/sessions/consultant/sessionView?chip=supervision"
			/>
		);
		await waitFor(() => expect(getList).toHaveBeenCalledTimes(3));
		expect(screen.getByTestId('active-chip').textContent).toBe(
			'supervision'
		);
		const supervised = ordinary(total);
		supervised.session.supervision = {
			supervisedByMe: true,
			supervisorConsultantIds: ['c1']
		};
		await act(async () => finish({ sessions: [supervised], total }));
		expect(await screen.findByTestId(`case-${total}`)).toBeTruthy();
		expect(screen.queryByTestId('case-1')).toBeNull();
		expect(screen.getByTestId('active-chip').textContent).toBe(
			'supervision'
		);
		expect(getList.mock.calls.map(([request]) => request.offset)).toEqual([
			0,
			SESSION_COUNT,
			SESSION_COUNT * 2
		]);
	});
	it('clears an unavailable bookmark only after all pages are exhausted', async () => {
		const total = SESSION_COUNT + 1;
		getList.mockResolvedValueOnce({ sessions: page(0), total });
		getList.mockResolvedValueOnce({ sessions: [ordinary(total)], total });
		render(
			<ListTree
				consultant
				fetched
				initialPath="/sessions/consultant/sessionView?chip=supervision"
			/>
		);
		await waitFor(() => expect(getList).toHaveBeenCalledTimes(2));
		await waitFor(() =>
			expect(screen.getByTestId('active-chip').textContent).toBe('all')
		);
		expect(screen.getByTestId(`case-${total}`)).toBeTruthy();
		expect(getList.mock.calls.map(([request]) => request.offset)).toEqual([
			0,
			SESSION_COUNT
		]);
	});
	it('retains the bookmarked filter after a failed page and retries that offset', async () => {
		const total = SESSION_COUNT + 1;
		getList.mockResolvedValueOnce({ sessions: page(0), total });
		getList.mockRejectedValueOnce(new Error('page unavailable'));
		const supervised = ordinary(total);
		supervised.session.supervision = { supervisedByMe: true };
		getList.mockResolvedValueOnce({ sessions: [supervised], total });
		render(
			<ListTree
				consultant
				fetched
				initialPath="/sessions/consultant/sessionView?chip=supervision"
			/>
		);
		const retry = await screen.findByText('sessionList.reloadButton.label');
		expect(screen.getByTestId('active-chip').textContent).toBe(
			'supervision'
		);
		fireEvent.click(retry);
		expect(await screen.findByTestId(`case-${total}`)).toBeTruthy();
		expect(getList.mock.calls.map(([request]) => request.offset)).toEqual([
			0,
			SESSION_COUNT,
			SESSION_COUNT
		]);
	});
});
