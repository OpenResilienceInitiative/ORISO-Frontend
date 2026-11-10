// @vitest-environment oriso-jsdom
import * as React from 'react';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import {
	apiCreateGroupChat,
	apiUpdateGroupChat
} from '../../api/apiGroupChatSettings';
import { apiGetSessionRoomsByRoomIds } from '../../api/apiGetSessionRooms';
import { apiGetTenantConsultantList } from '../../api/apiGetAgencyConsultantList';
import { loadInternalChatColleagues } from './internal/loadInternalChatColleagues';
import { useSession } from '../../hooks/useSession';
import { UserDataContext, SessionsDataContext } from '../../globalState';
import { CreateConversationView } from './CreateConversationView';
import { CREATE_CHAT_PATH } from '../app/routePaths';
import { conversationAgency } from '../../test/fixtures/conversationPolicyFixtures';
import { resetCounsellorAgencyFormatsForTests } from '../../hooks/useCounsellorAgencyFormats';

// react-i18next: identity translator so we can assert on keys.
vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: 'de', resolvedLanguage: 'de' }
	})
}));

// The globalState barrel pulls lottie-web (crashes in jsdom): stub the parts
// the flow reads. Contexts are created inside the factory (hoisted) and read
// back through the mocked module below.
vi.mock('../../globalState', async () => {
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const react = require('react');
	// The real user-data context: the agency-settings hook reads it through
	// its direct module path, so the flow and the hook must share it.
	const { UserDataContext } = await vi.importActual<any>(
		'../../globalState/context/UserDataContext'
	);
	const tenant = {
		settings: { featureGroupChatV2Enabled: true, activeLanguages: ['de'] },
		// These tests pick colleagues from the Träger's directory; the scope
		// itself is covered in CreateConversationView.internalSubset.test.tsx.
		internalGroupChat: { recipientScope: { value: 'TENANT' } }
	};
	return {
		UserDataContext,
		NotificationsContext: react.createContext(null),
		SessionsDataContext: react.createContext({ dispatch: () => {} }),
		UPDATE_SESSIONS: 'UPDATE_SESSIONS',
		useTenant: () => tenant,
		useTenantState: () => ({ tenant, isLoading: false })
	};
});

vi.mock('../app/navigationHandler', () => ({
	desktopView: vi.fn(),
	mobileDetailView: vi.fn(),
	mobileListView: vi.fn()
}));
vi.mock('../../hooks/useResponsive', () => ({
	useResponsive: () => ({ fromL: true })
}));
vi.mock('../../hooks/useSession', () => ({ useSession: vi.fn() }));
vi.mock('../../api/apiGetAgencyConsultantList', () => ({
	apiGetTenantConsultantList: vi.fn().mockResolvedValue([])
}));
vi.mock('./internal/loadInternalChatColleagues', () => ({
	loadInternalChatColleagues: vi.fn().mockResolvedValue([])
}));
vi.mock('../../resources/img/icons/group-chat-avatar.svg', () => ({
	ReactComponent: () => null,
	default: () => null
}));
vi.mock('../../resources/img/illustrations/Team.svg', () => ({
	ReactComponent: () => null,
	default: () => null
}));
// Confirmed legacy agencies without settings preserve tenant hard caps.
vi.mock('../../api/apiGetAgenciesByIds', () => ({
	apiGetAgenciesByIds: vi.fn(async (ids: number[]) =>
		ids.map((id) => ({ ...conversationAgency(id), settings: null }))
	)
}));
vi.mock('../../api/apiGetTenantAgenciesTopics', () => ({
	apiGetTenantAgenciesTopics: vi.fn().mockResolvedValue([])
}));
vi.mock('../../api/apiGroupChatSettings', () => ({
	apiCreateGroupChat: vi.fn(),
	apiUpdateGroupChat: vi.fn()
}));
vi.mock('../../api/apiGetSessionRooms', () => ({
	apiGetSessionRoomsByRoomIds: vi.fn()
}));

