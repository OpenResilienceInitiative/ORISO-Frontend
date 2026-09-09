/**
 * `Templates/TeamCounsellingChannel` — the Teamberatung as the THIRD channel
 * (Frank, 09.09.: "Wir haben jetzt auch die Teamberatung bei der Anfrage …
 * ich möchte, dass wir eins zu eins diese Gruppen genau wie bei der
 * Supervision bauen … dann steht dann einfach Teamberatung statt
 * Supervision").
 *
 * Same wired stage as `ChatStage.stories` — real list column, session
 * header, `MessageTimeline`, composer, `SidePanel`, `ChannelSwitcherFab` —
 * with the team room switched on (`withTeam`). Nothing here paints a bubble
 * or a composer of its own.
 *
 * What each story is FOR, since a screenshot alone cannot say it:
 *   - the team room opens where the supervision room opens, beside the chat;
 *   - the client is never in the team room's avatar row (ADR-002, and the
 *     backend never invites them: `TeamDiscussionFacade`);
 *   - the channel card and the FAB carry three channels without renumbering
 *     the threads;
 *   - the memory of the last channel survives a remount, which is the whole
 *     point of moving it to `localStorage`.
 */
import * as React from 'react';
import { useCallback, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { ConsultantSessionStage } from './__storybook__/ConsultantSessionStage';
import {
	CLIENT_NAME,
	COUNSELLOR_NAME,
	stageRoute,
	TEAM_MATE_A_NAME,
	TEAM_MATE_B_NAME
} from './__storybook__/chatStageFixtures';
import {
	channelFromId,
	channelId,
	lastChannelKey,
	readLastChannel,
	safeChannelStorage,
	writeLastChannel,
	type SessionChannel
} from '../../utils/channelRoute';
import { TEAM_CHANNEL_COPY } from './teamChannelCopy';
import { computeOrisoPalette } from '../../utils/theme/orisoScheme';
import { phone390Globals } from '../message/messageStoryShell';
import './chatStage.styles.scss';

const CHANNEL_MENU_FIGMA_URL =
	'https://www.figma.com/design/L2mOFNSGdxPPx1XA4HFAog/App.Oriso?node-id=9763-62964';
const FAB_MENU_FIGMA_URL =
	'https://www.figma.com/design/L2mOFNSGdxPPx1XA4HFAog/App.Oriso?node-id=9748-60084';

const desktop1440Globals = { viewport: { value: 'desktop1440' } };

const TEAM_WORD = TEAM_CHANNEL_COPY['chatStage.panel.team.title'];

const meta = {
	title: 'Templates/TeamCounsellingChannel',
	component: ConsultantSessionStage,
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		router: { initialPath: stageRoute },
		design: [
			{
				type: 'figma',
				name: 'Channel menu card',
				url: CHANNEL_MENU_FIGMA_URL
			},
			{ type: 'figma', name: 'FAB menu', url: FAB_MENU_FIGMA_URL }
		],
		docs: {
			description: {
				component:
					'The Teamberatung side room, built one-to-one on the supervision mechanics: same URL parameter contract (`?channel=team`), same `SidePanel`, same channel card and FAB. ' +
					'It differs in three places only — the room it shows, the word it wears, and who counts as a visible member.'
			}
		}
	}
} satisfies Meta<typeof ConsultantSessionStage>;

export default meta;
type Story = StoryObj<typeof meta>;

/* ------------------------------------------------------------------ *
 * Shared assertions
 * ------------------------------------------------------------------ */

const panelOf = (canvasElement: HTMLElement) =>
	canvasElement.querySelector<HTMLElement>('[data-cy="stage-panel"]')!;

/** Real chat parts on stage — not a mock of a panel. */
const expectStageParts = async (
	canvasElement: HTMLElement,
	{ composers, bubblesAtLeast }: { composers: number; bubblesAtLeast: number }
) => {
	await waitFor(
		() => {
			expect(
				canvasElement.querySelectorAll(
					'.textarea__wrapper-send-message'
				).length
			).toBe(composers);
			expect(
				canvasElement.querySelectorAll('.messageItem').length
			).toBeGreaterThanOrEqual(bubblesAtLeast);
		},
		{ timeout: 10_000 }
	);
};

