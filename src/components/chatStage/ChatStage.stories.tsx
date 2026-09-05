/**
 * Templates/ConsultantSessionStage — the wired consultant view as Frank
 * wants to see it before any app wiring: list column + chat card + side
 * room + FAB, all real organisms (see `__storybook__/ConsultantSessionStage`).
 *
 * Every story follows the viewport: use the toolbar (Phone 390 / Tablet 834
 * / Desktop 1280 / Desktop 1440) or `_shots/shoot.mjs`, which shoots each
 * story at 1280×820, 1440×900 and 390×844.
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { ConsultantSessionStage } from './__storybook__/ConsultantSessionStage';
import { STAGE_LAYOUT } from './stageLayout';
import {
	CLIENT_NAME,
	COUNSELLOR_NAME,
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
const CHANNEL_MENU_FIGMA_URL =
	'https://www.figma.com/design/L2mOFNSGdxPPx1XA4HFAog/App.Oriso?node-id=9763-62964';

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
			{ type: 'figma', name: 'FAB menu', url: FAB_MENU_FIGMA_URL },
			{
				type: 'figma',
				name: 'Channel menu card',
				url: CHANNEL_MENU_FIGMA_URL
			}
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
					'Stories (a)–(e) are the decisions Frank asked to see on 04.09.: supervision inside the card vs. second card, list snapped to the icon rail, thread + supervision at once, phone main/secondary with the FAB. ' +
					'The former (f) "FAB label topic vs. person" was retired after T20 fixed the card labels ("Supervisionschat", "Thread #n"); the person shows in the preview line.'
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

/**
 * T22: the composer's action bar scrolls horizontally when the pane is
 * narrow — the expand icon (last button) stays fully reachable and never
 * slides under the send button, which keeps its place at the right.
 * `overflow: 'expected'` (phone, narrow panel) insists that the bar
 * actually overflows; `'either'` (D10: the snapped list gives the panel
 * room) checks the reachability rule whether or not it overflows.
 */
const expectActionBarScrolls = async (
	pane: HTMLElement,
	{ overflow = 'expected' }: { overflow?: 'expected' | 'either' } = {}
) => {
	const bar = pane.querySelector<HTMLElement>('.composerToolbar--default')!;
	const buttons = Array.from(bar.querySelectorAll('button'));
	const expand = buttons[buttons.length - 1];
	const send = pane.querySelector<HTMLElement>('.sendButton')!;
	if (overflow === 'expected') {
		await waitFor(() =>
			expect(bar.scrollWidth).toBeGreaterThan(bar.clientWidth)
		);
	}
	const sendBox = send.getBoundingClientRect();
	// The bar itself ends before the send button: whatever overflows is
	// clipped inside the bar, never painted under the button.
	await expect(bar.getBoundingClientRect().right).toBeLessThanOrEqual(
		sendBox.left + 1
	);
	await expect(getComputedStyle(bar).overflowX).toBe('auto');
	bar.scrollLeft = bar.scrollWidth;
	await waitFor(() => {
		const barBox = bar.getBoundingClientRect();
		const box = expand.getBoundingClientRect();
		expect(box.left).toBeGreaterThanOrEqual(barBox.left - 1);
		expect(box.right).toBeLessThanOrEqual(barBox.right + 1);
		expect(box.right).toBeLessThanOrEqual(sendBox.left + 1);
	});
	bar.scrollLeft = 0;
};

/**
 * T23 (desktop): the action bar starts with the scroll-to-newest arrow —
 * a real arrow glyph — with no reserved space for the phone's back arrow.
 */
const expectDesktopActionBarStart = async (pane: HTMLElement) => {
	const bar = pane.querySelector<HTMLElement>('.composerToolbar--default')!;
	const first = bar.querySelector('button')!;
	await expect(first.getAttribute('data-cy')).toBe(
		'composer-scroll-to-newest'
	);
	await expect(bar.querySelector('[data-cy="composer-back"]')).toBeNull();
	await expect(
		first.querySelector('[data-testid="ArrowDownwardIcon"]')
	).not.toBeNull();
	const field = pane.querySelector<HTMLElement>('.textarea__inputWrapper')!;
	await expect(
		first.getBoundingClientRect().left - field.getBoundingClientRect().left
	).toBeLessThanOrEqual(16);
};

/**
 * T30: the VISIBLE avatar (48 px inside the 60 px frame with its 6 px
 * white ring) sits at the timeline's 16 px inset on both sides — Figma
 * 1320:38278 "Chat Container" — so bubbles and avatars are as close to
 * the card edge as the design draws them, in the main chat and the panel.
 */
const expectAvatarsAtCardInset = async (pane: HTMLElement) => {
	const timeline = pane.querySelector<HTMLElement>(
		'.session__content, .sidePanel__timeline'
	)!;
	const box = timeline.getBoundingClientRect();
	await expect(getComputedStyle(timeline).paddingRight).toBe('16px');
	const items = Array.from(
		pane.querySelectorAll<HTMLElement>('.messageItem')
	);
	const outgoing = items.filter((item) =>
		item.classList.contains('messageItem--right')
	);
	const incoming = items.filter(
		(item) =>
			!item.classList.contains('messageItem--right') &&
			item.querySelector('.messageItem__avatar')
	);
	await expect(outgoing.length).toBeGreaterThan(0);
	await expect(incoming.length).toBeGreaterThan(0);
	const ring = 6;
	// The rows animate in (`.messageItem` enters at scale 0.98) — measure
	// once they have settled.
	await waitFor(() => {
		for (const item of outgoing) {
			const avatar = item
				.querySelector('.messageItem__avatar')!
				.getBoundingClientRect();
			expect(Math.round(box.right - (avatar.right - ring))).toBe(16);
		}
		for (const item of incoming) {
			const avatar = item
				.querySelector('.messageItem__avatar')!
				.getBoundingClientRect();
			expect(Math.round(avatar.left + ring - box.left)).toBe(16);
		}
	});
};

/**
 * T35: with a side panel open every desktop composer rests at one line —
 * card height ≤ 84 px (border + dock + toolbar strip) + one line + 36 px
 * (editor inset + dock + border) — and grows with the typed content.
 */
