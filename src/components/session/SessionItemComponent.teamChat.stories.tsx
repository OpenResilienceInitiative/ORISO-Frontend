/**
 * FE#2491 — the team chat of an open enquiry, switched on and off per
 * enquiry like supervision: "Weitere Funktionen" carries the switch, the
 * case header the "Team-Chat" chip while it is on, the side panel the
 * read-only history after it was switched off.
 *
 * Source-bound real composition (SessionStream → SessionItemComponent →
 * SessionHeader → SessionMenu → SidePanel) with synthetic HTTP for
 * `/sessions/4711/team-discussion` (GET / POST / DELETE) and `/join` (UserService#1778)
 * and the Matrix SDK. Not a deployed proof: the endpoints are not on Dev yet.
 */
import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { MatrixEvent, SyncState } from 'matrix-js-sdk';
import { SessionStream } from './SessionStream';
import { SESSION_LIST_TYPES } from './sessionHelpers';
import {
	ActiveSessionContext,
	UserDataContext,
	SessionTypeContext,
	buildExtendedSession,
	ModalProvider
} from '../../globalState';
import { MatrixClientContext } from '../../globalState/context/MatrixClientContext';
import { setMatrixClientServiceRef } from '../../services/matrixClientRegistry';
import { invalidateTeamDiscussionCache } from '../../services/teamDiscussionCache';
import { ChatStageProviders } from '../chatStage/__storybook__/ChatStageProviders';
import {
	stageSession,
	counsellorUserData
} from '../chatStage/__storybook__/chatStageFixtures';
import { canonicalAgencySettings } from '../../test/fixtures/conversationPolicyFixtures';
import type { ListItemInterface } from '../../globalState/interfaces';
import type { AgencyConversationPolicy } from '../../globalState/interfaces/ConversationFeatureSettings';

const SESSION_ID = 4711;
const ROOM = '!enquiry-team-chat:storybook.invalid';
const TEAM_ROOM = '!enquiry-team-chat-team:storybook.invalid';
const PREVIEW = `/sessions/consultant/sessionPreview/${ROOM}/${SESSION_ID}`;

type Scenario =
	| 'off'
	| 'on'
	| 'closed'
	| 'agencyOff'
	| 'acceptedArchived'
	| 'acceptedOn';
const isAccepted = (scenario: Scenario) =>
	scenario === 'acceptedArchived' || scenario === 'acceptedOn';
const CASE = `/sessions/consultant/sessionView/${ROOM}/${SESSION_ID}`;

const session = (status = 1) => {
	const original = stageSession();
	return buildExtendedSession({
		user: original.user,
		session: {
			...original.item,
			id: SESSION_ID,
			status,
			matrixRoomId: ROOM,
			conversationType: 'AGENCY_COUNSELLING',
			registrationType: 'REGISTERED',
			agencyId: 1,
			askerMatrixUserId: '@asker:storybook.invalid'
		}
	} as ListItemInterface);
};

const message = (
	id: string,
	roomId: string,
	sender: string,
	body: string,
	minutesAgo: number
) =>
	new MatrixEvent({
		event_id: id,
		room_id: roomId,
		sender,
		type: 'm.room.message',
		origin_server_ts: Date.now() - minutesAgo * 60_000,
		content: { msgtype: 'm.text', body }
	});

const roomOf = (roomId: string, events: MatrixEvent[]) => ({
	roomId,
	timeline: events,
	getMyMembership: () => 'join',
	getMembers: () => [],
	getJoinedMembers: () => [],
	getMember: () => null,
	getLiveTimeline: () => ({ getEvents: () => events }),
	currentState: { getStateEvents: () => null, maySendEvent: () => true },
	getUnreadNotificationCount: () => 0
});

const mainRoom = roomOf(ROOM, [
	message(
		'$original',
		ROOM,
		'@asker:storybook.invalid',
		'Ich mache mir Sorgen um meine Mutter und weiß nicht, an wen ich mich wenden kann.',
		30
	)
]);
const teamRoom = roomOf(TEAM_ROOM, [
	message(
		'$team-1',
		TEAM_ROOM,
		'@colleague:storybook.invalid',
		'Ich kenne die Einrichtung in der Nähe – soll ich übernehmen?',
		12
	)
]);
const rooms = [mainRoom, teamRoom];
const client = {
	getRoom: (id: string) => rooms.find(({ roomId }) => roomId === id) ?? null,
	getRooms: () => rooms,
	getUserId: () => '@consultant:storybook.invalid',
	getSyncState: () => SyncState.Prepared,
	getAccountData: () => null,
	setAccountData: async () => {},
	on: () => {},
	off: () => {},
	addListener: () => {},
	removeListener: () => {}
};
const matrix = {
	getClient: () => client,
	getRoom: client.getRoom,
	getRoomMessages: (id: string) => client.getRoom(id)?.timeline ?? [],
	onClientChange: () => () => {},
	sendTyping: async () => {}
} as any;

