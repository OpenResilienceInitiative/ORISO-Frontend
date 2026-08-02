import * as React from 'react';
import { useMemo } from 'react';
import useMediaQuery from '@mui/material/useMediaQuery';
import Lottie from 'lottie-react';
import {
	readCssColor,
	recolorLottieAccent
} from '../emptyState/lottieColorUtils';
import { ReactComponent as CheckFallback } from '../../resources/img/illustrations/check.svg';
import { ReactComponent as EmailSentFallback } from '../../resources/img/illustrations/envelope-check.svg';
import checkAnimation from '../../resources/animations/success/check.json';
import emailSentAnimation from '../../resources/animations/success/email-sent.json';
import './animatedIllustration.styles.scss';

const ACCENT_VAR = '--oriso-lottie-success-accent-color';
const BASE_VAR = '--oriso-lottie-success-base-color';
const DEFAULT_ACCENT_COLOR = '#a5000a';
const DEFAULT_BASE_COLOR = '#444748';

/**
 * The Overlay renders its illustration through an SVG component signature, so
 * these accept (and ignore) SVG props to stay drop-in for the static assets.
 */
type IllustrationProps = React.SVGProps<SVGSVGElement> & { title?: string };

interface AnimatedIllustrationProps extends IllustrationProps {
	animationData: Record<string, any>;
	/** Shown verbatim when the user asked for reduced motion. */
	fallback: React.FunctionComponent<IllustrationProps>;
	variant: string;
}

export const AnimatedIllustration = ({
	animationData,
	fallback: Fallback,
	variant,
	...svgProps
}: AnimatedIllustrationProps) => {
	// Matches the reduced-motion treatment the registration flow already uses:
	// the confirmation still reads, it just does not move.
	const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
	const accentColor = readCssColor(ACCENT_VAR, DEFAULT_ACCENT_COLOR);
	const baseColor = readCssColor(BASE_VAR, DEFAULT_BASE_COLOR);
	const themedAnimationData = useMemo(
		() => recolorLottieAccent(animationData, accentColor, baseColor),
		[accentColor, animationData, baseColor]
	);

	if (reduceMotion) {
		return (
			<Fallback
				aria-hidden="true"
				data-animated-illustration={variant}
				{...svgProps}
			/>
		);
	}

	return (
		<div
			aria-hidden="true"
			className="animatedIllustration"
			data-accent-color={accentColor.toLowerCase()}
			data-animated-illustration={variant}
			data-base-color={baseColor.toLowerCase()}
		>
			<Lottie
				animationData={themedAnimationData}
				autoplay
				loop={false}
				rendererSettings={{ preserveAspectRatio: 'xMidYMid meet' }}
			/>
		</div>
	);
};

export const CheckAnimation = (props: IllustrationProps) => (
	<AnimatedIllustration
		animationData={checkAnimation}
		fallback={CheckFallback}
		variant="check"
		{...props}
	/>
);

export const EmailSentAnimation = (props: IllustrationProps) => (
	<AnimatedIllustration
		animationData={emailSentAnimation}
		fallback={EmailSentFallback}
		variant="email-sent"
		{...props}
	/>
);