const expectCompactComposers = async (canvasElement: HTMLElement) => {
	const shells = Array.from(
		canvasElement.querySelectorAll<HTMLElement>(
			'.textarea__wrapper-send-message'
		)
	);
	await expect(shells.length).toBe(2);
	for (const shell of shells) {
		await expect(
			shell.classList.contains('textarea__wrapper-send-message--compact')
		).toBe(true);
		const editor = shell.querySelector<HTMLElement>('.ProseMirror')!;
		const lineHeight = Number.parseFloat(
			getComputedStyle(editor.firstElementChild || editor).lineHeight
		);
		await waitFor(() => {
			// One line plus rounding — a second line would add a whole
			// line-height (the browsers round the 21–22.4 px line and the
			// two 1 px borders differently, hence the quarter line).
			expect(shell.getBoundingClientRect().height).toBeLessThanOrEqual(
				84 + 36 + lineHeight * 1.25
			);
			expect(editor.getBoundingClientRect().height).toBeLessThanOrEqual(
				lineHeight * 1.5
			);
		});
		await expect(shell.querySelector('.dragHandle')).not.toBeNull();
	}
	// Typing three lines into the panel's composer grows it by two lines
	// (D1: 20 px lines — measured from the editor, minus 2 px rounding).
	const panelShell = canvasElement.querySelector<HTMLElement>(
		'[data-cy="stage-panel"] .textarea__wrapper-send-message'
	)!;
	const panelEditor = panelShell.querySelector<HTMLElement>('.ProseMirror')!;
	const panelLine = Number.parseFloat(
		getComputedStyle(panelEditor.firstElementChild || panelEditor)
			.lineHeight
	);
	const oneLine = panelShell.getBoundingClientRect().height;
	await userEvent.click(panelEditor);
	await userEvent.keyboard(
		'Zeile eins{Shift>}{Enter}{/Shift}Zeile zwei{Shift>}{Enter}{/Shift}Zeile drei'
	);
	await waitFor(() =>
		expect(
			panelShell.getBoundingClientRect().height
		).toBeGreaterThanOrEqual(oneLine + 2 * panelLine - 2)
	);
	// Cleared → back to one line (+8 px rounding slack, as in (g)).
	(panelEditor as any).editor?.commands.clearContent(true);
	await waitFor(() =>
		expect(panelShell.getBoundingClientRect().height).toBeLessThanOrEqual(
			oneLine + 8
		)
	);
	(document.activeElement as HTMLElement | null)?.blur();
};

/**
 * T39: the header row starts at the card's top padding — Figma
 * 1320:38281: "Room Header All" at y = 16 inside the card, "Room Header
 * Content" (the 40 px avatar row) 6 px below it, nothing extra. Measured
 * from the card's inner edge (its 1 px border excluded): row = +16,
 * avatars = +22 — main chat and side panel alike.
 */
const expectHeaderRowsAtCardTop = async (canvasElement: HTMLElement) => {
	const card = canvasElement.querySelector<HTMLElement>('.chatStage__card')!;
	const cardInnerTop =
		card.getBoundingClientRect().top +
		Number.parseFloat(getComputedStyle(card).borderTopWidth);
	const mainRow = canvasElement.querySelector<HTMLElement>(
		'.sessionInfo__headerWrapper'
	)!;
	const mainStack = canvasElement.querySelector<HTMLElement>(
		'.sessionInfo__memberStack'
	)!;
	const panelRow =
		canvasElement.querySelector<HTMLElement>('.panelHeader__row')!;
	const panelStack = canvasElement.querySelector<HTMLElement>(
		'.panelHeader__participants'
	)!;
	await expect(
		Math.round(mainRow.getBoundingClientRect().top - cardInnerTop)
	).toBe(16);
	await expect(
		Math.round(mainStack.getBoundingClientRect().top - cardInnerTop)
	).toBe(22);
	await expect(
		Math.round(panelRow.getBoundingClientRect().top - cardInnerTop)
	).toBe(16);
	await expect(
		Math.round(panelStack.getBoundingClientRect().top - cardInnerTop)
	).toBe(22);
	// Nothing sits between the card edge and the header: the header is
	// the pane's first box and starts on the card's inner edge.
	const mainHeader = canvasElement.querySelector<HTMLElement>(
		'[data-cy="stage-main"] .sessionInfo'
	)!;
	const panelHeader = canvasElement.querySelector<HTMLElement>(
		'[data-cy="stage-panel"] .panelHeader'
	)!;
	await expect(
		Math.round(mainHeader.getBoundingClientRect().top - cardInnerTop)
	).toBe(0);
	await expect(
		Math.round(panelHeader.getBoundingClientRect().top - cardInnerTop)
	).toBe(0);
	await expect(getComputedStyle(mainHeader).paddingTop).toBe('16px');
	await expect(getComputedStyle(panelHeader).paddingTop).toBe('16px');
	await expect(getComputedStyle(mainRow).paddingTop).toBe('6px');
	await expect(getComputedStyle(panelRow).paddingTop).toBe('6px');
};

/**
 * T40: dual mode — exactly ONE bordered box around each composer. The
 * outer shell has no border; it keeps only the card's outer bottom corner
 * (main column: bottom-left, side panel: bottom-right = the card's own
 * radius) and 0 on the inner corners; the field is the bordered box with
 * corners ≤ 4 px and takes the freed inset (it fills the shell).
 */
const expectSingleBoxComposers = async (canvasElement: HTMLElement) => {
	const card = canvasElement.querySelector<HTMLElement>('.chatStage__card')!;
	const cardRadius = getComputedStyle(card).borderTopLeftRadius;
	await expect(cardRadius).toBe('28px');
	const radii = (el: Element) => {
		const cs = getComputedStyle(el);
		return {
			tl: cs.borderTopLeftRadius,
			tr: cs.borderTopRightRadius,
			br: cs.borderBottomRightRadius,
			bl: cs.borderBottomLeftRadius
		};
	};
	const borderWidths = (el: Element) => {
		const cs = getComputedStyle(el);
		return [
			cs.borderTopWidth,
			cs.borderRightWidth,
			cs.borderBottomWidth,
			cs.borderLeftWidth
		];
	};
	for (const [pane, corner] of [
		['stage-main', 'bottom-left'],
		['stage-panel', 'bottom-right']
	] as const) {
		const root = canvasElement.querySelector<HTMLElement>(
			`[data-cy="${pane}"]`
		)!;
		const shell = root.querySelector<HTMLElement>(
			'.textarea__wrapper-send-message'
		)!;
		const field = root.querySelector<HTMLElement>('.textarea__input')!;
		await expect(shell.getAttribute('data-flush-corner')).toBe(corner);
		// The shell: no border, no frame.
		await expect(borderWidths(shell)).toEqual(['0px', '0px', '0px', '0px']);
		const r = radii(shell);
		await expect(r.tl).toBe('0px');
		await expect(r.tr).toBe('0px');
		if (corner === 'bottom-left') {
			await expect(r.bl).toBe(cardRadius);
			await expect(r.br).toBe('0px');
		} else {
			await expect(r.br).toBe(cardRadius);
			await expect(r.bl).toBe('0px');
		}
		// The field: the one bordered box (1 px at rest, 2 px while the
		// composer is selected — the test runner focuses it), corners ≤ 4 px.
		const fieldBorders = borderWidths(field);
		await expect(['1px', '2px']).toContain(fieldBorders[0]);
		await expect(new Set(fieldBorders).size).toBe(1);
		for (const value of Object.values(radii(field))) {
			expect(Number.parseFloat(value)).toBeLessThanOrEqual(4);
		}
		// No other bordered box between the dock and the editor.
		const bordered = Array.from(
			root.querySelectorAll<HTMLElement>('.messageSubmit__wrapper *')
		).filter(
			(el) =>
				el.contains(field) &&
				el !== field &&
				borderWidths(el).some((w) => Number.parseFloat(w) > 0)
		);
		await expect(bordered).toEqual([]);
		// The freed inset went to the field: it fills the shell.
		const shellBox = shell.getBoundingClientRect();
		const fieldBox = field.getBoundingClientRect();
		await expect(Math.round(fieldBox.left - shellBox.left)).toBe(0);
		await expect(Math.round(shellBox.right - fieldBox.right)).toBe(0);
		await expect(Math.round(fieldBox.top - shellBox.top)).toBe(0);
		await expect(Math.round(shellBox.bottom - fieldBox.bottom)).toBe(0);
		// … and the field sits at the pane's 16 px dock, like the bubbles
		// (measured from the pane's inner edge — the joined panel carries
		// the 1 px hairline as its left border).
		const paneBox = root.getBoundingClientRect();
		const paneStyle = getComputedStyle(root);
		const paneInnerLeft =
			paneBox.left + Number.parseFloat(paneStyle.borderLeftWidth);
		const paneInnerRight =
			paneBox.right - Number.parseFloat(paneStyle.borderRightWidth);
		await expect(Math.round(fieldBox.left - paneInnerLeft)).toBe(16);
		await expect(Math.round(paneInnerRight - fieldBox.right)).toBe(16);
		// The drag pill sits on the field's top edge (no frame above it).
		const pill = root
			.querySelector('.dragHandle__pill')!
			.getBoundingClientRect();
		await expect(
			Math.abs((pill.top + pill.bottom) / 2 - fieldBox.top)
		).toBeLessThanOrEqual(1);
	}
};

