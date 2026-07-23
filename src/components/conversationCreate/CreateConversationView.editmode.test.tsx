// @vitest-environment jsdom
import * as React from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	apiCreateGroupChat,
	apiUpdateGroupChat
} from '../../api/apiGroupChatSettings';
import { apiGetSessionRoomsByGroupIds } from '../../api/apiGetSessionRooms';
import { apiGetTenantConsultantList } from '../../api/apiGetAgencyConsultantList';
import { useSession } from '../../hooks/useSession';
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
vi.mock('../../globalState', () => {
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const react = require('react');
	const tenant = {
		settings: { featureGroupChatV2Enabled: true, activeLanguages: ['de'] }
	};
	return {
		UserDataContext: react.createContext(null),
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
vi.mock('../../api/apiGetTenantAgenciesTopics', () => ({
	apiGetTenantAgenciesTopics: vi.fn().mockResolvedValue([])
}));
vi.mock('../../api/apiGroupChatSettings', () => ({
	apiCreateGroupChat: vi.fn(),
	apiUpdateGroupChat: vi.fn()
}));
vi.mock('../../api/apiGetSessionRooms', () => ({
	apiGetSessionRoomsByGroupIds: vi.fn()
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

// Route params are controllable per test: edit route carries
// /:rcGroupId/:sessionId, the create route carries none.
const routerState = vi.hoisted(() => ({
	params: { rcGroupId: 'rc-1', sessionId: '77' } as Record<string, string>
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

const editSeriesItem = {
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

const renderInUserContext = (
	agencies: { id: number; name: string }[] = [{ id: 5, name: 'Agency Five' }]
) =>
	render(
		<UserDataContext.Provider
			value={{ userData: { userId: 'me', agencies } }}
		>
			<SessionsDataContext.Provider value={{ dispatch: vi.fn() }}>
				<CreateConversationView />
			</SessionsDataContext.Provider>
		</UserDataContext.Provider>
	);

describe('CreateConversationView edit mode (finding 1)', () => {
	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
	});

	beforeEach(() => {
		routerState.params = { rcGroupId: 'rc-1', sessionId: '77' };
	});

	it('prefills the existing series and updates instead of creating', async () => {
		vi.mocked(useSession).mockReturnValue({
			session: { item: editSeriesItem } as any,
			reload: vi.fn(),
			read: vi.fn(),
			ready: true
		});
		vi.mocked(apiUpdateGroupChat).mockResolvedValue({ groupId: 'rc-1' });
		vi.mocked(apiGetSessionRoomsByGroupIds).mockResolvedValue({
			sessions: []
		} as any);

		renderInUserContext();

		// The persisted topic is prefilled into the form.
		expect(await screen.findByDisplayValue('Existing circle')).toBeTruthy();

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

	it('lets the owner add a co-moderator while editing a circle', async () => {
		vi.mocked(useSession).mockReturnValue({
			session: { item: editSeriesItem } as any,
			reload: vi.fn(),
			read: vi.fn(),
			ready: true
		});
		vi.mocked(apiGetTenantConsultantList).mockResolvedValue([
			{
				consultantId: 'c-2',
				firstName: 'Casey',
				lastName: 'Co-Moderator'
			}
		] as any);
		vi.mocked(apiUpdateGroupChat).mockResolvedValue({ groupId: 'rc-1' });
		vi.mocked(apiGetSessionRoomsByGroupIds).mockResolvedValue({
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

	it('shows a loading state until the series has hydrated', () => {
		vi.mocked(useSession).mockReturnValue({
			session: null as any,
			reload: vi.fn(),
			read: vi.fn(),
			ready: false
		});

		renderInUserContext();

		// No settings form (no save button) before hydration: an un-hydrated
		// submit would wipe the series.
		expect(
			screen.queryByRole('button', { name: 'groupChat.circle.saveLabel' })
		).toBeNull();
	});
});

describe('CreateConversationView internal card (finding 2)', () => {
	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
	});

	beforeEach(() => {
		// Create route: no edit params.
		routerState.params = {};
		vi.mocked(useSession).mockReturnValue({
			session: null as any,
			reload: vi.fn(),
			read: vi.fn(),
			ready: false
		});
		vi.mocked(apiGetTenantConsultantList).mockResolvedValue([
			{ consultantId: 'p1', firstName: 'Pat', lastName: 'One' },
			{ consultantId: 'p2', firstName: 'Sam', lastName: 'Two' }
		] as any);
	});

	it('clears the selected colleagues when the agency changes', async () => {
		renderInUserContext([
			{ id: 1, name: 'Agency One' },
			{ id: 2, name: 'Agency Two' }
		]);

		// Pick the first agency so the consultant list loads.
		fireEvent.mouseDown(screen.getAllByRole('combobox')[0]);
		fireEvent.click(
			await screen.findByRole('option', { name: 'Agency One' })
		);

		// Wait for the colleague list to load for the picked agency.
		await waitFor(() =>
			expect(apiGetTenantConsultantList).toHaveBeenCalled()
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
