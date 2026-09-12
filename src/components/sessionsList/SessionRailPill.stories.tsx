import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { SessionRailPill, type SessionRailTooltips } from './SessionRailPill';
import {
	getSessionRailMarks,
	type SessionRailMark,
	type SessionRailMarkLabels
} from './sessionRailState';
import { STAGE_LAYOUT } from '../chatStage/stageLayout';
import { UserAvatar } from '../message/UserAvatar';
import { phone390Globals } from '../message/messageStoryShell';
import './sessionsList.styles.scss';
import './sessionRailPill.styles.scss';

const APP_ORISO_CHAT_FIGMA_URL =
	'https://www.figma.com/design/L2mOFNSGdxPPx1XA4HFAog/App.Oriso?node-id=316-17725&t=XHH5HQNmA8DUWl2U-0';

/**
 * Copy map instead of i18n keys.
 *
 * The catalogue guard (`src/i18n.test.ts`) runs at drift budget 0 for fr / ru /
 * ti / tr, so a new key would have to be translated five times in this change.
 * The pill therefore takes its labels as props, and BOTH the story and the app
 * feed it strings that already exist in `de/common.json`:
 *
 *   thread      `chatStage.switcher.kind.thread`        "Thread"
 *   supervision `sessionList.toolbar.chips.supervision` "Supervision"
 *   mail        `sessionList.toolbar.chips.nearby`      "Mail"
 *   unread      `sessionList.toolbar.chips.unread`      "Ungelesen"
 */
const RAIL_MARK_COPY: SessionRailMarkLabels = {
	thread: 'Thread',
	supervision: 'Supervision',
	mail: 'Mail',
	unread: 'Ungelesen'
};

const avatarFor = (userId: string, name: string) => (
	<UserAvatar
		userId={userId}
		username={userId}
		displayName={name}
		size="32px"
		ring={false}
	/>
);

function Pill({
	name = 'sonnenblume_47',
	userId = 'sb-rail-1',
	marks = [],
	active = false,
	tooltips,
	unreadCount
}: {
	name?: string;
	userId?: string;
	marks?: readonly SessionRailMark[];
	active?: boolean;
	tooltips?: SessionRailTooltips;
	unreadCount?: number;
}) {
	return (
		<SessionRailPill
			name={name}
			avatar={avatarFor(userId, name)}
			marks={marks}
			markLabels={RAIL_MARK_COPY}
			active={active}
			tooltips={tooltips}
			unreadCount={unreadCount}
		/>
	);
}

/**
 * The rail as the app builds it: the production `sessionsList__wrapper`
 * column pinned to `STAGE_LAYOUT.RAIL_WIDTH` (80 px) with the `--iconOnly`
 * modifier, the real scroll container inside it, and the pills stacked in
 * `.sessionRailList`.
 */
function RailColumn({ children }: { children: React.ReactNode }) {
	return (
		<div style={{ display: 'flex', height: 420 }}>
			<div
				className="sessionsList__wrapper sessionsList__wrapper--iconOnly"
				style={{
					flex: '0 0 auto',
					width: STAGE_LAYOUT.RAIL_WIDTH,
					position: 'relative',
					background: 'var(--m3-surface, #fcf9f9)'
				}}
				data-cy="rail-column"
			>
				<div className="sessionsList__scrollArea">
					<div className="sessionsList__scrollContainer sessionsList__scrollContainer--hasToolbar">
						<ul className="sessionRailList" data-cy="rail-list">
							{React.Children.map(children, (child) => (
								<li>{child}</li>
							))}
						</ul>
					</div>
				</div>
			</div>
			<div
				style={{
					flex: 1,
					margin: `0 ${STAGE_LAYOUT.CARD_MARGIN}px`,
					background: 'var(--m3-surface-container-lowest, #ffffff)',
					borderRadius: 16,
					display: 'grid',
					placeItems: 'center',
					font: '13px system-ui',
					color: 'var(--m3-on-surface-variant, #444748)'
				}}
			>
				Chat + Seitenbereich offen
			</div>
		</div>
	);
}

