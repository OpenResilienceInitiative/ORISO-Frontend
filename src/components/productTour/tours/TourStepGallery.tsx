import * as React from 'react';
import { ProductTourTooltip } from '../ProductTourTooltip';
import { mapStepsToJoyride } from '../tourEngine';
import type { TourDefinition } from '../types';
import '../productTour.styles.scss';

/**
 * Every step of one tour as the real tooltip renders it (title, copy,
 * Back/Next/Done), in order — the reviewer reads the whole tour's copy at a
 * glance in each language and viewport. Positioning against the live page
 * is proven in the app, not here.
 */
export const TourStepGallery = ({ tour }: { tour: TourDefinition }) => {
	const steps = mapStepsToJoyride(tour.steps);
	return (
		<ol
			aria-label={tour.id}
			style={{
				display: 'grid',
				gap: 24,
				gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
				listStyle: 'none',
				margin: 0,
				padding: 16
			}}
		>
			{steps.map((step, index) => (
				<li key={String(step.id)} data-step-id={String(step.id)}>
					<ProductTourTooltip
						{...({
							index,
							size: steps.length,
							isLastStep: index === steps.length - 1,
							continuous: true,
							step,
							backProps: {},
							closeProps: {},
							primaryProps: {},
							skipProps: {},
							tooltipProps: {},
							controls: {
								next: () => {},
								prev: () => {},
								skip: () => {},
								close: () => {}
							}
						} as never)}
					/>
				</li>
			))}
		</ol>
	);
};
