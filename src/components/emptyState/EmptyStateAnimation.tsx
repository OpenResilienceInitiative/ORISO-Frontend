import * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import Lottie, { LottieRefCurrentProps } from 'lottie-react';
import { recolorLottieAccent } from './lottieColorUtils';

const DEFAULT_ACCENT_COLOR = '#ffb4aa';
const DEFAULT_SECONDARY_COLOR = '#646d78';

const readCssColor = (cssVariableName: string, fallbackColor: string) => {
	if (typeof window === 'undefined') {
		return fallbackColor;
	}

	const value = getComputedStyle(document.documentElement)
		.getPropertyValue(cssVariableName)
		.trim();

	return /^#[0-9a-f]{6}$/i.test(value) ? value : fallbackColor;
};

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

	useEffect(() => {
		lottieRef.current?.setSpeed(speed);
	}, [speed]);

	return (
		<div
			aria-hidden="true"
			className="emptyState__animation"
			data-accent-color={accentColor.toLowerCase()}
			data-complete={playbackState === 'complete' ? 'true' : 'false'}
			data-cy="empty-state-animation"
			data-empty-state={variant}
			data-loop="false"
			data-secondary-color={secondaryColor.toLowerCase()}
			data-speed={speed}
		>
			<Lottie
				animationData={recoloredAnimationData}
				autoplay
				loop={false}
				lottieRef={lottieRef}
				onComplete={() => setPlaybackState('complete')}
				onDOMLoaded={() => lottieRef.current?.setSpeed(speed)}
				rendererSettings={{
					preserveAspectRatio: 'xMidYMid meet'
				}}
			/>
		</div>
	);
};