const MIXED_ROWS = [
	{
		userId: 'sb-rail-1',
		name: 'sonnenblume_47',
		marks: getSessionRailMarks({ modality: 'AGENCY_COUNSELLING' })
	},
	{
		userId: 'sb-rail-2',
		name: 'stiller_fuchs_ali',
		marks: getSessionRailMarks({
			modality: 'AGENCY_COUNSELLING',
			previewChannel: 'thread',
			unread: true
		}),
		unreadCount: 3
	},
	{
		userId: 'sb-rail-3',
		name: 'baer_mika_343',
		marks: getSessionRailMarks({ supervisionState: 'supervisedByMe' })
	},
	{
		userId: 'sb-rail-4',
		name: 'leise_eule_jana',
		marks: getSessionRailMarks({})
	},
	{
		userId: 'sb-rail-5',
		name: 'wache_katze_tom',
		marks: getSessionRailMarks({
			modality: 'AGENCY_COUNSELLING',
			previewChannel: 'thread',
			supervisionState: 'supervisedByOthers',
			unread: true
		}),
		unreadCount: 12
	}
] as const;

function MixedRail() {
	return (
		<RailColumn>
			{MIXED_ROWS.map((row, index) => (
				<SessionRailPill
					key={row.userId}
					name={row.name}
					avatar={avatarFor(row.userId, row.name)}
					marks={row.marks}
					markLabels={RAIL_MARK_COPY}
					unreadCount={
						'unreadCount' in row ? row.unreadCount : undefined
					}
					active={index === 1}
					data-cy={`rail-pill-${index}`}
				/>
			))}
		</RailColumn>
	);
}

const meta: Meta<typeof SessionRailPill> = {
	title: 'Components/Session/List/Session rail pill',
	component: SessionRailPill,
	parameters: {
		layout: 'centered',
		backgrounds: { default: 'gray' },
		design: [
			{
				type: 'figma',
				name: 'App.Oriso consultant chat',
				url: APP_ORISO_CHAT_FIGMA_URL
			}
		],
		docs: {
			description: {
				component:
					'One row of the **collapsed 80 px session list** (the rail that appears while a side pane is open, ' +
					'`STAGE_LAYOUT.RAIL_WIDTH`). Frank, 09.09.2026: the rail circles are "bisschen eiförmig" and carry no ' +
					'information beyond the picture — so the circle becomes a **portrait pill**: avatar on top, up to four ' +
					"state marks underneath (thread, supervision, mail, unread), and the list's 24 px rhythm kept.\n\n" +
					'**Why it was an egg:** `sessionsList.styles.scss` painted `border-radius: 50%` on a box it never made ' +
					'square (measured 48 × 50 px), so the radii were 24 × 25 px. The pill states its radius in px, and the ' +
					'`play` functions below measure the box, so the shape cannot drift back.\n\n' +
					'**Sources:** every mark renders one existing list signal — see `sessionRailState.ts`. Labels are ' +
					'injected (copy map), never looked up here: the i18n catalogue guard runs at drift budget 0.'
			}
		}
	}
};

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Measures the pill and proves it is a stadium, not an ellipse.
 *
 * The height is deliberately NOT pinned to a number any more (round 1 pinned
 * 80): Frank asked the pill to grow downward with its marks instead of
 * packing them, so a fixed height here would be the very rule that produced
 * the squeeze. What stays fixed is the width and the px radius — the two
 * things the egg came from.
 */
const expectPillGeometry = async (pill: HTMLElement) => {
	const box = pill.getBoundingClientRect();
	await expect(Math.round(box.width)).toBe(48);
	// Never narrower than a circle, never wider than its own width.
	await expect(Math.round(box.height)).toBeGreaterThanOrEqual(48);
	const radius = getComputedStyle(pill).borderTopLeftRadius;
	// A `%` radius is what turned the old circle into an egg: it follows the
	// box. A px radius of exactly half the width is a stadium at any height.
	await expect(radius.endsWith('px')).toBe(true);
	await expect(Math.round(parseFloat(radius))).toBe(24);
	// The avatar inside stays a true circle: equal sides, so its own 50 %
	// radius cannot produce an ellipse either.
	const avatar = pill.querySelector<HTMLElement>('.sessionRailPill__avatar')!;
	const avatarBox = avatar.getBoundingClientRect();
	await expect(Math.round(avatarBox.width)).toBe(
		Math.round(avatarBox.height)
	);
};

/** Asserts exactly which marks the pill shows — and which it does not. */
const expectMarks = async (
	canvasElement: HTMLElement,
	expected: SessionRailMark[]
) => {
	const canvas = within(canvasElement);
	const shown = Array.from(
		canvasElement.querySelectorAll<HTMLElement>('.sessionRailPill__mark')
	).map((mark) => mark.dataset.mark);
	await expect(shown).toEqual(expected);
	for (const mark of expected) {
		await expect(
			canvas.getByRole('img', { name: RAIL_MARK_COPY[mark] })
		).toBeInTheDocument();
	}
	const absent = (
		['thread', 'supervision', 'mail', 'unread'] as SessionRailMark[]
	).filter((mark) => !expected.includes(mark));
	for (const mark of absent) {
		await expect(
			canvas.queryByRole('img', { name: RAIL_MARK_COPY[mark] })
		).toBeNull();
	}
};

