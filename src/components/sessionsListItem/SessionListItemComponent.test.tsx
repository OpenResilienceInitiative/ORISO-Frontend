// @vitest-environment jsdom
/**
 * #1189 — reachability tests for the "Chat settings" entry in the group-chat
 * list-row menu. These tests MUST fail if the <SessionListItemMenu> is removed
 * from the group-chat early-return branch, proving the original no-op bug
 * cannot be reintroduced silently.
 */
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { generatePath, MemoryRouter } from 'react-router-dom';
import {
	UserDataContext,
	SessionTypeContext,
	ActiveSessionContext,
	SessionsDataContext,
	E2EEContext,
	AUTHORITIES
} from '../../globalState';
import { LegalLinksContext } from '../../globalState/provider/LegalLinksProvider';
import { SESSION_LIST_TYPES } from '../session/sessionHelpers';
import { SessionListItemComponent } from './SessionListItemComponent';

afterEach(cleanup);

// ---------------------------------------------------------------------------
// Global state: keep real context, only stub the hooks that need values
// ---------------------------------------------------------------------------
vi.mock('../../globalState', async (importOriginal) => ({
	...(await importOriginal<any>()),
	useConsultingType: () => ({ registration: { autoSelectPostcode: false } }),
	useTopic: () => null
}));

// ---------------------------------------------------------------------------
// Leaf hooks — return minimal stable values
// ---------------------------------------------------------------------------
vi.mock('../../hooks/useE2EE', () => ({
	useE2EE: () => ({
		key: null,
		keyID: null,
		encrypted: false,
		ready: true
	})
}));

vi.mock('../../hooks/useMatrixSessionPreview', () => ({
	useMatrixSessionPreview: () => null
}));

vi.mock('../../hooks/useUnreadVersion', () => ({
	useUnreadVersion: () => 0
}));

vi.mock('../../hooks/useActiveListItem', () => ({
	useActiveListItem: () => ({ isActive: () => false })
}));

// ---------------------------------------------------------------------------
// API stubs
// ---------------------------------------------------------------------------
vi.mock('../../api', async (importOriginal) => ({
	...(await importOriginal<any>()),
	apiGetCaseHandoverStatus: () => Promise.resolve(null),
	apiPutArchive: () => Promise.resolve(),
	apiPutDearchive: () => Promise.resolve()
}));

// ---------------------------------------------------------------------------
// Tenant settings
// ---------------------------------------------------------------------------
vi.mock('../../utils/tenantSettingsHelper', () => ({
	getTenantSettings: () => ({})
}));

// ---------------------------------------------------------------------------
// i18n
// ---------------------------------------------------------------------------
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (k: string) => k })
}));

// ---------------------------------------------------------------------------
// Lottie — imported transitively through AnimatedIllustration; crashes in jsdom
// ---------------------------------------------------------------------------
vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('lottie-web', () => ({ default: {} }));

// ---------------------------------------------------------------------------
// SVG / image assets
// ---------------------------------------------------------------------------
vi.mock('../../resources/img/icons', () => ({
	MenuVerticalIcon: () => <span data-testid="menu-vertical-icon" />,
	ShowPasswordIcon: () => <span />
}));
vi.mock('../../resources/img/icons/inbox.svg', () => ({
	ReactComponent: () => <span />
}));
vi.mock('../../resources/img/icons/trash.svg', () => ({
	ReactComponent: () => <span />
}));
vi.mock('../../resources/img/icons/i.svg', () => ({
	ReactComponent: () => <span />
}));
vi.mock('../../resources/img/icons/gear.svg', () => ({
	ReactComponent: () => <span />
}));
vi.mock('../../resources/img/icons/chat.svg', () => ({
	ReactComponent: () => <span />
}));
vi.mock('../../resources/img/icons/call.svg', () => ({
	ReactComponent: () => <span />
}));
vi.mock('../../resources/img/icons/video-call.svg', () => ({
	ReactComponent: () => <span />
}));
vi.mock('../../resources/img/icons/chatroom/mail_conv_type_200.svg', () => ({
	default: ''
}));
vi.mock(
	'../../resources/img/icons/chatroom/internal_conversation_200.svg',
	() => ({
		default: ''
	})
);
vi.mock(
	'../../resources/img/icons/session-toolbar/supervision_chats.svg',
	() => ({
		default: ''
	})
);
vi.mock('../../resources/img/illustrations/Team.svg', () => ({
	default: ''
}));

