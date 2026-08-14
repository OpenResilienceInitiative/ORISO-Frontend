import * as React from 'react';
import { ReactNode, useEffect, useMemo, useRef } from 'react';
import { Box } from '@mui/material';
import { StepDot, StepDotSize } from '../atoms/StepDot';
import { StepConnector } from '../atoms/StepConnector';
import { StepLabel } from '../atoms/StepLabel';
import { stepperColors } from '../stepperDesign';

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
	/** Ring around the active dot — off in dialogs, where vertical space is tight. */
	emphasizeActive?: boolean;
	/** Accessible name for the surrounding navigation landmark. */
	ariaLabel?: string;
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
	emphasizeActive = true,
	ariaLabel
}: IconStepperProps) => {
	const activeRef = useRef<HTMLDivElement>(null);
	const clickable = useMemo(
		() => new Set(clickableStepNames),
		[clickableStepNames]
	);
	const currentIndex = useMemo(() => {
		const index = steps.findIndex(({ name }) => name === currentStepName);
		return index >= 0 ? index : 0;
	}, [currentStepName, steps]);

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
		<Box
			component="nav"
			aria-label={ariaLabel}
			data-cy="icon-stepper"
			sx={{
				'display': 'flex',
				'alignItems': 'flex-start',
				'width': '100%',
				'overflowX': { xs: 'auto', md: 'visible' },
				'scrollbarWidth': 'none',
				'&::-webkit-scrollbar': { display: 'none' }
			}}
		>
			{steps.map(({ name, label, icon }, index) => {
				const state =
					index < currentIndex
						? 'done'
						: index === currentIndex
							? 'active'
							: 'pending';
				const isClickable = Boolean(onStepClick) && clickable.has(name);
				const activate = () => onStepClick?.(name);

				return (
					<React.Fragment key={name}>
						<Box
							ref={state === 'active' ? activeRef : undefined}
							aria-current={
								state === 'active' ? 'step' : undefined
							}
							aria-label={isClickable ? label : undefined}
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
								'cursor': isClickable ? 'pointer' : 'default',
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
						{index < steps.length - 1 && (
							<StepConnector
								done={index < currentIndex}
								size={size}
							/>
						)}
					</React.Fragment>
				);
			})}
		</Box>
	);
};
