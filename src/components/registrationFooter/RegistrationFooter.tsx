import * as React from 'react';
import { Box, Button } from '@mui/material';
import {
	registrationMd3,
	registrationMotion
} from '../registration/registrationDesign/registrationDesign';

export interface RegistrationFooterAction {
	/** Already translated. This component never calls `t`. */
	label: string;
	onClick?: () => void;
	disabled?: boolean;
	/**
	 * Full label for the tooltip when the visible one is truncated. Defaults to
	 * `label`, which is what you want in every normal case.
	 */
	title?: string;
	/** Overrides the generated `data-testid`. */
	testId?: string;
	/**
	 * Take only the room the label needs and leave the rest to the other
	 * action. For a quiet exit beside a long, important way on (Frank,
	 * 2026-09-05: "der andere muss ja nicht gleich groß sein").
	 */
	compact?: boolean;
}

export interface RegistrationFooterProps {
	/**
	 * The way on. Omit it only when `children` already carries the whole
	 * navigation — the four-step flow hands in its own `RegistrationStepNav`
	 * and its own wide-layout primary, and a second primary beside them would
	 * be a second way on.
	 */
	primary?: RegistrationFooterAction;
	/** The way out. Omit it and the primary fills the bar. Needs `primary`. */
	secondary?: RegistrationFooterAction;
	/**
	 * Anything that is not the two actions — the back circle of the four-step
	 * flow, for instance. Rendered before them.
	 */
	children?: React.ReactNode;
	/**
	 * Let the bar rise into place the first time it is painted. The four-step
	 * flow does this so the bar arrives with the step rather than being there
	 * before it; the link entry has no step to arrive with, so it defaults off.
	 * A reader who asked for reduced motion gets no movement either way.
	 */
	animateIn?: boolean;
}

/**
 * The bar that sits at the bottom of every registration-shaped screen.
 *
 * **Why this exists.** The bar was written inline in `Registration.tsx`
 * (fixed bottom-right, `100vw` / `60vw`, translucent blurred surface, hairline,
 * safe-area padding) and then written again for the link-entry screen. Two
 * copies of a positioning contract drift the moment one of them is touched —
 * and the second copy already drifted: it sat sticky inside the content column
 * and landed on the stage's legal links. `Registration.tsx` now hands its own
 * navigation in as `children` and this is the only bar left;
 * `registrationFooter.contract.test.tsx` is what proves the two were the same.
 *
 * **What it does not do: paint.** Colours, radius, padding and hover states come
 * from the theme's own `MuiButton` definition (`theme.jsx:139-203`), where
 * `outlined` fills red with white type on hover. A previous draft overrode
 * background and border back to grey but left that white text in place, so the
 * secondary label vanished under the cursor. This component sets layout only,
 * so that cannot happen again (Frank, 2026-09-04: "MUI ist unsere Hauptbasis").
 *
 * **Two actions, not one.** `RegistrationStepNav` is built for a single
 * stretched pill with the arrow in its own disc; beside a second button the two
 * read as different species. A link entry has two equal choices, so both get one
 * geometry and only the role differs.
 *
 * Seven languages share these buttons and German is not the longest of them, so
 * a label that no longer fits is cut with an ellipsis rather than pushing the
 * button out of the bar. The whole text stays reachable through `title`.
 */
export const RegistrationFooter = ({
	primary,
	secondary,
	children,
	animateIn = false
}: RegistrationFooterProps) => (
	<Box
		data-cy="registration-footer"
		sx={{
			...(animateIn ? footerEnterSx : {}),
			position: 'fixed',
			bottom: 0,
			right: 0,
			/* Matches the stage split: full width below the breakpoint, the
			   content column above it, so the bar stops at the red panel and
			   never covers its legal links. */
			width: { xs: '100vw', lg: '60vw' },
			minHeight: { sm: '96px' },
			backgroundColor: 'rgba(255, 255, 255, 0.94)',
			backdropFilter: 'blur(8px)',
			borderTop: `1px solid ${registrationMd3.outlineVariant}`,
			display: 'flex',
			alignItems: 'center',
			gap: 2,
			pt: { xs: 1.5, sm: 0 },
			pb: {
				xs: 'calc(12px + env(safe-area-inset-bottom))',
				sm: 0
			},
			px: { xs: 2, sm: 3, lg: 4 },
			zIndex: 65
		}}
	>
		{children}
		{primary && secondary && (
			<Button
				variant="outlined"
				onClick={secondary.onClick}
				disabled={secondary.disabled}
				title={secondary.title ?? secondary.label}
				data-testid={
					secondary.testId ?? 'registration-footer-secondary'
				}
				sx={{
					...footerActionSx,
					...(secondary.compact ? { flex: '0 0 auto', px: 3 } : {})
				}}
			>
				{secondary.label}
			</Button>
		)}
		{primary && (
			<Button
				variant="contained"
				onClick={primary.onClick}
				disabled={primary.disabled}
				title={primary.title ?? primary.label}
				data-testid={primary.testId ?? 'registration-footer-primary'}
				sx={footerActionSx}
			>
				{primary.label}
			</Button>
		)}
	</Box>
);

/**
 * Motion, not paint: the bar slides up from below its own edge and fades in,
 * once. Spread first so the layout declarations below still win if the two ever
 * name the same property.
 */
const footerEnterSx = {
	'animation': `registrationFooterEnter ${registrationMotion.slow} ${registrationMotion.easeOut} both`,
	'@keyframes registrationFooterEnter': {
		'0%': { opacity: 0, transform: 'translateY(18px)' },
		'100%': { opacity: 1, transform: 'translateY(0)' }
	},
	'@media (prefers-reduced-motion: reduce)': { animation: 'none' }
} as const;

/** Layout only — see the note above about not painting. */
const footerActionSx = {
	flex: '1 1 0',
	minWidth: 0,
	minHeight: 56,
	overflow: 'hidden',
	textOverflow: 'ellipsis',
	whiteSpace: 'nowrap',
	display: 'block'
} as const;
