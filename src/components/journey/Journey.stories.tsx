import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box } from '@mui/material';
import { expect, fn, userEvent, within } from 'storybook/test';
import { RegistrationHeader } from '../registration/registrationHeader/RegistrationHeader';
import { phone375Globals } from '../message/messageStoryShell';
import { JourneyCheckInStep } from './JourneyCheckInStep';
import { JourneyChatCard } from './JourneyChatCard';
import { JourneyQuestionField } from './JourneyQuestionField';
import { JourneyRatingField } from './JourneyRatingField';
import {
	emptyAnswers,
	type QuestionAnswer,
	type StepAnswers
} from './journeyModel';
import {
	arrivalStep,
	flightStep,
	note,
	privacyHint,
	range,
	since,
	situation,
	situationStep,
	stars,
	worries
} from './journeyFixtures';

const meta: Meta = {
	title: 'Entry flows/Journeys',
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'Journeys as the advice seeker meets them (ADR-036 part E, #2333): the check-in before registering, with the steps an editor placed between the platform steps, and the questions of the flight and the arrival in the chat. One form (`JourneyStepForm`) serves both; the rules live in `journeyModel`.'
			}
		}
	}
};
export default meta;
type Story = StoryObj;

const Page = ({ children }: { children: React.ReactNode }) => (
	<Box
		sx={{
			minHeight: '100vh',
			backgroundColor: 'var(--m3-background, #fff)',
			pb: 6
		}}
	>
		{children}
	</Box>
);

/** A check-in of `names` steps, standing on `current`, with the journey's own question step in it. */
const CheckIn = ({ names, current }: { names: string[]; current: string }) => {
	const [answers, setAnswers] = useState<StepAnswers>(emptyAnswers);
	return (
		<Page>
			<RegistrationHeader
				currentStepName={current}
				visibleStepNames={names}
				customSteps={[
					{ name: 'journey:situation', label: 'Ihre Situation' },
					{ name: 'journey:family', label: 'Familie' },
					{ name: 'journey:income', label: 'Einkommen' },
					{ name: 'journey:wishes', label: 'Wünsche' }
				]}
				fullBleed={false}
			/>
			<Box sx={{ px: { xs: 2, sm: 4 }, pt: 4 }}>
				<JourneyCheckInStep
					step={situationStep}
					answers={answers}
					onChange={setAnswers}
					language="de"
					kicker="Schuldenberatung"
				/>
			</Box>
		</Page>
	);
};

const TWO = ['topic-selection', 'journey:situation'];
const FOUR = [
	'topic-selection',
	'journey:situation',
	'zipcode',
	'account-data'
];
const EIGHT = [
	'topic-selection',
	'journey:situation',
	'journey:family',
	'journey:income',
	'zipcode',
	'agency-selection',
	'journey:wishes',
	'account-data'
];

/** Two steps: the stepper stays light, the question step looks like every registration step. */
export const CheckInTwoSteps: Story = {
	render: () => <CheckIn names={TWO} current="journey:situation" />
};

/** Four steps: the journey's question sits between topic and postcode. */
export const CheckInFourSteps: Story = {
	render: () => <CheckIn names={FOUR} current="journey:situation" />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			await canvas.findByRole('radio', { name: 'Mahnungen oder Inkasso' })
		);
		await expect(
			canvas.getByRole('radio', { name: 'Mahnungen oder Inkasso' })
		).toBeChecked();
	}
};

/** Eight steps: the desktop stepper folds the far ones ("3 erledigt", "+3") and keeps its width. */
export const CheckInEightStepsFolds: Story = {
	render: () => <CheckIn names={EIGHT} current="journey:income" />,
	play: async ({ canvasElement }) => {
		await within(canvasElement).findByRole('navigation');
		const nav = canvasElement.querySelector(
			'[data-cy="icon-stepper"]'
		) as HTMLElement;
		await expect(
			nav.querySelector('[data-cy="icon-stepper-folded-before"]')
		).not.toBeNull();
		await expect(
			nav.querySelector('[data-cy="icon-stepper-folded-after"]')
		).not.toBeNull();
		await expect(
			nav.querySelector('[data-cy="icon-stepper-step-journey:income"]')
		).not.toBeNull();
	}
};

/** On the phone the header is one row, "Schritt 4 von 8", however many steps there are. */
export const CheckInEightStepsPhone: Story = {
	globals: phone375Globals,
	render: () => <CheckIn names={EIGHT} current="journey:income" />
};

