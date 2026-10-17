// @vitest-environment jsdom
/**
 * Case-handover search, seam 1 of FE#1725: the counsellor session list
 * rendered as a whole, HTTP stubbed (sessions, case-handover candidates,
 * agency consultants).
 */
import React from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
	within
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	E2EEContext,
	SessionsDataContext,
	SessionTypeContext,
	UserDataContext
} from '../../globalState';
import { ListItemInterface, STATUS_ACTIVE } from '../../globalState/interfaces';
import { LegalLinksContext } from '../../globalState/provider/LegalLinksProvider';
import { SESSION_LIST_TYPES } from '../session/sessionHelpers';
import { SessionsList } from './SessionsList';

const http = vi.hoisted(() => ({
	getList: vi.fn(),
	getAskerList: vi.fn(),
	getCandidates: vi.fn(),
	getAgencyConsultants: vi.fn(),
	getHandoverStatus: vi.fn(),
	getHandoverReasons: vi.fn()
}));
vi.mock('../../api', async (importOriginal) => ({
	...(await importOriginal<typeof import('../../api')>()),
	apiGetConsultantSessionList: http.getList,
	apiGetAskerSessionList: http.getAskerList,
	apiGetCaseHandoverCandidates: http.getCandidates,
	apiGetAgencyConsultantList: http.getAgencyConsultants,
	apiGetCaseHandoverStatus: http.getHandoverStatus,
	apiGetCaseHandoverReasons: http.getHandoverReasons
}));
vi.mock('../../api/apiCaseHandover', async (importOriginal) => ({
	...(await importOriginal<typeof import('../../api/apiCaseHandover')>()),
	apiGetCaseHandoverStatus: http.getHandoverStatus,
	apiGetCaseHandoverReasons: http.getHandoverReasons
}));
vi.mock('../../api/apiGetAgencyConsultantList', async (importOriginal) => ({
	...(await importOriginal<
		typeof import('../../api/apiGetAgencyConsultantList')
	>()),
	apiGetAgencyConsultantList: http.getAgencyConsultants
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
// Counts are appended so a test can read "N selected".
vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, options?: { count?: number }) =>
			typeof options?.count === 'number' ? `${key}:${options.count}` : key
	})
}));

const SPRINGFIELD = { id: 9, name: 'Springfield centre' };
const SHELBYVILLE = { id: 10, name: 'Shelbyville centre' };

const me = {
	id: 'herb-id',
	consultantId: 'herb-id',
	username: 'herb',
	displayName: 'Herb',
	absent: false,
	absenceMessage: ''
};
const patty = {
	id: 'patty-id',
	consultantId: 'patty-id',
	username: 'patty',
	displayName: 'Patty B.',
	firstName: 'Patricia',
	lastName: 'Bouvier',
	internalName: 'Patricia Bouvier',
	absent: false,
	absenceMessage: ''
};
const marge = {
	id: 'marge-id',
	consultantId: 'marge-id',
	username: 'marge',
	displayName: 'Marge S.',
	absent: false,
	absenceMessage: ''
};

let nextDate = 100;
const makeCase = (
	id: number,
	client: string,
	consultant: typeof me | typeof patty | typeof marge,
	agency: { id: number; name: string } | null,
	postcode: number,
	topic = { id: 3, name: 'Debts' }
): ListItemInterface =>
	({
		consultant,
		user: { username: client, displayName: client, sessionData: {} },
		...(agency ? { agency } : {}),
		session: {
			id,
			conversationType: 'AGENCY_COUNSELLING',
			agencyId: agency?.id ?? SPRINGFIELD.id,
			askerMatrixUserId: `@${client}:example.test`,
			consultingType: 1,
			matrixRoomId: `!case${id}:example.test`,
			status: STATUS_ACTIVE,
			messageDate: nextDate--,
			createDate: '2026-10-08T10:00:00Z',
			messagesRead: true,
			registrationType: 'REGISTERED',
			postcode,
			lastMessage: 'Test message',
			e2eLastMessage: null,
			attachment: null,
			videoCallMessageDTO: null,
			topic
		}
	}) as any;

const ownCases = [
	makeCase(1, 'Own client', me, SPRINGFIELD, 30000, { id: 5, name: 'Family' })
];
const pattyCases = [
	makeCase(11, 'Client eleven', patty, SPRINGFIELD, 10001),
	makeCase(12, 'Client twelve', patty, SPRINGFIELD, 20002),
	makeCase(13, 'Client thirteen', patty, SPRINGFIELD, 10003),
	makeCase(14, 'Client fourteen', patty, SHELBYVILLE, 10004, {
		id: 7,
		name: 'Addiction'
	})
];
const margeCases = [
	makeCase(21, 'Client twentyone', marge, SPRINGFIELD, 40001)
];
const lisa = {
	id: 'lisa-id',
	consultantId: 'lisa-id',
	username: 'lisa',
	displayName: 'Lisa S.',
	absent: false,
	absenceMessage: ''
};
const lisaCases = [
	makeCase(31, 'Client thirtyone', lisa as any, SPRINGFIELD, 50001)
];

/** Server-side text match, roughly as UserService does it. */
const serverCandidates = (query: string) =>
	[...pattyCases, ...margeCases, ...lisaCases].filter((item) =>
		[
			item.user?.username,
			item.consultant?.displayName,
			item.consultant?.username,
			(item.consultant as any)?.internalName,
			String(item.session?.postcode)
		]
			.join(' ')
			.toLowerCase()
			.includes(query.toLowerCase())
	);

/** Per-case access state as UserService reports it; default: never requested. */
let handoverStatusById: Record<number, string> = {};
const handoverStatusOf = (sessionId: number) => {
	const status = handoverStatusById[sessionId] || 'NOT_REQUESTED';
	return {
		sessionId,
		status,
		canViewContent: status === 'GRANTED',
		requestId: status === 'NOT_REQUESTED' ? undefined : 500 + sessionId,
		clientConsentRequired: false,
		ownershipRevision: 1
	};
};

const herbUserData = {
	userId: 'herb-id',
	userName: 'herb',
	displayName: 'Herb',
	userRoles: ['consultant'],
	grantedAuthorities: ['AUTHORIZATION_CONSULTANT_DEFAULT'],
	agencies: [SPRINGFIELD]
};