export const Empty: Story = {
	name: 'Pille — nichts (nur Avatar)',
	render: () => <Pill />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		// The pill is a button and it is named — the avatar alone never was.
		const pill = canvas.getByRole('button', { name: 'sonnenblume_47' });
		await expectPillGeometry(pill);
		await expectMarks(canvasElement, []);
		// The empty marks row is still reserved, so the rail rhythm does not
		// jitter between a bare row and a fully marked one.
		await expect(
			pill.querySelector('.sessionRailPill__marks')
		).toBeInTheDocument();
	}
};

export const AllMarks: Story = {
	name: 'Pille — alles (Thread, Supervision, Mail, ungelesen)',
	render: () => (
		<Pill
			marks={getSessionRailMarks({
				previewChannel: 'thread',
				supervisionState: 'supervisedByMe',
				modality: 'AGENCY_COUNSELLING',
				unread: true
			})}
			unreadCount={3}
		/>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const pill = canvas.getByRole('button', { name: /sonnenblume_47/ });
		// Four marks DO stretch the box now — that is the point.
		await expectPillGeometry(pill);
		await expectMarks(canvasElement, [
			'thread',
			'supervision',
			'mail',
			'unread'
		]);
		// ONE column, four rows — never a 2 x 2 grid. Frank: "dann muss man
		// nicht noch mehr sortieren, sondern dann einfach das Ding länger
		// machen." Four distinct tops and one shared left edge prove it.
		const marks = Array.from(
			pill.querySelectorAll<HTMLElement>('.sessionRailPill__mark')
		);
		const tops = new Set(
			marks.map((mark) => Math.round(mark.getBoundingClientRect().top))
		);
		await expect(tops.size).toBe(4);
		const lefts = new Set(
			marks.map((mark) => Math.round(mark.getBoundingClientRect().left))
		);
		await expect(lefts.size).toBe(1);
		// The marks are readable, not decorative: 24 px slots, not 16.
		await expect(Math.round(marks[0].getBoundingClientRect().width)).toBe(
			24
		);
		// The avatar sits at the TOP, above every mark.
		const avatarTop = pill
			.querySelector<HTMLElement>('.sessionRailPill__avatar')!
			.getBoundingClientRect().top;
		await expect(avatarTop).toBeLessThan(
			Math.min(...marks.map((mark) => mark.getBoundingClientRect().top))
		);
		// And every mark stays inside the pill (no overflow, no clipping).
		const box = pill.getBoundingClientRect();
		for (const mark of marks) {
			const markBox = mark.getBoundingClientRect();
			await expect(markBox.left).toBeGreaterThanOrEqual(box.left);
			await expect(markBox.right).toBeLessThanOrEqual(box.right);
			await expect(markBox.bottom).toBeLessThanOrEqual(box.bottom);
		}
	}
};

export const UnreadOnly: Story = {
	name: 'Pille — nur ungelesen',
	render: () => (
		<Pill marks={getSessionRailMarks({ unread: true })} unreadCount={7} />
	),
	play: async ({ canvasElement }) => {
		await expectMarks(canvasElement, ['unread']);
		// Frank, 10.09.2026: the circle carries the NUMBER, so nobody has to
		// hover to learn how many. Asserted as text, not as a filled shape.
		const mark = canvasElement.querySelector<HTMLElement>(
			'.sessionRailPill__mark--unread'
		)!;
		await expect(mark.textContent).toBe('7');
		// It still fits the 24 px slot it shares with the glyph marks.
		await expect(Math.round(mark.getBoundingClientRect().width)).toBe(24);
		// The unread row is also readable without decoding the dot.
		const pill =
			canvasElement.querySelector<HTMLElement>('.sessionRailPill')!;
		await expect(pill.classList).toContain('sessionRailPill--unread');
	}
};

export const SupervisionOnly: Story = {
	name: 'Pille — nur Supervision',
	render: () => (
		<Pill
			marks={getSessionRailMarks({ supervisionState: 'supervisedByMe' })}
		/>
	),
	play: async ({ canvasElement }) => {
		await expectMarks(canvasElement, ['supervision']);
		const pill =
			canvasElement.querySelector<HTMLElement>('.sessionRailPill')!;
		// Supervision alone must not turn on the unread treatment.
		await expect(pill.classList).not.toContain('sessionRailPill--unread');
	}
};