/**
 * T41: the supervision header is unmistakable — its surface, hairline and
 * channel tag carry the pink accent, the supervision composer's field
 * border too; a thread header stays neutral.
 */
const panelTint = async (canvasElement: HTMLElement) => {
	// The field border is measured at rest — a selected composer wears the
	// 2 px `primary-container` focus border instead (#597).
	(document.activeElement as HTMLElement | null)?.blur();
	await waitFor(() =>
		expect(
			canvasElement.querySelector(
				'.textarea__wrapper-send-message--selected'
			)
		).toBeNull()
	);
	const header = canvasElement.querySelector<HTMLElement>(
		'[data-cy="stage-panel"] .panelHeader'
	)!;
	const cs = getComputedStyle(header);
	return {
		kind: header.getAttribute('data-kind'),
		surface: cs.backgroundColor,
		hairline: getComputedStyle(
			header.querySelector('.panelHeader__divider')!
		).borderTopColor,
		tag: getComputedStyle(header.querySelector('.panelHeader__kindButton')!)
			.backgroundColor,
		composerBorder: getComputedStyle(
			canvasElement.querySelector(
				'[data-cy="stage-panel"] .textarea__input'
			)!
		).borderTopColor,
		composerAccent: canvasElement
			.querySelector(
				'[data-cy="stage-panel"] .textarea__wrapper-send-message'
			)
			?.getAttribute('data-accent')
	};
};

/**
 * The channel card must hang below the header — never over the title —
 * and (T33) open left-aligned with its trigger, the channel tag: card left
 * edge = trigger left edge ± 1 px.
 */
const expectMenuBelowHeader = async (canvasElement: HTMLElement) => {
	const menu = canvasElement.querySelector<HTMLElement>(
		'[data-cy="panel-header-channel-menu"]'
	)!;
	const hairline = canvasElement.querySelector<HTMLElement>(
		'[data-cy="stage-panel"] .panelHeader__divider'
	)!;
	await expect(menu.getBoundingClientRect().top).toBeGreaterThanOrEqual(
		hairline.getBoundingClientRect().bottom - 1
	);
	const trigger = canvasElement.querySelector<HTMLElement>(
		'[data-cy="stage-panel"] [data-cy="panel-header-channel-options"]'
	)!;
	const card = menu.querySelector<HTMLElement>('.channelMenu')!;
	await waitFor(() =>
		expect(
			Math.abs(
				card.getBoundingClientRect().left -
					trigger.getBoundingClientRect().left
			)
		).toBeLessThanOrEqual(1)
	);
};

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
		// D10: the list snaps to the icon rail while the panel is open.
		await expectListSnappedToRail(canvasElement);
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
		// T22: the panel's action bar keeps expand reachable (it scrolls
		// when narrow; with the D10 rail the panel has room at 1280).
		await expectActionBarScrolls(
			canvasElement.querySelector<HTMLElement>(
				'[data-cy="stage-panel"]'
			)!,
			{ overflow: 'either' }
		);
		// T23: desktop bar starts with the arrow-down, nothing reserved.
		await expectDesktopActionBarStart(
			canvasElement.querySelector<HTMLElement>('[data-cy="stage-main"]')!
		);
		// T30: avatars at the 16 px inset, both panes.
		await expectAvatarsAtCardInset(
			canvasElement.querySelector<HTMLElement>('[data-cy="stage-main"]')!
		);
		await expectAvatarsAtCardInset(
			canvasElement.querySelector<HTMLElement>('[data-cy="stage-panel"]')!
		);
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
		// T13/T34: the list handle is centred in the VISIBLE gap between the
		// list cards and the chat card (centre = midpoint of the rightmost
		// list card edge … card.left), and that gap is the Figma 24 px
		// (1320:38278) — no wider, equal on both sides of the handle.
		const listHandle = canvasElement.querySelector<HTMLElement>(
			'[data-cy="stage-list-handle"]'
		)!;
		const listCardsRightNow = () =>
			Math.max(
				...Array.from(
					canvasElement.querySelectorAll('.sessionsListItem')
				).map((item) => item.getBoundingClientRect().right)
			);
		const cardBox = canvasElement
			.querySelector('.chatStage__card')!
			.getBoundingClientRect();
		const listPill = listHandle
			.querySelector('.sessionsList__resizeHandlePill')!
			.getBoundingClientRect();
		// (the list rows enter at scale 0.98 — measure once they settled)
		await waitFor(() =>
			expect(
				Math.abs(
					cardBox.left -
						listCardsRightNow() -
						STAGE_LAYOUT.LIST_CARD_GAP
				)
			).toBeLessThanOrEqual(1)
		);
		const listCardsRight = listCardsRightNow();
		const gapMid = (listCardsRight + cardBox.left) / 2;
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
		// T39: header rows start at the card's top padding (16 + 6).
		await expectHeaderRowsAtCardTop(canvasElement);
		// T40: one bordered box per composer, outer corner = card radius.
		await expectSingleBoxComposers(canvasElement);
		// T41: the supervision header wears the accent; the main chat's
		// own header stays white.
		const supervisionTint = await panelTint(canvasElement);
		await expect(supervisionTint.kind).toBe('supervision');
		const whiteHeader = getComputedStyle(
			canvasElement.querySelector('[data-cy="stage-main"] .sessionInfo')!
		).backgroundColor;
		await expect(supervisionTint.surface).not.toBe(whiteHeader);
		await expect(supervisionTint.composerAccent).toBe('supervision');
		// T35: dual mode — both composers rest at ONE line (toolbar strip +
		// one line + insets, no spare space under the placeholder) and grow
		// while typing; the drag pill stays.
		await expectCompactComposers(canvasElement);
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
		// D6: the composer toolbar's arrow is THE scroll-to-newest control —
		// the old desktop FAB (`session__scrollToBottom`) never renders next
		// to it (B2 drops it in SessionItemComponent, `hideLegacyScrollFab`).
		await expect(
			canvasElement.querySelector('.session__scrollToBottom')
		).toBeNull();
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

