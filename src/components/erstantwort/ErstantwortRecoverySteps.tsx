import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Typography } from '@mui/material';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import { stepperColors, stepperMotion } from '../stepper/stepperDesign';

/**
 * The Ersatzschlüssel walkthrough — one step at a time, paged with the arrow
 * keys (ORISO-Frontend, Erstantwort Modul 3).
 *
 * <h3>Why a pager and not a list</h3>
 *
 * The five steps are short but they are *instructions*, and instructions
 * stacked as five bullet points inside an Erstantwort bubble read as another
 * paragraph to scroll past — which is the exact failure mode the ten-bubble
 * Erstantwort already has. One step at a time forces the eye to the sentence
 * that matters now and leaves room for the illustration that will accompany it.
 *
 * <h3>What this component deliberately does not do</h3>
 *
 * It draws **no artwork**. Every step reserves a named, fixed-height slot
 * (`illustration`) with the caption of what the picture is supposed to show;
 * the drawings are commissioned separately and dropped in later. A placeholder
 * that looks like art would be mistaken for the decision.
 *
 * It also holds **no crypto state**. Whether the key is already secured is the
 * caller's business (`ErstantwortRecoveryCard`); this is a pure pager.
 *
 * <h3>Keyboard</h3>
 *
 * The pager itself is the focus target (`tabIndex={0}`), so ArrowLeft /
 * ArrowRight page it — plus Home / End for the ends. The two arrow buttons are
 * real buttons and stay reachable by Tab, because a control that only responds
 * to arrow keys is invisible to anyone who does not already know it is there.
 */

export interface ErstantwortRecoveryStep {
	/** Stable id — used for keys and story assertions, never shown. */
	id: string;
	/** The one line of instruction. Plain language, no crypto vocabulary. */
	text: string;
	/**
	 * What the illustration for this step should show. Rendered as the caption
	 * of the empty slot, so the brief travels with the step instead of living
	 * in a separate document nobody opens.
	 */
	illustrationBrief: string;
}

export interface ErstantwortRecoveryStepsProps {
	steps: ErstantwortRecoveryStep[];
	/** 1-based starting step. Storybook uses it to open on a middle step. */
	initialStep?: number;
	/** Height of the reserved illustration area, in px. */
	illustrationHeight?: number;
	onStepChange?: (step: number) => void;
}

const clamp = (value: number, total: number): number =>
	Math.min(Math.max(value, 1), Math.max(total, 1));

/**
 * The dot row. Clickable, because a dot that shows position but cannot be used
 * to move is a decoration that looks like a control — and on a five-step
 * sequence jumping back to step 2 is the most likely thing somebody wants.
 */