/** Every kind of question in one step: cards, multiple choice, dropdown, free text, a hint. */
const AllQuestions = () => {
	const [answers, setAnswers] = useState<Record<string, QuestionAnswer>>({});
	const [ratings, setRatings] = useState<Record<string, number>>({});
	const field = (question: typeof situation) => (
		<JourneyQuestionField
			key={question.id}
			question={question}
			answer={answers[question.id]}
			language="de"
			onChange={(answer) =>
				setAnswers((current) => ({ ...current, [question.id]: answer }))
			}
		/>
	);
	return (
		<Page>
			<Box
				sx={{
					display: 'grid',
					gap: 4,
					maxWidth: 640,
					mx: 'auto',
					px: 2,
					pt: 4
				}}
			>
				{[situation, worries, since, note, privacyHint].map(field)}
				{[stars, range].map((rating) => (
					<JourneyRatingField
						key={rating.id}
						rating={rating}
						value={ratings[rating.id]}
						language="de"
						onChange={(value) =>
							setRatings((current) => ({
								...current,
								[rating.id]: value
							}))
						}
					/>
				))}
			</Box>
		</Page>
	);
};

export const QuestionTypes: Story = {
	render: () => <AllQuestions />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const others = await canvas.findAllByRole('radio', {
			name: 'Etwas anderes'
		});
		await userEvent.click(others[0]);
		await expect(
			canvas.getByRole('textbox', { name: 'Was genau?' })
		).toHaveFocus();
		await userEvent.click(canvas.getByRole('checkbox', { name: 'Miete' }));
		await userEvent.click(
			canvas.getByRole('checkbox', { name: 'Familie' })
		);
		await expect(
			canvas.getByRole('checkbox', { name: 'Familie' })
		).toBeChecked();
		await userEvent.click(
			canvas.getByRole('radio', { name: '4 von 5 Sternen' })
		);
		await expect(
			canvas.getByRole('radio', { name: '4 von 5 Sternen' })
		).toBeChecked();
	}
};

export const QuestionTypesPhone: Story = {
	globals: phone375Globals,
	render: () => <AllQuestions />
};

const Chat = ({ children }: { children: React.ReactNode }) => (
	<Page>
		<Box sx={{ maxWidth: 720, mx: 'auto', px: 2, pt: 4 }}>{children}</Box>
	</Page>
);

/** In flight: a question in the chat, sent with one button; a required question is checked first. */
export const ChatFlightQuestion: Story = {
	render: () => (
		<Chat>
			<JourneyChatCard
				step={flightStep}
				phase="flight"
				language="de"
				onSubmit={fn().mockResolvedValue(undefined)}
			/>
		</Chat>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			await canvas.findByRole('button', { name: 'Antworten senden' })
		);
		await expect(canvas.getAllByRole('alert')[0]).toHaveTextContent(
			'Bitte beantworten Sie diese Frage.'
		);
	}
};

/** Arrival: the follow-up survey with stars and a range, anonymous as the journey says. */
export const ChatArrivalSurvey: Story = {
	render: () => (
		<Chat>
			<JourneyChatCard
				step={arrivalStep}
				phase="arrival"
				language="de"
				anonymous
				onSubmit={fn().mockResolvedValue(undefined)}
			/>
		</Chat>
	)
};

export const ChatArrivalSurveyPhone: Story = {
	globals: phone375Globals,
	render: ChatArrivalSurvey.render
};

/** Once sent, the card folds to what was answered; nothing is asked twice. */
export const ChatAnswered: Story = {
	render: () => (
		<Chat>
			<JourneyChatCard
				step={arrivalStep}
				phase="arrival"
				language="de"
				sent={{
					questions: {
						note: { text: 'Die Beraterin war sehr geduldig.' }
					},
					ratings: { satisfaction: 5, feeling: 3 }
				}}
				onSubmit={fn()}
			/>
		</Chat>
	)
};

/** Sending failed: the answers stay, the card says so. */
export const ChatSendFailed: Story = {
	render: () => (
		<Chat>
			<JourneyChatCard
				step={flightStep}
				phase="flight"
				language="de"
				onSubmit={fn().mockRejectedValue(new Error('offline'))}
			/>
		</Chat>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			await canvas.findByRole('radio', { name: 'Mahnungen oder Inkasso' })
		);
		await userEvent.click(
			canvas.getByRole('button', { name: 'Antworten senden' })
		);
		await expect(
			await canvas.findByText(/Das hat nicht geklappt/)
		).toBeInTheDocument();
	}
};