/**
 * (c) D10: the snap to the icon rail is the DEFAULT now — (a) and (d)
 * show it at 1280. This story is the comparison: the list column stays
 * expanded next to an open panel (`snapList: false`), which at 1280 AND
 * 1440 leaves the two panes below the 520 px floor (1440 − 420 − 36 =
 * 984 < 2 × 520) — so there is no viewport in the toolbar where the
 * expanded list "fits"; the rule snaps at both.
 */
export const ListExpandedNoSnap: Story = {
	name: '(c) List column NOT snapped while panel open — comparison (D10: snap is the default)',
	globals: desktop1280Globals,
	args: {
		panel: 'supervision',
		panelVariant: 'inside',
		snapList: false,
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
		).toBe('expanded');
		const widths = paneWidths(canvasElement);
		await expect(widths.list).toBeGreaterThan(STAGE_LAYOUT.RAIL_WIDTH);
		// The price of the expanded list: at least one pane below the floor.
		await expect(Math.min(widths.main, widths.panel)).toBeLessThan(
			STAGE_LAYOUT.MIN_PANE_WIDTH
		);
	}
};

/** D10: with a panel open the list column sits in the icon rail by default. */
const expectListSnappedToRail = async (canvasElement: HTMLElement) => {
	await expect(
		canvasElement
			.querySelector('[data-cy="stage-list"]')
			?.getAttribute('data-list-mode')
	).toBe('rail');
	const widths = paneWidths(canvasElement);
	await expect(widths.list).toBeLessThanOrEqual(STAGE_LAYOUT.RAIL_WIDTH + 1);
	await expect(widths.main).toBeGreaterThanOrEqual(
		STAGE_LAYOUT.MIN_PANE_WIDTH
	);
	await expect(widths.panel).toBeGreaterThanOrEqual(
		STAGE_LAYOUT.MIN_PANE_WIDTH
	);
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
		// D10: the list snaps to the icon rail while the panel is open.
		await expectListSnappedToRail(canvasElement);
		// T40: the thread panel's composer is a single box as well.
		await expectSingleBoxComposers(canvasElement);
		// T41: a thread header is neutral — white like the main header.
		const threadTint = await panelTint(canvasElement);
		await expect(threadTint.kind).toBe('thread');
		await expect(threadTint.surface).toBe(
			getComputedStyle(
				canvasElement.querySelector(
					'[data-cy="stage-main"] .sessionInfo'
				)!
			).backgroundColor
		);
		await expect(threadTint.composerAccent).toBe('default');
		// T1: with a panel open the FAB steps back; the panel header's
		// channel icon opens the same options (Thread #2 + Supervision).
		await expect(
			canvasElement.querySelector('[data-cy="channel-switcher-fab"]')
		).toBeNull();
		const options = canvasElement.querySelector<HTMLButtonElement>(
			'[data-cy="panel-header-channel-options"]'
		)!;
		await expect(options).toHaveAttribute('aria-haspopup', 'menu');
		// T19: the word visibly opens a menu — chevron present, turns open.
		const chevron = options.querySelector<HTMLElement>(
			'[data-cy="panel-header-kind-chevron"]'
		)!;
		await expect(chevron).not.toBeNull();
		await userEvent.click(options);
		await expect(options).toHaveAttribute('aria-expanded', 'true');
		const menu = await canvas.findByRole('menu');
		const items = within(menu).getAllByRole('menuitem');
		// T20/T27/T29: the card is the app's menu organism — eyebrow and
		// title describe the function; supervision first (⇧S), then the
		// threads by their latest message, the shown one current. Review v6:
		// the NUMBER follows the root message — the newer thread ranks
		// first but is "Thread #2"; the original stays "Thread #1" / ⇧1.
		await expect(
			canvasElement.querySelector(
				'.channelMenu .chatMenuDropdown__subtitle'
			)?.textContent
		).toBe('Weitere Gespräche');
		await expect(
			canvasElement.querySelector('.channelMenu .chatMenuDropdown__title')
				?.textContent
		).toBe('Threads und Supervision');
		await expect(items).toHaveLength(3);
		await expect(items[0]).toHaveAttribute(
			'data-channel-id',
			'supervision'
		);
		await expect(items[0].textContent).toContain('Supervisionschat');
		await expect(items[0].textContent).toContain('⇧S');
		await expect(items[1]).toHaveAttribute('data-channel-id', '$thread-2');
		await expect(items[1].textContent).toContain('Thread #2');
		await expect(items[1].textContent).toContain('⇧2');
		await expect(items[2]).toHaveAttribute(
			'data-channel-id',
			THREAD_ROOT_ID
		);
		await expect(items[2].textContent).toContain('Thread #1');
		await expect(items[2].textContent).toContain('⇧1');
		await expect(items[2]).toHaveAttribute('aria-current', 'true');
		// T28: each row's "Author: last message…" runs two lines (the
		// organism's 17 px description line), then the ellipsis.
		const previews = items.map(
			(item) =>
				item.querySelector('[data-cy="channel-menu-preview"]')
					?.textContent ?? ''
		);
		await expect(previews[0]).toContain(`${COUNSELLOR_NAME}:`);
		await expect(previews[2]).toContain(`${CLIENT_NAME}:`);
		items.forEach((item) => {
			const preview = item.querySelector<HTMLElement>(
				'[data-cy="channel-menu-preview"]'
			)!;
			const style = getComputedStyle(preview);
			expect(style.webkitLineClamp).toBe('2');
			expect(preview.getBoundingClientRect().height).toBeLessThanOrEqual(
				2 * parseFloat(style.lineHeight) + 1
			);
			expect(preview.scrollHeight).toBeGreaterThan(preview.clientHeight);
		});
		await expectMenuBelowHeader(canvasElement);
		await userEvent.keyboard('{Escape}');
		await waitFor(() =>
			expect(canvasElement.querySelector('[role="menu"]')).toBeNull()
		);
		await expect(options).toHaveAttribute('aria-expanded', 'false');
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
		// T26: the channel line names the shown thread with its card number.
		await expect(panelTitle(canvasElement).kind).toBe('Thread #1');
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
		).toEqual(['supervision', '$thread-2', THREAD_ROOT_ID]);
		await expect(items[2]).toHaveAttribute('aria-current', 'true');
		await expect(items[0].textContent).toContain('2');
		await userEvent.keyboard('{Escape}');
		const threadTint = await panelTint(canvasElement);
		// → supervision
		await pickChannelFromHeader(canvasElement, 'supervision');
		await waitFor(() =>
			expect(panelTitle(canvasElement).kind).toBe('Supervision')
		);
		await expect(panelTitle(canvasElement).name).toBe(SUPERVISOR_NAME);
		// T41: supervision header ≠ thread header — surface, hairline, tag
		// and the composer's field border all change with the channel.
		const supervisionTint = await panelTint(canvasElement);
		await expect(threadTint.kind).toBe('thread');
		await expect(supervisionTint.kind).toBe('supervision');
		await expect(supervisionTint.surface).not.toBe(threadTint.surface);
		await expect(supervisionTint.hairline).not.toBe(threadTint.hairline);
		await expect(supervisionTint.tag).not.toBe(threadTint.tag);
		await expect(supervisionTint.composerBorder).not.toBe(
			threadTint.composerBorder
		);
		const root = getComputedStyle(document.documentElement);
		const toRgb = (hex: string) => {
			const n = parseInt(hex.replace('#', ''), 16);
			return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
		};
		const fixedDim = toRgb(
			root.getPropertyValue('--m3-primary-fixed-dim').trim()
		);
		await expect(supervisionTint.hairline).toBe(fixedDim);
		await expect(supervisionTint.tag).toBe(fixedDim);
		await expect(supervisionTint.composerBorder).toBe(fixedDim);
		await expect(threadTint.hairline).toBe(
			toRgb(root.getPropertyValue('--m3-primary-fixed').trim())
		);
		await expect(threadTint.tag).toBe(
			toRgb(root.getPropertyValue('--m3-surface-container-high').trim())
		);
		await expect(
			canvasElement.querySelector('[data-cy="stage-panel"]')
				?.textContent ?? ''
		).not.toContain(CLIENT_NAME);
		// → back to the thread
		await pickChannelFromHeader(canvasElement, THREAD_ROOT_ID);
		await waitFor(() =>
			expect(panelTitle(canvasElement).kind).toBe('Thread #1')
		);
		await expect(panelTitle(canvasElement).name).toBe(CLIENT_NAME);
		// The FAB stays hidden throughout — the header is the switcher.
		await expect(
			canvasElement.querySelector('[data-cy="channel-switcher-fab"]')
		).toBeNull();
	}
};

