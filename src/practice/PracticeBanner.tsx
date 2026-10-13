import * as React from 'react';
import { createPortal } from 'react-dom';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Button, ButtonBase } from '@mui/material';
import DragIndicatorRoundedIcon from '@mui/icons-material/DragIndicatorRounded';
import { useSetAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import {
	M3_SNACKBAR_ELEVATION,
	M3_SNACKBAR_MESSAGE_TYPOGRAPHY,
	M3_SNACKBAR_SHAPE,
	m3SnackbarActionSx,
	m3SnackbarColors,
	m3SnackbarFocusRing
} from '../components/m3Snackbar/M3Snackbar';
import { tourLaunchRequestAtom } from '../components/productTour/tourLaunchState';
import type { TourDefinition } from '../components/productTour/types';
import { usePractice } from './PracticeProvider';
import { PRACTICE_BANNER_RESTING } from './practiceBannerPlacement';
import { nextPracticeLaunchRequest } from './practiceLaunch';
import { practiceTours } from './practiceTours';
import { usePracticeTourProgress } from './usePracticeTourProgress';

const EDGE_MARGIN = 8;
const KEY_STEP = 16;
const KEY_STEP_LARGE = 64;

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

/** M3 `body/small`, the progress and the practice note. */
const bodySmallTypography = {
	fontSize: 12,
	lineHeight: '16px',
	letterSpacing: '0.4px'
} as const;

export interface PracticeBannerProps {
	/** Defaults to the practice tours; stories and tests pass their own. */
	tours?: TourDefinition[];
}

/**
 * Persistent note that practice mode is on. Names the flow, shows "Step i of
 * N", says it is a practice case without real data, and offers End and
 * Restart. There is no way to dismiss it: practice must never be mistaken for
 * real work. It rests at the bottom of the list column, clear of every tour
 * step, and can be moved out of the way, by pointer or with the arrow keys on
 * its handle; it stays inside the viewport. Desktop only: practice cannot be
 * started on a phone.
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
	// Null until first moved: until then CSS alone keeps it at rest.
	const [position, setPosition] = useState<Position | null>(null);

	const isActive = practice.isPractice;
	// No registry lookup outside practice (release flag off: none at all).
	const tour = isActive
		? tours.find((candidate) => candidate.id === practice.tourId)
		: undefined;

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

	// A page-level portal escapes the app's stacking contexts. Practice
	// controls stay above dialogs and join the supervisor picker's focus trap.
	return createPortal(
		<Box
			ref={bannerRef}
			role="status"
			aria-label={translate('practice.banner.title')}
			data-testid="practice-banner"
			data-practice-controls=""
			style={{
				position: 'fixed',
				...(position
					? { left: position.left, top: position.top }
					: {
							left: PRACTICE_BANNER_RESTING.left,
							bottom: PRACTICE_BANNER_RESTING.bottom
						})
			}}
			sx={{
				zIndex: (theme) => theme.zIndex.tooltip,
				boxSizing: 'border-box',
				display: 'flex',
				flexDirection: 'column',
				gap: 0.5,
				width: PRACTICE_BANNER_RESTING.width,
				maxWidth: `calc(100vw - ${EDGE_MARGIN * 2}px)`,
				p: 0.5,
				backgroundColor: m3SnackbarColors.surface,
				color: m3SnackbarColors.onSurface,
				borderRadius: M3_SNACKBAR_SHAPE,
				boxShadow: M3_SNACKBAR_ELEVATION
			}}
		>
			<Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
				<Box
					sx={{
						flex: 1,
						minWidth: 0,
						pl: 1.5,
						pt: 0.5,
						overflowWrap: 'anywhere'
					}}
				>
					{tour && (
						<Box
							sx={{
								...M3_SNACKBAR_MESSAGE_TYPOGRAPHY,
								fontWeight: 500
							}}
						>
							{translate(tour.titleKey)}
						</Box>
					)}
					<Box sx={bodySmallTypography}>
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
						'borderRadius': M3_SNACKBAR_SHAPE,
						'p': 0.5,
						'flexShrink': 0,
						'&:active': { cursor: 'grabbing' },
						'&:focus-visible': m3SnackbarFocusRing(
							m3SnackbarColors.onSurface
						)
					}}
				>
					<DragIndicatorRoundedIcon sx={{ fontSize: 20 }} />
				</ButtonBase>
			</Box>
			{/* The actions get the full width: side by side in German and
			    English, wrapped where a language needs more room. */}
			<Box
				sx={{
					display: 'flex',
					flexWrap: 'wrap',
					justifyContent: 'flex-end',
					gap: 0.5
				}}
			>
				<Button
					variant="text"
					onClick={restartPractice}
					sx={m3SnackbarActionSx}
				>
					{translate('practice.banner.restart')}
				</Button>
				<Button
					variant="text"
					onClick={endPractice}
					sx={m3SnackbarActionSx}
				>
					{translate('practice.banner.end')}
				</Button>
			</Box>
		</Box>,
		document.body
	);
};