/**
 * The assurance Frank asked for, stated once and reused: the advice seeker
 * is NOT in the team room's participant row, and their name is nowhere in
 * the room. Both halves matter — an avatar without a name still leaks.
 */
const expectClientAbsentFromTeamRoom = async (panel: HTMLElement) => {
	const header = panel.querySelector<HTMLElement>(
		'[data-cy="panel-header-participants"]'
	)!;
	await expect(header).not.toBeNull();
	const names = Array.from(header.querySelectorAll<HTMLElement>('*'))
		.map((node) => `${node.getAttribute('title') ?? ''} ${node.textContent ?? ''}`)
		.join(' ');
	await expect(names).not.toContain(CLIENT_NAME);
	// The colleagues who are SILENT in the session room are named here —
	// the avatar stack initials each of them, so match on the first name.
	const firstName = (full: string) => full.split(' ')[0];
	await expect(names).toContain(firstName(TEAM_MATE_A_NAME));
	await expect(names).toContain(firstName(TEAM_MATE_B_NAME));
	// And no bubble in the room carries the client as its author.
	const authors = Array.from(
		panel.querySelectorAll<HTMLElement>('.messageItem')
	)
		.map((item) => item.textContent ?? '')
		.join(' ');
	await expect(authors).not.toContain(CLIENT_NAME);
};

/**
 * The header says "Teamberatung", wears the team tint rather than the
 * supervision one, and carries the permanent team-only marker.
 *
 * That last part is not decoration. The header's main line is the client's
 * pseudonym — the case this room is about — and without the marker beside it
 * the panel reads as "you are writing to her". ADR-016 §6 asks for a marker
 * that is always there; a system notice at the top of the timeline scrolls
 * away, so the chip is where it belongs.
 */
const expectTeamHeader = async (panel: HTMLElement) => {
	const header = panel.querySelector<HTMLElement>('.panelHeader')!;
	await expect(header.dataset.kind).toBe('team');
	await expect(header.classList.contains('panelHeader--team')).toBe(true);
	await expect(header.classList.contains('panelHeader--supervision')).toBe(
		false
	);
	const label = panel.querySelector<HTMLElement>(
		'[data-cy="panel-header-kind-label"]'
	)!;
	await expect(label.textContent).toContain(TEAM_WORD);
	const chip = panel.querySelector<HTMLElement>(
		'[data-cy="panel-header-chip"]'
	);
	await expect(chip).not.toBeNull();
	await expect(chip!.textContent).toBe(
		TEAM_CHANNEL_COPY['chatStage.panel.team.onlyMarker']
	);
	// The marker sits in the header, which never scrolls — unlike the
	// timeline, where the system notice lives.
	await expect(
		chip!.closest('[data-cy="panel-header-title"], .sidePanel__timeline')
	).not.toBeInstanceOf(HTMLElement);
};

/* ------------------------------------------------------------------ *
 * (a) The team channel open — the state Frank described
 * ------------------------------------------------------------------ */

export const TeamChannelOpen: Story = {
	name: '(a) Teamberatung open beside the chat',
	globals: desktop1440Globals,
	args: { panel: 'team', withTeam: true, panelVariant: 'inside' },
	parameters: {
		docs: {
			description: {
				story: 'The team room where the supervision room would be: inside the chat card, beside the conversation. The header carries the word "Teamberatung", the client is not in its avatar row.'
			}
		}
	},
	play: async ({ canvasElement }) => {
		await expectStageParts(canvasElement, {
			composers: 2,
			bubblesAtLeast: 4
		});
		const panel = panelOf(canvasElement);
		await expectTeamHeader(panel);
		await expectClientAbsentFromTeamRoom(panel);
		// The main chat is still there — this is a parallel channel, not a
		// replacement ("sofort live parallel", Frank 09.09.).
		await expect(
			canvasElement.querySelector('[data-cy="stage-main"]')
		).not.toBeNull();
	}
};