/**
 * (d3) T20 keyboard: the card opens with focus on the current row; arrows,
 * Home and End move it; Escape closes and returns focus to the channel
 * button; ⇧S jumps to the supervision chat, ⇧1 back to the original
 * thread (its number is fixed by its root message, review v6).
 */
export const PanelChannelCardKeyboardAndShortcuts: Story = {
	name: '(d3) Panel channel card — keyboard, shortcuts, below the header (T19/T20)',
	globals: desktop1280Globals,
	args: {
		panel: 'thread',
		panelVariant: 'inside',
		openThreads: 2,
		supervisionUnread: 1
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expectStageParts(canvasElement, {
			composers: 2,
			bubblesAtLeast: 9
		});
		const options = canvasElement.querySelector<HTMLButtonElement>(
			'[data-cy="panel-header-channel-options"]'
		)!;
		await userEvent.click(options);
		const items = within(await canvas.findByRole('menu')).getAllByRole(
			'menuitem'
		);
		// Focus lands on the current row (the shown thread, third row).
		await waitFor(() => expect(document.activeElement).toBe(items[2]));
		await userEvent.keyboard('{ArrowDown}');
		await expect(document.activeElement).toBe(items[0]);
		await userEvent.keyboard('{ArrowUp}');
		await expect(document.activeElement).toBe(items[2]);
		await userEvent.keyboard('{Home}');
		await expect(document.activeElement).toBe(items[0]);
		await userEvent.keyboard('{End}');
		await expect(document.activeElement).toBe(items[2]);
		await expectMenuBelowHeader(canvasElement);
		// Escape: closed, focus back on the channel button.
		await userEvent.keyboard('{Escape}');
		await waitFor(() =>
			expect(canvasElement.querySelector('[role="menu"]')).toBeNull()
		);
		await expect(document.activeElement).toBe(options);
		// ⇧S → supervision.
		await userEvent.click(options);
		await canvas.findByRole('menu');
		await userEvent.keyboard('{Shift>}S{/Shift}');
		await waitFor(() =>
			expect(panelTitle(canvasElement).kind).toBe('Supervision')
		);
		await expect(panelTitle(canvasElement).name).toBe(SUPERVISOR_NAME);
		// ⇧1 → the original thread (third row, but "Thread #1").
		await userEvent.click(
			canvasElement.querySelector<HTMLButtonElement>(
				'[data-cy="panel-header-channel-options"]'
			)!
		);
		await canvas.findByRole('menu');
		await userEvent.keyboard('{Shift>}1{/Shift}');
		await waitFor(() =>
			expect(panelTitle(canvasElement).kind).toBe('Thread #1')
		);
		await expect(panelTitle(canvasElement).name).toBe(CLIENT_NAME);
	}
};

/**
 * (d6) T27: the channel card IS the app's menu organism ("Chatraum
 * Einstellungen"): the same rows, the same hover — the pale blue
 * surface (D3: Figma "Hellblau" #e7effc via `--oriso-menu-hover-surface`)
 * with the label and icon in `primary`, never the pink — on a card with
 * a hint of `primary-fixed`. T29/D4: eyebrow "Weitere Gespräche" and
 * title say what the card does. T36: no switch on the supervision row.
 */