export const MailWithThread: Story = {
	name: 'Pille — Mailberatung mit Thread',
	render: () => (
		<Pill
			marks={getSessionRailMarks({
				modality: 'AGENCY_COUNSELLING',
				previewChannel: 'thread'
			})}
		/>
	),
	play: async ({ canvasElement }) => {
		// Frank's order holds even though the input named mail first.
		await expectMarks(canvasElement, ['thread', 'mail']);
	}
};

export const RailMixed: Story = {
	name: 'Rail — gemischte Zeilen im 80 px Streifen',
	parameters: { layout: 'fullscreen' },
	render: () => <MixedRail />,
	play: async ({ canvasElement }) => {
		const column = canvasElement.querySelector<HTMLElement>(
			'[data-cy="rail-column"]'
		)!;
		await expect(Math.round(column.getBoundingClientRect().width)).toBe(
			STAGE_LAYOUT.RAIL_WIDTH
		);

		const pills = Array.from(
			canvasElement.querySelectorAll<HTMLElement>('.sessionRailPill')
		);
		await expect(pills).toHaveLength(MIXED_ROWS.length);

		// Every pill keeps the same portrait box — no row grows with its marks.
		for (const pill of pills) {
			await expectPillGeometry(pill);
			// And it fits the 80 px column without touching its edges.
			const box = pill.getBoundingClientRect();
			const columnBox = column.getBoundingClientRect();
			await expect(box.left).toBeGreaterThan(columnBox.left);
			await expect(box.right).toBeLessThan(columnBox.right);
		}

		// Round 1 read Frank's "diesen Abstand halten" as the expanded list's
		// 24 px card rhythm. On the rendered rail he corrected it — "der
		// Abstand zwischen diesen Pillen ist zu groß" — so 8 px it is.
		for (let index = 1; index < pills.length; index += 1) {
			const gap =
				pills[index].getBoundingClientRect().top -
				pills[index - 1].getBoundingClientRect().bottom;
			await expect(Math.round(gap)).toBe(8);
		}

		// The pills are NOT all the same height any more: a row carrying more
		// marks is taller. This is the whole point of round 2, so it is
		// asserted rather than eyeballed.
		const heights = pills.map((pill) =>
			Math.round(pill.getBoundingClientRect().height)
		);
		await expect(new Set(heights).size).toBeGreaterThan(1);
		// And more marks really means taller — not just "different".
		const markCount = (pill: HTMLElement) =>
			pill.querySelectorAll('.sessionRailPill__mark').length;
		const byMarks = [...pills].sort((a, b) => markCount(a) - markCount(b));
		await expect(
			byMarks[byMarks.length - 1].getBoundingClientRect().height
		).toBeGreaterThan(byMarks[0].getBoundingClientRect().height);

		// Per-row marks: the mixed set is the assertion, not "it rendered".
		const marksOf = (pill: HTMLElement) =>
			Array.from(
				pill.querySelectorAll<HTMLElement>('.sessionRailPill__mark')
			).map((mark) => mark.dataset.mark);
		await expect(marksOf(pills[0])).toEqual(['mail']);
		await expect(marksOf(pills[1])).toEqual(['thread', 'mail', 'unread']);
		await expect(marksOf(pills[2])).toEqual(['supervision']);
		await expect(marksOf(pills[3])).toEqual([]);
		await expect(marksOf(pills[4])).toEqual([
			'thread',
			'supervision',
			'mail',
			'unread'
		]);

		// The open conversation keeps the #597 ring even though it is unread.
		await expect(pills[1].classList).toContain('sessionRailPill--active');
		await expect(pills[1].classList).toContain('sessionRailPill--unread');
		await expect(getComputedStyle(pills[1]).borderTopWidth).toBe('2px');
	}
};

export const RailPhone: Story = {
	name: 'Rail — Telefon (390 px)',
	parameters: { layout: 'fullscreen' },
	globals: phone390Globals,
	render: () => <MixedRail />,
	play: async ({ canvasElement }) => {
		// The rail is a fixed 80 px strip; a 390 px phone must not squeeze it.
		const column = canvasElement.querySelector<HTMLElement>(
			'[data-cy="rail-column"]'
		)!;
		await expect(Math.round(column.getBoundingClientRect().width)).toBe(
			STAGE_LAYOUT.RAIL_WIDTH
		);
		for (const pill of Array.from(
			canvasElement.querySelectorAll<HTMLElement>('.sessionRailPill')
		)) {
			await expectPillGeometry(pill);
		}
	}
};

