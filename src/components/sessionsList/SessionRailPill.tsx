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
	active = false,
	onClick,
	onKeyDown,
	role,
	'aria-selected': ariaSelected,
	tabIndex,
	buttonRef,
	className,
	'data-cy': dataCy = 'session-rail-pill'
}: SessionRailPillProps) => (
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
				>
					{MARK_GLYPHS[mark]}
				</span>
			))}
		</span>
	</button>
);
