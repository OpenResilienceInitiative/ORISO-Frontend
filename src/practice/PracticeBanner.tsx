import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Button, ButtonBase } from '@mui/material';
import DragIndicatorRoundedIcon from '@mui/icons-material/DragIndicatorRounded';
import { useSetAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import {
	M3_SNACKBAR_ELEVATION,
	m3SnackbarColors
} from '../components/m3Snackbar/M3Snackbar';
import { tourLaunchRequestAtom } from '../components/productTour/tourLaunchState';
import type { TourDefinition } from '../components/productTour/types';
import { usePractice } from './PracticeProvider';
import { nextPracticeLaunchRequest } from './practiceLaunch';
import { practiceTours } from './practiceTours';
import { usePracticeTourProgress } from './usePracticeTourProgress';

/**
 * Above the tour overlay (53) and every in-page layer (side panel 1200), also
 * above the snackbar host (1250), but below MUI modals (1300): a dialog may
 * cover the banner, nothing else may.
 */
const PRACTICE_BANNER_Z_INDEX = 1290;
const EDGE_MARGIN = 8;
const KEY_STEP = 16;
const KEY_STEP_LARGE = 64;
const RESTING_TOP = 16;

interface Position {
	left: number;
	top: number;
}

const clamp = (value: number, min: number, max: number) =>
	Math.min(Math.max(value, min), Math.max(min, max));

/** Keeps the whole banner inside the viewport, a small margin from the edge. */
const clampToViewport = (
	{ left, top }: Position,
	size: { width: number; height: number }
): Position => ({
	left: clamp(
		left,
		EDGE_MARGIN,
		window.innerWidth - EDGE_MARGIN - size.width
	),
	top: clamp(top, EDGE_MARGIN, window.innerHeight - EDGE_MARGIN - size.height)
});

const ARROW_STEPS: Record<string, [number, number]> = {
	ArrowLeft: [-1, 0],
	ArrowRight: [1, 0],
	ArrowUp: [0, -1],
	ArrowDown: [0, 1]
};

/** M3 `label/large`, the snackbar's action text. */
const actionButtonSx = {
	'color': m3SnackbarColors.action,
	'fontSize': 14,
	'fontWeight': 500,
	'lineHeight': '20px',
	'letterSpacing': '0.1px',
	'textTransform': 'none',
	'minWidth': 0,
	'px': 1,
	'py': 0.5,
	'whiteSpace': 'nowrap',
	'flexShrink': 0,
	'&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.08)' },
	'&:focus-visible': {
		outline: `2px solid ${m3SnackbarColors.action}`,
		outlineOffset: 2
	}
} as const;

export interface PracticeBannerProps {
	/** Defaults to the practice tours; stories and tests pass their own. */
	tours?: TourDefinition[];
}

/**
 * Persistent note that practice mode is on (spec 3.2). Names the flow, shows
 * "Step i of N", says it is a practice case without real data, and offers End
 * and Restart. There is no way to dismiss it: practice must never be mistaken
 * for real work. It can be moved out of the way, by pointer or with the arrow
 * keys on its handle, and stays inside the viewport. Desktop only: practice
 * cannot be started on a phone.
 *
 * Same surface as the M3 snackbar (inverse roles, elevation 3), but its own
 * component: the snackbar stack auto-hides and folds, this one must not.
 */