export const RailDark: Story = {
	name: 'Rail — dunkles Schema',
	parameters: { layout: 'fullscreen' },
	globals: { scheme: 'dark' },
	render: () => <MixedRail />,
	play: async ({ canvasElement }) => {
		const pills = Array.from(
			canvasElement.querySelectorAll<HTMLElement>('.sessionRailPill')
		);
		for (const pill of pills) {
			await expectPillGeometry(pill);
		}
		// Nothing here is a fixed colour: the pill takes whatever the scheme
		// puts on the M3 roles, so the dark canvas must not leave it white.
		const background = getComputedStyle(pills[0]).backgroundColor;
		await expect(background).not.toBe('rgb(255, 255, 255)');
	}
};

// ---------------------------------------------------------------------------
// Tooltips. Frank's sketch, 10.09.2026 — one tooltip per hoverable thing:
//
//   pill / avatar   name, then the start of the newest message
//   thread mark     the newest THREAD message
//   mail mark       the newest MAIN-channel message
//   unread dot      how many new messages there are
//
// Every string is the host's, already formatted and already translated. The
// component looks nothing up. The date sits bottom right in every one of them
// ("die Datumsangabe immer rechts unten").
// ---------------------------------------------------------------------------

const RAIL_TOOLTIPS: SessionRailTooltips = {
	pill: {
		title: 'sonnenblume_47',
		body: 'Danke, das hilft mir wirklich weiter — ich melde mich…',
		meta: 'Gestern, 09:18'
	},
	marks: {
		thread: {
			body: 'Zum Mahnbescheid: die Frist läuft noch bis Freitag.',
			meta: 'Gestern, 09:18'
		},
		mail: {
			body: 'Ich habe die Unterlagen jetzt zusammengesucht.',
			meta: '07.09., 16:02'
		},
		unread: { body: '3 neue Nachrichten' }
	}
};

/** Hovering the pill names the conversation and starts its newest message. */
export const TooltipName: Story = {
	name: 'Tooltip — Name und Nachrichtenanfang',
	render: () => (
		<div style={{ padding: '24px 260px 24px 24px' }}>
			<Pill marks={['mail']} tooltips={RAIL_TOOLTIPS} />
		</div>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const pill = canvas.getByRole('button', { name: /sonnenblume_47/ });
		await expect(
			canvasElement.querySelector('[data-cy="session-rail-pill-tooltip"]')
		).toBeNull();
		await userEvent.hover(pill);
		const tip = canvasElement.querySelector<HTMLElement>(
			'[data-cy="session-rail-pill-tooltip"]'
		)!;
		await expect(tip.dataset.tooltipKind).toBe('pill');
		await expect(
			tip.querySelector('.sessionRailPill__tooltipTitle')!.textContent
		).toBe('sonnenblume_47');
		await expect(
			tip.querySelector('.sessionRailPill__tooltipBody')!.textContent
		).toContain('Danke, das hilft');
		// It hangs to the RIGHT of the pill.
		await expect(tip.getBoundingClientRect().left).toBeGreaterThanOrEqual(
			pill.getBoundingClientRect().right
		);
		// Frank: "das kann locker bis zweihundertzwanzig Pixel lang sein."
		await expect(
			Math.round(tip.getBoundingClientRect().width)
		).toBeLessThanOrEqual(220);
		// The date sits bottom RIGHT, not left.
		const meta = tip.querySelector<HTMLElement>(
			'.sessionRailPill__tooltipMeta'
		)!;
		const body = tip.querySelector<HTMLElement>(
			'.sessionRailPill__tooltipBody'
		)!;
		await expect(meta.getBoundingClientRect().bottom).toBeGreaterThan(
			body.getBoundingClientRect().bottom - 1
		);
		await expect(meta.getBoundingClientRect().right).toBeCloseTo(
			body.getBoundingClientRect().right,
			0
		);
		await userEvent.unhover(pill);
		await expect(
			canvasElement.querySelector('[data-cy="session-rail-pill-tooltip"]')
		).toBeNull();
	}
};

