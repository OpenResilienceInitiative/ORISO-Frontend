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
	SUPERVISOR_NAME
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
		const fab = canvasElement.querySelector<HTMLButtonElement>(
			'[data-cy="channel-switcher-fab"]'
		)!;
		await expect(fab).toHaveAttribute('aria-haspopup', 'menu');
		await userEvent.click(fab);
		const items = within(await canvas.findByRole('menu')).getAllByRole(
			'menuitem'
		);
		await expect(items).toHaveLength(2);
		await expect(items[0]).toHaveAttribute('data-channel-id', '$thread-2');
		await expect(items[1]).toHaveAttribute(
			'data-channel-id',
			'supervision'
		);
		await userEvent.keyboard('{Escape}');
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