export const PanelChannelCardOrganismHover: Story = {
	name: '(d6) Panel channel card — organism rows, hover tint (T27/T29; T36: no switch)',
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
		await userEvent.click(
			canvasElement.querySelector<HTMLButtonElement>(
				'[data-cy="panel-header-channel-options"]'
			)!
		);
		const menu = await canvas.findByRole('menu');
		const card = canvasElement.querySelector<HTMLElement>('.channelMenu')!;
		// The organism: card, header, divider, rows.
		await expect(card.classList.contains('chatMenuDropdown')).toBe(true);
		await expect(
			card.querySelector('.chatMenuDropdown__subtitle')?.textContent
		).toBe('Weitere Gespräche');
		await expect(
			card.querySelector('.chatMenuDropdown__title')?.textContent
		).toBe('Threads und Supervision');
		await expect(
			card.querySelector('.chatMenuDropdown__divider')
		).not.toBeNull();
		const items = within(menu).getAllByRole('menuitem');
		items.forEach((item) => {
			expect(item.classList.contains('chatMenuDropdown__item')).toBe(
				true
			);
			expect(
				item.querySelector('.chatMenuDropdown__itemIcon')
			).not.toBeNull();
			expect(
				item.querySelector('.chatMenuDropdown__itemTitle')
			).not.toBeNull();
			expect(
				item.querySelector('.chatMenuDropdown__itemShortcut')
			).not.toBeNull();
			expect(
				item.querySelector('.chatMenuDropdown__itemDescription')
			).not.toBeNull();
		});
		// Hover / selected = D3 "Hellblau" surface (#e7effc, the alias
		// `--oriso-menu-hover-surface`), primary label + icon.
		const root = getComputedStyle(document.documentElement);
		const secondaryFixed = root
			.getPropertyValue('--oriso-menu-hover-surface')
			.trim();
		await expect(secondaryFixed.toLowerCase()).toBe('#e7effc');
		const primary = root.getPropertyValue('--m3-primary').trim();
		const primaryFixed = root.getPropertyValue('--m3-primary-fixed').trim();
		const toRgb = (hex: string) => {
			const n = parseInt(hex.replace('#', ''), 16);
			return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
		};
		await expect(secondaryFixed).toMatch(/^#/);
		const selected = items.find(
			(item) => item.getAttribute('aria-current') === 'true'
		)!;
		// (the organism fades its surface in over 150 ms — wait for it)
		await waitFor(() =>
			expect(getComputedStyle(selected).backgroundColor).toBe(
				toRgb(secondaryFixed)
			)
		);
		await waitFor(() =>
			expect(
				getComputedStyle(
					selected.querySelector('.chatMenuDropdown__itemTitle')!
				).color
			).toBe(toRgb(primary))
		);
		// Hover and keyboard focus share one rule in the organism; a
		// synthetic hover cannot switch CSS `:hover`, so the keyboard walks
		// onto a row (focus-visible) and the `:hover` selector is checked in
		// the stylesheet itself.
		const hovered = items[1];
		await expect(getComputedStyle(hovered).backgroundColor).not.toBe(
			toRgb(secondaryFixed)
		);
		await userEvent.keyboard('{ArrowUp}');
		await waitFor(() => expect(document.activeElement).toBe(hovered));
		await waitFor(() =>
			expect(getComputedStyle(hovered).backgroundColor).toBe(
				toRgb(secondaryFixed)
			)
		);
		await waitFor(() =>
			expect(
				getComputedStyle(
					hovered.querySelector('.chatMenuDropdown__itemIcon')!
				).color
			).toBe(toRgb(primary))
		);
		// Never the pink on a row.
		await expect(getComputedStyle(hovered).backgroundColor).not.toBe(
			toRgb(primaryFixed)
		);
		const hoverRule = Array.from(document.styleSheets)
			.flatMap((sheet) => {
				try {
					return Array.from(sheet.cssRules) as CSSStyleRule[];
				} catch {
					return [];
				}
			})
			.find(
				(rule) =>
					rule.selectorText?.includes(
						'.chatMenuDropdown__item:hover'
					) && rule.style?.backgroundColor
			);
		await expect(hoverRule?.style.backgroundColor).toContain(
			'--oriso-menu-hover-surface'
		);
		await userEvent.keyboard('{ArrowDown}');
		// T36: the supervision row is a plain menu row — no switch, nothing
		// but `menuitem`s inside `role="menu"` (review v8 structural finding).
		const supervisionRow = items[0];
		await expect(supervisionRow).toHaveAttribute(
			'data-channel-id',
			'supervision'
		);
		await expect(
			card.querySelector('[role="switch"], input[type="checkbox"]')
		).toBeNull();
		for (const child of Array.from(menu.children)) {
			expect(child.getAttribute('role')).toBe('none');
			expect(child.children.length).toBe(1);
			expect(child.firstElementChild?.getAttribute('role')).toBe(
				'menuitem'
			);
		}
		await expect(supervisionRow).not.toHaveAttribute('aria-disabled');
		await userEvent.click(supervisionRow);
		await waitFor(() =>
			expect(panelTitle(canvasElement).kind).toBe('Supervision')
		);
	}
};

/**
 * (d4) Review v6: on the desktop the FAB disappears the moment a pick
 * opens the panel — focus must not fall to <body>: the panel header's
 * channel button takes it.
 */
export const FabPickHandsFocusToThePanelHeader: Story = {
	name: '(d4) Desktop — a pick from the FAB opens the panel and hands focus to its channel button (review v6)',
	globals: desktop1280Globals,
	args: {
		panel: null,
		panelVariant: 'inside',
		openThreads: 2,
		supervisionUnread: 1
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expectStageParts(canvasElement, {
			composers: 1,
			bubblesAtLeast: 6
		});
		const fab = canvasElement.querySelector<HTMLButtonElement>(
			'[data-cy="channel-switcher-fab"]'
		)!;
		await expect(fab).not.toBeNull();
		await userEvent.click(fab);
		const items = within(await canvas.findByRole('menu')).getAllByRole(
			'menuitem'
		);
		await userEvent.click(
			items.find(
				(item) => item.getAttribute('data-channel-id') === 'supervision'
			)!
		);
		await waitFor(() =>
			expect(panelTitle(canvasElement).kind).toBe('Supervision')
		);
		// The FAB is gone (the header is the switcher now) …
		await expect(
			canvasElement.querySelector('[data-cy="channel-switcher-fab"]')
		).toBeNull();
		// … and focus sits on the header's channel button, not on <body>.
		await waitFor(() =>
			expect(document.activeElement).toBe(
				canvasElement.querySelector(
					'[data-cy="panel-header-channel-options"]'
				)
			)
		);
		// From there the keyboard carries on: the card opens on Enter.
		await userEvent.keyboard('{Enter}');
		await canvas.findByRole('menu');
	}
};

/**
 * (d5) Review v6: six open threads — the header card ends above the
 * panel's composer (never behind it) and its list scrolls inside; End
 * reaches the last row.
 */