/** Each mark shows ITS OWN channel's newest message — not one shared preview. */
export const TooltipMessage: Story = {
	name: 'Tooltip — je Marke die eigene Nachricht',
	render: () => (
		<div style={{ padding: '24px 260px 24px 24px' }}>
			<Pill
				marks={['thread', 'mail', 'unread']}
				tooltips={RAIL_TOOLTIPS}
			/>
		</div>
	),
	play: async ({ canvasElement }) => {
		const tipNow = () =>
			canvasElement.querySelector<HTMLElement>(
				'[data-cy="session-rail-pill-tooltip"]'
			);
		const bodyOf = (mark: string) => {
			const el = canvasElement.querySelector<HTMLElement>(
				`.sessionRailPill__mark--${mark}`
			)!;
			return el;
		};

		await userEvent.hover(bodyOf('thread'));
		await expect(
			tipNow()!.querySelector('.sessionRailPill__tooltipBody')!
				.textContent
		).toContain('Mahnbescheid');
		await expect(tipNow()!.dataset.tooltipKind).toBe('mark');

		await userEvent.hover(bodyOf('mail'));
		await expect(
			tipNow()!.querySelector('.sessionRailPill__tooltipBody')!
				.textContent
		).toContain('Unterlagen');
		// The two really differ — that is the whole point of per-channel
		// previews, so it is asserted rather than assumed.
		await expect(
			tipNow()!.querySelector('.sessionRailPill__tooltipBody')!
				.textContent
		).not.toContain('Mahnbescheid');

		await userEvent.hover(bodyOf('unread'));
		await expect(
			tipNow()!.querySelector('.sessionRailPill__tooltipBody')!
				.textContent
		).toBe('3 neue Nachrichten');
		// A count has no date under it.
		await expect(
			tipNow()!.querySelector('.sessionRailPill__tooltipMeta')
		).toBeNull();
	}
};

/**
 * A channel whose newest message is older than the loaded window — and
 * supervision, which lives in another room — have nothing to show. The mark
 * falls back to its own label instead of opening an empty box.
 */
export const TooltipWithoutPreview: Story = {
	name: 'Tooltip — ohne Vorschau fällt er auf das Markenwort zurück',
	render: () => (
		<div style={{ padding: '24px 260px 24px 24px' }}>
			<Pill marks={['supervision']} tooltips={RAIL_TOOLTIPS} />
		</div>
	),
	play: async ({ canvasElement }) => {
		await userEvent.hover(
			canvasElement.querySelector<HTMLElement>(
				'.sessionRailPill__mark--supervision'
			)!
		);
		const tip = canvasElement.querySelector<HTMLElement>(
			'[data-cy="session-rail-pill-tooltip"]'
		)!;
		await expect(tip.textContent).toBe(RAIL_MARK_COPY.supervision);
		await expect(
			tip.querySelector('.sessionRailPill__tooltipMeta')
		).toBeNull();
	}
};

export const TooltipDismissesWithEscape: Story = {
	name: 'Tooltip — Escape schließt die Tastaturvorschau',
	render: () => (
		<div style={{ padding: '24px 260px 24px 24px' }}>
			<Pill marks={['supervision']} tooltips={RAIL_TOOLTIPS} />
		</div>
	),
	play: async ({ canvasElement }) => {
		const pill = within(canvasElement).getByRole('button', {
			name: /sonnenblume_47/
		});
		await userEvent.tab();
		await expect(pill).toHaveFocus();
		await expect(
			canvasElement.querySelector('[data-cy="session-rail-pill-tooltip"]')
		).toBeInTheDocument();
		await userEvent.keyboard('{Escape}');
		await expect(
			canvasElement.querySelector('[data-cy="session-rail-pill-tooltip"]')
		).toBeNull();
	}
};

/**
 * More than 99 new messages. Four digits do not fit a 24 px circle, so the
 * mark reads "99+" — the cap is asserted rather than left to chance.
 */
export const UnreadCountCapped: Story = {
	name: 'Pille — mehr als 99 neue Nachrichten',
	render: () => (
		<div style={{ padding: 24 }}>
			<Pill
				marks={getSessionRailMarks({ unread: true })}
				unreadCount={128}
			/>
		</div>
	),
	play: async ({ canvasElement }) => {
		const mark = canvasElement.querySelector<HTMLElement>(
			'.sessionRailPill__mark--unread'
		)!;
		await expect(mark.textContent).toBe('99+');
		await expect(Math.round(mark.getBoundingClientRect().width)).toBe(24);
		// The text stays inside its circle — no overflow at three glyphs.
		await expect(mark.scrollWidth).toBeLessThanOrEqual(mark.clientWidth);
	}
};
