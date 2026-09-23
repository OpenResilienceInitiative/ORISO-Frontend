import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { setMatrixClientServiceRef } from '../../services/matrixClientRegistry';
import {
	ActiveSessionContext,
	AUTHORITIES,
	buildExtendedSession,
	ConsultingTypesContext,
	E2EEContext,
	SessionTypeContext,
	SessionsDataContext,
	TopicsContext,
	UserDataContext
} from '../../globalState';
import type {
	ConsultingTypeInterface,
	GroupChatItemInterface,
	ListItemInterface,
	TopicsDataInterface
} from '../../globalState/interfaces';
import {
	REGISTRATION_TYPE_REGISTERED,
	STATUS_ACTIVE
} from '../../globalState/interfaces';
import { SESSION_LIST_TYPES } from '../session/sessionHelpers';
import { LegalLinksContext } from '../../globalState/provider/LegalLinksProvider';
import { computeOrisoPalette } from '../../utils/theme/orisoScheme';
import { SessionListItemComponent } from './SessionListItemComponent';
import './sessionsListItem.styles.scss';

const APP_ORISO_CHAT_FIGMA_URL =
	'https://www.figma.com/design/L2mOFNSGdxPPx1XA4HFAog/App.Oriso?node-id=316-17725&t=XHH5HQNmA8DUWl2U-0';
const ORISO_M3_FIGMA_URL =
	'https://www.figma.com/design/RTUi1rcrEWECXz8rNFmj7Q/Design-System-M3_ORISO?node-id=60853-24182&p=f&t=ieIskw4Lz5hlc7iM-0';

const listShell: React.CSSProperties = {
	backgroundColor: '#eae7e8',
	maxWidth: 440,
	margin: '0 auto',
	padding: '4px 8px'
};

const storyTopic = (
	id: number,
	slug: string,
	name: string
): TopicsDataInterface => ({
	id,
	name,
	slug,
	description: 'Storybook runtime topic.',
	internalIdentifier: slug,
	status: 'active',
	createDate: '2026-03-01T00:00:00.000Z',
	updateDate: '2026-03-01T00:00:00.000Z',
	fallbackUrl: '',
	titles: {
		short: name,
		long: name,
		registrationDropdown: name,
		welcome: name
	}
});

const runtimeTopic = storyTopic(1, 'familienberatung', 'Familienberatung');
const longTopic = storyTopic(
	2,
	'familienberatung-lang',
	'Familienberatung mit sehr langem Themenlabel'
);
const addictionTopic = storyTopic(3, 'sucht', 'Sucht');
const runtimeTopics = [runtimeTopic, longTopic, addictionTopic];

const runtimeConsultingType: ConsultingTypeInterface = {
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
	description: 'Storybook runtime fixture for the real session row.',
	slug: 'one-on-one',
	languageFormal: true,
	welcomeScreen: {
		anonymous: {
			title: 'Willkommen',
			text: ''
		}
	}
};

const runtimeSession: ListItemInterface = {
	user: {
		username: 'ruhiges-yak-kim@example.invalid',
		displayName: 'ruhiges Yak Kim',
		sessionData: {}
	},
	consultant: {
		consultantId: 'consultant-storybook',
		id: 'consultant-storybook',
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
		matrixRoomId: 'storybook-runtime-room-4401',
		e2eLastMessage: null,
		lastMessage: 'Anfrage gesendet',
		messageDate: 1773822900,
		createDate: '2026-03-18T06:15:00.000Z',
		messagesRead: false,
		postcode: 12345,
		registrationType: REGISTRATION_TYPE_REGISTERED,
		status: STATUS_ACTIVE,
		videoCallMessageDTO: null,
		topic: runtimeTopic
	}
};

const runtimeUserData = {
	userId: 'consultant-storybook',
	userName: 'beraterin@example.invalid',
	displayName: 'Beraterin ORISO',
	grantedAuthorities: [AUTHORITIES.CONSULTANT_DEFAULT],
	twoFactorAuth: {
		isEnabled: false,
		isActive: false,
		isShown: false,
		isToBeActivated: false,
		secret: '',
		qrCode: ''
	}
} as any;

/** A group chat owned by the viewer, so its row offers the settings menu. */
const runtimeGroupChat = ({
	id,
	name,
	lastMessage = '',
	repetitive = false,
	conversationType
}: {
	id: number;
	name: string;
	lastMessage?: string;
	repetitive?: boolean;
	conversationType?: GroupChatItemInterface['conversationType'];
}): ListItemInterface => ({
	consultant: runtimeSession.consultant,
	chat: {
		id,
		topic: name,
		conversationType,
		repetitive,
		active: false,
		consultingType: 1,
		matrixRoomId: `storybook-group-${id}`,
		lastMessage,
		messageDate: 1773736500,
		messagesRead: true,
		moderators: [],
		assignedAgencies: [],
		attachment: null,
		duration: 60,
		hintMessage: '',
		e2eLastMessage: null,
		startDate: '2026-03-17',
		startTime: '10:00',
		subscribed: true,
		createdAt: '2026-03-17T10:00:00.000Z'
	} as GroupChatItemInterface
});