const renderList = (
	sessions: ListItemInterface[] = ownCases,
	{
		userData = herbUserData,
		path = '/sessions/consultant/sessionView'
	}: { userData?: Record<string, unknown>; path?: string } = {}
) => {
	http.getList.mockResolvedValue({
		sessions,
		total: sessions.length
	});
	http.getAskerList.mockResolvedValue({ sessions });
	const view = render(
		<MemoryRouter initialEntries={[path]}>
			<UserDataContext.Provider value={{ userData } as any}>
				<SessionTypeContext.Provider
					value={{
						type: SESSION_LIST_TYPES.MY_SESSION,
						path
					}}
				>
					<SessionsDataContext.Provider
						value={{
							sessions,
							dispatch: vi.fn(),
							ready: true
						}}
					>
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
					</SessionsDataContext.Provider>
				</SessionTypeContext.Provider>
			</UserDataContext.Provider>
		</MemoryRouter>
	);
	return view;
};

const ready = async (view: ReturnType<typeof render>) => {
	await waitFor(() =>
		expect(view.container.querySelector('.skeleton')).toBeNull()
	);
	return view;
};

const searchbox = () => screen.getByRole('searchbox');

const type = (value: string) => {
	fireEvent.focus(searchbox());
	fireEvent.change(searchbox(), { target: { value } });
};

const personRows = () =>
	screen
		.queryAllByRole('checkbox')
		.filter((node) =>
			node.getAttribute('data-cy')?.startsWith('session-search-person-')
		);

const personRowsNamed = (name: string) =>
	personRows().filter((row) => row.textContent?.includes(name));

const listItems = (view: ReturnType<typeof render>) =>
	Array.from(
		view.container.querySelectorAll<HTMLElement>(
			'.sessionsList__scrollContainer .sessionsListItem'
		)
	);

const listText = (view: ReturnType<typeof render>) =>
	listItems(view)
		.map((node) => node.textContent)
		.join('\n');

beforeEach(() => {
	nextDate = 100;
	handoverStatusById = {};
	http.getCandidates.mockImplementation(async ({ query }) => ({
		sessions: serverCandidates(query),
		total: 0
	}));
	http.getAgencyConsultants.mockResolvedValue([]);
	http.getHandoverStatus.mockImplementation(async (sessionId: number) =>
		handoverStatusOf(sessionId)
	);
	http.getHandoverReasons.mockResolvedValue([
		{
			code: 'ABSENCE',
			label: 'Planned absence',
			clientConsentRequired: false
		}
	]);
});

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

