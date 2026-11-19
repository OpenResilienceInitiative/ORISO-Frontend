import * as React from 'react';
import { Box, Typography } from '@mui/material';
import {
	registrationScreenIntroSx,
	registrationScreenKickerSx,
	registrationScreenTitleSx
} from '../registration/registrationDesign/registrationDesign';
import { JourneyStepForm } from './JourneyStepForm';
import { textIn, type JourneyStep, type StepAnswers } from './journeyModel';

export interface JourneyCheckInStepProps {
	step: JourneyStep;
	answers: StepAnswers;
	language: string;
	onChange: (answers: StepAnswers) => void;
	showMissing?: boolean;
	/** Small line above the title, e.g. "Schritt 3 von 6" or the topic. */
	kicker?: string;
}

/**
 * A question step of a journey's check-in, in the registration's own look: kicker, title, the
 * editor's line below, then the form (ORISO-Frontend#2333). Same building block wherever it
 * stands in the order — the journey decides the order, the step looks like every other step.
 */
export const JourneyCheckInStep = ({
	step,
	answers,
	language,
	onChange,
	showMissing = false,
	kicker
}: JourneyCheckInStepProps) => {
	const title = textIn(step.title, language);
	const description = textIn(step.description, language);
	return (
		<Box
			data-cy="journey-check-in-step"
			sx={{
				display: 'grid',
				gap: 3,
				maxWidth: 640,
				mx: 'auto',
				width: '100%'
			}}
		>
			<Box sx={{ display: 'grid', gap: 1 }}>
				{kicker && (
					<Typography sx={registrationScreenKickerSx}>
						{kicker}
					</Typography>
				)}
				<Typography component="h1" sx={registrationScreenTitleSx}>
					{title}
				</Typography>
				{description && (
					<Typography sx={registrationScreenIntroSx}>
						{description}
					</Typography>
				)}
			</Box>
			<JourneyStepForm
				step={step}
				answers={answers}
				language={language}
				onChange={onChange}
				showMissing={showMissing}
			/>
		</Box>
	);
};