export const PanelChannelCardSixThreadsScrolls: Story = {
	name: '(d5) Panel channel card — six threads: ends above the composer, scrolls inside (review v6)',
	globals: desktop1280Globals,
	args: {
		panel: 'thread',
		panelVariant: 'inside',
		openThreads: 6,
		supervisionUnread: 1
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expectStageParts(canvasElement, {
			composers: 2,
			bubblesAtLeast: 9
		});
		await userEvent.click(
			canvasElement.querySelector<HTMLButtonElement>(
				'[data-cy="panel-header-channel-options"]'
			)!
		);
		const menu = await canvas.findByRole('menu');
		const items = within(menu).getAllByRole('menuitem');
		await expect(items).toHaveLength(7);
		// Stable numbers: the original thread is #1 wherever recency puts it.
		await expect(
			items.find(
				(item) =>
					item.getAttribute('data-channel-id') === THREAD_ROOT_ID
			)?.textContent
		).toContain('Thread #1');
		const composer = canvasElement.querySelector<HTMLElement>(
			'[data-cy="stage-panel"] .textarea__wrapper-send-message'
		)!;
		const list =
			canvasElement.querySelector<HTMLElement>('.channelMenu__list')!;
		// The panel's composer keeps settling (TipTap) for a while after the
		// card opened; the card follows it (ResizeObserver) — give it time.
		await waitFor(
			() => {
				const card = canvasElement
					.querySelector<HTMLElement>('.channelMenu')!
					.getBoundingClientRect();
				expect(card.bottom).toBeLessThanOrEqual(
					composer.getBoundingClientRect().top
				);
				expect(list.scrollHeight).toBeGreaterThan(list.clientHeight);
			},
			{ timeout: 4000 }
		);
		await expectMenuBelowHeader(canvasElement);
		// End reaches the last row and it stays whole — also after the card
		// re-clamps while the composer settles.
		await userEvent.keyboard('{End}');
		await waitFor(
			() => {
				const last = items[6].getBoundingClientRect();
				expect(document.activeElement).toBe(items[6]);
				expect(last.bottom).toBeLessThanOrEqual(
					list.getBoundingClientRect().bottom + 1
				);
			},
			{ timeout: 4000 }
		);
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
		// → the secondary view with the supervision room (D7: no header
		// back arrow — the composer's arrow is the one back control).
		await waitFor(() =>
			expect(
				canvasElement.querySelector('[data-cy="stage-panel"]')
			).not.toBeNull()
		);
		await expect(
			canvasElement.querySelector('[data-cy="panel-header-back"]')
		).toBeNull();
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
		).toEqual(['supervision', '$thread-2', THREAD_ROOT_ID]);
		await expect(headerItems[0]).toHaveAttribute('aria-current', 'true');
		// … and switches on selection.
		await userEvent.click(headerItems[2]);
		await waitFor(() =>
			expect(panelTitle(canvasElement).kind).toBe('Thread #1')
		);
		await expect(
			canvasElement.querySelector('[data-cy="stage-panel"]')
		).not.toBeNull();
		// The phone FAB still leads back to the main chat.
		await expect(
			canvasElement
				.querySelector('[data-cy="channel-switcher-fab"]')
				?.getAttribute('aria-label')
		).toMatch(/Beratungschat|counselling|Nebenkanäle|side channels/i);
	}
};

/**
 * D7/D8 (phone): exactly ONE back control on the screen — the composer's
 * arrow, no header arrow — and no inline call buttons in the header row:
 * they are rows of the kebab menu, and the title keeps ≥ 40 % of the row.
 */
