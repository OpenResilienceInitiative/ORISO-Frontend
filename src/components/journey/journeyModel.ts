/**
 * Journeys as the advice seeker meets them (ADR-036 part E, ORISO-Frontend#2333).
 *
 * The Admin edits a journey per conversation type: a check-in before registering (departure),
 * steps while counselling (flight) and a follow-up after it (arrival). UserService answers the
 * effective journey without what only editors see. This module holds the shape the Frontend
 * reads and the rules for answering it — pure functions, shared by the check-in and the chat.
 */

/** Language code → text. HTML for messages and panels, plain text for labels. */
export type LangMap = Partial<Record<string, string>>;

export const JOURNEY_PHASES = ['departure', 'flight', 'arrival'] as const;
export type JourneyPhase = (typeof JOURNEY_PHASES)[number];

export type StepKind =
	| 'core'
	| 'addon'
	| 'question'
	| 'rating'
	| 'panel'
	| 'message';

/** Core building blocks the platform code owns; the journey only places and words them. */
export type CoreElementId =
	| 'topic'
	| 'postcode'
	| 'agency'
	| 'username'
	| 'consent'
	| 'email'
	| 'enquiry'
	| 'agencyGreeting'
	| 'suggestAlternative'
	| 'agencySurvey';

export type AddonId = 'age' | 'state' | 'accountCompletion';

export type QuestionType = 'text' | 'single' | 'multi' | 'hint';

export interface QuestionOption {
	id: string;
	label: LangMap;
}

export interface JourneyQuestion {
	id: string;
	type: QuestionType;
	/** Only for `single`: radio cards or a dropdown. Same question, other look. */
	display?: 'radio' | 'dropdown';
	required: boolean;
	label: LangMap;
	help?: LangMap;
	options: QuestionOption[];
	/** Single and multiple choice: also offer "Something else …" with a free-text field. */
	other?: boolean;
	version: number;
}

export type RatingType = 'stars' | 'range';

export interface JourneyRating {
	id: string;
	type: RatingType;
	label: LangMap;
	min: number;
	max: number;
	minLabel?: LangMap;
	midLabel?: LangMap;
	maxLabel?: LangMap;
	required: boolean;
	version: number;
}

export interface PanelAspect {
	id: string;
	title: LangMap;
	body: LangMap;
}

export interface JourneyStep {
	id: string;
	kind: StepKind;
	core?: CoreElementId;
	addon?: AddonId;
	title: LangMap;
	description: LangMap;
	body?: LangMap;
	questions?: JourneyQuestion[];
	ratings?: JourneyRating[];
	aspects?: PanelAspect[];
	/** "Choose a topic" only: the link already set the topic, the screen is skipped. */
	preselected?: boolean;
}

export interface Journey {
	id: string;
	conversationType: string;
	phases: Partial<Record<JourneyPhase, JourneyStep[]>>;
	survey?: { anonymous: boolean };
}

/** The link a person came by: its topics and, if any, the centre it preselects. */
export interface JourneyLink {
	slug: string;
	topicIds: number[];
	agencyName?: string;
}

/** What UserService answers; `journey` is null where none is stored (keep today's form). */
export interface PublicJourney {
	journeyId: string | null;
	journey: Journey | null;
	link?: JourneyLink | null;
}

// ---- texts --------------------------------------------------------------------------------------

/**
 * The text for a reader: their language, then (informal German) formal German, then German, then
 * English. Editors write German first; a missing translation must never show an empty label.
 */
export const textIn = (map: LangMap | undefined, language: string): string => {
	if (!map) return '';
	const base = language.split('@')[0];
	const order = [language, base === 'de' ? 'de' : base, 'de', 'en'];
	for (const code of order) {
		const value = map[code]?.trim();
		if (value) return value;
	}
	return (
		Object.values(map)
			.find((value) => value?.trim())
			?.trim() ?? ''
	);
};

// ---- answers ------------------------------------------------------------------------------------

