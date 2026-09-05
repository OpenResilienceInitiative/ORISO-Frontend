/**
 * Templates/ConsultantSessionStage — the wired consultant view as Frank
 * wants to see it before any app wiring: list column + chat card + side
 * room + FAB, all real organisms (see `__storybook__/ConsultantSessionStage`).
 *
 * Every story follows the viewport: use the toolbar (Phone 390 / Tablet 834
 * / Desktop 1280 / Desktop 1440) or `_shots/shoot.mjs`, which shoots each
 * story at 1280×820, 1440×900 and 390×844.
 */
import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { ConsultantSessionStage } from './__storybook__/ConsultantSessionStage';
import { ChannelSwitcherFab } from './ChannelSwitcherFab';
import { STAGE_LAYOUT } from './stageLayout';
import {
	CLIENT_NAME,
	stageRoute,
	SUPERVISOR_NAME,
	THREAD_ROOT_ID
} from './__storybook__/chatStageFixtures';
import { phone390Globals } from '../message/messageStoryShell';
import './chatStage.styles.scss';

const CHAT_ROOM_FIGMA_URL =
	'https://www.figma.com/design/L2mOFNSGdxPPx1XA4HFAog/App.Oriso?node-id=1320-38278';
const FAB_MENU_FIGMA_URL =
	'https://www.figma.com/design/L2mOFNSGdxPPx1XA4HFAog/App.Oriso?node-id=9748-60084';

const desktop1280Globals = { viewport: { value: 'desktop1280' } };

const meta = {
	title: 'Templates/ConsultantSessionStage',
	component: ConsultantSessionStage,
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		router: { initialPath: stageRoute },
		design: [
			{
				type: 'figma',
				name: 'Chat with threads',
				url: CHAT_ROOM_FIGMA_URL
			},
			{ type: 'figma', name: 'FAB menu', url: FAB_MENU_FIGMA_URL }
		],
		viewport: {
			options: {
				desktop1280: {
					name: 'Desktop 1280 (with list column)',
					styles: { width: '1280px', height: '820px' },
					type: 'desktop'
				}
			}
		},
		docs: {
			description: {
				component:
					'Consultant session stage composed from the real list column, session header, MessageTimeline, composer, SidePanel and ChannelSwitcherFab. ' +
					'Stories (a)–(f) are the decisions Frank asked to see on 04.09.: supervision inside the card vs. second card, list snapped to the icon rail, thread + supervision at once, phone main/secondary with the FAB, FAB label topic vs. supervisor name.'
			}
		}
	}
} satisfies Meta<typeof ConsultantSessionStage>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Real chat parts on stage: list rows, session header, bubbles, composers. */
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

const paneWidths = (canvasElement: HTMLElement) => ({
	main:
		canvasElement
			.querySelector('[data-cy="stage-main"]')
			?.getBoundingClientRect().width ?? 0,
	panel:
		canvasElement
			.querySelector('[data-cy="stage-panel-slot"]')
			?.getBoundingClientRect().width ?? 0,
	list:
		canvasElement
			.querySelector('[data-cy="stage-list"]')
			?.getBoundingClientRect().width ?? 0
});