// Vitest has no SVGR transform, so `ReactComponent` named imports resolve to
// undefined and break rendering. Stub the SVGs used in the edit render path.
vi.mock('../../resources/img/icons/arrow-left.svg', () => ({
	ReactComponent: () => null,
	default: () => null
}));
vi.mock('../../resources/img/icons/persons.svg', () => ({
	ReactComponent: () => null,
	default: () => null
}));
vi.mock('../../resources/img/illustrations/active-createGroup.svg', () => ({
	ReactComponent: () => null,
	default: () => null
}));
vi.mock('../../resources/img/icons/keyboard_arrow_down.svg', () => ({
	ReactComponent: () => null,
	default: () => null
}));
vi.mock('../../resources/img/icons/plus-mui.svg', () => ({
	ReactComponent: () => null,
	default: () => null
}));
vi.mock('../../resources/img/icons/stack-vertical.svg', () => ({
	ReactComponent: () => null,
	default: () => null
}));
vi.mock('../../resources/img/icons/category-search.svg', () => ({
	ReactComponent: () => null,
	default: () => null
}));
vi.mock('../../resources/img/icons/diversity-2.svg', () => ({
	ReactComponent: () => null,
	default: () => null
}));
vi.mock('../../resources/img/icons/self-help-group.svg', () => ({
	ReactComponent: () => null,
	default: () => null
}));
vi.mock('../../resources/img/icons/internal-conversation.svg', () => ({
	ReactComponent: () => null,
	default: () => null
}));
vi.mock('../../resources/img/icons/calendar.svg', () => ({
	ReactComponent: () => null,
	default: () => null
}));
vi.mock('../../resources/img/icons/clock.svg', () => ({
	ReactComponent: () => null,
	default: () => null
}));
vi.mock('../../resources/img/icons/reload.svg', () => ({
	ReactComponent: () => null,
	default: () => null
}));
vi.mock('../../resources/img/icons/language_outline.svg', () => ({
	ReactComponent: () => null,
	default: () => null
}));
vi.mock('../../resources/img/icons/keyboard_arrow_up.svg', () => ({
	ReactComponent: () => null,
	default: () => null
}));
vi.mock('../../resources/img/icons/check.svg', () => ({
	ReactComponent: () => null,
	default: () => null
}));
vi.mock('../../resources/img/icons/close.svg', () => ({
	ReactComponent: () => null,
	default: () => null
}));

const listPath = '/sessions/consultant/sessionView';
const editorPath = `${listPath}/group-1/77/editGroupChat`;
const nextEditorPath = `${listPath}/group-2/78/editGroupChat`;
let entryPath = editorPath;

const editSeriesItem = {
	id: 77,
	matrixRoomId: 'group-1',
	active: false,
	topic: 'Existing circle',
	duration: 60,
	startDate: '2026-08-01',
	startDateWithTime: '2026-08-01T10:00:00.000Z',
	repeatCount: 1,
	chatInterval: 'WEEKLY',
	modality: 'TEXT',
	hintMessage: 'Welcome',
	sourceLanguage: 'de',
	hintMessageTranslations: { de: 'Welcome' },
	groupChatRulesTranslations: { de: ['Be kind'] },
	participants: [
		{ consultantId: 'me', role: 'OWNER' },
		{ consultantId: 'c-9', role: 'CO_MODERATOR' }
	],
	assignedAgencies: [{ id: 5 }]
};

const sessionResult = (
	item = editSeriesItem,
	consultantId = 'me',
	isGroup = true
): ReturnType<typeof useSession> => ({
	session: { isGroup, item, consultant: { id: consultantId } } as any,
	reload: vi.fn(),
	read: vi.fn(),
	ready: true
});