const initialStatus: Record<Scenario, 'NONE' | 'OPEN' | 'CLOSED' | 'ARCHIVED'> =
	{
		acceptedArchived: 'ARCHIVED',
		acceptedOn: 'OPEN',
		off: 'NONE',
		on: 'OPEN',
		closed: 'CLOSED',
		agencyOff: 'OPEN'
	};

function EnquiryTeamChatStory({ scenario }: { scenario: Scenario }) {
	const [activeSession] = React.useState(() =>
		session(isAccepted(scenario) ? 2 : 1)
	);
	const [calls, setCalls] = React.useState<string[]>([]);
	React.useLayoutEffect(() => {
		const previous = window.fetch;
		let status = initialStatus[scenario];
		invalidateTeamDiscussionCache(SESSION_ID);
		setMatrixClientServiceRef(matrix);
		const json = (body: unknown) =>
			new Response(JSON.stringify(body), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			});
		window.fetch = async (input, init) => {
			const url =
				typeof input === 'string'
					? input
					: input instanceof URL
						? input.href
						: input.url;
			const method =
				init?.method ??
				(input instanceof Request ? input.method : 'GET');
			if (/\/sessions\/4711\/team-discussion/.test(url)) {
				// The read-only join (US#1778) never creates or reopens.
				const isJoin = /\/team-discussion\/join/.test(url);
				setCalls((list) => [...list, isJoin ? 'JOIN' : method]);
				if (scenario === 'agencyOff') {
					return new Response(null, { status: 403 });
				}
				if (method === 'POST' && !isJoin) status = 'OPEN';
				if (method === 'DELETE') {
					status = 'CLOSED';
					return new Response(null, { status: 204 });
				}
				return status === 'NONE'
					? new Response(null, { status: 204 })
					: json({ matrixRoomId: TEAM_ROOM, status });
			}
			if (/\/sessions\/room\/4711/.test(url))
				return json({
					sessions: [
						{
							user: activeSession.user,
							session: activeSession.item
						}
					]
				});
			if (/\/supervisors$/.test(url) || /\/consultants(?:\?|$)/.test(url))
				return json([]);
			if (/\/matrix\/sync\/register\/4711$/.test(url))
				return new Response(null, { status: 204 });
			return previous(input, init);
		};
		return () => {
			window.fetch = previous;
			setMatrixClientServiceRef(null);
			invalidateTeamDiscussionCache(SESSION_ID);
		};
	}, [activeSession, scenario]);
	// The Beratungsstelle's answer, as `useSessionAgencyPolicy` hands it to
	// the open conversation (AgencyService#389 serves the team-chat policy).
	const agencyFeaturePolicy: AgencyConversationPolicy = {
		agencyId: 1,
		state: 'ready',
		settings: canonicalAgencySettings({
			featureTeamDiscussionEnabled: scenario !== 'agencyOff',
			// "Team-Chat nach Annahme": off by default (ADR-016 archive).
			featureTeamDiscussionAfterAcceptEnabled: scenario === 'acceptedOn'
		})
	};
	const user = { ...counsellorUserData, agencies: [{ id: 1 }] };
	return (
		<ModalProvider>
			<ChatStageProviders activeSession={activeSession}>
				<UserDataContext.Provider
					value={{
						userData: user as any,
						setUserData: () => {},
						reloadUserData: async () => user as any
					}}
				>
					<SessionTypeContext.Provider
						value={{
							type: isAccepted(scenario)
								? SESSION_LIST_TYPES.MY_SESSION
								: SESSION_LIST_TYPES.ENQUIRY,
							path: isAccepted(scenario)
								? '/sessions/consultant/sessionView'
								: '/sessions/consultant/sessionPreview'
						}}
					>
						<ActiveSessionContext.Provider
							value={
								{
									activeSession,
									agencyFeaturePolicy,
									reloadActiveSession: () => {},
									readActiveSession: () => {}
								} as any
							}
						>
							<MatrixClientContext.Provider
								value={{
									matrixClientService: matrix,
									setMatrixClientService: () => {}
								}}
							>
								<main
									style={{
										height: 'calc(100vh - 40px)',
										minHeight: 480,
										display: 'flex',
										flexDirection: 'column',
										padding: 12
									}}
								>
									<SessionStream
										readonly={false}
										bannedUsers={[]}
										checkMutedUserForThisSession={() => {}}
									/>
									<output hidden data-testid="team-calls">
										{calls.join(',')}
									</output>
								</main>
							</MatrixClientContext.Provider>
						</ActiveSessionContext.Provider>
					</SessionTypeContext.Provider>
				</UserDataContext.Provider>
				<div id="overlay" />
			</ChatStageProviders>
		</ModalProvider>
	);
}

