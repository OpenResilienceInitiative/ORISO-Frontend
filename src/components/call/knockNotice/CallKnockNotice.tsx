import * as React from 'react';
import { useEffect, useId, useRef, useState } from 'react';
import { keyframes } from '@emotion/react';
import { Box, Button, IconButton, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useTranslation } from 'react-i18next';
import { clampPage, KnockingPerson } from './callKnockModel';
import type { CallKnockBusy } from './useCallKnocks';
import { UserAvatar } from '../../message/UserAvatar';
import { chosenAvatarOf } from '../../../utils/avatarChoice';
import { usePrefersReducedMotion } from '../../../hooks/usePrefersReducedMotion';
import { playKnockTone } from '../../../utils/knockTone';

export type CallKnockPlacement = 'overlay' | 'docked';

export interface CallKnockNoticeProps {
	people: KnockingPerson[];
	/**
	 * `overlay`: inside the call stage, under its top controls.
	 * `docked`: the call is minimised — the notice sits just above it.
	 */
	placement?: CallKnockPlacement;
	/** A decision is on its way: every decision ignores clicks (focus stays put). */
	busy?: CallKnockBusy;
	onAdmit: (knockId: number) => void;
	onDecline: (knockId: number) => void;
	onAdmitAll: () => void;
	/** Fixed clock (Storybook, tests); otherwise the notice ticks itself. */
	nowMs?: number;
	/** After a minute of waiting, once per person: a soft knock (#2237). */
	onNudge?: () => void;
}

/** Waited this long, the host is reminded once (Frank, 2026-11-12). */
export const KNOCK_NUDGE_AFTER_MS = 60_000;

const wiggle = keyframes`
	0%, 100% { transform: rotate(0deg); }
	15% { transform: rotate(-6deg); }
	30% { transform: rotate(5deg); }
	45% { transform: rotate(-4deg); }
	60% { transform: rotate(3deg); }
	75% { transform: rotate(-1deg); }
`;

/** Whole minutes since `requestedAt`; `null` without a time. Never negative. */
const waitedMs = (requestedAt: string | undefined, now: number) => {
	if (!requestedAt) return null;
	const at = Date.parse(requestedAt);
	return Number.isNaN(at) ? null : Math.max(0, now - at);
};

/*
 * A light card in the app's own palette (Frank, 2026-11-12: the dark
 * snackbar look did not fit the design). `--m3-*` are the tenant palette;
 * the literals are the light-scheme defaults.
 */
const knockColors = {
	surface: 'var(--m3-surface-container-lowest, #ffffff)',
	onSurface: 'var(--m3-on-surface, #1b1b1c)',
	onSurfaceVariant: 'var(--m3-on-surface-variant, #444748)',
	outline: 'var(--m3-outline-variant, #c4c7c8)',
	action: 'var(--m3-primary, #a5000a)',
	onAction: 'var(--m3-on-primary, #ffffff)',
	hover: 'rgba(165, 0, 10, 0.08)'
} as const;

/* M3 elevation level 3: the card floats over the call video. */
const KNOCK_ELEVATION =
	'0 4px 8px 3px rgba(0, 0, 0, 0.15), 0 1px 3px rgba(0, 0, 0, 0.3)';

const focusRing = (color: string) => ({
	outline: `2px solid ${color}`,
	outlineOffset: 2
});

const textAction: SxProps<Theme> = {
	'color': knockColors.action,
	'textTransform': 'none',
	'fontSize': 14,
	'fontWeight': 500,
	'lineHeight': '20px',
	'letterSpacing': '0.1px',
	'minWidth': 0,
	'minHeight': 40,
	'px': 1.5,
	'borderRadius': '20px',
	'whiteSpace': 'nowrap',
	'&:hover': { backgroundColor: knockColors.hover },
	'&:focus-visible': focusRing(knockColors.action),
	'&[aria-disabled="true"]': { opacity: 0.38, cursor: 'default' }
};

/* The one filled action, as in the self-help knock snackbar (#1499). */
const filledAction: SxProps<Theme> = {
	...textAction,
	'backgroundColor': knockColors.action,
	'color': knockColors.onAction,
	'px': 2,
	'&:hover': {
		backgroundColor: knockColors.action,
		boxShadow: '0 1px 2px rgba(0, 0, 0, 0.3)'
	},
	'&:focus-visible': focusRing(knockColors.action)
};