const renderInUserContext = (
	agencies: { id: number; name: string }[] = [{ id: 5, name: 'Agency Five' }],
	userId = 'me'
) =>
	render(
		<UserDataContext.Provider value={{ userData: { userId, agencies } }}>
			<SessionsDataContext.Provider value={{ dispatch: vi.fn() }}>
				<MemoryRouter initialEntries={[entryPath]}>
					<Routes>
						<Route
							path={`${listPath}/:groupId/:sessionId/editGroupChat`}
							element={
								<>
									<Link to={nextEditorPath}>
										Next editor route
									</Link>
									<CreateConversationView />
								</>
							}
						/>
						<Route
							path={CREATE_CHAT_PATH}
							element={<CreateConversationView />}
						/>
						<Route
							path={`${listPath}/chat/77`}
							element={<p>Normal group 77</p>}
						/>
						<Route
							path={listPath}
							element={<p>Own conversations</p>}
						/>
					</Routes>
				</MemoryRouter>
			</SessionsDataContext.Provider>
		</UserDataContext.Provider>
	);

describe('CreateConversationView edit mode (finding 1)', () => {
	afterEach(() => {
		cleanup();
		resetCounsellorAgencyFormatsForTests();
		vi.clearAllMocks();
	});

	beforeEach(() => {
		entryPath = editorPath;
	});

	it('prefills the existing series and updates instead of creating', async () => {
		vi.mocked(useSession).mockReturnValue(sessionResult());
		vi.mocked(apiUpdateGroupChat).mockResolvedValue({
			matrixRoomId: '!room:matrix.example'
		});
		vi.mocked(apiGetSessionRoomsByRoomIds).mockResolvedValue({
			sessions: []
		} as any);

		renderInUserContext();

		// The persisted topic is prefilled and shown on the topic row.
		expect(await screen.findByText('Existing circle')).toBeTruthy();
		expect(useSession).toHaveBeenLastCalledWith('group-1');

		// Save routes to the update endpoint for the routed chat id (77), never
		// to create (which is what the pre-fix route did, duplicating the chat).
		fireEvent.click(
			screen.getByRole('button', { name: 'groupChat.circle.saveLabel' })
		);

		await waitFor(() =>
			expect(apiUpdateGroupChat).toHaveBeenCalledTimes(1)
		);
		expect(apiUpdateGroupChat.mock.calls[0][0]).toBe(77);
		expect(apiUpdateGroupChat.mock.calls[0][1]).toMatchObject({
			topic: 'Existing circle'
		});
		expect(apiCreateGroupChat).not.toHaveBeenCalled();
	});

	// #1499: the session API sends the group's wall clock as startDate +
	// startTime (+ timezone) and never startDateWithTime.
	const apiSeriesItem = {
		...editSeriesItem,
		startDate: '2026-09-25',
		startDateWithTime: undefined,
		startTime: '16:42:00',
		timezone: 'Europe/Berlin',
		repetitive: false,
		repeatCount: 1,
		chatInterval: null
	};

	const saveUnchanged = async (item: typeof editSeriesItem) => {
		vi.mocked(useSession).mockReturnValue(sessionResult(item));
		vi.mocked(apiUpdateGroupChat).mockResolvedValue({
			matrixRoomId: '!room:matrix.example'
		});
		vi.mocked(apiGetSessionRoomsByRoomIds).mockResolvedValue({
			sessions: []
		} as any);

		renderInUserContext();
		fireEvent.click(
			await screen.findByRole('button', {
				name: 'groupChat.circle.saveLabel'
			})
		);
		await waitFor(() =>
			expect(apiUpdateGroupChat).toHaveBeenCalledTimes(1)
		);
		return apiUpdateGroupChat.mock.calls[0][1];
	};

	it('saves an untouched one-off group at its stored time (#1499)', async () => {
		const payload = await saveUnchanged(apiSeriesItem);

		expect(payload).toMatchObject({
			startDate: '2026-09-25',
			startTime: '16:42',
			timezone: 'Europe/Berlin',
			repeatCount: 1,
			repetitive: false
		});
		expect(payload).not.toHaveProperty('chatInterval');
	});

	it('shows a one-off group as one date, not as a weekly series (#1499)', async () => {
		await saveUnchanged(apiSeriesItem);

		expect(
			screen.queryByText('groupChat.create.interval.options.weekly')
		).toBeNull();
		expect(
			screen.getByText('groupChat.info.settings.repetition.single')
		).toBeTruthy();
	});

	it('keeps a repeating series, its interval and the group timezone on save', async () => {
		const payload = await saveUnchanged({
			...apiSeriesItem,
			startDate: '2026-10-20',
			startTime: '18:00:00',
			timezone: 'America/New_York',
			repetitive: true,
			repeatCount: 3,
			chatInterval: 'BIWEEKLY'
		});

		// Count and interval in one control: three dates, every two weeks.
		expect(
			screen.getByText('groupChat.circle.rows.repeatDates')
		).toBeTruthy();
		expect(
			screen.getByText('groupChat.create.interval.options.biweekly')
		).toBeTruthy();
		expect(payload).toMatchObject({
			startDate: '2026-10-20',
			startTime: '18:00',
			timezone: 'America/New_York',
			repeatCount: 3,
			chatInterval: 'BIWEEKLY'
		});
	});

	it('lets the owner add a co-moderator while editing a circle', async () => {
		vi.mocked(useSession).mockReturnValue(sessionResult());
		vi.mocked(apiGetTenantConsultantList).mockResolvedValue([
			{
				consultantId: 'c-2',
				firstName: 'Casey',
				lastName: 'Co-Moderator'
			}
		] as any);
		vi.mocked(apiUpdateGroupChat).mockResolvedValue({
			matrixRoomId: '!room:matrix.example'
		});
		vi.mocked(apiGetSessionRoomsByRoomIds).mockResolvedValue({
			sessions: []
		} as any);

		renderInUserContext();

		fireEvent.click(
			await screen.findByRole('button', {
				name: 'groupChat.circle.toggleModeratorList'
			})
		);
		fireEvent.click(
			await screen.findByRole('option', {
				name: 'groupChat.circle.selectModerator'
			})
		);
		fireEvent.click(
			screen.getByRole('button', { name: 'groupChat.circle.saveLabel' })
		);

		await waitFor(() =>
			expect(apiUpdateGroupChat).toHaveBeenCalledTimes(1)
		);
		expect(apiUpdateGroupChat.mock.calls[0][1]).toMatchObject({
			consultantIds: ['c-9', 'c-2']
		});
		expect(
			screen.queryByText('me', { selector: '.personChip__name' })
		).toBeNull();
	});

	it.each([
		['co-moderator', 'c-9', editSeriesItem],
		['active owner', 'me', { ...editSeriesItem, active: true }],
		[
			'internal group owner',
			'me',
			{ ...editSeriesItem, conversationType: 'INTERNAL_GROUP' }
		]
	])('returns the %s to the exact normal group', async (_, userId, item) => {
		vi.mocked(useSession).mockReturnValue(sessionResult(item));

		renderInUserContext(undefined, userId);

		expect(await screen.findByText('Normal group 77')).toBeTruthy();
		expect(screen.queryByText('Existing circle')).toBeNull();
		expect(apiGetTenantConsultantList).not.toHaveBeenCalled();
		expect(apiUpdateGroupChat).not.toHaveBeenCalled();
	});

	it.each([
		[
			'different room',
			sessionResult({ ...editSeriesItem, matrixRoomId: 'other' })
		],
		['different group', sessionResult({ ...editSeriesItem, id: 78 })],
		['individual conversation', sessionResult(editSeriesItem, 'me', false)],
		['failed', { ...sessionResult(), session: null }]
	])('returns a %s lookup to the safe list', async (_, result) => {
		vi.mocked(useSession).mockReturnValue(result);

		renderInUserContext();

		expect(await screen.findByText('Own conversations')).toBeTruthy();
		expect(screen.queryByText('Existing circle')).toBeNull();
		expect(apiGetTenantConsultantList).not.toHaveBeenCalled();
	});

	it('never requests the group when the route id is invalid', async () => {
		entryPath = `${listPath}/group-1/77invalid/editGroupChat`;
		vi.mocked(useSession).mockReturnValue(sessionResult());

		renderInUserContext();

		expect(await screen.findByText('Own conversations')).toBeTruthy();
		expect(useSession).not.toHaveBeenCalled();
	});

	it('waits for authoritative room hydration before mounting the editor', async () => {
		vi.mocked(useSession).mockReturnValue({
			...sessionResult(),
			ready: false
		});

		renderInUserContext();

		await waitFor(() => expect(useSession).toHaveBeenCalled());
		expect(screen.queryByText('Existing circle')).toBeNull();
		expect(apiGetTenantConsultantList).not.toHaveBeenCalled();
		expect(useSession).toHaveBeenLastCalledWith('group-1');
	});

	it('never displays a stale prefill while a changed room is loading', async () => {
		vi.mocked(useSession).mockImplementation((roomId) => ({
			...sessionResult(),
			ready: roomId === 'group-1'
		}));

		renderInUserContext();
		expect(await screen.findByText('Existing circle')).toBeTruthy();
		fireEvent.click(
			screen.getByRole('link', { name: 'Next editor route' })
		);

		await waitFor(() =>
			expect(screen.queryByText('Existing circle')).toBeNull()
		);
		expect(useSession).toHaveBeenLastCalledWith('group-2');
	});
});

