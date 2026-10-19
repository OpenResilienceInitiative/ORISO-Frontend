import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Button } from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import { registrationMd3 } from '../../registration/registrationDesign/registrationDesign';
import { prefersReducedMotion } from '../../../hooks/usePrefersReducedMotion';

/** How long the panel takes to slide in or out. Mirrored in the keyframes. */
const SLIDE_MS = 320;

export interface EntryRoomPanelProps {
	/** Back to the waiting room. Called once the slide-back has played. */
	onBack: () => void;
	/** The back control's label, already translated. */
	backLabel: string;
	backTestId: string;
	dataCy: string;
	children: React.ReactNode;
}

/**
 * A panel that takes the waiting room's middle — "Mehr erfahren" and
 * "Nächste Termine" (#1689). It comes in from the right edge and moves left
 * into place, and it leaves the same way it came — Frank asked for the "back
 * and forth" explicitly. `prefers-reduced-motion` gets neither, the panel is
 * simply there and simply gone. Escape and the browser's back go back too.
 */
export const EntryRoomPanel = ({
	onBack,
	backLabel,
	backTestId,
	dataCy,
	children
}: EntryRoomPanelProps) => {
	const [leaving, setLeaving] = useState(false);
	/* The slide-out may end twice (animationend and the timer); the waiting
	   room must come back once. */
	const done = useRef(false);
	const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

	const finish = useCallback(() => {
		if (done.current) {
			return;
		}
		done.current = true;
		onBack();
	}, [onBack]);

	const requestBack = useCallback(() => {
		if (done.current || leaving) {
			return;
		}
		if (prefersReducedMotion()) {
			finish();
			return;
		}
		setLeaving(true);
		/* jsdom and any browser that drops the animation never fire
		   `animationend`; the timer is what guarantees the way back. */
		timer.current = setTimeout(finish, SLIDE_MS);
	}, [finish, leaving]);

	useEffect(() => () => clearTimeout(timer.current), []);

	/* Escape closes the panel like any other overlay. */
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				requestBack();
			}
		};
		document.addEventListener('keydown', onKeyDown);
		return () => document.removeEventListener('keydown', onKeyDown);
	}, [requestBack]);

	/* The panel is a step, not a page: a marker entry makes the browser's
	   back button (and the phone's back gesture) mean "back to the waiting
	   room" instead of "leave the group". Popped again on the way out so the
	   history does not grow with every look. */
	const finishRef = useRef(finish);
	finishRef.current = finish;
	useEffect(() => {
		window.history.pushState({ groupInfoGallery: true }, '');
		const onPopState = () => finishRef.current();
		window.addEventListener('popstate', onPopState);
		return () => {
			window.removeEventListener('popstate', onPopState);
			if (window.history.state?.groupInfoGallery) {
				window.history.back();
			}
		};
	}, []);

	return (
		<Box
			data-cy={dataCy}
			sx={{
				// Clips its own child while that child sits off to the right,
				// so the slide never adds a horizontal scrollbar to the page.
				overflow: 'hidden',
				width: '100%',
				display: 'flex',
				flexDirection: 'column',
				flex: 1,
				minHeight: 0
			}}
		>
			<Box
				onAnimationEnd={leaving ? finish : undefined}
				sx={{
					'display': 'flex',
					'flexDirection': 'column',
					'flex': 1,
					'minHeight': 0,
					/* Content can be more than the column has left; the panel
					   scrolls inside itself rather than pushing the page, which
					   would move the bar. */
					'overflowY': 'auto',
					'animation': `${
						leaving ? 'groupInfoGalleryOut' : 'groupInfoGalleryIn'
					} ${SLIDE_MS}ms cubic-bezier(0.4,0,0.2,1) both`,
					// In from the right edge, moving left into place; out the
					// same way (Frank: "nach links sliden … und auch ein
					// Backbutton, um zum Warteraum zurückzukehren").
					'@keyframes groupInfoGalleryIn': {
						from: { transform: 'translateX(100%)', opacity: 0 },
						to: { transform: 'translateX(0)', opacity: 1 }
					},
					'@keyframes groupInfoGalleryOut': {
						from: { transform: 'translateX(0)', opacity: 1 },
						to: { transform: 'translateX(100%)', opacity: 0 }
					},
					'@media (prefers-reduced-motion: reduce)': {
						animation: 'none'
					}
				}}
			>
				<Box
					sx={{
						display: 'flex',
						alignItems: 'center',
						mb: { xs: 1.5, sm: 2 }
					}}
				>
					{/* Outlined, not a text link: the way back has to be
					    found at a glance (Frank, 2026-10-19: "sichtbarer
					    machen"). */}
					<Button
						variant="outlined"
						onClick={requestBack}
						data-testid={backTestId}
						startIcon={<ArrowBackRoundedIcon />}
						size="small"
						sx={{
							'minHeight': 36,
							'py': 0.5,
							'px': 1.5,
							'fontSize': 14,
							'fontWeight': 600,
							'textTransform': 'none',
							'color': registrationMd3.onSurface,
							'borderColor': registrationMd3.outline,
							'& .MuiButton-startIcon': { mr: 0.75 }
						}}
					>
						{backLabel}
					</Button>
				</Box>
				{children}
			</Box>
		</Box>
	);
};