describe('case-handover search — people (FE#1725)', () => {
	it('shows a colleague once per counselling centre, not once per case', async () => {
		await ready(renderList());

		type('patty');

		await waitFor(() =>
			expect(personRowsNamed('Patty B.')).toHaveLength(2)
		);
		const [first, second] = personRowsNamed('Patty B.');
		expect(first.textContent).toContain(SPRINGFIELD.name);
		expect(second.textContent).toContain(SHELBYVILLE.name);
	});

	it('keeps the typed text when a person is picked and lists all of her cases there', async () => {
		const view = await ready(renderList());

		type('patty');
		await waitFor(() =>
			expect(personRowsNamed('Patty B.')).toHaveLength(2)
		);
		fireEvent.click(personRowsNamed('Patty B.')[0]);

		expect((searchbox() as HTMLInputElement).value).toBe('patty');
		await waitFor(() => {
			const text = listText(view);
			expect(text).toContain('Client eleven');
			expect(text).toContain('Client twelve');
			expect(text).toContain('Client thirteen');
		});
		expect(listText(view)).not.toContain('Client fourteen');
		expect(listText(view)).not.toContain('Own client');
	});

	it('combines a postcode with the picked person', async () => {
		const view = await ready(renderList());

		type('1000');
		await waitFor(() =>
			expect(personRowsNamed('Patty B.')).toHaveLength(2)
		);
		fireEvent.click(personRowsNamed('Patty B.')[0]);

		expect((searchbox() as HTMLInputElement).value).toBe('1000');
		await waitFor(() => expect(listText(view)).toContain('Client eleven'));
		expect(listText(view)).toContain('Client thirteen');
		expect(listText(view)).not.toContain('Client twelve');
		expect(listText(view)).not.toContain('Client fourteen');
	});

	it('narrows the picked person by a postcode appended to her name', async () => {
		const view = await ready(renderList());

		type('patty');
		await waitFor(() =>
			expect(personRowsNamed('Patty B.')).toHaveLength(2)
		);
		fireEvent.click(personRowsNamed('Patty B.')[0]);
		await waitFor(() => expect(listText(view)).toContain('Client twelve'));

		type('patty 1000');
		await waitFor(() =>
			expect(listText(view)).not.toContain('Client twelve')
		);
		expect(listText(view)).toContain('Client eleven');
		expect(listText(view)).toContain('Client thirteen');
		expect(listText(view)).not.toContain('Client fourteen');
	});

	it('keeps narrowing by text that does not name a picked person', async () => {
		const view = await ready(renderList());

		type('patty');
		await waitFor(() =>
			expect(personRowsNamed('Patty B.')).toHaveLength(2)
		);
		fireEvent.click(personRowsNamed('Patty B.')[0]);
		await waitFor(() => expect(listText(view)).toContain('Client eleven'));

		type('pat');
		await new Promise((resolve) => setTimeout(resolve, 300));
		expect(listText(view)).toContain('Client eleven');
		expect(listText(view)).toContain('Client thirteen');

		type('thirteen');
		await waitFor(() =>
			expect(listText(view)).not.toContain('Client eleven')
		);
		expect(listText(view)).toContain('Client thirteen');
	});

	it('picks several people one after another and lists the cases of all of them', async () => {
		const view = await ready(renderList());

		type('patty');
		await waitFor(() =>
			expect(personRowsNamed('Patty B.')).toHaveLength(2)
		);
		fireEvent.click(personRowsNamed('Patty B.')[0]);
		type('marge');
		await waitFor(() =>
			expect(personRowsNamed('Marge S.')).toHaveLength(1)
		);
		fireEvent.click(personRowsNamed('Marge S.')[0]);

		expect(
			view.container.querySelectorAll(
				'.sessionsListToolbar__searchInlinePill'
			)
		).toHaveLength(2);
		await waitFor(() => {
			const text = listText(view);
			expect(text).toContain('Client eleven');
			expect(text).toContain('Client thirteen');
			expect(text).toContain('Client twentyone');
		});
	});

	it('keeps the cases of picked people after confirming and after clearing the text', async () => {
		const view = await ready(renderList());

		type('patty');
		await waitFor(() =>
			expect(personRowsNamed('Patty B.')).toHaveLength(2)
		);
		fireEvent.click(personRowsNamed('Patty B.')[1]);
		fireEvent.click(
			screen.getByRole('button', {
				name: 'sessionList.toolbar.search.confirm'
			})
		);
		expect(
			screen.queryByTestId('session-search-results-scroll')
		).toBeNull();
		await waitFor(() =>
			expect(listText(view)).toContain('Client fourteen')
		);

		fireEvent.change(searchbox(), { target: { value: '' } });
		await new Promise((resolve) => setTimeout(resolve, 300));
		expect(listText(view)).toContain('Client fourteen');
		expect(listText(view)).not.toContain('Own client');
	});

	it('finds a colleague by her internal name and says which name it is', async () => {
		await ready(renderList());

		type('patricia');

		await waitFor(() =>
			expect(personRowsNamed('Patty B.')).toHaveLength(2)
		);
		expect(personRowsNamed('Patty B.')[0].textContent).toContain(
			'Patricia Bouvier'
		);
		expect(personRowsNamed('Patty B.')[0].textContent).toContain(
			'sessionList.toolbar.search.internalName'
		);
		expect(personRowsNamed('Patty B.')[0].textContent).toContain(
			'sessionList.toolbar.search.publicName'
		);
	});

	it('loads all cases of a colleague found through one of them', async () => {
		const view = await ready(renderList());

		type('10001');
		await waitFor(() =>
			expect(personRowsNamed('Patty B.')).toHaveLength(1)
		);
		fireEvent.click(personRowsNamed('Patty B.')[0]);
		fireEvent.change(searchbox(), { target: { value: '' } });

		await waitFor(() => {
			const text = listText(view);
			expect(text).toContain('Client eleven');
			expect(text).toContain('Client twelve');
			expect(text).toContain('Client thirteen');
		});
		expect(listText(view)).not.toContain('Client fourteen');
	});

	it("loads a colleague's cases beyond the first page of 50", async () => {
		const bulkCases = Array.from({ length: 55 }, (_, index) =>
			makeCase(
				100 + index,
				`Bulk client ${100 + index}`,
				patty,
				SPRINGFIELD,
				60000
			)
		);
		const all = [...pattyCases, ...bulkCases];
		http.getCandidates.mockImplementation(
			async ({ query, offset = 0, count = 15 }) => {
				const found = all.filter((item) =>
					[item.consultant?.username, item.consultant?.displayName]
						.join(' ')
						.toLowerCase()
						.includes(query.toLowerCase())
				);
				return {
					sessions: found.slice(offset, offset + count),
					total: found.length
				};
			}
		);
		const view = await ready(renderList());

		type('patty');
		await waitFor(() =>
			expect(personRowsNamed('Patty B.')).toHaveLength(2)
		);
		fireEvent.click(personRowsNamed('Patty B.')[0]);

		await waitFor(() =>
			expect(listText(view)).toContain('Bulk client 154')
		);
		expect(listText(view)).toContain('Client eleven');
	});

	it('shows counsellors with the counsellor avatar and the counsellor role, clients with an animal', async () => {
		await ready(renderList());

		type('Client eleven');
		await waitFor(() =>
			expect(personRowsNamed('Client eleven')).toHaveLength(1)
		);
		const client = personRowsNamed('Client eleven')[0];
		expect(client.textContent).toContain(
			'sessionList.toolbar.search.role.asker'
		);
		expect(within(client).queryByTestId('counsellor-avatar')).toBeNull();

		type('patty');
		await waitFor(() =>
			expect(personRowsNamed('Patty B.')).toHaveLength(2)
		);
		const counsellor = personRowsNamed('Patty B.')[0];
		expect(counsellor.textContent).toContain(
			'sessionList.toolbar.search.role.consultant'
		);
		expect(
			within(counsellor).getByTestId('counsellor-avatar')
		).toBeTruthy();
	});

	it.each(['Beraterin', 'beratende Person', 'counselor'])(
		'lists the eligible colleagues for the role word "%s" and not the own clients',
		async (word) => {
			await ready(renderList());

			type(word);

			await waitFor(() =>
				expect(personRowsNamed('Lisa S.')).toHaveLength(1)
			);
			expect(personRowsNamed('Own client')).toHaveLength(0);
		}
	);

	it('loads the cases of a colleague found by role word once she is picked', async () => {
		const view = await ready(renderList());

		type('Berater:in');
		await waitFor(() => expect(personRowsNamed('Lisa S.')).toHaveLength(1));
		fireEvent.click(personRowsNamed('Lisa S.')[0]);

		await waitFor(() =>
			expect(listText(view)).toContain('Client thirtyone')
		);
		expect(listText(view)).not.toContain('Own client');
	});
});

