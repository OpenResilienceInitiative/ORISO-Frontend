import * as React from 'react';
import { ReactNode, useEffect, useMemo, useRef } from 'react';
import { Box } from '@mui/material';
import { StepDot, StepDotSize } from '../atoms/StepDot';
import { StepConnector } from '../atoms/StepConnector';
import { StepLabel } from '../atoms/StepLabel';
import { stepperColors } from '../stepperDesign';
import { ScrollArrows } from './ScrollArrows';

export interface IconStepperItem {
	/** Stable id used for React keys, click callbacks and `data-cy`. */
	name: string;
	label: string;
	icon: ReactNode;
}

export interface IconStepperProps {
	steps: IconStepperItem[];
	currentStepName: string;
	size?: StepDotSize;
	/** Steps the user may jump back to. Everything else is inert. */
	clickableStepNames?: string[];
	onStepClick?: (stepName: string) => void;
	/** Every step is behind the user: all done, none active. */
	completed?: boolean;
	/** Ring around the active dot — off in dialogs, where vertical space is tight. */
	emphasizeActive?: boolean;
	/** Accessible name for the surrounding navigation landmark. */
	ariaLabel?: string;
	/**
	 * Translated words for "done" / "current" / "open". Completion is drawn as
	 * a colour plus an `aria-hidden` check mark, so without these a screen
	 * reader cannot tell a finished step from a pending one. The caller owns
	 * the `t` instance, hence the injection.
	 */
	stateLabel?: (state: 'done' | 'active' | 'pending') => string;
	/**
	 * Above this many steps the row scrolls sideways, with arrow buttons over its edges like a
	 * gallery (Frank, 2026-11-20); the current step is kept in view. Without it every step fits.
	 */
	maxVisible?: number;
	/** Names of the arrow buttons, e.g. "Vorige Schritte" / "Nächste Schritte". */
	scrollLabels?: { back: string; forward: string };
}

/**
 * Dots, connectors and captions in a row — the desktop registration header and
 * the setup dialogs render the same component at two sizes. Before this, the
 * two surfaces each carried their own copy and had visibly drifted apart
 * (34 px SCSS circles vs. 44 px MUI circles, different "done" treatment).
 */
export const IconStepper = ({
	steps,
	currentStepName,
	size = 'md',
	clickableStepNames = [],
	onStepClick,
	completed = false,
	emphasizeActive = true,
	ariaLabel,
	stateLabel,
	maxVisible,
	scrollLabels = { back: 'Zurück', forward: 'Weiter' }
}: IconStepperProps) => {
	const activeRef = useRef<HTMLDivElement>(null);
	const rowRef = useRef<HTMLDivElement>(null);
	const scrolls = maxVisible !== undefined && steps.length > maxVisible;
	const clickable = useMemo(
		() => new Set(clickableStepNames),
		[clickableStepNames]
	);
	const currentIndex = useMemo(() => {
		if (completed) {
			return steps.length;
		}
		const index = steps.findIndex(({ name }) => name === currentStepName);
		return index >= 0 ? index : 0;
	}, [completed, currentStepName, steps]);

	useEffect(() => {
		// TopicSelection and StepDot already respect this; the auto-scroll
		// was the last place that animated regardless.
		const reducedMotion =
			typeof window !== 'undefined' &&
			typeof window.matchMedia === 'function' &&
			window.matchMedia('(prefers-reduced-motion: reduce)').matches;

		activeRef.current?.scrollIntoView({
			behavior: reducedMotion ? 'auto' : 'smooth',
			inline: 'center',
			block: 'nearest'
		});
	}, [currentIndex]);

	return (
		<Box sx={{ position: 'relative', width: '100%' }}>
			<Box
				component="nav"
				ref={rowRef}
				aria-label={ariaLabel}
				data-cy="icon-stepper"
				data-scrolls={scrolls ? 'true' : undefined}
				// A row that scrolls must be reachable by keyboard, so the arrow keys can scroll it.
				tabIndex={scrolls ? 0 : undefined}
				sx={{
					'display': 'flex',
					'alignItems': 'flex-start',
					// Few steps sit together in the middle instead of spreading over the band.
					'justifyContent': scrolls ? 'flex-start' : 'center',
					'width': '100%',
					'overflowX': scrolls
						? 'auto'
						: { xs: 'auto', md: 'visible' },
					'scrollBehavior': 'smooth',
					'scrollbarWidth': 'none',
					'&::-webkit-scrollbar': { display: 'none' }
				}}
			>
				{steps.map(({ name, label, icon }, index) => {
					const isLast = index === steps.length - 1;
					const state =
						index < currentIndex
							? 'done'
							: index === currentIndex
								? 'active'
								: 'pending';
					const isClickable =
						Boolean(onStepClick) && clickable.has(name);
					const activate = () => onStepClick?.(name);

					return (
						<React.Fragment key={name}>
							<Box
								ref={
									state === 'active' ||
									(completed && index === steps.length - 1)
										? activeRef
										: undefined
								}
								aria-current={
									state === 'active' ? 'step' : undefined
								}
								aria-label={
									stateLabel
										? `${label}, ${stateLabel(state)}`
										: isClickable
											? label
											: undefined
								}
								data-cy={`icon-stepper-step-${name}`}
								onClick={isClickable ? activate : undefined}
								onKeyDown={
									isClickable
										? (event) => {
												if (
													event.key === 'Enter' ||
													event.key === ' '
												) {
													event.preventDefault();
													activate();
												}
											}
										: undefined
								}
								role={isClickable ? 'button' : undefined}
								tabIndex={isClickable ? 0 : undefined}
								sx={{
									'display': 'flex',
									'flexDirection': 'column',
									'alignItems': 'center',
									'gap': 0.5,
									'width': size === 'sm' ? 72 : 112,
									'flexShrink': 0,
									'borderRadius': 2,
									'cursor': isClickable
										? 'pointer'
										: 'default',
									'outline': 'none',
									'&:focus-visible': {
										boxShadow: `0 0 0 3px ${stepperColors.focusLayer}`
									}
								}}
							>
								<StepDot
									state={state}
									icon={icon}
									size={size}
									emphasizeActive={emphasizeActive}
								/>
								<StepLabel state={state} size={size}>
									{label}
								</StepLabel>
							</Box>
							{!isLast && (
								<StepConnector
									done={index < currentIndex}
									size={size}
								/>
							)}
						</React.Fragment>
					);
				})}
			</Box>
			{scrolls && (
				<ScrollArrows
					rowRef={rowRef}
					labels={scrollLabels}
					watch={currentIndex}
				/>
			)}
		</Box>
	);
};
