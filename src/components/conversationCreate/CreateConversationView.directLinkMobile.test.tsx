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
import { useSession } from '../../hooks/useSession';
import { apiGetAgenciesByIds } from '../../api/apiGetAgenciesByIds';
import { apiCreateDirectLink } from '../../api/apiDirectLinks';
import { UserDataContext, SessionsDataContext } from '../../globalState';
import { CreateConversationView } from './CreateConversationView';
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
// The tenant is what this suite varies: the settings of the Träger the
// counsellor actually belongs to.
const tenantState = vi.hoisted(() => ({
	settings: { featureGroupChatV2Enabled: true, activeLanguages: ['de'] } as
		| Record<string, unknown>
		| undefined
}));

vi.mock('../../globalState', async () => {
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const react = require('react');
	// The real user-data context: the agency-settings hook reads it through
	// its direct module path, so the flow and the hook must share it.
	const { UserDataContext } = await vi.importActual<any>(
		'../../globalState/context/UserDataContext'
	);
	const tenant = {
		get settings() {
			return tenantState.settings;
		},
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
const viewport = vi.hoisted(() => ({ fromL: true }));
vi.mock('../../hooks/useResponsive', () => ({
	useResponsive: () => ({ fromL: viewport.fromL })
}));
vi.mock('../../api/apiDirectLinks', async () => ({
	...(await vi.importActual<any>('../../api/apiDirectLinks')),
	apiCreateDirectLink: vi.fn()
}));
vi.mock('../../hooks/useSession', () => ({ useSession: vi.fn() }));
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
// The counsellor's Beratungsstellen and their effective settings (#1440).
vi.mock('../../api/apiGetAgenciesByIds', () => ({
	apiGetAgenciesByIds: vi.fn()
}));
vi.mock('../../api/apiGetTenantAgenciesTopics', () => ({
	apiGetTenantAgenciesTopics: vi
		.fn()
		.mockResolvedValue([{ id: 4, name: 'Sucht' }])
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

// Route params are controllable per test: edit route carries
// /:groupId/:sessionId, the create route carries none.
const routerState = vi.hoisted(() => ({
	params: { groupId: 'group-1', sessionId: '77' } as Record<string, string>
}));
vi.mock('react-router-dom', async () => {
	const actual = await vi.importActual<any>('react-router-dom');
	return {
		...actual,
		useNavigate: () => vi.fn(),
		useLocation: () => ({ state: null }),
		useParams: () => routerState.params
	};
});

const renderCreateFlow = (
	agencies: { id: number; name: string }[] = [{ id: 5, name: 'Agency Five' }]
) =>
	render(
		<MemoryRouter>
			<UserDataContext.Provider
				value={{
					userData: {
						userId: 'me',
						agencies
					}
				}}
			>
				<SessionsDataContext.Provider value={{ dispatch: vi.fn() }}>
					<CreateConversationView />
				</SessionsDataContext.Provider>
			</UserDataContext.Provider>
		</MemoryRouter>
	);

const LINK = {
	id: 'l1',
	url: 'https://dev.oriso.org/l/abc',
	medium: 'VIDEO',
	topic: 'Sucht',
	temporary: true,
	active: true
};

describe('CreateConversationView - created direct link on a phone', () => {
	afterEach(() => {
		cleanup();
		resetCounsellorAgencyFormatsForTests();
		vi.clearAllMocks();
		viewport.fromL = true;
	});

	beforeEach(() => {
		routerState.params = {};
		tenantState.settings = {
			featureGroupChatV2Enabled: true,
			activeLanguages: ['de']
		};
		vi.mocked(useSession).mockReturnValue({
			session: null,
			reload: vi.fn(),
			read: vi.fn(),
			ready: true
		} as any);
		vi.mocked(apiGetAgenciesByIds).mockResolvedValue([
			{ ...conversationAgency(5), settings: null }
		]);
		vi.mocked(apiCreateDirectLink).mockResolvedValue(LINK as any);
	});

	const createVideoLink = async () => {
		fireEvent.click(
			await screen.findByRole('button', {
				name: 'directLink.medium.video'
			})
		);
		fireEvent.click(
			screen.getByRole('button', { name: /directLink.card.create/ })
		);
		await screen.findByTestId('direct-link-share-dialog');
	};

	it('keeps the link on screen when the window shrinks to phone width', async () => {
		const view = renderCreateFlow();
		await createVideoLink();

		viewport.fromL = false;
		view.rerender(
			<MemoryRouter>
				<UserDataContext.Provider
					value={{
						userData: {
							userId: 'me',
							agencies: [{ id: 5, name: 'Agency Five' }]
						}
					}}
				>
					<SessionsDataContext.Provider value={{ dispatch: vi.fn() }}>
						<CreateConversationView />
					</SessionsDataContext.Provider>
				</UserDataContext.Provider>
			</MemoryRouter>
		);

		await waitFor(() =>
			expect(screen.getByTestId('direct-link-share-dialog')).toBeTruthy()
		);
	});

	it('shows the link when created on a phone from the start', async () => {
		viewport.fromL = false;
		renderCreateFlow();
		fireEvent.click(await screen.findByText('directLink.card.title'));
		await createVideoLink();
		expect(screen.getByTestId('direct-link-share-dialog')).toBeTruthy();
	});
});
