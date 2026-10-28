import * as React from 'react';
import { useEffect, useId, useState } from 'react';
import { Box, Button, IconButton, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useTranslation } from 'react-i18next';
import {
	M3_SNACKBAR_ELEVATION,
	m3SnackbarColors
} from '../../m3Snackbar/M3Snackbar';
import { clampPage, KnockingPerson } from './callKnockModel';
import type { CallKnockBusy } from './useCallKnocks';

export type CallKnockPlacement = 'overlay' | 'docked';

export interface CallKnockNoticeProps {
	people: KnockingPerson[];
	/**
	 * `overlay`: inside the call stage, under its top controls.
	 * `docked`: the call is minimised — the notice sits just above it.
	 */
	placement?: CallKnockPlacement;
	/** A decision is on its way: its buttons ignore clicks (focus stays put). */
	busy?: CallKnockBusy;
	onAdmit: (knockId: number) => void;
	onDecline: (knockId: number) => void;
	onAdmitAll: () => void;
}

const focusRing = (color: string) => ({
	outline: `2px solid ${color}`,
	outlineOffset: 2
});

const textAction: SxProps<Theme> = {
	'color': m3SnackbarColors.action,
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
	'&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.08)' },
	'&:focus-visible': focusRing(m3SnackbarColors.action),
	'&[aria-disabled="true"]': { opacity: 0.38, cursor: 'default' }
};

/* The one filled action, as in the self-help knock snackbar (#1499). */
const filledAction: SxProps<Theme> = {
	...textAction,
	'backgroundColor': m3SnackbarColors.action,
	'color': m3SnackbarColors.surface,
	'px': 2,
	'&:hover': {
		backgroundColor: m3SnackbarColors.action,
		boxShadow: '0 1px 2px rgba(0, 0, 0, 0.3)'
	},
	'&:focus-visible': focusRing(m3SnackbarColors.onSurface)
};

const pagerButton: SxProps<Theme> = {
	'color': m3SnackbarColors.onSurface,
	'width': 40,
	'height': 40,
	'&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.08)' },
	'&:focus-visible': focusRing(m3SnackbarColors.action)
};

const placementSx: Record<CallKnockPlacement, SxProps<Theme>> = {
	overlay: {
		position: 'absolute',
		top: 52,
		left: '50%',
		transform: 'translateX(-50%)',
		width: 'calc(100% - 24px)',
		maxWidth: 360,
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
	onAdmitAll
}: CallKnockNoticeProps) => {
	const { t } = useTranslation();
	const nameId = useId();
	const regionId = useId();
	const [page, setPage] = useState(0);
	const count = people.length;

	useEffect(() => {
		setPage((current) => clampPage(current, count));
	}, [count]);

	if (count === 0) return null;

	const current = people[clampPage(page, count)];
	const several = count > 1;
	const isBusy = busy === 'all' || busy === current.id;
	const guard = (action: () => void, blocked: boolean) => () => {
		if (!blocked) action();
	};
	const turn = (step: number) => () =>
		setPage((value) => (clampPage(value, count) + step + count) % count);

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
				backgroundColor: m3SnackbarColors.surface,
				color: m3SnackbarColors.onSurface,
				borderRadius: '12px',
				boxShadow: M3_SNACKBAR_ELEVATION,
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
					color: 'inherit',
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
								current: clampPage(page, count) + 1,
								total: count
							})}
						</span>
					</>
				)}
			</Typography>
			<Box
				sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}
			>
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
						sx={{
							color: 'inherit',
							fontSize: 14,
							lineHeight: '20px',
							letterSpacing: '0.25px',
							m: 0
						}}
					>
						{t('calls.knock.wantsIn')}
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
						onClick={guard(onAdmitAll, busy !== null)}
						aria-disabled={busy !== null || undefined}
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
						sx={filledAction}
						data-testid="call-knock-admit"
					>
						{t('calls.knock.admit')}
					</Button>
				</Box>
			</Box>
		</Box>
	);
};