describe('CreateConversationView internal card (finding 2)', () => {
	afterEach(() => {
		cleanup();
		resetCounsellorAgencyFormatsForTests();
		vi.clearAllMocks();
	});

	beforeEach(() => {
		// Create route: no edit params.
		entryPath = CREATE_CHAT_PATH;
		vi.mocked(useSession).mockReturnValue({
			session: null as any,
			reload: vi.fn(),
			read: vi.fn(),
			ready: false
		});
		vi.mocked(loadInternalChatColleagues).mockResolvedValue([
			{ consultantId: 'p1', displayName: 'Pat One', agencies: [] },
			{ consultantId: 'p2', displayName: 'Sam Two', agencies: [] }
		]);
	});

	it('loads colleagues when the selected agency id is zero', async () => {
		renderInUserContext([{ id: 0, name: 'Agency Zero' }]);

		await waitFor(() =>
			expect(loadInternalChatColleagues).toHaveBeenCalledTimes(1)
		);
	});

	it('does not load colleagues without a selected agency', async () => {
		renderInUserContext([]);

		await waitFor(() =>
			expect(loadInternalChatColleagues).not.toHaveBeenCalled()
		);
	});

	it('clears the selected colleagues when the agency changes', async () => {
		renderInUserContext([
			{ id: 1, name: 'Agency One' },
			{ id: 2, name: 'Agency Two' }
		]);

		// Pick the first agency so the consultant list loads.
		fireEvent.mouseDown((await screen.findAllByRole('combobox'))[0]);
		fireEvent.click(
			await screen.findByRole('option', { name: 'Agency One' })
		);

		// Wait for the colleague list to load for the picked agency.
		await waitFor(() =>
			expect(loadInternalChatColleagues).toHaveBeenCalled()
		);
		// Open the person list and select the first colleague.
		fireEvent.click(
			screen.getByRole('button', {
				name: 'groupChat.internal.togglePersonList'
			})
		);
		const options = await screen.findAllByRole('option');
		fireEvent.click(options[0]);

		// The split button now reflects a selected participant.
		await screen.findByText('groupChat.internal.personCount');

		// Switch agency: the previously selected colleague must be dropped so it
		// cannot leak into a chat for the new agency (finding 2).
		fireEvent.mouseDown(screen.getAllByRole('combobox')[0]);
		fireEvent.click(
			await screen.findByRole('option', { name: 'Agency Two' })
		);

		await waitFor(() =>
			expect(
				screen.queryByText('groupChat.internal.personCount')
			).toBeNull()
		);
		expect(screen.getByText('groupChat.internal.addPerson')).toBeTruthy();
	});
});