describe('case-handover search — eligible colleagues only (FE#1152)', () => {
	const openSearch = () => fireEvent.focus(searchbox());

	it('lists the eligible colleagues as soon as the search opens, without typing', async () => {
		const view = await ready(renderList());

		openSearch();

		await waitFor(() =>
			expect(personRowsNamed('Patty B.')).toHaveLength(2)
		);
		expect(personRowsNamed('Marge S.')).toHaveLength(1);
		expect(personRowsNamed('Lisa S.')).toHaveLength(1);
		expect(http.getCandidates).toHaveBeenCalledWith(
			expect.objectContaining({ query: '' })
		);
		// Only the people: their cases do not flood the list.
		expect(listText(view)).toContain('Own client');
		expect(listText(view)).not.toContain('Client eleven');
		// Never a colleague's clients.
		expect(personRowsNamed('Client eleven')).toHaveLength(0);
	});

	it('shows nobody but the eligible colleagues on open: no own clients, not the signed-in counsellor', async () => {
		await ready(renderList());

		openSearch();

		await waitFor(() => expect(personRowsNamed('Lisa S.')).toHaveLength(1));
		expect(personRows()).toHaveLength(4);
		expect(personRowsNamed('Own client')).toHaveLength(0);
		expect(personRowsNamed('Herb')).toHaveLength(0);
	});

	it('offers own clients once text is typed, never the signed-in counsellor', async () => {
		const view = await ready(renderList());

		type('own');
		await waitFor(() =>
			expect(personRowsNamed('Own client')).toHaveLength(1)
		);
		expect(personRowsNamed('Lisa S.')).toHaveLength(0);

		fireEvent.change(searchbox(), { target: { value: 'herb' } });
		await waitFor(() =>
			expect(http.getCandidates).toHaveBeenCalledWith(
				expect.objectContaining({ query: 'herb' })
			)
		);
		await waitFor(() => expect(listItems(view).length).toBeGreaterThan(0));
		expect(personRowsNamed('Herb')).toHaveLength(0);
	});

	describe('a counsellor who is only in the own list (e.g. supervised)', () => {
		const ned = {
			id: 'ned-id',
			consultantId: 'ned-id',
			username: 'ned',
			displayName: 'Ned F.',
			absent: false,
			absenceMessage: ''
		};
		const withSupervisedCase = () => [
			...ownCases,
			makeCase(41, 'Supervised client', ned as any, SPRINGFIELD, 60001)
		];

		it.each(['Berater:in', 'counsellor'])(
			'is not offered for the role word "%s", nor is the signed-in counsellor',
			async (word) => {
				await ready(renderList(withSupervisedCase()));

				type(word);

				await waitFor(() =>
					expect(personRowsNamed('Lisa S.')).toHaveLength(1)
				);
				expect(personRowsNamed('Ned F.')).toHaveLength(0);
				expect(personRowsNamed('Herb')).toHaveLength(0);
			}
		);

		it('is not offered by name, while her client still is', async () => {
			await ready(renderList(withSupervisedCase()));

			type('Supervised');
			await waitFor(() =>
				expect(personRowsNamed('Supervised client')).toHaveLength(1)
			);

			fireEvent.change(searchbox(), { target: { value: 'Ned' } });
			await waitFor(() =>
				expect(http.getCandidates).toHaveBeenCalledWith(
					expect.objectContaining({ query: 'Ned' })
				)
			);
			await new Promise((resolve) => setTimeout(resolve, 300));
			expect(personRowsNamed('Ned F.')).toHaveLength(0);
		});

		it('is not offered on open', async () => {
			await ready(renderList(withSupervisedCase()));

			openSearch();

			await waitFor(() =>
				expect(personRowsNamed('Lisa S.')).toHaveLength(1)
			);
			expect(personRowsNamed('Ned F.')).toHaveLength(0);
		});
	});

	it('says that the colleagues are loading while nobody is listed yet', async () => {
		let finish: (value: { sessions: any[]; total: number }) => void = () =>
			undefined;
		http.getCandidates.mockImplementation(
			() =>
				new Promise((resolve) => {
					finish = resolve;
				})
		);
		await ready(renderList());

		openSearch();

		await waitFor(() =>
			expect(
				screen.getByText('sessionList.toolbar.search.peopleLoading')
			).toBeTruthy()
		);
		expect(personRows()).toHaveLength(0);

		finish({ sessions: lisaCases, total: 0 });
		await waitFor(() => expect(personRowsNamed('Lisa S.')).toHaveLength(1));
		expect(
			screen.queryByText('sessionList.toolbar.search.peopleLoading')
		).toBeNull();
	});

	it('loads the eligible colleagues once per opening, not on every keystroke', async () => {
		await ready(renderList());

		openSearch();
		await waitFor(() => expect(personRowsNamed('Lisa S.')).toHaveLength(1));
		const blankLoads = () =>
			http.getCandidates.mock.calls.filter(
				([params]) => params.query === ''
			).length;
		const before = blankLoads();
		type('lis');
		await waitFor(() => expect(personRowsNamed('Lisa S.')).toHaveLength(1));
		fireEvent.change(searchbox(), { target: { value: '' } });
		await new Promise((resolve) => setTimeout(resolve, 300));

		expect(before).toBe(1);
		expect(blankLoads()).toBe(1);
	});

	it('loads the eligible colleagues again on the next opening, once', async () => {
		const view = await ready(renderList());
		const blankLoads = () =>
			http.getCandidates.mock.calls.filter(
				([params]) => params.query === ''
			).length;

		openSearch();
		await waitFor(() => expect(personRowsNamed('Lisa S.')).toHaveLength(1));
		expect(blankLoads()).toBe(1);

		fireEvent.mouseDown(
			view.container.querySelector('.sessionsList__scrollContainer')!
		);
		expect(
			screen.queryByTestId('session-search-results-scroll')
		).toBeNull();
		expect(blankLoads()).toBe(1);

		openSearch();
		await waitFor(() => expect(blankLoads()).toBe(2));
		await waitFor(() => expect(personRowsNamed('Lisa S.')).toHaveLength(1));
		type('lis');
		fireEvent.change(searchbox(), { target: { value: '' } });
		await new Promise((resolve) => setTimeout(resolve, 300));
		expect(blankLoads()).toBe(2);
	});

	it.each(['Berater:in', 'counsellor'])(
		'offers only eligible colleagues for the role word "%s", never the whole centre',
		async (word) => {
			http.getAgencyConsultants.mockResolvedValue([
				{
					consultantId: 'lisa-id',
					username: 'lisa',
					displayName: 'Lisa S.'
				},
				{
					consultantId: 'ned-id',
					username: 'ned',
					displayName: 'Ned F.'
				}
			]);
			await ready(renderList());

			type(word);

			await waitFor(() =>
				expect(personRowsNamed('Lisa S.')).toHaveLength(1)
			);
			expect(personRowsNamed('Patty B.')).toHaveLength(2);
			expect(personRowsNamed('Ned F.')).toHaveLength(0);
			expect(http.getAgencyConsultants).not.toHaveBeenCalled();
		}
	);

	it('says why nobody is listed when no colleague is eligible', async () => {
		http.getCandidates.mockResolvedValue({ sessions: [], total: 0 });
		await ready(renderList());

		openSearch();

		await waitFor(() =>
			expect(
				screen.getByText(
					'sessionList.toolbar.search.handoverPeopleHint'
				)
			).toBeTruthy()
		);
		expect(personRows()).toHaveLength(0);
		expect(
			screen.getByText('sessionList.toolbar.search.emptyPeople')
		).toBeTruthy();
		expect(
			screen.queryByText('sessionList.toolbar.search.peopleLoadError')
		).toBeNull();
	});

	it('keeps the reason visible next to the eligible colleagues', async () => {
		await ready(renderList());

		openSearch();

		await waitFor(() => expect(personRowsNamed('Lisa S.')).toHaveLength(1));
		expect(
			screen.getByText('sessionList.toolbar.search.handoverPeopleHint')
		).toBeTruthy();
	});

	it('says so when the eligible colleagues could not be loaded', async () => {
		http.getCandidates.mockRejectedValue(new Error('500'));
		await ready(renderList());

		openSearch();

		await waitFor(() =>
			expect(
				screen.getByText('sessionList.toolbar.search.peopleLoadError')
			).toBeTruthy()
		);
	});

	it('picks an eligible colleague without typing and lists her cases', async () => {
		const view = await ready(renderList());

		openSearch();
		await waitFor(() => expect(personRowsNamed('Lisa S.')).toHaveLength(1));
		fireEvent.click(personRowsNamed('Lisa S.')[0]);

		await waitFor(() =>
			expect(listText(view)).toContain('Client thirtyone')
		);
		expect(listText(view)).not.toContain('Client eleven');
		expect(listText(view)).not.toContain('Own client');
	});

	it('notes that more cases exist when the load stops at its limit', async () => {
		const bulk = Array.from({ length: 1000 }, (_, index) =>
			makeCase(
				1000 + index,
				`Bulk client ${index}`,
				lisa as any,
				SPRINGFIELD,
				50001
			)
		);
		http.getCandidates.mockImplementation(
			async ({ offset = 0, count = 15 }) => ({
				sessions: bulk.slice(offset, offset + count),
				total: 0
			})
		);
		await ready(renderList());

		openSearch();

		await waitFor(() =>
			expect(
				screen.getByTestId('session-search-people-capped')
			).toBeTruthy()
		);
		expect(http.getCandidates).toHaveBeenCalledTimes(20);
		expect(
			screen.getByText('sessionList.toolbar.search.handoverPeopleCapped')
		).toBeTruthy();
		expect(personRowsNamed('Lisa S.')).toHaveLength(1);
	});

	it('does not note a limit when all cases were loaded', async () => {
		await ready(renderList());

		openSearch();

		await waitFor(() => expect(personRowsNamed('Lisa S.')).toHaveLength(1));
		expect(screen.queryByTestId('session-search-people-capped')).toBeNull();
	});
});