const pagerButton: SxProps<Theme> = {
	'color': knockColors.onSurface,
	'width': 40,
	'height': 40,
	'&:hover': { backgroundColor: knockColors.hover },
	'&:focus-visible': focusRing(knockColors.action)
};

const placementSx: Record<CallKnockPlacement, SxProps<Theme>> = {
	overlay: {
		position: 'absolute',
		top: 52,
		left: '50%',
		transform: 'translateX(-50%)',
		width: 'calc(100% - 24px)',
		maxWidth: 360,
		// A small stage clips its content: scroll rather than lose the buttons.
		maxHeight: 'calc(100% - 60px)',
		overflowY: 'auto',
		zIndex: 7
	},
	docked: {
		position: 'fixed',
		right: 12,
		bottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px + min(170px, 32vh) + 8px)',
		width: 'min(320px, calc(100vw - 24px))',
		zIndex: 10001
	}
};

/**
 * Someone is knocking on the call (ORISO-Frontend#1892, ADR-029 §2).
 *
 * Shown to the counsellor inside the call, so she can let the person in
 * without leaving it: who is knocking, "Einlassen" and "Ablehnen" — one click
 * each, no confirmation. With several people waiting she pages between them
 * and can let everyone in at once.
 *
 * It never takes focus: the counsellor is mid-conversation. The name is a
 * polite live region, so a screen reader hears who arrived, and every action
 * is a native button reachable with Tab. The buttons are the same elements
 * from one person to the next, so focus stays on "Einlassen" after a decision.
 */
