// @vitest-environment jsdom
import * as React from 'react';
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
import { useSession } from '../../hooks/useSession';
import { apiGetAgenciesByIds } from '../../api/apiGetAgenciesByIds';
import { apiGetTenantConsultantList } from '../../api/apiGetAgencyConsultantList';
import { UserDataContext, SessionsDataContext } from '../../globalState';
import { CreateConversationView } from './CreateConversationView';

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
		}
	};
	return {
		UserDataContext,
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
vi.mock(
	'../../resources/img/illustrations/conversation/internal-team.png',
	() => ({
		default: 'internal-team.png'
	})
);
vi.mock('../../resources/img/topics', () => ({
	getTopicCardImage: () => 'topic.png',
	hasTopicCardImage: () => false,
	topicSlug: (value: string) => value
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

const CIRCLE_CARD = 'groupChat.circle.title';
const INTERNAL_CARD = 'groupChat.internal.title';

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

describe('CreateConversationView – formats the Träger has switched off', () => {
	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
	});

	beforeEach(() => {
		// Create route: no params. Edit mode is a different flow.
		routerState.params = {};
		vi.mocked(useSession).mockReturnValue({
			session: null,
			reload: vi.fn(),
			read: vi.fn(),
			ready: true
		} as any);
		// Agencies without known settings add no restriction.
		vi.mocked(apiGetAgenciesByIds).mockResolvedValue([]);
	});

	it('offers both cards when the Träger has group chats enabled', async () => {
		tenantState.settings = {
			featureGroupChatV2Enabled: true,
			activeLanguages: ['de']
		};

		renderCreateFlow();

		expect(await screen.findByText(CIRCLE_CARD)).toBeTruthy();
		expect(screen.getByText(INTERNAL_CARD)).toBeTruthy();
	});

	// Tenant 14 on dev: featureGroupChatV2Enabled is false. The card must not
	// be reachable at all — offering it and letting the backend answer 403 on
	// submit is what this whole change is about.
	it('shows no card at all when the Träger has group chats disabled', async () => {
		tenantState.settings = {
			featureGroupChatV2Enabled: false,
			activeLanguages: ['de']
		};

		renderCreateFlow();

		await waitFor(() => expect(screen.queryByText(CIRCLE_CARD)).toBeNull());
		expect(screen.queryByText(INTERNAL_CARD)).toBeNull();
	});

	it('hides only the Gesprächskreis when self-help groups are switched off', async () => {
		tenantState.settings = {
			featureGroupChatV2Enabled: true,
			featureSelfHelpGroupsEnabled: false,
			activeLanguages: ['de']
		};

		renderCreateFlow();

		expect(await screen.findByText(INTERNAL_CARD)).toBeTruthy();
		expect(screen.queryByText(CIRCLE_CARD)).toBeNull();
	});

	it('hides only the internal conversation when it is switched off', async () => {
		tenantState.settings = {
			featureGroupChatV2Enabled: true,
			featureInternalGroupChatEnabled: false,
			activeLanguages: ['de']
		};

		renderCreateFlow();

		expect(await screen.findByText(CIRCLE_CARD)).toBeTruthy();
		expect(screen.queryByText(INTERNAL_CARD)).toBeNull();
	});
});

describe('CreateConversationView – formats the Beratungsstelle has switched off', () => {
	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
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
	});

	const agencyResponse = (
		id: number,
		settings: Record<string, boolean | null>
	) => ({ id, name: `Agency ${id}`, settings }) as any;

	it('offers only the internal conversation when the agency switched circles off', async () => {
		vi.mocked(apiGetAgenciesByIds).mockResolvedValue([
			agencyResponse(5, {
				featureGroupChatV2Enabled: true,
				featureInternalGroupChatEnabled: true,
				featureSelfHelpGroupsEnabled: false
			})
		]);

		renderCreateFlow();

		expect(await screen.findByText(INTERNAL_CARD)).toBeTruthy();
		expect(screen.queryByText(CIRCLE_CARD)).toBeNull();
		expect(apiGetAgenciesByIds).toHaveBeenCalledWith([5]);
	});

	it('offers no format when the agency switched both off', async () => {
		vi.mocked(apiGetAgenciesByIds).mockResolvedValue([
			agencyResponse(5, {
				featureGroupChatV2Enabled: true,
				featureInternalGroupChatEnabled: false,
				featureSelfHelpGroupsEnabled: false
			})
		]);

		renderCreateFlow();

		await waitFor(() => expect(apiGetAgenciesByIds).toHaveBeenCalled());
		await waitFor(() =>
			expect(screen.queryByText(INTERNAL_CARD)).toBeNull()
		);
		expect(screen.queryByText(CIRCLE_CARD)).toBeNull();
	});

	it('keeps every format while the agency values are still null', async () => {
		vi.mocked(apiGetAgenciesByIds).mockResolvedValue([
			agencyResponse(5, {
				featureGroupChatV2Enabled: null,
				featureInternalGroupChatEnabled: null,
				featureSelfHelpGroupsEnabled: null
			})
		]);

		renderCreateFlow();

		expect(await screen.findByText(CIRCLE_CARD)).toBeTruthy();
		expect(screen.getByText(INTERNAL_CARD)).toBeTruthy();
	});

	it('falls back to the Träger’s answer when the agency settings fail to load', async () => {
		vi.mocked(apiGetAgenciesByIds).mockRejectedValue(new Error('boom'));

		renderCreateFlow();

		expect(await screen.findByText(CIRCLE_CARD)).toBeTruthy();
		expect(screen.getByText(INTERNAL_CARD)).toBeTruthy();
	});

	it('offers a format only for the agencies that allow it', async () => {
		vi.mocked(apiGetAgenciesByIds).mockResolvedValue([
			agencyResponse(1, {
				featureInternalGroupChatEnabled: true,
				featureSelfHelpGroupsEnabled: false
			}),
			agencyResponse(2, {
				featureInternalGroupChatEnabled: false,
				featureSelfHelpGroupsEnabled: true
			}),
			agencyResponse(3, {
				featureInternalGroupChatEnabled: true,
				featureSelfHelpGroupsEnabled: true
			})
		]);

		renderCreateFlow([
			{ id: 1, name: 'Agency One' },
			{ id: 2, name: 'Agency Two' },
			{ id: 3, name: 'Agency Three' }
		]);

		expect(await screen.findByText(CIRCLE_CARD)).toBeTruthy();
		fireEvent.mouseDown(await screen.findByRole('combobox'));
		const options = within(await screen.findByRole('listbox'))
			.getAllByRole('option')
			.map((option) => option.textContent);
		expect(options).toEqual(['Agency One', 'Agency Three']);
	});

	it('preselects the single agency that offers the internal conversation', async () => {
		vi.mocked(apiGetAgenciesByIds).mockResolvedValue([
			agencyResponse(1, {
				featureInternalGroupChatEnabled: true,
				featureSelfHelpGroupsEnabled: false
			}),
			agencyResponse(2, {
				featureInternalGroupChatEnabled: false,
				featureSelfHelpGroupsEnabled: true
			})
		]);

		renderCreateFlow([
			{ id: 1, name: 'Agency One' },
			{ id: 2, name: 'Agency Two' }
		]);

		expect(await screen.findByText(CIRCLE_CARD)).toBeTruthy();
		expect(screen.getByText(INTERNAL_CARD)).toBeTruthy();
		// No agency choice: Agency One is the only one, and it is already
		// picked — the colleague list loads for it.
		expect(screen.queryByRole('combobox')).toBeNull();
		await waitFor(() =>
			expect(apiGetTenantConsultantList).toHaveBeenCalled()
		);
	});
});