describe('case-handover search — archive scope and closing (FE#1725)', () => {
	it('reloads the picked colleague\'s cases for "Archive only" instead of keeping the active ones', async () => {
		const archivedCase = {
			...makeCase(15, 'Archived fifteen', patty, SPRINGFIELD, 10005),
			session: {
				...makeCase(15, 'Archived fifteen', patty, SPRINGFIELD, 10005)
					.session,
				status: 4
			}
		} as ListItemInterface;
		http.getCandidates.mockImplementation(async ({ query, archived }) => ({
			sessions: archived
				? [archivedCase].filter((item) =>
						[
							item.consultant?.displayName,
							item.consultant?.username
						]
							.join(' ')
							.toLowerCase()
							.includes(query.toLowerCase())
					)
				: serverCandidates(query),
			total: 0
		}));
		const view = await ready(renderList());

		type('patty');
		await waitFor(() =>
			expect(personRowsNamed('Patty B.')).toHaveLength(2)
		);
		fireEvent.click(personRowsNamed('Patty B.')[0]);
		await waitFor(() => expect(listText(view)).toContain('Client eleven'));
		fireEvent.change(searchbox(), { target: { value: '' } });
		fireEvent.click(
			screen.getByRole('button', { name: /tabs\.archiveOnly/ })
		);

		await waitFor(() =>
			expect(listText(view)).toContain('Archived fifteen')
		);
		expect(listText(view)).not.toContain('Client eleven');
	});

	it('stops loading the eligible colleagues when the search closes', async () => {
		const signals: AbortSignal[] = [];
		http.getCandidates.mockImplementation(
			({ query, signal }) =>
				new Promise(() => {
					if (query === '' && signal) signals.push(signal);
				})
		);
		await ready(renderList());

		fireEvent.focus(searchbox());
		await waitFor(() => expect(signals).toHaveLength(1));
		fireEvent.click(
			screen.getByRole('button', {
				name: 'sessionList.toolbar.search.close'
			})
		);

		await waitFor(() => expect(signals[0].aborted).toBe(true));
	});
});

describe('people search for an advice seeker (no handover)', () => {
	it('still finds the own counsellors by name and by role word', async () => {
		const askerCases = [
			makeCase(51, 'bart', patty, SPRINGFIELD, 10001),
			makeCase(52, 'bart', marge, SPRINGFIELD, 10002)
		];
		await ready(
			renderList(askerCases, {
				userData: {
					userId: 'bart-id',
					userName: 'bart',
					userRoles: ['user'],
					grantedAuthorities: ['AUTHORIZATION_USER_DEFAULT']
				},
				path: '/sessions/user/view'
			})
		);

		type('Patty');
		await waitFor(() =>
			expect(personRowsNamed('Patty B.')).toHaveLength(1)
		);

		fireEvent.change(searchbox(), { target: { value: 'Berater:in' } });
		await waitFor(() =>
			expect(personRowsNamed('Marge S.')).toHaveLength(1)
		);
		expect(http.getCandidates).not.toHaveBeenCalled();
	});
});

