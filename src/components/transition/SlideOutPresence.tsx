import * as React from 'react';
import { Box, SxProps, Theme } from '@mui/material';
import { transitionMotion } from './transitionMotion';
import { useReducedMotion } from './useReducedMotion';
import { usePresence } from './usePresence';

export interface SlideOutPresenceProps {
	/** False starts the exit; the element is removed when it has played. */
	present: boolean;
	className?: string;
	sx?: SxProps<Theme>;
	children: React.ReactNode;
}

/**
 * An element that slides out instead of vanishing when it stops applying —
 * the login button once the account is being created. The caller says only
 * whether it is present; where it goes and how long it takes is the
 * platform's. Reduced motion removes it at once.
 */
export const SlideOutPresence = ({
	present,
	className,
	sx,
	children
}: SlideOutPresenceProps) => {
	const reducedMotion = useReducedMotion();
	const { mounted, leaving } = usePresence(
		present,
		reducedMotion ? 0 : transitionMotion.exitMs
	);

	if (!mounted) {
		return null;
	}

	return (
		<Box
			className={className}
			data-presence={leaving ? 'leaving' : 'present'}
			aria-hidden={leaving || undefined}
			inert={leaving || undefined}
			sx={[
				leaving && {
					'pointerEvents': 'none',
					'animation': `slideOutToRight ${transitionMotion.exitMs}ms ${transitionMotion.easeOut} both`,
					'@keyframes slideOutToRight': {
						from: { transform: 'none', opacity: 1 },
						to: { transform: 'translateX(32px)', opacity: 0 }
					}
				},
				...(Array.isArray(sx) ? sx : sx ? [sx] : [])
			]}
		>
			{children}
		</Box>
	);
};