/** (a) Frank's choice: the supervision room joined inside the chat card. */
export const SupervisionInsideTheCard: Story = {
	name: '(a) Supervision inside the card',
	globals: desktop1280Globals,
	args: {
		panel: 'supervision',
		panelVariant: 'inside',
		supervisionUnread: 0
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expectStageParts(canvasElement, {
			composers: 2,
			bubblesAtLeast: 10
		});
		await expect(
			canvasElement.querySelectorAll('.sessionsListItem').length
		).toBe(3);
		await expect(
			canvasElement.querySelector('.sessionsListItem--active')
		).not.toBeNull();
		await expect(
			canvasElement.querySelector('.sessionInfo')
		).not.toBeNull();
		await expect(
			canvas.getByText(SUPERVISOR_NAME, {
				selector: '.panelHeader__titleName'
			})
		).toBeVisible();
		// The side room never shows the client's name.
		await expect(
			canvasElement.querySelector('[data-cy="stage-panel"]')
				?.textContent ?? ''
		).not.toContain(CLIENT_NAME);
		// Same card: the panel is a child of the `.session` card.
		await expect(
			canvasElement.querySelector('.session [data-cy="stage-panel"]')
		).not.toBeNull();
		// T3: both hairlines end on the same y.
		const mainRow = canvasElement.querySelector(
			'.sessionInfo__headerWrapper'
		)!;
		const panelDivider = canvasElement.querySelector(
			'.panelHeader__divider'
		)!;
		await expect(
			Math.round(
				mainRow.getBoundingClientRect().bottom -
					panelDivider.getBoundingClientRect().top
			)
		).toBe(1);
		// T2: the real handle sits on the panel's start edge, pill centred.
		const handle = canvasElement.querySelector<HTMLElement>(
			'[data-cy="stage-panel-handle"]'
		)!;
		await expect(handle).not.toBeNull();
		const pill = handle.querySelector('.sessionsList__resizeHandlePill')!;
		const slot = canvasElement.querySelector(
			'[data-cy="stage-panel-slot"]'
		)!;
		const h = slot.getBoundingClientRect();
		const p = pill.getBoundingClientRect();
		await expect(
			Math.abs(p.top + p.height / 2 - (h.top + h.height / 2))
		).toBeLessThanOrEqual(1);
		// T13: the list handle is centred in the gap between the list and
		// the chat card (its centre = the midpoint of list.right … card.left).
		const listHandle = canvasElement.querySelector<HTMLElement>(
			'[data-cy="stage-list-handle"]'
		)!;
		const listBox = canvasElement
			.querySelector('[data-cy="stage-list"]')!
			.getBoundingClientRect();
		const cardBox = canvasElement
			.querySelector('.chatStage__card')!
			.getBoundingClientRect();
		const listPill = listHandle
			.querySelector('.sessionsList__resizeHandlePill')!
			.getBoundingClientRect();
		await expect(cardBox.left - listBox.right).toBeGreaterThan(0);
		const gapMid = (listBox.right + cardBox.left) / 2;
		await expect(
			Math.abs(listPill.left + listPill.width / 2 - gapMid)
		).toBeLessThanOrEqual(1);
		const handleBox = listHandle.getBoundingClientRect();
		await expect(
			Math.abs(handleBox.left + handleBox.width / 2 - gapMid)
		).toBeLessThanOrEqual(1);
		// T6: the composer's drag pill exists in the panel too.
		await expect(
			canvasElement.querySelector('[data-cy="stage-panel"] .dragHandle')
		).not.toBeNull();
		// T16: desktop — the scroll-to-newest arrow leads every action bar,
		// the phone-only back arrow is absent.
		await expect(
			canvasElement.querySelectorAll(
				'[data-cy="composer-scroll-to-newest"]'
			).length
		).toBe(2);
		await expect(
			canvasElement.querySelector('[data-cy="composer-back"]')
		).toBeNull();
		for (const bar of Array.from(
			canvasElement.querySelectorAll('.composerToolbar--default')
		)) {
			await expect(
				bar.querySelector('button')?.getAttribute('data-cy')
			).toBe('composer-scroll-to-newest');
		}
		// The panel's arrow scrolls the panel timeline, not the main chat.
		const panelTimeline = canvasElement.querySelector<HTMLElement>(
			'[data-cy="side-panel-timeline"]'
		)!;
		panelTimeline.scrollTop = 0;
		await userEvent.click(
			canvasElement.querySelector<HTMLButtonElement>(
				'[data-cy="stage-panel"] [data-cy="composer-scroll-to-newest"]'
			)!
		);
		await waitFor(() =>
			expect(
				panelTimeline.scrollHeight -
					panelTimeline.clientHeight -
					panelTimeline.scrollTop
			).toBeLessThanOrEqual(1)
		);
		// T5: no chevron collapse button at the list edge.
		await expect(
			canvasElement.querySelector('.sessionsList__resizeToggle')
		).toBeNull();
		// T8: no "•••" next to the topic tag.
		await expect(canvasElement.textContent ?? '').not.toContain('•••');
		// Review 05.09.: with the panel open the main title must end in an
		// ellipsis before the call buttons — never underneath them.
		const title = canvasElement.querySelector<HTMLElement>(
			'[data-cy="stage-main"] .sessionInfo__username h3'
		)!;
		const actions = canvasElement.querySelector<HTMLElement>(
			'[data-cy="stage-main"] .sessionInfo__headerWrapper > .sessionMenu__wrapper'
		)!;
		await expect(title.getBoundingClientRect().right).toBeLessThanOrEqual(
			actions.getBoundingClientRect().left + 0.5
		);
	}
};