export const PracticeBanner = ({
	tours = practiceTours
}: PracticeBannerProps) => {
	const { t: translate } = useTranslation();
	const practice = usePractice();
	const progress = usePracticeTourProgress();
	const setLaunchRequest = useSetAtom(tourLaunchRequestAtom);
	const bannerRef = useRef<HTMLDivElement>(null);
	const dragRef = useRef<{
		pointerX: number;
		pointerY: number;
		left: number;
		top: number;
		width: number;
		height: number;
	} | null>(null);
	// Null until first moved: then it rests centred at the top by CSS alone.
	const [position, setPosition] = useState<Position | null>(null);

	const isActive = practice.isPractice;
	const tour = tours.find((candidate) => candidate.id === practice.tourId);

	useEffect(() => {
		if (!position) {
			return undefined;
		}
		const keepInView = () => {
			const rect = bannerRef.current?.getBoundingClientRect();
			if (rect) {
				setPosition(clampToViewport(position, rect));
			}
		};
		window.addEventListener('resize', keepInView);
		return () => window.removeEventListener('resize', keepInView);
	}, [position]);

	const handlePointerDown = useCallback(
		(event: React.PointerEvent<HTMLElement>) => {
			const rect = bannerRef.current?.getBoundingClientRect();
			if (event.button !== 0 || !rect) {
				return;
			}
			event.currentTarget.setPointerCapture?.(event.pointerId);
			dragRef.current = {
				pointerX: event.clientX,
				pointerY: event.clientY,
				left: rect.left,
				top: rect.top,
				width: rect.width,
				height: rect.height
			};
		},
		[]
	);

	const handlePointerMove = useCallback(
		(event: React.PointerEvent<HTMLElement>) => {
			const drag = dragRef.current;
			if (!drag) {
				return;
			}
			setPosition(
				clampToViewport(
					{
						left: drag.left + event.clientX - drag.pointerX,
						top: drag.top + event.clientY - drag.pointerY
					},
					drag
				)
			);
		},
		[]
	);

	const endDrag = useCallback((event: React.PointerEvent<HTMLElement>) => {
		dragRef.current = null;
		event.currentTarget.releasePointerCapture?.(event.pointerId);
	}, []);

	const handleKeyDown = useCallback(
		(event: React.KeyboardEvent<HTMLElement>) => {
			const direction = ARROW_STEPS[event.key];
			const rect = bannerRef.current?.getBoundingClientRect();
			if (!direction || !rect) {
				return;
			}
			event.preventDefault();
			const step = event.shiftKey ? KEY_STEP_LARGE : KEY_STEP;
			setPosition(
				clampToViewport(
					{
						left: rect.left + direction[0] * step,
						top: rect.top + direction[1] * step
					},
					rect
				)
			);
		},
		[]
	);

	const endPractice = useCallback(() => {
		// The host unmounts the adapter without a terminal write, so an ended
		// run stays "in progress" instead of counting as skipped.
		setLaunchRequest(null);
		practice.exit();
	}, [practice, setLaunchRequest]);

	const restartPractice = useCallback(() => {
		if (!practice.tourId) {
			return;
		}
		const tourId = practice.tourId;
		// The host remounts the run (end + enter on the same guard); the new
		// run resets the fixtures through the restart handlers.
		setLaunchRequest((previous) =>
			nextPracticeLaunchRequest(tourId, 'restart', previous)
		);
	}, [practice.tourId, setLaunchRequest]);

	if (!isActive) {
		return null;
	}

	return (
		<Box
			ref={bannerRef}
			role="status"
			aria-label={translate('practice.banner.title')}
			data-testid="practice-banner"
			style={{
				position: 'fixed',
				zIndex: PRACTICE_BANNER_Z_INDEX,
				top: position ? position.top : RESTING_TOP,
				...(position
					? { left: position.left }
					: { left: '50%', transform: 'translateX(-50%)' })
			}}
			sx={{
				boxSizing: 'border-box',
				display: 'flex',
				alignItems: 'center',
				gap: 1,
				width: 'max-content',
				maxWidth: `calc(100vw - ${EDGE_MARGIN * 2}px)`,
				px: 1,
				py: 0.5,
				backgroundColor: m3SnackbarColors.surface,
				color: m3SnackbarColors.onSurface,
				borderRadius: '4px',
				boxShadow: M3_SNACKBAR_ELEVATION
			}}
		>
			<ButtonBase
				aria-label={translate('practice.banner.moveHandle')}
				onPointerDown={handlePointerDown}
				onPointerMove={handlePointerMove}
				onPointerUp={endDrag}
				onPointerCancel={endDrag}
				onKeyDown={handleKeyDown}
				sx={{
					'color': m3SnackbarColors.onSurface,
					'cursor': 'grab',
					'touchAction': 'none',
					'borderRadius': '4px',
					'p': 0.5,
					'&:active': { cursor: 'grabbing' },
					'&:focus-visible': {
						outline: `2px solid ${m3SnackbarColors.onSurface}`,
						outlineOffset: 2
					}
				}}
			>
				<DragIndicatorRoundedIcon sx={{ fontSize: 20 }} />
			</ButtonBase>
			<Box sx={{ minWidth: 0, py: '6px' }}>
				{tour && (
					<Box
						sx={{
							fontSize: 14,
							fontWeight: 500,
							lineHeight: '20px',
							letterSpacing: '0.25px',
							overflowWrap: 'anywhere'
						}}
					>
						{translate(tour.titleKey)}
					</Box>
				)}
				<Box
					sx={{
						fontSize: 12,
						lineHeight: '16px',
						letterSpacing: '0.4px'
					}}
				>
					{progress && progress.tourId === practice.tourId && (
						<>
							{translate('practice.banner.progress', {
								current: progress.stepIndex + 1,
								total: progress.stepCount
							})}
							{' · '}
						</>
					)}
					{translate('practice.banner.note')}
				</Box>
			</Box>
			<Box
				sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 1 }}
			>
				<Button
					variant="text"
					onClick={restartPractice}
					sx={actionButtonSx}
				>
					{translate('practice.banner.restart')}
				</Button>
				<Button
					variant="text"
					onClick={endPractice}
					sx={actionButtonSx}
				>
					{translate('practice.banner.end')}
				</Button>
			</Box>
		</Box>
	);
};