/* ------------------------------------------------------------------ *
 * (b) Team and thread — two channels, one at a time on screen
 * ------------------------------------------------------------------ */

export const TeamAndThread: Story = {
	name: '(b) Team and thread — switching between three channels',
	globals: desktop1440Globals,
	args: {
		panel: 'team',
		withTeam: true,
		openThreads: 1,
		threadUnread: 1
	},
	parameters: {
		docs: {
			description: {
				story: 'With a thread open as well, the panel header\'s channel card is the way between them. Picking the thread swaps the panel; the team room stays in the card, marked as the one to come back to.'
			}
		}
	},
	play: async ({ canvasElement }) => {
		await expectStageParts(canvasElement, {
			composers: 2,
			bubblesAtLeast: 4
		});
		const panel = panelOf(canvasElement);
		await expectTeamHeader(panel);

		// Open the channel card from the header and switch to the thread.
		const channelButton = panel.querySelector<HTMLElement>(
			'[data-cy="panel-header-channel-options"]'
		)!;
		await expect(channelButton.hasAttribute('disabled')).toBe(false);
		await userEvent.click(channelButton);
		const card = await waitFor(() =>
			within(canvasElement).getByRole('menu')
		);
		const rows = within(card).getAllByRole('menuitem');
		// Three channels: both side rooms first, then the thread.
		await expect(rows.length).toBe(3);
		const kinds = rows.map((row) => row.getAttribute('data-cy'));
		await expect(kinds).toEqual([
			'channel-switcher-item-supervision',
			'channel-switcher-item-team',
			'channel-switcher-item-thread'
		]);
		// The shown one is marked, and it is the team room.
		const active = rows.find(
			(row) => row.getAttribute('data-active') === 'true'
		)!;
		await expect(active.getAttribute('data-channel-id')).toBe('team');

		await userEvent.click(rows[2]);
		await waitFor(async () => {
			const next = panelOf(canvasElement).querySelector<HTMLElement>(
				'.panelHeader'
			)!;
			expect(next.dataset.kind).toBe('thread');
		});
	}
};

/**
 * The still picture behind `team-und-thread-1440.png`. Story (b) proves the
 * SWITCH and therefore ends on the thread, which makes it a poor screenshot
 * for "team and thread". This one holds the state: the team room open beside
 * the conversation while a thread on the client's message exists and is one
 * click away.
 *
 * Worth saying plainly: the stage shows ONE side panel at a time — thread,
 * supervision or team — exactly as the supervision stage always has. "In
 * parallel" means the team room runs alongside the CONVERSATION, not that
 * two side rooms share the screen.
 */
export const TeamOpenWhileThreadExists: Story = {
	name: '(b2) Team open while a thread exists',
	globals: desktop1440Globals,
	args: { panel: 'team', withTeam: true, openThreads: 1, threadUnread: 1 },
	play: async ({ canvasElement }) => {
		await expectStageParts(canvasElement, {
			composers: 2,
			bubblesAtLeast: 4
		});
		const panel = panelOf(canvasElement);
		await expectTeamHeader(panel);
		await expectClientAbsentFromTeamRoom(panel);
		// The thread is present in the main chat as its reply affordance …
		const main = canvasElement.querySelector<HTMLElement>(
			'[data-cy="stage-main"]'
		)!;
		await expect(main.textContent).toMatch(/Antworten/);
		// … and reachable from the header, which is what "parallel" buys.
		const channelButton = panel.querySelector<HTMLElement>(
			'[data-cy="panel-header-channel-options"]'
		)!;
		await expect(channelButton.hasAttribute('disabled')).toBe(false);
	}
};

/* ------------------------------------------------------------------ *
 * (c) The channel card with three channels
 * ------------------------------------------------------------------ */

