import * as React from 'react';
import { useState } from 'react';
import { SlideFrom, SlideIn } from './SlideIn';
import { transitionMotion } from './transitionMotion';

export interface StepTransitionProps {
	/** Identifies the step; a new one slides in, the same one never replays. */
	viewKey: string;
	/** Position of the step in its flow, so going back slides the other way. */
	order: number;
	children: React.ReactNode;
}

/** How far a step travels inside its column: noticeable, never a page swap. */
const STEP_DISTANCE = '48px';

/**
 * One step of a flow. Forwards it slides in from the right, going back from
 * the left, and the header, footer and stage around the flow stay put.
 */
export const StepTransition = ({
	viewKey,
	order,
	children
}: StepTransitionProps) => {
	// Derived during render, not in an effect: the direction must be known
	// for the very render that mounts the new step.
	const [shown, setShown] = useState<{
		viewKey: string;
		order: number;
		from: SlideFrom;
		first: boolean;
	}>({ viewKey, order, from: 'right', first: true });

	if (shown.viewKey !== viewKey) {
		setShown({
			viewKey,
			order,
			from: order < shown.order ? 'left' : 'right',
			first: false
		});
	}

	return (
		<SlideIn
			key={shown.viewKey}
			data-cy="step-transition"
			from={shown.from}
			distance={STEP_DISTANCE}
			durationMs={transitionMotion.stepMs}
			// Landing on the first step is not an arrival to animate.
			animate={!shown.first}
		>
			{children}
		</SlideIn>
	);
};
