import * as React from 'react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { INBOX_ICON_PATHS, INBOX_STAR_PATH } from './inboxNavIconPaths';
import {
	getInboxNavIconLabel,
	InboxNavIconCircle,
	InboxNavIconInput,
	InboxNavIconState,
	pickInboxNavIconState
} from './inboxNavIconState';

/** M3 error and on-error-container as fixed by the approved design. */
export const INBOX_NAV_CIRCLE_FILL = '#B1005E';
export const INBOX_NAV_CIRCLE_TEXT = '#FFF7F7';

/** Circle centre and radius in the 24-unit box. */
const CIRCLE_DEFAULT = { cx: 18, cy: 17, r: 5.6 } as const;
/** The overdue clipboard has no cut-out, so it gets a masked gap (knockout). */
const CIRCLE_OVERDUE = { cx: 19, cy: 19, r: 5, knockout: 6.2 } as const;

const FONT_FAMILY = "'Inter Variable', Inter, Arial, sans-serif";
const DIGIT_FONT_SIZE = 7.4;
/** Baseline offset so a digit is optically centred in the circle. */
const DIGIT_BASELINE = DIGIT_FONT_SIZE * 0.36;

export interface InboxNavIconViewProps {
	state: InboxNavIconState;
	/** Active menu item uses the filled glyph. */
	variant?: 'outline' | 'filled';
	/** CSS size of the square slot, e.g. 24 (phone) or 32 (desktop). */
	size?: number | string;
	className?: string;
	/** Accessible name. Without it the icon is hidden from screen readers. */
	label?: string;
}

const Circle = ({
	circle,
	cx,
	cy,
	r
}: {
	circle: Exclude<InboxNavIconCircle, null>;
	cx: number;
	cy: number;
	r: number;
}) => (
	<g aria-hidden="true" data-testid="inbox-nav-icon-circle">
		<circle cx={cx} cy={cy} r={r} fill={INBOX_NAV_CIRCLE_FILL} />
		{circle === 'star' ? (
			<path
				data-testid="inbox-nav-icon-star"
				transform={`translate(${cx} ${cy}) scale(1.011) translate(-18 -16.9)`}
				d={INBOX_STAR_PATH}
				fill={INBOX_NAV_CIRCLE_TEXT}
			/>
		) : (
			<text
				x={cx}
				y={cy + DIGIT_BASELINE}
				textAnchor="middle"
				fontFamily={FONT_FAMILY}
				fontSize={DIGIT_FONT_SIZE}
				fontWeight={500}
				fill={INBOX_NAV_CIRCLE_TEXT}
			>
				{circle.digit}
			</text>
		)}
	</g>
);

/** Presentational inbox icon: pass the picked state in, nothing is fetched. */
export const InboxNavIconView = ({
	state,
	variant = 'outline',
	size = '100%',
	className,
	label
}: InboxNavIconViewProps) => {
	const maskId = useId();
	const d = INBOX_ICON_PATHS[state.icon][variant];
	const { circle } = state;
	const overdueWithCircle = state.icon === 'overdue' && circle !== null;
	const pos = state.icon === 'overdue' ? CIRCLE_OVERDUE : CIRCLE_DEFAULT;

	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			overflow="visible"
			xmlns="http://www.w3.org/2000/svg"
			className={className}
			data-inbox-icon={state.icon}
			role={label ? 'img' : undefined}
			aria-label={label}
			aria-hidden={label ? undefined : true}
			focusable="false"
		>
			{overdueWithCircle && (
				<mask
					id={maskId}
					maskUnits="userSpaceOnUse"
					x="0"
					y="0"
					width="30"
					height="30"
				>
					<rect width="30" height="30" fill="#fff" />
					<circle
						cx={CIRCLE_OVERDUE.cx}
						cy={CIRCLE_OVERDUE.cy}
						r={CIRCLE_OVERDUE.knockout}
						fill="#000"
					/>
				</mask>
			)}
			<path
				d={d}
				fill="currentColor"
				mask={overdueWithCircle ? `url(#${maskId})` : undefined}
			/>
			{circle !== null && <Circle circle={circle} {...pos} />}
		</svg>
	);
};

export interface InboxNavIconProps
	extends InboxNavIconInput,
		Omit<InboxNavIconViewProps, 'state' | 'label'> {
	/** Set false when the surrounding link already carries the label. */
	announce?: boolean;
}

/** Counts in, translated state label out; see `pickInboxNavIconState`. */
export const InboxNavIcon = ({
	totalCount,
	unopenedCount,
	overdue,
	announce = true,
	...viewProps
}: InboxNavIconProps) => {
	const { t } = useTranslation();
	const state = pickInboxNavIconState({ totalCount, unopenedCount, overdue });
	const { key, options } = getInboxNavIconLabel(state);
	return (
		<InboxNavIconView
			{...viewProps}
			state={state}
			label={announce ? t(key, options) : undefined}
		/>
	);
};