describe('case-handover search — counselling centre and topics (FE#1725)', () => {
	it('offers the centres of the people found as a single choice and narrows topics to it', async () => {
		const view = await ready(renderList());

		type('patty');
		await waitFor(() =>
			expect(personRowsNamed('Patty B.')).toHaveLength(2)
		);
		// Her colleagues are listed before the text search has answered.
		await waitFor(() => expect(listText(view)).toContain('Client eleven'));
		fireEvent.click(screen.getByRole('tab', { name: /tabs\.centre/ }));

		const centres = screen.getByRole('radiogroup', {
			name: 'sessionList.toolbar.search.agencyGroup'
		});
		const options = within(centres).getAllByRole('radio');
		expect(options.map((option) => option.textContent)).toEqual([
			SPRINGFIELD.name,
			SHELBYVILLE.name
		]);
		fireEvent.click(
			within(centres).getByRole('radio', { name: SHELBYVILLE.name })
		);
		expect(
			within(centres)
				.getAllByRole('radio')
				.filter(
					(option) => option.getAttribute('aria-checked') === 'true'
				)
				.map((option) => option.textContent)
		).toEqual([SHELBYVILLE.name]);

		const topics = screen.getByRole('radiogroup', {
			name: 'sessionList.toolbar.search.topicGroup'
		});
		expect(
			within(topics)
				.getAllByRole('radio')
				.map((option) => option.textContent)
		).toEqual(['Addiction']);
		await waitFor(() =>
			expect(listText(view)).toContain('Client fourteen')
		);
		expect(listText(view)).not.toContain('Client eleven');

		fireEvent.click(
			within(centres).getByRole('radio', { name: SPRINGFIELD.name })
		);
		expect(
			within(centres)
				.getAllByRole('radio')
				.filter(
					(option) => option.getAttribute('aria-checked') === 'true'
				)
		).toHaveLength(1);
	});
});

describe('case-handover search — centre and topic options follow the search (FE#1725)', () => {
	it('keeps the chosen centre among the options when the text changes', async () => {
		await ready(renderList());

		type('patty');
		await waitFor(() =>
			expect(personRowsNamed('Patty B.')).toHaveLength(2)
		);
		fireEvent.click(screen.getByRole('tab', { name: /tabs\.centre/ }));
		fireEvent.click(
			within(
				screen.getByRole('radiogroup', {
					name: 'sessionList.toolbar.search.agencyGroup'
				})
			).getByRole('radio', { name: SHELBYVILLE.name })
		);

		type('marge');
		await new Promise((resolve) => setTimeout(resolve, 300));

		const centres = screen.getByRole('radiogroup', {
			name: 'sessionList.toolbar.search.agencyGroup'
		});
		expect(
			within(centres)
				.getByRole('radio', { name: SHELBYVILLE.name })
				.getAttribute('aria-checked')
		).toBe('true');
	});

	it('narrows the topic list by the typed text', async () => {
		await ready(renderList());

		type('patty');
		await waitFor(() =>
			expect(personRowsNamed('Patty B.')).toHaveLength(2)
		);
		fireEvent.click(personRowsNamed('Patty B.')[0]);
		fireEvent.click(personRowsNamed('Patty B.')[1]);
		fireEvent.click(screen.getByRole('tab', { name: /tabs\.centre/ }));
		const topicLabels = () =>
			within(
				screen.getByRole('radiogroup', {
					name: 'sessionList.toolbar.search.topicGroup'
				})
			)
				.getAllByRole('radio')
				.map((option) => option.textContent);
		await waitFor(() => expect(topicLabels()).toContain('Addiction'));
		expect(topicLabels()).toContain('Debts');

		type('addic');

		await waitFor(() => expect(topicLabels()).toEqual(['Addiction']));
	});
});

describe('case-handover search — older UserService without agency/internal name (C1 absent)', () => {
	it('still groups by centre id and names unknown centres with a fallback', async () => {
		http.getCandidates.mockImplementation(async ({ query }) => ({
			sessions: serverCandidates(query).map(
				({ agency, consultant, ...rest }: any) => ({
					...rest,
					consultant: { ...consultant, internalName: undefined }
				})
			),
			total: 0
		}));
		await ready(renderList());

		type('patty');
		await waitFor(() =>
			expect(personRowsNamed('Patty B.')).toHaveLength(2)
		);
		expect(personRowsNamed('Patty B.')[0].textContent).toContain(
			'Patricia Bouvier'
		);
		fireEvent.click(screen.getByRole('tab', { name: /tabs\.centre/ }));
		const centres = screen.getByRole('radiogroup', {
			name: 'sessionList.toolbar.search.agencyGroup'
		});
		expect(
			within(centres)
				.getAllByRole('radio')
				.map((option) => option.textContent)
		).toEqual([
			SPRINGFIELD.name,
			'sessionList.toolbar.search.agencyFallback'
		]);
	});
});

describe('case-handover search — closing and resetting (FE#1725)', () => {
	it('stays open on list and card clicks and closes on an empty area', async () => {
		const view = await ready(renderList());

		type('patty');
		await waitFor(() =>
			expect(personRowsNamed('Patty B.')).toHaveLength(2)
		);
		await waitFor(() => expect(listItems(view).length).toBeGreaterThan(0));
		fireEvent.mouseDown(listItems(view)[0]);
		expect(
			screen.getByTestId('session-search-results-scroll')
		).toBeTruthy();
		fireEvent.mouseDown(
			view.container.querySelector('.sessionsList__scrollContainer')!
		);
		expect(
			screen.queryByTestId('session-search-results-scroll')
		).toBeNull();
	});

	it('closes on a button outside the list, such as navigation', async () => {
		await ready(renderList());
		const navigation = document.createElement('button');
		navigation.textContent = 'Profile';
		document.body.appendChild(navigation);

		type('patty');
		await waitFor(() =>
			expect(personRowsNamed('Patty B.')).toHaveLength(2)
		);
		fireEvent.mouseDown(navigation);

		expect(
			screen.queryByTestId('session-search-results-scroll')
		).toBeNull();
		navigation.remove();
	});

	it('resets text, people, centre and archive-only with the X', async () => {
		const view = await ready(renderList());

		type('patty');
		await waitFor(() =>
			expect(personRowsNamed('Patty B.')).toHaveLength(2)
		);
		fireEvent.click(personRowsNamed('Patty B.')[0]);
		fireEvent.click(screen.getByRole('tab', { name: /tabs\.centre/ }));
		fireEvent.click(
			within(
				screen.getByRole('radiogroup', {
					name: 'sessionList.toolbar.search.agencyGroup'
				})
			).getByRole('radio', { name: SPRINGFIELD.name })
		);
		fireEvent.click(
			screen.getByRole('button', {
				name: /tabs\.archiveOnly/
			})
		);
		await waitFor(() =>
			expect(
				screen
					.getByRole('button', { name: /tabs\.archiveOnly/ })
					.getAttribute('aria-pressed')
			).toBe('true')
		);

		fireEvent.click(
			screen.getByRole('button', {
				name: 'sessionList.toolbar.search.close'
			})
		);

		expect((searchbox() as HTMLInputElement).value).toBe('');
		expect(
			screen.queryByTestId('session-search-results-scroll')
		).toBeNull();
		expect(
			view.container.querySelectorAll(
				'.sessionsListToolbar__searchInlinePill'
			)
		).toHaveLength(0);
		fireEvent.focus(searchbox());
		expect(
			screen
				.getByRole('button', { name: /tabs\.archiveOnly/ })
				.getAttribute('aria-pressed')
		).toBe('false');
		fireEvent.click(screen.getByRole('tab', { name: /tabs\.centre/ }));
		expect(
			within(
				screen.getByRole('radiogroup', {
					name: 'sessionList.toolbar.search.agencyGroup'
				})
			)
				.getAllByRole('radio')
				.filter(
					(option) => option.getAttribute('aria-checked') === 'true'
				)
		).toHaveLength(0);
		await waitFor(() => expect(listText(view)).toContain('Own client'));
	});

	it('says so in a snackbar when the filters hide every case, and removes them on request', async () => {
		const view = await ready(renderList());

		type('nothing matches this');

		const notice = await screen.findByTestId(
			'session-search-filtered-out-notice'
		);
		expect(notice.textContent).toContain(
			'sessionList.toolbar.search.filteredOutAll'
		);
		expect(
			screen.getByTestId('session-search-filtered-out-reset').textContent
		).toBe('sessionList.toolbar.search.clear');
		fireEvent.click(
			screen.getByTestId('session-search-filtered-out-reset')
		);

		expect((searchbox() as HTMLInputElement).value).toBe('');
		await waitFor(() => expect(listText(view)).toContain('Own client'));
		await waitFor(() =>
			expect(
				screen.queryByTestId('session-search-filtered-out-notice')
			).toBeNull()
		);
	});
});