/**
 * (a2) T7: the side room opens with the system notice "Supervision durch
 * Bettina B. …" as its first item — the real `[SYSTEM_NOTIFICATION]` bubble
 * the timeline renders, no panel-specific markup. The play scrolls the
 * panel to the top so the screenshot shows it.
 */
export const SupervisionSystemNoticeAtTheTop: Story = {
	name: '(a2) Supervision — system notice at the top of the side room',
	globals: desktop1280Globals,
	args: {
		panel: 'supervision',
		panelVariant: 'inside',
		supervisionUnread: 0
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expectStageParts(canvasElement, {
			composers: 2,
			bubblesAtLeast: 10
		});
		const timeline = canvasElement.querySelector<HTMLElement>(
			'[data-cy="stage-panel"] .sidePanel__timeline'
		)!;
		await expect(timeline).not.toBeNull();
		// The panel opens at its newest message; wait for that, then go up.
		await waitFor(() => expect(timeline.scrollTop).toBeGreaterThan(0));
		await new Promise((resolve) => setTimeout(resolve, 500));
		timeline.scrollTop = 0;
		const notice = canvas.getByText(/Supervision durch Bettina B\./);
		await waitFor(() => expect(notice).toBeVisible());
		const noticeRect = notice.getBoundingClientRect();
		const timelineRect = timeline.getBoundingClientRect();
		await expect(noticeRect.top).toBeGreaterThanOrEqual(timelineRect.top);
		await expect(noticeRect.bottom).toBeLessThanOrEqual(
			timelineRect.bottom
		);
		// First item of the supervision timeline, real system bubble style.
		const firstItem = timeline.querySelector<HTMLElement>('.messageItem')!;
		await expect(firstItem.contains(notice)).toBe(true);
		await expect(
			firstItem.querySelector('.messageItem__message--systemNotification')
		).not.toBeNull();
		// Wording matches the UI: the plus sits next to the mail glyph.
		await expect(notice.textContent).toContain(
			'über das Plus neben dem Mail-Symbol'
		);
	}
};

/** (b) The alternative to compare: a second chat card next to the first. */
export const SupervisionAsSecondCard: Story = {
	name: '(b) Supervision as second card',
	globals: desktop1280Globals,
	args: { panel: 'supervision', panelVariant: 'card', supervisionUnread: 1 },
	play: async ({ canvasElement }) => {
		await expectStageParts(canvasElement, {
			composers: 2,
			bubblesAtLeast: 10
		});
		await expect(
			canvasElement.querySelector('.session [data-cy="stage-panel"]')
		).toBeNull();
		await expect(
			canvasElement.querySelector('.sidePanel--card')
		).not.toBeNull();
	}
};

/** (c) The list column snaps to the icon rail so main + panel keep ≥ 520 px. */
export const ListSnappedToIconRail: Story = {
	name: '(c) List column snapped to icon-only while panel open',
	globals: desktop1280Globals,
	args: {
		panel: 'supervision',
		panelVariant: 'inside',
		snapList: true,
		listWidth: 420,
		panelWidth: 400
	},
	play: async ({ canvasElement }) => {
		await expectStageParts(canvasElement, {
			composers: 2,
			bubblesAtLeast: 10
		});
		await expect(
			canvasElement
				.querySelector('[data-cy="stage-list"]')
				?.getAttribute('data-list-mode')
		).toBe('rail');
		const widths = paneWidths(canvasElement);
		await expect(widths.list).toBeLessThanOrEqual(
			STAGE_LAYOUT.RAIL_WIDTH + 1
		);
		await expect(widths.main).toBeGreaterThanOrEqual(
			STAGE_LAYOUT.MIN_PANE_WIDTH
		);
		await expect(widths.panel).toBeGreaterThanOrEqual(
			STAGE_LAYOUT.MIN_PANE_WIDTH
		);
	}
};

