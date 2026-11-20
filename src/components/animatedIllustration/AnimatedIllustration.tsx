import * as React from 'react';
import {
	useEffect,
	useMemo,
	useRef,
	useState,
	useSyncExternalStore
} from 'react';
import useMediaQuery from '@mui/material/useMediaQuery';
import clsx from 'clsx';
import Lottie, { LottieRefCurrentProps } from 'lottie-react';
import {
	readCssColor,
	recolorLottieAccent
} from '../emptyState/lottieColorUtils';
import { ReactComponent as CheckFallback } from '../../resources/img/illustrations/check.svg';
import { ReactComponent as EmailSentFallback } from '../../resources/img/illustrations/envelope-check.svg';
import checkAnimation from '../../resources/animations/success/check.json';
import emailSentAnimation from '../../resources/animations/success/email-sent.json';
import { THEME_APPLIED_EVENT } from '../../utils/theme/themeEvents';
import './animatedIllustration.styles.scss';

/**
 * The product-wide playback policy. Every animation in the app runs at this
 * speed and plays exactly once — nothing loops, nothing spins in the
 * background. Deliberately not a prop: a per-caller speed is how the two
 * previous players drifted apart.
 */
export const ANIMATION_SPEED = 0.5;
export const ANIMATION_LOOPS = false;

const SUCCESS_ACCENT_VAR = '--oriso-lottie-success-accent-color';
const SUCCESS_BASE_VAR = '--oriso-lottie-success-base-color';
const DEFAULT_ACCENT_COLOR = '#a5000a';
const DEFAULT_BASE_COLOR = '#444748';

const subscribeToPalette = (refresh: () => void) => {
	window.addEventListener(THEME_APPLIED_EVENT, refresh);
	return () => window.removeEventListener(THEME_APPLIED_EVENT, refresh);
};

/**
 * The Overlay renders its illustration through an SVG component signature, so
 * these accept (and ignore) SVG props to stay drop-in for the static assets.
 */
type IllustrationProps = React.SVGProps<SVGSVGElement> & { title?: string };

interface AnimatedIllustrationProps extends IllustrationProps {
	animationData: Record<string, any>;
	/**
	 * Shown when the user asks for reduced motion. Without one, the player
	 * shows the final frame of the same illustration.
	 */
	fallback?: React.FunctionComponent<IllustrationProps>;
	variant: string;
	/** Role pair to recolour onto. Defaults to the full brand role. */
	accentColorVar?: string;
	baseColorVar?: string;
	/** Extra attributes the presets below use to keep their own selectors. */
	hostProps?: Record<string, string>;
}

export const AnimatedIllustration = ({
	accentColorVar = SUCCESS_ACCENT_VAR,
	animationData,
	baseColorVar = SUCCESS_BASE_VAR,
	className,
	fallback: Fallback,
	hostProps,
	variant,
	...svgProps
}: AnimatedIllustrationProps) => {
	// Matches the reduced-motion treatment the registration flow already uses:
	// the illustration still reads, it just does not move.
	const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
	const lottieRef = useRef<LottieRefCurrentProps | null>(null);
	const [isComplete, setIsComplete] = useState(false);
	const [accentColor, baseColor] = useSyncExternalStore(
		subscribeToPalette,
		() =>
			`${readCssColor(accentColorVar, DEFAULT_ACCENT_COLOR)} ${readCssColor(baseColorVar, DEFAULT_BASE_COLOR)}`,
		() => `${DEFAULT_ACCENT_COLOR} ${DEFAULT_BASE_COLOR}`
	).split(' ');
	const themedAnimationData = useMemo(
		() => recolorLottieAccent(animationData, accentColor, baseColor),
		[accentColor, animationData, baseColor]
	);

	useEffect(() => {
		setIsComplete(false);
		lottieRef.current?.setSpeed(ANIMATION_SPEED);
	}, [animationData, variant]);

	const hostAttributes = {
		'aria-hidden': true,
		'data-animated-illustration': variant,
		...hostProps
	};

	if (reduceMotion && Fallback)
		return (
			<Fallback className={className} {...hostAttributes} {...svgProps} />
		);

	const showStillFrame = reduceMotion || isComplete;

	return (
		<div
			className={clsx('animatedIllustration', className)}
			data-accent-color={accentColor.toLowerCase()}
			data-base-color={baseColor.toLowerCase()}
			data-complete={isComplete ? 'true' : 'false'}
			data-loop={String(ANIMATION_LOOPS)}
			data-secondary-color={baseColor.toLowerCase()}
			data-speed={String(ANIMATION_SPEED)}
			{...hostAttributes}
		>
			<Lottie
				key={reduceMotion ? 'still' : 'animated'}
				animationData={themedAnimationData}
				autoplay={!showStillFrame}
				loop={ANIMATION_LOOPS}
				lottieRef={lottieRef}
				onComplete={() => setIsComplete(true)}
				onDOMLoaded={() => {
					if (showStillFrame) {
						const frames =
							(animationData.op ?? 1) - (animationData.ip ?? 0);
						lottieRef.current?.goToAndStop(
							Math.max(0, Math.ceil(frames) - 1),
							true
						);
					} else {
						lottieRef.current?.setSpeed(ANIMATION_SPEED);
					}
				}}
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
