import * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import useMediaQuery from '@mui/material/useMediaQuery';
import Lottie, { LottieRefCurrentProps } from 'lottie-react';
import { readCssColor, recolorLottieAccent } from './lottieColorUtils';

const DEFAULT_ACCENT_COLOR = '#ffb4aa';
const DEFAULT_SECONDARY_COLOR = '#646d78';

interface EmptyStateAnimationProps {
	animationData: Record<string, any>;
	accentColorVar?: string;
	secondaryColorVar?: string;
	speed?: number;
	variant: string;
}

export const EmptyStateAnimation = ({
	animationData,
	accentColorVar = '--oriso-lottie-accent-color',
	secondaryColorVar = '--oriso-lottie-secondary-color',
	speed = 0.5,
	variant
}: EmptyStateAnimationProps) => {
	const lottieRef = useRef<LottieRefCurrentProps | null>(null);
	// Same treatment as AnimatedIllustration: the illustration still reads,
	// it just does not move — we show its resting (final) frame instead.
	const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
	const [playbackState, setPlaybackState] = useState('playing');
	const accentColor = readCssColor(accentColorVar, DEFAULT_ACCENT_COLOR);
	const secondaryColor = readCssColor(
		secondaryColorVar,
		DEFAULT_SECONDARY_COLOR
	);
	const recoloredAnimationData = useMemo(
		() => recolorLottieAccent(animationData, accentColor, secondaryColor),
		[accentColor, animationData, secondaryColor]
	);

	const showFinalFrame = () => {
		const totalFrames = lottieRef.current?.getDuration(true) ?? 1;
		lottieRef.current?.goToAndStop(Math.max(totalFrames - 1, 0), true);
	};

	useEffect(() => {
		if (reduceMotion) {
			return;
		}
		lottieRef.current?.setSpeed(speed);
	}, [reduceMotion, speed]);

	useEffect(() => {
		if (reduceMotion) {
			setPlaybackState('complete');
			showFinalFrame();
			return;
		}
		setPlaybackState('playing');
		lottieRef.current?.setSpeed(speed);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [animationData, reduceMotion, speed, variant]);

	return (
		<div
			aria-hidden="true"
			className="emptyState__animation"
			data-accent-color={accentColor.toLowerCase()}
			data-complete={playbackState === 'complete' ? 'true' : 'false'}
			data-cy="empty-state-animation"
			data-empty-state={variant}
			data-loop="false"
			data-reduced-motion={reduceMotion ? 'true' : 'false'}
			data-secondary-color={secondaryColor.toLowerCase()}
			data-speed={speed}
		>
			<Lottie
				animationData={recoloredAnimationData}
				autoplay={!reduceMotion}
				loop={false}
				lottieRef={lottieRef}
				onComplete={() => setPlaybackState('complete')}
				onDOMLoaded={() =>
					reduceMotion
						? showFinalFrame()
						: lottieRef.current?.setSpeed(speed)
				}
				rendererSettings={{
					preserveAspectRatio: 'xMidYMid meet'
				}}
			/>
		</div>
	);
};
