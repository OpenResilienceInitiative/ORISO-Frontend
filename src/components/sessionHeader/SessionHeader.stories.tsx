import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import {
	ActiveSessionContext,
	AUTHORITIES,
	buildExtendedSession,
	ConsultantListContext,
	ConsultingTypesContext,
	E2EEContext,
	SessionsDataContext,
	SessionTypeContext,
	TopicsContext,
	UserDataContext,
	type ExtendedSessionInterface
} from '../../globalState';
import { ServerSettingsContext } from '../../globalState/provider/ServerSettingsProvider';
import { MatrixClientContext } from '../../globalState/context/MatrixClientContext';
import type {
	ConsultingTypeInterface,
	GroupChatItemInterface,
	ListItemInterface,
	SessionItemInterface,
	TopicsDataInterface
} from '../../globalState/interfaces';
import {
	REGISTRATION_TYPE_REGISTERED,
	STATUS_ACTIVE,
	STATUS_EMPTY,
	STATUS_ENQUIRY
} from '../../globalState/interfaces';
import { SESSION_LIST_TYPES } from '../session/sessionHelpers';
import { SessionHeaderComponent } from './SessionHeaderComponent';
import { GroupChatHeader } from './GroupChatHeader';
import { buildStageMatrixClientService } from '../chatStage/__storybook__/ChatStageProviders';
import { phone390Globals } from '../message/messageStoryShell';
import './sessionHeader.styles.scss';

const APP_ORISO_CHAT_HEADER_FIGMA_URL =
	'https://www.figma.com/design/L2mOFNSGdxPPx1XA4HFAog/App.Oriso?node-id=1131-44172&t=7scG0mpt60RDLUqB-4';
const ROOM_HEADER_FIGMA_URL =
	'https://www.figma.com/design/L2mOFNSGdxPPx1XA4HFAog/App.Oriso?node-id=1320-38281';

/* ------------------------------------------------------------------ *
 * Shared fixtures
 * ------------------------------------------------------------------ */

const storyTopic: TopicsDataInterface = {
	id: 1,
	name: 'Familienberatung',
	slug: 'familienberatung',
	description: 'Storybook fixture topic.',
	internalIdentifier: 'familienberatung',
	status: 'active',
	createDate: '2026-03-01T00:00:00.000Z',
	updateDate: '2026-03-01T00:00:00.000Z',
	fallbackUrl: '',
	titles: {
		short: 'Familie',
		long: 'Familienberatung',
		registrationDropdown: 'Familienberatung',
		welcome: 'Familienberatung'
	}
};

const storyConsultingType: ConsultingTypeInterface = {
	id: 1,
	showAskerProfile: true,
	titles: {
		default: '1-1 Beratung',
		short: '1-1',
		long: '1-1 Beratung',
		welcome: 'Willkommen',
		registrationDropdown: '1-1 Beratung'
	},
	isVideoCallAllowed: true,
	isSubsequentRegistrationAllowed: true,
	urls: {
		registrationPostcodeFallbackUrl: '',
		requiredAidMissingRedirectUrl: ''
	},
	registration: {
		autoSelectAgency: false,
		autoSelectPostcode: false,
		notes: {}
	},
	groupChat: {
		isGroupChat: false,
		groupChatRules: ['']
	},
	description: 'Storybook fixture for the chatroom header.',
	slug: 'one-on-one',
	languageFormal: true,
	welcomeScreen: {
		anonymous: {
			title: 'Willkommen',
			text: ''
		}
	}
};

// Consultant viewer. `userId` matches the session consultant id below so the
// header does not treat the current user as a read-only supervisor (which would
// otherwise suppress the interactive "+").
const CONSULTANT_ID = 'consultant-storybook';
const storyUserData = {
	userId: CONSULTANT_ID,
	userName: 'beraterin@example.invalid',
	displayName: 'Beraterin ORISO',
	grantedAuthorities: [AUTHORITIES.CONSULTANT_DEFAULT],
	userRoles: ['CONSULTANT'],
	twoFactorAuth: {
		isEnabled: false,
		isActive: false,
		isShown: false,
		isToBeActivated: false,
		secret: '',
		qrCode: ''
	}
} as any;

/* ------------------------------------------------------------------ *
 * Matrix client mock (GroupChatHeader reads members from the client)
 * ------------------------------------------------------------------ */

