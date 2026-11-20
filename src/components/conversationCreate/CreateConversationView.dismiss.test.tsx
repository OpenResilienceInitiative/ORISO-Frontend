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
	params: {} as Record<string, string>,
	navigate: vi.fn()
}));
vi.mock('react-router-dom', async () => {
	const actual = await vi.importActual<any>('react-router-dom');
	return {
		...actual,
		useNavigate: () => routerState.navigate,
		useLocation: () => ({ state: null }),
		useParams: () => routerState.params
	};
});

// The running create request: the one state this suite flips per test.
const submitState = vi.hoisted(() => ({ pending: false }));
vi.mock('./useInternalSubsetChatSubmit', async () => {
	const actual = await vi.importActual<any>('./useInternalSubsetChatSubmit');
	return {
		...actual,
		useInternalSubsetChatSubmit: (...args: unknown[]) => ({
			...actual.useInternalSubsetChatSubmit(...args),
			isSubmitting: submitState.pending
		})
	};
});

const renderCreateFlow = () =>
	render(
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
					{/* Outside the panel, like the conversation list beside it. */}
					<aside data-testid="list-gap" />
					<button
						type="button"
						data-tour-target="groupchat-create-button"
					>
						Erstellen
					</button>
					<CreateConversationView />
				</SessionsDataContext.Provider>
			</UserDataContext.Provider>
		</MemoryRouter>
	);

const LIST = '/sessions/consultant/sessionView';

const click = (element: Element) => {
	fireEvent.pointerDown(element);
	fireEvent.mouseDown(element);
	fireEvent.click(element);
};

describe('CreateConversationView - leaving the view', () => {
	afterEach(() => {
		cleanup();
		resetCounsellorAgencyFormatsForTests();
		vi.clearAllMocks();
		viewport.fromL = true;
		submitState.pending = false;
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
	});

	const open = async () => {
		const view = renderCreateFlow();
		await screen.findByText('groupChat.format.title');
		return view;
	};

	it('closes on a click into the empty space around the cards', async () => {
		const { container } = await open();
		click(container.querySelector('.conversationCreate__picker')!);
		expect(routerState.navigate).toHaveBeenCalledWith(LIST);
	});

	it('closes on a click into the list area outside the panel', async () => {
		await open();
		click(screen.getByTestId('list-gap'));
		expect(routerState.navigate).toHaveBeenCalledWith(LIST);
	});

	it('closes on Escape', async () => {
		await open();
		fireEvent.keyDown(document.body, { key: 'Escape' });
		expect(routerState.navigate).toHaveBeenCalledWith(LIST);
	});

	it('does not close when a card is used', async () => {
		await open();
		click(await screen.findByLabelText('groupChat.internal.nameLabel'));
		click(screen.getByText('groupChat.circle.title'));
		expect(routerState.navigate).not.toHaveBeenCalled();
	});

	it('asks before it drops typed input, and keeps it on "keep editing"', async () => {
		await open();
		const name = await screen.findByLabelText(
			'groupChat.internal.nameLabel'
		);
		fireEvent.input(name, { target: { value: 'Wochenplanung' } });
		fireEvent.keyDown(document.body, { key: 'Escape' });

		const dialog = await screen.findByRole('dialog');
		expect(dialog.textContent).toContain('groupChat.format.discard.title');
		expect(routerState.navigate).not.toHaveBeenCalled();

		fireEvent.click(screen.getByTestId('create-keep-editing'));
		await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
		expect(routerState.navigate).not.toHaveBeenCalled();
		expect((name as HTMLInputElement).value).toBe('Wochenplanung');
	});

	it('leaves after the person agreed to discard the input', async () => {
		await open();
		const name = await screen.findByLabelText(
			'groupChat.internal.nameLabel'
		);
		fireEvent.input(name, { target: { value: 'Wochenplanung' } });
		click(screen.getByTestId('list-gap'));
		fireEvent.click(await screen.findByTestId('create-discard-input'));
		expect(routerState.navigate).toHaveBeenCalledWith(LIST);
	});

	it('stays on the view when Back is used on a phone while a request runs', async () => {
		viewport.fromL = false;
		submitState.pending = true;
		await open();
		click(await screen.findByLabelText('groupChat.format.back'));
		expect(routerState.navigate).not.toHaveBeenCalled();
		expect(screen.getByText('groupChat.format.title')).toBeTruthy();
	});

	it('returns focus to "Erstellen" once the view has gone', async () => {
		const view = await open();
		fireEvent.keyDown(document.body, { key: 'Escape' });
		// The route change unmounts the view; the chip it came from is there.
		view.unmount();
		const chip = document.createElement('button');
		chip.setAttribute('data-tour-target', 'groupchat-create-button');
		document.body.appendChild(chip);
		await waitFor(() => expect(document.activeElement).toBe(chip));
		chip.remove();
	});
});