export const CallKnockNotice = ({
	people,
	placement = 'overlay',
	busy = null,
	onAdmit,
	onDecline,
	onAdmitAll,
	nowMs,
	onNudge = playKnockTone
}: CallKnockNoticeProps) => {
	const { t } = useTranslation();
	const reducedMotion = usePrefersReducedMotion();
	const [tick, setTick] = useState(() => Date.now());
	const waiting = people.length > 0;
	useEffect(() => {
		if (nowMs !== undefined || !waiting) return undefined;
		setTick(Date.now());
		const timer = window.setInterval(() => setTick(Date.now()), 5_000);
		return () => window.clearInterval(timer);
	}, [nowMs, waiting]);
	const now = nowMs ?? tick;
	const nudged = useRef(new Set<number>());
	const nudgeRef = useRef(onNudge);
	nudgeRef.current = onNudge;
	const nameId = useId();
	const regionId = useId();
	// Follows the person, not the position: the list may change under her.
	const [selected, setSelected] = useState<{
		id: number | null;
		index: number;
	}>({ id: null, index: 0 });
	const count = people.length;
	const found = people.findIndex((p) => p.id === selected.id);
	// The person shown has gone: whoever is now in that place.
	const page = found >= 0 ? found : clampPage(selected.index, count);
	const shownId = count > 0 ? people[page].id : null;

	useEffect(() => {
		if (
			shownId !== null &&
			(shownId !== selected.id || page !== selected.index)
		)
			setSelected({ id: shownId, index: page });
	}, [shownId, page, selected]);

	/* Anybody waiting a minute reminds the host once: a soft knock (#2237). */
	const dueIds = people
		.filter(
			(p) => (waitedMs(p.requestedAt, now) ?? 0) >= KNOCK_NUDGE_AFTER_MS
		)
		.map((p) => p.id)
		.join(',');
	useEffect(() => {
		if (!dueIds) return;
		const fresh = dueIds
			.split(',')
			.map(Number)
			.filter((id) => !nudged.current.has(id));
		if (fresh.length === 0) return;
		fresh.forEach((id) => nudged.current.add(id));
		nudgeRef.current();
	}, [dueIds]);

	if (count === 0) return null;

	const current = people[page];
	const waited = waitedMs(current.requestedAt, now);
	const due = waited !== null && waited >= KNOCK_NUDGE_AFTER_MS;
	const several = count > 1;
	const isBusy = busy !== null;
	const guard = (action: () => void, blocked: boolean) => () => {
		if (!blocked) action();
	};
	const turn = (step: number) => () => {
		const index = (page + step + count) % count;
		setSelected({ id: people[index].id, index });
	};

	return (
		<Box
			role="region"
			aria-labelledby={regionId}
			data-testid="call-knock-notice"
			data-placement={placement}
			onMouseDown={(event) => event.stopPropagation()}
			onTouchStart={(event) => event.stopPropagation()}
			sx={{
				...placementSx[placement],
				backgroundColor: knockColors.surface,
				color: knockColors.onSurface,
				borderRadius: '12px',
				border: `1px solid ${knockColors.outline}`,
				boxShadow: KNOCK_ELEVATION,
				boxSizing: 'border-box',
				pt: 1.5,
				pb: 1,
				px: 2
			}}
		>
			<Typography
				id={regionId}
				component="h2"
				sx={{
					color: knockColors.onSurfaceVariant,
					fontSize: 12,
					fontWeight: 500,
					lineHeight: '16px',
					letterSpacing: '0.5px',
					m: 0
				}}
			>
				{t('calls.knock.region')}
				{several && (
					<>
						{' · '}
						<span data-testid="call-knock-position">
							{t('calls.knock.position', {
								current: page + 1,
								total: count
							})}
						</span>
					</>
				)}
			</Typography>
			<Box
				sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 1 }}
			>
				{/* The picture the person chose, as in the chat (#2237). */}
				<Box data-testid="call-knock-avatar" sx={{ flexShrink: 0 }}>
					<UserAvatar
						username={current.name ?? ''}
						displayName={current.name ?? undefined}
						userId={current.name ?? String(current.id)}
						size={40}
						outline={false}
						choice={chosenAvatarOf({ avatarId: current.avatarId })}
					/>
				</Box>
				<Box aria-live="polite" sx={{ minWidth: 0, flex: 1 }}>
					<Typography
						id={nameId}
						component="p"
						data-testid="call-knock-name"
						sx={{
							color: 'inherit',
							fontSize: 16,
							fontWeight: 500,
							lineHeight: '24px',
							letterSpacing: '0.15px',
							overflowWrap: 'anywhere',
							m: 0
						}}
					>
						{current.name ?? t('calls.knock.someone')}
					</Typography>
					<Typography
						component="p"
						data-testid="call-knock-waiting"
						sx={{
							color: knockColors.onSurfaceVariant,
							fontSize: 14,
							lineHeight: '20px',
							letterSpacing: '0.25px',
							m: 0
						}}
					>
						{waited === null
							? t('calls.knock.wantsIn')
							: waited < KNOCK_NUDGE_AFTER_MS
								? t('calls.knock.justArrived')
								: t('calls.knock.waitingFor', {
										count: Math.floor(waited / 60_000)
									})}
					</Typography>
				</Box>
				{several && (
					<Box sx={{ display: 'flex', flexShrink: 0 }}>
						<IconButton
							onClick={turn(-1)}
							aria-label={t('calls.knock.previous')}
							sx={pagerButton}
							data-testid="call-knock-previous"
						>
							<ChevronLeftIcon aria-hidden="true" />
						</IconButton>
						<IconButton
							onClick={turn(1)}
							aria-label={t('calls.knock.next')}
							sx={pagerButton}
							data-testid="call-knock-next"
						>
							<ChevronRightIcon aria-hidden="true" />
						</IconButton>
					</Box>
				)}
			</Box>
			<Box
				sx={{
					display: 'flex',
					alignItems: 'center',
					flexWrap: 'wrap',
					gap: 0.5,
					mt: 1,
					mx: -1
				}}
			>
				{several && (
					<Button
						variant="text"
						onClick={guard(onAdmitAll, isBusy)}
						aria-disabled={isBusy || undefined}
						sx={textAction}
						data-testid="call-knock-admit-all"
					>
						{t('calls.knock.admitAll')}
					</Button>
				)}
				{/* The pair wraps as one, so "Einlassen" never ends up alone. */}
				<Box sx={{ display: 'flex', gap: 0.5, ml: 'auto' }}>
					<Button
						variant="text"
						onClick={guard(() => onDecline(current.id), isBusy)}
						aria-describedby={nameId}
						aria-disabled={isBusy || undefined}
						sx={textAction}
						data-testid="call-knock-decline"
					>
						{t('calls.knock.decline')}
					</Button>
					<Button
						variant="text"
						onClick={guard(() => onAdmit(current.id), isBusy)}
						aria-describedby={nameId}
						aria-disabled={isBusy || undefined}
						sx={
							due && !reducedMotion
								? {
										...filledAction,
										animation: `${wiggle} 0.7s ease-in-out 0s 3`
									}
								: filledAction
						}
						data-nudge={due && !reducedMotion ? 'true' : undefined}
						data-testid="call-knock-admit"
					>
						{t('calls.knock.admit')}
					</Button>
				</Box>
			</Box>
		</Box>
	);
};