/** (d) Thread occupies the panel; the FAB menu offers Thread #2 + Supervision. */
export const ThreadAndSupervisionOpenAtOnce: Story = {
	name: '(d) Thread and supervision open at once',
	globals: desktop1280Globals,
	args: {
		panel: 'thread',
		panelVariant: 'inside',
		openThreads: 2,
		supervisionUnread: 2,
		threadUnread: 0
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expectStageParts(canvasElement, {
			composers: 2,
			bubblesAtLeast: 9
		});
		// T1: with a panel open the FAB steps back; the panel header's
		// channel icon opens the same options (Thread #2 + Supervision).
		await expect(
			canvasElement.querySelector('[data-cy="channel-switcher-fab"]')
		).toBeNull();
		const options = canvasElement.querySelector<HTMLButtonElement>(
			'[data-cy="panel-header-channel-options"]'
		)!;
		await expect(options).toHaveAttribute('aria-haspopup', 'menu');
		await userEvent.click(options);
		const items = within(await canvas.findByRole('menu')).getAllByRole(
			'menuitem'
		);
		// T15: all three channels, the shown thread marked as current.
		await expect(items).toHaveLength(3);
		await expect(items[0]).toHaveAttribute('data-channel-id', '$thread-2');
		await expect(items[1]).toHaveAttribute(
			'data-channel-id',
			THREAD_ROOT_ID
		);
		await expect(items[1]).toHaveAttribute('aria-current', 'true');
		await expect(items[2]).toHaveAttribute(
			'data-channel-id',
			'supervision'
		);
		await userEvent.keyboard('{Escape}');
		// T6: the thread composer carries the drag pill as well.
		await expect(
			canvasElement.querySelector('[data-cy="stage-panel"] .dragHandle')
		).not.toBeNull();
	}
};

/** The panel's channel word / counterpart name as the stage shows them. */
const panelTitle = (canvasElement: HTMLElement) => ({
	kind:
		canvasElement.querySelector('[data-cy="panel-header-kind-label"]')
			?.textContent ?? '',
	name:
		canvasElement.querySelector('[data-cy="panel-header-name"]')
			?.textContent ?? ''
});

/** Open the panel header's channel menu and pick a channel by id. */
const pickChannelFromHeader = async (
	canvasElement: HTMLElement,
	channelId: string
) => {
	const canvas = within(canvasElement);
	await userEvent.click(
		canvasElement.querySelector<HTMLButtonElement>(
			'[data-cy="panel-header-channel-options"]'
		)!
	);
	const menu = await canvas.findByRole('menu');
	await userEvent.click(
		within(menu)
			.getAllByRole('menuitem')
			.find((item) => item.getAttribute('data-channel-id') === channelId)!
	);
	await waitFor(() =>
		expect(canvasElement.querySelector('[role="menu"]')).toBeNull()
	);
};

/**
 * (d2) T15: jump between channels while a panel is open — the header menu
 * lists every thread and the supervision, the shown one marked, and swaps
 * the panel content: thread → supervision → thread.
 */
