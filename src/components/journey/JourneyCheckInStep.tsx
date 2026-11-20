import * as React from 'react';
import { Box, Typography } from '@mui/material';
import {
	registrationScreenIntroSx,
	registrationScreenKickerSx,
	registrationScreenTitleSx
} from '../registration/registrationDesign/registrationDesign';
import { JourneyQuestionPager } from './JourneyQuestionPager';
import { textIn, type JourneyStep, type StepAnswers } from './journeyModel';
import { TEXT_LINES, clampLines } from './journeyTextLimits';

export interface JourneyCheckInStepProps {
	step: JourneyStep;
	answers: StepAnswers;
	language: string;
	onChange: (answers: StepAnswers) => void;
	/** Every required question is answered: the registration's "Weiter" may light up. */
	onCompleteChange?: (complete: boolean) => void;
	/** Small line above the title, e.g. "Schritt 3 von 6" or the topic. */
	kicker?: string;
}

/**
 * A question step of a journey's check-in, in the registration's own look: kicker, title, the
 * editor's line below, then one question per screen (ORISO-Frontend#2333, Frank 2026-11-20: no
 * scrolling in the check-in). Same building block wherever it stands in the order.
 */
export const JourneyCheckInStep = ({
	step,
	answers,
	language,
	onChange,
	onCompleteChange,
	kicker
}: JourneyCheckInStepProps) => {
	const title = textIn(step.title, language);
	const description = textIn(step.description, language);
	return (
		<Box
			data-cy="journey-check-in-step"
			sx={{ height: '100%', maxWidth: 640, mx: 'auto', width: '100%' }}
		>
			<JourneyQuestionPager
				step={step}
				answers={answers}
				language={language}
				onChange={onChange}
				onCompleteChange={onCompleteChange}
				header={
					<Box sx={{ display: 'grid', gap: 1 }}>
						{kicker && (
							<Typography sx={registrationScreenKickerSx}>
								{kicker}
							</Typography>
						)}
						<Typography
							component="h1"
							title={title}
							sx={{
								...registrationScreenTitleSx,
								...clampLines(TEXT_LINES.stepTitle)
							}}
						>
							{title}
						</Typography>
						{description && (
							<Typography
								title={description}
								sx={{
									...registrationScreenIntroSx,
									...clampLines(TEXT_LINES.stepDescription)
								}}
							>
								{description}
							</Typography>
						)}
					</Box>
				}
			/>
		</Box>
	);
};
