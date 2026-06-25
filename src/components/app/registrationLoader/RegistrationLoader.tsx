import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { keyframes } from '@mui/system';
import { alpha } from '@mui/material/styles';
import { Box, LinearProgress, Typography, useMediaQuery } from '@mui/material';
import ChatBubbleRoundedIcon from '@mui/icons-material/ChatBubbleRounded';

interface RegistrationLoaderProps {
	/** The real "everything loaded" signal from the app bootstrap (appReady). */
	ready: boolean;
	/** Called once the completion animation has played; the app then renders. */
	onFinish: () => void;
}

const pop = keyframes`
	0%   { transform: scale(1); }
	55%  { transform: scale(1.22); }
	100% { transform: scale(1.1); }
`;

const fadeIn = keyframes`
	from { opacity: 0; }
	to   { opacity: 1; }
`;

// Keep the bar visible long enough to read as intentional even if the load is fast,
// give a short beat after "ready" for the icon to arm, and never hang forever.
const MIN_VISIBLE_MS = 1200;
const FINISH_DELAY_MS = 700;
const SAFETY_MS = 20000;

/**
 * Post-registration welcome loader. Shown by AuthenticatedApp during the real app
 * bootstrap (user data + consulting types + Matrix init) only for a freshly
 * registered asker. The progress line fills while loading; when `ready` (appReady)
 * arrives it tops off to 100% and the chat icon arms (red + pop), then `onFinish`
 * hands over to the real chat room (WriteEnquiry). Mirrors the validated prototype.
 */
export const RegistrationLoader = ({
	ready,
	onFinish
}: RegistrationLoaderProps) => {
	const { t } = useTranslation();
	const prefersReducedMotion = useMediaQuery(
		'(prefers-reduced-motion: reduce)'
	);
	const finishDelayMs = prefersReducedMotion ? 0 : FINISH_DELAY_MS;
	const [value, setValue] = useState<number>(8);
	const [armed, setArmed] = useState<boolean>(false);
	const minElapsedRef = useRef<boolean>(false);
	const finishedRef = useRef<boolean>(false);

	const finish = useCallback(() => {
		if (finishedRef.current) {
			return;
		}
		finishedRef.current = true;
		onFinish();
	}, [onFinish]);

	// On mount: ease the bar toward 85% (a progress bar that waits near the end
	// until the real "loaded" signal tops it off) and arm the min-visible timer.
	useEffect(() => {
		const raf = requestAnimationFrame(() => setValue(85));
		const minTimer = setTimeout(() => {
			minElapsedRef.current = true;
		}, MIN_VISIBLE_MS);
		const safetyTimer = setTimeout(finish, SAFETY_MS);
		return () => {
			cancelAnimationFrame(raf);
			clearTimeout(minTimer);
			clearTimeout(safetyTimer);
		};
	}, [finish]);

	// When the app is ready, top off to 100%, arm the icon, then hand over.
	useEffect(() => {
		if (!ready) {
			return;
		}
		const wait = minElapsedRef.current ? 0 : MIN_VISIBLE_MS;
		const fillTimer = setTimeout(() => {
			setValue(100);
			setArmed(true);
		}, wait);
		const finishTimer = setTimeout(finish, wait + finishDelayMs);
		return () => {
			clearTimeout(fillTimer);
			clearTimeout(finishTimer);
		};
	}, [ready, finish, finishDelayMs]);

	return (
		<Box
			data-cy="registration-loader"
			sx={{
				position: 'fixed',
				inset: 0,
				zIndex: (theme) => theme.zIndex.modal,
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				justifyContent: 'center',
				p: '24px',
				backgroundColor: 'background.paper',
				animation: prefersReducedMotion
					? 'none'
					: `${fadeIn} 0.3s ease both`
			}}
		>
			<Box
				sx={{
					width: '100%',
					maxWidth: '360px',
					display: 'flex',
					alignItems: 'center',
					gap: '16px',
					mb: '28px'
				}}
			>
				<LinearProgress
					variant="determinate"
					value={value}
					color="primary"
					sx={{
						'flex': 1,
						'height': '6px',
						'borderRadius': '3px',
						'backgroundColor': (theme) =>
							alpha(theme.palette.common.black, 0.1),
						'& .MuiLinearProgress-bar': {
							borderRadius: '3px',
							transition: prefersReducedMotion
								? 'none'
								: value >= 100
									? 'transform 0.35s ease-out'
									: 'transform 2s cubic-bezier(0.4, 0, 0.2, 1)'
						}
					}}
				/>
				<Box
					sx={{
						'width': '40px',
						'height': '40px',
						'flexShrink': 0,
						'borderRadius': '50%',
						'display': 'flex',
						'alignItems': 'center',
						'justifyContent': 'center',
						'backgroundColor': armed
							? 'primary.main'
							: 'action.hover',
						'color': armed ? 'common.white' : 'text.secondary',
						'transform':
							armed && !prefersReducedMotion
								? 'scale(1.1)'
								: 'scale(1)',
						'boxShadow': (theme) =>
							armed
								? `0 6px 16px ${alpha(theme.palette.primary.main, 0.35)}`
								: 'none',
						'transition': prefersReducedMotion
							? 'background-color 0.3s ease'
							: 'background-color 0.3s ease, transform 0.3s ease',
						'animation':
							armed && !prefersReducedMotion
								? `${pop} 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)`
								: 'none',
						'& svg': { fontSize: '20px' }
					}}
				>
					<ChatBubbleRoundedIcon />
				</Box>
			</Box>
			<Typography
				variant="h5"
				sx={{ fontWeight: 600, textAlign: 'center', mb: '8px' }}
			>
				{t('registration.loader.headline')}
			</Typography>
			<Typography sx={{ color: 'text.secondary', textAlign: 'center' }}>
				{ready
					? t('registration.loader.ready')
					: t('registration.loader.copy')}
			</Typography>
			<Box
				role="status"
				aria-live="polite"
				sx={{
					position: 'absolute',
					width: '1px',
					height: '1px',
					p: 0,
					m: '-1px',
					overflow: 'hidden',
					clip: 'rect(0 0 0 0)',
					whiteSpace: 'nowrap'
				}}
			>
				{ready
					? t('registration.loader.ready')
					: t('registration.loader.copy')}
			</Box>
		</Box>
	);
};