type MockMember = { userId: string; name: string };

const makeMembers = (count: number): MockMember[] =>
	Array.from({ length: count }, (_, index) => ({
		userId: `@mitglied${index + 1}:matrix.storybook.test`,
		name: `Mitglied ${index + 1}`
	}));

// The chat-stage stand-in implements the client surface the header and
// SessionMenu touch (`on`/`removeListener`/`getAccountData`/`setAccountData`,
// room members, live timeline) — the earlier minimal mock threw in the
// browser and kept three stories on `!test`.
const makeMatrixClientService = (
	members: MockMember[],
	lastActivity: Record<string, number> = {}
) => buildStageMatrixClientService({}, members, lastActivity);

/* ------------------------------------------------------------------ *
 * Session presets (one factory per Figma condition)
 * ------------------------------------------------------------------ */

const buildSingleSession = (
	status: typeof STATUS_ACTIVE | typeof STATUS_EMPTY | typeof STATUS_ENQUIRY
): ExtendedSessionInterface =>
	buildExtendedSession(
		{
			user: {
				username: 'ruhiges-yak-kim@example.invalid',
				displayName: 'Ruhiges Yak Kim',
				sessionData: {}
			},
			consultant: {
				consultantId: CONSULTANT_ID,
				id: CONSULTANT_ID,
				username: 'beraterin@example.invalid',
				displayName: 'Beraterin ORISO',
				absent: false,
				absenceMessage: ''
			},
			language: 'de',
			session: {
				id: 4401,
				agencyId: 101,
				askerMatrixUserId: 'asker-4401',
				attachment: null,
				consultingType: 1,
				matrixRoomId: 'sb-single-room-4401',
				e2eLastMessage: null,
				lastMessage: 'Anfrage gesendet',
				messageDate: 1773822900,
				createDate: '2026-03-18T06:15:00.000Z',
				messagesRead: true,
				postcode: 12345,
				registrationType: REGISTRATION_TYPE_REGISTERED,
				status,
				videoCallMessageDTO: null,
				topic: {
					id: 1,
					name: 'Familienberatung',
					description: ''
				}
			} as unknown as SessionItemInterface
		} as ListItemInterface,
		''
	);

const buildGroupSession = (): ExtendedSessionInterface =>
	buildExtendedSession(
		{
			consultant: {
				consultantId: CONSULTANT_ID,
				id: CONSULTANT_ID,
				username: 'beraterin@example.invalid',
				displayName: 'Beraterin ORISO',
				absent: false,
				absenceMessage: ''
			},
			language: 'de',
			chat: {
				active: true,
				assignedAgencies: [],
				attachment: null,
				consultingType: 1,
				duration: 60,
				matrixRoomId: 'sb-group-room-9001',
				hintMessage: '',
				id: 9001,
				lastMessage: 'Willkommen im Team-Austausch.',
				e2eLastMessage: null,
				messageDate: 1773822900,
				messagesRead: true,
				moderators: [],
				repetitive: false,
				startDate: '2026-03-18',
				startTime: '10:00',
				subscribed: true,
				topic: 'Team Austausch',
				createdAt: '2026-03-18T06:15:00.000Z'
			} as unknown as GroupChatItemInterface
		} as ListItemInterface,
		''
	);

// 1. Group, ≤4 members (design shows individual member avatars).
export const mockGroupSessionSmall = () => ({
	session: buildGroupSession(),
	members: makeMembers(4)
});

// 2. Group, >4 members (design shows a "+N" overflow badge).
export const mockGroupSessionLarge = () => ({
	session: buildGroupSession(),
	members: makeMembers(27)
});

// 3. Active 1-on-1 (nearby / vicinity, AGENCY_COUNSELLING) → house + add.
export const mockActiveConversation = () => ({
	session: buildSingleSession(STATUS_ACTIVE)
});

// 4. Waiting room (empty enquiry) — design pairs the clock glyph with an add button.
export const mockWaitingRoomWithAdd = () => ({
	session: buildSingleSession(STATUS_EMPTY)
});

// 5. Inquiry (non-empty enquiry) — design pairs the "C" glyph with an add button.
export const mockInquiryWithAdd = () => ({
	session: buildSingleSession(STATUS_ENQUIRY)
});

