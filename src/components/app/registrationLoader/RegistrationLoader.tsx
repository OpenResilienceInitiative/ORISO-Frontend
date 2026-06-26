import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { keyframes } from '@mui/system';
import { alpha } from '@mui/material/styles';
import { Box, LinearProgress, Typography, useMediaQuery } from '@mui/material';
import ChatBubbleRoundedIcon from '@mui/icons-material/ChatBubbleRounded';
import MailRoundedIcon from '@mui/icons-material/MailRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';

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

const flagZoomOut = keyframes`
	0% {
		transform: scale(1);
		opacity: 1;
	}
	58% {
		transform: scale(1.35);
		opacity: 1;
	}
	100% {
		transform: scale(34);
		opacity: 0;
	}
`;

const contentDrift = keyframes`
	0% {
		transform: translateY(0) scale(1);
		opacity: 1;
	}
	100% {
		transform: translateY(-10px) scale(0.98);
		opacity: 0;
	}
`;

// Keep the bar visible long enough to read as intentional even if the load is fast,
// give a short beat after "ready" for the icon to arm, and never hang forever.
const MIN_VISIBLE_MS = 1200;
const FINISH_DELAY_MS = 700;
const FINISH_ZOOM_MS = 820;
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
	const [finishing, setFinishing] = useState<boolean>(false);
	const minElapsedRef = useRef<boolean>(false);
	const finishedRef = useRef<boolean>(false);
	const onFinishRef = useRef(onFinish);
	onFinishRef.current = onFinish;

	const benefitItems = [
		{
			id: 'professional-response',
			icon: MailRoundedIcon,
			title: t('registration.welcomeScreen.info3.title'),
			text: t('registration.welcomeScreen.info3.text')
		},
		{
			id: 'anonymous-free',
			icon: LockRoundedIcon,
			title: t('registration.welcomeScreen.info4.title'),
			text: t('registration.welcomeScreen.info4.text')
		}
	];

	const finish = useCallback(() => {
		if (finishedRef.current) {
			return;
		}
		finishedRef.current = true;
		onFinishRef.current();
	}, []);

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
		const zoomTimer = setTimeout(() => {
			setFinishing(true);
		}, wait + finishDelayMs);
		const finishTimer = setTimeout(
			finish,
			wait + finishDelayMs + (prefersReducedMotion ? 0 : FINISH_ZOOM_MS)
		);
		return () => {
			clearTimeout(fillTimer);
			clearTimeout(zoomTimer);
			clearTimeout(finishTimer);
		};
	}, [ready, finish, finishDelayMs, prefersReducedMotion]);

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
				overflow: 'hidden',
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
					mb: '28px',
					animation:
						finishing && !prefersReducedMotion
							? `${contentDrift} ${FINISH_ZOOM_MS}ms ease both`
							: 'none'
				}}
			>
				<LinearProgress
					variant="determinate"
					value={value}
					color="primary"
					aria-label={t('registration.loader.headline')}
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
							finishing && !prefersReducedMotion
								? `${flagZoomOut} ${FINISH_ZOOM_MS}ms cubic-bezier(0.2, 0, 0, 1) both`
								: armed && !prefersReducedMotion
									? `${pop} 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)`
									: 'none',
						'transformOrigin': 'center',
						'& svg': { fontSize: '20px' }
					}}
				>
					<ChatBubbleRoundedIcon />
				</Box>
			</Box>
			<Typography
				variant="h5"
				sx={{
					fontWeight: 600,
					textAlign: 'center',
					mb: '8px',
					animation:
						finishing && !prefersReducedMotion
							? `${contentDrift} ${FINISH_ZOOM_MS}ms ease both`
							: 'none'
				}}
			>
				{t('registration.loader.headline')}
			</Typography>
			<Typography
				sx={{
					color: 'text.secondary',
					textAlign: 'center',
					maxWidth: 360,
					animation:
						finishing && !prefersReducedMotion
							? `${contentDrift} ${FINISH_ZOOM_MS}ms ease both`
							: 'none'
				}}
			>
				{armed
					? t('registration.loader.ready')
					: t('registration.loader.copy')}
			</Typography>
			<Box
				sx={{
					width: '100%',
					maxWidth: 560,
					mt: { xs: 3, sm: 4 },
					display: 'grid',
					gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
					gap: 1.5,
					animation:
						finishing && !prefersReducedMotion
							? `${contentDrift} ${FINISH_ZOOM_MS}ms ease both`
							: 'none'
				}}
			>
				{benefitItems.map(({ id, icon: Icon, title, text }) => (
					<Box
						key={id}
						sx={{
							display: 'grid',
							gridTemplateColumns: '32px 1fr',
							alignItems: 'start',
							gap: 1.25,
							p: 1.5,
							borderRadius: 3,
							border: (theme) =>
								`1px solid ${alpha(theme.palette.primary.main, 0.18)}`,
							backgroundColor: (theme) =>
								alpha(theme.palette.primary.main, 0.045)
						}}
					>
						<Box
							sx={{
								width: 32,
								height: 32,
								borderRadius: '50%',
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								color: 'primary.main',
								backgroundColor: (theme) =>
									alpha(theme.palette.primary.main, 0.08)
							}}
						>
							<Icon sx={{ fontSize: 18 }} />
						</Box>
						<Box>
							<Typography
								variant="subtitle2"
								sx={{
									fontWeight: 700,
									lineHeight: 1.25,
									mb: 0.25
								}}
							>
								{title}
							</Typography>
							<Typography
								variant="body2"
								sx={{
									color: 'text.secondary',
									lineHeight: 1.35
								}}
							>
								{text}
							</Typography>
						</Box>
					</Box>
				))}
			</Box>
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
				{armed
					? t('registration.loader.ready')
					: t('registration.loader.copy')}
			</Box>
		</Box>
	);
};