const meta = {
	title: 'Organisms/Session/EnquiryTeamChat',
	component: EnquiryTeamChatStory,
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'FE#2491: the team chat of an open enquiry is switched on and off per enquiry, with the same UI logic as supervision — "Weitere Funktionen" → Team-Chat einschalten / ausschalten (with a confirmation), the "Team-Chat" chip in the case header while it is on (outlined while its panel is open), and a read-only history with a notice and "Team-Chat wieder einschalten" after it was switched off. ' +
					'Whether it is offered at all is the effective platform → Träger → Beratungsstelle policy (`featureTeamDiscussionEnabled`), read like supervision. ' +
					'Actual SessionStream, header, menu and side panel; synthetic GET/POST/DELETE and Matrix SDK only.'
			}
		}
	}
} satisfies Meta<typeof EnquiryTeamChatStory>;
export default meta;
type Story = StoryObj<typeof meta>;

const body = (canvasElement: HTMLElement) =>
	within(canvasElement.ownerDocument.body);
const byCy = (root: ParentNode, cy: string) =>
	root.querySelector<HTMLElement>(`[data-cy="${cy}"]`);
const openMoreMenu = async (canvasElement: HTMLElement) => {
	const [trigger] = await within(canvasElement).findAllByRole('button', {
		name: /Weitere Funktionen|More functions/
	});
	await userEvent.click(trigger);
};

/** No team chat yet: "Weitere Funktionen" offers to switch it on. */
export const Off: Story = {
	name: 'Off — switch on from "Weitere Funktionen"',
	args: { scenario: 'off' },
	parameters: { router: { initialPath: PREVIEW } },
	play: async ({ canvasElement }) => {
		await openMoreMenu(canvasElement);
		const on = await waitFor(() => {
			const node = byCy(
				canvasElement.ownerDocument,
				'session-menu-team-chat-on'
			);
			expect(node).not.toBeNull();
			return node!;
		});
		await expect(on).toHaveTextContent(
			/Team-Chat einschalten|Switch on team chat/
		);
		await expect(
			byCy(canvasElement, 'session-header-team-chat')
		).toBeNull();
	}
};

/** On: the chip in the case header, active while the panel is open. */
export const On: Story = {
	name: 'On — chip in the header, panel open',
	args: { scenario: 'on' },
	parameters: { router: { initialPath: `${PREVIEW}?channel=team` } },
	play: async ({ canvasElement }) => {
		const chip = await waitFor(
			() => {
				const node = byCy(canvasElement, 'session-header-team-chat');
				expect(node).not.toBeNull();
				expect(node).toHaveAttribute('aria-pressed', 'true');
				return node!;
			},
			{ timeout: 8000 }
		);
		await expect(chip).toHaveTextContent('Team-Chat');
		await expect(canvasElement.querySelector('.sidePanel')).not.toBeNull();
	}
};

/** On → "Weitere Funktionen" → Team-Chat ausschalten → confirmation. */
export const SwitchOffConfirmation: Story = {
	name: 'On — switching off asks first',
	args: { scenario: 'on' },
	parameters: { router: { initialPath: `${PREVIEW}?channel=team` } },
	play: async ({ canvasElement }) => {
		await waitFor(
			() =>
				expect(
					byCy(canvasElement, 'session-header-team-chat')
				).not.toBeNull(),
			{ timeout: 8000 }
		);
		await openMoreMenu(canvasElement);
		const off = await waitFor(() => {
			const node = byCy(
				canvasElement.ownerDocument,
				'session-menu-team-chat-off'
			);
			expect(node).not.toBeNull();
			return node!;
		});
		await userEvent.click(off);
		const headline = await body(canvasElement).findByText(
			/Team-Chat ausschalten\?|Switch off team chat\?/
		);
		// The shared Overlay fades in.
		await waitFor(() => expect(headline).toBeVisible(), { timeout: 3000 });
		// Asking is not switching: nothing was sent yet.
		await expect(
			within(canvasElement).getByTestId('team-calls').textContent
		).not.toContain('DELETE');
	}
};