/** The real row inside the providers it reads; no list shell of its own. */
function RuntimeCard({
	item,
	userData = runtimeUserData,
	index = 0,
	isBeforeActive = false,
	isAfterActive = false
}: {
	item: ListItemInterface;
	userData?: any;
	index?: number;
	isBeforeActive?: boolean;
	isAfterActive?: boolean;
}) {
	const activeSession = buildExtendedSession(item, '');

	return (
		<UserDataContext.Provider
			value={{
				userData,
				setUserData: () => {},
				reloadUserData: async () => userData
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
						consultingTypes: [runtimeConsultingType],
						setConsultingTypes: () => {}
					}}
				>
					<TopicsContext.Provider
						value={{
							topics: runtimeTopics,
							refreshTopics: () => {}
						}}
					>
						<SessionsDataContext.Provider
							value={{
								ready: true,
								sessions: [item],
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
								<LegalLinksContext.Provider value={[]}>
									<ActiveSessionContext.Provider
										value={{
											activeSession,
											reloadActiveSession: () => {},
											readActiveSession: () => {}
										}}
									>
										<SessionListItemComponent
											defaultLanguage="de"
											handleKeyDownLisItemContent={() => {}}
											index={index}
											isBeforeActive={isBeforeActive}
											isAfterActive={isAfterActive}
										/>
									</ActiveSessionContext.Provider>
								</LegalLinksContext.Provider>
							</E2EEContext.Provider>
						</SessionsDataContext.Provider>
					</TopicsContext.Provider>
				</ConsultingTypesContext.Provider>
			</SessionTypeContext.Provider>
		</UserDataContext.Provider>
	);
}

type RuntimeSessionOptions = {
	lastMessage?: string;
	/** Extra `session` DTO fields, e.g. the ADR-008 `supervision` marker. */
	sessionOverrides?: Partial<ListItemInterface['session']>;
	/** Extra `user` fields, e.g. a live-chat guest's animal name. */
	userOverrides?: Partial<ListItemInterface['user']>;
	/** Owning consultant of the row (defaults to the viewer = own session). */
	consultantId?: string;
	/** Logged-in consultant. */
	viewerId?: string;
	/** FE#1115: the advice seeker's unaccepted row; no consultant, so the avatar slot holds the magnet. */
	asSearchingAsker?: boolean;
};

const runtimeSessionItem = ({
	lastMessage = runtimeSession.session.lastMessage,
	sessionOverrides = {},
	userOverrides = {},
	consultantId = runtimeSession.consultant.id,
	asSearchingAsker = false
}: RuntimeSessionOptions = {}): ListItemInterface => ({
	...runtimeSession,
	user: { ...runtimeSession.user, ...userOverrides },
	consultant: asSearchingAsker
		? undefined
		: {
				...runtimeSession.consultant,
				consultantId,
				id: consultantId
			},
	session: {
		...runtimeSession.session,
		lastMessage,
		...sessionOverrides
	}
});

const runtimeViewer = ({
	viewerId = runtimeUserData.userId,
	asSearchingAsker = false
}: RuntimeSessionOptions = {}) =>
	asSearchingAsker
		? {
				...runtimeUserData,
				userId: 'asker-4401',
				grantedAuthorities: [AUTHORITIES.ASKER_DEFAULT],
				userRoles: ['USER']
			}
		: { ...runtimeUserData, userId: viewerId };

function RuntimeSessionListItem(options: RuntimeSessionOptions = {}) {
	return (
		<div style={listShell}>
			<RuntimeCard
				item={runtimeSessionItem(options)}
				userData={runtimeViewer(options)}
			/>
		</div>
	);
}

const meta = {
	title: 'Components/Session/List/SessionListItem',
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		backgrounds: { default: 'gray' },
		router: {
			initialPath: '/sessions/consultant/sessionView/session/4401'
		},
		design: [
			{
				type: 'figma',
				name: 'App.Oriso consultant chat',
				url: APP_ORISO_CHAT_FIGMA_URL
			},
			{
				type: 'figma',
				name: 'Design System M3 ORISO',
				url: ORISO_M3_FIGMA_URL
			}
		],
		docs: {
			description: {
				component:
					'Every story mounts the real `SessionListItemComponent` with fixture providers. ' +
					'The route in `parameters.router` decides which card is selected; ' +
					'`ConsultantSelected` shows the #597 ring `2px solid var(--m3-primary)`.'
			}
		}
	}
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Unread axis (#1147): read state is derived from the Matrix room, not from
 * the DTO's hard-coded `messagesRead`. Seed the registry so the runtime
 * stories pin both visual states.
 */
const seedMatrixRoom = (unreadCount: number) => {
	setMatrixClientServiceRef({
		getClient: () => null,
		getRoom: () => ({
			getUnreadNotificationCount: () => unreadCount
		})
	} as any);
};

export const RuntimeComponent: Story = {
	render: () => {
		seedMatrixRoom(2);
		return <RuntimeSessionListItem />;
	},
	play: async ({ canvasElement }) => {
		await waitFor(() => {
			const username = canvasElement.querySelector(
				'.sessionsListItem__username'
			);
			expect(username).not.toBeNull();
			expect(
				username!.classList.contains(
					'sessionsListItem__username--readLabel'
				)
			).toBe(false);
		});
		// #1418: "Mail" is read out once; the envelope beside the word is decoration.
		const canvas = within(canvasElement);
		await expect(canvas.getAllByText('Mail')).toHaveLength(1);
		await expect(canvas.queryByRole('img', { name: 'Mail' })).toBeNull();
	}
};

/**
 * Regression for #1225 / follow-up to #834: the session-list surface must use
 * the same transport-to-plain-text conversion as the Threads list.
 */
export const RuntimeRichTextPreview: Story = {
	name: 'Rich text preview → readable text (#1225)',
	render: () => {
		seedMatrixRoom(2);
		return (
			<RuntimeSessionListItem lastMessage="[[align:left]]<p>Wir haben die Zwei-Minuten-Runde ausprobiert.</p>[[/align]]" />
		);
	},
	play: async ({ canvasElement }) => {
		await waitFor(() => {
			const preview = canvasElement.querySelector(
				'.sessionsListItem__subject'
			);
			expect(preview?.textContent).toBe(
				'Wir haben die Zwei-Minuten-Runde ausprobiert.'
			);
			expect(preview?.textContent).not.toMatch(/\[\[align:|<p>/i);
		});
	}
};

/**
 * Same runtime fixture with a fully read Matrix room and an inactive route:
 * the row must carry the read styling. Under the removed DTO-based logic
 * (`messagesRead` hard-coded true/false) this state was unreachable.
 */
export const RuntimeComponentRead: Story = {
	parameters: {
		router: {
			initialPath: '/sessions/consultant/sessionView'
		}
	},
	render: () => {
		seedMatrixRoom(0);
		return <RuntimeSessionListItem />;
	},
	play: async ({ canvasElement }) => {
		await waitFor(() => {
			const row = canvasElement.querySelector('.sessionsListItem');
			expect(row).not.toBeNull();
			expect(row!.classList.contains('sessionsListItem--read')).toBe(
				true
			);
			expect(
				canvasElement
					.querySelector('.sessionsListItem__username')
					?.classList.contains(
						'sessionsListItem__username--readLabel'
					)
			).toBe(true);
		});
	}
};

/* ------------------------------------------------------------------
 * ADR-008 supervision list marker (`session.supervision`, UserService WP-A)
 * ------------------------------------------------------------------ */

const SUPERVISOR_ID = 'consultant-supervisor';

/**
 * The logged-in consultant is the assigned supervisor of a colleague's
 * session: the row shows the "Supervision" badge instead of the red
 * silent-member eye, and no "request access" (case handover) button.
 */
export const SupervisedByMe: Story = {
	name: 'Supervision — supervised by me (ADR-008)',
	render: () => {
		seedMatrixRoom(0);
		return (
			<RuntimeSessionListItem
				consultantId="consultant-owner"
				viewerId={SUPERVISOR_ID}
				sessionOverrides={{
					supervision: {
						supervisedByMe: true,
						supervisorConsultantIds: [SUPERVISOR_ID],
						supervisorDisplayNames: ['Sabine Supervisor']
					}
				}}
			/>
		);
	},
	play: async ({ canvasElement }) => {
		await waitFor(() => {
			const badge = canvasElement.querySelector(
				'[data-testid="supervision-badge"]'
			);
			expect(badge).not.toBeNull();
			expect(badge!.getAttribute('title')).toContain('Supervision');
			// T9: the list badge uses `supervision_circ` inline (currentColor),
			// the same glyph as the panel header and the FAB.
			expect(
				badge!.querySelector('svg path[fill="currentColor"]')
			).not.toBeNull();
			expect(
				canvasElement.querySelector(
					'.sessionsListItem__handoverActionPrimary'
				)
			).toBeNull();
		});
	}
};

/**
 * The owning consultant's view of the same session: their own row carries a
 * small "Supervision: <name>" indicator so they know who reads along.
 */
export const SupervisedByOthers: Story = {
	name: 'Supervision — supervised by a colleague (owner view)',
	render: () => {
		seedMatrixRoom(0);
		return (
			<RuntimeSessionListItem
				sessionOverrides={{
					supervision: {
						supervisedByMe: false,
						supervisorConsultantIds: [SUPERVISOR_ID],
						supervisorDisplayNames: ['Sabine Supervisor']
					}
				}}
			/>
		);
	},
	play: async ({ canvasElement }) => {
		await waitFor(() => {
			const indicator = canvasElement.querySelector(
				'[data-testid="supervision-indicator"]'
			);
			expect(indicator).not.toBeNull();
			expect(indicator!.textContent).toContain('Sabine Supervisor');
			expect(
				indicator!.querySelector('svg path[fill="currentColor"]')
			).not.toBeNull();
			expect(
				canvasElement.querySelector('[data-testid="supervision-badge"]')
			).toBeNull();
		});
	}
};

/* ------------------------------------------------------------------ *
 * The chat-room menu — Figma 7086-57413
 * ------------------------------------------------------------------ */

/** Rows scale in (0.98 → 1); finish the entrance so geometry is read on the settled card. */
const settleCardEntrance = (canvasElement: HTMLElement) => {
	canvasElement
		.querySelectorAll<HTMLElement>('.sessionsListItem')
		.forEach((row) =>
			row.getAnimations().forEach((animation) => animation.finish())
		);
};

const openTheMenu = async (canvasElement: HTMLElement) => {
	const trigger = await waitFor(() => {
		const element = canvasElement.querySelector<HTMLButtonElement>(
			'.sessionsListItem__menuIcon'
		);
		expect(element).toBeTruthy();
		return element!;
	});
	await userEvent.click(trigger);
	const menu = await waitFor(() => {
		const element = document.querySelector<HTMLElement>(
			'.sessionsListItem__dropdown'
		);
		expect(element).toBeTruthy();
		expect(element!.getBoundingClientRect().width).toBeGreaterThan(0);
		return element!;
	});
	const card = canvasElement.querySelector<HTMLElement>(
		'.sessionsListItem__content'
	)!;
	return { trigger, menu, card };
};

/** The card's shadow with nothing focused — its resting design, not a ring. */
const restingCardShadow = (canvasElement: HTMLElement) =>
	getComputedStyle(
		canvasElement.querySelector<HTMLElement>('.sessionsListItem__content')!
	).boxShadow;

/** Only the menu carries the red ring; asserted on a selected card so the check is not vacuous. */
const expectOnlyTheMenuRinged = async (canvasElement: HTMLElement) => {
	const row = canvasElement.querySelector<HTMLElement>('.sessionsListItem')!;
	await expect(row.classList.contains('sessionsListItem--active')).toBe(true);
	const card = row.querySelector<HTMLElement>('.sessionsListItem__content')!;
	await waitFor(() =>
		expect(getComputedStyle(card).borderTopColor).toBe('rgb(255, 255, 255)')
	);
	// The border keeps its width, so nothing in the list moves.
	await expect(getComputedStyle(card).borderTopWidth).toBe('2px');
};

/** The menu may cover the card's empty strip right of the trigger, but nothing the card shows. */
const expectMenuClearOfCardContent = async (
	menu: HTMLElement,
	card: HTMLElement
) => {
	const m = menu.getBoundingClientRect();
	for (const selector of [
		'.sessionsListItem__menuIcon',
		'.sessionsListItem__date',
		'.sessionsListItem__topic',
		'.sessionsListItem__username',
		'.sessionsListItem__subject',
		'.sessionCard__trailing'
	]) {
		const element = card.querySelector(selector);
		await expect(element, selector).not.toBeNull();
		// Text is measured as ink (its line boxes), not as its block.
		const range = document.createRange();
		range.selectNodeContents(element!);
		const rects = element!.matches(
			'.sessionsListItem__username, .sessionsListItem__subject'
		)
			? Array.from(range.getClientRects())
			: [element!.getBoundingClientRect()];
		for (const r of rects) {
			const apart =
				m.right <= r.left + 0.5 ||
				m.left >= r.right - 0.5 ||
				m.bottom <= r.top + 0.5 ||
				m.top >= r.bottom - 0.5;
			await expect(apart, selector).toBe(true);
		}
	}
};

/** Proves the menu opens beside the card, which stays readable and draws no second focus ring. */
export const MenuBesideTheCard: Story = {
	name: 'Menü — daneben statt darüber (Figma 7086-57413)',
	globals: { viewport: { value: 'desktop1440' } },
	render: () => {
		seedMatrixRoom(0);
		return <RuntimeSessionListItem />;
	},
	play: async ({ canvasElement }) => {
		const atRest = restingCardShadow(canvasElement);
		const { trigger, menu, card } = await openTheMenu(canvasElement);

		// 1. Beside, not on top: nothing the card shows is covered.
		await expectMenuClearOfCardContent(menu, card);
		await expect(menu.dataset.placement).toBe('right');
		// Real numbers: spreading a live DOMRect yields `{}` (fields are on the prototype),
		// which unit tests with plain objects cannot catch.
		await expect(menu.style.left).toMatch(/^\d/);
		await expect(menu.style.top).toMatch(/^\d/);

		// 2. The open trigger is primary with on-primary-container dots.
		await expect(
			trigger.classList.contains('sessionsListItem__menuIcon--open')
		).toBe(true);
		// Wait out the 160 ms cross-fade: `getComputedStyle` returns the in-transition value.
		await waitFor(() => {
			const style = getComputedStyle(trigger);
			expect(style.backgroundColor).toBe('rgb(165, 0, 10)');
			expect(style.color).toBe('rgb(255, 226, 222)');
		});

		// 3. Exactly one focus ring: `--menuOpen` suppresses the card's own.
		const row =
			canvasElement.querySelector<HTMLElement>('.sessionsListItem')!;
		await expect(row.classList.contains('sessionsListItem--menuOpen')).toBe(
			true
		);
		// Focusing the card adds nothing to its resting shadow.
		card.focus();
		await expect(getComputedStyle(card).boxShadow).toBe(atRest);
		await expect(getComputedStyle(card).outlineStyle).toBe('none');

		// 4. The menu is above its own backdrop.
		const backdrop = await waitFor(() => {
			const element =
				document.querySelector<HTMLElement>('.orisoMenuBackdrop');
			expect(element).toBeTruthy();
			return element!;
		});
		await expect(Number(getComputedStyle(menu).zIndex)).toBeGreaterThan(
			Number(getComputedStyle(backdrop).zIndex)
		);

		// 4b. The veil leaves the card uncovered; hit-testing follows what is painted on top.
		const hit = (x: number, y: number) => document.elementFromPoint(x, y);
		const pill = trigger.getBoundingClientRect();
		await waitFor(() =>
			expect(
				trigger.contains(
					hit(
						(pill.left + pill.right) / 2,
						(pill.top + pill.bottom) / 2
					)
				)
			).toBe(true)
		);
		const cardBox = card.getBoundingClientRect();
		await expect(
			card.contains(hit(cardBox.left + 40, cardBox.bottom - 20))
		).toBe(true);
		// Chromium honours the hole for clicks but paints the veil over it if the path
		// exceeds the viewport, so the path must stay in viewport coordinates.
		const pathNumbers = (
			getComputedStyle(backdrop).clipPath.match(/-?\d+(\.\d+)?/g) ?? []
		).map(Number);
		await expect(pathNumbers.length).toBeGreaterThan(8);
		for (const value of pathNumbers) {
			await expect(value).toBeGreaterThanOrEqual(0);
			await expect(value).toBeLessThanOrEqual(
				Math.max(window.innerWidth, window.innerHeight)
			);
		}
		// The rest of the page is still under the veil.
		await expect(hit(cardBox.left - 20, cardBox.top + 20)).toBe(backdrop);
		await expect(hit(cardBox.left + 40, cardBox.bottom + 20)).toBe(
			backdrop
		);

		await expectOnlyTheMenuRinged(canvasElement);

		// 4c. 6 px beside the trigger, also after the row's entrance scale has ended.
		settleCardEntrance(canvasElement);
		await waitFor(() =>
			expect(
				Math.round(
					menu.getBoundingClientRect().left -
						trigger.getBoundingClientRect().right
				)
			).toBe(6)
		);

		// 4d. Hovering the open trigger keeps it primary with light dots.
		await userEvent.hover(trigger);
		await waitFor(() => {
			const style = getComputedStyle(trigger);
			expect(style.backgroundColor).toBe('rgb(165, 0, 10)');
			expect(style.color).toBe('rgb(255, 226, 222)');
		});

		// 5. The trigger stays a horizontal pill.
		const shape = trigger.getBoundingClientRect();
		await expect(shape.width).toBeGreaterThan(shape.height);
	}
};

/** Proves that at 390 px the menu hangs below or above the trigger instead of squeezing beside. */
export const MenuOnThePhone: Story = {
	name: 'Menü — 390 px, Ausweichweg statt Quetschung',
	globals: { viewport: { value: 'phone390' } },
	render: () => {
		seedMatrixRoom(0);
		return <RuntimeSessionListItem />;
	},
	play: async ({ canvasElement }) => {
		const { menu, trigger } = await openTheMenu(canvasElement);
		await expect(['below', 'above']).toContain(menu.dataset.placement);
		// It hangs from the trigger's corner: 2 px below, right edge 4 px in.
		const pill = trigger.getBoundingClientRect();
		const hung = menu.getBoundingClientRect();
		await expect(Math.round(pill.right - hung.right)).toBe(4);
		await expect(Math.round(hung.top - pill.bottom)).toBe(2);
		await expectOnlyTheMenuRinged(canvasElement);
		// And it stays inside the viewport either way.
		const box = menu.getBoundingClientRect();
		await expect(box.left).toBeGreaterThanOrEqual(11.5);
		await expect(box.right).toBeLessThanOrEqual(window.innerWidth - 11.5);
	}
};

/* ------------------------------------------------------------------ *
 * The session card
 * ------------------------------------------------------------------ */

// The signed-off v4 card geometry, asserted on the real `SessionListItemComponent`.
const CARD_HEIGHT = 142;
const CARD_BORDER = 1;
const CARD_INSET = 16;
const CARD_AVATAR = 48;
const CARD_GAP = 12;
const CARD_CHIP_ROW = 48;
const CARD_NAME = 24;
const CARD_LINE = 16;
const CARD_LINES = 3;
/** Where each preview line starts, measured from the avatar's left edge. */
const CARD_LINE_LEFT = [60, 51, 42];
/** The text keeps this far clear of the Mail column from line 2 on. */
const CARD_MAIL_CLEARANCE = 24;

const TEXT_TWO_AND_HALF =
	'Guten Morgen, ich habe gestern mit meiner Schwester gesprochen und wir würden gerne gemeinsam zu einem Gespräch kommen.';
const TEXT_THREE =
	'Hallo, ich wollte fragen ob wir noch einmal über die Situation zu Hause sprechen können. Seit letzter Woche ist es wieder schwieriger geworden und ich weiß gerade nicht weiter.';

type CardPreview = {
	key: string;
	label: string;
	content: Record<string, unknown>;
	text: string;
	glyphs?: Array<'thread' | 'voice'>;
	/** true / false are asserted at desktop width; undefined is not. */
	truncated?: boolean;
};

const textMessage = (body: string, thread = false) => ({
	msgtype: 'm.text',
	body,
	...(thread
		? { 'm.relates_to': { rel_type: 'm.thread', event_id: '$root' } }
		: {})
});

const cardPreviews: CardPreview[] = [
	{
		key: 'word',
		label: '1 — ein Wort',
		content: textMessage('Danke!'),
		text: 'Danke!',
		truncated: false
	},
	{
		key: 'short',
		label: '2 — eine kurze Zeile',
		content: textMessage('Anfrage gesendet'),
		text: 'Anfrage gesendet',
		truncated: false
	},
	{
		key: 'oneAndHalf',
		label: '3 — anderthalb Zeilen',
		content: textMessage(
			'Hallo, hätten Sie nächste Woche einen Termin für mich? 🙂'
		),
		text: 'Hallo, hätten Sie nächste Woche einen Termin für mich? 🙂',
		truncated: false
	},
	{
		key: 'twoAndHalf',
		label: '4 — zweieinhalb Zeilen',
		content: textMessage(TEXT_TWO_AND_HALF),
		text: TEXT_TWO_AND_HALF
	},
	{
		key: 'three',
		label: '5 — drei Zeilen und mehr',
		content: textMessage(TEXT_THREE),
		text: TEXT_THREE,
		truncated: true
	},
	{
		key: 'long',
		label: '6 — viel länger als drei Zeilen',
		content: textMessage(
			`${TEXT_THREE} Mein Vater trinkt wieder mehr und meine Mutter sagt dazu nichts. Ich weiß nicht, wem ich das sonst erzählen soll.`
		),
		text: `${TEXT_THREE} Mein Vater trinkt wieder mehr und meine Mutter sagt dazu nichts. Ich weiß nicht, wem ich das sonst erzählen soll.`,
		truncated: true
	},
	{
		key: 'unbroken',
		label: '7 — ein langes Wort ohne Leerzeichen (Link)',
		content: textMessage(
			'https://www.beispiel-beratung.de/termine/familienberatung/2026/september/buchung?ref=abcdefghijklmnopqrstuvwxyz'
		),
		text: 'https://www.beispiel-beratung.de/termine/familienberatung/2026/september/buchung?ref=abcdefghijklmnopqrstuvwxyz'
	},
	{
		key: 'thread',
		label: 'Thread — nur das Symbol',
		content: textMessage(
			'Ja, das passt mir gut. Ich schicke Ihnen vorher noch die Unterlagen vom Jugendamt, dann können wir die gemeinsam durchgehen, wenn Sie Zeit haben. Am Donnerstag kann ich leider erst ab 16 Uhr.',
			true
		),
		text: 'Ja, das passt mir gut. Ich schicke Ihnen vorher noch die Unterlagen vom Jugendamt, dann können wir die gemeinsam durchgehen, wenn Sie Zeit haben. Am Donnerstag kann ich leider erst ab 16 Uhr.',
		glyphs: ['thread'],
		truncated: true
	},
	{
		key: 'voice',
		label: 'Sprachnachricht — nur das Symbol, mit Dauer',
		content: {
			'msgtype': 'm.audio',
			'body': 'voice-message.ogg',
			'info': { duration: 42_300, mimetype: 'audio/ogg' },
			'org.matrix.msc3245.voice': {}
		},
		text: '0:42',
		glyphs: ['voice'],
		truncated: false
	}
];

const cardRoomId = (key: string) => `!storybook-card-${key}:oriso.example`;

/** Each card reads its own room; the newest event is its preview. */
const seedCardPreviews = () => {
	setMatrixClientServiceRef({
		getClient: () => null,
		getRoom: () => ({ getUnreadNotificationCount: () => 0 }),
		getRoomMessages: (roomId: string) => {
			const preview = cardPreviews.find(
				(candidate) => cardRoomId(candidate.key) === roomId
			);
			return preview
				? [
						{
							getType: () => 'm.room.message',
							getClearContent: () => preview.content,
							getContent: () => preview.content,
							getSender: () => '@asker-4401:oriso.example',
							getTs: () => 1_773_822_900_000
						}
					]
				: [];
		}
	} as any);
};

const CardGallery = () => (
	<div style={{ maxWidth: 440, margin: '0 auto' }}>
		{cardPreviews.map((preview) => (
			<section
				key={preview.key}
				data-preview={preview.key}
				style={{ marginBottom: 12 }}
			>
				<p
					style={{
						margin: '0 12px 4px',
						fontSize: 12,
						fontWeight: 600
					}}
				>
					{preview.label}
				</p>
				<RuntimeSessionListItem
					sessionOverrides={{
						matrixRoomId: cardRoomId(preview.key)
					}}
				/>
			</section>
		))}
	</div>
);

/** Glyph box and text on one line count as one line. */
const mergeLineRects = (rects: DOMRect[]) =>
	rects.reduce<DOMRect[]>((merged, rect) => {
		const last = merged[merged.length - 1];
		if (last && Math.abs(last.top - rect.top) < 4) {
			const left = Math.min(last.left, rect.left);
			merged[merged.length - 1] = new DOMRect(
				left,
				last.top,
				Math.max(last.right, rect.right) - left,
				last.height
			);
		} else {
			merged.push(rect);
		}
		return merged;
	}, []);

const expectCardLayout = async (
	canvasElement: HTMLElement,
	{
		checkTruncation,
		selected
	}: {
		checkTruncation: boolean;
		/** Selected cards carry a 2 px border instead of 1 px. */
		selected: boolean;
	}
) => {
	const sections = await waitFor(() => {
		const found = Array.from(
			canvasElement.querySelectorAll<HTMLElement>('section[data-preview]')
		);
		expect(found).toHaveLength(cardPreviews.length);
		// Every preview has arrived from its room before anything is measured.
		for (const [index, section] of found.entries()) {
			expect(
				section.querySelector('.sessionsListItem__subject')?.textContent
			).toBe(cardPreviews[index].text);
		}
		return found;
	});
	settleCardEntrance(canvasElement);

	for (const [index, section] of sections.entries()) {
		const preview = cardPreviews[index];
		const card = section.querySelector<HTMLElement>(
			'.sessionsListItem__content'
		)!;
		const box = card.getBoundingClientRect();
		const at = (selector: string) => {
			const element = card.querySelector<HTMLElement>(selector);
			expect(element, `${preview.key}: ${selector}`).not.toBeNull();
			return element!.getBoundingClientRect();
		};

		// Compact and uniform — selected or not.
		await expect(Math.round(box.height)).toBe(CARD_HEIGHT);
		await expect(
			section
				.querySelector('.sessionsListItem')!
				.classList.contains('sessionsListItem--active')
		).toBe(selected);

		// The tag sits level with the menu pill at the top of the chip row.
		const tag = at('.sessionsListItem__topic');
		const menu = at('.sessionsListItem__menuIcon');
		await expect(Math.round(tag.top)).toBe(Math.round(menu.top));

		// 48 px avatar straight under the chip row, without its outline.
		const avatar = at('.sessionsListItem__icon');
		await expect(Math.round(avatar.width)).toBe(CARD_AVATAR);
		await expect(Math.round(avatar.top - box.top)).toBe(
			CARD_BORDER + CARD_CHIP_ROW
		);
		await expect(Math.round(avatar.left - box.left)).toBe(
			CARD_BORDER + CARD_INSET
		);
		const circle = card.querySelector<HTMLElement>(
			'[data-testid="user-avatar"] > div'
		)!;
		await expect(getComputedStyle(circle).borderTopWidth).toBe('0px');
		await expect(getComputedStyle(circle).boxShadow).toBe('none');

		// The name, 12 px beside the avatar, on the first line.
		const name = at('.sessionsListItem__username');
		await expect(Math.round(name.left - avatar.right)).toBe(CARD_GAP);
		await expect(Math.round(name.top)).toBe(Math.round(avatar.top));
		await expect(Math.round(name.height)).toBe(CARD_NAME);

		// Mail: its word ends under the pill's right edge, centred on the
		// third line, 16 px above the card's bottom edge.
		const clip = at('.sessionCard__flow');
		const mail = at(
			'.sessionCard__trailing .sessionsListItem__consultingTypeIcon--nearby'
		);
		const labelRange = document.createRange();
		labelRange.selectNodeContents(
			card.querySelector(
				'.sessionCard__trailing .sessionsListItem__consultingTypeIcon--nearbyLabel'
			)!
		);
		await expect(
			Math.abs(labelRange.getBoundingClientRect().right - menu.right)
		).toBeLessThan(0.5);
		const thirdLineCentre =
			clip.top + CARD_NAME + CARD_LINE * 2 + CARD_LINE / 2;
		await expect(
			Math.abs((mail.top + mail.bottom) / 2 - thirdLineCentre)
		).toBeLessThanOrEqual(1);
		await expect(Math.round(box.bottom - CARD_BORDER - mail.bottom)).toBe(
			CARD_INSET
		);

		// The left edge: a steady diagonal, never back to the card's edge.
		const subject = card.querySelector<HTMLElement>(
			'.sessionsListItem__subject'
		)!;
		const range = document.createRange();
		range.selectNodeContents(subject);
		const allLines = mergeLineRects(
			Array.from(range.getClientRects()).filter((rect) => rect.width > 0)
		);
		const lines = allLines.filter((rect) => rect.top < clip.bottom - 0.5);
		await expect(lines.length).toBeGreaterThan(0);
		await expect(lines.length).toBeLessThanOrEqual(CARD_LINES);
		for (const [lineIndex, line] of lines.entries()) {
			await expect(Math.round(line.left - avatar.left)).toBe(
				CARD_LINE_LEFT[lineIndex]
			);
			await expect(line.bottom).toBeLessThanOrEqual(clip.bottom + 0.5);
		}
		// Every line — and the name — ends at the pill's right edge at the
		// latest, so a menu 6 px beside the pill covers no text.
		for (const line of lines) {
			await expect(line.right).toBeLessThanOrEqual(menu.right + 0.5);
		}
		await expect(name.right).toBeLessThanOrEqual(menu.right + 0.5);
		// From the second line on: clear of the Mail column.
		for (const line of lines.slice(1)) {
			await expect(line.right).toBeLessThanOrEqual(
				mail.left - CARD_MAIL_CLEARANCE + 0.5
			);
		}

		// Thread and voice: the glyph, and no word for it.
		const glyphs = Array.from(
			subject.querySelectorAll<SVGElement>(
				'.sessionsListItem__previewGlyph'
			)
		);
		await expect(
			glyphs.map((glyph) =>
				glyph.classList.contains(
					'sessionsListItem__previewGlyph--thread'
				)
					? 'thread'
					: 'voice'
			)
		).toEqual(preview.glyphs ?? []);
		for (const glyph of glyphs) {
			await expect(glyph.getAttribute('aria-label')).toBeTruthy();
			// A fixed-id <mask> in the SVG hides every copy after the first on a page.
			await expect(glyph.querySelector('mask, [mask]')).toBeNull();
			await expect(glyph.getBoundingClientRect().width).toBeGreaterThan(
				0
			);
		}

		// Truncation: the clamp hides lines rather than removing them, so
		// counting all line boxes shows whether the text runs past three.
		const flow = card.querySelector<HTMLElement>('.sessionCard__flow')!;
		await expect(
			getComputedStyle(flow).getPropertyValue('-webkit-line-clamp')
		).toBe(String(CARD_LINES));
		// Only preview lines may sit inside the clamp: WebKit counts the name as one of the
		// three lines (Chromium does not) and misplaces the ellipsis.
		await expect(
			flow.querySelector('.sessionsListItem__username')
		).toBeNull();
		if (checkTruncation && preview.truncated === true) {
			await expect(lines.length).toBe(CARD_LINES);
			await expect(allLines.length).toBeGreaterThan(CARD_LINES);
		}
		if (checkTruncation && preview.truncated === false) {
			await expect(allLines.length).toBeLessThanOrEqual(CARD_LINES);
		}
	}
};

export const CardLayout: Story = {
	name: 'Karte — Umfluss um den Avatar, drei Zeilen, Mail unter dem Knopf',
	render: () => {
		seedCardPreviews();
		return <CardGallery />;
	},
	play: async ({ canvasElement }) =>
		expectCardLayout(canvasElement, {
			checkTruncation: true,
			selected: true
		})
};

/**
 * The same cards at 390 px, resting instead of selected. Below 900 px the
 * menu pill moves 6 px further out (`__rowRight` pads 4 px instead of 10),
 * and Mail follows it.
 */
export const CardLayoutOnThePhone: Story = {
	name: 'Karte — 390 px, Mail folgt dem Knopf',
	globals: { viewport: { value: 'phone390' } },
	// Another route, so these cards rest (1 px border) where the desktop
	// story's are selected (2 px) — the height must not care.
	parameters: {
		router: {
			initialPath: '/sessions/consultant/sessionView'
		}
	},
	render: () => {
		seedCardPreviews();
		return <CardGallery />;
	},
	play: async ({ canvasElement }) =>
		expectCardLayout(canvasElement, {
			checkTruncation: false,
			selected: false
		})
};

/** FE#1115: the advice seeker's unaccepted row holds the bare magnet, and nothing clips its beam. */
export const AskerSearchingRow: Story = {
	name: 'Ratsuchende wartet — Magnet im Avatar-Platz (FE#1115)',
	render: () => {
		seedMatrixRoom(0);
		return <RuntimeSessionListItem asSearchingAsker />;
	},
	play: async ({ canvasElement }) => {
		const magnet = await waitFor(() => {
			const element = canvasElement.querySelector<HTMLElement>(
				'.consultantSearchLoader'
			);
			expect(element).toBeTruthy();
			return element!;
		});
		// It stands in the 48 px avatar slot at the naked size, 40 px.
		settleCardEntrance(canvasElement);
		const box = magnet.getBoundingClientRect();
		await expect(Math.round(box.width)).toBe(40);
		const slot = canvasElement
			.querySelector<HTMLElement>('.sessionsListItem__icon')!
			.getBoundingClientRect();
		await expect(Math.round(slot.width)).toBe(48);
		// Nothing is painted behind the magnet.
		await expect(getComputedStyle(magnet).backgroundColor).toBe(
			'rgba(0, 0, 0, 0)'
		);

		// The beam points right into the card, so its corner clip never reaches it.
		// Measured at the end of the flight.
		const card = canvasElement.querySelector<HTMLElement>(
			'.sessionsListItem__content'
		)!;
		await expect(
			card.classList.contains('consultantSearchLoaderHost')
		).toBe(true);
		const sweep = magnet.querySelector<HTMLElement>(
			'.consultantSearchLoader__sweep'
		)!;
		const beam = magnet.querySelector<HTMLElement>(
			'.consultantSearchLoader__beam'
		)!;
		await expect(beam).toBeTruthy();
		magnet.classList.add('consultantSearchLoader--pulsing');
		sweep.getAnimations().forEach((animation) => animation.pause());
		const flight = Number(
			beam.getAnimations()[0]!.effect!.getTiming().duration
		);
		beam.getAnimations().forEach((animation) => {
			animation.pause();
			animation.currentTime = flight;
		});
		const beamBox = beam.getBoundingClientRect();
		const cardBox = card.getBoundingClientRect();
		await expect(beamBox.right).toBeGreaterThan(box.right);
		await expect(beamBox.right).toBeLessThan(cardBox.right);
		await expect(beamBox.top).toBeGreaterThan(cardBox.top);
		await expect(beamBox.bottom).toBeLessThan(cardBox.bottom);
		magnet.classList.remove('consultantSearchLoader--pulsing');
	}
};

/* ------------------------------------------------------------------ *
 * Card states — each one the real component, selected by route and data
 * ------------------------------------------------------------------ */

const PRIMARY = 'rgb(165, 0, 10)';
const PRIMARY_CONTAINER = 'rgb(204, 30, 28)';
const WHITE = 'rgb(255, 255, 255)';

/** Waits for the row to render and ends its entrance, so colours are read settled. */
const settledRows = async (canvasElement: HTMLElement, count = 1) => {
	const rows = await waitFor(() => {
		const found = Array.from(
			canvasElement.querySelectorAll<HTMLElement>('.sessionsListItem')
		);
		expect(found).toHaveLength(count);
		return found;
	});
	settleCardEntrance(canvasElement);
	return rows;
};

const part = (row: HTMLElement, selector: string) => {
	const element = row.querySelector<HTMLElement>(selector);
	expect(element, selector).not.toBeNull();
	return element!;
};

/** Group rows: the "no topic" chip, two placeholder avatars and a "+1" circle. */
const expectGroupRow = async (row: HTMLElement, name: string) => {
	await expect(row.classList.contains('sessionsListItem--groupChat')).toBe(
		true
	);
	await expect(part(row, '.sessionsListItem__topic').textContent).toBe(
		'kein Thema gewählt'
	);
	const stack = part(row, '.sessionsListItem__stackedAvatars');
	await expect(
		stack.querySelectorAll(
			'.sessionsListItem__avatarWrapper:not(.sessionsListItem__avatarWrapper--plus)'
		)
	).toHaveLength(2);
	await expect(part(stack, '.sessionsListItem__plusAvatar').textContent).toBe(
		'+1'
	);
	await expect(part(row, '.sessionsListItem__username').textContent).toBe(
		name
	);
};

/** Resting consultant card: topic and postcode as one pill, Mail, alias preview in italics. */
export const ConsultantUnselected: Story = {
	name: 'Beratung — nicht ausgewählt',
	parameters: {
		router: { initialPath: '/sessions/consultant/sessionView' }
	},
	render: () => {
		seedMatrixRoom(2);
		return (
			<RuntimeSessionListItem
				sessionOverrides={{ lastMessageType: 'FURTHER_STEPS' }}
			/>
		);
	},
	play: async ({ canvasElement }) => {
		const [row] = await settledRows(canvasElement);
		await expect(row.classList.contains('sessionsListItem--active')).toBe(
			false
		);
		const card = part(row, '.sessionsListItem__content');
		await expect(getComputedStyle(card).borderTopWidth).toBe('1px');
		const group = part(row, '.sessionsListItem__topicPostcodeGroup');
		await expect(part(group, '.sessionsListItem__topic').textContent).toBe(
			'Familienberatung'
		);
		await expect(
			part(group, '.sessionsListItem__postcode').textContent
		).toBe('12345');
		await expect(
			part(row, '.sessionsListItem__consultingTypeIcon--nearbyLabel')
				.textContent
		).toBe('Mail');
		const subject = part(row, '.sessionsListItem__subject');
		await expect(
			subject.classList.contains(
				'sessionsListItem__subject--aliasMessage'
			)
		).toBe(true);
		await expect(subject.textContent).toBe('So geht es weiter');
		await expect(getComputedStyle(subject).fontStyle).toBe('italic');
	}
};

/** #597: the selected card carries a 2 px primary ring; its chips turn primary-container. */
export const ConsultantSelected: Story = {
	name: 'Beratung — ausgewählt (#597)',
	render: () => {
		seedMatrixRoom(2);
		return <RuntimeSessionListItem />;
	},
	play: async ({ canvasElement }) => {
		const [row] = await settledRows(canvasElement);
		await expect(row.classList.contains('sessionsListItem--active')).toBe(
			true
		);
		const card = getComputedStyle(part(row, '.sessionsListItem__content'));
		await waitFor(() => expect(card.borderTopColor).toBe(PRIMARY));
		await expect(card.borderTopWidth).toBe('2px');
		const topic = getComputedStyle(part(row, '.sessionsListItem__topic'));
		await expect(topic.backgroundColor).toBe(PRIMARY_CONTAINER);
		await expect(topic.color).toBe(WHITE);
		const postcode = getComputedStyle(
			part(row, '.sessionsListItem__postcode')
		);
		await expect(postcode.borderTopColor).toBe(PRIMARY_CONTAINER);
		await expect(postcode.color).toBe(PRIMARY_CONTAINER);
		await expect(
			getComputedStyle(
				part(row, '.sessionsListItem__consultingTypeIcon--nearbyLabel')
			).color
		).toBe(PRIMARY);
	}
};

/** #597: the open menu takes the ring; the selected card keeps its 2 px as a white border. */
export const ConsultantMenuOpen: Story = {
	name: 'Beratung — Menü offen (#597)',
	render: () => {
		seedMatrixRoom(2);
		return <RuntimeSessionListItem />;
	},
	play: async ({ canvasElement }) => {
		const { trigger, menu } = await openTheMenu(canvasElement);
		const row =
			canvasElement.querySelector<HTMLElement>('.sessionsListItem')!;
		await expect(row.classList.contains('sessionsListItem--menuOpen')).toBe(
			true
		);
		await expect(trigger.getAttribute('aria-expanded')).toBe('true');
		await expect(menu.getAttribute('role')).toBe('dialog');
		await expectOnlyTheMenuRinged(canvasElement);
		await expect(
			getComputedStyle(part(row, '.sessionsListItem__topic'))
				.backgroundColor
		).toBe(PRIMARY_CONTAINER);
		// The 32 × 48 pill, wider than tall.
		const pill = trigger.getBoundingClientRect();
		await expect(Math.round(pill.width)).toBe(48);
		await expect(Math.round(pill.height)).toBe(32);
	}
};

/** The selected card between two group rows, which learn they sit before and after it. */
export const StackedListWithSelection: Story = {
	name: 'Liste — Auswahl zwischen zwei Gruppen',
	render: () => {
		seedMatrixRoom(2);
		return (
			<div style={listShell}>
				<RuntimeCard
					index={0}
					isBeforeActive
					item={runtimeGroupChat({ id: 5501, name: 'New Redeploy' })}
				/>
				<RuntimeCard index={1} item={runtimeSessionItem()} />
				<RuntimeCard
					index={2}
					isAfterActive
					item={runtimeGroupChat({ id: 5502, name: 'Teamrunde' })}
				/>
			</div>
		);
	},
	play: async ({ canvasElement }) => {
		const [before, selected, after] = await settledRows(canvasElement, 3);
		await expect(
			[before, selected, after].map((row) =>
				row.classList.contains('sessionsListItem--active')
			)
		).toEqual([false, true, false]);
		await expect(
			before.classList.contains('sessionsListItem--beforeActive')
		).toBe(true);
		await expect(
			after.classList.contains('sessionsListItem--afterActive')
		).toBe(true);
		// No extra gap: the 24 px card spacing holds on both sides of the selection.
		const box = (row: HTMLElement) =>
			part(row, '.sessionsListItem__content').getBoundingClientRect();
		await expect(Math.round(box(selected).top - box(before).bottom)).toBe(
			24
		);
		await expect(Math.round(box(after).top - box(selected).bottom)).toBe(
			24
		);
	}
};

/** A group chat the backend types as neither Interna nor Gesprächskreis falls back to the team icon. */
export const GroupChatRow: Story = {
	name: 'Gruppe — ohne Gruppen-Typ (Team-Symbol)',
	render: () => {
		seedMatrixRoom(2);
		return (
			<div style={listShell}>
				<RuntimeCard
					item={runtimeGroupChat({
						id: 5501,
						name: 'New Redeploy',
						conversationType: 'AGENCY_COUNSELLING'
					})}
				/>
			</div>
		);
	},
	play: async ({ canvasElement }) => {
		const [row] = await settledRows(canvasElement);
		await expectGroupRow(row, 'New Redeploy');
		// Own chat without a message yet.
		await expect(part(row, '.sessionsListItem__subject').textContent).toBe(
			'Sie haben den Chat erstellt.'
		);
		await expect(
			part(row, '.sessionsListItem__consultingTypeIcon--team')
		).toBeTruthy();
		await expect(
			row.querySelector('.sessionsListItem__menuIcon')
		).not.toBeNull();
	}
};

/** No topic chosen: the postcode stands alone as a full pill. */
export const PostcodeOnly: Story = {
	name: 'Beratung — nur Postleitzahl',
	parameters: {
		router: { initialPath: '/sessions/consultant/sessionView' }
	},
	render: () => {
		seedMatrixRoom(2);
		return (
			<RuntimeSessionListItem
				sessionOverrides={{ topic: undefined, postcode: 99322 }}
			/>
		);
	},
	play: async ({ canvasElement }) => {
		const [row] = await settledRows(canvasElement);
		await expect(row.querySelector('.sessionsListItem__topic')).toBeNull();
		const postcode = part(row, '.sessionsListItem__postcode--standalone');
		await expect(postcode.textContent).toBe('99322');
		await expect(getComputedStyle(postcode).borderLeftWidth).toBe('1px');
		await expect(
			part(row, '.sessionsListItem__consultingTypeIcon--nearbyLabel')
				.textContent
		).toBe('Mail');
	}
};

/** 390 px: a long topic truncates, the menu closes on Escape and Tab, Enter opens the chat. */
export const InteractiveMenuAndLongContent: Story = {
	name: 'Beratung — 390 px, langes Thema, Menü per Tastatur',
	globals: { viewport: { value: 'phone390' } },
	parameters: {
		router: { initialPath: '/sessions/consultant/sessionView' }
	},
	render: () => {
		seedMatrixRoom(2);
		return (
			<div style={listShell}>
				<RuntimeCard
					index={0}
					item={runtimeSessionItem({
						lastMessage: 'Anfrage gesendet',
						sessionOverrides: { topic: longTopic }
					})}
				/>
				<RuntimeCard
					index={1}
					item={runtimeSessionItem({
						lastMessage: 'Hubi, schau dir das mal an!',
						sessionOverrides: {
							id: 4402,
							matrixRoomId: 'storybook-runtime-room-4402',
							topic: addictionTopic,
							postcode: 99322
						},
						userOverrides: {
							username: 'ludwig-bonn@example.invalid',
							displayName: 'Ludwig Bonn'
						}
					})}
				/>
			</div>
		);
	},
	play: async ({ canvasElement }) => {
		const [first, second] = await settledRows(canvasElement, 2);

		// The long topic is cut with an ellipsis instead of pushing the menu out.
		const topic = part(first, '.sessionsListItem__topic');
		await expect(topic.textContent).toBe(longTopic.name);
		await expect(getComputedStyle(topic).textOverflow).toBe('ellipsis');
		await expect(topic.scrollWidth).toBeGreaterThan(topic.clientWidth);
		const card = part(first, '.sessionsListItem__content');
		await expect(
			part(first, '.sessionsListItem__menuIcon').getBoundingClientRect()
				.right
		).toBeLessThanOrEqual(card.getBoundingClientRect().right);

		// Escape closes the menu and gives the keyboard back to the trigger.
		const { trigger } = await openTheMenu(canvasElement);
		await userEvent.keyboard('{Escape}');
		await waitFor(() => {
			expect(
				document.querySelector('.sessionsListItem__dropdown')
			).toBeNull();
			expect(document.activeElement).toBe(trigger);
		});

		// So does Tab from inside the menu.
		await openTheMenu(canvasElement);
		await waitFor(() =>
			expect(
				document
					.querySelector('.sessionsListItem__dropdown')
					?.contains(document.activeElement)
			).toBe(true)
		);
		await userEvent.keyboard('{Tab}');
		await waitFor(() => {
			expect(
				document.querySelector('.sessionsListItem__dropdown')
			).toBeNull();
			expect(document.activeElement).toBe(trigger);
		});

		// Enter on the card opens that chat, which selects it and only it.
		card.focus();
		await userEvent.keyboard('{Enter}');
		await waitFor(() =>
			expect(first.classList.contains('sessionsListItem--active')).toBe(
				true
			)
		);
		await expect(
			second.classList.contains('sessionsListItem--active')
		).toBe(false);
	}
};

/** Internal counsellor group (Figma 98-20465): stacked avatars and the Interna mark. */
export const InternalCounsellorChat: Story = {
	name: 'Gruppe — Interna (Figma 98-20465)',
	render: () => {
		seedMatrixRoom(2);
		return (
			<div style={listShell}>
				<RuntimeCard
					item={runtimeGroupChat({
						id: 5503,
						name: 'Anfragenkoordinierung',
						lastMessage: 'Das ist schon komisch mit dieser Anfrage.'
					})}
				/>
			</div>
		);
	},
	play: async ({ canvasElement }) => {
		const [row] = await settledRows(canvasElement);
		await expectGroupRow(row, 'Anfragenkoordinierung');
		await expect(part(row, '.sessionsListItem__subject').textContent).toBe(
			'Das ist schon komisch mit dieser Anfrage.'
		);
		await expect(
			part(row, '.sessionsListItem__consultingTypeIcon--internalLabel')
				.textContent
		).toBe('Interna');
		await expect(
			part(
				row,
				'.sessionsListItem__consultingTypeIcon--internalIcon'
			).getAttribute('alt')
		).toBe('Interna');
	}
};

// ZipTopicSelection (Mail, Figma 98-20505) has no story of its own: topic,
// postcode and Mail are `ConsultantUnselected`.

/** Anonymous live chat (Figma 287-23471): animal name, no postcode, the Live Chat mark. */
export const LiveChat: Story = {
	name: 'Live-Chat — anonym (Figma 287-23471)',
	parameters: {
		router: { initialPath: '/sessions/consultant/sessionView' }
	},
	render: () => {
		seedMatrixRoom(2);
		return (
			<RuntimeSessionListItem
				lastMessage="Das soll aber einzigartig"
				sessionOverrides={{ registrationType: 'ANONYMOUS' as any }}
			/>
		);
	},
	play: async ({ canvasElement }) => {
		const [row] = await settledRows(canvasElement);
		await expect(
			row.classList.contains('sessionsListItem--anonymous')
		).toBe(true);
		await expect(
			part(row, '.sessionsListItem__content').classList.contains(
				'sessionsListItem__content--anonymous'
			)
		).toBe(true);
		await expect(part(row, '.sessionsListItem__topic').textContent).toBe(
			'Familienberatung'
		);
		await expect(
			row.querySelector('.sessionsListItem__postcode')
		).toBeNull();
		await expect(part(row, '.sessionsListItem__username').textContent).toBe(
			'ruhiges Yak Kim'
		);
		const mark = part(
			row,
			'.sessionsListItem__consultingTypeIcon--liveChat'
		);
		await expect(mark.querySelector('svg')).not.toBeNull();
		await expect(
			part(mark, '.sessionsListItem__consultingTypeIcon--liveChatLabel')
				.textContent
		).toBe('Live Chat');
	}
};

/** Guided self-help group (Figma 115-28318): a recurring group reads as Gesprächskreis. */
export const GuidedSelfHelpGroup: Story = {
	name: 'Gruppe — Gesprächskreis (Figma 115-28318)',
	render: () => {
		seedMatrixRoom(2);
		return (
			<div style={listShell}>
				<RuntimeCard
					item={runtimeGroupChat({
						id: 5504,
						name: 'Montagsrunde',
						repetitive: true,
						lastMessage: 'Das soll aber einzigartig'
					})}
				/>
			</div>
		);
	},
	play: async ({ canvasElement }) => {
		const [row] = await settledRows(canvasElement);
		await expectGroupRow(row, 'Montagsrunde');
		await expect(
			part(row, '.sessionsListItem__consultingTypeIcon--selfHelpLabel')
				.textContent
		).toBe('Gesprächskreis');
		await expect(
			part(
				row,
				'.sessionsListItem__consultingTypeIcon--selfHelpIcon'
			).getAttribute('alt')
		).toBe('Gesprächskreis');
	}
};

/* ------------------------------------------------------------------ *
 * Tenant colour
 * ------------------------------------------------------------------ */

/**
 * Every token of a light blue tenant, as `applyTenantPalette` sets them. Its
 * on-primary is dark, so a hard-coded white chip text cannot pass.
 */
const TENANT_TOKENS = computeOrisoPalette(
	{ primary: '#2e9bff' },
	'light'
).tokens;

const rgb = (hex: string) => {
	const value = parseInt(hex.slice(1), 16);
	return `rgb(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255})`;
};

/** Selected card, topic chip and Mail mark follow the tenant's palette instead of the default red. */
export const TenantPrimaryColour: Story = {
	name: 'Träger-Farbe — Auswahl, Themen-Chip und Mail folgen ihr',
	render: () => {
		seedMatrixRoom(2);
		return (
			<div style={TENANT_TOKENS as React.CSSProperties}>
				<div style={listShell}>
					<RuntimeCard index={0} item={runtimeSessionItem()} />
					<RuntimeCard
						index={1}
						item={runtimeSessionItem({
							sessionOverrides: {
								id: 4402,
								matrixRoomId: 'storybook-runtime-room-4402'
							}
						})}
					/>
				</div>
			</div>
		);
	},
	play: async ({ canvasElement }) => {
		const [selected, resting] = await settledRows(canvasElement, 2);
		await expect(
			selected.classList.contains('sessionsListItem--active')
		).toBe(true);
		const style = (row: HTMLElement, selector: string) =>
			getComputedStyle(part(row, selector));
		const tenant = (token: string) => rgb(TENANT_TOKENS[token]);

		// The palette really is another colour, so the checks below can fail.
		await expect(tenant('--m3-primary')).not.toBe(PRIMARY);

		await waitFor(() =>
			expect(
				style(selected, '.sessionsListItem__content').borderTopColor
			).toBe(tenant('--m3-primary'))
		);

		const selectedChip = style(selected, '.sessionsListItem__topic');
		await expect(selectedChip.backgroundColor).toBe(
			tenant('--m3-primary-container')
		);
		await expect(selectedChip.color).toBe(tenant('--m3-on-primary'));
		const restingChip = style(resting, '.sessionsListItem__topic');
		await expect(restingChip.backgroundColor).toBe(
			tenant('--m3-primary-fixed-dim')
		);
		await expect(restingChip.color).toBe(tenant('--m3-on-primary-fixed'));
		const restingPostcode = style(resting, '.sessionsListItem__postcode');
		await expect(restingPostcode.borderTopColor).toBe(
			tenant('--m3-primary-fixed-dim')
		);
		await expect(restingPostcode.color).toBe(
			tenant('--m3-primary-container')
		);

		for (const row of [selected, resting]) {
			await expect(
				style(row, '.sessionsListItem__consultingTypeIcon--nearbyLabel')
					.color
			).toBe(tenant('--m3-primary'));
			await expect(
				style(row, '.sessionsListItem__consultingTypeIcon--nearbyIcon')
					.backgroundColor
			).toBe(tenant('--m3-primary'));
		}
	}
};