export const PanelChannelMenuSwitchesChannels: Story = {
	name: '(d2) Panel header menu — thread → supervision → thread (T15)',
	globals: desktop1280Globals,
	args: {
		panel: 'thread',
		panelVariant: 'inside',
		openThreads: 2,
		supervisionUnread: 2
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expectStageParts(canvasElement, {
			composers: 2,
			bubblesAtLeast: 9
		});
		await expect(panelTitle(canvasElement).kind).toBe('Thread');
		await expect(panelTitle(canvasElement).name).toBe(CLIENT_NAME);
		// The menu lists all three channels; the shown thread is current.
		await userEvent.click(
			canvasElement.querySelector<HTMLButtonElement>(
				'[data-cy="panel-header-channel-options"]'
			)!
		);
		const items = within(await canvas.findByRole('menu')).getAllByRole(
			'menuitem'
		);
		await expect(
			items.map((i) => i.getAttribute('data-channel-id'))
		).toEqual(['$thread-2', THREAD_ROOT_ID, 'supervision']);
		await expect(items[1]).toHaveAttribute('aria-current', 'true');
		await expect(items[2].textContent).toContain('2');
		await userEvent.keyboard('{Escape}');
		// → supervision
		await pickChannelFromHeader(canvasElement, 'supervision');
		await waitFor(() =>
			expect(panelTitle(canvasElement).kind).toBe('Supervision')
		);
		await expect(panelTitle(canvasElement).name).toBe(SUPERVISOR_NAME);
		await expect(
			canvasElement.querySelector('[data-cy="stage-panel"]')
				?.textContent ?? ''
		).not.toContain(CLIENT_NAME);
		// → back to the thread
		await pickChannelFromHeader(canvasElement, THREAD_ROOT_ID);
		await waitFor(() =>
			expect(panelTitle(canvasElement).kind).toBe('Thread')
		);
		await expect(panelTitle(canvasElement).name).toBe(CLIENT_NAME);
		// The FAB stays hidden throughout — the header is the switcher.
		await expect(
			canvasElement.querySelector('[data-cy="channel-switcher-fab"]')
		).toBeNull();
	}
};

/**
 * (e3) T15 on the phone: the FAB in the main chat opens the same channel
 * list and switches to the secondary view; inside it, the header menu
 * jumps on to the next channel.
 */
export const PhoneChannelMenuFromFabAndHeader: Story = {
	name: '(e3) Phone — channel menu from the FAB and from the panel header (T15)',
	globals: phone390Globals,
	args: {
		panel: 'supervision',
		phone: 'main',
		openThreads: 2,
		supervisionUnread: 1
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expectStageParts(canvasElement, {
			composers: 1,
			bubblesAtLeast: 6
		});
		// Collapsed phone state: the FAB offers every channel.
		await userEvent.click(
			canvasElement.querySelector<HTMLButtonElement>(
				'[data-cy="channel-switcher-fab"]'
			)!
		);
		const fabItems = within(await canvas.findByRole('menu')).getAllByRole(
			'menuitem'
		);
		await expect(fabItems).toHaveLength(3);
		await userEvent.click(
			fabItems.find(
				(item) => item.getAttribute('data-channel-id') === 'supervision'
			)!
		);
		// → the secondary view with the supervision room.
		await waitFor(() =>
			expect(
				canvasElement.querySelector('[data-cy="panel-header-back"]')
			).not.toBeNull()
		);
		await expect(panelTitle(canvasElement).kind).toBe('Supervision');
		// Inside the secondary view the header menu lists all channels …
		await userEvent.click(
			canvasElement.querySelector<HTMLButtonElement>(
				'[data-cy="panel-header-channel-options"]'
			)!
		);
		const headerItems = within(
			await canvas.findByRole('menu')
		).getAllByRole('menuitem');
		await expect(
			headerItems.map((i) => i.getAttribute('data-channel-id'))
		).toEqual(['$thread-2', THREAD_ROOT_ID, 'supervision']);
		await expect(headerItems[2]).toHaveAttribute('aria-current', 'true');
		// … and switches on selection.
		await userEvent.click(headerItems[1]);
		await waitFor(() =>
			expect(panelTitle(canvasElement).kind).toBe('Thread')
		);
		await expect(
			canvasElement.querySelector('[data-cy="panel-header-back"]')
		).not.toBeNull();
		// The phone FAB still leads back to the main chat.
		await expect(
			canvasElement
				.querySelector('[data-cy="channel-switcher-fab"]')
				?.getAttribute('aria-label')
		).toMatch(/Beratungschat|counselling|Nebenkanäle|side channels/i);
	}
};