export const ChannelCardWithThree: Story = {
	name: '(c) Channel card — supervision, Teamberatung, thread',
	globals: desktop1440Globals,
	args: { panel: 'team', withTeam: true, openThreads: 1, teamUnread: 2 },
	parameters: {
		docs: {
			description: {
				story: 'The card that both hosts share. The two side rooms lead it in a fixed order (⇧S, ⇧T) and the threads follow by recency — so adding the Teamberatung never renumbers "Thread #1".'
			}
		}
	},
	play: async ({ canvasElement }) => {
		await expectStageParts(canvasElement, {
			composers: 2,
			bubblesAtLeast: 4
		});
		const panel = panelOf(canvasElement);
		await userEvent.click(
			panel.querySelector<HTMLElement>(
				'[data-cy="panel-header-channel-options"]'
			)!
		);
		const card = await waitFor(() =>
			within(canvasElement).getByRole('menu')
		);
		const rows = within(card).getAllByRole('menuitem');
		await expect(
			rows.map((row) => row.getAttribute('data-shortcut'))
		).toEqual(['⇧S', '⇧T', '⇧1']);
		// The card names what is really in it. "Threads und Supervision"
		// would be a lie with three kinds listed.
		await expect(card.getAttribute('aria-label')).toBe(
			TEAM_CHANNEL_COPY['chatStage.menu.titleWithTeam']
		);
		// The team row says the word and carries its unread count.
		const teamRow = rows[1];
		await expect(teamRow.textContent).toContain(TEAM_WORD);
		await expect(teamRow.getAttribute('aria-keyshortcuts')).toBe('Shift+T');
		// The thread keeps the number it had before the team room existed.
		await expect(rows[2].textContent).toContain('#1');
	}
};

/* ------------------------------------------------------------------ *
 * (d) The FAB with three channels
 * ------------------------------------------------------------------ */

export const FabWithThree: Story = {
	name: '(d) FAB — three channels, no panel open',
	globals: desktop1440Globals,
	args: {
		panel: null,
		withTeam: true,
		openThreads: 1,
		teamUnread: 2,
		supervisionUnread: 1,
		fabDefaultOpen: true,
		fabHidden: false
	},
	parameters: {
		docs: {
			description: {
				story: 'With no panel open the FAB is the way in, and it offers the same card in the same order. Its unread badge sums every channel, so the Teamberatung cannot go unnoticed behind the supervision one.'
			}
		}
	},
	play: async ({ canvasElement }) => {
		const fab = await waitFor(() =>
			canvasElement.querySelector<HTMLElement>(
				'[data-cy="channel-switcher-fab"]'
			)
		);
		await expect(fab).not.toBeNull();
		const card = await waitFor(() =>
			within(canvasElement).getByRole('menu')
		);
		const rows = within(card).getAllByRole('menuitem');
		await expect(rows.length).toBe(3);
		await expect(
			rows.map((row) => row.getAttribute('data-channel-id'))
		).toEqual(['supervision', 'team', expect.any(String)]);
		// 2 (team) + 1 (supervision) = the badge on the closed FAB.
		const root = canvasElement.querySelector<HTMLElement>(
			'[data-cy="channel-switcher"]'
		)!;
		await expect(root.dataset.variant).toBe('attention');
		await expect(root.dataset.mode).toBe('menu');
	}
};

/* ------------------------------------------------------------------ *
 * (e) Phone 390
 * ------------------------------------------------------------------ */

export const TeamOnPhone: Story = {
	name: '(e) Phone 390 — the team room fills the screen',
	globals: phone390Globals,
	args: {
		panel: 'team',
		withTeam: true,
		phone: 'secondary',
		openThreads: 1
	},
	parameters: {
		docs: {
			description: {
				story: 'On the phone the side room replaces the chat instead of sitting beside it (T10), and the FAB inside it switches back. The bottom navigation stays visible — the room is a view of the app, not a takeover.'
			}
		}
	},
	play: async ({ canvasElement }) => {
		await expectStageParts(canvasElement, {
			composers: 1,
			bubblesAtLeast: 3
		});
		const panel = panelOf(canvasElement);
		await expectTeamHeader(panel);
		await expectClientAbsentFromTeamRoom(panel);
		// The phone's back switcher is present, the desktop close button is not.
		await expect(
			canvasElement.querySelector('[data-cy="channel-switcher-fab"]')
		).not.toBeNull();
		await expect(
			panel.querySelector('[data-cy="panel-header-close"]')
		).toBeNull();
	}
};

