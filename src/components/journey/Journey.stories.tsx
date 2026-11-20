import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box } from '@mui/material';
import { expect, fn, userEvent, within } from 'storybook/test';
import { RegistrationHeader } from '../registration/registrationHeader/RegistrationHeader';
import { RegistrationStepNav } from '../registration/registrationStepNav/RegistrationStepNav';
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

/**
 * A check-in of `names` steps, standing on `current`: the header, one question per screen, and the
 * registration's own bar, whose "Weiter" lights up only once the step is complete. The whole
 * thing fits the screen: nothing scrolls (Frank, 2026-11-20).
 */
const CUSTOM_STEPS = [
	{
		name: 'journey:situation',
		label: 'Ihre Situation',
		kind: 'question' as const
	},
	{ name: 'journey:family', label: 'Familie', kind: 'question' as const },
	{ name: 'journey:income', label: 'Einkommen', kind: 'question' as const },
	{ name: 'journey:wishes', label: 'Zufriedenheit', kind: 'rating' as const },
	...Array.from({ length: 16 }, (_unused, index) => ({
		name: `journey:extra${index + 1}`,
		label: `Frageblock ${index + 1}`,
		kind: index % 3 === 2 ? ('rating' as const) : ('question' as const)
	}))
];

const CheckIn = ({
	names,
	current,
	step = situationStep
}: {
	names: string[];
	current: string;
	step?: typeof situationStep;
}) => {
	const [answers, setAnswers] = useState<StepAnswers>(emptyAnswers);
	const [complete, setComplete] = useState(false);
	return (
		<>
			<Box
				data-cy="journey-check-in-screen"
				sx={{
					height: '100vh',
					display: 'grid',
					gridTemplateRows: 'auto 1fr auto',
					overflow: 'hidden',
					backgroundColor: 'var(--m3-background, #fff)'
				}}
			>
				<RegistrationHeader
					currentStepName={current}
					visibleStepNames={names}
					customSteps={CUSTOM_STEPS}
					fullBleed={false}
				/>
				<Box
					sx={{
						px: { xs: 2, sm: 4 },
						py: { xs: 2, sm: 3 },
						minHeight: 0,
						overflow: 'hidden'
					}}
				>
					<JourneyCheckInStep
						step={step}
						answers={answers}
						onChange={setAnswers}
						onCompleteChange={setComplete}
						language="de"
						kicker="Schuldenberatung"
					/>
				</Box>
				<Box
					sx={{
						px: { xs: 2, sm: 4 },
						py: 2,
						borderTop:
							'1px solid var(--m3-outline-variant, #c4c7c7)'
					}}
				>
					<Box sx={{ maxWidth: 640, mx: 'auto' }}>
						<RegistrationStepNav
							prevStepUrl="/registration/topic-selection"
							backLabel="Zurück"
							nextStepUrl="/registration/zipcode"
							nextLabel="Weiter"
							registerLabel="Registrieren"
							registeringLabel="Registrieren …"
							disabledNext={!complete}
						/>
					</Box>
				</Box>
			</Box>
		</>
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

/**
 * Four steps, one question per screen: a choice moves on by itself, the next question slides in;
 * back returns to change it; "Weiter" below lights up only once every required answer is there.
 */
export const CheckInFourSteps: Story = {
	render: () => <CheckIn names={FOUR} current="journey:situation" />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			await canvas.findByText('Frage 1 von 3')
		).toBeInTheDocument();
		await expect(
			canvas.queryByText('Was belastet Sie gerade am meisten?')
		).toBeNull();
		await userEvent.click(
			canvas.getByRole('radio', { name: 'Mahnungen oder Inkasso' })
		);
		await expect(
			await canvas.findByText('Frage 2 von 3', {}, { timeout: 2000 })
		).toBeInTheDocument();
		await userEvent.click(
			canvas.getByRole('button', { name: 'Vorige Frage' })
		);
		await expect(
			await canvas.findByRole('radio', { name: 'Mahnungen oder Inkasso' })
		).toBeChecked();
		await expect(
			canvasElement.querySelector('[data-cy="journey-check-in-screen"]')!
				.scrollHeight
		).toBeLessThanOrEqual(
			canvasElement.ownerDocument.documentElement.clientHeight + 1
		);
	}
};

/**
 * Eight steps: more than fit, so the stepper scrolls sideways with arrows; the rating step
 * („Zufriedenheit“) has its own icon next to the question steps.
 */
export const CheckInEightSteps: Story = {
	render: () => <CheckIn names={EIGHT} current="journey:income" />,
	play: async ({ canvasElement }) => {
		await within(canvasElement).findByRole('navigation');
		const nav = canvasElement.querySelector(
			'[data-cy="icon-stepper"]'
		) as HTMLElement;
		await expect(
			nav.querySelector('[data-cy="icon-stepper-step-journey:income"]')
		).not.toBeNull();
	}
};

const TWENTY = [
	'topic-selection',
	...CUSTOM_STEPS.slice(0, 16).map((step) => step.name),
	'zipcode',
	'agency-selection',
	'account-data'
];

/**
 * Twenty steps: beyond the limit the stepper scrolls sideways like a gallery, with arrows over its
 * edges; the current step stays in view and every earlier step can still be reached.
 */
export const CheckInTwentySteps: Story = {
	render: () => <CheckIn names={TWENTY} current="journey:extra5" />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await canvas.findByRole('navigation');
		await expect(
			canvasElement.querySelector('[data-cy="icon-stepper"]')
		).toHaveAttribute('data-scrolls', 'true');
		await expect(
			await canvas.findByRole('button', { name: 'Vorige Schritte' })
		).toBeInTheDocument();
	}
};

/** On the phone the header is one row, "Schritt x von n"; many steps become small dots. */
export const CheckInTwentyStepsPhone: Story = {
	globals: phone375Globals,
	render: () => <CheckIn names={TWENTY} current="journey:extra5" />
};

const longStep = {
	...situationStep,
	title: {
		de: 'Ihre finanzielle Situation im Überblick, damit wir passend beraten können'
	},
	description: {
		de: 'Bevor wir loslegen, möchten wir Ihre Lage ein wenig besser verstehen. Diese Fragen helfen der Beratungsstelle, sich vorzubereiten, damit das erste Gespräch gleich weiterhilft. Sie können alles überspringen, was nicht als Pflicht markiert ist, und Ihre Antworten später im Gespräch ergänzen oder ändern. Ihre Angaben sieht nur die Beratungsstelle, die Sie wählen.'
	},
	questions: [
		{
			...situation,
			label: {
				de: 'Wie würden Sie Ihre derzeitige Lage beschreiben, wenn Sie an Ihre Schulden, laufenden Rechnungen und die Briefe denken, die in den letzten Wochen gekommen sind?'
			}
		},
		...(situationStep.questions ?? []).slice(1)
	]
};

/**
 * Very long texts: the step's line stops after four lines and the question after two, with "…";
 * the Admin editor warns long before (ORISO-Admin#1551).
 */
export const CheckInLongTexts: Story = {
	render: () => (
		<CheckIn names={FOUR} current="journey:situation" step={longStep} />
	)
};

export const CheckInLongTextsPhone: Story = {
	globals: phone375Globals,
	render: () => (
		<CheckIn names={FOUR} current="journey:situation" step={longStep} />
	)
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
			canvas.getAllByRole('textbox', { name: 'Was genau?' })[0]
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