export interface QuestionAnswer {
	/** Chosen option ids (single: at most one). */
	choices?: string[];
	/** Free text: the answer of a text question, or the "something else" text. */
	text?: string;
}

/** The answers to one step: per question id, and per rating id the chosen value. */
export interface StepAnswers {
	questions: Record<string, QuestionAnswer>;
	ratings: Record<string, number>;
}

export const emptyAnswers = (): StepAnswers => ({ questions: {}, ratings: {} });

/** The option id that stands for "something else"; never an id the Admin issues. */
export const OTHER_OPTION = '__other';

const hasText = (value?: string) => Boolean(value && value.trim());

/** Whether a question has an answer: a choice (and its text if it is "something else"), or text. */
export const isQuestionAnswered = (
	question: JourneyQuestion,
	answer?: QuestionAnswer
): boolean => {
	if (question.type === 'hint') return true;
	if (question.type === 'text') return hasText(answer?.text);
	const choices = answer?.choices ?? [];
	if (choices.length === 0) return false;
	return !choices.includes(OTHER_OPTION) || hasText(answer?.text);
};

/** Questions and ratings of a step a person must still answer before going on. */
export const missingRequired = (
	step: JourneyStep,
	answers: StepAnswers
): string[] => [
	...(step.questions ?? [])
		.filter(
			(question) =>
				question.required &&
				!isQuestionAnswered(question, answers.questions[question.id])
		)
		.map((question) => question.id),
	...(step.ratings ?? [])
		.filter(
			(rating) =>
				rating.required && answers.ratings[rating.id] === undefined
		)
		.map((rating) => rating.id)
];

export const isStepComplete = (step: JourneyStep, answers: StepAnswers) =>
	missingRequired(step, answers).length === 0;

/** Single choice keeps one option; multiple choice toggles. Choosing a real option of a single
 * choice drops a "something else" text, so no stale text travels with the answer. */
export const choose = (
	question: JourneyQuestion,
	answer: QuestionAnswer | undefined,
	optionId: string
): QuestionAnswer => {
	const current = answer?.choices ?? [];
	if (question.type === 'single') {
		return {
			choices: [optionId],
			text: optionId === OTHER_OPTION ? answer?.text : undefined
		};
	}
	const choices = current.includes(optionId)
		? current.filter((id) => id !== optionId)
		: [...current, optionId];
	return {
		choices,
		text: choices.includes(OTHER_OPTION) ? answer?.text : undefined
	};
};

/** One line per answered item, for the folded card after sending: "Label: answer". */
export const answerSummary = (
	step: JourneyStep,
	answers: StepAnswers,
	language: string,
	otherLabel: string
): { id: string; label: string; value: string }[] => {
	const lines: { id: string; label: string; value: string }[] = [];
	(step.questions ?? []).forEach((question) => {
		const answer = answers.questions[question.id];
		if (question.type === 'hint' || !isQuestionAnswered(question, answer))
			return;
		const value =
			question.type === 'text'
				? answer!.text!.trim()
				: (answer!.choices ?? [])
						.map((id) =>
							id === OTHER_OPTION
								? `${otherLabel}: ${answer!.text!.trim()}`
								: textIn(
										question.options.find(
											(option) => option.id === id
										)?.label,
										language
									)
						)
						.join(', ');
		lines.push({
			id: question.id,
			label: textIn(question.label, language),
			value
		});
	});
	(step.ratings ?? []).forEach((rating) => {
		const value = answers.ratings[rating.id];
		if (value === undefined) return;
		lines.push({
			id: rating.id,
			label: textIn(rating.label, language),
			value:
				rating.type === 'stars'
					? `${'★'.repeat(value)}${'☆'.repeat(rating.max - value)}`
					: String(value)
		});
	});
	return lines;
};

/** Steps of a phase the person answers (questions and ratings); messages and panels are read only. */
export const isAnswerable = (step: JourneyStep) =>
	step.kind === 'question' || step.kind === 'rating';