// 6. Waiting room, no add.
export const mockWaitingRoom = () => ({
	session: buildSingleSession(STATUS_EMPTY)
});

// 7. Inquiry, no add.
export const mockInquiry = () => ({
	session: buildSingleSession(STATUS_ENQUIRY)
});

/* ------------------------------------------------------------------ *
 * Providers shared by every story
 * ------------------------------------------------------------------ */

const headerShell: React.CSSProperties = {
	maxWidth: 720,
	margin: '0 auto',
	background: '#fff'
};

const StoryProviders = ({
	session,
	members = [],
	lastActivity,
	children
}: {
	session: ExtendedSessionInterface;
	members?: MockMember[];
	lastActivity?: Record<string, number>;
	children: React.ReactNode;
}) => {
	const matrixClientService = React.useMemo(
		() => makeMatrixClientService(members, lastActivity),
		[members, lastActivity]
	);

	return (
		<div style={headerShell}>
			<UserDataContext.Provider
				value={{
					userData: storyUserData,
					setUserData: () => {},
					reloadUserData: async () => storyUserData
				}}
			>
				<SessionTypeContext.Provider
					value={{
						type: SESSION_LIST_TYPES.MY_SESSION,
						path: '/sessions/consultant/sessionView'
					}}
				>
					<ConsultingTypesContext.Provider
						value={{
							consultingTypes: [storyConsultingType],
							setConsultingTypes: () => {}
						}}
					>
						<TopicsContext.Provider
							value={{
								topics: [storyTopic],
								refreshTopics: () => {}
							}}
						>
							<SessionsDataContext.Provider
								value={{
									ready: true,
									sessions: [],
									dispatch: () => {}
								}}
							>
								<E2EEContext.Provider
									value={{
										key: '',
										reloadPrivateKey: () => {},
										isE2eeEnabled: false,
										e2EEReady: true
									}}
								>
									<ConsultantListContext.Provider
										value={{
											consultantList: [],
											setConsultantList: () => {}
										}}
									>
										<ServerSettingsContext.Provider
											value={{
												settings: [],
												settingsReady: true,
												getSetting: () => null
											}}
										>
											<MatrixClientContext.Provider
												value={{
													matrixClientService,
													setMatrixClientService:
														() => {}
												}}
											>
												<ActiveSessionContext.Provider
													value={{
														activeSession: session,
														reloadActiveSession:
															() => {},
														readActiveSession:
															() => {}
													}}
												>
													{children}
												</ActiveSessionContext.Provider>
											</MatrixClientContext.Provider>
										</ServerSettingsContext.Provider>
									</ConsultantListContext.Provider>
								</E2EEContext.Provider>
							</SessionsDataContext.Provider>
						</TopicsContext.Provider>
					</ConsultingTypesContext.Provider>
				</SessionTypeContext.Provider>
			</UserDataContext.Provider>
		</div>
	);
};

const noopRef = { current: false };

const renderGroupHeader = (preset: {
	session: ExtendedSessionInterface;
	members?: MockMember[];
}) => (
	<StoryProviders session={preset.session} members={preset.members}>
		<GroupChatHeader
			hasUserInitiatedStopOrLeaveRequest={noopRef}
			isJoinGroupChatView={false}
			bannedUsers={[]}
		/>
	</StoryProviders>
);

const renderSessionHeader = (
	preset: {
		session: ExtendedSessionInterface;
		members?: MockMember[];
		lastActivity?: Record<string, number>;
	},
	showAddButton?: boolean
) => (
	<StoryProviders
		session={preset.session}
		members={preset.members}
		lastActivity={preset.lastActivity}
	>
		<SessionHeaderComponent
			bannedUsers={[]}
			showAddButton={showAddButton}
		/>
	</StoryProviders>
);

// T4: the 1-on-1 room's participants (client · counsellor · supervisor).
const ASKER_MATRIX_ID = 'asker-4401';
const roomParticipants: MockMember[] = [
	{ userId: ASKER_MATRIX_ID, name: 'ruhiges_yak_kim' },
	{ userId: '@beraterin:matrix.storybook.test', name: 'Beraterin ORISO' },
	{ userId: '@bettina.b:matrix.storybook.test', name: 'Bettina B.' }
];