/** Switched off: read-only history, notice, and the switch back on. */
export const Closed: Story = {
	name: 'Switched off — read-only history with switch-on',
	args: { scenario: 'closed' },
	parameters: { router: { initialPath: `${PREVIEW}?channel=team` } },
	play: async ({ canvasElement }) => {
		const banner = await waitFor(
			() => {
				const node = byCy(canvasElement, 'team-chat-closed-banner');
				expect(node).not.toBeNull();
				return node!;
			},
			{ timeout: 8000 }
		);
		await expect(banner).toHaveTextContent(
			/Team-Chat ausgeschaltet|Team chat switched off/
		);
		await expect(
			byCy(canvasElement, 'session-header-team-chat')
		).toBeNull();
		await expect(
			byCy(canvasElement, 'team-chat-switch-on-again')
		).not.toBeNull();
		// Looking at a switched-off team chat reads it through the read-only
		// join and never POSTs (POST reopens it).
		const calls =
			within(canvasElement).getByTestId('team-calls').textContent;
		await expect(calls).toContain('JOIN');
		await expect(calls).not.toContain('POST');
	}
};

/** The Beratungsstelle has the team chat off: nothing is offered. */
export const OffForBeratungsstelle: Story = {
	name: 'Off for the Beratungsstelle — no entry anywhere',
	args: { scenario: 'agencyOff' },
	parameters: { router: { initialPath: PREVIEW } },
	play: async ({ canvasElement }) => {
		await waitFor(() =>
			expect(canvasElement.textContent).toContain(
				'Ich mache mir Sorgen um meine Mutter'
			)
		);
		await expect(byCy(canvasElement, 'enquiry-open-team')).toBeNull();
		await expect(
			byCy(canvasElement, 'session-header-team-chat')
		).toBeNull();
		await expect(
			byCy(canvasElement.ownerDocument, 'session-menu-team-chat-on')
		).toBeNull();
		// The gate is decided before any request.
		await expect(
			within(canvasElement).getByTestId('team-calls').textContent
		).toBe('');
	}
};

/**
 * Accepted case, "Team-Chat nach Annahme" off (default): "Weitere
 * Funktionen" → Team-Chat öffnen shows the archived history read-only. No
 * chip, no switch, nobody can write (ADR-016).
 */
export const AcceptedArchivedReadOnly: Story = {
	name: 'Accepted, setting off — archived, read-only via the menu',
	args: { scenario: 'acceptedArchived' },
	parameters: { router: { initialPath: CASE } },
	play: async ({ canvasElement }) => {
		await waitFor(
			() =>
				expect(
					within(canvasElement).getByTestId('team-calls').textContent
				).toContain('GET'),
			{ timeout: 8000 }
		);
		await openMoreMenu(canvasElement);
		const open = await waitFor(() => {
			const node = byCy(
				canvasElement.ownerDocument,
				'session-menu-team-chat'
			);
			expect(node).not.toBeNull();
			return node!;
		});
		await expect(
			byCy(canvasElement.ownerDocument, 'session-menu-team-chat-on')
		).toBeNull();
		await expect(
			byCy(canvasElement.ownerDocument, 'session-menu-team-chat-off')
		).toBeNull();
		await userEvent.click(open);
		await waitFor(
			() =>
				expect(
					canvasElement.querySelector('.chatStage__panel .sidePanel')
				).not.toBeNull(),
			{ timeout: 8000 }
		);
		await expect(
			canvasElement.querySelector(
				'.chatStage__panel .textarea__wrapper-send-message'
			)
		).toBeNull();
		await expect(
			byCy(canvasElement, 'session-header-team-chat')
		).toBeNull();
	}
};

/**
 * Accepted case, "Team-Chat nach Annahme" on: exactly as in the enquiry —
 * chip in the header, writable team chat, switch off in the menu.
 */
export const AcceptedOn: Story = {
	name: 'Accepted, setting on — chip, writable, switchable',
	args: { scenario: 'acceptedOn' },
	parameters: { router: { initialPath: `${CASE}?channel=team` } },
	play: async ({ canvasElement }) => {
		await waitFor(
			() => {
				const node = byCy(canvasElement, 'session-header-team-chat');
				expect(node).not.toBeNull();
				expect(node).toHaveAttribute('aria-pressed', 'true');
			},
			{ timeout: 8000 }
		);
		await expect(
			canvasElement.querySelector(
				'.chatStage__panel .textarea__wrapper-send-message'
			)
		).not.toBeNull();
		await openMoreMenu(canvasElement);
		await waitFor(() =>
			expect(
				byCy(canvasElement.ownerDocument, 'session-menu-team-chat-off')
			).not.toBeNull()
		);
	}
};