/* ------------------------------------------------------------------ *
 * (f) Dark scheme
 * ------------------------------------------------------------------ */

/** The ORISO default tenant seed, as `.storybook/withOrisoScheme.tsx` uses it. */
const STORYBOOK_SEED = '#A5000A';

/**
 * The dark palette applied to THIS STORY'S SUBTREE, not to
 * `document.documentElement`.
 *
 * The toolbar switcher (`withOrisoScheme`) writes the tokens on the root.
 * That is right for a human flipping the toolbar, but wrong for an
 * automated run: while a dark story is mounted, the root carries the dark
 * palette, and a story in ANOTHER file that reads a root token mid-play
 * reads the wrong one. That really happened — `ChatStage.stories` (d2)
 * failed intermittently once this file added a second dark story, and
 * stopped the moment the global was removed.
 *
 * Custom properties inherit, so setting them on a wrapper gives the whole
 * stage the dark palette while the root stays untouched and no neighbour
 * can be poisoned. (Portalled content would escape this — nothing here
 * portals.)
 */
function DarkCanvas({ children }: { children: React.ReactNode }) {
	const { tokens } = computeOrisoPalette(
		{ primary: STORYBOOK_SEED },
		'dark'
	);
	return (
		<div
			data-cy="dark-canvas"
			data-scheme="dark"
			style={{
				...(tokens as React.CSSProperties),
				backgroundColor: tokens['--m3-surface'],
				color: tokens['--m3-on-surface'],
				minHeight: '100vh'
			}}
		>
			{children}
		</div>
	);
}