// 8. Active 1-on-1 with the room's participants in the header avatar row.
export const mockActiveConversationWithParticipants = () => ({
	session: buildSingleSession(STATUS_ACTIVE),
	members: roomParticipants,
	// The supervisor wrote last → first in the stack (FE#1193 Job 1).
	lastActivity: {
		[ASKER_MATRIX_ID]: 100,
		'@beraterin:matrix.storybook.test': 200,
		'@bettina.b:matrix.storybook.test': 300
	}
});

// 9. Six participants → four avatars + "+2" (FE#1193 Job 2).
export const mockActiveConversationManyParticipants = () => ({
	session: buildSingleSession(STATUS_ACTIVE),
	members: [
		...roomParticipants,
		{ userId: '@kim:matrix.storybook.test', name: 'Kim G.' },
		{ userId: '@ali:matrix.storybook.test', name: 'Ali R.' },
		{ userId: '@jo:matrix.storybook.test', name: 'Jo L.' }
	]
});

// Asserts the "+" add pill is present and rendered to the LEFT of the type
// glyph (Figma #430 layout order).
const expectAddButtonLeftOfType = async (canvasElement: HTMLElement) => {
	await waitFor(() => {
		const add = canvasElement.querySelector(
			'.chatroomMainInteractionIcon__add'
		);
		const type = canvasElement.querySelector(
			'.chatroomMainInteractionIcon__type'
		);
		expect(add).toBeTruthy();
		expect(type).toBeTruthy();
		// eslint-disable-next-line no-bitwise
		const addIsBeforeType =
			add!.compareDocumentPosition(type!) &
			Node.DOCUMENT_POSITION_FOLLOWING;
		expect(addIsBeforeType).toBeTruthy();
	});
};

/**
 * The title ends in an ellipsis before the action group — it is never
 * painted over by the call buttons (stage v3 review, 05.09.).
 */
const expectTitleClearOfActions = async (canvasElement: HTMLElement) => {
	const title = canvasElement.querySelector<HTMLElement>(
		'.sessionInfo__username h3'
	)!;
	const actions = canvasElement.querySelector<HTMLElement>(
		'.sessionInfo__headerWrapper > .sessionMenu__wrapper'
	)!;
	await expect(title).not.toBeNull();
	await expect(actions).not.toBeNull();
	const titleRect = title.getBoundingClientRect();
	const actionsRect = actions.getBoundingClientRect();
	await expect(titleRect.right).toBeLessThanOrEqual(actionsRect.left + 0.5);
	await expect(getComputedStyle(title).textOverflow).toBe('ellipsis');
	return { titleRect, actionsRect };
};

/* ------------------------------------------------------------------ *
 * Meta + stories
 * ------------------------------------------------------------------ */