/** (e1) Phone: the main chat with the FAB above the composer + bottom nav. */
export const PhoneMainChatWithFab: Story = {
	name: '(e) Phone — main chat with FAB',
	globals: phone390Globals,
	args: { panel: 'supervision', phone: 'main', supervisionUnread: 3 },
	play: async ({ canvasElement }) => {
		await expectStageParts(canvasElement, {
			composers: 1,
			bubblesAtLeast: 6
		});
		const root = canvasElement.querySelector(
			'[data-cy="channel-switcher"]'
		);
		await expect(root?.getAttribute('data-variant')).toBe('attention');
		await expect(
			canvasElement.querySelector('.sessionsListItem')
		).toBeNull();
	}
};

/** (g) Phone: the composer is one line and grows while typing (T10). */
export const PhoneComposerGrowsWhileTyping: Story = {
	name: '(g) Phone — composer one line, grows while typing',
	globals: phone390Globals,
	args: { panel: 'supervision', phone: 'main', supervisionUnread: 0 },
	play: async ({ canvasElement }) => {
		await expectStageParts(canvasElement, {
			composers: 1,
			bubblesAtLeast: 6
		});
		const shell = canvasElement.querySelector<HTMLElement>(
			'.textarea__wrapper-send-message'
		)!;
		const editor = canvasElement.querySelector<HTMLElement>(
			'.textarea__wrapper-send-message .ProseMirror'
		)!;
		const oneLine = shell.getBoundingClientRect().height;
		// One line: ~102 px (composerResize MIN_HEIGHT_MOBILE + the rendered
		// line's rounding), a far cry from the old 180 px block.
		await expect(oneLine).toBeGreaterThanOrEqual(100);
		await expect(oneLine).toBeLessThanOrEqual(110);
		// One visual line: the card ends ≤ 12 px under the editor line.
		await expect(
			shell.getBoundingClientRect().bottom -
				editor.getBoundingClientRect().bottom
		).toBeLessThanOrEqual(12);
		// T16: no navigator row (◂ ▬ ▾) at all any more; its arrows sit at
		// the start of the composer's action bar — back (phone only) first,
		// then scroll-to-newest — and the drag pill stays on the phone too.
		await expect(
			canvasElement.querySelector('.textarea__mobileNavigator')
		).toBeNull();
		const bar = canvasElement.querySelector<HTMLElement>(
			'.composerToolbar--default'
		)!;
		const barButtons = Array.from(bar.querySelectorAll('button'));
		await expect(barButtons[0].getAttribute('data-cy')).toBe(
			'composer-back'
		);
		await expect(barButtons[1].getAttribute('data-cy')).toBe(
			'composer-scroll-to-newest'
		);
		await expect(
			canvasElement.querySelector('[data-cy="stage-main"] .dragHandle')
		).not.toBeNull();
		// The down arrow scrolls the timeline to its newest message.
		const timeline = canvasElement.querySelector<HTMLElement>(
			'[data-cy="stage-main"] .session__content'
		)!;
		timeline.scrollTop = 0;
		await expect(timeline.scrollTop).toBe(0);
		await userEvent.click(
			canvasElement.querySelector<HTMLButtonElement>(
				'[data-cy="composer-scroll-to-newest"]'
			)!
		);
		await waitFor(() =>
			expect(
				timeline.scrollHeight -
					timeline.clientHeight -
					timeline.scrollTop
			).toBeLessThanOrEqual(1)
		);
		await expect(
			canvasElement.querySelector('[data-cy="channel-switcher"]')
		).not.toBeNull();
		// The app's bottom navigation, not a placeholder.
		await expect(
			canvasElement.querySelector(
				'[data-cy="stage-bottom-nav"] .navigation__wrapper'
			)
		).not.toBeNull();
		// Nothing but the dock (16 px) between composer and bottom nav.
		const nav = canvasElement.querySelector<HTMLElement>(
			'[data-cy="stage-bottom-nav"]'
		)!;
		await expect(
			Math.round(
				nav.getBoundingClientRect().top -
					shell.getBoundingClientRect().bottom
			)
		).toBeLessThanOrEqual(16);
		// Type three lines → the composer grows with the content.
		await userEvent.click(editor);
		// Focused: the FAB steps back so it cannot ride over the avatar /
		// last bubble; still no navigator row (T16).
		await waitFor(() => {
			expect(
				canvasElement.querySelector('[data-cy="channel-switcher"]')
			).toBeNull();
		});
		await expect(
			canvasElement.querySelector('.textarea__mobileNavigator')
		).toBeNull();
		await userEvent.keyboard(
			'Zeile eins{Shift>}{Enter}{/Shift}Zeile zwei{Shift>}{Enter}{/Shift}Zeile drei'
		);
		await waitFor(() =>
			expect(shell.getBoundingClientRect().height).toBeGreaterThanOrEqual(
				oneLine + 40
			)
		);
		await expect(
			canvasElement.querySelector('[data-cy="channel-switcher"]')
		).toBeNull();
		// Clear through the TipTap handle on the DOM node (synthetic Backspace
		// does not reach ProseMirror) → back to one line.
		(editor as any).editor?.commands.clearContent(true);
		await waitFor(() =>
			expect(shell.getBoundingClientRect().height).toBeLessThanOrEqual(
				oneLine + 8
			)
		);
		// Blur → collapsed again: FAB back.
		(document.activeElement as HTMLElement | null)?.blur();
		await waitFor(() => {
			expect(
				canvasElement.querySelector('[data-cy="channel-switcher"]')
			).not.toBeNull();
		});
	}
};