const expectPhoneHeaderRules = async (
	canvasElement: HTMLElement,
	{ header }: { header: 'main' | 'panel' }
) => {
	await expect(
		canvasElement.querySelectorAll('[data-cy="composer-back"]').length
	).toBe(1);
	await expect(
		canvasElement.querySelector('.sessionInfo__backButton')
	).toBeNull();
	await expect(
		canvasElement.querySelector('[data-cy="panel-header-back"]')
	).toBeNull();
	// Every "back" navigation control on screen, by accessible name —
	// the phone FAB ("Zurück zum Beratungschat") is the channel switcher
	// (T15), the toolbar's "Zurück zu allen Werkzeugen" a formatting
	// sub-menu; neither is a screen back control.
	const backControls = Array.from(
		canvasElement.querySelectorAll<HTMLElement>('a, button')
	).filter(
		(el) =>
			/^(zurück|back)$/i.test(
				(el.getAttribute('aria-label') ?? '').trim()
			) ||
			el.matches(
				'.sessionInfo__backButton, [data-cy="panel-header-back"]'
			)
	);
	await expect(backControls.length).toBe(1);
	await expect(backControls[0].getAttribute('data-cy')).toBe('composer-back');
	if (header === 'main') {
		await expect(
			canvasElement.querySelector('.sessionMenu__videoCallButtons')
		).toBeNull();
		const row = canvasElement.querySelector<HTMLElement>(
			'.sessionInfo__headerWrapper'
		)!;
		const title = canvasElement.querySelector<HTMLElement>(
			'.sessionInfo__username'
		)!;
		await expect(
			title.getBoundingClientRect().width /
				row.getBoundingClientRect().width
		).toBeGreaterThanOrEqual(0.4);
		// The calls live in the kebab menu (D8) — open it and look.
		const kebab = canvasElement.querySelector<HTMLButtonElement>(
			'.sessionMenu__icon--mobile'
		)!;
		await userEvent.click(kebab);
		await waitFor(() =>
			expect(
				canvasElement.querySelector('.sessionMenu__content--open')
			).not.toBeNull()
		);
		const flyout = canvasElement.querySelector<HTMLElement>(
			'.sessionMenu__content--open'
		)!;
		await expect(
			flyout.querySelector('[data-cy="session-menu-start-video-call"]')
		).not.toBeNull();
		await expect(
			flyout.querySelector('[data-cy="session-menu-start-call"]')
		).not.toBeNull();
		// (the organism keeps its rows mounted; "closed" = the open class gone)
		await userEvent.click(kebab);
		await waitFor(() =>
			expect(
				canvasElement.querySelector('.sessionMenu__content--open')
			).toBeNull()
		);
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
		// D7/D8: one back control (composer), calls in the kebab menu.
		await expectPhoneHeaderRules(canvasElement, { header: 'main' });
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
		// One line: ~100 px (composerResize MIN_HEIGHT_MOBILE + the rendered
		// line's rounding), a far cry from the old 180 px block.
		await expect(oneLine).toBeGreaterThanOrEqual(98);
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
		// T23: a real arrow-down glyph, not a chevron.
		await expect(
			barButtons[1].querySelector('[data-testid="ArrowDownwardIcon"]')
		).not.toBeNull();
		// T22: at 390 the bar scrolls; expand never hides under send.
		await expectActionBarScrolls(
			canvasElement.querySelector<HTMLElement>('[data-cy="stage-main"]')!
		);
		const dragHandle = canvasElement.querySelector<HTMLElement>(
			'[data-cy="stage-main"] .dragHandle'
		)!;
		await expect(dragHandle).not.toBeNull();
		// T31: the phone composer card — 4 px bottom corners, the first icon
		// close to the left edge, the drag pill centred ON the card's top
		// edge (`position="edge"`, the stage-v4 placement; assumption noted).
		const card = canvasElement.querySelector<HTMLElement>(
			'[data-cy="stage-main"] .textarea__input'
		)!;
		await expect(getComputedStyle(card).borderRadius).toBe(
			'0px 0px 4px 4px'
		);
		await expect(
			barButtons[0].getBoundingClientRect().left -
				card.getBoundingClientRect().left
		).toBeLessThanOrEqual(8);
		await expect(dragHandle.classList.contains('dragHandle--edge')).toBe(
			true
		);
		const pillBox = dragHandle
			.querySelector('.dragHandle__pill')!
			.getBoundingClientRect();
		await expect(
			Math.abs(
				(pillBox.top + pillBox.bottom) / 2 -
					card.getBoundingClientRect().top
			)
		).toBeLessThanOrEqual(1);
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
		const phoneLine = Number.parseFloat(
			getComputedStyle(editor.firstElementChild || editor).lineHeight
		);
		await userEvent.keyboard(
			'Zeile eins{Shift>}{Enter}{/Shift}Zeile zwei{Shift>}{Enter}{/Shift}Zeile drei'
		);
		// Two more lines (D1: measured line height, 2 px rounding).
		await waitFor(() =>
			expect(shell.getBoundingClientRect().height).toBeGreaterThanOrEqual(
				oneLine + 2 * phoneLine - 2
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
			canvasElement.querySelector('[data-cy="stage-panel"]')
		).not.toBeNull();
		const fab = canvasElement.querySelector<HTMLButtonElement>(
			'[data-cy="channel-switcher-fab"]'
		)!;
		await expect(fab.getAttribute('aria-label')).toMatch(
			/Beratungschat|counselling/i
		);
		// D7: the composer's arrow is the only back control — the panel
		// header renders none.
		await expectPhoneHeaderRules(canvasElement, { header: 'panel' });
	}
};

/**
 * (h) T37 → D1: chat text size. Compact is the DEFAULT now (Frank, 05.09.
 * evening): message body 14/20 (M3 body/medium), list preview 12
 * (label/medium), sender name line 14/20 and thread entry 14/20
 * (label/large), composer text + placeholder 14. One switch: the custom
 * properties in `mui-variables-mapping.scss`; the stage's
 * `.chatStage--legacyText` keeps the old 16/21 for the comparison (h1).
 */
const expectChatTextSize = async (
	canvasElement: HTMLElement,
	{
		fontSize,
		lineHeight,
		preview,
		name,
		threadEntry,
		composer
	}: {
		fontSize: string;
		lineHeight: string;
		preview: string;
		name: string;
		threadEntry: string;
		composer: string;
	}
) => {
	await expectStageParts(canvasElement, {
		composers: 2,
		bubblesAtLeast: 9
	});
	const bubbles = Array.from(
		canvasElement.querySelectorAll<HTMLElement>('.messageItem__message')
	);
	await expect(bubbles.length).toBeGreaterThan(0);
	for (const bubble of bubbles) {
		const style = getComputedStyle(bubble);
		expect(style.fontSize).toBe(fontSize);
		expect(style.lineHeight).toBe(lineHeight);
	}
	// Preview line of every list row — in the icon rail the rows carry no
	// preview, so the assertion holds for whatever is rendered.
	for (const line of Array.from(
		canvasElement.querySelectorAll<HTMLElement>(
			'.sessionsListItem__subject'
		)
	)) {
		expect(getComputedStyle(line).fontSize).toBe(preview);
	}
	// Sender name line ("Mona S.").
	const names = Array.from(
		canvasElement.querySelectorAll<HTMLElement>('.messageItem__username')
	);
	await expect(names.length).toBeGreaterThan(0);
	for (const line of names) {
		expect(getComputedStyle(line).fontSize).toBe(name);
	}
	// Thread entry under the root message ("2 Antworten · …").
	const entry = canvasElement.querySelector<HTMLElement>(
		'[data-cy="thread-entry"]'
	)!;
	await expect(entry).not.toBeNull();
	await expect(getComputedStyle(entry).fontSize).toBe(threadEntry);
	// Composer text and its placeholder (the placeholder is a ::before of
	// the empty paragraph and inherits the editor's size).
	const editors = Array.from(
		canvasElement.querySelectorAll<HTMLElement>('.ProseMirror')
	);
	await expect(editors.length).toBe(2);
	for (const editor of editors) {
		expect(getComputedStyle(editor).fontSize).toBe(composer);
		const empty = editor.querySelector('p.is-editor-empty');
		if (empty) {
			expect(getComputedStyle(empty, '::before').fontSize).toBe(composer);
		}
	}
};

export const ChatTextSizeLegacy: Story = {
	name: '(h1) Chat text size — legacy 16/21 (preview 14, name 12, composer 16) for comparison',
	globals: desktop1280Globals,
	args: {
		panel: 'supervision',
		panelVariant: 'inside',
		supervisionUnread: 0,
		openThreads: 1,
		textSize: 'legacy'
	},
	play: async ({ canvasElement }) => {
		await expectChatTextSize(canvasElement, {
			fontSize: '16px',
			lineHeight: '21px',
			preview: '14px',
			name: '12px',
			threadEntry: '12px',
			composer: '16px'
		});
		await expect(
			canvasElement.querySelector('.chatStage--legacyText')
		).not.toBeNull();
	}
};

export const ChatTextSizeCompact: Story = {
	name: '(h2) Chat text size — compact 14/20 (preview 12, name 14, thread entry 14, composer 14) = DEFAULT',
	globals: desktop1280Globals,
	args: {
		panel: 'supervision',
		panelVariant: 'inside',
		supervisionUnread: 0,
		openThreads: 1
	},
	play: async ({ canvasElement }) => {
		await expectChatTextSize(canvasElement, {
			fontSize: '14px',
			lineHeight: '20px',
			preview: '12px',
			name: '14px',
			threadEntry: '14px',
			composer: '14px'
		});
		// The default needs no modifier class — nothing on the stage root.
		await expect(
			canvasElement.querySelector('.chatStage--legacyText')
		).toBeNull();
		await expect(
			canvasElement.querySelector('.chatStage--compactText')
		).toBeNull();
		// D1 lives in the global token file, not in a component stylesheet.
		const root = getComputedStyle(document.documentElement);
		await expect(root.getPropertyValue('--message-font-size').trim()).toBe(
			'14px'
		);
		await expect(
			root.getPropertyValue('--session-preview-font-size').trim()
		).toBe('12px');
	}
};
