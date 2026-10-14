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
	getCandidates: vi.fn(),
	getAgencyConsultants: vi.fn()
}));
vi.mock('../../api', async (importOriginal) => ({
	...(await importOriginal<typeof import('../../api')>()),
	apiGetConsultantSessionList: http.getList,
	apiGetCaseHandoverCandidates: http.getCandidates,
	apiGetAgencyConsultantList: http.getAgencyConsultants
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
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
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

const renderList = () => {
	http.getList.mockResolvedValue({
		sessions: ownCases,
		total: ownCases.length
	});
	const view = render(
		<MemoryRouter initialEntries={['/sessions/consultant/sessionView']}>
			<UserDataContext.Provider
				value={
					{
						userData: {
							userId: 'herb-id',
							userName: 'herb',
							displayName: 'Herb',
							userRoles: ['consultant'],
							grantedAuthorities: [
								'AUTHORIZATION_CONSULTANT_DEFAULT'
							],
							agencies: [SPRINGFIELD]
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
					<SessionsDataContext.Provider
						value={{
							sessions: ownCases,
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
	http.getCandidates.mockImplementation(async ({ query }) => ({
		sessions: serverCandidates(query),
		total: 0
	}));
	http.getAgencyConsultants.mockResolvedValue([]);
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

	it.each([
		'Berater:in',
		'Beraterin',
		'beratende Person',
		'counsellor',
		'counselor'
	])(
		'lists the counsellors of my counselling centre for the role word "%s"',
		async (word) => {
			http.getAgencyConsultants.mockResolvedValue([
				{
					consultantId: 'lisa-id',
					username: 'lisa',
					displayName: 'Lisa S.',
					firstName: 'Lisa',
					lastName: 'Simpson'
				}
			]);
			await ready(renderList());

			type(word);

			await waitFor(() =>
				expect(personRowsNamed('Lisa S.')).toHaveLength(1)
			);
			expect(http.getAgencyConsultants).toHaveBeenCalledWith('9');
			expect(personRowsNamed('Own client')).toHaveLength(0);
		}
	);

	it('loads the cases of a colleague found by role word once she is picked', async () => {
		http.getAgencyConsultants.mockResolvedValue([
			{
				consultantId: 'lisa-id',
				username: 'lisa',
				displayName: 'Lisa S.'
			}
		]);
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

describe('case-handover search — counselling centre and topics (FE#1725)', () => {
	it('offers the centres of the people found as a single choice and narrows topics to it', async () => {
		const view = await ready(renderList());

		type('patty');
		await waitFor(() =>
			expect(personRowsNamed('Patty B.')).toHaveLength(2)
		);
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
		fireEvent.mouseDown(listItems(view)[0]);
		expect(
			screen.getByTestId('session-search-results-scroll')
		).toBeTruthy();
		fireEvent.mouseDown(
			view.container.querySelector('.sessionsList__scrollContainer')!
		);
		expect(
			screen.getByTestId('session-search-results-scroll')
		).toBeTruthy();

		fireEvent.mouseDown(document.body);
		expect(
			screen.queryByTestId('session-search-results-scroll')
		).toBeNull();
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
