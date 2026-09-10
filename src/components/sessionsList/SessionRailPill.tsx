/**
 * One row of the collapsed session-list rail (the 80 px column that appears
 * while a side pane is open, `STAGE_LAYOUT.RAIL_WIDTH`).
 *
 * Frank, 09.09.2026 (*2): "Die Kreise finde ich ganz geil. Allerdings sind
 * die … auch bisschen eiförmig. Ich würde mir wünschen, wir hätten da mehr
 * Infos drin … Mein Vorschlag: wir machen daraus hochförmige Pillen und
 * können dann unten Icons und Details hinzufügen … Und wir sollten diesen
 * Abstand auch halten."
 *
 * So: a PORTRAIT pill — avatar on top, up to four small state marks
 * underneath — instead of the avatar circle that the `--iconOnly` rule used
 * to draw.
 *
 * ---------------------------------------------------------------------------
 * WHY THE OLD CIRCLE WAS AN EGG (measured, not guessed)
 * ---------------------------------------------------------------------------
 * `sessionsList.styles.scss` `&__wrapper--iconOnly .sessionsListItem__content`
 * set `border-radius: 50%` on a box it never made square: `width: auto` +
 * `min-width: 48px`, capped by the base rule's `max-width: 100%` inside a
 * 56 px scroll container → 48 px wide; height = 8 + 8 padding + the 32 px
 * avatar row + the 1 px border top and bottom → 50 px. A 48 × 50 box with a
 * 50 % radius is an ellipse with 24 px × 25 px radii. That is the egg.
 *
 * The pill answers it structurally, not cosmetically: fixed 48 × 80 box, and
 * the radius is stated in px (`--rail-pill-radius`, half the width), so no
 * change of content can ever turn it back into an ellipse. Both facts are
 * asserted in the story's `play`, so "eiförmig" cannot come back unnoticed.
 *
 * PRESENTATIONAL ONLY. No data fetching, no i18n lookup: the marks come from
 * `getSessionRailMarks` (one documented source each) and the labels are
 * injected as a copy map, because the i18n catalogue guard runs at drift
 * budget 0 and this component must not add a key.
 */
import * as React from 'react';
import clsx from 'clsx';
import { ReactComponent as ThreadGlyph } from '../../resources/img/icons/fab-menu-thread.svg';
import { ReactComponent as SupervisionGlyph } from '../../resources/img/icons/supervision_nocirc_400_24px.svg';
import { MailFilterIcon } from './MailFilterIcon';
import type {
	SessionRailMark,
	SessionRailMarkLabels
} from './sessionRailState';
import './sessionRailPill.styles.scss';

export interface SessionRailPillProps {
	/**
	 * The pill's accessible name — the person or group the row stands for.
	 * Rendered visually hidden, so the button is never an unnamed control
	 * (the avatar itself is decorative here: `aria-hidden`).
	 */
	'name': string;
	/** The avatar node, e.g. `<UserAvatar size="32px" />`. */
	'avatar': React.ReactNode;
	/** Already ordered — use `getSessionRailMarks()`. */
	'marks': readonly SessionRailMark[];
	/** Accessible name per mark; the host maps existing i18n keys onto it. */
	'markLabels': SessionRailMarkLabels;
	/**
	 * The conversation's newest message, ALREADY formatted by the host — the
	 * very string the expanded row shows, channel prefix included ("Thread:
	 * …"). Shown when a mark is hovered.
	 *
	 * HONEST SCOPE, same as the marks themselves: the list carries ONE newest
	 * message per conversation, not one per channel. So every mark shows this
	 * same message; the prefix inside it is what says which channel it came
	 * from. A per-mark message would need the room timeline, which the list
	 * does not load.
	 */
	'preview'?: string;
	/** When that message arrived — already formatted, e.g. "09:18", "Gestern". */
	'previewTime'?: string;
	/** The open conversation. */
	'active'?: boolean;
	'onClick'?: (event: React.MouseEvent<HTMLButtonElement>) => void;
	'onKeyDown'?: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
	/** The list keeps its `role="tab"` semantics; the story uses a button. */
	'role'?: string;
	'aria-selected'?: boolean;
	'tabIndex'?: number;
	'buttonRef'?: (element: HTMLButtonElement | null) => void;
	'className'?: string;
	'data-cy'?: string;
}