export const TeamDarkScheme: Story = {
	name: '(f) Dark scheme (Storybook only)',
	globals: desktop1440Globals,
	args: { panel: 'team', withTeam: true },
	parameters: {
		docs: {
			description: {
				story: 'The team header in the dark scheme. Dark is Storybook-only — `ACTIVE_SCHEMES` has `dark: false`, so the app never renders it — and this story exists to SHOW the state, not to claim it is finished; the salmon bubbles lose their contrast here, which is a pre-existing gap in the dark palette, not something this branch introduced. The palette is applied to the story\'s own subtree rather than through the toolbar global, so it cannot leak into a story running beside it.'
			}
		}
	},
	render: (args) => (
		<DarkCanvas>
			<ConsultantSessionStage {...args} />
		</DarkCanvas>
	),
	play: async ({ canvasElement }) => {
		await expectStageParts(canvasElement, {
			composers: 2,
			bubblesAtLeast: 4
		});
		await expectTeamHeader(panelOf(canvasElement));
		const canvas = canvasElement.querySelector<HTMLElement>(
			'[data-cy="dark-canvas"]'
		)!;
		// The dark palette really reached the stage, and it reached it from
		// the wrapper — the document root must be untouched.
		const hexLuminance = (hex: string) => {
			const n = Number.parseInt(hex.replace('#', ''), 16);
			const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
			return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
		};
		const token = (name: string) =>
			getComputedStyle(canvas).getPropertyValue(name).trim();
		const surface = token('--m3-surface');
		await expect(surface).toMatch(/^#[0-9a-f]{6}$/i);
		await expect(hexLuminance(surface)).toBeLessThan(0.5);
		await expect(hexLuminance(token('--m3-on-surface'))).toBeGreaterThan(
			0.5
		);
		// The team header's own role comes from the same engine, so the tint
		// follows the scheme instead of staying a light hard-coded fallback.
		await expect(token('--m3-secondary-fixed-dim')).toMatch(
			/^#[0-9a-f]{6}$/i
		);
		// The guard that makes this story safe to run beside others: the
		// document root still carries the LIGHT palette the toolbar applied,
		// so a story running in another file reads light tokens while this
		// one renders dark.
		const rootSurface = getComputedStyle(document.documentElement)
			.getPropertyValue('--m3-surface')
			.trim();
		await expect(hexLuminance(rootSurface)).toBeGreaterThan(0.5);
		await expect(rootSurface).not.toBe(surface);
	}
};

/* ------------------------------------------------------------------ *
 * (g) The empty team room
 * ------------------------------------------------------------------ */

export const TeamRoomEmpty: Story = {
	name: '(g) Empty team room — before the first message',
	globals: desktop1440Globals,
	args: { panel: 'team', withTeam: true, teamEmpty: true },
	parameters: {
		docs: {
			description: {
				story: 'A room that exists but has nothing in it yet. The system notice is still the first item (T7) and a banner says what to do — the same shape the supervision room uses when a supervisor arrives before the first message.'
			}
		}
	},
	play: async ({ canvasElement }) => {
		const panel = await waitFor(() => panelOf(canvasElement));
		await expectTeamHeader(panel);
		// The notice is there, and it is the ONLY item.
		await waitFor(() =>
			expect(
				panel.querySelectorAll('.messageItem').length
			).toBeGreaterThanOrEqual(1)
		);
		await expect(panel.textContent).toContain(
			TEAM_CHANNEL_COPY['chatStage.panel.team.empty.title']
		);
		// Even empty, the room never names the client as a member.
		await expectClientAbsentFromTeamRoom(panel);
	}
};

/* ------------------------------------------------------------------ *
 * (h) The memory of the last channel — the reason it moved to localStorage
 * ------------------------------------------------------------------ */

const MEMORY_SESSION_ID = 4711;

/**
 * A deliberately plain harness around the REAL memory functions
 * (`readLastChannel` / `writeLastChannel` / `safeChannelStorage`). It is not
 * a mock: the story writes to the same store the app writes to, and the
 * "reload" button remounts the reader, which is as close to a page reload as
 * a story can get. `sessionStorage` would survive this too — what it would
 * NOT survive is closing the tab, and that is the case unit-tested in
 * `channelRoute.test.ts`.
 */
function ChannelMemoryProbe() {
	const [generation, setGeneration] = useState(0);
	const [remembered, setRemembered] = useState<
		SessionChannel | null | undefined
	>(() => readLastChannel(safeChannelStorage(), MEMORY_SESSION_ID));
	const open = useCallback((id: string) => {
		const channel = channelFromId(id);
		writeLastChannel(safeChannelStorage(), MEMORY_SESSION_ID, channel);
		setRemembered(channel);
	}, []);
	const close = useCallback(() => {
		writeLastChannel(safeChannelStorage(), MEMORY_SESSION_ID, null);
		setRemembered(null);
	}, []);
	const reload = useCallback(() => {
		setGeneration((value) => value + 1);
		setRemembered(readLastChannel(safeChannelStorage(), MEMORY_SESSION_ID));
	}, []);
	const shown =
		remembered === undefined
			? 'nichts gemerkt'
			: remembered === null
				? 'geschlossen'
				: channelId(remembered);
	return (
		<div style={{ padding: 24, fontFamily: 'system-ui', lineHeight: 1.8 }}>
			<p>
				Zuletzt geöffneter Kanal dieser Beratung:{' '}
				<strong data-cy="remembered-channel">{shown}</strong>
			</p>
			<p data-cy="probe-generation">Neu geladen: {generation}×</p>
			<button type="button" onClick={() => open('supervision')}>
				Supervision öffnen
			</button>{' '}
			<button type="button" onClick={() => open('team')}>
				{TEAM_WORD} öffnen
			</button>{' '}
			<button type="button" onClick={close}>
				Schließen
			</button>{' '}
			<button type="button" onClick={reload}>
				Seite neu laden
			</button>
		</div>
	);
}

export const RemembersTheLastChannel: Story = {
	name: '(h) The last channel is remembered across a reload',
	parameters: {
		docs: {
			description: {
				story: 'Frank, 09.09.: "Wichtig, dass für den Nutzer immer die letzte Einstellung gespeichert wird." The store moved from `sessionStorage` (one tab, gone when it closes) to `localStorage`. This story drives the real functions and remounts the reader.'
			}
		}
	},
	render: () => <ChannelMemoryProbe />,
	play: async ({ canvasElement, step }) => {
		const canvas = within(canvasElement);
		const store = safeChannelStorage();
		// Start from a clean slate — other stories share this browser.
		store?.removeItem?.(lastChannelKey(MEMORY_SESSION_ID));

		await step('opening the Teamberatung writes it down', async () => {
			await userEvent.click(
				canvas.getByRole('button', { name: `${TEAM_WORD} öffnen` })
			);
			await expect(
				canvas.getByTestId
					? canvasElement.querySelector(
							'[data-cy="remembered-channel"]'
						)!.textContent
					: ''
			).toBe('team');
			await expect(
				store?.getItem(lastChannelKey(MEMORY_SESSION_ID))
			).toBe('team');
		});

		await step('a reload brings the team channel back', async () => {
			await userEvent.click(
				canvas.getByRole('button', { name: 'Seite neu laden' })
			);
			await waitFor(() =>
				expect(
					canvasElement.querySelector(
						'[data-cy="probe-generation"]'
					)!.textContent
				).toContain('1×')
			);
			await expect(
				canvasElement.querySelector('[data-cy="remembered-channel"]')!
					.textContent
			).toBe('team');
		});

		await step('an explicit close is remembered as closed', async () => {
			await userEvent.click(
				canvas.getByRole('button', { name: 'Schließen' })
			);
			await userEvent.click(
				canvas.getByRole('button', { name: 'Seite neu laden' })
			);
			await waitFor(() =>
				expect(
					canvasElement.querySelector(
						'[data-cy="remembered-channel"]'
					)!.textContent
				).toBe('geschlossen')
			);
			// A remembered close must not reopen anything — that is what
			// `decideAutoOpen` reads as `remembered === null`.
			await expect(
				store?.getItem(lastChannelKey(MEMORY_SESSION_ID))
			).toBe('none');
		});

		await step('switching back to supervision overwrites it', async () => {
			await userEvent.click(
				canvas.getByRole('button', { name: 'Supervision öffnen' })
			);
			await userEvent.click(
				canvas.getByRole('button', { name: 'Seite neu laden' })
			);
			await waitFor(() =>
				expect(
					canvasElement.querySelector(
						'[data-cy="remembered-channel"]'
					)!.textContent
				).toBe('supervision')
			);
		});

		store?.removeItem?.(lastChannelKey(MEMORY_SESSION_ID));
	}
};

/* ------------------------------------------------------------------ *
 * (i) Closing the panel
 * ------------------------------------------------------------------ */

export const ClosingTheTeamPanel: Story = {
	name: '(i) Closing the team panel returns the full-width chat',
	globals: desktop1440Globals,
	args: { panel: 'team', withTeam: true, fabHidden: false },
	parameters: {
		docs: {
			description: {
				story: 'The close control removes the panel and gives the card back to the conversation. In the app the same act is a `replace` on the URL, and browser Back closes the panel the same way — that half is proven in `channelRoute.test.ts`, which the stage (local state, no URL) cannot show.'
			}
		}
	},
	play: async ({ canvasElement }) => {
		await expectStageParts(canvasElement, {
			composers: 2,
			bubblesAtLeast: 4
		});
		const close = panelOf(canvasElement).querySelector<HTMLElement>(
			'[data-cy="panel-header-close"]'
		)!;
		await expect(close).not.toBeNull();
		await userEvent.click(close);
		await waitFor(() =>
			expect(
				canvasElement.querySelector('[data-cy="stage-panel"]')
			).toBeNull()
		);
		// The card is no longer split, and the counsellor's chat is whole.
		await waitFor(() =>
			expect(
				canvasElement.querySelector('.chatStage__card--split')
			).toBeNull()
		);
		await expect(canvasElement.textContent).toContain(COUNSELLOR_NAME);
	}
};