// ---------------------------------------------------------------------------
// Heavy sub-components that import assets or start Matrix subscriptions
// ---------------------------------------------------------------------------
vi.mock('../message/UserAvatar', () => ({
	UserAvatar: () => <span data-testid="user-avatar" />
}));
vi.mock('../message/MessageAvatar', () => ({
	MessageAvatar: () => <span data-testid="message-avatar" />
}));
vi.mock('../sessionHeader/ConsultantSearchLoader', () => ({
	ConsultantSearchLoader: () => <span />
}));
vi.mock('../teamDiscussion/TeamDiscussionBadge', () => ({
	TeamDiscussionBadge: () => <span />,
	getCachedTeamDiscussion: () => Promise.resolve(null)
}));
vi.mock('./SessionListItemLastMessage', () => ({
	SessionListItemLastMessage: ({ lastMessage }: { lastMessage: string }) => (
		<span>{lastMessage}</span>
	)
}));
vi.mock('./SessionListItemAttachment', () => ({
	SessionListItemAttachment: () => <span />
}));
vi.mock('./SessionListItemVideoCall', () => ({
	SessionListItemVideoCall: () => <span />
}));
vi.mock('./CaseHandoverActionButton', () => ({
	CaseHandoverActionButton: () => <span />
}));
vi.mock('../session/DeleteSession', () => ({
	default: ({
		children
	}: {
		children: (fn: () => void) => React.ReactNode;
	}) => {
		return <>{children(vi.fn())}</>;
	}
}));
vi.mock('../overlay/Overlay', () => ({
	Overlay: () => <span />,
	OVERLAY_FUNCTIONS: { CLOSE: 'CLOSE', ARCHIVE: 'ARCHIVE' }
}));
vi.mock('../legalLinks/LegalLinkModal', () => ({
	LegalLinkModal: () => <span />
}));
vi.mock('../legalLinks/LegalLinkMenuIcon', () => ({
	LegalLinkMenuIcon: () => <span />
}));
vi.mock('../legalLinks/LegalLinks', () => ({
	default: () => <span />
}));
vi.mock('../app/navigationHandler', () => ({
	mobileListView: vi.fn()
}));

