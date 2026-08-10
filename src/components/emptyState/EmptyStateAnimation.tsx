import * as React from 'react';
import { AnimatedIllustration } from '../animatedIllustration/AnimatedIllustration';

const DECORATIVE_ACCENT_VAR = '--oriso-lottie-accent-color';
const DECORATIVE_BASE_VAR = '--oriso-lottie-secondary-color';

interface EmptyStateAnimationProps {
	animationData: Record<string, any>;
	accentColorVar?: string;
	secondaryColorVar?: string;
	variant: string;
}

/**
 * Empty-state preset over the shared player. It only picks the decorative role
 * pair and keeps the `emptyState__animation` hook its styles and E2E selectors
 * rely on — playback (slow, played once) belongs to the player, not here.
 */
export const EmptyStateAnimation = ({
	accentColorVar = DECORATIVE_ACCENT_VAR,
	animationData,
	secondaryColorVar = DECORATIVE_BASE_VAR,
	variant
}: EmptyStateAnimationProps) => (
	<AnimatedIllustration
		accentColorVar={accentColorVar}
		animationData={animationData}
		baseColorVar={secondaryColorVar}
		className="emptyState__animation"
		hostProps={{
			'data-cy': 'empty-state-animation',
			'data-empty-state': variant
		}}
		variant={variant}
	/>
);