const meta = {
	title: 'Components/Session/SessionHeader',
	tags: ['autodocs'],
	// The `mock*` factories are exported presets, not stories — keep them out
	// of the Storybook sidebar.
	excludeStories: /^mock.*/,
	parameters: {
		layout: 'fullscreen',
		router: {
			initialPath: '/sessions/consultant/sessionView/session/4401'
		},
		design: [
			{
				type: 'figma',
				name: 'Chatroom header conditions',
				url: APP_ORISO_CHAT_HEADER_FIGMA_URL
			},
			{
				type: 'figma',
				name: 'Room Header All (1320:38281)',
				url: ROOM_HEADER_FIGMA_URL
			}
		],
		docs: {
			description: {
				component:
					'Chatroom left header across the seven Figma conditions. Group stories render `GroupChatHeader`; the 1-on-1 stories render `SessionHeaderComponent`. TODO notes flag where the current implementation diverges from the Figma design.'
			}
		}
	}
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Group chat with ≤4 members.
 * Expected (Figma #430): every member avatar is shown (no cap), no overflow badge.
 * TODO: keep verifying against Figma until Fix 1 (GroupChatHeader member logic)
 * is merged — the ≤4 branch now renders all avatars instead of the old 3-cap.
 */
export const GroupChatSmall: Story = {
	render: () => renderGroupHeader(mockGroupSessionSmall())
};

/**
 * Group chat with >4 members (27 here).
 * Expected (Figma #430): no avatars, a single "+N people" count badge instead.
 */
export const GroupChatLarge: Story = {
	render: () => renderGroupHeader(mockGroupSessionLarge()),
	play: async ({ canvasElement }) => {
		await waitFor(() => {
			const badge = canvasElement.querySelector(
				'.sessionInfo__memberCount'
			);
			expect(badge).toBeTruthy();
			expect(
				canvasElement.querySelector('.sessionInfo__memberCountNumber')
					?.textContent
			).toContain('+27');
			// No stacked member avatars when the badge is shown.
			expect(
				canvasElement.querySelectorAll('.sessionInfo__memberBubble')
					.length
			).toBe(0);
		});
	}
};

/**
 * Active 1-on-1 conversation (nearby / vicinity, AGENCY_COUNSELLING).
 * Expected (Figma): house icon + add button + the contact's avatar (animal,
 * FE#1193 Job 4) — no Matrix members yet, so the stack falls back to the contact.
 */
export const ActiveConversation: Story = {
	render: () => renderSessionHeader(mockActiveConversation()),
	play: async ({ canvasElement }) => {
		await waitFor(() => {
			expect(
				canvasElement.querySelectorAll('[data-cy="participant-avatar"]')
			).toHaveLength(1);
			// T8: no "•••" next to the topic tag.
			expect(
				canvasElement.querySelector('.sessionInfo__topicDots')
			).toBeNull();
			expect(canvasElement.textContent).not.toContain('•••');
		});
	}
};

/**
 * T4 / Figma 1320:38281: the room's participants as the avatar row —
 * animal for the advice seeker, monograms for the counsellors, 22 px step,
 * latest activity first, hover / focus shows the display name (#1209: the
 * asker's anonymous id, identical to the title).
 */
export const ActiveConversationParticipants: Story = {
	name: 'Active conversation — participant avatar row (T4)',
	render: () => renderSessionHeader(mockActiveConversationWithParticipants()),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		let avatars: NodeListOf<HTMLElement>;
		await waitFor(() => {
			avatars = canvasElement.querySelectorAll<HTMLElement>(
				'[data-cy="participant-avatar"]'
			);
			expect(avatars).toHaveLength(3);
		});
		// Latest activity first: the supervisor wrote last.
		await expect(avatars![0].getAttribute('data-user-id')).toBe(
			'@bettina.b:matrix.storybook.test'
		);
		// 22 px step between avatars.
		const first = avatars![0].getBoundingClientRect();
		const second = avatars![1].getBoundingClientRect();
		await expect(Math.round(second.left - first.left)).toBe(22);
		// Hover shows the name; the asker's tooltip is exactly what the
		// header title shows (#1209: one identity, list = header = tooltip).
		const headerTitle =
			canvasElement.querySelector('h3')?.textContent ?? '';
		await expect(headerTitle.length).toBeGreaterThan(0);
		const askerAvatar = canvasElement.querySelector<HTMLElement>(
			`[data-user-id="${ASKER_MATRIX_ID}"]`
		)!;
		await userEvent.hover(askerAvatar);
		await waitFor(() =>
			expect(
				canvas.getByText(headerTitle, { selector: '[role="tooltip"]' })
			).toBeVisible()
		);
		// … and it is not clipped by the header row (T4 self-check).
		const tip = canvas.getByText(headerTitle, {
			selector: '[role="tooltip"]'
		});
		const tipRect = tip.getBoundingClientRect();
		const rowRect = canvasElement
			.querySelector('.sessionInfo__username')!
			.getBoundingClientRect();
		await expect(tipRect.top).toBeGreaterThan(rowRect.bottom - 1);
		// No clipping ancestor cuts it off (the tooltip is pointer-events:
		// none, so elementFromPoint cannot be used here).
		let ancestor = tip.parentElement;
		while (ancestor && ancestor !== canvasElement) {
			if (getComputedStyle(ancestor).overflow !== 'visible') {
				const box = ancestor.getBoundingClientRect();
				await expect(tipRect.top).toBeGreaterThanOrEqual(box.top);
				await expect(tipRect.bottom).toBeLessThanOrEqual(box.bottom);
			}
			ancestor = ancestor.parentElement;
		}
		// T3: the hairline sits at 16 + 6 + 40 + 6 = 68 px from the header
		// top; the row's box (incl. the 1 px hairline) ends at 69.
		const header = canvasElement.querySelector('.sessionInfo')!;
		const row = canvasElement.querySelector('.sessionInfo__headerWrapper')!;
		await expect(
			Math.round(
				row.getBoundingClientRect().bottom -
					header.getBoundingClientRect().top
			)
		).toBe(69);
		await expectTitleClearOfActions(canvasElement);
	}
};

/** FE#1193 Job 2: beyond four participants the tail folds into "+N". */
export const ActiveConversationManyParticipants: Story = {
	name: 'Active conversation — six participants, "+2"',
	render: () => renderSessionHeader(mockActiveConversationManyParticipants()),
	play: async ({ canvasElement }) => {
		await waitFor(() => {
			expect(
				canvasElement.querySelectorAll('[data-cy="participant-avatar"]')
			).toHaveLength(4);
			expect(
				canvasElement.querySelector('[data-cy="participant-overflow"]')
					?.textContent
			).toBe('+2');
		});
		// The "+2" chip sits in the flow, before the title — never over it.
		const chip = canvasElement
			.querySelector('[data-cy="participant-overflow"]')!
			.getBoundingClientRect();
		const title = canvasElement
			.querySelector('.sessionInfo__username h3')!
			.getBoundingClientRect();
		await expect(chip.right).toBeLessThanOrEqual(title.left + 0.5);
		await expectTitleClearOfActions(canvasElement);
	}
};

/**
 * Phone (390 px): back button, type pill and the inline call buttons take
 * 236 of the 358 px row before any avatar, so the stack is capped at one
 * avatar + a compact "+N" and the title keeps ≥ 40 % of the width it shares
 * with the stack — and still ends before the actions. Whether the call
 * buttons move into the kebab on the phone is Frank's call (stage v3 review).
 */
export const ActiveConversationManyParticipantsPhone: Story = {
	name: 'Active conversation — six participants on the phone (1 + "+5")',
	globals: phone390Globals,
	render: () => renderSessionHeader(mockActiveConversationManyParticipants()),
	play: async ({ canvasElement }) => {
		await waitFor(() => {
			expect(
				canvasElement.querySelectorAll('[data-cy="participant-avatar"]')
			).toHaveLength(1);
			expect(
				canvasElement.querySelector('[data-cy="participant-overflow"]')
					?.textContent
			).toBe('+5');
		});
		const { titleRect } = await expectTitleClearOfActions(canvasElement);
		const stack = canvasElement
			.querySelector('[data-cy="session-header-participants"]')!
			.getBoundingClientRect();
		await expect(
			titleRect.width / (titleRect.width + stack.width)
		).toBeGreaterThanOrEqual(0.4);
	}
};

/**
 * Waiting room (empty enquiry) with the add button.
 * Expected (Figma #430): add button on the LEFT + clock glyph on the RIGHT.
 * `showAddButton` opts this enquiry state into showing the "+".
 */
export const WaitingRoomWithAdd: Story = {
	render: () => renderSessionHeader(mockWaitingRoomWithAdd(), true),
	play: async ({ canvasElement }) => {
		await expectAddButtonLeftOfType(canvasElement);
		expect(
			canvasElement.querySelector('.chatroomMainInteractionIcon--waiting')
		).toBeTruthy();
	}
};

/**
 * Inquiry (non-empty enquiry) with the add button.
 * Expected (Figma #430): add button on the LEFT + red "C" glyph on the RIGHT.
 * `showAddButton` opts this enquiry state into showing the "+".
 */
export const InquiryWithAdd: Story = {
	render: () => renderSessionHeader(mockInquiryWithAdd(), true),
	play: async ({ canvasElement }) => {
		await expectAddButtonLeftOfType(canvasElement);
		expect(
			canvasElement.querySelector('.chatroomMainInteractionIcon--inquiry')
		).toBeTruthy();
	}
};

/**
 * Waiting room (empty enquiry), no add button.
 * Expected (Figma): clock glyph, no add button. Matches.
 */
export const WaitingRoom: Story = {
	render: () => renderSessionHeader(mockWaitingRoom())
};

/**
 * Inquiry (non-empty enquiry), no add button.
 * Expected (Figma): red "C" glyph, no add button. Matches.
 */
export const Inquiry: Story = {
	render: () => renderSessionHeader(mockInquiry())
};
