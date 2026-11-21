import * as React from 'react';
import { Box } from '@mui/material';
import { JourneyQuestionField } from './JourneyQuestionField';
import { JourneyRatingField } from './JourneyRatingField';
import {
	missingRequired,
	type JourneyStep,
	type StepAnswers
} from './journeyModel';

export interface JourneyStepFormProps {
	step: JourneyStep;
	answers: StepAnswers;
	language: string;
	onChange: (answers: StepAnswers) => void;
	/** Mark the required items still open (after a try to go on). */
	showMissing?: boolean;
	disabled?: boolean;
}

/**
 * The questions and ratings of one journey step, in order — the one form the check-in and the
 * chat both show (ORISO-Frontend#2333). It holds no state: answers come in and go out whole, so
 * the caller decides when they are sent and the rules stay in `journeyModel`.
 */
export const JourneyStepForm = ({
	step,
	answers,
	language,
	onChange,
	showMissing = false,
	disabled = false
}: JourneyStepFormProps) => {
	const missing = new Set(showMissing ? missingRequired(step, answers) : []);
	return (
		<Box data-cy="journey-step-form" sx={{ display: 'grid', gap: 3.5 }}>
			{(step.questions ?? []).map((question) => (
				<JourneyQuestionField
					key={question.id}
					question={question}
					answer={answers.questions[question.id]}
					language={language}
					showMissing={missing.has(question.id)}
					disabled={disabled}
					onChange={(answer) =>
						onChange({
							...answers,
							questions: {
								...answers.questions,
								[question.id]: answer
							}
						})
					}
				/>
			))}
			{(step.ratings ?? []).map((rating) => (
				<JourneyRatingField
					key={rating.id}
					rating={rating}
					value={answers.ratings[rating.id]}
					language={language}
					showMissing={missing.has(rating.id)}
					disabled={disabled}
					onChange={(value) =>
						onChange({
							...answers,
							ratings: { ...answers.ratings, [rating.id]: value }
						})
					}
				/>
			))}
		</Box>
	);
};