describe('case-handover search — snackbar keeps the search (FE#1725)', () => {
	it('removes only the centre, type, topic and archive filters and keeps text and people', async () => {
		const view = await ready(renderList());

		type('patty');
		await waitFor(() =>
			expect(personRowsNamed('Patty B.')).toHaveLength(2)
		);
		fireEvent.click(personRowsNamed('Patty B.')[0]);
		fireEvent.click(screen.getByRole('tab', { name: /tabs\.centre/ }));
		fireEvent.click(
			within(
				screen.getByRole('radiogroup', {
					name: 'sessionList.toolbar.search.agencyGroup'
				})
			).getByRole('radio', { name: SHELBYVILLE.name })
		);

		const action = await screen.findByTestId(
			'session-search-filtered-out-reset'
		);
		expect(action.textContent).toBe(
			'sessionList.toolbar.search.removeFiltersKeepSearch'
		);
		fireEvent.click(action);

		expect((searchbox() as HTMLInputElement).value).toBe('patty');
		expect(
			view.container.querySelectorAll(
				'.sessionsListToolbar__searchInlinePill'
			)
		).toHaveLength(1);
		await waitFor(() => expect(listText(view)).toContain('Client eleven'));
		expect(listText(view)).not.toContain('Own client');
	});
});

/** Picks Patty (Springfield) so her three Springfield cases are listed. */
const listPattysSpringfieldCases = async (view: ReturnType<typeof render>) => {
	type('patty');
	await waitFor(() => expect(personRowsNamed('Patty B.')).toHaveLength(2));
	fireEvent.click(personRowsNamed('Patty B.')[0]);
	await waitFor(() => expect(caseCard(view, 'Client thirteen')).toBeTruthy());
};

const caseCard = (view: ReturnType<typeof render>, client: string) =>
	listItems(view).find((node) => node.textContent?.includes(client));

const caseCheckbox = (view: ReturnType<typeof render>, client: string) =>
	within(caseCard(view, client)!).getByRole('checkbox', {
		name: 'caseHandover.batch.selectCase'
	});

const startBatchModeOn = async (
	view: ReturnType<typeof render>,
	client: string
) => {
	const card = await waitFor(() => {
		const node = caseCard(view, client);
		expect(
			within(node!).getByRole('button', {
				name: 'caseHandover.menu.label'
			})
		).toBeTruthy();
		return node!;
	});
	fireEvent.click(
		within(card).getByRole('button', { name: 'caseHandover.menu.label' })
	);
	fireEvent.click(
		await screen.findByRole('menuitem', {
			name: /caseHandover\.menu\.selectMultiple\.title/
		})
	);
};

const bulkBar = () =>
	screen.getByRole('region', { name: 'caseHandover.bulkBar.label' });