// ---------------------------------------------------------------------------
// Capture navigate calls
// ---------------------------------------------------------------------------
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => ({
	...(await importOriginal<any>()),
	useNavigate: () => mockNavigate
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Consultant user who owns the group chat. */
const OWNER_USER_ID = 'consultant-owner-42';

const makeUserData = (userId = OWNER_USER_ID) => ({
	userId,
	userName: 'testConsultant',
	grantedAuthorities: [AUTHORITIES.CONSULTANT_DEFAULT],
	agencies: []
});

/**
 * Minimal ExtendedSessionInterface for a group chat row.
 * Mirrors buildExtendedSession output: `item` comes from `chat`
 * (GroupChatItemInterface), `isGroup = true`, `isSession = false`.
 */
const makeGroupSession = ({
	consultantId = OWNER_USER_ID,
	active = false,
	matrixRoomId = '!abc:matrix.example.org'
} = {}) => ({
	item: {
		id: 101,
		matrixRoomId,
		active,
		messageDate: 1700000000,
		createDate: '2023-11-14T12:00:00Z',
		topic: 'Test group chat',
		moderators: [],
		consultingType: 1,
		subscribed: true,
		repetitive: false,
		startDate: '2023-11-14',
		startTime: '12:00',
		createdAt: '2023-11-14T12:00:00Z',
		messagesRead: true,
		assignedAgencies: [],
		duration: 0,
		hintMessage: '',
		lastMessage: '',
		attachment: null,
		videoCallMessageDTO: null
	},
	rid: matrixRoomId,
	type: 'groupChat' as const,
	isGroup: true,
	isSession: false,
	isEnquiry: false,
	isEmptyEnquiry: false,
	isNonEmptyEnquiry: false,
	isArchive: false,
	consultant: { id: consultantId },
	user: null,
	agency: { id: 1 }
});

const sessionsDispatch = vi.fn();

const renderItem = (activeSession: any, userData = makeUserData()) => {
	const sessionTypeValue = {
		type: SESSION_LIST_TYPES.MY_SESSION,
		path: '/sessions/consultant/sessionView'
	};
	const sessionsDataValue = {
		sessions: [],
		ready: true,
		dispatch: sessionsDispatch
	};
	const e2eeValue = {
		key: null,
		reloadPrivateKey: () => {},
		isE2eeEnabled: false,
		e2EEReady: true
	};

	return render(
		<MemoryRouter initialEntries={['/sessions/consultant/sessionView']}>
			<UserDataContext.Provider
				value={{
					userData,
					setUserData: vi.fn(),
					reloadUserData: vi.fn() as any
				}}
			>
				<SessionTypeContext.Provider value={sessionTypeValue}>
					<ActiveSessionContext.Provider
						value={{ activeSession, reloadActiveSession: vi.fn() }}
					>
						<SessionsDataContext.Provider value={sessionsDataValue}>
							<E2EEContext.Provider value={e2eeValue}>
								<LegalLinksContext.Provider value={[]}>
									<SessionListItemComponent
										defaultLanguage="de"
										index={0}
									/>
								</LegalLinksContext.Provider>
							</E2EEContext.Provider>
						</SessionsDataContext.Provider>
					</ActiveSessionContext.Provider>
				</SessionTypeContext.Provider>
			</UserDataContext.Provider>
		</MemoryRouter>
	);
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SessionListItemComponent — group-chat Chat settings reachability (#1189)', () => {
	afterEach(() => {
		mockNavigate.mockReset();
	});

	it('test 1: group-chat owner sees the three-dot trigger and can open "Chat settings"', async () => {
		renderItem(makeGroupSession());

		// The trigger button must be present in the group-chat early-return branch
		const trigger = screen.getByRole('button', {
			name: 'groupChat.info.settings.headline'
		});
		expect(trigger).toBeTruthy();

		// Open the flyout
		fireEvent.click(trigger);

		// The chat-settings entry must now be visible (rendered via portal into body)
		const chatSettingsBtn = document.querySelector(
			'[data-cy="session-list-menu-chat-settings"]'
		);
		expect(chatSettingsBtn).not.toBeNull();
	});

	it('test 2: clicking "Chat settings" navigates to the editGroupChat route with correct state', async () => {
		const matrixRoomId = '!abc:matrix.example.org';
		const session = makeGroupSession({ matrixRoomId });
		renderItem(session);

		// Open the flyout
		fireEvent.click(
			screen.getByRole('button', {
				name: 'groupChat.info.settings.headline'
			})
		);

		// Click the chat settings button
		const chatSettingsBtn = document.querySelector(
			'[data-cy="session-list-menu-chat-settings"]'
		) as HTMLElement;
		expect(chatSettingsBtn).not.toBeNull();
		fireEvent.click(chatSettingsBtn);

		const expectedPath = generatePath(
			`/sessions/consultant/sessionView/:groupId/:id/:subRoute?/:extraPath?`,
			{
				groupId: matrixRoomId,
				id: '101',
				subRoute: 'editGroupChat'
			}
		);

		// Assert the chat-settings handler navigated with the correct path and state.
		// generatePath percent-encodes colons: '!abc:matrix' → '!abc%3Amatrix'.
		expect(mockNavigate).toHaveBeenCalledWith(expectedPath, {
			state: { isEditMode: true, prevIsInfoPage: false }
		});

		// The room id must be percent-encoded in the path
		expect(expectedPath).toContain('%3A');
	});

	it('test 3: non-owner consultant sees NO three-dot trigger', () => {
		const session = makeGroupSession({
			consultantId: 'other-consultant-99'
		});
		renderItem(session, makeUserData(OWNER_USER_ID));

		const trigger = screen.queryByRole('button', {
			name: 'groupChat.info.settings.headline'
		});
		expect(trigger).toBeNull();
	});

	it('test 4: owner of a RUNNING group chat sees NO three-dot trigger', () => {
		const session = makeGroupSession({ active: true });
		renderItem(session);

		const trigger = screen.queryByRole('button', {
			name: 'groupChat.info.settings.headline'
		});
		expect(trigger).toBeNull();
	});
});