const StepDots: React.FC<{
	total: number;
	current: number;
	onSelect: (step: number) => void;
	label: (step: number) => string;
}> = ({ total, current, onSelect, label }) => (
	<Box sx={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
		{Array.from({ length: total }, (_unused, index) => {
			const step = index + 1;
			const isCurrent = step === current;
			return (
				<Box
					key={step}
					component="button"
					type="button"
					aria-label={label(step)}
					aria-current={isCurrent ? 'step' : undefined}
					data-testid={`erstantwort-recovery-dot-${step}`}
					onClick={() => onSelect(step)}
					sx={{
						'width': isCurrent ? 22 : 8,
						'height': 8,
						'padding': 0,
						'border': 'none',
						'borderRadius': 999,
						'cursor': 'pointer',
						'bgcolor': isCurrent
							? stepperColors.primary
							: stepperColors.surfaceContainerHighest,
						'transition': `width ${stepperMotion.quick} ease, background-color ${stepperMotion.quick} ease`,
						'&:hover': {
							bgcolor: isCurrent
								? stepperColors.primary
								: stepperColors.outline
						},
						'&:focus-visible': {
							outline: `2px solid ${stepperColors.primary}`,
							outlineOffset: '3px'
						},
						'@media (prefers-reduced-motion: reduce)': {
							transition: 'none'
						}
					}}
				/>
			);
		})}
	</Box>
);

const ArrowButton: React.FC<{
	direction: 'prev' | 'next';
	disabled: boolean;
	label: string;
	onClick: () => void;
}> = ({ direction, disabled, label, onClick }) => (
	<Box
		component="button"
		type="button"
		aria-label={label}
		disabled={disabled}
		data-testid={`erstantwort-recovery-${direction}`}
		onClick={onClick}
		sx={{
			'width': 36,
			'height': 36,
			'flexShrink': 0,
			'display': 'inline-flex',
			'alignItems': 'center',
			'justifyContent': 'center',
			'borderRadius': '50%',
			'border': `1px solid ${stepperColors.outline}`,
			'bgcolor': 'transparent',
			'color': stepperColors.onSurface,
			'cursor': 'pointer',
			/* Disabled, not hidden: the person keeps a stable frame to aim at,
			   and the greyed arrow says "this is the first step" (ORISO design
			   rule — disable instead of hide). */
			'&:disabled': {
				color: stepperColors.onSurfaceVariant,
				borderColor: stepperColors.surfaceContainerHighest,
				cursor: 'default',
				opacity: 0.6
			},
			'&:hover:not(:disabled)': {
				bgcolor: stepperColors.selectedLayer
			},
			'&:focus-visible': {
				outline: `2px solid ${stepperColors.primary}`,
				outlineOffset: '2px'
			},
			'& svg': { fontSize: 22 }
		}}
	>
		{direction === 'prev' ? (
			<ChevronLeftRoundedIcon />
		) : (
			<ChevronRightRoundedIcon />
		)}
	</Box>
);

export const ErstantwortRecoverySteps: React.FC<
	ErstantwortRecoveryStepsProps
> = ({ steps, initialStep = 1, illustrationHeight = 128, onStepChange }) => {
	const total = steps.length;
	const [current, setCurrent] = useState(() => clamp(initialStep, total));
	/* Stashed so a caller passing an inline arrow does not re-fire the callback
	   on every render — the same trap ErstantwortSequence documents. */
	const onStepChangeRef = useRef(onStepChange);
	useEffect(() => {
		onStepChangeRef.current = onStepChange;
	}, [onStepChange]);

	const goTo = useCallback(
		(step: number) => {
			const next = clamp(step, total);
			setCurrent((previous) => {
				if (previous !== next) {
					onStepChangeRef.current?.(next);
				}
				return next;
			});
		},
		[total]
	);

	const onKeyDown = useCallback(
		(event: React.KeyboardEvent<HTMLDivElement>) => {
			switch (event.key) {
				case 'ArrowRight':
					goTo(current + 1);
					break;
				case 'ArrowLeft':
					goTo(current - 1);
					break;
				case 'Home':
					goTo(1);
					break;
				case 'End':
					goTo(total);
					break;
				default:
					return;
			}
			// Only swallow the keys we actually consumed, so a screen reader's
			// own arrow-key navigation keeps working everywhere else.
			event.preventDefault();
		},
		[current, goTo, total]
	);

	const step = useMemo(() => steps[current - 1], [steps, current]);
	const progress = `Schritt ${current} von ${total}`;

	if (!total || !step) {
		return null;
	}

	return (
		<Box
			role="group"
			tabIndex={0}
			aria-roledescription="Schrittfolge"
			aria-label="Ersatzschlüssel sichern — Schritt für Schritt"
			data-testid="erstantwort-recovery-steps"
			data-current-step={current}
			onKeyDown={onKeyDown}
			sx={{
				'display': 'flex',
				'flexDirection': 'column',
				'gap': '10px',
				'width': '100%',
				'marginTop': '12px',
				'&:focus-visible': {
					outline: `2px solid ${stepperColors.primary}`,
					outlineOffset: '4px',
					borderRadius: '12px'
				}
			}}
		>
			{/* The reserved picture area. Dashed and captioned on purpose: it
			    must read as "a drawing goes here", never as the drawing. */}
			<Box
				data-testid="erstantwort-recovery-illustration-slot"
				data-step-id={step.id}
				aria-hidden
				sx={{
					height: illustrationHeight,
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
					justifyContent: 'center',
					gap: '4px',
					padding: '8px 14px',
					textAlign: 'center',
					borderRadius: '12px',
					border: `1px dashed ${stepperColors.outline}`,
					/* One tone lighter than the bubble it sits in
					   (`surfaceContainer`), so the reserved area reads as an
					   empty panel rather than as a dashed line on nothing. */
					bgcolor: stepperColors.surface,
					color: stepperColors.onSurfaceVariant
				}}
			>
				<Typography
					sx={{
						fontSize: 11,
						fontWeight: 700,
						letterSpacing: '1px',
						textTransform: 'uppercase'
					}}
				>
					Platz für Grafik
				</Typography>
				<Typography sx={{ fontSize: 12.5, lineHeight: 1.4 }}>
					{step.illustrationBrief}
				</Typography>
			</Box>

			{/* One live region for the whole pager. Announcing the progress and
			    the sentence together is what a person actually needs on a step
			    change; two separate regions would read them out of order. */}
			<Box
				role="status"
				aria-live="polite"
				sx={{ minHeight: '3.2em', display: 'flex', gap: '10px' }}
			>
				<Typography
					aria-hidden
					sx={{
						fontSize: 13,
						fontWeight: 700,
						lineHeight: 1.5,
						flexShrink: 0,
						color: stepperColors.primary
					}}
				>
					{current}.
				</Typography>
				<Typography
					sx={{
						fontSize: 14.5,
						lineHeight: 1.5,
						color: stepperColors.onSurface
					}}
				>
					<Box
						component="span"
						sx={{
							position: 'absolute',
							width: '1px',
							height: '1px',
							padding: 0,
							margin: '-1px',
							overflow: 'hidden',
							clip: 'rect(0 0 0 0)',
							whiteSpace: 'nowrap'
						}}
					>
						{`${progress}: `}
					</Box>
					{step.text}
				</Typography>
			</Box>

			<Box
				sx={{
					display: 'flex',
					alignItems: 'center',
					gap: '10px',
					flexWrap: 'wrap'
				}}
			>
				<ArrowButton
					direction="prev"
					disabled={current === 1}
					label="Vorheriger Schritt"
					onClick={() => goTo(current - 1)}
				/>
				<ArrowButton
					direction="next"
					disabled={current === total}
					label="Nächster Schritt"
					onClick={() => goTo(current + 1)}
				/>
				<StepDots
					total={total}
					current={current}
					onSelect={goTo}
					label={(dotStep) => `Schritt ${dotStep} von ${total}`}
				/>
				<Typography
					aria-hidden
					data-testid="erstantwort-recovery-progress"
					sx={{
						marginLeft: 'auto',
						fontSize: 12,
						fontWeight: 600,
						whiteSpace: 'nowrap',
						color: stepperColors.onSurfaceVariant
					}}
				>
					{progress}
				</Typography>
			</Box>
		</Box>
	);
};