/** (e2) Phone: inside the supervision chat, the FAB switches back. */
export const PhoneSecondaryChatWithBackFab: Story = {
	name: '(e) Phone — secondary chat, FAB as back switcher',
	globals: phone390Globals,
	args: { panel: 'supervision', phone: 'secondary' },
	play: async ({ canvasElement }) => {
		await expectStageParts(canvasElement, {
			composers: 1,
			bubblesAtLeast: 4
		});
		await expect(
			canvasElement.querySelector('[data-cy="panel-header-back"]')
		).not.toBeNull();
		const fab = canvasElement.querySelector<HTMLButtonElement>(
			'[data-cy="channel-switcher-fab"]'
		)!;
		await expect(fab.getAttribute('aria-label')).toMatch(
			/Beratungschat|counselling/i
		);
	}
};

/** (f) Open question: does the switcher say "Supervision" or "Bettina B."? */
export const FabLabelTopicVsSupervisorName: Story = {
	name: '(f) FAB label — topic name vs. supervisor name',
	args: {},
	render: () => (
		<div className="chatStageCompare">
			{(['topic', 'person'] as const).map((mode) => (
				<div className="chatStageCompare__item" key={mode}>
					<p className="chatStageCompare__caption">
						{mode === 'topic'
							? 'Variante 1 — Thema: „Supervision" / Thread-Auszug'
							: 'Variante 2 — Person: „Bettina B." / Klient:in'}
					</p>
					<div
						className="chatStageCompare__frame"
						data-cy={`compare-${mode}`}
					>
						<ChannelSwitcherFab
							defaultOpen
							onSelect={() => {}}
							channels={[
								{
									id: 'supervision',
									kind: 'supervision',
									label:
										mode === 'topic'
											? 'Supervision'
											: SUPERVISOR_NAME,
									unread: 1
								},
								{
									id: '$thread-1',
									kind: 'thread',
									label:
										mode === 'topic'
											? 'Es sind ein paar Briefe gekommen…'
											: CLIENT_NAME
								}
							]}
						/>
					</div>
				</div>
			))}
		</div>
	),
	play: async ({ canvasElement }) => {
		await waitFor(() =>
			expect(canvasElement.querySelectorAll('[role="menu"]').length).toBe(
				2
			)
		);
		await expect(
			canvasElement.querySelector('[data-cy="compare-topic"]')
				?.textContent
		).toContain('Supervision');
		await expect(
			canvasElement.querySelector('[data-cy="compare-person"]')
				?.textContent
		).toContain(SUPERVISOR_NAME);
	}
};