const MARK_GLYPHS: Record<SessionRailMark, React.ReactNode> = {
	// Same glyphs the channel switcher already uses for these two channels
	// (`chatStage/ChannelMenu.tsx`) — nothing new drawn.
	thread: <ThreadGlyph aria-hidden="true" focusable="false" />,
	supervision: <SupervisionGlyph aria-hidden="true" focusable="false" />,
	// The #1148 envelope, i.e. the Mail filter chip's own glyph.
	mail: <MailFilterIcon />,
	// The house's unread language is a filled dot in the unread role
	// (`session__threadListUnreadDot`, `sessionsListToolbar__chipBadge`), not
	// a pictogram — drawn in CSS, so no icon was invented for it either.
	unread: null
};

export const SessionRailPill = ({
	name,
	avatar,
	marks,
	markLabels,
	preview,
	previewTime,
	active = false,
	onClick,
	onKeyDown,
	role,
	'aria-selected': ariaSelected,
	tabIndex,
	buttonRef,
	className,
	'data-cy': dataCy = 'session-rail-pill'
}: SessionRailPillProps) => {
	// Which tooltip is showing, and for which mark. `null` = none.
	// Frank, 10.09.2026: "einen Tooltip anhängen, quasi rechts. Wenn ich drauf
	// hover … dass ich Nutzernamen sehe … Wenn ich über … das Mailsymbol
	// hover, dann seh ich die letzte Nachricht … und den Zeitpunkt in der
	// zweiten Zeile darunter."
	const [hoveredMark, setHoveredMark] =
		React.useState<SessionRailMark | null>(null);
	const [showName, setShowName] = React.useState(false);

	// A mark's tooltip wins over the pill's: the pointer is inside the pill
	// either way, so without this the name would sit on top of the message.
	const tooltip = hoveredMark
		? {
				kind: 'message' as const,
				title: preview,
				meta: previewTime
			}
		: showName
			? { kind: 'name' as const, title: name, meta: undefined }
			: null;

	// Nothing to show is not the same as "show an empty box": a conversation
	// whose newest message the host could not format (encrypted, not loaded
	// yet) falls back to the mark's own label rather than an empty tooltip.
	const title =
		tooltip?.kind === 'message' && !tooltip.title
			? markLabels[hoveredMark!]
			: tooltip?.title;

	return (
		<span className="sessionRailPill__shell">
			<button
				type="button"
				ref={buttonRef}
				className={clsx(
					'sessionRailPill',
					active && 'sessionRailPill--active',
					marks.includes('unread') && 'sessionRailPill--unread',
					className
				)}
				onClick={onClick}
				onKeyDown={onKeyDown}
				// Focus is the keyboard's hover: a Tab to the pill names it,
				// exactly as a pointer resting on it does.
				onFocus={() => setShowName(true)}
				onBlur={() => {
					setShowName(false);
					setHoveredMark(null);
				}}
				onMouseEnter={() => setShowName(true)}
				onMouseLeave={() => {
					setShowName(false);
					setHoveredMark(null);
				}}
				role={role}
				aria-selected={ariaSelected}
				tabIndex={tabIndex}
				data-cy={dataCy}
				data-marks={marks.join(' ')}
			>
				<span className="sessionRailPill__avatar" aria-hidden="true">
					{avatar}
				</span>
				<span className="sr-only">{name}</span>
				<span className="sessionRailPill__marks">
					{marks.map((mark) => (
						<span
							key={mark}
							className={clsx(
								'sessionRailPill__mark',
								`sessionRailPill__mark--${mark}`
							)}
							// Every mark carries its own accessible name, so the
							// button reads "<name> Thread Ungelesen" and a test can
							// assert one mark at a time.
							role="img"
							aria-label={markLabels[mark]}
							data-mark={mark}
							onMouseEnter={() => setHoveredMark(mark)}
							onMouseLeave={() => setHoveredMark(null)}
						>
							{MARK_GLYPHS[mark]}
						</span>
					))}
				</span>
			</button>

			{/*
			 * Rendered as a SIBLING of the button, not inside it: the tooltip
			 * is flow content and a `button` may only contain phrasing
			 * content, so nesting it would be invalid markup. It also keeps
			 * the tooltip out of the button's accessible name — the name and
			 * the mark labels are already on the button itself, so a screen
			 * reader would otherwise hear everything twice.
			 */}
			{tooltip && title && (
				<span
					className={clsx(
						'sessionRailPill__tooltip',
						`sessionRailPill__tooltip--${tooltip.kind}`
					)}
					role="presentation"
					aria-hidden="true"
					data-cy="session-rail-pill-tooltip"
					data-tooltip-kind={tooltip.kind}
				>
					<span className="sessionRailPill__tooltipTitle">
						{title}
					</span>
					{tooltip.meta && (
						<span className="sessionRailPill__tooltipMeta">
							{tooltip.meta}
						</span>
					)}
				</span>
			)}
		</span>
	);
};