describe('case-handover selection — bulk bar (FE#1725)', () => {
	it('shows a sticky bar with the count and opens the wizard for all selected cases', async () => {
		const view = await ready(renderList());
		await listPattysSpringfieldCases(view);
		await startBatchModeOn(view, 'Client eleven');

		await waitFor(() =>
			expect(caseCheckbox(view, 'Client eleven')).toBeTruthy()
		);
		for (const client of [
			'Client eleven',
			'Client twelve',
			'Client thirteen'
		]) {
			await waitFor(() =>
				expect(caseCheckbox(view, client)).toBeTruthy()
			);
			fireEvent.click(caseCheckbox(view, client));
		}

		expect(bulkBar().textContent).toContain(
			'caseHandover.bulkBar.selected:3'
		);
		fireEvent.click(
			within(bulkBar()).getByRole('button', {
				name: 'caseHandover.bulkBar.continue'
			})
		);

		const wizard = await screen.findByRole('dialog', {
			name: 'caseHandover.batch.title'
		});
		expect(wizard.textContent).toContain(
			'caseHandover.batch.selectedCount:3'
		);
	});

	it('starts with every case unselected and marks granted or pending cases instead of offering them', async () => {
		handoverStatusById = { 12: 'PENDING', 13: 'GRANTED' };
		const view = await ready(renderList());
		await listPattysSpringfieldCases(view);
		await startBatchModeOn(view, 'Client eleven');

		await waitFor(() =>
			expect(
				(caseCheckbox(view, 'Client eleven') as HTMLInputElement)
					.checked
			).toBe(false)
		);
		await waitFor(() =>
			expect(caseCard(view, 'Client twelve')!.textContent).toContain(
				'caseHandover.list.awaitingApproval'
			)
		);
		expect(caseCard(view, 'Client thirteen')!.textContent).toContain(
			'caseHandover.list.accessGranted'
		);
		for (const client of ['Client twelve', 'Client thirteen']) {
			expect(
				within(caseCard(view, client)!).queryByRole('checkbox')
			).toBeNull();
		}
		expect(bulkBar().textContent).toContain(
			'caseHandover.bulkBar.selected:0'
		);
	});

	it('keeps the selection when the search changes, so cases from several searches add up', async () => {
		const view = await ready(renderList());
		await listPattysSpringfieldCases(view);
		await startBatchModeOn(view, 'Client eleven');
		for (const client of ['Client eleven', 'Client twelve']) {
			await waitFor(() =>
				expect(caseCheckbox(view, client)).toBeTruthy()
			);
			fireEvent.click(caseCheckbox(view, client));
		}

		type('marge');
		await waitFor(() =>
			expect(personRowsNamed('Marge S.')).toHaveLength(1)
		);
		fireEvent.click(personRowsNamed('Marge S.')[0]);
		await waitFor(() =>
			expect(caseCheckbox(view, 'Client twentyone')).toBeTruthy()
		);
		expect(
			(caseCheckbox(view, 'Client twentyone') as HTMLInputElement).checked
		).toBe(false);
		fireEvent.click(caseCheckbox(view, 'Client twentyone'));

		expect(bulkBar().textContent).toContain(
			'caseHandover.bulkBar.selected:3'
		);
		fireEvent.click(
			within(bulkBar()).getByRole('button', {
				name: 'caseHandover.bulkBar.continue'
			})
		);
		const wizard = await screen.findByRole('dialog', {
			name: 'caseHandover.batch.title'
		});
		expect(wizard.textContent).toContain(
			'caseHandover.batch.selectedCount:3'
		);
	});

	it('cancels batch mode from the bar and clears the selection', async () => {
		const view = await ready(renderList());
		await listPattysSpringfieldCases(view);
		await startBatchModeOn(view, 'Client eleven');
		await waitFor(() =>
			expect(caseCheckbox(view, 'Client eleven')).toBeTruthy()
		);
		fireEvent.click(caseCheckbox(view, 'Client eleven'));

		fireEvent.click(
			within(bulkBar()).getByRole('button', {
				name: 'caseHandover.bulkBar.cancel'
			})
		);

		expect(
			screen.queryByRole('region', { name: 'caseHandover.bulkBar.label' })
		).toBeNull();
		expect(
			within(caseCard(view, 'Client eleven')!).queryByRole('checkbox')
		).toBeNull();
		await startBatchModeOn(view, 'Client eleven');
		await waitFor(() =>
			expect(
				(caseCheckbox(view, 'Client eleven') as HTMLInputElement)
					.checked
			).toBe(false)
		);
	});

	it('explains in the wizard when no reasons are available instead of a dead Next button', async () => {
		http.getHandoverReasons.mockResolvedValue([]);
		const view = await ready(renderList());
		await listPattysSpringfieldCases(view);
		await startBatchModeOn(view, 'Client eleven');
		await waitFor(() =>
			expect(caseCheckbox(view, 'Client eleven')).toBeTruthy()
		);
		fireEvent.click(caseCheckbox(view, 'Client eleven'));
		fireEvent.click(
			within(bulkBar()).getByRole('button', {
				name: 'caseHandover.bulkBar.continue'
			})
		);

		const wizard = await screen.findByRole('dialog', {
			name: 'caseHandover.batch.title'
		});
		await waitFor(() =>
			expect(wizard.textContent).toContain(
				'caseHandover.curtain.reason.empty'
			)
		);
		expect(
			within(wizard).queryByRole('button', {
				name: 'caseHandover.curtain.next'
			})
		).toBeNull();
	});

	it('says when the reasons could not be loaded and offers to try again', async () => {
		http.getHandoverReasons.mockRejectedValueOnce(new Error('500'));
		const view = await ready(renderList());
		await listPattysSpringfieldCases(view);
		await startBatchModeOn(view, 'Client eleven');
		await waitFor(() =>
			expect(caseCheckbox(view, 'Client eleven')).toBeTruthy()
		);
		fireEvent.click(caseCheckbox(view, 'Client eleven'));
		fireEvent.click(
			within(bulkBar()).getByRole('button', {
				name: 'caseHandover.bulkBar.continue'
			})
		);

		const wizard = await screen.findByRole('dialog', {
			name: 'caseHandover.batch.title'
		});
		await waitFor(() =>
			expect(wizard.textContent).toContain(
				'caseHandover.curtain.reason.loadFailed'
			)
		);
		expect(wizard.textContent).not.toContain(
			'caseHandover.curtain.reason.empty'
		);
		fireEvent.click(
			within(wizard).getByRole('button', {
				name: 'caseHandover.curtain.reason.retry'
			})
		);
		await waitFor(() =>
			expect(wizard.textContent).toContain('Planned absence')
		);
		expect(wizard.textContent).not.toContain(
			'caseHandover.curtain.reason.loadFailed'
		);
	});

	it('moves keyboard focus into the wizard and back to Continue when it closes', async () => {
		const view = await ready(renderList());
		await listPattysSpringfieldCases(view);
		await startBatchModeOn(view, 'Client eleven');
		await waitFor(() =>
			expect(caseCheckbox(view, 'Client eleven')).toBeTruthy()
		);
		expect(
			caseCheckbox(view, 'Client eleven').getAttribute('aria-describedby')
		).toBeTruthy();
		fireEvent.click(caseCheckbox(view, 'Client eleven'));
		fireEvent.click(
			within(bulkBar()).getByRole('button', {
				name: 'caseHandover.bulkBar.continue'
			})
		);

		const wizard = await screen.findByRole('dialog', {
			name: 'caseHandover.batch.title'
		});
		await waitFor(() =>
			expect(wizard.contains(document.activeElement)).toBe(true)
		);
		fireEvent.click(
			within(wizard).getByRole('button', {
				name: 'caseHandover.batch.cancel'
			})
		);

		await waitFor(() =>
			expect(document.activeElement).toBe(
				within(bulkBar()).getByRole('button', {
					name: 'caseHandover.bulkBar.continue'
				})
			)
		);
		expect(bulkBar().textContent).toContain(
			'caseHandover.bulkBar.selected:1'
		);
	});
});
